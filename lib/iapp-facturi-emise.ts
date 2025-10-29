// =====================================================
// LIBRARY: iapp.ro Facturi EMISE Helper
// Funcții pentru sincronizare facturi emise in ANAF via iapp.ro API
// Data: 29.10.2025
// =====================================================

import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// =====================================================
// TYPES
// =====================================================

export interface IappFacturaEmisaRaspuns {
  factura: {
    client_name: string;
    client_cif: string;      // "RO26127483" sau "15447725"
    total: string;           // "2152.86 RON" sau "-5387.98 RON"
  };
  trimisa_de: string;        // "Sistem", "Extern", "Teodor Damian"
  id_incarcare: number;
  id_descarcare: number;
  status: string;            // "CONFIRMAT", "DESCARCAT", "EROARE"
  mesaj: string;
  data_incarcare: string;    // "25 Oct 2025 (00:20)"
  data_sync_iapp: string;    // "25 Oct 2025 (00:15)"
  pdf: string;               // URL direct către PDF
}

export interface IappFacturiEmiseResponse {
  status: string;
  error_code: string;
  message: string;
  request: string;
  data: {
    perioada: {
      tStart: number;
      tEnd: number;
      dStart: string;
      dEnd: string;
    };
    raport: IappFacturaEmisaRaspuns[];
  };
}

export interface IappFacturaEmisaDetalii {
  id_incarcare: number;
  id_descarcare: string;
  pdf: string;
  factura: {
    '@attributes'?: {
      Index_incarcare: string;
      Cif_emitent: string;
    };
    Error?: {
      '@attributes': {
        errorMessage: string;
      };
    };
    // UBL 2.1 structure (dacă nu e eroare)
    cbcID?: string;
    cbcIssueDate?: string;
    cbcDocumentCurrencyCode?: string;
    cacAccountingCustomerParty?: any;
    cacLegalMonetaryTotal?: any;
    cacInvoiceLine?: any;
  };
}

// =====================================================
// HELPER FUNCTIONS - Encryption & Parsing
// =====================================================

function decryptValue(encryptedValue: string): string {
  const key = process.env.IAPP_ENCRYPTION_KEY || process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }

  const parts = encryptedValue.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = Buffer.from(parts[1], 'hex');
  const keyBuffer = Buffer.from(key, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Parse data format iapp.ro: "25 Oct 2025 (00:20)" → "2025-10-25"
 */
export function parseIappDate(dateStr: string): string {
  const months: { [key: string]: string } = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    May: '05', Jun: '06', Jul: '07', Aug: '08',
    Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };

  const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);

  if (!match) {
    console.warn(`⚠️ [iapp.ro Emise] Cannot parse date: ${dateStr}, using current date`);
    return new Date().toISOString().split('T')[0];
  }

  const day = match[1].padStart(2, '0');
  const month = months[match[2]] || '01';
  const year = match[3];

  return `${year}-${month}-${day}`;
}

/**
 * Parse valoare totală: "2152.86 RON" → { valoare: 2152.86, moneda: 'RON' }
 * Suportă și valori negative: "-5387.98 RON" (note de credit)
 */
export function parseIappTotal(totalStr: string): { valoare: number; moneda: string } {
  const parts = totalStr.trim().split(/\s+/);

  if (parts.length < 2) {
    return {
      valoare: parseFloat(parts[0]) || 0,
      moneda: 'RON'
    };
  }

  return {
    valoare: parseFloat(parts[0]) || 0,
    moneda: parts[1] || 'RON'
  };
}

/**
 * Extrage CUI fără prefix RO: "RO26127483" → "26127483"
 */
export function cleanCUI(cui: string): string {
  return cui.replace(/^RO/i, '').trim();
}

/**
 * Determină tip document: factură normală vs notă de credit
 */
export function getTipDocument(valoare: number): string {
  return valoare < 0 ? 'NOTA_CREDIT_EMISA' : 'FACTURA_EMISA';
}

/**
 * Parse status ANAF (uppercase pentru consistență)
 */
export function parseStatusAnaf(status: string): string {
  return status.toUpperCase(); // CONFIRMAT, DESCARCAT, EROARE
}

// =====================================================
// API FUNCTIONS - iapp.ro Config & Auth
// =====================================================

/**
 * Citește configurare iapp.ro din BigQuery
 * Reutilizează aceeași config ca pentru facturi primite
 */
export async function getIappConfig() {
  const query = `
    SELECT cod_firma, parola_api, email_responsabil,
           tip_facturare, sursa_facturi_primite, auto_download_pdfs_iapp
    FROM \`${PROJECT_ID}.${DATASET}.IappConfig_v2\`
    WHERE activ = TRUE
    ORDER BY data_creare DESC
    LIMIT 1
  `;

  const [rows] = await bigquery.query({ query, location: 'EU' });

  if (rows.length === 0) {
    throw new Error('iapp.ro configuration not found in IappConfig_v2');
  }

  const config = rows[0];

  return {
    cod_firma: config.cod_firma,
    parola_api: config.parola_api,
    email_responsabil: config.email_responsabil || 'contact@unitarproiect.eu',
    auto_download_pdfs_iapp: config.auto_download_pdfs_iapp !== false
  };
}

