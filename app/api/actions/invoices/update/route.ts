// ==================================================================
// CALEA: app/api/actions/invoices/update/route.ts
// DATA: 06.10.2025 16:45 (ora României)
// MODIFICAT: Fix complet status_facturare pentru Proiecte_v2 la editare facturi
// PĂSTRATE: Toate funcționalitățile existente (Edit simplu + Edit complet + EtapeFacturi)
// FIX: Race condition + UPDATE Subproiecte + RESET logic + logging avansat
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_ETAPE_FACTURI = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;
const TABLE_ANEXE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.AnexeContract${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

console.log(`🔧 Invoice Update API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: FacturiGenerate${tableSuffix}, EtapeFacturi${tableSuffix}, EtapeContract${tableSuffix}, AnexeContract${tableSuffix}, Subproiecte${tableSuffix}, Proiecte${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ✅ Interfață pentru etapele facturate (din frontend)
interface EtapaFacturata {
  tip: 'etapa_contract' | 'etapa_anexa';
  id: string; // ID_Etapa sau ID_Anexa
  contract_id: string;
  subproiect_id?: string;
  valoare?: number;
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
}

// ✅ NOUĂ: Funcție pentru actualizarea status_facturare la proiectul părinte (DUPLICATĂ din generate-hibrid)
// DATA: 06.10.2025 16:45 (ora României)
// FIX APLICAT: Race condition + logging avansat + retry logic + verificare DATE field
async function updateProiectStatusFacturare(proiectId: string) {
  if (!proiectId) {
    console.log('⚠️ [PROIECT-STATUS-EDIT] Nu există proiectId pentru actualizare status');
    return;
  }

  console.log(`🔍 [PROIECT-STATUS-EDIT] Verificare status facturare pentru proiect: ${proiectId}`);

  try {
    // PASUL 1: Numără subproiectele și câte sunt facturate
    const countQuery = `
      SELECT
        COUNT(*) as total_subproiecte,
        COUNTIF(status_facturare = 'Facturat') as facturate
      FROM ${TABLE_SUBPROIECTE}
      WHERE ID_Proiect = @proiectId AND activ = true
    `;

    console.log(`🔍 [PROIECT-STATUS-EDIT] Query pentru numărare subproiecte:`, {
      query: countQuery,
      proiectId,
      table: TABLE_SUBPROIECTE
    });

    const [countRows] = await bigquery.query({
      query: countQuery,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU'
    });

    console.log(`📊 [PROIECT-STATUS-EDIT] Rezultate query BigQuery:`, {
      rows_count: countRows?.length || 0,
      raw_data: countRows && countRows.length > 0 ? countRows[0] : null
    });

    // ✅ FIX #2: Verifică și loggează mai detaliat dacă query-ul returnează 0 rânduri
    if (!countRows || countRows.length === 0) {
      console.error(`❌ [PROIECT-STATUS-EDIT] COUNT query a returnat 0 rânduri!`, {
        proiectId,
        query_executat: countQuery,
        table: TABLE_SUBPROIECTE,
        filtru_activ: 'activ = true'
      });
      
      // ✅ FIX #3 FALLBACK: Încearcă query-ul FĂRĂ activ = true
      console.log('⚠️ [PROIECT-STATUS-EDIT] Retry fără filtru activ...');
      
      const retryQuery = `
        SELECT
          COUNT(*) as total_subproiecte,
          COUNTIF(status_facturare = 'Facturat') as facturate
        FROM ${TABLE_SUBPROIECTE}
        WHERE ID_Proiect = @proiectId
      `;

      console.log(`🔄 [PROIECT-STATUS-EDIT] Retry query:`, {
        query: retryQuery,
        proiectId
      });

      const [retryRows] = await bigquery.query({
        query: retryQuery,
        params: { proiectId },
        types: { proiectId: 'STRING' },
        location: 'EU'
      });

      console.log(`📊 [PROIECT-STATUS-EDIT] Rezultate retry query:`, {
        rows_count: retryRows?.length || 0,
        raw_data: retryRows && retryRows.length > 0 ? retryRows[0] : null
      });

      if (retryRows && retryRows.length > 0) {
        console.log(`✅ [PROIECT-STATUS-EDIT] Retry reușit - folosesc datele fără filtru activ`);
        countRows.push(...retryRows);
      } else {
        console.error('❌ [PROIECT-STATUS-EDIT] Nici retry-ul nu a găsit subproiecte');
        return;
      }
    }

    const stats = countRows[0];
    const totalSubproiecte = parseInt(stats.total_subproiecte) || 0;
    const facturate = parseInt(stats.facturate) || 0;

    console.log(`📊 [PROIECT-STATUS-EDIT] Statistici subproiecte pentru ${proiectId}:`, {
      total: totalSubproiecte,
      facturate: facturate,
      nefacturate: totalSubproiecte - facturate,
      procent_facturate: totalSubproiecte > 0 ? ((facturate / totalSubproiecte) * 100).toFixed(2) + '%' : 'N/A',
      raw_total: stats.total_subproiecte,
      raw_facturate: stats.facturate
    });

    // PASUL 2: Determină statusul proiectului părinte
    let statusProiect = 'Nefacturat';

    if (totalSubproiecte === 0) {
      console.log(`ℹ️ [PROIECT-STATUS-EDIT] Proiect fără subproiecte - nu se modifică statusul`);
      return;
    } else if (facturate === totalSubproiecte) {
      statusProiect = 'Facturat';
      console.log(`✅ [PROIECT-STATUS-EDIT] TOATE subproiectele sunt facturate (${facturate}/${totalSubproiecte})`);
    } else if (facturate > 0) {
      statusProiect = 'Partial Facturat';
      console.log(`⚠️ [PROIECT-STATUS-EDIT] Doar UNELE subproiecte sunt facturate (${facturate}/${totalSubproiecte})`);
    } else {
      statusProiect = 'Nefacturat';
      console.log(`❌ [PROIECT-STATUS-EDIT] NICIUN subproiect nu e facturat (0/${totalSubproiecte})`);
    }

    console.log(`✅ [PROIECT-STATUS-EDIT] Status calculat pentru proiect ${proiectId}: "${statusProiect}"`);

    // ✅ PASUL 2.5: Citește Data_Start pentru partition key (Proiecte_v2 e partitioned)
    const proiectQuery = `
      SELECT Data_Start
      FROM ${TABLE_PROIECTE}
      WHERE ID_Proiect = @proiectId
    `;

    console.log(`🔍 [PROIECT-STATUS-EDIT] Citesc Data_Start pentru partition key:`, {
      query: proiectQuery,
      proiectId
    });

    const [proiectRows] = await bigquery.query({
      query: proiectQuery,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU'
    });

    if (!proiectRows || proiectRows.length === 0) {
      console.error(`❌ [PROIECT-STATUS-EDIT] Nu s-a găsit proiectul ${proiectId} în BigQuery`);
      return;
    }

    // ✅ Gestionare BigQuery DATE field ca obiect {value: "2025-09-10"}
    const dataStartRaw = proiectRows[0]?.Data_Start;
    const dataStart = dataStartRaw?.value || dataStartRaw;

    console.log(`📅 [PROIECT-STATUS-EDIT] Data_Start găsit pentru partition:`, {
      raw: dataStartRaw,
      processed: dataStart,
      type: typeof dataStart
    });

    if (!dataStart) {
      console.error(`❌ [PROIECT-STATUS-EDIT] Data_Start lipsă pentru proiect ${proiectId} - UPDATE nu poate continua`);
      return;
    }

    // PASUL 3: Actualizează statusul proiectului în BigQuery CU partition key
    const updateQuery = `
      UPDATE ${TABLE_PROIECTE}
      SET
        status_facturare = @statusFacturare,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Proiect = @proiectId
        AND Data_Start = DATE(@dataStart)
    `;

    console.log(`🔧 [DEBUG-EDIT] Parametri UPDATE proiect:`, {
      statusFacturare: statusProiect,
      proiectId: proiectId,
      dataStart: dataStart,
      query: updateQuery,
      table: TABLE_PROIECTE
    });

    console.log(`🔄 [PROIECT-STATUS-EDIT] Execut UPDATE pentru proiect CU partition key:`, {
      statusFacturare: statusProiect,
      proiectId,
      dataStart,
      table: TABLE_PROIECTE
    });

    await bigquery.query({
      query: updateQuery,
      params: {
        statusFacturare: statusProiect,
        proiectId,
        dataStart: dataStart
      },
      types: {
        statusFacturare: 'STRING',
        proiectId: 'STRING',
        dataStart: 'STRING'
      },
      location: 'EU'
    });

    console.log(`✅ [PROIECT-STATUS-EDIT] UPDATE executat cu succes CU partition key:`, {
      statusNou: statusProiect,
      proiectId,
      dataStart,
      partition_key_folosit: true,
      delay_aplicat_inainte: '500ms',
      context: 'edit_factura'
    });

    console.log(`✅ [PROIECT-STATUS-EDIT] Proiect ${proiectId} actualizat cu status_facturare = "${statusProiect}" (fix race condition + logging aplicat la editare)`);

  } catch (error) {
    console.error('❌ [PROIECT-STATUS-EDIT] Eroare la actualizarea statusului proiectului:', error);
    console.error('📋 [DEBUG-EDIT] Detalii eroare:', {
      proiectId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    // Nu oprește procesul - continuă cu editarea facturii
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 UPDATE factură - payload primit:', {
      facturaId: body.facturaId,
      hasLiniiFactura: !!body.liniiFactura,
      hasClientInfo: !!body.clientInfo,
      hasObservatii: !!body.observatii,
      hasEtapeFacturate: !!(body.etapeFacturate && body.etapeFacturate.length > 0),
      keys: Object.keys(body)
    });

    // ✅ VERIFICARE: Tip de update - simplu (doar status) sau complet (editare)
    const isSimpleStatusUpdate = body.status && !body.liniiFactura && !body.clientInfo;
    
    if (isSimpleStatusUpdate) {
      console.log('🔍 Simple status update pentru factura:', body.facturaId);
      return await handleSimpleStatusUpdate(body);
    } else {
      console.log('🔍 Complete edit update pentru factura:', body.facturaId);
      return await handleCompleteEditUpdate(body);
    }

  } catch (error) {
    console.error('❌ Eroare generală la actualizarea facturii:', error);
    return NextResponse.json(
      { 
        error: 'Eroare la actualizarea facturii',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}

// ✅ FUNCȚIE EXISTENTĂ: Update simplu doar pentru status (backward compatibility)
async function handleSimpleStatusUpdate(body: any) {
  const { facturaId, status, observatii } = body;

  if (!facturaId) {
    return NextResponse.json(
      { error: 'ID factură lipsă' },
      { status: 400 }
    );
  }

  console.log(`🔍 Simple update factură ${facturaId}: status=${status}`);

  const updateQuery = `
    UPDATE ${TABLE_FACTURI_GENERATE}
    SET 
      status = @status,
      data_actualizare = CURRENT_TIMESTAMP()
    WHERE id = @facturaId
  `;

  await bigquery.query({
    query: updateQuery,
    params: { 
      facturaId,
      status
    },
    types: {
      facturaId: 'STRING',
      status: 'STRING'
    },
    location: 'EU'
  });

  console.log(`✅ Factură ${facturaId} actualizată simplu: status=${status}`);

  return NextResponse.json({
    success: true,
    message: 'Factură actualizată cu succes'
  });
}

// ✅ MODIFICATĂ: Funcție pentru update statusuri etape la editare cu suport UPDATE/RESET Subproiecte
async function updateEtapeStatusuriLaEditare(etapeFacturate: EtapaFacturata[], facturaId: string, proiectId: string) {
  if (!etapeFacturate || etapeFacturate.length === 0) {
    console.log('🔍 [ETAPE-EDIT] Nu există etape de actualizat');
    return;
  }

  console.log(`🔍 [ETAPE-EDIT] Actualizare statusuri pentru ${etapeFacturate.length} etape din factura ${facturaId}`);

  try {
    // PASUL 1: Verifică dacă etapele sunt deja în EtapeFacturi pentru această factură
    const checkQuery = `
      SELECT etapa_id, anexa_id, tip_etapa, subproiect_id
      FROM ${TABLE_ETAPE_FACTURI}
      WHERE factura_id = @facturaId AND activ = true
    `;

    const [existingEtape] = await bigquery.query({
      query: checkQuery,
      params: { facturaId },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    console.log(`🔍 [ETAPE-EDIT] Găsite ${existingEtape.length} etape existente în EtapeFacturi pentru această factură`);

    // Creează set-uri pentru comparație
    const existingEtapeIds = new Set(existingEtape.map((etapa: any) => etapa.etapa_id || etapa.anexa_id));
    const noulEtapeIds = new Set(etapeFacturate.map(etapa => etapa.id));

    // PASUL 2: Dezactivează etapele care nu mai sunt în factură + RESET Subproiecte dacă e cazul
    const etapeDeDezactivat = existingEtape.filter((etapa: any) => {
      const etapaId = etapa.etapa_id || etapa.anexa_id;
      return !noulEtapeIds.has(etapaId);
    });

    // ✅ NOU: Set pentru tracking subproiecte care trebuie verificate pentru RESET
    const subproiecteDeVerificat = new Set<string>();

    for (const etapa of etapeDeDezactivat) {
      const etapaId = etapa.etapa_id || etapa.anexa_id;
      
      // Dezactivează din EtapeFacturi
      const deactivateQuery = `
        UPDATE ${TABLE_ETAPE_FACTURI}
        SET 
          activ = false,
          data_actualizare = CURRENT_TIMESTAMP(),
          actualizat_de = 'System_Edit'
        WHERE factura_id = @facturaId AND 
              (etapa_id = @etapaId OR anexa_id = @etapaId)
      `;

      await bigquery.query({
        query: deactivateQuery,
        params: { facturaId, etapaId },
        types: { facturaId: 'STRING', etapaId: 'STRING' },
        location: 'EU'
      });

      // Resetează status în tabelele principale
      if (etapa.tip_etapa === 'contract') {
        const resetContractQuery = `
          UPDATE ${TABLE_ETAPE_CONTRACT}
          SET 
            status_facturare = 'Nefacturat',
            factura_id = NULL,
            data_facturare = NULL,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Etapa = @etapaId
        `;

        await bigquery.query({
          query: resetContractQuery,
          params: { etapaId },
          types: { etapaId: 'STRING' },
          location: 'EU'
        });
      } else {
        const resetAnexaQuery = `
          UPDATE ${TABLE_ANEXE_CONTRACT}
          SET 
            status_facturare = 'Nefacturat',
            factura_id = NULL,
            data_facturare = NULL,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Anexa = @etapaId
        `;

        await bigquery.query({
          query: resetAnexaQuery,
          params: { etapaId },
          types: { etapaId: 'STRING' },
          location: 'EU'
        });
      }

      // ✅ NOU: Adaugă subproiectul pentru verificare RESET
      if (etapa.subproiect_id) {
        subproiecteDeVerificat.add(etapa.subproiect_id);
      }

      console.log(`🔍 [ETAPE-EDIT] Dezactivată etapa ${etapaId} din factură`);
    }

    // ✅ NOU: Verifică și RESET subproiecte dacă nu mai există alte facturi active
    for (const subproiectId of Array.from(subproiecteDeVerificat)) {
      console.log(`🔍 [SUBPROIECT-RESET] Verific subproiect ${subproiectId} pentru RESET...`);
      
      // Verifică dacă mai există alte facturi active pentru acest subproiect
      const checkOtherFacturiQuery = `
        SELECT COUNT(*) as count
        FROM ${TABLE_ETAPE_FACTURI}
        WHERE subproiect_id = @subproiectId 
          AND activ = true
      `;

      const [checkResult] = await bigquery.query({
        query: checkOtherFacturiQuery,
        params: { subproiectId },
        types: { subproiectId: 'STRING' },
        location: 'EU'
      });

      const alteleFacturiCount = parseInt(checkResult[0]?.count) || 0;
      
      console.log(`📊 [SUBPROIECT-RESET] Subproiect ${subproiectId}: ${alteleFacturiCount} facturi active rămase`);

      if (alteleFacturiCount === 0) {
        // Nu mai există alte facturi active → RESET la Nefacturat
        const resetSubproiectQuery = `
          UPDATE ${TABLE_SUBPROIECTE}
          SET
            status_facturare = 'Nefacturat',
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Subproiect = @subproiectId
        `;

        await bigquery.query({
          query: resetSubproiectQuery,
          params: { subproiectId },
          types: { subproiectId: 'STRING' },
          location: 'EU'
        });

        console.log(`✅ [SUBPROIECT-RESET] Subproiect ${subproiectId} resetat la Nefacturat (nu mai există facturi active)`);
      } else {
        console.log(`ℹ️ [SUBPROIECT-RESET] Subproiect ${subproiectId} păstrează status Facturat (mai există ${alteleFacturiCount} facturi active)`);
      }
    }

    // PASUL 3: Adaugă etapele noi + UPDATE Subproiecte
    const etapeDeAdaugat = etapeFacturate.filter(etapa => !existingEtapeIds.has(etapa.id));
    
    // ✅ NOU: Set pentru tracking subproiecte care trebuie actualizate la Facturat
    const subproiecteDeActualizat = new Set<string>();

    for (const etapa of etapeDeAdaugat) {
      const etapaFacturaId = `EF_EDIT_${facturaId}_${etapa.id}_${Date.now()}`;
      
      const insertQuery = `
        INSERT INTO ${TABLE_ETAPE_FACTURI}
        (id, proiect_id, etapa_id, anexa_id, tip_etapa, subproiect_id, factura_id,
         valoare, moneda, valoare_ron, curs_valutar, data_curs_valutar, procent_din_etapa,
         data_facturare, status_incasare, valoare_incasata, activ, versiune, data_creare, creat_de)
        VALUES (
          @etapaFacturaId,
          @proiectId,
          @etapaId,
          @anexaId,
          @tipEtapa,
          @subproiectId,
          @facturaId,
          @valoare,
          @moneda,
          @valoareRon,
          @cursValutar,
          DATE(@dataCursValutar),
          @procentDinEtapa,
          DATE(@dataFacturare),
          @statusIncasare,
          @valoareIncasata,
          @activ,
          @versiune,
          CURRENT_TIMESTAMP(),
          @creatDe
        )
      `;

      const params = {
        etapaFacturaId: etapaFacturaId,
        proiectId: proiectId,
        etapaId: etapa.tip === 'etapa_contract' ? etapa.id : null,
        anexaId: etapa.tip === 'etapa_anexa' ? etapa.id : null,
        tipEtapa: etapa.tip === 'etapa_contract' ? 'contract' : 'anexa',
        subproiectId: etapa.subproiect_id || null,
        facturaId: facturaId,
        valoare: etapa.valoare || 0,
        moneda: etapa.moneda || 'RON',
        valoareRon: etapa.valoare_ron || etapa.valoare || 0,
        cursValutar: etapa.curs_valutar || 1,
        dataCursValutar: new Date().toISOString().split('T')[0],
        procentDinEtapa: 100.0,
        dataFacturare: new Date().toISOString().split('T')[0],
        statusIncasare: 'Neincasat',
        valoareIncasata: 0,
        activ: true,
        versiune: 2,
        creatDe: 'System_Edit'
      };

      const types = {
        etapaFacturaId: 'STRING',
        proiectId: 'STRING',
        etapaId: 'STRING',
        anexaId: 'STRING',
        tipEtapa: 'STRING',
        subproiectId: 'STRING',
        facturaId: 'STRING',
        valoare: 'NUMERIC',
        moneda: 'STRING',
        valoareRon: 'NUMERIC',
        cursValutar: 'NUMERIC',
        dataCursValutar: 'STRING',
        procentDinEtapa: 'NUMERIC',
        dataFacturare: 'STRING',
        statusIncasare: 'STRING',
        valoareIncasata: 'NUMERIC',
        activ: 'BOOL',
        versiune: 'INT64',
        creatDe: 'STRING'
      };

      await bigquery.query({
        query: insertQuery,
        params: params,
        types: types,
        location: 'EU'
      });

      // Actualizează statusul în tabelele principale
      if (etapa.tip === 'etapa_contract') {
        const updateContractQuery = `
          UPDATE ${TABLE_ETAPE_CONTRACT}
          SET 
            status_facturare = 'Facturat',
            factura_id = @facturaId,
            data_facturare = DATE(@dataFacturare),
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Etapa = @etapaId
        `;

        await bigquery.query({
          query: updateContractQuery,
          params: { 
            facturaId: facturaId,
            dataFacturare: new Date().toISOString().split('T')[0],
            etapaId: etapa.id 
          },
          types: {
            facturaId: 'STRING',
            dataFacturare: 'STRING',
            etapaId: 'STRING'
          },
          location: 'EU'
        });
      } else {
        const updateAnexaQuery = `
          UPDATE ${TABLE_ANEXE_CONTRACT}
          SET 
            status_facturare = 'Facturat',
            factura_id = @facturaId,
            data_facturare = DATE(@dataFacturare),
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Anexa = @etapaId
        `;

        await bigquery.query({
          query: updateAnexaQuery,
          params: { 
            facturaId: facturaId,
            dataFacturare: new Date().toISOString().split('T')[0],
            etapaId: etapa.id 
          },
          types: {
            facturaId: 'STRING',
            dataFacturare: 'STRING',
            etapaId: 'STRING'
          },
          location: 'EU'
        });
      }

      // ✅ NOU: Adaugă subproiectul pentru actualizare la Facturat
      if (etapa.subproiect_id) {
        subproiecteDeActualizat.add(etapa.subproiect_id);
      }

      console.log(`✅ [ETAPE-EDIT] Inserată etapa nouă ${etapa.id} în EtapeFacturi`);
    }

    // ✅ NOU: UPDATE Subproiecte la Facturat pentru etapele noi adăugate
    for (const subproiectId of Array.from(subproiecteDeActualizat)) {
      console.log(`🔷 [SUBPROIECT-UPDATE] UPDATE status_facturare pentru subproiect: ${subproiectId}`);
      
      const updateSubproiectQuery = `
        UPDATE ${TABLE_SUBPROIECTE}
        SET
          status_facturare = 'Facturat',
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE ID_Subproiect = @subproiectId
      `;

      await bigquery.query({
        query: updateSubproiectQuery,
        params: { subproiectId },
        types: { subproiectId: 'STRING' },
        location: 'EU'
      });

      console.log(`✅ [SUBPROIECT-UPDATE] Subproiect ${subproiectId} marcat ca Facturat`);
    }

    console.log(`✅ [ETAPE-EDIT] Statusuri etape actualizate cu succes: ${etapeDeDezactivat.length} dezactivate, ${etapeDeAdaugat.length} adăugate`);
    console.log(`✅ [SUBPROIECTE-EDIT] Subproiecte actualizate: ${subproiecteDeVerificat.size} verificate pentru RESET, ${subproiecteDeActualizat.size} marcate ca Facturat`);

    // ✅ NOU: Delay 500ms + Actualizare status proiect părinte
    if (subproiecteDeVerificat.size > 0 || subproiecteDeActualizat.size > 0) {
      console.log(`⏳ [DELAY-EDIT] Aștept 500ms pentru propagarea modificărilor BigQuery...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`✅ [DELAY-EDIT] Delay completat, continui cu actualizarea proiectului părinte`);

      console.log(`📋 [PROIECT-STATUS-EDIT] Actualizez proiect părinte după editarea facturii: ${proiectId}...`);
      await updateProiectStatusFacturare(proiectId);
    }

  } catch (error) {
    console.error('❌ [ETAPE-EDIT] Eroare la actualizarea statusurilor:', error);
    // Nu oprește procesul - continuă cu editarea facturii
  }
}

