// ==================================================================
// CALEA: app/api/actions/invoices/update/route.ts
// DATA: 11.08.2025 18:10
// MODIFICAT: Salvare completă pentru Edit factură - toate câmpurile + date_complete_json
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📝 UPDATE factură - payload primit:', {
      facturaId: body.facturaId,
      hasLiniiFactura: !!body.liniiFactura,
      hasClientInfo: !!body.clientInfo,
      hasObservatii: !!body.observatii,
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
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
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

// ✅ FUNCȚIE NOUĂ: Update complet pentru editare factură
async function handleCompleteEditUpdate(body: any) {
  const { 
    facturaId,
    liniiFactura,
    clientInfo,
    observatii,
    cursuriUtilizate,
    proiectInfo,
    setariFacturare,
    contariBancare
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
    has_proiect_info: !!proiectInfo
  });

  // ✅ CALCULEAZĂ totalurile din liniile facturii
  const totals = calculateTotalsFromLines(liniiFactura);
  
  console.log('💰 Totaluri calculate din linii:', totals);

  // ✅ CONSTRUIEȘTE date_complete_json actualizat cu cursuri noi
  const dateCompleteActualizate = {
    liniiFactura: liniiFactura.map((linie: any) => ({
      denumire: linie.denumire || '',
      cantitate: Number(linie.cantitate) || 1,
      pretUnitar: typeof linie.pretUnitar === 'string' ? 
        parseFloat(linie.pretUnitar) : Number(linie.pretUnitar) || 0,
      cotaTva: Number(linie.cotaTva) || 21, // ✅ Default 21%
      tip: linie.tip || 'produs',
      subproiect_id: linie.subproiect_id || null,
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
    
    // ✅ METADATA pentru tracking
    isUpdated: true,
    dataUltimeiActualizari: new Date().toISOString(),
    versiune: 2 // ✅ Versiune pentru tracking
  };

  // ✅ GENEREAZĂ nota cursuri pentru observații
  const notaCursuri = generateCurrencyNote(cursuriUtilizate || {});
  
  // ✅ UPDATE COMPLET în BigQuery cu toate câmpurile
  const updateCompleteQuery = `
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
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

  console.log(`✅ Factură ${facturaId} actualizată complet:`, {
    client: clientInfo.denumire,
    subtotal: totals.subtotal,
    total_tva: totals.totalTva,
    total: totals.totalGeneral,
    linii_factura: liniiFactura.length,
    cursuri_count: Object.keys(cursuriUtilizate || {}).length
  });

  return NextResponse.json({
    success: true,
    message: 'Factură editată și salvată cu succes',
    data: {
      facturaId,
      totals,
      linii_count: liniiFactura.length,
      cursuri_utilizate: Object.keys(cursuriUtilizate || {}).length,
      client_actualizat: clientInfo.denumire
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
  
  return `\n\nCurs valutar BNR (actualizat): ${monede.map(m => {
    const cursData = cursuriUtilizate[m];
    const cursNumeric = typeof cursData.curs === 'number' ? cursData.curs : parseFloat(cursData.curs || '1');
    
    // ✅ PĂSTREAZĂ precizia originală dacă există
    const cursFormatat = cursData.precizie_originala || cursNumeric.toFixed(4);
    
    return `1 ${m} = ${cursFormatat} RON (${cursData.data || 'N/A'})`;
  }).join(', ')}`;
}
