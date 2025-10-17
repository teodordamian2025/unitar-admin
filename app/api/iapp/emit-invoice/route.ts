// ==================================================================
// CALEA: app/api/iapp/emit-invoice/route.ts
// DESCRIERE: Emite factură prin iapp.ro API + transmite automat la ANAF
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel timeout 60s

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// Funcții de criptare/decriptare (reutilizate din ANAF)
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

// ==================================================================
// POST: Emite factură prin iapp.ro
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [iapp.ro] Starting invoice emission...');

    const body = await request.json();
    const { factura_id, tip_factura = 'fiscala', use_v2_api = true } = body;

    if (!factura_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing factura_id'
      }, { status: 400 });
    }

    // 1. Citește configurare iapp.ro din BigQuery
    const configQuery = `
      SELECT cod_firma, parola_api, email_responsabil, serie_default,
             moneda_default, footer_intocmit_name, auto_transmite_efactura
      FROM \`${PROJECT_ID}.${DATASET}.IappConfig_v2\`
      WHERE activ = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [configRows] = await bigquery.query({ query: configQuery, location: 'EU' });
    if (configRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'iapp.ro configuration not found. Please configure in settings.'
      }, { status: 500 });
    }

    const config = configRows[0];
    const codFirma = decryptValue(config.cod_firma);
    const parola = decryptValue(config.parola_api);

    // 2. Citește datele facturii din FacturiGenerate_v2
    const facturaQuery = `
      SELECT f.*, c.Denumire as client_nume, c.CUI as client_cui,
             c.Reg_Com as client_reg_com, c.Adresa as client_adresa,
             c.Tara as client_tara, c.Judet as client_judet,
             c.Oras as client_oras, c.Strada as client_strada
      FROM \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\` f
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Clienti_v2\` c ON f.Client_ID = c.ID
      WHERE f.ID = @factura_id
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { factura_id },
      location: 'EU'
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invoice not found'
      }, { status: 404 });
    }

    const factura = facturaRows[0];

    // 3. Citește line items din EtapeContract_v2 (legat de factura_id)
    const itemsQuery = `
      SELECT Denumire_Etapa as title, Descriere as descriere,
             Valoare_RON as pret, 1 as cantitate, 'buc' as um,
             19 as tvapercent, ROUND(Valoare_RON * 0.19, 2) as tvavalue
      FROM \`${PROJECT_ID}.${DATASET}.EtapeContract_v2\`
      WHERE ID IN (
        SELECT etapa_id FROM \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
        WHERE ID = @factura_id
      )
    `;

    const [itemsRows] = await bigquery.query({
      query: itemsQuery,
      params: { factura_id },
      location: 'EU'
    });

    // Construiește payload pentru iapp.ro
    const iappPayload: any = {
      email_responsabil: config.email_responsabil,
      data_start: factura.Data_Factura?.value || new Date().toISOString().split('T')[0],
      data_termen: '30', // 30 zile termen plată
      seria: config.serie_default || 'SERIE_TEST',
      moneda: config.moneda_default || 'RON',
      footer: {
        intocmit_name: config.footer_intocmit_name || 'Administrator'
      },
      continut: itemsRows.map((item: any) => ({
        title: item.title,
        descriere: item.descriere || '',
        um: item.um,
        cantitate: String(item.cantitate),
        pret: String(item.pret),
        tvavalue: String(item.tvavalue),
        tvapercent: String(item.tvapercent)
      }))
    };

    // API v2 (doar CIF) vs v1 (toate datele client)
    if (use_v2_api) {
      iappPayload.client = {
        type: 'J', // Juridic
        cif: factura.client_cui
      };
    } else {
      iappPayload.client = {
        type: 'J',
        cif: factura.client_cui,
        nume: factura.client_nume,
        reg_com: factura.client_reg_com,
        adresa: factura.client_adresa,
        tara: factura.client_tara || 'RO',
        judet: factura.client_judet,
        oras: factura.client_oras,
        strada: factura.client_strada
      };
    }

    // 4. Trimite request la iapp.ro
    const apiUrl = tip_factura === 'proforma'
      ? 'https://api.my.iapp.ro/emite/proforma' + (use_v2_api ? '-v2' : '')
      : 'https://api.my.iapp.ro/emite/factura' + (use_v2_api ? '-v2' : '');

    const authHeader = Buffer.from(`${codFirma}:${parola}`).toString('base64');

    console.log(`📡 [iapp.ro] Sending ${tip_factura} to ${apiUrl}...`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(iappPayload)
    });

    const responseText = await response.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`📥 [iapp.ro] Response status: ${response.status}`, responseData);

    // 5. Salvează în IappFacturiEmise_v2
    const now = new Date().toISOString();
    const logRecord = [{
      id: crypto.randomUUID(),
      factura_id,
      iapp_id_factura: responseData.id_factura || null,
      iapp_serie: responseData.serie || config.serie_default,
      iapp_numar: responseData.numar || null,
      tip_factura,
      client_cif: factura.client_cui,
      client_nume: factura.client_nume,
      valoare_totala: factura.Valoare_Totala,
      moneda: config.moneda_default || 'RON',
      status: response.ok ? 'trimisa' : 'error',
      efactura_upload_index: responseData.efactura_upload_index || null,
      efactura_status: responseData.efactura_status || null,
      efactura_mesaj_eroare: responseData.error || null,
      request_json: JSON.stringify(iappPayload),
      response_json: JSON.stringify(responseData),
      data_emitere: factura.Data_Factura?.value || new Date().toISOString().split('T')[0],
      data_transmitere: now,
      data_actualizare: now,
      creat_de: 'system'
    }];

    await bigquery.dataset(DATASET).table('IappFacturiEmise_v2').insert(logRecord);

    // 6. Update FacturiGenerate_v2 cu status
    if (response.ok && responseData.id_factura) {
      const updateQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
        SET Status_Transmitere_eFactura = 'trimisa_iapp',
            iapp_id_factura = @iapp_id,
            Data_Actualizare = CURRENT_TIMESTAMP()
        WHERE ID = @factura_id
      `;

      await bigquery.query({
        query: updateQuery,
        params: {
          factura_id,
          iapp_id: responseData.id_factura
        },
        location: 'EU'
      });
    }

    // Returnează rezultat
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'iapp.ro API error',
        status: response.status,
        details: responseData
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      iapp_id_factura: responseData.id_factura,
      serie: responseData.serie,
      numar: responseData.numar,
      efactura_uploaded: !!responseData.efactura_upload_index,
      efactura_upload_index: responseData.efactura_upload_index,
      message: `${tip_factura === 'proforma' ? 'Proforma' : 'Factura'} emitted successfully via iapp.ro`,
      data: responseData
    });

  } catch (error) {
    console.error('❌ [iapp.ro] Error emitting invoice:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to emit invoice via iapp.ro',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// GET: Verifică status factură emisă
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const factura_id = searchParams.get('factura_id');

    if (!factura_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing factura_id parameter'
      }, { status: 400 });
    }

    const query = `
      SELECT * FROM \`${PROJECT_ID}.${DATASET}.IappFacturiEmise_v2\`
      WHERE factura_id = @factura_id
      ORDER BY data_transmitere DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { factura_id },
      location: 'EU'
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invoice not found in iapp.ro logs'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('❌ [iapp.ro] Error getting invoice status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get invoice status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
