// ==================================================================
// CALEA: app/api/setari/contracte/route.ts
// DATA: 12.09.2025 20:45 (ora României)
// MODIFICAT: Exportat getNextContractNumber pentru import în generate
// PĂSTRATE: Toate funcționalitățile existente + verificări suplimentare
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

const dataset = DATASET;
const table = `SetariContracte${tableSuffix}`;
const TABLE_NAME = `\`${PROJECT_ID}.${DATASET}.SetariContracte${tableSuffix}\``;

console.log(`🔧 [Setari Contracte] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// Helper pentru conversie BigQuery NUMERIC (reutilizat din pattern-ul existent)
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'object' && value.value !== undefined) {
    return parseFloat(value.value.toString()) || 0;
  }
  
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  return 0;
};

// Toast system helper (pentru consistență cu pattern-ul existent)
const logSuccess = (message: string) => {
  console.log(`✅ ${message}`);
};

const logError = (message: string, error?: any) => {
  console.error(`❌ ${message}`, error);
};

// Asigură existența tabelului
async function ensureTableExists() {
  try {
    const [exists] = await bigquery.dataset(dataset).table(table).exists();
    
    if (!exists) {
      logSuccess(`Creez tabelul ${table}...`);
      
      const schema = [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'tip_document', type: 'STRING', mode: 'REQUIRED' },
        { name: 'serie', type: 'STRING', mode: 'REQUIRED' },
        { name: 'prefix', type: 'STRING', mode: 'NULLABLE' },
        { name: 'numar_curent', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'format_numerotare', type: 'STRING', mode: 'REQUIRED' },
        { name: 'separator', type: 'STRING', mode: 'REQUIRED' },
        { name: 'include_an', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'include_luna', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'include_proiect_id', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'activ', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'data_creare', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'data_actualizare', type: 'TIMESTAMP', mode: 'REQUIRED' }
      ];

      await bigquery.dataset(dataset).createTable(table, { schema });
      
      // Inserează setări default cu PROJECT ID CORECT
      const insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${dataset}.${table}\`
        (id, tip_document, serie, prefix, numar_curent, format_numerotare, separator, include_an, include_luna, include_proiect_id, activ, data_creare, data_actualizare)
        VALUES
        ('contr_default', 'contract', 'CONTR', '', 1000, '{serie}-{numar}-{an}', '-', true, false, false, true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
        ('pv_default', 'pv', 'PV', '', 100, '{serie}-{numar}-{an}', '-', true, false, false, true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
        ('anx_default', 'anexa', 'ANX', '', 1, '{contract_id}-ANX-{numar}', '-', false, false, false, true, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
      `;
      
      await bigquery.query({
        query: insertQuery,
        location: 'EU',
      });
      
      logSuccess(`Tabelul ${table} creat cu setări default`);
    }
  } catch (error) {
    logError(`Eroare la crearea tabelului ${table}:`, error);
    throw error;
  }
}

