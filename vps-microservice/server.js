// ==================================================================
// ANAF UPLOAD MICROSERVICE - Server cu certificat digital
// ==================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const forge = require('node-forge');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');
const https = require('https');
const winston = require('winston');
const { DOMParser, XMLSerializer } = require('xmldom');
const SignedXml = require('xml-crypto').SignedXml;

// ==================================================================
// CONFIGURARE LOGGING
// ==================================================================

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// ==================================================================
// CONFIGURARE EXPRESS
// ==================================================================

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware securitate
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minut
  max: 100, // max 100 requests per minut
  message: 'Prea multe request-uri, te rog așteaptă un minut.'
});
app.use('/upload-invoice', limiter);

// ==================================================================
// MIDDLEWARE AUTENTIFICARE API KEY
// ==================================================================

function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    logger.error('API_KEY not configured in environment');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (!apiKey || apiKey !== validApiKey) {
    logger.warn('Unauthorized access attempt', {
      ip: req.ip,
      headers: req.headers
    });
    return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
  }

  next();
}

// ==================================================================
// ÎNCĂRCARE CERTIFICAT DIGITAL
// ==================================================================

let certificatePEM = null;
let privateKeyPEM = null;

function loadCertificate() {
  try {
    const certPath = process.env.CERT_PATH || './unitar-anaf-cert.p12';
    const certPassword = process.env.CERT_PASSWORD;

    if (!certPassword) {
      throw new Error('CERT_PASSWORD not set in environment');
    }

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificate file not found: ${certPath}`);
    }

    logger.info('Loading certificate from:', certPath);

    // Citește certificatul .p12
    const p12Content = fs.readFileSync(certPath, 'binary');

    // Parse PKCS#12 cu node-forge
    const p12Asn1 = forge.asn1.fromDer(p12Content);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword);

    // Extrage certificatul
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag][0];
    const certificate = certBag.cert;

    // Extrage cheia privată
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    const privateKey = keyBag.key;

    // Convertește în PEM format
    certificatePEM = forge.pki.certificateToPem(certificate);
    privateKeyPEM = forge.pki.privateKeyToPem(privateKey);

    logger.info('✅ Certificate loaded successfully', {
      subject: certificate.subject.getField('CN').value,
      issuer: certificate.issuer.getField('CN').value,
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter
    });

    // Verifică validitatea certificatului
    const now = new Date();
    if (now < certificate.validity.notBefore || now > certificate.validity.notAfter) {
      logger.error('⚠️  Certificate is expired or not yet valid!');
      throw new Error('Certificate is not valid');
    }

    return true;

  } catch (error) {
    logger.error('❌ Failed to load certificate:', error.message);
    certificatePEM = null;
    privateKeyPEM = null;
    return false;
  }
}

// Încarcă certificatul la pornire
const certLoaded = loadCertificate();

if (!certLoaded) {
  logger.error('⚠️  Server pornit FĂRĂ certificat valid - upload-ul va eșua!');
}

// ==================================================================
// SEMNARE XML CU XMLDSig
// ==================================================================

/**
 * Semnează XML-ul cu certificatul digital conform standardului XMLDSig
 * ANAF necesită XML semnat digital pentru validare
 */
function signXML(xmlString) {
  try {
    if (!certificatePEM || !privateKeyPEM) {
      throw new Error('Certificate or private key not loaded');
    }

    logger.info('📝 Signing XML with digital certificate...');

    // Creează SignedXml cu private key în constructor
    const sig = new SignedXml({
      privateKey: privateKeyPEM
    });

    // Configurare algoritmi conform ANAF
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

    // Adaugă referință la documentul întreg conform xml-crypto API
    sig.addReference({
      xpath: "//*",  // Referință la toate elementele din document
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#'
      ],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
    });

    // Adaugă certificatul în KeyInfo
    sig.keyInfoProvider = {
      getKeyInfo: function() {
        // Extrage doar conținutul certificatului (fără header/footer PEM)
        const certContent = certificatePEM
          .replace(/-----BEGIN CERTIFICATE-----/, '')
          .replace(/-----END CERTIFICATE-----/, '')
          .replace(/\n/g, '');

        return `<X509Data><X509Certificate>${certContent}</X509Certificate></X509Data>`;
      }
    };

    // Semnează documentul
    sig.computeSignature(xmlString);

    // Obține XML-ul semnat
    const signedXml = sig.getSignedXml();

    logger.info('✅ XML signed successfully');

    return signedXml;

  } catch (error) {
    logger.error('❌ XML signing failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
}

// ==================================================================
// ENDPOINT: HEALTH CHECK
// ==================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'anaf-upload-microservice',
    version: '1.0.0',
    certificateLoaded: !!certificatePEM,
    timestamp: new Date().toISOString()
  });
});

// ==================================================================
// ENDPOINT: UPLOAD FACTURA LA ANAF
// ==================================================================

app.post('/upload-invoice', requireApiKey, async (req, res) => {
  const startTime = Date.now();
  const { xml, cif, facturaId } = req.body;

  // Validare input
  if (!xml || !cif) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: xml, cif'
    });
  }

  if (!certificatePEM || !privateKeyPEM) {
    logger.error('Certificate not loaded', { facturaId });
    return res.status(500).json({
      success: false,
      error: 'Certificate not available on server'
    });
  }

  logger.info('📤 Upload invoice request received', {
    facturaId,
    cif,
    xmlLength: xml.length,
    ip: req.ip
  });

  try {
    // SEMNARE XML cu certificat digital (OBLIGATORIU pentru ANAF)
    let signedXml;
    try {
      signedXml = signXML(xml);
      logger.info('✅ XML signed successfully', {
        facturaId,
        originalSize: xml.length,
        signedSize: signedXml.length
      });
    } catch (signError) {
      logger.error('❌ XML signing failed', {
        facturaId,
        error: signError.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to sign XML with digital certificate',
        details: signError.message
      });
    }

    // Determină endpoint ANAF (sandbox sau production)
    const isSandbox = process.env.ANAF_SANDBOX_MODE === 'true';
    const anafEndpoint = isSandbox
      ? 'https://api.anaf.ro/test/FCTEL/rest/upload'
      : 'https://api.anaf.ro/prod/FCTEL/rest/upload';

    logger.info(`🎯 Target ANAF endpoint: ${anafEndpoint} (${isSandbox ? 'SANDBOX' : 'PRODUCTION'})`);

    // Creează FormData cu XML SEMNAT
    const formData = new FormData();
    formData.append('file', Buffer.from(signedXml, 'utf8'), {
      filename: 'factura.xml',
      contentType: 'text/xml'
    });
    formData.append('cif', cif);
    formData.append('standard', 'UBL');

    // Trimite request la ANAF (fără mTLS - certificatul e folosit doar pt semnare XML)
    const response = await fetch(anafEndpoint, {
      method: 'POST',
      headers: formData.getHeaders(),
      body: formData,
      timeout: 30000 // 30 secunde timeout
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    const duration = Date.now() - startTime;

    logger.info('📥 ANAF response received', {
      facturaId,
      status: response.status,
      duration: `${duration}ms`,
      success: response.ok
    });

    // Success case
    if (response.ok && responseData.upload_index) {
      logger.info('✅ Upload successful', {
        facturaId,
        anafUploadId: responseData.upload_index
      });

      return res.json({
        success: true,
        anafUploadId: responseData.upload_index,
        message: 'Factura uploaded successfully to ANAF',
        status: response.status,
        duration
      });
    }

    // Error case
    logger.warn('⚠️  ANAF upload failed', {
      facturaId,
      status: response.status,
      error: responseData
    });

    return res.status(response.status).json({
      success: false,
      error: responseData.message || responseData.error || 'Upload failed',
      anafResponse: responseData,
      status: response.status,
      duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('❌ Upload exception', {
      facturaId,
      error: error.message,
      stack: error.stack,
      duration
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      type: 'exception',
      duration
    });
  }
});

// ==================================================================
// ENDPOINT: TEST CERTIFICAT
// ==================================================================

app.get('/test-certificate', requireApiKey, (req, res) => {
  if (!certificatePEM) {
    return res.status(500).json({
      success: false,
      error: 'Certificate not loaded'
    });
  }

  try {
    const cert = forge.pki.certificateFromPem(certificatePEM);

    res.json({
      success: true,
      certificate: {
        subject: cert.subject.attributes.map(attr => ({
          name: attr.name,
          value: attr.value
        })),
        issuer: cert.issuer.attributes.map(attr => ({
          name: attr.name,
          value: attr.value
        })),
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
        serialNumber: cert.serialNumber,
        isValid: new Date() >= cert.validity.notBefore && new Date() <= cert.validity.notAfter
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================================================================
// ERROR HANDLERS
// ==================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================================================================
// START SERVER
// ==================================================================

app.listen(PORT, () => {
  logger.info(`🚀 ANAF Upload Microservice started on port ${PORT}`);
  logger.info(`📊 Certificate loaded: ${certLoaded ? '✅ YES' : '❌ NO'}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔐 API Key authentication: ${process.env.API_KEY ? '✅ ENABLED' : '❌ DISABLED'}`);
  logger.info(`🎯 ANAF mode: ${process.env.ANAF_SANDBOX_MODE === 'true' ? 'SANDBOX' : 'PRODUCTION'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
