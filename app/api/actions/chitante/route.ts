// ==================================================================
// CALEA: app/api/actions/chitante/route.ts
// DATA: 29.11.2025
// DESCRIERE: API pentru gestionarea chitantelor - CRUD + actualizare factura
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// Tabele
const TABLE_CHITANTE = `\`${PROJECT_ID}.${DATASET}.Chitante${tableSuffix}\``;
const TABLE_FACTURI = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_SETARI = `\`${PROJECT_ID}.${DATASET}.SetariFacturare${tableSuffix}\``;

console.log(`🔧 Chitante API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Plafonuri legale pentru plati in numerar (conform legislatie romana)
const PLAFON_PJ = 5000;  // Lei - plata intre persoane juridice
const PLAFON_PF = 10000; // Lei - plata de la persoana fizica

// ============================================================
// GET - Lista chitante pentru o factura sau toate
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facturaId = searchParams.get('facturaId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT
        c.*,
        f.total as factura_total,
        f.valoare_platita as factura_valoare_platita,
        f.status as factura_status
      FROM ${TABLE_CHITANTE} c
      LEFT JOIN ${TABLE_FACTURI} f ON c.factura_id = f.id
      WHERE c.activ = true
    `;

    const params: any = {};
    const types: any = {};

    if (facturaId) {
      query += ' AND c.factura_id = @facturaId';
      params.facturaId = facturaId;
      types.facturaId = 'STRING';
    }

    query += ' ORDER BY c.data_creare DESC';
    query += ' LIMIT @limit OFFSET @offset';
    params.limit = limit;
    params.offset = offset;
    types.limit = 'INT64';
    types.offset = 'INT64';

    const [rows] = await bigquery.query({
      query,
      params,
      types,
      location: 'EU'
    });

    return NextResponse.json({
      success: true,
      chitante: rows
    });

  } catch (error) {
    console.error('Eroare la listarea chitantelor:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la listarea chitantelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

// ============================================================
// POST - Creare chitanta noua + actualizare factura
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      factura_id,
      valoare_incasata,
      data_chitanta,
      reprezentant_legal,
      descriere,
      creat_de,
      creat_de_nume
    } = body;

    // Validari de baza
    if (!factura_id) {
      return NextResponse.json({
        success: false,
        error: 'ID-ul facturii este obligatoriu'
      }, { status: 400 });
    }

    if (!valoare_incasata || valoare_incasata <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Valoarea incasata trebuie sa fie pozitiva'
      }, { status: 400 });
    }

    // 1. Preia datele facturii
    const facturaQuery = `
      SELECT
        id, serie, numar,
        client_id, client_nume, client_cui,
        proiect_id,
        total, valoare_platita, status,
        date_complete_json
      FROM ${TABLE_FACTURI}
      WHERE id = @facturaId
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId: factura_id },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura nu a fost gasita'
      }, { status: 404 });
    }

    const factura = facturaRows[0];

    // Extrage tip client din date_complete_json sau determina din CUI
    let tipClient = 'pj'; // default persoana juridica
    try {
      if (factura.date_complete_json) {
        const dateComplete = typeof factura.date_complete_json === 'string'
          ? JSON.parse(factura.date_complete_json)
          : factura.date_complete_json;
        if (dateComplete.clientInfo?.tip_client) {
          tipClient = dateComplete.clientInfo.tip_client;
        }
      }
    } catch (e) {
      console.warn('Nu s-a putut parsa date_complete_json:', e);
    }

    // Daca nu avem CUI sau CUI este CNP (13 cifre), e persoana fizica
    if (!factura.client_cui || (factura.client_cui && factura.client_cui.length === 13)) {
      tipClient = 'pf';
    }

    // Calculeaza plafonul aplicabil
    const plafonAplicabil = tipClient === 'pf' ? PLAFON_PF : PLAFON_PJ;

    // Verificare plafon
    if (valoare_incasata > plafonAplicabil) {
      return NextResponse.json({
        success: false,
        error: `Valoarea depaseste plafonul legal pentru plati in numerar (${plafonAplicabil.toLocaleString('ro-RO')} lei pentru ${tipClient === 'pf' ? 'persoane fizice' : 'persoane juridice'})`,
        plafon: plafonAplicabil,
        tip_client: tipClient
      }, { status: 400 });
    }

    // Calculeaza rest de plata
    const valoarePlatitaCurenta = parseFloat(factura.valoare_platita || 0);
    const totalFactura = parseFloat(factura.total || 0);
    const restDePlata = totalFactura - valoarePlatitaCurenta;

    // Verificare sa nu depaseasca restul de plata
    if (valoare_incasata > restDePlata) {
      return NextResponse.json({
        success: false,
        error: `Valoarea incasata (${valoare_incasata.toLocaleString('ro-RO')} lei) depaseste restul de plata (${restDePlata.toLocaleString('ro-RO')} lei)`,
        rest_de_plata: restDePlata
      }, { status: 400 });
    }

    // 2. Preia urmatorul numar de chitanta
    const setariQuery = `
      SELECT serie_chitante, numar_curent_chitante
      FROM ${TABLE_SETARI}
      ORDER BY data_actualizare DESC
      LIMIT 1
    `;

    const [setariRows] = await bigquery.query({
      query: setariQuery,
      location: 'EU'
    });

    let serieChitanta = 'CHT';
    let numarChitanta = 1;

    if (setariRows.length > 0) {
      serieChitanta = setariRows[0].serie_chitante || 'CHT';
      numarChitanta = (setariRows[0].numar_curent_chitante || 0) + 1;
    }

    // 3. Genereaza ID chitanta
    const chitantaId = uuidv4();

    // 4. Calculeaza noile valori pentru factura
    const nouaValoarePlatita = valoarePlatitaCurenta + valoare_incasata;
    const nouStatus = nouaValoarePlatita >= totalFactura ? 'incasata' :
                      (nouaValoarePlatita > 0 ? 'partial_incasata' : factura.status);

    // Extrage proiect_denumire din date_complete_json
    let proiectDenumire = '';
    try {
      if (factura.date_complete_json) {
        const dateComplete = typeof factura.date_complete_json === 'string'
          ? JSON.parse(factura.date_complete_json)
          : factura.date_complete_json;
        proiectDenumire = dateComplete.proiectInfo?.Denumire ||
                          dateComplete.proiectInfo?.denumire || '';
      }
    } catch (e) {
      console.warn('Nu s-a putut extrage proiect_denumire:', e);
    }

    // 5. INSERT chitanta
    const insertQuery = `
      INSERT INTO ${TABLE_CHITANTE} (
        id, serie, numar,
        factura_id, factura_serie, factura_numar,
        client_id, client_nume, client_cui, tip_client,
        proiect_id, proiect_denumire,
        valoare_incasata, moneda,
        data_chitanta, reprezentant_legal, descriere,
        creat_de, creat_de_nume,
        data_creare, data_actualizare,
        activ, anulata
      ) VALUES (
        @id, @serie, @numar,
        @factura_id, @factura_serie, @factura_numar,
        @client_id, @client_nume, @client_cui, @tip_client,
        @proiect_id, @proiect_denumire,
        @valoare_incasata, 'RON',
        @data_chitanta, @reprezentant_legal, @descriere,
        @creat_de, @creat_de_nume,
        CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(),
        true, false
      )
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: chitantaId,
        serie: serieChitanta,
        numar: numarChitanta.toString(),
        factura_id: factura_id,
        factura_serie: factura.serie || '',
        factura_numar: factura.numar || '',
        client_id: factura.client_id || '',
        client_nume: factura.client_nume || '',
        client_cui: factura.client_cui || '',
        tip_client: tipClient,
        proiect_id: factura.proiect_id || '',
        proiect_denumire: proiectDenumire,
        valoare_incasata: valoare_incasata,
        data_chitanta: data_chitanta || new Date().toISOString().split('T')[0],
        reprezentant_legal: reprezentant_legal || '',
        descriere: descriere || `Incasare partiala/totala factura ${factura.serie ? factura.serie + '-' : ''}${factura.numar}`,
        creat_de: creat_de || '',
        creat_de_nume: creat_de_nume || ''
      },
      types: {
        id: 'STRING',
        serie: 'STRING',
        numar: 'STRING',
        factura_id: 'STRING',
        factura_serie: 'STRING',
        factura_numar: 'STRING',
        client_id: 'STRING',
        client_nume: 'STRING',
        client_cui: 'STRING',
        tip_client: 'STRING',
        proiect_id: 'STRING',
        proiect_denumire: 'STRING',
        valoare_incasata: 'NUMERIC',
        data_chitanta: 'DATE',
        reprezentant_legal: 'STRING',
        descriere: 'STRING',
        creat_de: 'STRING',
        creat_de_nume: 'STRING'
      },
      location: 'EU'
    });

    // 6. UPDATE factura - valoare_platita si status
    const updateFacturaQuery = `
      UPDATE ${TABLE_FACTURI}
      SET
        valoare_platita = @nouaValoarePlatita,
        status = @nouStatus,
        data_plata = CASE
          WHEN @nouStatus = 'incasata' THEN CURRENT_TIMESTAMP()
          ELSE data_plata
        END,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: updateFacturaQuery,
      params: {
        nouaValoarePlatita: nouaValoarePlatita,
        nouStatus: nouStatus,
        facturaId: factura_id
      },
      types: {
        nouaValoarePlatita: 'NUMERIC',
        nouStatus: 'STRING',
        facturaId: 'STRING'
      },
      location: 'EU'
    });

    // 7. UPDATE numar curent chitante in setari
    const updateSetariQuery = `
      UPDATE ${TABLE_SETARI}
      SET
        numar_curent_chitante = @numarNou,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = (SELECT id FROM ${TABLE_SETARI} ORDER BY data_actualizare DESC LIMIT 1)
    `;

    await bigquery.query({
      query: updateSetariQuery,
      params: { numarNou: numarChitanta },
      types: { numarNou: 'INT64' },
      location: 'EU'
    });

    console.log(`✅ Chitanta ${serieChitanta}-${numarChitanta} creata pentru factura ${factura.serie || ''}${factura.numar}`);

    return NextResponse.json({
      success: true,
      message: `Chitanta ${serieChitanta}-${numarChitanta} a fost emisa cu succes`,
      chitanta: {
        id: chitantaId,
        serie: serieChitanta,
        numar: numarChitanta.toString(),
        valoare_incasata: valoare_incasata
      },
      factura: {
        id: factura_id,
        noua_valoare_platita: nouaValoarePlatita,
        nou_status: nouStatus,
        rest_de_plata: totalFactura - nouaValoarePlatita
      }
    });

  } catch (error) {
    console.error('Eroare la crearea chitantei:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la crearea chitantei',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

// ============================================================
// DELETE - Anuleaza chitanta (soft delete) + update factura
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chitantaId = searchParams.get('id');
    const motiv = searchParams.get('motiv') || 'Anulata manual';

    if (!chitantaId) {
      return NextResponse.json({
        success: false,
        error: 'ID-ul chitantei este obligatoriu'
      }, { status: 400 });
    }

    // 1. Preia chitanta
    const chitantaQuery = `
      SELECT * FROM ${TABLE_CHITANTE}
      WHERE id = @chitantaId AND activ = true
    `;

    const [chitantaRows] = await bigquery.query({
      query: chitantaQuery,
      params: { chitantaId },
      types: { chitantaId: 'STRING' },
      location: 'EU'
    });

    if (chitantaRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Chitanta nu a fost gasita sau a fost deja anulata'
      }, { status: 404 });
    }

    const chitanta = chitantaRows[0];

    // 2. Soft delete chitanta
    const deleteChitantaQuery = `
      UPDATE ${TABLE_CHITANTE}
      SET
        activ = false,
        anulata = true,
        motiv_anulare = @motiv,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @chitantaId
    `;

    await bigquery.query({
      query: deleteChitantaQuery,
      params: { chitantaId, motiv },
      types: { chitantaId: 'STRING', motiv: 'STRING' },
      location: 'EU'
    });

    // 3. Preia factura si recalculeaza
    const facturaQuery = `
      SELECT id, total, valoare_platita, status
      FROM ${TABLE_FACTURI}
      WHERE id = @facturaId
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId: chitanta.factura_id },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    if (facturaRows.length > 0) {
      const factura = facturaRows[0];
      const valoareChitanta = parseFloat(chitanta.valoare_incasata || 0);
      const valoarePlatitaCurenta = parseFloat(factura.valoare_platita || 0);
      const totalFactura = parseFloat(factura.total || 0);

      const nouaValoarePlatita = Math.max(0, valoarePlatitaCurenta - valoareChitanta);
      const nouStatus = nouaValoarePlatita >= totalFactura ? 'incasata' :
                        (nouaValoarePlatita > 0 ? 'partial_incasata' : 'pdf_generated');

      // 4. UPDATE factura
      const updateFacturaQuery = `
        UPDATE ${TABLE_FACTURI}
        SET
          valoare_platita = @nouaValoarePlatita,
          status = @nouStatus,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @facturaId
      `;

      await bigquery.query({
        query: updateFacturaQuery,
        params: {
          nouaValoarePlatita,
          nouStatus,
          facturaId: chitanta.factura_id
        },
        types: {
          nouaValoarePlatita: 'NUMERIC',
          nouStatus: 'STRING',
          facturaId: 'STRING'
        },
        location: 'EU'
      });
    }

    console.log(`✅ Chitanta ${chitanta.serie}-${chitanta.numar} anulata`);

    return NextResponse.json({
      success: true,
      message: `Chitanta ${chitanta.serie}-${chitanta.numar} a fost anulata`
    });

  } catch (error) {
    console.error('Eroare la anularea chitantei:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la anularea chitantei',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
