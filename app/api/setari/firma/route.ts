// ==================================================================
// CALEA: app/api/setari/firma/route.ts
// DESCRIERE: API pentru managementul setărilor date firmă
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
const table = `SetariFirma${tableSuffix}`;
const TABLE_NAME = `\`${PROJECT_ID}.${DATASET}.SetariFirma${tableSuffix}\``;

console.log(`🔧 [Setari Firma] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// ✅ CREATE TABLE dacă nu există
async function ensureTableExists() {
  try {
    const [exists] = await bigquery.dataset(dataset).table(table).exists();
    
    if (!exists) {
      console.log(`Creez tabelul ${table}...`);
      
      const schema = [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'nume_firma', type: 'STRING', mode: 'REQUIRED' },
        { name: 'cui', type: 'STRING', mode: 'REQUIRED' },
        { name: 'nr_reg_com', type: 'STRING', mode: 'REQUIRED' },
        { name: 'adresa_completa', type: 'STRING', mode: 'REQUIRED' },
        { name: 'judet', type: 'STRING', mode: 'NULLABLE' },
        { name: 'oras', type: 'STRING', mode: 'NULLABLE' },
        { name: 'cod_postal', type: 'STRING', mode: 'NULLABLE' },
        { name: 'tara', type: 'STRING', mode: 'REQUIRED' },
        { name: 'telefon_principal', type: 'STRING', mode: 'REQUIRED' },
        { name: 'telefon_secundar', type: 'STRING', mode: 'NULLABLE' },
        { name: 'email_principal', type: 'STRING', mode: 'REQUIRED' },
        { name: 'email_secundar', type: 'STRING', mode: 'NULLABLE' },
        { name: 'website', type: 'STRING', mode: 'NULLABLE' },
        { name: 'capital_social', type: 'NUMERIC', mode: 'NULLABLE' },
        { name: 'tip_firma', type: 'STRING', mode: 'REQUIRED' },
        { name: 'reprezentant_legal', type: 'STRING', mode: 'NULLABLE' },
        { name: 'data_infiintare', type: 'DATE', mode: 'NULLABLE' },
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
      message: 'Setări firmă încărcate cu succes'
    });

  } catch (error) {
    console.error('Eroare la încărcarea setărilor firmă:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea setărilor firmă',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const body = await request.json();
    console.log('POST setari firma request body:', body);

    // Validări de bază
    if (!body.nume_firma || !body.cui || !body.adresa_completa) {
      return NextResponse.json({ 
        success: false,
        error: 'Numele firmei, CUI și adresa sunt obligatorii' 
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

    const setariId = existingRows.length > 0 ? existingRows[0].id : 'setari_firma_main';

    if (existingRows.length > 0) {
      // UPDATE - actualizează setările existente
      const updateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        SET 
          nume_firma = @nume_firma,
          cui = @cui,
          nr_reg_com = @nr_reg_com,
          adresa_completa = @adresa_completa,
          judet = @judet,
          oras = @oras,
          cod_postal = @cod_postal,
          tara = @tara,
          telefon_principal = @telefon_principal,
          telefon_secundar = @telefon_secundar,
          email_principal = @email_principal,
          email_secundar = @email_secundar,
          website = @website,
          capital_social = @capital_social,
          tip_firma = @tip_firma,
          reprezentant_legal = @reprezentant_legal,
          data_infiintare = @data_infiintare,
          observatii = @observatii,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id
      `;

      const params = {
        id: setariId,
        nume_firma: body.nume_firma,
        cui: body.cui,
        nr_reg_com: body.nr_reg_com,
        adresa_completa: body.adresa_completa,
        judet: body.judet || null,
        oras: body.oras || null,
        cod_postal: body.cod_postal || null,
        tara: body.tara || 'Romania',
        telefon_principal: body.telefon_principal,
        telefon_secundar: body.telefon_secundar || null,
        email_principal: body.email_principal,
        email_secundar: body.email_secundar || null,
        website: body.website || null,
        capital_social: body.capital_social ? parseFloat(body.capital_social.toString()) : null,
        tip_firma: body.tip_firma || 'SRL',
        reprezentant_legal: body.reprezentant_legal || null,
        data_infiintare: body.data_infiintare || null,
        observatii: body.observatii || null
      };

      const types = {
        id: 'STRING',
        nume_firma: 'STRING',
        cui: 'STRING',
        nr_reg_com: 'STRING',
        adresa_completa: 'STRING',
        judet: 'STRING',
        oras: 'STRING',
        cod_postal: 'STRING',
        tara: 'STRING',
        telefon_principal: 'STRING',
        telefon_secundar: 'STRING',
        email_principal: 'STRING',
        email_secundar: 'STRING',
        website: 'STRING',
        capital_social: 'NUMERIC',
        tip_firma: 'STRING',
        reprezentant_legal: 'STRING',
        data_infiintare: 'DATE',
        observatii: 'STRING'
      };

      await bigquery.query({
        query: updateQuery,
        params: params,
        types: types,
        location: 'EU',
      });

      console.log('✅ Setări firmă actualizate cu succes');

    } else {
      // INSERT - prima configurare
      const insertQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        (id, nume_firma, cui, nr_reg_com, adresa_completa, judet, oras, cod_postal, tara,
         telefon_principal, telefon_secundar, email_principal, email_secundar, website,
         capital_social, tip_firma, reprezentant_legal, data_infiintare, observatii,
         data_creare, data_actualizare)
        VALUES 
        (@id, @nume_firma, @cui, @nr_reg_com, @adresa_completa, @judet, @oras, @cod_postal, @tara,
         @telefon_principal, @telefon_secundar, @email_principal, @email_secundar, @website,
         @capital_social, @tip_firma, @reprezentant_legal, @data_infiintare, @observatii,
         CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
      `;

      const params = {
        id: setariId,
        nume_firma: body.nume_firma,
        cui: body.cui,
        nr_reg_com: body.nr_reg_com,
        adresa_completa: body.adresa_completa,
        judet: body.judet || null,
        oras: body.oras || null,
        cod_postal: body.cod_postal || null,
        tara: body.tara || 'Romania',
        telefon_principal: body.telefon_principal,
        telefon_secundar: body.telefon_secundar || null,
        email_principal: body.email_principal,
        email_secundar: body.email_secundar || null,
        website: body.website || null,
        capital_social: body.capital_social ? parseFloat(body.capital_social.toString()) : null,
        tip_firma: body.tip_firma || 'SRL',
        reprezentant_legal: body.reprezentant_legal || null,
        data_infiintare: body.data_infiintare || null,
        observatii: body.observatii || null
      };

      const types = {
        id: 'STRING',
        nume_firma: 'STRING',
        cui: 'STRING',
        nr_reg_com: 'STRING',
        adresa_completa: 'STRING',
        judet: 'STRING',
        oras: 'STRING',
        cod_postal: 'STRING',
        tara: 'STRING',
        telefon_principal: 'STRING',
        telefon_secundar: 'STRING',
        email_principal: 'STRING',
        email_secundar: 'STRING',
        website: 'STRING',
        capital_social: 'NUMERIC',
        tip_firma: 'STRING',
        reprezentant_legal: 'STRING',
        data_infiintare: 'DATE',
        observatii: 'STRING'
      };

      await bigquery.query({
        query: insertQuery,
        params: params,
        types: types,
        location: 'EU',
      });

      console.log('✅ Setări firmă create cu succes (prima configurare)');
    }

    return NextResponse.json({
      success: true,
      message: existingRows.length > 0 ? 'Setări firmă actualizate cu succes' : 'Setări firmă create cu succes'
    });

  } catch (error) {
    console.error('Eroare la salvarea setărilor firmă:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la salvarea setărilor firmă',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
