// ==================================================================
// CALEA: app/api/rapoarte/contracte/route.ts
// DATA: 15.01.2025 10:00 (ora României)
// REPARAT: Eliminat termen_executie_zile + LIKE în loc de = pentru filtrare
// PARTEA 1/3: Helpers și configurare inițială
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

// Helper function pentru escape SQL - PĂSTRAT din TimeTracking
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper pentru formatare DATE BigQuery - PĂSTRAT și ÎMBUNĂTĂȚIT din TimeTracking
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === 'undefined' || dateString === '') {
    return 'NULL';
  }
  
  // Verificare format ISO date (YYYY-MM-DD)
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  
  // Încearcă să parseze data și să o convertească
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const isoString = date.toISOString().split('T')[0];
      return `DATE('${isoString}')`;
    }
  } catch (error) {
    console.warn(`Nu s-a putut parsa data: ${dateString}`);
  }
  
  return 'NULL';
};

// Helper pentru actualizare timestamp
const getCurrentTimestamp = (): string => {
  return 'CURRENT_TIMESTAMP()';
};

// Helper pentru conversie BigQuery NUMERIC - PĂSTRAT din codul existent
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

// Helper pentru parsarea datelor BigQuery - PĂSTRAT din codul existent
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

// Helper pentru formatarea datei pentru afișare - PĂSTRAT din codul existent
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

// Helper pentru parsarea JSON-ului BigQuery - PĂSTRAT din codul existent
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