/**
 * Generează header autentificare Basic pentru iapp.ro API
 */
export async function getIappAuthHeaders(): Promise<{ Authorization: string }> {
  const config = await getIappConfig();

  const codFirma = decryptValue(config.cod_firma);
  const parola = decryptValue(config.parola_api);

  const authString = Buffer.from(`${codFirma}:${parola}`).toString('base64');

  return {
    Authorization: `Basic ${authString}`
  };
}

// =====================================================
// API FUNCTIONS - Fetch Facturi Emise
// =====================================================

/**
 * Fetch listă facturi EMISE de la iapp.ro API
 * @param startDate Format: YYYY-MM-DD
 * @param endDate Format: YYYY-MM-DD
 * @param emailResponsabil Email din configurare
 */
export async function fetchFacturiEmiseIapp(
  startDate: string,
  endDate: string,
  emailResponsabil?: string
): Promise<IappFacturaEmisaRaspuns[]> {
  const config = await getIappConfig();
  const authHeaders = await getIappAuthHeaders();

  const email = emailResponsabil || config.email_responsabil || 'contact@unitarproiect.eu';

  const requestBody = {
    email_responsabil: email,
    start: startDate,
    end: endDate
  };

  console.log(`📥 [iapp.ro Emise] Fetch facturi emise: ${startDate} → ${endDate}, email: ${email}`);

  const response = await fetch('https://api.my.iapp.ro/e-factura/emise', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`iapp.ro API error: ${response.status} - ${errorText}`);
  }

  const data: IappFacturiEmiseResponse = await response.json();

  console.log(`✅ [iapp.ro Emise] API Response status: ${data.status}, error_code: ${data.error_code}`);

  if (data.status !== 'SUCCESS') {
    throw new Error(`iapp.ro API error: ${data.message || 'Unknown error'}`);
  }

  const facturi = data.data?.raport || [];

  console.log(`📋 [iapp.ro Emise] Găsite ${facturi.length} facturi în perioada ${startDate} - ${endDate}`);

  return facturi;
}

/**
 * Fetch detalii complete factură EMISĂ din iapp.ro
 * @param idIncarcare ID încărcare iapp.ro
 */
