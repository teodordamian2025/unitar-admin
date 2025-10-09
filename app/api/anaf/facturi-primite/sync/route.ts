// =====================================================
// API: Sincronizare Facturi Primite ANAF
// Descarcă facturi noi din ANAF e-Factura
// URL: POST /api/anaf/facturi-primite/sync
// Data: 08.10.2025
// =====================================================

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';
import JSZip from 'jszip';
import {
  uploadFile,
  getMonthFolder,
} from '@/lib/google-drive-helper';
import {
  parseInvoiceXML,
  validateInvoiceRecipient,
  extractSerieNumar,
  parseAnafDate,
} from '@/lib/anaf-invoice-parser';
import { autoAssociate } from '@/lib/facturi-primite-matcher';
import type {
  AnafListaMesajeResponse,
  AnafMesajFactura,
  FacturaPrimita,
} from '@/lib/facturi-primite-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute pentru download-uri multiple

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const FACTURI_PRIMITE_TABLE = `${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2`;
const ANAF_TOKENS_TABLE = `${PROJECT_ID}.${DATASET}.AnafTokens_v2`;

/**
 * POST /api/anaf/facturi-primite/sync
 * Body: { zile?: number } (default 7 zile)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const zile = body.zile || 7;

    console.log(`🔄 [Facturi Primite ANAF] Început sincronizare ultimele ${zile} zile...`);

    // Step 1: Obține access token ANAF
    const tokenResult = await getAnafAccessToken();
    if (!tokenResult.success) {
      return NextResponse.json(
        { success: false, error: tokenResult.error },
        { status: 401 }
      );
    }

    const accessToken = tokenResult.token!;

    // Step 2: Fetch lista facturi din ANAF
    console.log('📥 Fetch lista mesaje ANAF...');
    const mesajeResult = await fetchListaMesaje(accessToken, zile);

    if (!mesajeResult.success) {
      return NextResponse.json(
        { success: false, error: mesajeResult.error },
        { status: 500 }
      );
    }

    const mesaje = mesajeResult.mesaje!;
    console.log(`✅ Găsite ${mesaje.length} facturi în ANAF`);

    // Step 3: Filtrează facturi noi (nu există deja în DB)
    const factoriNoi = await filterNewInvoices(mesaje);
    console.log(`📋 ${factoriNoi.length} facturi noi de procesat`);

    if (factoriNoi.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nu există facturi noi',
        total: mesaje.length,
        new: 0,
        processed: 0,
      });
    }

    // Step 4: Download și procesare fiecare factură
    const results = {
      total: factoriNoi.length,
      success: 0,
      errors: [] as string[],
      facturi: [] as any[],
    };

    for (const mesaj of factoriNoi) {
      try {
        console.log(`\n🔽 Procesare factură ${mesaj.detalii}...`);

        // Download ZIP
        const zipBuffer = await downloadFactura(accessToken, mesaj.id_descarcare);

        // Extract XML + PDF din ZIP
        const extractedFiles = await extractZipFiles(zipBuffer);

        if (!extractedFiles.xml) {
          throw new Error('XML lipsește din ZIP');
        }

        // Parse XML
        const xmlData = await parseInvoiceXML(extractedFiles.xml.content);

        // Validare că factura e pentru noi
        if (!validateInvoiceRecipient(xmlData)) {
          console.log(`⚠️ Factură ignorată - nu e destinată pentru noi (CUI: ${xmlData.client_cui})`);
          continue;
        }

        // Upload fișiere în Google Drive
        const facturaDate = parseAnafDate(mesaj.data_creare);
        const year = parseInt(facturaDate.split('-')[0]);
        const month = parseInt(facturaDate.split('-')[1]);
        const monthFolderId = await getMonthFolder(year, month);

        // Nume fișiere: {CUI}_{serie}_{data}
        const baseFileName = `${xmlData.furnizor_cui}_${xmlData.serie_numar}_${facturaDate}`.replace(/[\/\s]/g, '_');

        // Upload ZIP original
        const zipUpload = await uploadFile(
          `${baseFileName}.zip`,
          zipBuffer,
          'application/zip',
          monthFolderId
        );

        // Upload XML
        const xmlUpload = await uploadFile(
          `${baseFileName}.xml`,
          Buffer.from(extractedFiles.xml.content, 'utf-8'),
          'application/xml',
          monthFolderId
        );

        // Upload PDF (dacă există)
        let pdfUpload: { fileId: string } | null = null;
        if (extractedFiles.pdf) {
          pdfUpload = await uploadFile(
            `${baseFileName}.pdf`,
            extractedFiles.pdf.content,
            'application/pdf',
            monthFolderId
          );
        }

        console.log('✅ Fișiere uploaded în Google Drive');

        // Salvează în BigQuery
        const facturaId = crypto.randomUUID();
        const facturaRecord: Partial<FacturaPrimita> = {
          id: facturaId,
          id_mesaj_anaf: mesaj.id,
          id_descarcare: mesaj.id_descarcare,
          cif_emitent: xmlData.furnizor_cui,
          nume_emitent: xmlData.furnizor_nume,
          serie_numar: xmlData.serie_numar,
          data_factura: xmlData.data_factura,
          valoare_totala: xmlData.valoare_totala,
          moneda: xmlData.moneda,
          curs_valutar: xmlData.curs_valutar,
          data_curs_valutar: xmlData.data_curs_valutar,
          valoare_ron: xmlData.moneda === 'RON' ? xmlData.valoare_totala : undefined,
          tip_document: xmlData.tip_document,
          status_procesare: 'procesat',
          google_drive_folder_id: monthFolderId,
          zip_file_id: zipUpload.fileId,
          xml_file_id: xmlUpload.fileId,
          pdf_file_id: pdfUpload?.fileId,
          xml_content: extractedFiles.xml.content.substring(0, 10000), // Max 10KB pentru search
          data_preluare: new Date().toISOString(),
          data_procesare: new Date().toISOString(),
          activ: true,
        };

        // Insert în BigQuery
        await bigquery
          .dataset(DATASET)
          .table('FacturiPrimiteANAF_v2')
          .insert([facturaRecord]);

        console.log('✅ Salvat în BigQuery');

        // Auto-asociere cu cheltuieli (background, nu blocăm)
        autoAssociate(facturaRecord as FacturaPrimita)
          .then(match => {
            if (match) {
              console.log(`🔗 Auto-asociat cu cheltuiala ${match.cheltuiala_id} (score: ${(match.score_total * 100).toFixed(0)}%)`);
            }
          })
          .catch(err => {
            console.error('⚠️ Eroare la auto-asociere:', err.message);
          });

        results.success++;
        results.facturi.push({
          id: facturaId,
          serie_numar: xmlData.serie_numar,
          furnizor: xmlData.furnizor_nume,
          valoare: xmlData.valoare_totala,
          moneda: xmlData.moneda,
        });

      } catch (error: any) {
        console.error(`❌ Eroare procesare factură ${mesaj.detalii}:`, error.message);
        results.errors.push(`${mesaj.detalii}: ${error.message}`);
      }
    }

    console.log(`\n✅ Sincronizare completă: ${results.success}/${results.total} facturi procesate`);

    return NextResponse.json({
      success: true,
      message: `${results.success} facturi procesate cu succes`,
      total: results.total,
      success_count: results.success,
      errors_count: results.errors.length,
      errors: results.errors,
      facturi: results.facturi,
    });

  } catch (error: any) {
    console.error('❌ Eroare generală sincronizare facturi:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// === HELPER FUNCTIONS ===

/**
 * Obține access token ANAF din BigQuery
 */
