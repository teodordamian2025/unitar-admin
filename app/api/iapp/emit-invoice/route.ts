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
    console.log('📤 [iapp.ro] ========== START INVOICE EMISSION ==========');

    const body = await request.json();
    const { factura_id, tip_factura = 'fiscala', use_v2_api = true } = body;

    console.log('📤 [iapp.ro] Request payload:', { factura_id, tip_factura, use_v2_api });

    if (!factura_id) {
      console.error('❌ [iapp.ro] Missing factura_id in request');
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

    console.log('🔍 [iapp.ro] Config query rezultat:', configRows.length, 'rows');

    if (configRows.length === 0) {
      console.error('❌ [iapp.ro] No configuration found in IappConfig_v2');
      return NextResponse.json({
        success: false,
        error: 'iapp.ro configuration not found. Please configure in settings.'
      }, { status: 500 });
    }

    const config = configRows[0];
    console.log('✅ [iapp.ro] Config găsită:', {
      email_responsabil: config.email_responsabil,
      serie_default: config.serie_default,
      moneda_default: config.moneda_default,
      auto_transmite: config.auto_transmite_efactura
    });

    const codFirma = decryptValue(config.cod_firma);
    const parola = decryptValue(config.parola_api);

    console.log('🔐 [iapp.ro] Credențiale decriptate:', {
      codFirmaLength: codFirma.length,
      parolaLength: parola.length
    });

    // 2. Citește datele facturii din FacturiGenerate_v2
    // ✅ FIX: Nu mai facem JOIN cu Clienti_v2, datele client sunt în date_complete_json și coloane directe
    const facturaQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
      WHERE id = @factura_id
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { factura_id },
      location: 'EU'
    });

    console.log('🔍 [iapp.ro] Factură query rezultat:', facturaRows.length, 'rows');

    if (facturaRows.length === 0) {
      console.error('❌ [iapp.ro] Invoice not found:', factura_id);
      return NextResponse.json({
        success: false,
        error: 'Invoice not found'
      }, { status: 404 });
    }

    const factura = facturaRows[0];

    // ✅ Parse date_complete_json pentru date client
    let clientInfo: any = {};
    try {
      const dateComplete = JSON.parse(factura.date_complete_json || '{}');
      clientInfo = dateComplete.clientInfo || {};
    } catch (err) {
      console.warn('⚠️ [iapp.ro] Nu s-a putut parsa date_complete_json');
    }

    // ✅ Folosește date din coloane directe SAU din JSON
    const client_nume = factura.client_nume || clientInfo.nume || clientInfo.denumire || 'N/A';
    const client_cui = factura.client_cui || clientInfo.cui || 'N/A';

    console.log('✅ [iapp.ro] Factură găsită:', {
      client_nume,
      client_cui,
      valoare_totala: factura.total || factura.Valoare_Totala,
      data_factura: factura.data_factura?.value || factura.data_factura,
      serie: factura.serie,
      numar: factura.numar
    });

    // 3. Parse line items din date_complete_json
    let itemsRows: any[] = [];

    console.log('🔍 [iapp.ro] Parsing line items din date_complete_json...');

    try {
      const dateComplete = JSON.parse(factura.date_complete_json || '{}');
      const linii = dateComplete.linii_factura || [];

      console.log('✅ [iapp.ro] Line items găsite:', linii.length);

      itemsRows = linii.map((linie: any) => ({
        title: linie.denumire || linie.Denumire_Etapa || 'Serviciu',
        descriere: linie.descriere || linie.Descriere || '',
        um: 'buc',
        cantitate: 1,
        pret: linie.valoare_ron || linie.Valoare_RON || linie.pretUnitar || 0,
        tvapercent: linie.cota_tva || linie.cotaTva || 19,
        tvavalue: ((linie.valoare_ron || linie.Valoare_RON || linie.pretUnitar || 0) * (linie.cota_tva || linie.cotaTva || 19) / 100)
      }));

      console.log('✅ [iapp.ro] Items procesate pentru iapp.ro:', JSON.stringify(itemsRows, null, 2));
    } catch (parseError) {
      console.error('❌ [iapp.ro] Error parsing line items:', parseError);
      // Fallback: creează un item generic
      const total = factura.total || factura.Valoare_Totala || 0;
      const subtotal = factura.subtotal || (total / 1.19) || 0;
      itemsRows = [{
        title: 'Servicii ' + client_nume,
        descriere: 'Factură generată automat',
        um: 'buc',
        cantitate: 1,
        pret: subtotal,
        tvapercent: 19,
        tvavalue: total - subtotal
      }];
      console.log('⚠️ [iapp.ro] Folosit item fallback:', itemsRows[0]);
    }

    // Construiește payload pentru iapp.ro
    const iappPayload: any = {
      email_responsabil: config.email_responsabil,
      data_start: factura.data_factura?.value || factura.data_factura || new Date().toISOString().split('T')[0],
      data_termen: '30', // 30 zile termen plată
      seria: config.serie_default || factura.serie || 'UPA',
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
        cif: client_cui.replace('RO', '').trim() // ✅ FIX: Remove RO prefix
      };
    } else {
      iappPayload.client = {
        type: 'J',
        cif: client_cui.replace('RO', '').trim(),
        nume: client_nume,
        reg_com: clientInfo.reg_com || clientInfo.regCom || '',
        adresa: clientInfo.adresa || '',
        tara: clientInfo.tara || 'RO',
        judet: clientInfo.judet || '',
        oras: clientInfo.oras || '',
        strada: clientInfo.strada || ''
      };
    }

    // 4. Trimite request la iapp.ro
    const apiUrl = tip_factura === 'proforma'
      ? 'https://api.my.iapp.ro/emite/proforma' + (use_v2_api ? '-v2' : '')
      : 'https://api.my.iapp.ro/emite/factura' + (use_v2_api ? '-v2' : '');

    const authHeader = Buffer.from(`${codFirma}:${parola}`).toString('base64');

    console.log(`📡 [iapp.ro] ========== SENDING REQUEST ==========`);
    console.log(`📡 [iapp.ro] URL: ${apiUrl}`);
    console.log(`📡 [iapp.ro] Tip factură: ${tip_factura}`);
    console.log(`📡 [iapp.ro] API version: ${use_v2_api ? 'v2 (doar CIF)' : 'v1 (toate datele)'}`);
    console.log(`📡 [iapp.ro] Auth header length: ${authHeader.length}`);
    console.log(`📡 [iapp.ro] Payload:`, JSON.stringify(iappPayload, null, 2));

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

    console.log(`📥 [iapp.ro] ========== RESPONSE RECEIVED ==========`);
    console.log(`📥 [iapp.ro] Status: ${response.status} ${response.statusText}`);
    console.log(`📥 [iapp.ro] Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`📥 [iapp.ro] Body:`, JSON.stringify(responseData, null, 2));

    // 5. Salvează în IappFacturiEmise_v2
    const now = new Date().toISOString();
    const logRecord = [{
      id: crypto.randomUUID(),
      factura_id,
      iapp_id_factura: responseData.id_factura || null,
      iapp_serie: responseData.serie || config.serie_default,
      iapp_numar: responseData.numar || null,
      tip_factura,
      client_cif: client_cui,
      client_nume: client_nume,
      valoare_totala: factura.total || factura.Valoare_Totala,
      moneda: config.moneda_default || 'RON',
      status: response.ok ? 'trimisa' : 'error',
      efactura_upload_index: responseData.efactura_upload_index || null,
      efactura_status: responseData.efactura_status || null,
      efactura_mesaj_eroare: responseData.error || null,
      request_json: JSON.stringify(iappPayload),
      response_json: JSON.stringify(responseData),
      data_emitere: factura.data_factura?.value || factura.data_factura || new Date().toISOString().split('T')[0],
      data_transmitere: now,
      data_actualizare: now,
      creat_de: 'system'
    }];

    console.log('💾 [iapp.ro] Salvez în IappFacturiEmise_v2:', logRecord[0].id);

    await bigquery.dataset(DATASET).table('IappFacturiEmise_v2').insert(logRecord);

    console.log('✅ [iapp.ro] Salvat în BigQuery IappFacturiEmise_v2');

    // 6. Update FacturiGenerate_v2 cu status
    if (response.ok && responseData.id_factura) {
      console.log('📝 [iapp.ro] Updating FacturiGenerate_v2 cu efactura_status');

      try {
        const updateQuery = `
          UPDATE \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
          SET efactura_status = 'trimisa_iapp',
              anaf_upload_id = @iapp_id,
              data_actualizare = CURRENT_TIMESTAMP()
          WHERE id = @factura_id
        `;

        await bigquery.query({
          query: updateQuery,
          params: {
            factura_id,
            iapp_id: String(responseData.id_factura)
          },
          location: 'EU'
        });

        console.log('✅ [iapp.ro] FacturiGenerate_v2 updated successfully');
      } catch (updateError) {
        console.error('⚠️ [iapp.ro] Update FacturiGenerate_v2 failed (streaming buffer?):', updateError);
      }
    }

    // Returnează rezultat
    if (!response.ok) {
      console.error('❌ [iapp.ro] ========== EMISSION FAILED ==========');
      console.error('❌ [iapp.ro] Status:', response.status);
      console.error('❌ [iapp.ro] Error:', responseData);

      return NextResponse.json({
        success: false,
        error: 'iapp.ro API error',
        status: response.status,
        details: responseData
      }, { status: response.status });
    }

    console.log('✅ [iapp.ro] ========== EMISSION SUCCESS ==========');
    console.log('✅ [iapp.ro] iapp_id_factura:', responseData.id_factura);
    console.log('✅ [iapp.ro] Serie:', responseData.serie);
    console.log('✅ [iapp.ro] Număr:', responseData.numar);
    console.log('✅ [iapp.ro] e-Factura uploaded:', !!responseData.efactura_upload_index);
    console.log('✅ [iapp.ro] Upload index:', responseData.efactura_upload_index);

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
