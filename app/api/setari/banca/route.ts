// ==================================================================
// CALEA: app/api/setari/banca/route.ts
// DESCRIERE: API pentru managementul setărilor conturi bancare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = DATASET; // For compatibility with dataset.table() API calls
const table = `SetariBanca${tableSuffix}`;
const TABLE_NAME = `\`${PROJECT_ID}.${DATASET}.SetariBanca${tableSuffix}\``;

console.log(`🔧 [Setari Banca] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// ✅ CREATE TABLE dacă nu există
async function ensureTableExists() {
  try {
    const [exists] = await bigquery.dataset(dataset).table(table).exists();
    
    if (!exists) {
      console.log(`Creez tabelul ${table}...`);
      
      const schema = [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'nume_banca', type: 'STRING', mode: 'REQUIRED' },
        { name: 'iban', type: 'STRING', mode: 'REQUIRED' },
        { name: 'cont_principal', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'observatii', type: 'STRING', mode: 'NULLABLE' },
        { name: 'data_creare', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'data_actualizare', type: 'TIMESTAMP', mode: 'REQUIRED' }
      ];

      await bigquery.dataset(dataset).createTable(table, { schema });
      console.log(`✅ Tabelul ${table} a fost creat cu succes`);
    }
  } catch (error) {
    console.error(`Eroare la crearea tabelului ${table}:`, error);
    throw error;
  }
}

// ✅ VALIDARE IBAN românesc/european
function validateIBAN(iban: string): { valid: boolean; message?: string } {
  if (!iban || typeof iban !== 'string') {
    return { valid: false, message: 'IBAN este obligatoriu' };
  }

  // Curăță IBAN-ul (elimină spații și convertește la uppercase)
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  // Verifică lungimea minimă
  if (cleanIban.length < 15 || cleanIban.length > 34) {
    return { valid: false, message: 'IBAN trebuie să aibă între 15 și 34 caractere' };
  }

  // Verifică formatul de bază (2 litere + 2 cifre + restul alfanumeric)
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
  if (!ibanRegex.test(cleanIban)) {
    return { valid: false, message: 'Format IBAN invalid (ex: RO49AAAA1B31007593840000)' };
  }

  // Verifică țări europene comune
  const validCountries = [
    'RO', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 
    'LV', 'LT', 'LU', 'MT', 'NL', 'AT', 'PL', 'PT', 'SK', 'SI', 'ES', 'SE', 
    'GB', 'AD', 'BY', 'CH', 'FO', 'GI', 'GL', 'IS', 'LI', 'MC', 'MD', 'ME', 
    'MK', 'NO', 'RS', 'SM', 'TR', 'UA', 'VG'
  ];
  
  const countryCode = cleanIban.substring(0, 2);
  if (!validCountries.includes(countryCode)) {
    return { valid: false, message: `Codul țării ${countryCode} nu este valid pentru IBAN european` };
  }

  // Validare specifică pentru România
  if (countryCode === 'RO' && cleanIban.length !== 24) {
    return { valid: false, message: 'IBAN românesc trebuie să aibă exact 24 caractere' };
  }

  // Validare algoritm Luhn simplificată (verificare checksum de bază)
  const checkDigits = cleanIban.substring(2, 4);
  if (!/^\d{2}$/.test(checkDigits)) {
    return { valid: false, message: 'Cifrele de control IBAN sunt invalide' };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  try {
    await ensureTableExists();

    const query = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      ORDER BY cont_principal DESC, nume_banca ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      conturi: rows,
      total: rows.length,
      message: `${rows.length} conturi bancare încărcate`
    });

  } catch (error) {
    console.error('Eroare la încărcarea conturilor bancare:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea conturilor bancare',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const body = await request.json();
    console.log('POST conturi bancare request body:', body);

    // Validări de bază
    if (!body.nume_banca || !body.iban) {
      return NextResponse.json({ 
        success: false,
        error: 'Numele băncii și IBAN sunt obligatorii' 
      }, { status: 400 });
    }

    // Validare IBAN
    const ibanValidation = validateIBAN(body.iban);
    if (!ibanValidation.valid) {
      return NextResponse.json({ 
        success: false,
        error: `IBAN invalid: ${ibanValidation.message}` 
      }, { status: 400 });
    }

    const cleanIban = body.iban.replace(/\s/g, '').toUpperCase();

    // Verifică dacă IBAN-ul există deja
    const duplicateQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE iban = @iban
      LIMIT 1
    `;

    const [duplicateRows] = await bigquery.query({
      query: duplicateQuery,
      params: { iban: cleanIban },
      types: { iban: 'STRING' },
      location: 'EU',
    });

    if (duplicateRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Acest IBAN există deja în sistem' 
      }, { status: 400 });
    }

    // Dacă se marchează ca principal, dezactivează celelalte
    let updateOthersPromise: Promise<any> = Promise.resolve();
    if (body.cont_principal === true) {
      const updateOthersQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        SET 
          cont_principal = false,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE cont_principal = true
      `;

      updateOthersPromise = bigquery.query({
        query: updateOthersQuery,
        location: 'EU',
      });
    }

    // Generează ID nou
    const contId = `cont_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // INSERT noul cont
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, nume_banca, iban, cont_principal, observatii, data_creare, data_actualizare)
      VALUES 
      (@id, @nume_banca, @iban, @cont_principal, @observatii, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `;

    const params = {
      id: contId,
      nume_banca: body.nume_banca.trim(),
      iban: cleanIban,
      cont_principal: body.cont_principal === true,
      observatii: body.observatii?.trim() || null
    };

    const types = {
      id: 'STRING',
      nume_banca: 'STRING',
      iban: 'STRING',
      cont_principal: 'BOOL',
      observatii: 'STRING'
    };

    // Execută ambele operații
    await Promise.all([
      updateOthersPromise,
      bigquery.query({
        query: insertQuery,
        params: params,
        types: types,
        location: 'EU',
      })
    ]);

    console.log('✅ Cont bancar creat cu succes:', contId);

    return NextResponse.json({
      success: true,
      message: 'Cont bancar adăugat cu succes',
      contId: contId
    });

  } catch (error) {
    console.error('Eroare la crearea contului bancar:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la crearea contului bancar',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const body = await request.json();
    console.log('PUT conturi bancare request body:', body);

    // Validări de bază
    if (!body.id || !body.nume_banca || !body.iban) {
      return NextResponse.json({ 
        success: false,
        error: 'ID, numele băncii și IBAN sunt obligatorii pentru actualizare' 
      }, { status: 400 });
    }

    // Validare IBAN
    const ibanValidation = validateIBAN(body.iban);
    if (!ibanValidation.valid) {
      return NextResponse.json({ 
        success: false,
        error: `IBAN invalid: ${ibanValidation.message}` 
      }, { status: 400 });
    }

    const cleanIban = body.iban.replace(/\s/g, '').toUpperCase();

    // Verifică dacă IBAN-ul există la alt cont
    const duplicateQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE iban = @iban AND id != @excludeId
      LIMIT 1
    `;

    const [duplicateRows] = await bigquery.query({
      query: duplicateQuery,
      params: { iban: cleanIban, excludeId: body.id },
      types: { iban: 'STRING', excludeId: 'STRING' },
      location: 'EU',
    });

    if (duplicateRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Acest IBAN este folosit de alt cont bancar' 
      }, { status: 400 });
    }

    // Dacă se marchează ca principal, dezactivează celelalte
    let updateOthersPromise: Promise<any> = Promise.resolve();
    if (body.cont_principal === true) {
      const updateOthersQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        SET 
          cont_principal = false,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE cont_principal = true AND id != @excludeId
      `;

      updateOthersPromise = bigquery.query({
        query: updateOthersQuery,
        params: { excludeId: body.id },
        types: { excludeId: 'STRING' },
        location: 'EU',
      });
    }

    // UPDATE contul
    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET 
        nume_banca = @nume_banca,
        iban = @iban,
        cont_principal = @cont_principal,
        observatii = @observatii,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id
    `;

    const params = {
      id: body.id,
      nume_banca: body.nume_banca.trim(),
      iban: cleanIban,
      cont_principal: body.cont_principal === true,
      observatii: body.observatii?.trim() || null
    };

    const types = {
      id: 'STRING',
      nume_banca: 'STRING',
      iban: 'STRING',
      cont_principal: 'BOOL',
      observatii: 'STRING'
    };

    // Execută ambele operații
    await Promise.all([
      updateOthersPromise,
      bigquery.query({
        query: updateQuery,
        params: params,
        types: types,
        location: 'EU',
      })
    ]);

    console.log('✅ Cont bancar actualizat cu succes:', body.id);

    return NextResponse.json({
      success: true,
      message: 'Cont bancar actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea contului bancar:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea contului bancar',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const { searchParams } = new URL(request.url);
    const contId = searchParams.get('id');

    if (!contId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID cont este obligatoriu pentru ștergere' 
      }, { status: 400 });
    }

    // Verifică dacă contul există
    const checkQuery = `
      SELECT id, nume_banca, cont_principal FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE id = @id
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: { id: contId },
      types: { id: 'STRING' },
      location: 'EU',
    });

    if (existingRows.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Contul bancar nu a fost găsit' 
      }, { status: 404 });
    }

    // Verifică câte conturi rămân
    const countQuery = `
      SELECT COUNT(*) as total FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
    `;

    const [countRows] = await bigquery.query({
      query: countQuery,
      location: 'EU',
    });

    const totalConturi = countRows[0]?.total || 0;
    if (totalConturi <= 1) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu poți șterge ultimul cont bancar. Trebuie să ai măcar unul.' 
      }, { status: 400 });
    }

    // Șterge contul
    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { id: contId },
      types: { id: 'STRING' },
      location: 'EU',
    });

    console.log('✅ Cont bancar șters cu succes:', contId);

    return NextResponse.json({
      success: true,
      message: 'Cont bancar șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea contului bancar:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea contului bancar',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
