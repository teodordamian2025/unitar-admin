// ==================================================================
// CALEA: app/api/rapoarte/contracte/route.ts
// DATA: 06.09.2025 18:00 (ora României)
// MODIFICAT: Eliminat câmpul etape JSON - folosește doar EtapeContract
// PĂSTRATE: Toate funcționalitățile existente + integrare EtapeContract
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const TABLE = 'Contracte';

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
    console.error('[CONTRACTE] Eroare la parsarea datei:', dateValue, error);
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

// Helper pentru parsarea JSON-ului BigQuery
const parseJsonField = (jsonString: any): any => {
  if (!jsonString) return null;
  
  try {
    if (typeof jsonString === 'string') {
      return JSON.parse(jsonString);
    }
    return jsonString;
  } catch (error) {
    console.error('[CONTRACTE] Eroare parsare JSON:', error);
    return null;
  }
};

// NOUĂ FUNCȚIE: Încărcarea etapelor din tabela EtapeContract
const loadEtapeContract = async (contractId: string) => {
  try {
    const etapeQuery = `
      SELECT 
        e.*,
        s.Denumire as subproiect_denumire
      FROM \`${PROJECT_ID}.${DATASET}.EtapeContract\` e
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte\` s 
        ON e.subproiect_id = s.ID_Subproiect
      WHERE e.contract_id = '${contractId}' 
        AND e.activ = true
      ORDER BY e.etapa_index ASC
    `;

    const [etapeRows] = await bigquery.query({
      query: etapeQuery,
      location: 'EU',
    });

    return etapeRows.map((etapa: any) => ({
      ID_Etapa: etapa.ID_Etapa,
      etapa_index: etapa.etapa_index,
      denumire: etapa.denumire,
      valoare: convertBigQueryNumeric(etapa.valoare),
      moneda: etapa.moneda,
      valoare_ron: convertBigQueryNumeric(etapa.valoare_ron),
      termen_zile: etapa.termen_zile,
      subproiect_id: etapa.subproiect_id,
      subproiect_denumire: etapa.subproiect_denumire,
      factura_id: etapa.factura_id,
      status_facturare: etapa.status_facturare,
      status_incasare: etapa.status_incasare,
      data_scadenta: formatDate(etapa.data_scadenta),
      data_facturare: formatDate(etapa.data_facturare),
      data_incasare: formatDate(etapa.data_incasare),
      curs_valutar: convertBigQueryNumeric(etapa.curs_valutar),
      procent_din_total: convertBigQueryNumeric(etapa.procent_din_total),
      observatii: etapa.observatii,
      este_din_subproiect: !!etapa.subproiect_id,
      este_manuala: !etapa.subproiect_id
    }));
  } catch (error) {
    console.error(`[CONTRACTE] Eroare la încărcarea etapelor pentru contractul ${contractId}:`, error);
    return [];
  }
};