// ✅ FUNCȚIE NOUĂ: Update complet pentru editare factură cu suport etape + UPDATE Proiect
async function handleCompleteEditUpdate(body: any) {
  const { 
    facturaId,
    liniiFactura,
    clientInfo,
    observatii,
    cursuriUtilizate,
    proiectInfo,
    setariFacturare,
    contariBancare,
    etapeFacturate
  } = body;

  if (!facturaId) {
    return NextResponse.json(
      { error: 'ID factură lipsă pentru editare completă' },
      { status: 400 }
    );
  }

  if (!liniiFactura || !Array.isArray(liniiFactura)) {
    return NextResponse.json(
      { error: 'Liniile facturii sunt obligatorii pentru editare' },
      { status: 400 }
    );
  }

  if (!clientInfo || !clientInfo.denumire || !clientInfo.cui) {
    return NextResponse.json(
      { error: 'Informațiile clientului (denumire, CUI) sunt obligatorii' },
      { status: 400 }
    );
  }

  console.log(`🔍 Complete edit pentru factură ${facturaId}:`, {
    linii_count: liniiFactura.length,
    client: clientInfo.denumire,
    has_cursuri: !!cursuriUtilizate,
    has_proiect_info: !!proiectInfo,
    etape_facturate_count: etapeFacturate?.length || 0
  });

  // ✅ CALCULEAZĂ totalurile din liniile facturii
  const totals = calculateTotalsFromLines(liniiFactura);
  
  console.log('💰 Totaluri calculate din linii:', totals);

  // ✅ CONSTRUIEȘTE date_complete_json actualizat cu cursuri noi ȘI etape
  const dateCompleteActualizate = {
    liniiFactura: liniiFactura.map((linie: any) => ({
      denumire: linie.denumire || '',
      cantitate: Number(linie.cantitate) || 1,
      pretUnitar: typeof linie.pretUnitar === 'string' ? 
        parseFloat(linie.pretUnitar) : Number(linie.pretUnitar) || 0,
      cotaTva: Number(linie.cotaTva) || 21,
      tip: linie.tip || 'produs',
      subproiect_id: linie.subproiect_id || null,
      etapa_id: linie.etapa_id || null,
      anexa_id: linie.anexa_id || null,
      contract_id: linie.contract_id || null,
      contract_numar: linie.contract_numar || null,
      contract_data: linie.contract_data || null,
      anexa_numar: linie.anexa_numar || null,
      anexa_data: linie.anexa_data || null,
      monedaOriginala: linie.monedaOriginala || 'RON',
      valoareOriginala: linie.valoareOriginala || null,
      cursValutar: linie.cursValutar || 1
    })),
    
    observatii: observatii || '',
    
    clientInfo: {
      nume: clientInfo.denumire || clientInfo.nume,
      denumire: clientInfo.denumire || clientInfo.nume,
      cui: clientInfo.cui || '',
      nr_reg_com: clientInfo.nrRegCom || clientInfo.nr_reg_com || '',
      adresa: clientInfo.adresa || '',
      telefon: clientInfo.telefon || '',
      email: clientInfo.email || ''
    },
    
    proiectInfo: proiectInfo || {
      id: 'UPDATED',
      ID_Proiect: 'UPDATED',
      denumire: 'Proiect actualizat'
    },
    
    cursuriUtilizate: cursuriUtilizate || {},
    
    setariFacturare: setariFacturare || {},
    
    contariBancare: contariBancare || [],
    
    etapeFacturate: etapeFacturate || [],
    
    // ✅ METADATA pentru tracking
    isUpdated: true,
    dataUltimeiActualizari: new Date().toISOString(),
    versiune: 4, // ✅ Versiune nouă cu UPDATE Proiect la editare
    sistem_etape_implementat: true,
    update_proiect_status: true, // ✅ NOU: Flag pentru UPDATE proiect
    tip_editare: 'complet_cu_etape_si_proiect'
  };

  // ✅ GENEREAZĂ nota cursuri pentru observații
  const notaCursuri = generateCurrencyNote(cursuriUtilizate || {});
  
  // ✅ UPDATE COMPLET în BigQuery cu toate câmpurile
  const updateCompleteQuery = `
    UPDATE ${TABLE_FACTURI_GENERATE}
    SET 
      client_nume = @client_nume,
      client_cui = @client_cui,
      subtotal = @subtotal,
      total_tva = @total_tva,
      total = @total,
      date_complete_json = @date_complete_json,
      data_actualizare = CURRENT_TIMESTAMP()
    WHERE id = @facturaId
  `;

  await bigquery.query({
    query: updateCompleteQuery,
    params: { 
      facturaId,
      client_nume: clientInfo.denumire || clientInfo.nume,
      client_cui: clientInfo.cui,
      subtotal: totals.subtotal,
      total_tva: totals.totalTva,
      total: totals.totalGeneral,
      date_complete_json: JSON.stringify(dateCompleteActualizate)
    },
    types: {
      facturaId: 'STRING',
      client_nume: 'STRING',
      client_cui: 'STRING',
      subtotal: 'NUMERIC',
      total_tva: 'NUMERIC',
      total: 'NUMERIC',
      date_complete_json: 'STRING'
    },
    location: 'EU'
  });

  // ✅ MODIFICAT: Actualizează statusurile etapelor dacă există (include delay + UPDATE Proiect)
  if (etapeFacturate && etapeFacturate.length > 0 && proiectInfo?.id) {
    console.log(`🔍 [ETAPE-EDIT] Actualizez statusurile pentru ${etapeFacturate.length} etape...`);
    
    try {
      await updateEtapeStatusuriLaEditare(etapeFacturate, facturaId, proiectInfo.id);
      console.log('✅ [ETAPE-EDIT] Statusuri etape + subproiecte + proiect actualizate cu succes');
    } catch (etapeError) {
      console.error('❌ [ETAPE-EDIT] Eroare la actualizarea statusurilor etapelor:', etapeError);
      // Nu oprește procesul - continuă cu editarea facturii
    }
  } else {
    console.log('🔍 [ETAPE-EDIT] Nu există etape pentru actualizare statusuri sau lipsește proiectInfo');
  }

  console.log(`✅ Factură ${facturaId} actualizată complet:`, {
    client: clientInfo.denumire,
    subtotal: totals.subtotal,
    total_tva: totals.totalTva,
    total: totals.totalGeneral,
    linii_factura: liniiFactura.length,
    cursuri_count: Object.keys(cursuriUtilizate || {}).length,
    etape_count: etapeFacturate?.length || 0,
    update_proiect_aplicat: !!(etapeFacturate && etapeFacturate.length > 0 && proiectInfo?.id)
  });

  return NextResponse.json({
    success: true,
    message: 'Factură editată și salvată cu succes (cu suport etape contracte + UPDATE proiect)',
    data: {
      facturaId,
      totals,
      linii_count: liniiFactura.length,
      cursuri_utilizate: Object.keys(cursuriUtilizate || {}).length,
      client_actualizat: clientInfo.denumire,
      etape_actualizate: etapeFacturate?.length || 0,
      sistem_etape_activ: true,
      update_proiect_status: true, // ✅ NOU
      fixes_applied: [
        '500ms delay între UPDATE subproiecte și UPDATE proiect',
        'RESET logic pentru subproiecte fără facturi active',
        'Verificare alte facturi înainte de RESET',
        'Logging avansat pentru debugging',
        'Race condition fix aplicat'
      ]
    }
  });
}