export async function fetchFacturaEmisaDetails(idIncarcare: string): Promise<IappFacturaEmisaDetalii> {
  const config = await getIappConfig();
  const authHeaders = await getIappAuthHeaders();

  console.log(`📋 [iapp.ro Emise] Fetch detalii factură ID: ${idIncarcare}`);

  const response = await fetch('https://api.my.iapp.ro/e-factura/view-emise', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify({
      email_responsabil: config.email_responsabil,
      id_incarcare: String(idIncarcare)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`iapp.ro API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.status !== 'SUCCESS') {
    throw new Error(`iapp.ro API error: ${data.message || 'Unknown error'}`);
  }

  if (!data.data) {
    throw new Error('No data in response');
  }

  console.log(`✅ [iapp.ro Emise] Detalii factură ${data.data.factura?.cbcID || idIncarcare}`);

  return data.data;
}

/**
 * Download ZIP factură EMISĂ din iapp.ro
 * @param idDescarcare ID descărcare iapp.ro
 * @returns Buffer cu conținut ZIP
 */
export async function downloadZipFacturaEmisa(idDescarcare: string): Promise<Buffer> {
  const config = await getIappConfig();
  const authHeaders = await getIappAuthHeaders();

  console.log(`📥 [iapp.ro Emise] Download ZIP ID: ${idDescarcare}`);

  const response = await fetch('https://api.my.iapp.ro/e-factura/descarca-emise', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify({
      email_responsabil: config.email_responsabil,
      id_descarcare: String(idDescarcare)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download ZIP: ${response.status} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`✅ [iapp.ro Emise] ZIP downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);

  return buffer;
}

// =====================================================
// DATABASE FUNCTIONS
// =====================================================

/**
 * Mapare factură iapp.ro EMISĂ → schema FacturiEmiseANAF_v2
 */
export function mapIappFacturaEmisaToDatabase(iappFactura: IappFacturaEmisaRaspuns): any {
  const { valoare, moneda } = parseIappTotal(iappFactura.factura.total);
  const dataFactura = parseIappDate(iappFactura.data_incarcare);
  const cuiClient = cleanCUI(iappFactura.factura.client_cif);
  const tipDocument = getTipDocument(valoare);
  const statusAnaf = parseStatusAnaf(iappFactura.status);

  return {
    id: crypto.randomUUID(),

    // Identificatori iapp.ro
    id_incarcare: String(iappFactura.id_incarcare),
    id_descarcare: String(iappFactura.id_descarcare),

    // Date client (destinatar)
    cif_client: cuiClient,
    nume_client: iappFactura.factura.client_name,

    // Date factură
    serie_numar: null, // Completat din XML în următoarea etapă
    data_factura: dataFactura,
    valoare_totala: valoare,
    moneda: moneda,

    // Conversie valutară (completat ulterior dacă moneda !== RON)
    curs_valutar: null,
    data_curs_valutar: null,
    valoare_ron: moneda === 'RON' ? valoare : null,

    // Status ANAF specific emise
    status_anaf: statusAnaf,
    mesaj_anaf: iappFactura.mesaj || '',
    trimisa_de: iappFactura.trimisa_de || 'Necunoscut',

    // Metadata
    tip_document: tipDocument,
    status_procesare: 'procesat',

    // Google Drive (nu descărcăm încă)
    google_drive_file_id: null,
    google_drive_folder_id: null,
    zip_file_id: null,
    xml_file_id: null,
    pdf_file_id: null,

    // XML content (JSON pentru afișare UI)
    xml_content: null,

    // Asociere cu FacturiGenerate
    factura_generata_id: null,
    asociere_automata: false,
    asociere_confidence: null,
    asociere_manual_user_id: null,

    // Timestamps
    data_preluare: new Date().toISOString(),
    data_procesare: new Date().toISOString(),
    data_asociere: null,
    data_incarcare_anaf: new Date(parseIappDate(iappFactura.data_incarcare)).toISOString(),

    // Flags
    activ: true,
    observatii: `Sincronizat automat din iapp.ro la ${new Date().toISOString()}. Trimisă de: ${iappFactura.trimisa_de}`
  };
}

/**
 * Verifică dacă factura EMISĂ există deja în BigQuery
 * @param idIncarcare ID încărcare iapp.ro
 */
export async function facturaEmisaExistaDeja(idIncarcare: string): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\`
    WHERE id_incarcare = @id_incarcare
      AND activ = TRUE
  `;

  const [rows] = await bigquery.query({
    query,
    params: { id_incarcare: String(idIncarcare) },
    location: 'EU'
  });

  return rows[0]?.count > 0;
}

// =====================================================
// GOOGLE DRIVE FUNCTIONS
// =====================================================

/**
 * Generează nume fișier pentru ZIP factură emisă
 * Pattern: SERIE_DATA.zip
 * Exemplu: UPA001_2025-10-25.zip
 */
export function generateZipFileName(factura: {
  serie_numar: string | null;
  data_factura: string | { value: string };
  id_incarcare: string;
}): string {
  // Data (YYYY-MM-DD)
  const dataStr = typeof factura.data_factura === 'object' && factura.data_factura?.value
    ? factura.data_factura.value
    : factura.data_factura;
  const data = String(dataStr).split('T')[0];

  // Serie (clean)
  let serieClean = 'UNKNOWN';
  if (factura.serie_numar) {
    serieClean = factura.serie_numar.replace(/[^A-Z0-9-]/gi, '_');
  } else {
    // Fallback la id_incarcare dacă serie nu e disponibilă
    serieClean = `ID${factura.id_incarcare}`;
  }

  return `${serieClean}_${data}.zip`;
}

/**
 * Upload ZIP în Google Drive folder specific facturi emise
 * Structură: Facturi Primite ANAF/Facturi Emise/YYYY/MM/
 * @param zipBuffer Buffer cu conținut ZIP
 * @param fileName Nume fișier (ex: UPA001_2025-10-25.zip)
 * @param year An (ex: "2025")
 * @param month Lună (ex: "10")
 * @returns Google Drive file ID
 */
export async function uploadZipToEmiseDrive(
  zipBuffer: Buffer,
  fileName: string,
  year: string,
  month: string
): Promise<string> {
  const {
    getRootFacturiFolder,
    createFolder,
    uploadFile,
  } = await import('./google-drive-helper');

  console.log(`💾 [iapp.ro Emise] Upload ZIP în Drive: ${fileName}`);

  // 1. Găsește folder rădăcină "Facturi Primite ANAF"
  const rootFolderId = await getRootFacturiFolder();

  // 2. Creează/găsește folder "Facturi Emise"
  const emiseFolderId = await createFolder('Facturi Emise', rootFolderId);

  // 3. Creează/găsește folder an (ex: "2025")
  const yearFolderId = await createFolder(year, emiseFolderId);

  // 4. Creează/găsește folder lună (ex: "10")
  const monthStr = month.padStart(2, '0');
  const monthFolderId = await createFolder(monthStr, yearFolderId);

  // 5. Upload ZIP
  const result = await uploadFile(fileName, zipBuffer, 'application/zip', monthFolderId);

  console.log(`✅ [iapp.ro Emise] ZIP salvat în Drive: ${fileName} (ID: ${result.fileId})`);

  return result.fileId;
}

/**
 * Calculează date interval pentru sincronizare (ultimele X zile)
 */
export function getDateRange(zile: number = 7): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - zile);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}
