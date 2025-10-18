// =================================================================
// API IMPORT CSV TRANZACTII BANCARE - ING ROMANIA
// Generat: 17 septembrie 2025, 23:50 (Romania)
// Cale: app/api/tranzactii/import-csv/route.ts
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// Configurare BigQuery
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = bigquery.dataset(DATASET);
const TRANZACTII_TABLE = `\`${PROJECT_ID}.${DATASET}.TranzactiiImportate${tableSuffix}\``;
const TRANZACTII_BANCARE_TABLE = `\`${PROJECT_ID}.${DATASET}.TranzactiiBancare${tableSuffix}\``;
const TRANZACTII_ACCOUNTS_TABLE = `\`${PROJECT_ID}.${DATASET}.TranzactiiAccounts${tableSuffix}\``;

console.log(`🔧 [Import CSV] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================
interface INGTransaction {
  id: string;
  account_id: string;
  iban_cont: string;
  data_procesare: string;
  suma: number;
  valuta: string;
  tip_tranzactie: string;
  nume_contrapartida: string;
  adresa_contrapartida: string;
  iban_contrapartida: string;
  banca_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  sold_intermediar: number;
  tip_categorie: string;
  directie: string;
  transaction_hash: string;
  data_creare: string;
  data_actualizare: string; // ✅ NOU - pentru consistență cu Smart Fintech
}

interface ProcessingStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  duplicateRows: number;
  errorRows: number;
  newTransactions: number;
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Parsează suma din format ING românesc (cu virgulă)
 */
function parseINGAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === '') return 0;
  return parseFloat(amountStr.replace(',', '.'));
}

/**
 * Parsează data din format DD.MM.YYYY la YYYY-MM-DD
 */
function parseINGDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return '';
  
  try {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch (error) {
    console.error('Eroare parsare data:', dateStr, error);
    return '';
  }
}

/**
 * Categorisează tranzacția după tip ING
 */
function categorizeINGTransaction(tipTranzactie: string, suma: number): string {
  const tip = tipTranzactie.toLowerCase();
  
  if (suma > 0) {
    if (tip.includes('incasare')) return 'incasare';
    if (tip.includes('transfer')) return 'incasare';
    return 'incasare';
  } else {
    if (tip.includes('comision')) return 'comision';
    if (tip.includes('pos') || tip.includes('card')) return 'cumparare';
    if (tip.includes('transfer')) return 'plata';
    if (tip.includes('direct debit')) return 'debit_direct';
    return 'plata';
  }
}

/**
 * Determină direcția tranzacției
 * ✅ FIX: Uniformizat cu Smart Fintech API ('intrare'/'iesire' în loc de 'in'/'out')
 */
function getTransactionDirection(suma: number): string {
  return suma > 0 ? 'intrare' : 'iesire';
}

/**
 * Generează hash unic pentru deduplication
 */
function generateTransactionHash(row: any): string {
  const hashString = [
    row.iban_cont,
    row.data_procesare,
    row.suma.toString(),
    row.nume_contrapartida || '',
    row.detalii_tranzactie || ''
  ].join('|');
  
  return crypto.createHash('sha256').update(hashString).digest('hex');
}

/**
 * Curăță și validează IBAN
 */
function cleanIBAN(iban: string): string {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').toUpperCase();
}

/**
 * Curăță CUI (elimină spații, caractere speciale)
 */
function cleanCUI(cui: string): string {
  if (!cui || cui === 'N' || cui.trim() === '') return '';
  return cui.replace(/[^0-9]/g, '');
}

/**
 * Extrage referințe facturi din detalii
 */
function extractInvoiceReferences(detalii: string): string[] {
  if (!detalii) return [];
  
  const patterns = [
    /FACTURA\s+(?:NR\.?\s*)?([A-Z]?\s*\d+)/gi,
    /FACT\.?\s+([A-Z]?\s*\d+)/gi,
    /F\s+(\d+)/gi,
    /(\w+\d+)\/\d{2}\/\d{2}\/\d{4}/gi
  ];
  
  const references: string[] = [];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(detalii)) !== null) {
      if (match[1]) {
        references.push(match[1].replace(/\s+/g, ''));
      }
    }
    // Reset regex pentru următoarea utilizare
    pattern.lastIndex = 0;
  });
  
  return Array.from(new Set(references)); // Elimină duplicatele
}

// =================================================================
// PROCESARE CSV ING
// =================================================================

/**
 * Parsează CSV ING și returnează tranzacții procesate
 */
async function parseINGCSV(csvContent: string, accountId: string): Promise<{
  transactions: INGTransaction[];
  stats: ProcessingStats;
}> {
  const lines = csvContent.split('\n');
  const transactions: INGTransaction[] = [];
  
  const stats: ProcessingStats = {
    totalRows: lines.length - 1, // Excludem header-ul
    processedRows: 0,
    skippedRows: 0,
    duplicateRows: 0,
    errorRows: 0,
    newTransactions: 0
  };

  // Verificăm header-ul ING
  const expectedHeader = 'numar cont;data procesarii;suma;valuta;tip tranzactie';
  if (!lines[0] || !lines[0].toLowerCase().includes('numar cont')) {
    throw new Error('Format CSV invalid. Se așteaptă format ING România.');
  }

  console.log(`📊 Procesare CSV: ${stats.totalRows} linii de procesat`);

  // Procesăm fiecare linie (omitem header-ul)
  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i].trim();
      if (!line || line === '') {
        stats.skippedRows++;
        continue;
      }

      // Împărțim pe separator ING (;)
      const columns = line.split(';');
      if (columns.length < 12) {
        console.warn(`⚠️ Linia ${i + 1}: număr insuficient de coloane (${columns.length})`);
        stats.errorRows++;
        continue;
      }

      // Extragem datele conform formatului ING
      const [
        numarCont,          // 0
        dataProcessare,     // 1
        suma,               // 2
        valuta,             // 3
        tipTranzactie,      // 4
        numeContrapartida,  // 5
        adresaContrapartida,// 6
        ibanContrapartida,  // 7
        bancaContrapartida, // 8
        detaliiTranzactie,  // 9
        soldIntermediar,    // 10
        cuiContrapartida    // 11
      ] = columns;

      // Validări de bază
      const sumaParsed = parseINGAmount(suma);
      const dataParsed = parseINGDate(dataProcessare);
      
      if (!dataParsed || isNaN(sumaParsed)) {
        console.warn(`⚠️ Linia ${i + 1}: date invalide (data: ${dataProcessare}, suma: ${suma})`);
        stats.errorRows++;
        continue;
      }

      // Construim obiectul tranzacție
      const transaction: INGTransaction = {
        id: crypto.randomUUID(),
        account_id: accountId,
        iban_cont: cleanIBAN(numarCont),
        data_procesare: dataParsed,
        suma: sumaParsed,
        valuta: valuta?.trim() || 'RON',
        tip_tranzactie: tipTranzactie?.trim() || '',
        nume_contrapartida: numeContrapartida?.trim() || '',
        adresa_contrapartida: adresaContrapartida?.trim() || '',
        iban_contrapartida: cleanIBAN(ibanContrapartida),
        banca_contrapartida: bancaContrapartida?.trim() || '',
        cui_contrapartida: cleanCUI(cuiContrapartida),
        detalii_tranzactie: detaliiTranzactie?.trim() || '',
        sold_intermediar: parseINGAmount(soldIntermediar),
        tip_categorie: categorizeINGTransaction(tipTranzactie, sumaParsed),
        directie: getTransactionDirection(sumaParsed), // ✅ FIX: 'intrare'/'iesire' în loc de 'in'/'out'
        transaction_hash: '',
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString() // ✅ NOU
      };

      // Generăm hash pentru deduplication
      transaction.transaction_hash = generateTransactionHash(transaction);

      transactions.push(transaction);
      stats.processedRows++;

    } catch (error) {
      console.error(`❌ Eroare procesare linia ${i + 1}:`, error);
      stats.errorRows++;
    }
  }

  stats.newTransactions = transactions.length;
  console.log(`✅ Parsing complet: ${stats.processedRows} tranzacții procesate`);

  return { transactions, stats };
}

// =================================================================
// DEDUPLICATION ÎN BIGQUERY
// =================================================================

/**
 * Verifică și elimină duplicatele din BigQuery
 */
async function deduplicateTransactions(transactions: INGTransaction[]): Promise<{
  uniqueTransactions: INGTransaction[];
  duplicatesFound: number;
}> {
  if (transactions.length === 0) {
    return { uniqueTransactions: [], duplicatesFound: 0 };
  }

  // Extragem hash-urile pentru verificare
  const hashes = transactions.map(t => t.transaction_hash);
  
  try {
    // Interogare BigQuery pentru hash-uri existente
    const query = `
      SELECT transaction_hash
      FROM ${TRANZACTII_BANCARE_TABLE}
      WHERE transaction_hash IN (${hashes.map(h => `"${h}"`).join(',')})
    `;

    const [existingHashes] = await bigquery.query(query);
    const existingHashSet = new Set(
      existingHashes.map((row: any) => row.transaction_hash)
    );

    // Filtrăm tranzacțiile noi
    const uniqueTransactions = transactions.filter(
      t => !existingHashSet.has(t.transaction_hash)
    );

    const duplicatesFound = transactions.length - uniqueTransactions.length;

    console.log(`🔍 Deduplication: ${duplicatesFound} duplicate găsite, ${uniqueTransactions.length} noi`);

    return { uniqueTransactions, duplicatesFound };

  } catch (error) {
    console.error('❌ Eroare deduplication:', error);
    // În caz de eroare, returnăm toate tranzacțiile
    return { uniqueTransactions: transactions, duplicatesFound: 0 };
  }
}

// =================================================================
// INSERARE ÎN BIGQUERY
// =================================================================

/**
 * Inserează tranzacțiile în BigQuery
 */
async function insertTransactionsToBigQuery(transactions: INGTransaction[]): Promise<void> {
  if (transactions.length === 0) {
    console.log('📝 Nu există tranzacții noi de inserat');
    return;
  }

  try {
    const table = dataset.table(`TranzactiiBancare${tableSuffix}`);

    // Inserare în batch-uri de 1000
    const batchSize = 1000;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      console.log(`📝 Inserare batch ${Math.floor(i/batchSize) + 1}: ${batch.length} tranzacții`);
      await table.insert(batch);
    }

    console.log(`✅ Inserare completă: ${transactions.length} tranzacții`);

  } catch (error) {
    console.error('❌ Eroare inserare BigQuery:', error);
    throw new Error('Eroare la salvarea tranzacțiilor în baza de date');
  }
}

// =================================================================
// LOGGING OPERAȚIUNE
// =================================================================

/**
 * Salvează log-ul operațiunii în BigQuery
 */
async function logImportOperation(
  accountId: string,
  fileName: string,
  fileSize: number,
  stats: ProcessingStats,
  startTime: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    const logEntry = {
      id: crypto.randomUUID(),
      account_id: accountId,
      operation_type: 'csv_import',
      operation_status: success ? 'success' : 'failed',
      records_processed: stats.processedRows,
      records_success: stats.newTransactions,
      records_failed: stats.errorRows,
      records_duplicates: stats.duplicateRows,
      file_name: fileName,
      file_size: fileSize,
      processing_time_ms: Date.now() - startTime,
      auto_matches_found: 0, // Va fi completat la matching
      manual_matches_needed: 0,
      confidence_avg: 0,
      summary_message: success 
        ? `Import reușit: ${stats.newTransactions} tranzacții noi din ${stats.totalRows} total`
        : `Import eșuat: ${errorMessage}`,
      error_details: errorMessage ? { error: errorMessage, stats } : null,
      data_creare: new Date().toISOString(),
      creat_de: 'system_import'
    };

    const table = dataset.table(`TranzactiiSyncLogs${tableSuffix}`);
    await table.insert([logEntry]);

  } catch (error) {
    console.error('❌ Eroare salvare log:', error);
    // Nu aruncăm eroare ca să nu împiedicăm flow-ul principal
  }
}

// =================================================================
// ENDPOINT PRINCIPAL
// =================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let fileName = 'unknown.csv';
  let fileSize = 0;
  let accountId = '';

  try {
    console.log('🚀 Începe procesarea import CSV ING');

    // Extragem datele din formData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const specifiedAccountId = formData.get('account_id') as string;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'Nu a fost găsit fișierul CSV'
      }, { status: 400 });
    }

    fileName = file.name;
    fileSize = file.size;

    // Verificăm extensia fișierului
    if (!fileName.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({
        success: false,
        error: 'Se acceptă doar fișiere CSV'
      }, { status: 400 });
    }

    console.log(`📁 Fișier primit: ${fileName} (${fileSize} bytes)`);

    // Citim conținutul fișierului
    const arrayBuffer = await file.arrayBuffer();
    const csvContent = new TextDecoder('utf-8').decode(arrayBuffer);

    // Găsim account_id pentru contul ING
    if (specifiedAccountId) {
      accountId = specifiedAccountId;
    } else {
      // Căutăm contul ING în baza de date
      const [accounts] = await bigquery.query(`
        SELECT id FROM ${TRANZACTII_ACCOUNTS_TABLE}
        WHERE iban = 'RO82INGB0000999905667533' AND activ = TRUE
        LIMIT 1
      `);

      if (accounts.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Contul ING nu a fost găsit în sistem. Contactați administratorul.'
        }, { status: 404 });
      }

      accountId = accounts[0].id;
    }

    console.log(`🏦 Account ID găsit: ${accountId}`);

    // Parsăm CSV-ul
    const { transactions, stats } = await parseINGCSV(csvContent, accountId);

    // Deduplication
    const { uniqueTransactions, duplicatesFound } = await deduplicateTransactions(transactions);
    stats.duplicateRows = duplicatesFound;
    stats.newTransactions = uniqueTransactions.length;

    // Inserăm în BigQuery
    if (uniqueTransactions.length > 0) {
      await insertTransactionsToBigQuery(uniqueTransactions);
    }

    // Salvăm log-ul
    await logImportOperation(accountId, fileName, fileSize, stats, startTime, true);

    console.log('✅ Import CSV finalizat cu succes');

    return NextResponse.json({
      success: true,
      message: `Import reușit: ${stats.newTransactions} tranzacții noi importate`,
      stats: {
        totalRows: stats.totalRows,
        processedRows: stats.processedRows,
        newTransactions: stats.newTransactions,
        duplicatesFound: stats.duplicateRows,
        errorRows: stats.errorRows,
        processingTimeMs: Date.now() - startTime
      },
      accountId
    });

  } catch (error: any) {
    console.error('❌ Eroare import CSV:', error);

    // Salvăm log-ul cu eroarea
    if (accountId) {
      await logImportOperation(
        accountId, 
        fileName, 
        fileSize, 
        { totalRows: 0, processedRows: 0, skippedRows: 0, duplicateRows: 0, errorRows: 0, newTransactions: 0 }, 
        startTime, 
        false, 
        error.message
      );
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare neașteptată la procesarea CSV-ului',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// =================================================================
// GET - INFORMAȚII DESPRE ULTIMUL IMPORT
// =================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');

    const whereClause = accountId 
      ? `WHERE account_id = "${accountId}"` 
      : 'WHERE operation_type = "csv_import"';

    const query = `
      SELECT 
        operation_status,
        records_processed,
        records_success,
        records_duplicates,
        file_name,
        processing_time_ms,
        summary_message,
        data_creare
      FROM \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiSyncLogs\`
      ${whereClause}
      ORDER BY data_creare DESC
      LIMIT 10
    `;

    const [logs] = await bigquery.query(query);

    return NextResponse.json({
      success: true,
      recentImports: logs
    });

  } catch (error: any) {
    console.error('❌ Eroare citire istoric import:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Eroare la citirea istoricului import-urilor'
    }, { status: 500 });
  }
}
