// ==================================================================
// CALEA: app/api/rapoarte/anexe-contract/route.ts
// DATA: 07.09.2025 16:05 (ora României)
// DESCRIERE: API pentru managementul anexelor la contracte cu structură similară EtapeContract
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const TABLE = 'AnexeContract';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper pentru conversie BigQuery NUMERIC - PĂSTRAT identic
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

// Helper pentru parsarea datelor BigQuery - PĂSTRAT identic
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
    console.error('[ANEXE-CONTRACT] Eroare la parsarea datei:', dateValue, error);
    return null;
  }
};

// Helper pentru formatarea datei pentru afișare - PĂSTRAT identic
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

// Helper pentru escape SQL strings - PĂSTRAT identic
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper pentru formatarea datelor SQL - PĂSTRAT identic
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

// GET - Listare anexe pentru un contract
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contract_id');
    const anexaId = searchParams.get('anexa_id');
    const anexaNumar = searchParams.get('anexa_numar');

    console.log('[ANEXE-CONTRACT] GET cu parametrii:', { contractId, anexaId, anexaNumar });

    let query = `
      SELECT 
        a.*,
        c.numar_contract,
        c.client_nume,
        s.Denumire as subproiect_denumire
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` a
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Contracte\` c 
        ON a.contract_id = c.ID_Contract
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte\` s 
        ON a.subproiect_id = s.ID_Subproiect
      WHERE a.activ = true
    `;
    
    const params: any = {};
    const types: any = {};

    if (contractId) {
      query += ' AND a.contract_id = @contractId';
      params.contractId = contractId;
      types.contractId = 'STRING';
    }

    if (anexaId) {
      query += ' AND a.ID_Anexa = @anexaId';
      params.anexaId = anexaId;
      types.anexaId = 'STRING';
    }

    if (anexaNumar) {
      query += ' AND a.anexa_numar = @anexaNumar';
      params.anexaNumar = parseInt(anexaNumar);
      types.anexaNumar = 'INT64';
    }

    query += ' ORDER BY a.anexa_numar ASC, a.etapa_index ASC';

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`[ANEXE-CONTRACT] Găsite ${rows.length} etape anexă`);

    // Procesează rezultatele cu conversie îmbunătățită
    const anexeProcesate = rows.map((anexa: any) => {
      return {
        ID_Anexa: anexa.ID_Anexa,
        contract_id: anexa.contract_id,
        proiect_id: anexa.proiect_id,
        anexa_numar: anexa.anexa_numar,
        etapa_index: anexa.etapa_index,
        denumire: anexa.denumire,
        valoare: convertBigQueryNumeric(anexa.valoare),
        moneda: anexa.moneda,
        valoare_ron: convertBigQueryNumeric(anexa.valoare_ron),
        termen_zile: anexa.termen_zile,
        subproiect_id: anexa.subproiect_id,
        factura_id: anexa.factura_id,
        status_facturare: anexa.status_facturare,
        status_incasare: anexa.status_incasare,
        data_scadenta: formatDate(anexa.data_scadenta),
        data_facturare: formatDate(anexa.data_facturare),
        data_incasare: formatDate(anexa.data_incasare),
        data_creare: parseDate(anexa.data_creare),
        data_actualizare: parseDate(anexa.data_actualizare),
        curs_valutar: convertBigQueryNumeric(anexa.curs_valutar),
        data_curs_valutar: formatDate(anexa.data_curs_valutar),
        procent_din_total: convertBigQueryNumeric(anexa.procent_din_total),
        observatii: anexa.observatii,
        // Metadata din JOIN-uri
        numar_contract: anexa.numar_contract,
        client_nume: anexa.client_nume,
        subproiect_denumire: anexa.subproiect_denumire,
        este_din_subproiect: !!anexa.subproiect_id,
        este_manuala: !anexa.subproiect_id
      };
    });

    return NextResponse.json({
      success: true,
      data: anexeProcesate,
      count: anexeProcesate.length,
      message: contractId ? 
        `${anexeProcesate.length} etape anexă găsite pentru contractul ${contractId}` :
        `${anexeProcesate.length} etape anexă încărcate`
    });

  } catch (error) {
    console.error('[ANEXE-CONTRACT] Eroare la încărcarea anexelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea anexelor contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Creare etape anexă din contract (folosit la generarea anexei)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, proiect_id, anexa_numar, etape } = body;

    if (!contract_id || !proiect_id || !anexa_numar || !etape || !Array.isArray(etape)) {
      return NextResponse.json({ 
        success: false,
        error: 'contract_id, proiect_id, anexa_numar și array-ul etape sunt obligatorii' 
      }, { status: 400 });
    }

    console.log(`[ANEXE-CONTRACT] POST creare ${etape.length} etape pentru anexa ${anexa_numar} la contractul ${contract_id}`);

    // Șterge etapele existente pentru această anexă
    const deleteQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET activ = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE contract_id = '${escapeString(contract_id)}' AND anexa_numar = ${anexa_numar}
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    // Inserează noile etape
    const insertPromises = etape.map((etapa: any, index: number) => {
      const anexaId = `ANEXA_${contract_id}_${anexa_numar}_${index + 1}_${Date.now()}`;
      
      const insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.${TABLE}\`
        (ID_Anexa, contract_id, proiect_id, anexa_numar, etapa_index, denumire, valoare, moneda, 
         valoare_ron, termen_zile, subproiect_id, status_facturare, status_incasare,
         data_scadenta, curs_valutar, data_curs_valutar, procent_din_total, 
         observatii, activ, data_creare)
        VALUES (
          '${escapeString(anexaId)}',
          '${escapeString(contract_id)}',
          '${escapeString(proiect_id)}',
          ${anexa_numar},
          ${index + 1},
          '${escapeString(etapa.denumire || `Etapa anexă ${index + 1}`)}',
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

    console.log(`[ANEXE-CONTRACT] ✅ Create ${etape.length} etape pentru anexa ${anexa_numar} la contractul ${contract_id}`);

    return NextResponse.json({
      success: true,
      message: `${etape.length} etape anexă create cu succes`,
      data: { contract_id, proiect_id, anexa_numar, etape_count: etape.length }
    });

  } catch (error) {
    console.error('[ANEXE-CONTRACT] Eroare la crearea etapelor anexă:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la crearea etapelor anexă',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizare etapă anexă (status facturat/încasat, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ID_Anexa, ...updateData } = body;

    if (!ID_Anexa) {
      return NextResponse.json({ 
        success: false,
        error: 'ID_Anexa necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log(`[ANEXE-CONTRACT] PUT actualizare anexa ${ID_Anexa}:`, updateData);

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
      WHERE ID_Anexa = '${escapeString(ID_Anexa)}' AND activ = true
    `;

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log(`[ANEXE-CONTRACT] ✅ Anexa ${ID_Anexa} actualizată cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Etapa anexă actualizată cu succes',
      updated_fields: Object.keys(updateData).filter(k => k !== 'ID_Anexa')
    });

  } catch (error) {
    console.error('[ANEXE-CONTRACT] Eroare la actualizarea anexei:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea etapei anexă',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Ștergere etapă anexă (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anexaId = searchParams.get('id');

    if (!anexaId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID anexă obligatoriu' 
      }, { status: 400 });
    }

    console.log(`[ANEXE-CONTRACT] DELETE anexa ${anexaId}`);

    // Soft delete prin marcarea ca inactiv
    const deleteQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET 
        activ = false,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Anexa = '${escapeString(anexaId)}'
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`[ANEXE-CONTRACT] ✅ Anexa ${anexaId} marcată ca inactivă`);

    return NextResponse.json({
      success: true,
      message: 'Etapa anexă ștearsă cu succes'
    });

  } catch (error) {
    console.error('[ANEXE-CONTRACT] Eroare la ștergerea anexei:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea etapei anexă',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
