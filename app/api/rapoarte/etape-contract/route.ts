// ==================================================================
// CALEA: app/api/rapoarte/etape-contract/route.ts
// DATA: 06.09.2025 17:50 (ora României)
// DESCRIERE: API pentru managementul etapelor contractului cu status tracking
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE = `EtapeContract${tableSuffix}`;

// ✅ Tabelă cu suffix dinamic
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;

console.log(`🔧 EtapeContract API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: EtapeContract${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper pentru conversie BigQuery NUMERIC
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const extractedValue = value.value;
    if (typeof extractedValue === 'object' && extractedValue !== null) {
      return convertBigQueryNumeric(extractedValue);
    }
    const numericValue = parseFloat(String(extractedValue)) || 0;
    return numericValue;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return 0;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? 0 : value;
  }
  
  if (typeof value === 'bigint') {
    return Number(value);
  }
  
  try {
    const stringValue = String(value);
    const parsed = parseFloat(stringValue);
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    return 0;
  }
};

// Helper pentru parsarea datelor BigQuery
const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  
  try {
    let dateString = dateValue;
    
    if (typeof dateValue === 'object' && dateValue !== null && 'value' in dateValue) {
      dateString = dateValue.value;
    }
    
    if (!dateString) return null;
    
    const cleanDateString = dateString.toString().replace(/\s+UTC\s*$/, '').trim();
    const parsedDate = new Date(cleanDateString);
    
    if (isNaN(parsedDate.getTime())) {
      return null;
    }
    
    return parsedDate.toISOString();
  } catch (error) {
    console.error('[ETAPE-CONTRACT] Eroare la parsarea datei:', dateValue, error);
    return null;
  }
};

// Helper pentru formatarea datei pentru afișare
const formatDate = (date?: string | { value: string }): string => {
  if (!date) return '';
  const dateValue = typeof date === 'string' ? date : date.value;
  try {
    const cleanDate = dateValue.toString().replace(/\s+UTC\s*$/, '').trim();
    return new Date(cleanDate).toLocaleDateString('ro-RO');
  } catch {
    return '';
  }
};

// Helper pentru escape SQL strings
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper pentru formatarea datelor SQL
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '') {
    return 'NULL';
  }
  
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  
  return 'NULL';
};

// GET - Listare etape pentru un contract
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contract_id');
    const etapaId = searchParams.get('etapa_id');

    console.log('[ETAPE-CONTRACT] GET cu parametrii:', { contractId, etapaId });

    let query = `
      SELECT 
        e.*,
        c.numar_contract,
        c.client_nume,
        s.Denumire as subproiect_denumire
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` e
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\` c
        ON e.contract_id = c.ID_Contract
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\` s
        ON e.subproiect_id = s.ID_Subproiect
      WHERE e.activ = true
    `;
    
    const params: any = {};
    const types: any = {};

    if (contractId) {
      query += ' AND e.contract_id = @contractId';
      params.contractId = contractId;
      types.contractId = 'STRING';
    }

    if (etapaId) {
      query += ' AND e.ID_Etapa = @etapaId';
      params.etapaId = etapaId;
      types.etapaId = 'STRING';
    }

    query += ' ORDER BY e.etapa_index ASC';

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`[ETAPE-CONTRACT] Găsite ${rows.length} etape`);

    // Procesează rezultatele cu conversie îmbunătățită
    const etapeProcesate = rows.map((etapa: any) => {
      return {
        ID_Etapa: etapa.ID_Etapa,
        contract_id: etapa.contract_id,
        etapa_index: etapa.etapa_index,
        denumire: etapa.denumire,
        valoare: convertBigQueryNumeric(etapa.valoare),
        moneda: etapa.moneda,
        valoare_ron: convertBigQueryNumeric(etapa.valoare_ron),
        termen_zile: etapa.termen_zile,
        subproiect_id: etapa.subproiect_id,
        factura_id: etapa.factura_id,
        status_facturare: etapa.status_facturare,
        status_incasare: etapa.status_incasare,
        data_scadenta: formatDate(etapa.data_scadenta),
        data_facturare: formatDate(etapa.data_facturare),
        data_incasare: formatDate(etapa.data_incasare),
        data_creare: parseDate(etapa.data_creare),
        data_actualizare: parseDate(etapa.data_actualizare),
        curs_valutar: convertBigQueryNumeric(etapa.curs_valutar),
        data_curs_valutar: formatDate(etapa.data_curs_valutar),
        procent_din_total: convertBigQueryNumeric(etapa.procent_din_total),
        observatii: etapa.observatii,
        // Metadata din JOIN-uri
        numar_contract: etapa.numar_contract,
        client_nume: etapa.client_nume,
        subproiect_denumire: etapa.subproiect_denumire,
        este_din_subproiect: !!etapa.subproiect_id,
        este_manuala: !etapa.subproiect_id
      };
    });

    return NextResponse.json({
      success: true,
      data: etapeProcesate,
      count: etapeProcesate.length,
      message: contractId ? 
        `${etapeProcesate.length} etape găsite pentru contractul ${contractId}` :
        `${etapeProcesate.length} etape încărcate`
    });

  } catch (error) {
    console.error('[ETAPE-CONTRACT] Eroare la încărcarea etapelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea etapelor contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Creare etape din contract (folosit la generarea contractului)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, etape } = body;

    if (!contract_id || !etape || !Array.isArray(etape)) {
      return NextResponse.json({ 
        success: false,
        error: 'contract_id și array-ul etape sunt obligatorii' 
      }, { status: 400 });
    }

    console.log(`[ETAPE-CONTRACT] POST creare ${etape.length} etape pentru contractul ${contract_id}`);

    // Șterge etapele existente pentru acest contract
    const deleteQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET activ = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE contract_id = '${escapeString(contract_id)}'
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    // Inserează noile etape
    const insertPromises = etape.map((etapa: any, index: number) => {
      const etapaId = `ETAPA_${contract_id}_${index + 1}_${Date.now()}`;
      
      const insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.${TABLE}\`
        (ID_Etapa, contract_id, etapa_index, denumire, valoare, moneda, 
         valoare_ron, termen_zile, subproiect_id, status_facturare, status_incasare,
         data_scadenta, curs_valutar, data_curs_valutar, procent_din_total, 
         observatii, activ, data_creare)
        VALUES (
          '${escapeString(etapaId)}',
          '${escapeString(contract_id)}',
          ${index + 1},
          '${escapeString(etapa.denumire || `Etapa ${index + 1}`)}',
          ${etapa.valoare || 0},
          '${escapeString(etapa.moneda || 'RON')}',
          ${etapa.valoare_ron || etapa.valoare || 0},
          ${etapa.termen_zile || 30},
          ${etapa.subproiect_id ? `'${escapeString(etapa.subproiect_id)}'` : 'NULL'},
          'Nefacturat',
          'Neîncasat',
          ${etapa.data_scadenta ? formatDateLiteral(etapa.data_scadenta) : 'NULL'},
          ${etapa.curs_valutar || 'NULL'},
          ${etapa.data_curs_valutar ? formatDateLiteral(etapa.data_curs_valutar) : 'NULL'},
          ${etapa.procent_calculat || 0},
          ${etapa.observatii ? `'${escapeString(etapa.observatii)}'` : 'NULL'},
          true,
          CURRENT_TIMESTAMP()
        )
      `;

      return bigquery.query({
        query: insertQuery,
        location: 'EU',
      });
    });

    await Promise.all(insertPromises);

    console.log(`[ETAPE-CONTRACT] ✅ Create ${etape.length} etape pentru contractul ${contract_id}`);

    return NextResponse.json({
      success: true,
      message: `${etape.length} etape create cu succes`,
      data: { contract_id, etape_count: etape.length }
    });

  } catch (error) {
    console.error('[ETAPE-CONTRACT] Eroare la crearea etapelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la crearea etapelor contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizare etapă (status facturat/încasat, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ID_Etapa, ...updateData } = body;

    if (!ID_Etapa) {
      return NextResponse.json({ 
        success: false,
        error: 'ID_Etapa necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log(`[ETAPE-CONTRACT] PUT actualizare etapa ${ID_Etapa}:`, updateData);

    // Construiește query-ul UPDATE dinamic
    const updateFields: string[] = [];

    const allowedFields = [
      'denumire', 'valoare', 'moneda', 'valoare_ron', 'termen_zile',
      'status_facturare', 'status_incasare', 'factura_id',
      'data_scadenta', 'data_facturare', 'data_incasare',
      'curs_valutar', 'data_curs_valutar', 'procent_din_total', 'observatii'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        if (['data_scadenta', 'data_facturare', 'data_incasare', 'data_curs_valutar'].includes(key)) {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else if (typeof value === 'string') {
          updateFields.push(`${key} = '${escapeString(value)}'`);
        } else if (typeof value === 'number') {
          updateFields.push(`${key} = ${value}`);
        } else {
          updateFields.push(`${key} = '${escapeString(value.toString())}'`);
        }
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    updateFields.push('data_actualizare = CURRENT_TIMESTAMP()');

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Etapa = '${escapeString(ID_Etapa)}' AND activ = true
    `;

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log(`[ETAPE-CONTRACT] ✅ Etapa ${ID_Etapa} actualizată cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Etapa actualizată cu succes',
      updated_fields: Object.keys(updateData).filter(k => k !== 'ID_Etapa')
    });

  } catch (error) {
    console.error('[ETAPE-CONTRACT] Eroare la actualizarea etapei:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea etapei',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Ștergere etapă (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const etapaId = searchParams.get('id');

    if (!etapaId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID etapă obligatoriu' 
      }, { status: 400 });
    }

    console.log(`[ETAPE-CONTRACT] DELETE etapa ${etapaId}`);

    // Soft delete prin marcarea ca inactiv
    const deleteQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET 
        activ = false,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Etapa = '${escapeString(etapaId)}'
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`[ETAPE-CONTRACT] ✅ Etapa ${etapaId} marcată ca inactivă`);

    return NextResponse.json({
      success: true,
      message: 'Etapa ștearsă cu succes'
    });

  } catch (error) {
    console.error('[ETAPE-CONTRACT] Eroare la ștergerea etapei:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea etapei',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