// GET - Listare și căutare contracte (ACTUALIZAT cu etape din EtapeContract)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id');
    const clientId = searchParams.get('client_id') || searchParams.get('client');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('[CONTRACTE] GET contracte cu parametrii:', {
      proiectId,
      clientId,
      status,
      search,
      limit,
      offset
    });

    // Construirea query-ului dinamic
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    const types: any = {};

    if (proiectId) {
      whereClause += ' AND proiect_id = @proiectId';
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (clientId) {
      whereClause += ' AND client_id = @clientId';
      params.clientId = clientId;
      types.clientId = 'STRING';
    }

    if (status) {
      whereClause += ' AND Status = @status';
      params.status = status;
      types.status = 'STRING';
    }

    if (search) {
  whereClause += ` AND (
    LOWER(c.numar_contract) LIKE LOWER(@search) OR
    LOWER(c.client_nume) LIKE LOWER(@search) OR
    LOWER(c.Denumire_Contract) LIKE LOWER(@search) OR
    LOWER(c.proiect_id) LIKE LOWER(@search) OR
    LOWER(COALESCE(cl.nume, '')) LIKE LOWER(@search)
  )`;
  params.search = `%${search}%`;
  types.search = 'STRING';
}

	// Filtru după client
	if (clientId) {
	  whereClause += ' AND client_id = @clientId';
	  params.clientId = clientId;
	  types.clientId = 'STRING';
	}

	// Filtru după perioada de creare
	const dataCreareStart = searchParams.get('data_creare_start');
	const dataCreareEnd = searchParams.get('data_creare_end');

	if (dataCreareStart) {
	  whereClause += ' AND DATE(c.data_creare) >= @dataCreareStart';
	  params.dataCreareStart = dataCreareStart;
	  types.dataCreareStart = 'DATE';
	}

	if (dataCreareEnd) {
	  whereClause += ' AND DATE(c.data_creare) <= @dataCreareEnd';
	  params.dataCreareEnd = dataCreareEnd;
	  types.dataCreareEnd = 'DATE';
	}

	// Filtru după valoare minimă
	const valoareMin = searchParams.get('valoare_min');
	if (valoareMin && !isNaN(Number(valoareMin))) {
	  whereClause += ' AND CAST(COALESCE(c.valoare_ron, c.Valoare, 0) AS FLOAT64) >= @valoareMin';
	  params.valoareMin = Number(valoareMin);
	  types.valoareMin = 'NUMERIC';
	}

	// Filtru după valoare maximă
	const valoareMax = searchParams.get('valoare_max');
	if (valoareMax && !isNaN(Number(valoareMax))) {
	  whereClause += ' AND CAST(COALESCE(c.valoare_ron, c.Valoare, 0) AS FLOAT64) <= @valoareMax';
	  params.valoareMax = Number(valoareMax);
	  types.valoareMax = 'NUMERIC';
	}

	// Filtru după moneda
	const moneda = searchParams.get('moneda');
	if (moneda) {
	  whereClause += ' AND COALESCE(c.Moneda, "RON") = @moneda';
	  params.moneda = moneda;
	  types.moneda = 'STRING';
	}

    // Query principal cu JOIN pentru date client complete
    const query = `
      SELECT 
        c.*,
        cl.nume as client_nume_complet,
        cl.adresa as client_adresa_completa,
        cl.telefon as client_telefon,
        cl.email as client_email
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` c
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Clienti\` cl
        ON c.client_id = cl.id
      ${whereClause}
      ORDER BY c.data_creare DESC
      LIMIT @limit OFFSET @offset
    `;

    params.limit = limit;
    params.offset = offset;
    types.limit = 'INT64';
    types.offset = 'INT64';

    const [rows] = await bigquery.query({
      query,
      params,
      types,
      location: 'EU',
    });

    // PROCESARE ACTUALIZATĂ: Încărcarea etapelor din EtapeContract
    const contracteProcesate = await Promise.all(rows.map(async (contract: any) => {
      const continutJson = parseJsonField(contract.continut_json);

      // MODIFICARE PRINCIPALĂ: Încarcă etapele din EtapeContract în loc de JSON
      const etape = await loadEtapeContract(contract.ID_Contract);

      const valoareConvertita = convertBigQueryNumeric(contract.Valoare);
      const valoareRonConvertita = convertBigQueryNumeric(contract.valoare_ron);
      const cursValutarConvertit = convertBigQueryNumeric(contract.curs_valutar);

      return {
        ID_Contract: contract.ID_Contract,
        numar_contract: contract.numar_contract,
        serie_contract: contract.serie_contract,
        tip_document: contract.tip_document,
        proiect_id: contract.proiect_id,
        client_id: contract.client_id,
        client_nume: contract.client_nume,
        client_nume_complet: contract.client_nume_complet,
        client_adresa: contract.client_adresa_completa,
        client_telefon: contract.client_telefon,
        client_email: contract.client_email,
        Denumire_Contract: contract.Denumire_Contract,
        Data_Semnare: formatDate(contract.Data_Semnare),
        Data_Expirare: formatDate(contract.Data_Expirare),
        Status: contract.Status,
        Valoare: valoareConvertita,
        Moneda: contract.Moneda,
        curs_valutar: cursValutarConvertit,
        data_curs_valutar: formatDate(contract.data_curs_valutar),
        valoare_ron: valoareRonConvertita,
        
        // NOUĂ STRUCTURĂ: Etape din EtapeContract
        etape: etape,
        etape_count: etape.length,
        etape_facturate: etape.filter(e => e.status_facturare === 'Facturat').length,
        etape_incasate: etape.filter(e => e.status_incasare === 'Încasat').length,
        
        articole_suplimentare: parseJsonField(contract.articole_suplimentare),
        continut_json: continutJson,
        data_creare: parseDate(contract.data_creare),
        data_actualizare: parseDate(contract.data_actualizare),
        Observatii: contract.Observatii,
        versiune: contract.versiune || 1
      };
    }));

    // Query pentru totalul de contracte
    let countQuery = `
      SELECT COUNT(*) as total
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` c
      ${whereClause.replace('LIMIT @limit OFFSET @offset', '')}
    `;

    const countParams = { ...params };
    const countTypes = { ...types };
    delete countParams.limit;
    delete countParams.offset;
    delete countTypes.limit;
    delete countTypes.offset;

    const [countRows] = await bigquery.query({
      query: countQuery,
      params: countParams,
      types: countTypes,
      location: 'EU',
    });

    const total = countRows[0]?.total || 0;

    console.log(`[CONTRACTE] Contracte găsite: ${contracteProcesate.length} din ${total} total`);

    return NextResponse.json({
      success: true,
      data: contracteProcesate,
      total: parseInt(total.toString()),
      limit,
      offset,
      has_more: (offset + limit) < total,
      message: proiectId ? 
        `${contracteProcesate.length} contracte găsite pentru proiectul ${proiectId}` :
        `${contracteProcesate.length} contracte încărcate`
    });

  } catch (error) {
    console.error('[CONTRACTE] Eroare la încărcarea contractelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea contractelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Creare contract nou (doar metadata, generarea se face prin /actions/contracts/generate)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      proiect_id,
      tip_document = 'contract',
      observatii
    } = body;

    if (!proiect_id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID proiect obligatoriu' 
      }, { status: 400 });
    }

    console.log('[CONTRACTE] POST contract nou pentru proiect:', proiect_id);

    // Verifică dacă există deja un contract pentru acest proiect
    const existingQuery = `
      SELECT ID_Contract, numar_contract, Status
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      WHERE proiect_id = @proiect_id
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({
      query: existingQuery,
      params: { proiect_id },
      types: { proiect_id: 'STRING' },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      const existingContract = existingRows[0];
      console.log(`[CONTRACTE] Contract existent găsit: ${existingContract.numar_contract}`);
      
      return NextResponse.json({
        success: false,
        error: 'Există deja un contract pentru acest proiect',
        existing_contract: {
          ID_Contract: existingContract.ID_Contract,
          numar_contract: existingContract.numar_contract,
          Status: existingContract.Status
        },
        message: `Contract existent: ${existingContract.numar_contract} (Status: ${existingContract.Status})`
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: 'Pentru crearea contractului, folosește /api/actions/contracts/generate',
      next_action: 'redirect_to_generate'
    });

  } catch (error) {
    console.error('[CONTRACTE] Eroare la crearea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la crearea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizare contract (doar metadata, nu generarea)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ID_Contract,
      Status,
      Observatii,
      Data_Expirare
    } = body;

    if (!ID_Contract) {
      return NextResponse.json({ 
        success: false,
        error: 'ID contract obligatoriu' 
      }, { status: 400 });
    }

    console.log('[CONTRACTE] PUT actualizare contract:', ID_Contract);

    const updateFields: string[] = [];
    const params: any = { ID_Contract };
    const types: any = { ID_Contract: 'STRING' };

    if (Status) {
      updateFields.push('Status = @Status');
      params.Status = Status;
      types.Status = 'STRING';
    }

    if (Observatii !== undefined) {
      updateFields.push('Observatii = @Observatii');
      params.Observatii = Observatii || null;
      types.Observatii = 'STRING';
    }

    if (Data_Expirare) {
      updateFields.push('Data_Expirare = @Data_Expirare');
      params.Data_Expirare = Data_Expirare;
      types.Data_Expirare = 'DATE';
    }

    updateFields.push('data_actualizare = CURRENT_TIMESTAMP()');

    if (updateFields.length === 1) {
      return NextResponse.json({ 
        success: false,
        error: 'Niciun câmp de actualizat specificat' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Contract = @ID_Contract
    `;

    await bigquery.query({
      query: updateQuery,
      params,
      types,
      location: 'EU',
    });

    console.log(`[CONTRACTE] Contract ${ID_Contract} actualizat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Contract actualizat cu succes',
      updated_fields: Object.keys(params).filter(k => k !== 'ID_Contract')
    });

  } catch (error) {
    console.error('[CONTRACTE] Eroare la actualizarea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Ștergere contract (soft delete prin status)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('id');

    if (!contractId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID contract obligatoriu' 
      }, { status: 400 });
    }

    console.log('[CONTRACTE] DELETE contract:', contractId);

    // Soft delete prin schimbarea status-ului + dezactivare etape
    const deleteQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET 
        Status = 'Anulat',
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Contract = @contractId
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { contractId },
      types: { contractId: 'STRING' },
      location: 'EU',
    });

    // Dezactivează și etapele asociate
    const deleteEtapeQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.EtapeContract\`
      SET 
        activ = false,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE contract_id = @contractId
    `;

    await bigquery.query({
      query: deleteEtapeQuery,
      params: { contractId },
      types: { contractId: 'STRING' },
      location: 'EU',
    });

    console.log(`[CONTRACTE] Contract ${contractId} și etapele asociate marcate ca anulat/inactiv`);

    return NextResponse.json({
      success: true,
      message: 'Contract anulat cu succes'
    });

  } catch (error) {
    console.error('[CONTRACTE] Eroare la anularea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la anularea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
