// ==================================================================
// CALEA: app/api/actions/invoices/update/route.ts
// DATA: 11.09.2025 20:30 (ora României)
// MODIFICAT: Suport complet pentru etape contracte + EtapeFacturi la editare
// PĂSTRATE: Toate funcționalitățile existente (Edit simplu + Edit complet)
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

console.log(`🔧 Invoice Update API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: FacturiGenerate${tableSuffix}, EtapeFacturi${tableSuffix}, EtapeContract${tableSuffix}, AnexeContract${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// NOUĂ: Interfață pentru etapele facturate (din frontend)
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📝 UPDATE factură - payload primit:', {
      facturaId: body.facturaId,
      hasLiniiFactura: !!body.liniiFactura,
      hasClientInfo: !!body.clientInfo,
      hasObservatii: !!body.observatii,
      hasEtapeFacturate: !!(body.etapeFacturate && body.etapeFacturate.length > 0), // NOUĂ
      keys: Object.keys(body)
    });

    // ✅ VERIFICARE: Tip de update - simplu (doar status) sau complet (editare)
    const isSimpleStatusUpdate = body.status && !body.liniiFactura && !body.clientInfo;
    
    if (isSimpleStatusUpdate) {
      console.log('📝 Simple status update pentru factura:', body.facturaId);
      return await handleSimpleStatusUpdate(body);
    } else {
      console.log('📝 Complete edit update pentru factura:', body.facturaId);
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

  console.log(`📝 Simple update factură ${facturaId}: status=${status}`);

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

// NOUĂ: Funcție pentru update statusuri etape la editare (similară cu generate-hibrid)
async function updateEtapeStatusuriLaEditare(etapeFacturate: EtapaFacturata[], facturaId: string, proiectId: string) {
  if (!etapeFacturate || etapeFacturate.length === 0) {
    console.log('📝 [ETAPE-EDIT] Nu există etape de actualizat');
    return;
  }

  console.log(`📝 [ETAPE-EDIT] Actualizare statusuri pentru ${etapeFacturate.length} etape din factura ${facturaId}`);

  try {
    // PASUL 1: Verifică dacă etapele sunt deja în EtapeFacturi pentru această factură
    const checkQuery = `
      SELECT etapa_id, anexa_id, tip_etapa 
      FROM ${TABLE_ETAPE_FACTURI}
      WHERE factura_id = @facturaId AND activ = true
    `;

    const [existingEtape] = await bigquery.query({
      query: checkQuery,
      params: { facturaId },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    console.log(`📝 [ETAPE-EDIT] Găsite ${existingEtape.length} etape existente în EtapeFacturi pentru această factură`);

    // Creează set-uri pentru comparație
    const existingEtapeIds = new Set(existingEtape.map((etapa: any) => etapa.etapa_id || etapa.anexa_id));
    const noulEtapeIds = new Set(etapeFacturate.map(etapa => etapa.id));

    // PASUL 2: Dezactivează etapele care nu mai sunt în factură
    const etapeDeDezactivat = existingEtape.filter((etapa: any) => {
      const etapaId = etapa.etapa_id || etapa.anexa_id;
      return !noulEtapeIds.has(etapaId);
    });

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

      console.log(`📝 [ETAPE-EDIT] Dezactivată etapa ${etapaId} din factură`);
    }

    // PASUL 3: Adaugă etapele noi
    const etapeDeAdaugat = etapeFacturate.filter(etapa => !existingEtapeIds.has(etapa.id));

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
        versiune: 2, // Versiune edit
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

      console.log(`✅ [ETAPE-EDIT] Inserată etapa nouă ${etapa.id} în EtapeFacturi`);
    }

    console.log(`✅ [ETAPE-EDIT] Statusuri etape actualizate cu succes: ${etapeDeDezactivat.length} dezactivate, ${etapeDeAdaugat.length} adăugate`);

  } catch (error) {
    console.error('❌ [ETAPE-EDIT] Eroare la actualizarea statusurilor:', error);
    // Nu oprește procesul - continuă cu editarea facturii
  }
}

// ✅ FUNCȚIE NOUĂ: Update complet pentru editare factură cu suport etape
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
    etapeFacturate // NOUĂ: Array cu etapele facturate
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

  console.log(`📝 Complete edit pentru factură ${facturaId}:`, {
    linii_count: liniiFactura.length,
    client: clientInfo.denumire,
    has_cursuri: !!cursuriUtilizate,
    has_proiect_info: !!proiectInfo,
    etape_facturate_count: etapeFacturate?.length || 0 // NOUĂ
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
      cotaTva: Number(linie.cotaTva) || 21, // ✅ Default 21%
      tip: linie.tip || 'produs',
      subproiect_id: linie.subproiect_id || null,
      // NOUĂ: Suport pentru etape
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
      nume: clientInfo.denumire || clientInfo.nume, // ✅ Support dual
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
    
    // NOUĂ: Etapele facturate pentru tracking
    etapeFacturate: etapeFacturate || [],
    
    // ✅ METADATA pentru tracking
    isUpdated: true,
    dataUltimeiActualizari: new Date().toISOString(),
    versiune: 3, // ✅ Versiune pentru tracking cu etape
    sistem_etape_implementat: true, // ✅ Flag pentru noul sistem
    tip_editare: 'complet_cu_etape'
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

  // NOUĂ: Actualizează statusurile etapelor dacă există
  if (etapeFacturate && etapeFacturate.length > 0 && proiectInfo?.id) {
    console.log(`📝 [ETAPE-EDIT] Actualizez statusurile pentru ${etapeFacturate.length} etape...`);
    
    try {
      await updateEtapeStatusuriLaEditare(etapeFacturate, facturaId, proiectInfo.id);
      console.log('✅ [ETAPE-EDIT] Statusuri etape actualizate cu succes');
    } catch (etapeError) {
      console.error('❌ [ETAPE-EDIT] Eroare la actualizarea statusurilor etapelor:', etapeError);
      // Nu oprește procesul - continuă cu editarea facturii
    }
  } else {
    console.log('📝 [ETAPE-EDIT] Nu există etape pentru actualizare statusuri sau lipsește proiectInfo');
  }

  console.log(`✅ Factură ${facturaId} actualizată complet:`, {
    client: clientInfo.denumire,
    subtotal: totals.subtotal,
    total_tva: totals.totalTva,
    total: totals.totalGeneral,
    linii_factura: liniiFactura.length,
    cursuri_count: Object.keys(cursuriUtilizate || {}).length,
    etape_count: etapeFacturate?.length || 0 // NOUĂ
  });

  return NextResponse.json({
    success: true,
    message: 'Factură editată și salvată cu succes (cu suport etape contracte)',
    data: {
      facturaId,
      totals,
      linii_count: liniiFactura.length,
      cursuri_utilizate: Object.keys(cursuriUtilizate || {}).length,
      client_actualizat: clientInfo.denumire,
      etape_actualizate: etapeFacturate?.length || 0, // NOUĂ
      sistem_etape_activ: true // NOUĂ
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