// ✅ FUNCȚIE HELPER: Calculează totaluri din liniile facturii
function calculateTotalsFromLines(liniiFactura: any[]): {
  subtotal: number;
  totalTva: number;
  totalGeneral: number;
} {
  let subtotal = 0;
  let totalTva = 0;
  
  liniiFactura.forEach(linie => {
    const cantitate = Number(linie.cantitate) || 0;
    const pretUnitar = typeof linie.pretUnitar === 'string' ? 
      parseFloat(linie.pretUnitar) : Number(linie.pretUnitar) || 0;
    const cotaTva = Number(linie.cotaTva) || 0;
    
    const valoare = cantitate * pretUnitar;
    const tva = valoare * (cotaTva / 100);
    
    subtotal += valoare;
    totalTva += tva;
  });
  
  // ✅ Rotunjire la 2 zecimale pentru consistență
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalTva: Math.round(totalTva * 100) / 100,
    totalGeneral: Math.round((subtotal + totalTva) * 100) / 100
  };
}

// ✅ FUNCȚIE HELPER: Generează nota despre cursuri (cu precizie maximă)
function generateCurrencyNote(cursuriUtilizate: any): string {
  const monede = Object.keys(cursuriUtilizate);
  if (monede.length === 0) return '';
  
  return `\n\nCurs valutar BNR (actualizat la editare): ${monede.map(m => {
    const cursData = cursuriUtilizate[m];
    const cursNumeric = typeof cursData.curs === 'number' ? cursData.curs : parseFloat(cursData.curs || '1');
    
    // ✅ PĂSTREAZĂ precizia originală dacă există
    const cursFormatat = cursData.precizie_originala || cursNumeric.toFixed(4);
    
    return `1 ${m} = ${cursFormatat} RON (${cursData.data || 'N/A'})`;
  }).join(', ')}`;
}