async function getAnafAccessToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const query = `
      SELECT access_token, expires_at
      FROM \`${ANAF_TOKENS_TABLE}\`
      WHERE is_active = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length === 0) {
      return { success: false, error: 'Nu există token ANAF activ. Autorizează aplicația mai întâi.' };
    }

    const token = rows[0];

    // Verifică expirare
    const expiresAt = new Date(token.expires_at);
    if (new Date() >= expiresAt) {
      return { success: false, error: 'Token ANAF expirat. Reautorizează aplicația.' };
    }

    // Decriptează token
    const decryptedToken = decryptToken(token.access_token);

    return { success: true, token: decryptedToken };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Decriptează token (refolosire logic din token/route.ts)
 */
function decryptToken(encryptedToken: string): string {
  const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }

  const parts = encryptedToken.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Fetch lista mesaje facturi din ANAF
 */
async function fetchListaMesaje(
  accessToken: string,
  zile: number
): Promise<{ success: boolean; mesaje?: AnafMesajFactura[]; error?: string }> {
  try {
    const anafApiBase = process.env.ANAF_API_BASE || 'https://api.anaf.ro/prod/FCTEL/rest';
    const url = `${anafApiBase}/listaMesajeFactura?zile=${zile}&cif=${process.env.UNITAR_CUI}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ANAF API error: ${response.status} ${response.statusText}`);
    }

    const data: AnafListaMesajeResponse = await response.json();

    // ANAF poate returna "mesaje" sau "lista_mesaje"
    const mesaje = data.mesaje || data.lista_mesaje || [];

    return { success: true, mesaje };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Filtrează facturi care nu există deja în DB
 */
async function filterNewInvoices(mesaje: AnafMesajFactura[]): Promise<AnafMesajFactura[]> {
  if (mesaje.length === 0) return [];

  const idsDescarcare = mesaje.map(m => m.id_descarcare);

  const query = `
    SELECT id_descarcare
    FROM \`${FACTURI_PRIMITE_TABLE}\`
    WHERE id_descarcare IN UNNEST(@ids)
  `;

  const [rows] = await bigquery.query({
    query,
    params: { ids: idsDescarcare },
  });

  const existingIds = new Set(rows.map((r: any) => r.id_descarcare));

  return mesaje.filter(m => !existingIds.has(m.id_descarcare));
}

/**
 * Download factură ZIP din ANAF
 */
async function downloadFactura(accessToken: string, idDescarcare: string): Promise<Buffer> {
  const anafApiBase = process.env.ANAF_API_BASE || 'https://api.anaf.ro/prod/FCTEL/rest';
  const url = `${anafApiBase}/descarcare?id=${idDescarcare}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract XML + PDF din ZIP
 */
async function extractZipFiles(zipBuffer: Buffer): Promise<{
  xml: { name: string; content: string } | null;
  pdf: { name: string; content: Buffer } | null;
}> {
  const zip = await JSZip.loadAsync(zipBuffer);

  let xml = null;
  let pdf = null;

  for (const [fileName, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    if (fileName.toLowerCase().endsWith('.xml')) {
      const content = await file.async('string');
      xml = { name: fileName, content };
    } else if (fileName.toLowerCase().endsWith('.pdf')) {
      const content = await file.async('nodebuffer');
      pdf = { name: fileName, content };
    }
  }

  return { xml, pdf };
}
