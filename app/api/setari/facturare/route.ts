// ==================================================================
// CALEA: app/api/setari/facturare/route.ts
// DESCRIERE: API pentru managementul setărilor de facturare
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
const table = `SetariFacturare${tableSuffix}`;
const TABLE_NAME = `\`${PROJECT_ID}.${DATASET}.SetariFacturare${tableSuffix}\``;

console.log(`🔧 [Setari Facturare] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// ✅ CREATE TABLE dacă nu există
async function ensureTableExists() {
  try {
    const [exists] = await bigquery.dataset(dataset).table(table).exists();
    
    if (!exists) {
      console.log(`Creez tabelul ${table}...`);
      
      const schema = [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'serie_facturi', type: 'STRING', mode: 'REQUIRED' },
        { name: 'serie_proforme', type: 'STRING', mode: 'REQUIRED' },
        { name: 'serie_chitante', type: 'STRING', mode: 'REQUIRED' },
        { name: 'serie_contracte', type: 'STRING', mode: 'REQUIRED' },
        { name: 'numar_curent_facturi', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'numar_curent_proforme', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'numar_curent_chitante', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'numar_curent_contracte', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'format_numerotare', type: 'STRING', mode: 'REQUIRED' },
        { name: 'separator_numerotare', type: 'STRING', mode: 'REQUIRED' },
        { name: 'include_an_numerotare', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'include_luna_numerotare', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'efactura_enabled', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'efactura_timp_intarziere', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'efactura_mock_mode', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'efactura_auto_send', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'cota_tva_standard', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'cota_tva_redusa', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'valabilitate_proforme', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'termen_plata_standard', type: 'INTEGER', mode: 'REQUIRED' },
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

export async function GET(request: NextRequest) {
  try {
    await ensureTableExists();

    const query = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows.length === 0) {
      // Prima utilizare - returnează setări default
      return NextResponse.json({
        success: true,
        setari: null,
        message: 'Prima configurare - folosind setări default'
      });
    }

    const setari = rows[0];
    
    return NextResponse.json({
      success: true,
      setari: setari,
      message: 'Setări încărcate cu succes'
    });

  } catch (error) {
    console.error('Eroare la încărcarea setărilor de facturare:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea setărilor de facturare',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const body = await request.json();
    console.log('POST request body:', body);

    // ✅ HELPER pentru procesarea datelor BigQuery
    const processValue = (value: any) => {
      if (value && typeof value === 'object' && value.value) {
        return value.value; // Extrage din formatul BigQuery {value: "..."}
      }
      return value;
    };

    // ✅ Procesează toate valorile care ar putea veni în format BigQuery
    const cleanBody = {
      serie_facturi: processValue(body.serie_facturi),
      serie_proforme: processValue(body.serie_proforme),
      serie_chitante: processValue(body.serie_chitante),
      serie_contracte: processValue(body.serie_contracte),
      numar_curent_facturi: processValue(body.numar_curent_facturi),
      numar_curent_proforme: processValue(body.numar_curent_proforme),
      numar_curent_chitante: processValue(body.numar_curent_chitante),
      numar_curent_contracte: processValue(body.numar_curent_contracte),
      format_numerotare: processValue(body.format_numerotare),
      separator_numerotare: processValue(body.separator_numerotare),
      include_an_numerotare: processValue(body.include_an_numerotare),
      include_luna_numerotare: processValue(body.include_luna_numerotare),
      efactura_enabled: processValue(body.efactura_enabled),
      efactura_timp_intarziere: processValue(body.efactura_timp_intarziere),
      efactura_mock_mode: processValue(body.efactura_mock_mode),
      efactura_auto_send: processValue(body.efactura_auto_send),
      cota_tva_standard: processValue(body.cota_tva_standard),
      cota_tva_redusa: processValue(body.cota_tva_redusa),
      valabilitate_proforme: processValue(body.valabilitate_proforme),
      termen_plata_standard: processValue(body.termen_plata_standard)
    };

    console.log('Processed clean body:', cleanBody);

    // Validări de bază
    if (!cleanBody.serie_facturi || !cleanBody.serie_proforme) {
      return NextResponse.json({ 
        success: false,
        error: 'Seriile de facturi și proforme sunt obligatorii' 
      }, { status: 400 });
    }

    // Verifică dacă există deja configurația
    const checkQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      location: 'EU',
    });

    const currentTime = new Date().toISOString();
    const setariId = existingRows.length > 0 ? existingRows[0].id : 'setari_facturare_main';

    console.log('Current time for BigQuery:', currentTime);
    console.log('Existing rows found:', existingRows.length);
    console.log('Using setari ID:', setariId);

    if (existingRows.length > 0) {
      // UPDATE - actualizează setările existente
      const updateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        SET 
          serie_facturi = @serie_facturi,
          serie_proforme = @serie_proforme,
          serie_chitante = @serie_chitante,
          serie_contracte = @serie_contracte,
          numar_curent_facturi = @numar_curent_facturi,
          numar_curent_proforme = @numar_curent_proforme,
          numar_curent_chitante = @numar_curent_chitante,
          numar_curent_contracte = @numar_curent_contracte,
          format_numerotare = @format_numerotare,
          separator_numerotare = @separator_numerotare,
          include_an_numerotare = @include_an_numerotare,
          include_luna_numerotare = @include_luna_numerotare,
          efactura_enabled = @efactura_enabled,
          efactura_timp_intarziere = @efactura_timp_intarziere,
          efactura_mock_mode = @efactura_mock_mode,
          efactura_auto_send = @efactura_auto_send,
          cota_tva_standard = @cota_tva_standard,
          cota_tva_redusa = @cota_tva_redusa,
          valabilitate_proforme = @valabilitate_proforme,
          termen_plata_standard = @termen_plata_standard,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id
      `;

      const params = {
        id: setariId,
        serie_facturi: cleanBody.serie_facturi,
        serie_proforme: cleanBody.serie_proforme,
        serie_chitante: cleanBody.serie_chitante,
        serie_contracte: cleanBody.serie_contracte,
        numar_curent_facturi: cleanBody.numar_curent_facturi,
        numar_curent_proforme: cleanBody.numar_curent_proforme,
        numar_curent_chitante: cleanBody.numar_curent_chitante,
        numar_curent_contracte: cleanBody.numar_curent_contracte,
        format_numerotare: cleanBody.format_numerotare,
        separator_numerotare: cleanBody.separator_numerotare,
        include_an_numerotare: cleanBody.include_an_numerotare,
        include_luna_numerotare: cleanBody.include_luna_numerotare,
        efactura_enabled: cleanBody.efactura_enabled,
        efactura_timp_intarziere: cleanBody.efactura_timp_intarziere,
        efactura_mock_mode: cleanBody.efactura_mock_mode,
        efactura_auto_send: cleanBody.efactura_auto_send,
        cota_tva_standard: cleanBody.cota_tva_standard,
        cota_tva_redusa: cleanBody.cota_tva_redusa,
        valabilitate_proforme: cleanBody.valabilitate_proforme,
        termen_plata_standard: cleanBody.termen_plata_standard
        // ✅ Eliminat data_actualizare din params - folosim CURRENT_TIMESTAMP() în query
      };

      const types = {
        id: 'STRING',
        serie_facturi: 'STRING',
        serie_proforme: 'STRING',
        serie_chitante: 'STRING',
        serie_contracte: 'STRING',
        numar_curent_facturi: 'INT64',
        numar_curent_proforme: 'INT64',
        numar_curent_chitante: 'INT64',
        numar_curent_contracte: 'INT64',
        format_numerotare: 'STRING',
        separator_numerotare: 'STRING',
        include_an_numerotare: 'BOOL',
        include_luna_numerotare: 'BOOL',
        efactura_enabled: 'BOOL',
        efactura_timp_intarziere: 'INT64',
        efactura_mock_mode: 'BOOL',
        efactura_auto_send: 'BOOL',
        cota_tva_standard: 'INT64',
        cota_tva_redusa: 'INT64',
        valabilitate_proforme: 'INT64',
        termen_plata_standard: 'INT64'
        // ✅ Eliminat data_actualizare din types
      };

      await bigquery.query({
        query: updateQuery,
        params: params,
        types: types,
        location: 'EU',
      });

      console.log('✅ BigQuery UPDATE executed successfully');

      console.log('✅ Setări actualizate cu succes');

    } else {
      // INSERT - prima configurare
      const insertQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        (id, serie_facturi, serie_proforme, serie_chitante, serie_contracte,
         numar_curent_facturi, numar_curent_proforme, numar_curent_chitante, numar_curent_contracte,
         format_numerotare, separator_numerotare, include_an_numerotare, include_luna_numerotare,
         efactura_enabled, efactura_timp_intarziere, efactura_mock_mode, efactura_auto_send,
         cota_tva_standard, cota_tva_redusa, valabilitate_proforme, termen_plata_standard,
         data_creare, data_actualizare)
        VALUES
        (@id, @serie_facturi, @serie_proforme, @serie_chitante, @serie_contracte,
         @numar_curent_facturi, @numar_curent_proforme, @numar_curent_chitante, @numar_curent_contracte,
         @format_numerotare, @separator_numerotare, @include_an_numerotare, @include_luna_numerotare,
         @efactura_enabled, @efactura_timp_intarziere, @efactura_mock_mode, @efactura_auto_send,
         @cota_tva_standard, @cota_tva_redusa, @valabilitate_proforme, @termen_plata_standard,
         CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
      `;

      const params = {
        id: setariId,
        serie_facturi: cleanBody.serie_facturi,
        serie_proforme: cleanBody.serie_proforme,
        serie_chitante: cleanBody.serie_chitante,
        serie_contracte: cleanBody.serie_contracte,
        numar_curent_facturi: cleanBody.numar_curent_facturi,
        numar_curent_proforme: cleanBody.numar_curent_proforme,
        numar_curent_chitante: cleanBody.numar_curent_chitante,
        numar_curent_contracte: cleanBody.numar_curent_contracte,
        format_numerotare: cleanBody.format_numerotare,
        separator_numerotare: cleanBody.separator_numerotare,
        include_an_numerotare: cleanBody.include_an_numerotare,
        include_luna_numerotare: cleanBody.include_luna_numerotare,
        efactura_enabled: cleanBody.efactura_enabled,
        efactura_timp_intarziere: cleanBody.efactura_timp_intarziere,
        efactura_mock_mode: cleanBody.efactura_mock_mode,
        efactura_auto_send: cleanBody.efactura_auto_send,
        cota_tva_standard: cleanBody.cota_tva_standard,
        cota_tva_redusa: cleanBody.cota_tva_redusa,
        valabilitate_proforme: cleanBody.valabilitate_proforme,
        termen_plata_standard: cleanBody.termen_plata_standard
        // ✅ Eliminat data_creare și data_actualizare - folosim CURRENT_TIMESTAMP() în query
      };

      const types = {
        id: 'STRING',
        serie_facturi: 'STRING',
        serie_proforme: 'STRING',
        serie_chitante: 'STRING',
        serie_contracte: 'STRING',
        numar_curent_facturi: 'INT64',
        numar_curent_proforme: 'INT64',
        numar_curent_chitante: 'INT64',
        numar_curent_contracte: 'INT64',
        format_numerotare: 'STRING',
        separator_numerotare: 'STRING',
        include_an_numerotare: 'BOOL',
        include_luna_numerotare: 'BOOL',
        efactura_enabled: 'BOOL',
        efactura_timp_intarziere: 'INT64',
        efactura_mock_mode: 'BOOL',
        efactura_auto_send: 'BOOL',
        cota_tva_standard: 'INT64',
        cota_tva_redusa: 'INT64',
        valabilitate_proforme: 'INT64',
        termen_plata_standard: 'INT64'
        // ✅ Eliminat data_creare și data_actualizare din types
      };

      await bigquery.query({
        query: insertQuery,
        params: params,
        types: types,
        location: 'EU',
      });

      console.log('✅ Setări create cu succes (prima configurare)');
    }

    return NextResponse.json({
      success: true,
      message: existingRows.length > 0 ? 'Setări actualizate cu succes' : 'Setări create cu succes'
    });

  } catch (error) {
    console.error('Eroare la salvarea setărilor de facturare:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la salvarea setărilor de facturare',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
