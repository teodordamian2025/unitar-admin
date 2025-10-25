// =====================================================
// LIBRARY: iapp.ro Facturi Primite Helper
// Funcții pentru sincronizare facturi primite de la furnizori via iapp.ro API
// Data: 25.10.2025
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

export interface IappFacturaRaspuns {
  id_solicitare: number;
  id_descarcare: number;
  mesaj: string;
  data_incarcare: string; // "06 Jan 2024 (15:15)"
  data_sync_iapp: string; // "06 Jan 2024 (16:00)"
  factura: {
    furnizor_name: string;
    furnizor_cif: string; // "RO1123450"
    serie_numar: string | number;
    total: string; // "7831.91 RON"
  };
}

export interface IappFurnizoriResponse {
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
    raport: IappFacturaRaspuns[];
  };
}

export interface IappConfig {
  cod_firma: string; // encrypted
  parola_api: string; // encrypted
  email_responsabil: string;
  sursa_facturi_primite?: string; // 'iapp' | 'anaf'
}

// =====================================================
// HELPER FUNCTIONS - Encryption
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

// =====================================================
// HELPER FUNCTIONS - Date Parsing
// =====================================================

/**
 * Parse data format iapp.ro: "06 Jan 2024 (15:15)" → "2024-01-06"
 */
export function parseIappDate(dateStr: string): string {
  const months: { [key: string]: string } = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    May: '05', Jun: '06', Jul: '07', Aug: '08',
    Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };

  // Match pattern: "06 Jan 2024 (15:15)" sau "6 Jan 2024"
  const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);

  if (!match) {
    console.warn(`⚠️ [iapp.ro] Cannot parse date: ${dateStr}, using current date`);
    return new Date().toISOString().split('T')[0];
  }

  const day = match[1].padStart(2, '0');
  const month = months[match[2]] || '01';
  const year = match[3];

  return `${year}-${month}-${day}`;
}

/**
 * Parse valoare totală: "7831.91 RON" → { valoare: 7831.91, moneda: 'RON' }
 */
export function parseIappTotal(totalStr: string): { valoare: number; moneda: string } {
  const parts = totalStr.trim().split(/\s+/);

  if (parts.length < 2) {
    // Doar număr, fără monedă
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
 * Extrage CUI fără prefix RO: "RO1123450" → "1123450"
 */
export function cleanCUI(cui: string): string {
  return cui.replace(/^RO/i, '').trim();
}

// =====================================================
// API FUNCTIONS
// =====================================================

/**
 * Citește configurare iapp.ro din BigQuery
 */
export async function getIappConfig(): Promise<IappConfig> {
  const query = `
    SELECT cod_firma, parola_api, email_responsabil,
           tip_facturare, sursa_facturi_primite
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
    sursa_facturi_primite: config.sursa_facturi_primite || 'iapp'
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

/**
 * Fetch listă facturi primite de la iapp.ro API
 * @param startDate Format: YYYY-MM-DD
 * @param endDate Format: YYYY-MM-DD
 * @param emailResponsabil Email din configurare (default: contact@unitarproiect.eu)
 */
export async function fetchFacturiPrimiteIapp(
  startDate: string,
  endDate: string,
  emailResponsabil?: string
): Promise<IappFacturaRaspuns[]> {
  const config = await getIappConfig();
  const authHeaders = await getIappAuthHeaders();

  const email = emailResponsabil || config.email_responsabil || 'contact@unitarproiect.eu';

  const requestBody = {
    email_responsabil: email,
    start: startDate, // "2025-01-01"
    end: endDate      // "2025-02-01"
  };

  console.log(`📥 [iapp.ro] Fetch facturi primite: ${startDate} → ${endDate}, email: ${email}`);

  const response = await fetch('https://api.my.iapp.ro/e-factura/furnizori', {
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

  const data: IappFurnizoriResponse = await response.json();

  console.log(`✅ [iapp.ro] API Response status: ${data.status}, error_code: ${data.error_code}`);

  if (data.status !== 'SUCCESS') {
    throw new Error(`iapp.ro API error: ${data.message || 'Unknown error'}`);
  }

  const facturi = data.data?.raport || [];

  console.log(`📋 [iapp.ro] Găsite ${facturi.length} facturi în perioada ${startDate} - ${endDate}`);

  return facturi;
}

/**
 * Mapare factură iapp.ro → schema FacturiPrimiteANAF_v2
 * Reutilizăm tabelul existent pentru a unifica sursele (ANAF + iapp.ro)
 */
export function mapIappFacturaToDatabase(iappFactura: IappFacturaRaspuns): any {
  const { valoare, moneda } = parseIappTotal(iappFactura.factura.total);
  const dataFactura = parseIappDate(iappFactura.data_incarcare);
  const cuiEmitent = cleanCUI(iappFactura.factura.furnizor_cif);

  return {
    id: crypto.randomUUID(),

    // Reutilizăm câmpurile ANAF pentru iapp.ro
    id_mesaj_anaf: String(iappFactura.id_solicitare), // ID solicitare iapp.ro
    id_descarcare: String(iappFactura.id_descarcare),  // ID descărcare iapp.ro

    // Date furnizor
    cif_emitent: cuiEmitent,
    nume_emitent: iappFactura.factura.furnizor_name,

    // Date factură
    serie_numar: String(iappFactura.factura.serie_numar),
    data_factura: dataFactura,
    valoare_totala: valoare,
    moneda: moneda,

    // Conversie valutară (completat ulterior dacă moneda !== RON)
    curs_valutar: null,
    data_curs_valutar: null,
    valoare_ron: moneda === 'RON' ? valoare : null,

    // Metadata
    tip_document: 'FACTURA_PRIMITA',
    status_procesare: 'procesat', // iapp.ro ne dă direct date parsate

    // Google Drive (nu descărcăm ZIP în această etapă)
    google_drive_file_id: null,
    google_drive_folder_id: null,
    zip_file_id: null,
    xml_file_id: null,
    pdf_file_id: null,

    // XML content (iapp.ro returnează JSON, nu XML)
    xml_content: null,

    // Asociere cu cheltuieli (completat de auto-match)
    cheltuiala_asociata_id: null,
    asociere_automata: false,
    asociere_confidence: null,
    asociere_manual_user_id: null,

    // Timestamps
    data_preluare: new Date().toISOString(),
    data_procesare: new Date().toISOString(),
    data_asociere: null,

    // Flags
    activ: true,
    observatii: `Sincronizat automat din iapp.ro la ${new Date().toISOString()}. Mesaj: ${iappFactura.mesaj}`
  };
}

/**
 * Verifică dacă factura există deja în BigQuery
 * @param idSolicitare ID solicitare iapp.ro
 * @returns true dacă există, false altfel
 */
export async function facturaExistaDeja(idSolicitare: string): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
    WHERE id_mesaj_anaf = @id_solicitare
      AND activ = TRUE
  `;

  const [rows] = await bigquery.query({
    query,
    params: { id_solicitare: String(idSolicitare) },
    location: 'EU'
  });

  return rows[0]?.count > 0;
}

/**
 * Calculează date interval pentru sincronizare (ultimele X zile)
 */
export function getDateRange(zile: number = 7): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - zile);

  return {
    startDate: start.toISOString().split('T')[0], // "2025-10-18"
    endDate: end.toISOString().split('T')[0]      // "2025-10-25"
  };
}