// Încărcarea etapelor din tabela EtapeContract - PĂSTRAT din codul existent
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
// GET - Listare și căutare contracte (REPARATĂ FILTRAREA CU LIKE)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    console.log('[CONTRACTE] GET contracte cu parametrii:', Object.fromEntries(searchParams.entries()));

    // REPARATĂ: Construirea query-ului fără duplicări + LIKE pentru toate filtrele
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    const types: any = {};

    // REPARAT: Filtru după ID proiect - LIKE în loc de = pentru căutare parțială
    const proiectId = searchParams.get('proiect_id');
    if (proiectId && proiectId.trim()) {
      whereClause += ' AND LOWER(c.proiect_id) LIKE LOWER(@proiectId)';
      params.proiectId = `%${proiectId.trim()}%`;
      types.proiectId = 'STRING';
    }

    // REPARAT: Filtru după status - păstrează = pentru că este exact match
    const status = searchParams.get('status');
    if (status && status.trim()) {
      whereClause += ' AND c.Status = @status';
      params.status = status.trim();
      types.status = 'STRING';
    }

    // REPARAT: Filtru după client - LIKE pentru căutare parțială (fără dropdown)
    const clientParam = searchParams.get('client') || searchParams.get('client_id');
    if (clientParam && clientParam.trim()) {
      whereClause += ' AND (LOWER(c.client_nume) LIKE LOWER(@clientParam) OR LOWER(COALESCE(cl.nume, "")) LIKE LOWER(@clientParam))';
      params.clientParam = `%${clientParam.trim()}%`;
      types.clientParam = 'STRING';
    }

    // REPARAT: Căutarea generală - fără duplicare, menține logica existentă
    const search = searchParams.get('search');
    if (search && search.trim()) {
      whereClause += ` AND (
        LOWER(c.numar_contract) LIKE LOWER(@search) OR
        LOWER(c.client_nume) LIKE LOWER(@search) OR
        LOWER(c.Denumire_Contract) LIKE LOWER(@search) OR
        LOWER(c.proiect_id) LIKE LOWER(@search) OR
        LOWER(COALESCE(cl.nume, '')) LIKE LOWER(@search)
      )`;
      params.search = `%${search.trim()}%`;
      types.search = 'STRING';
    }

    // Filtru după perioada de creare - păstrează = pentru date
    const dataCreareStart = searchParams.get('data_creare_start');
    const dataCreareEnd = searchParams.get('data_creare_end');

    if (dataCreareStart && dataCreareStart.trim()) {
      whereClause += ' AND DATE(c.data_creare) >= @dataCreareStart';
      params.dataCreareStart = dataCreareStart.trim();
      types.dataCreareStart = 'DATE';
    }

    if (dataCreareEnd && dataCreareEnd.trim()) {
      whereClause += ' AND DATE(c.data_creare) <= @dataCreareEnd';
      params.dataCreareEnd = dataCreareEnd.trim();
      types.dataCreareEnd = 'DATE';
    }

    // Filtru după valoare minimă - păstrează >= pentru numere
    const valoareMin = searchParams.get('valoare_min');
    if (valoareMin && valoareMin.trim() && !isNaN(Number(valoareMin))) {
      whereClause += ' AND CAST(COALESCE(c.valoare_ron, c.Valoare, 0) AS FLOAT64) >= @valoareMin';
      params.valoareMin = Number(valoareMin.trim());
      types.valoareMin = 'NUMERIC';
    }

    // Filtru după valoare maximă - păstrează <= pentru numere
    const valoareMax = searchParams.get('valoare_max');
    if (valoareMax && valoareMax.trim() && !isNaN(Number(valoareMax))) {
      whereClause += ' AND CAST(COALESCE(c.valoare_ron, c.Valoare, 0) AS FLOAT64) <= @valoareMax';
      params.valoareMax = Number(valoareMax.trim());
      types.valoareMax = 'NUMERIC';
    }

    // Limitare și paginare
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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

    console.log('[CONTRACTE] Query executat:', query);
    console.log('[CONTRACTE] Parametrii:', params);

    const [rows] = await bigquery.query({
      query,
      params,
      types,
      location: 'EU',
    });

    // PROCESARE: Încărcarea etapelor din EtapeContract
    const contracteProcesate = await Promise.all(rows.map(async (contract: any) => {
      const continutJson = parseJsonField(contract.continut_json);

      // Încarcă etapele din EtapeContract în loc de JSON
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
        Data_Semnare: contract.Data_Semnare?.value || contract.Data_Semnare,
        Data_Expirare: contract.Data_Expirare?.value || contract.Data_Expirare,
        Status: contract.Status,
        Valoare: valoareConvertita,
        Moneda: contract.Moneda,
        curs_valutar: cursValutarConvertit,
        data_curs_valutar: contract.data_curs_valutar?.value || contract.data_curs_valutar,
        valoare_ron: valoareRonConvertita,
        
        // Etape din EtapeContract
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
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Clienti\` cl
        ON c.client_id = cl.id
      ${whereClause}
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
// PUT - Actualizare contract (ELIMINAT termen_executie_zile din allowedFields)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('PUT contracts request body:', body);
    
    const { ID_Contract, ...updateData } = body;

    if (!ID_Contract) {
      return NextResponse.json({ 
        success: false,
        error: 'ID_Contract necesar pentru actualizare' 
      }, { status: 400 });
    }

    // ADĂUGAT: Logica specială pentru semnarea contractelor
    if (updateData.Status === 'Semnat' && updateData.Data_Semnare) {
      // Validări pentru semnarea contractului
      const dataSemnare = updateData.Data_Semnare;
      const dataExpirare = updateData.Data_Expirare;
      
      if (!dataExpirare) {
        return NextResponse.json({ 
          success: false,
          error: 'Data_Expirare este obligatorie când se marchează contractul ca semnat' 
        }, { status: 400 });
      }

      // Validare că data semnării nu este prea în trecut (mai mult de 1 an)
      const dataSemnareDate = new Date(dataSemnare);
      const acumUnAn = new Date();
      acumUnAn.setFullYear(acumUnAn.getFullYear() - 1);
      
      if (dataSemnareDate < acumUnAn) {
        return NextResponse.json({ 
          success: false,
          error: `Data semnării (${dataSemnareDate.toLocaleDateString('ro-RO')}) pare să fie prea în trecut. Verifică dacă este corectă.` 
        }, { status: 400 });
      }

      console.log(`Actualizare contract ${ID_Contract} - Status: Semnat, Data_Semnare: ${dataSemnare}, Data_Expirare: ${dataExpirare}`);
    }

    // MODIFICAT: Construire query UPDATE fără termen_executie_zile
    const updateFields: string[] = [];
    const allowedFields = [
      'Status', 'Data_Semnare', 'Data_Expirare', 'Valoare', 'Moneda', 
      'curs_valutar', 'valoare_ron', 'Observatii', 'note_interne',
      'observatii_semnare'
      // ELIMINAT: 'termen_executie_zile' - nu există în BigQuery
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        // Tratare specială pentru câmpurile de tip DATE
        if (key === 'Data_Semnare' || key === 'Data_Expirare') {
          const dataLiteral = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${dataLiteral}`);
        }
        // Tratare pentru câmpurile numerice (fără termen_executie_zile)
        else if (key === 'Valoare' || key === 'curs_valutar' || key === 'valoare_ron') {
          const numericValue = parseFloat(value as string);
          if (!isNaN(numericValue)) {
            updateFields.push(`${key} = ${numericValue}`);
          }
        }
        // Tratare pentru câmpurile text
        else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else {
          updateFields.push(`${key} = '${escapeString(value.toString())}'`);
        }
      }
    });

    // Adăugare timestamp actualizare
    updateFields.push(`data_actualizare = ${getCurrentTimestamp()}`);
    
    // ADĂUGAT: Dacă avem observatii_semnare, le adăugăm la Observatii existente
    if (updateData.observatii_semnare && updateData.observatii_semnare.trim()) {
      const observatiiSemnare = escapeString(updateData.observatii_semnare.trim());
      const timestampSemnare = new Date().toLocaleString('ro-RO');
      
      updateFields.push(`Observatii = CASE 
        WHEN Observatii IS NULL OR Observatii = '' 
        THEN 'SEMNAT ${timestampSemnare}: ${observatiiSemnare}'
        ELSE CONCAT(Observatii, '\n\nSEMNAT ${timestampSemnare}: ${observatiiSemnare}')
      END`);
    }

    if (updateFields.length === 1) { // Doar timestamp-ul
      return NextResponse.json({ 
        success: false,
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Contract = '${escapeString(ID_Contract)}'
    `;

    console.log('Update contract query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log(`Contract ${ID_Contract} actualizat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Contract actualizat cu succes',
      data: { 
        ID_Contract,
        updates_applied: Object.keys(updateData).filter(key => allowedFields.includes(key))
      }
    });

  } catch (error) {
    console.error('Eroare la actualizarea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Păstrează logica existentă
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proiect_id, tip_document = 'contract', observatii } = body;

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

// DELETE - Păstrează logica existentă
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