// GET - Încarcă setările
export async function GET(request: NextRequest) {
  try {
    await ensureTableExists();

    const query = `
      SELECT * FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE activ = true
      ORDER BY tip_document ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    // Procesează datele BigQuery cu helper-ul pentru NUMERIC
    const setariProcesate = rows.map((row: any) => ({
      ...row,
      numar_curent: convertBigQueryNumeric(row.numar_curent)
    }));

    return NextResponse.json({
      success: true,
      setari: setariProcesate,
      total: setariProcesate.length,
      message: `${setariProcesate.length} setări contracte încărcate`
    });

  } catch (error) {
    logError('Eroare la încărcarea setărilor contracte:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea setărilor contracte',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Creează setare nouă
export async function POST(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const body = await request.json();
    console.log('POST setări contracte request body:', body);

    // Validări de bază
    if (!body.tip_document || !body.serie) {
      return NextResponse.json({ 
        success: false,
        error: 'Tipul documentului și seria sunt obligatorii' 
      }, { status: 400 });
    }

    // Verifică dacă există deja o setare pentru acest tip
    const duplicateQuery = `
      SELECT id FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE tip_document = @tip_document AND activ = true
      LIMIT 1
    `;

    const [duplicateRows] = await bigquery.query({
      query: duplicateQuery,
      params: { tip_document: body.tip_document },
      types: { tip_document: 'STRING' },
      location: 'EU',
    });

    if (duplicateRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: `Există deja o setare activă pentru tipul "${body.tip_document}"` 
      }, { status: 400 });
    }

    // Generează ID nou
    const setareId = `${body.tip_document}_${Date.now()}`;

    // INSERT noua setare cu PROJECT ID CORECT
    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.${dataset}.${table}\`
      (id, tip_document, serie, prefix, numar_curent, format_numerotare, separator, include_an, include_luna, include_proiect_id, activ, data_creare, data_actualizare)
      VALUES 
      (@id, @tip_document, @serie, @prefix, @numar_curent, @format_numerotare, @separator, @include_an, @include_luna, @include_proiect_id, @activ, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `;

    const params = {
      id: setareId,
      tip_document: body.tip_document,
      serie: body.serie.toUpperCase(),
      prefix: body.prefix || '',
      numar_curent: parseInt(body.numar_curent) || 1000,
      format_numerotare: body.format_numerotare || '{serie}-{numar}-{an}',
      separator: body.separator || '-',
      include_an: body.include_an === true,
      include_luna: body.include_luna === true,
      include_proiect_id: body.include_proiect_id === true,
      activ: true
    };

    const types = {
      id: 'STRING',
      tip_document: 'STRING',
      serie: 'STRING',
      prefix: 'STRING',
      numar_curent: 'INT64',
      format_numerotare: 'STRING',
      separator: 'STRING',
      include_an: 'BOOL',
      include_luna: 'BOOL',
      include_proiect_id: 'BOOL',
      activ: 'BOOL'
    };

    await bigquery.query({
      query: insertQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    logSuccess(`Setare contracte creată cu succes: ${setareId}`);

    return NextResponse.json({
      success: true,
      message: 'Setare contracte adăugată cu succes',
      setareId: setareId
    });

  } catch (error) {
    logError('Eroare la crearea setării contracte:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la crearea setării contracte',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizează setare
export async function PUT(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const body = await request.json();
    console.log('PUT setări contracte request body:', body);

    if (!body.id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID setare obligatoriu pentru actualizare' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.${table}\`
      SET 
        serie = @serie,
        prefix = @prefix,
        numar_curent = @numar_curent,
        format_numerotare = @format_numerotare,
        separator = @separator,
        include_an = @include_an,
        include_luna = @include_luna,
        include_proiect_id = @include_proiect_id,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id
    `;

    const params = {
      id: body.id,
      serie: body.serie.toUpperCase(),
      prefix: body.prefix || '',
      numar_curent: parseInt(body.numar_curent) || 1000,
      format_numerotare: body.format_numerotare || '{serie}-{numar}-{an}',
      separator: body.separator || '-',
      include_an: body.include_an === true,
      include_luna: body.include_luna === true,
      include_proiect_id: body.include_proiect_id === true
    };

    const types = {
      id: 'STRING',
      serie: 'STRING',
      prefix: 'STRING',
      numar_curent: 'INT64',
      format_numerotare: 'STRING',
      separator: 'STRING',
      include_an: 'BOOL',
      include_luna: 'BOOL',
      include_proiect_id: 'BOOL'
    };

    await bigquery.query({
      query: updateQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    logSuccess(`Setare contracte actualizată cu succes: ${body.id}`);

    return NextResponse.json({
      success: true,
      message: 'Setare contracte actualizată cu succes'
    });

  } catch (error) {
    logError('Eroare la actualizarea setării contracte:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea setării contracte',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// ✅ NOUĂ: Funcție PREVIEW - citește numărul FĂRĂ a-l incrementa în BigQuery
// DATA: 04.10.2025 23:45 (ora României)
// SCOP: Frontend poate afișa preview-ul numărului FĂRĂ să consume un număr
export async function previewNextContractNumber(tipDocument: string, proiectId?: string, contractParinteId?: string) {
  try {
    await ensureTableExists();

    console.log(`[SETARI-CONTRACTE-PREVIEW] Preview număr pentru tipDocument: ${tipDocument}, proiectId: ${proiectId}`);

    // Încarcă setările pentru tipul de document
    const setariQuery = `
      SELECT * FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE tip_document = @tip_document AND activ = true
      LIMIT 1
    `;

    const [setariRows] = await bigquery.query({
      query: setariQuery,
      params: { tip_document: tipDocument },
      types: { tip_document: 'STRING' },
      location: 'EU',
    });

    if (setariRows.length === 0) {
      // Returnează număr default dacă nu există setări
      const currentYear = new Date().getFullYear();
      const defaultSerie = tipDocument === 'contract' ? 'CONTR' : tipDocument === 'pv' ? 'PV' : 'ANX';
      return {
        numar_contract: `${defaultSerie}-1001-${currentYear}`,
        numar_secvential: 1001,
        serie: defaultSerie,
        setari: { tip_document: tipDocument }
      };
    }

    const setari = setariRows[0];
    // ✅ PREVIEW: Calculează nextNumber FĂRĂ a executa UPDATE
    const nextNumber = convertBigQueryNumeric(setari.numar_curent || 1000) + 1;

    console.log(`[SETARI-CONTRACTE-PREVIEW] Preview calculat:`, {
      serie: setari.serie,
      numar_curent_db: convertBigQueryNumeric(setari.numar_curent),
      nextNumber_preview: nextNumber,
      format: setari.format_numerotare
    });

    // Construiește numărul contractului (FĂRĂ UPDATE în BigQuery)
    let numarContract = setari.format_numerotare;

    numarContract = numarContract.replace('{serie}', setari.serie);
    numarContract = numarContract.replace('{prefix}', setari.prefix || '');
    numarContract = numarContract.replace('{numar}', nextNumber.toString().padStart(4, '0'));

    if (setari.include_an) {
      numarContract = numarContract.replace('{an}', new Date().getFullYear().toString());
    }

    if (setari.include_luna) {
      const luna = String(new Date().getMonth() + 1).padStart(2, '0');
      numarContract = numarContract.replace('{luna}', luna);
    }

    if (setari.include_proiect_id && proiectId) {
      numarContract = numarContract.replace('{proiect_id}', proiectId);
    }

    if (contractParinteId) {
      numarContract = numarContract.replace('{contract_id}', contractParinteId);
    }

    console.log(`[SETARI-CONTRACTE-PREVIEW] ✅ Preview generat (FĂRĂ UPDATE): ${numarContract}`);

    return {
      numar_contract: numarContract,
      numar_secvential: nextNumber,
      serie: setari.serie,
      setari: setari
    };

  } catch (error) {
    logError('[SETARI-CONTRACTE-PREVIEW] Eroare la preview număr:', error);
    throw error;
  }
}

// MODIFICAT: Funcție helper pentru CONSUME (generarea ȘI incrementarea) următorului număr - EXPORTATĂ
export async function getNextContractNumber(tipDocument: string, proiectId?: string, contractParinteId?: string) {
  try {
    await ensureTableExists();

    console.log(`[SETARI-CONTRACTE] Generez numărul pentru tipDocument: ${tipDocument}, proiectId: ${proiectId}`);

    // Încarcă setările pentru tipul de document
    const setariQuery = `
      SELECT * FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE tip_document = @tip_document AND activ = true
      LIMIT 1
    `;

    const [setariRows] = await bigquery.query({
      query: setariQuery,
      params: { tip_document: tipDocument },
      types: { tip_document: 'STRING' },
      location: 'EU',
    });

    if (setariRows.length === 0) {
      // VERIFICARE SUPLIMENTARĂ: Creează setări default dacă nu există
      console.log(`[SETARI-CONTRACTE] Nu există setări pentru ${tipDocument}, creez setări default`);
      
      const defaultSetareId = `${tipDocument}_default_${Date.now()}`;
      const defaultInsertQuery = `
        INSERT INTO \`${PROJECT_ID}.${dataset}.${table}\`
        (id, tip_document, serie, prefix, numar_curent, format_numerotare, separator, include_an, include_luna, include_proiect_id, activ, data_creare, data_actualizare)
        VALUES 
        (@id, @tip_document, @serie, @prefix, @numar_curent, @format_numerotare, @separator, @include_an, @include_luna, @include_proiect_id, @activ, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
      `;

      const defaultParams = {
        id: defaultSetareId,
        tip_document: tipDocument,
        serie: tipDocument === 'contract' ? 'CONTR' : tipDocument === 'pv' ? 'PV' : 'ANX',
        prefix: '',
        numar_curent: 1000,
        format_numerotare: '{serie}-{numar}-{an}',
        separator: '-',
        include_an: true,
        include_luna: false,
        include_proiect_id: false,
        activ: true
      };

      await bigquery.query({
        query: defaultInsertQuery,
        params: defaultParams,
        types: {
          id: 'STRING',
          tip_document: 'STRING',
          serie: 'STRING',
          prefix: 'STRING',
          numar_curent: 'INT64',
          format_numerotare: 'STRING',
          separator: 'STRING',
          include_an: 'BOOL',
          include_luna: 'BOOL',
          include_proiect_id: 'BOOL',
          activ: 'BOOL'
        },
        location: 'EU',
      });

      // Reîncarcă setările după inserare
      const [newSetariRows] = await bigquery.query({
        query: setariQuery,
        params: { tip_document: tipDocument },
        types: { tip_document: 'STRING' },
        location: 'EU',
      });

      if (newSetariRows.length === 0) {
        throw new Error(`Nu s-au putut crea setările pentru tipul de document: ${tipDocument}`);
      }
      
      setariRows.push(...newSetariRows);
    }

    const setari = setariRows[0];
    const nextNumber = convertBigQueryNumeric(setari.numar_curent || 1000) + 1;

    console.log(`[SETARI-CONTRACTE] Setări găsite:`, {
      serie: setari.serie,
      prefix: setari.prefix,
      numar_curent: convertBigQueryNumeric(setari.numar_curent),
      nextNumber: nextNumber,
      format: setari.format_numerotare
    });

    // Construiește numărul contractului
    let numarContract = setari.format_numerotare;
    
    // Înlocuiește placeholder-urile
    numarContract = numarContract.replace('{serie}', setari.serie);
    numarContract = numarContract.replace('{prefix}', setari.prefix || '');
    numarContract = numarContract.replace('{numar}', nextNumber.toString().padStart(4, '0'));
    
    if (setari.include_an) {
      numarContract = numarContract.replace('{an}', new Date().getFullYear().toString());
    }
    
    if (setari.include_luna) {
      const luna = String(new Date().getMonth() + 1).padStart(2, '0');
      numarContract = numarContract.replace('{luna}', luna);
    }
    
    if (setari.include_proiect_id && proiectId) {
      numarContract = numarContract.replace('{proiect_id}', proiectId);
    }
    
    if (contractParinteId) {
      numarContract = numarContract.replace('{contract_id}', contractParinteId);
    }

    console.log(`[SETARI-CONTRACTE] Numărul generat ÎNAINTE de actualizare: ${numarContract}`);

    // VERIFICARE CRITICĂ: Actualizează numărul curent cu PROJECT ID CORECT
    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.${table}\`
      SET 
        numar_curent = @numar_curent,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id
    `;

    const updateResult = await bigquery.query({
      query: updateQuery,
      params: {
        id: setari.id,
        numar_curent: nextNumber
      },
      types: {
        id: 'STRING',
        numar_curent: 'INT64'
      },
      location: 'EU',
    });

    console.log(`[SETARI-CONTRACTE] UPDATE executat pentru setarea ${setari.id}, nextNumber: ${nextNumber}`);
    console.log(`[SETARI-CONTRACTE] UPDATE result:`, updateResult);

    // VERIFICARE FINALĂ: Confirmă că actualizarea a avut loc
    const verificareQuery = `
      SELECT numar_curent FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE id = @id
    `;

    const [verificareRows] = await bigquery.query({
      query: verificareQuery,
      params: { id: setari.id },
      types: { id: 'STRING' },
      location: 'EU',
    });

    if (verificareRows.length > 0) {
      const numarActualizat = convertBigQueryNumeric(verificareRows[0].numar_curent);
      console.log(`[SETARI-CONTRACTE] VERIFICARE: Numărul curent după actualizare este: ${numarActualizat}`);
      
      if (numarActualizat !== nextNumber) {
        console.error(`[SETARI-CONTRACTE] EROARE: Actualizarea a eșuat! Așteptat: ${nextNumber}, Găsit: ${numarActualizat}`);
      } else {
        console.log(`[SETARI-CONTRACTE] ✅ Actualizare confirmată cu succes`);
      }
    }

    return {
      numar_contract: numarContract,
      numar_secvential: nextNumber,
      serie: setari.serie,
      setari: setari
    };

  } catch (error) {
    logError('Eroare la generarea numărului contract:', error);
    console.error(`[SETARI-CONTRACTE] Stack trace:`, error);
    throw error;
  }
}
