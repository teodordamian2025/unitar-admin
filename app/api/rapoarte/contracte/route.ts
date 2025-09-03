// ==================================================================
// CALEA: app/api/rapoarte/contracte/route.ts
// DATA: 03.09.2025 03:15 (ora României)
// FIX CRITIC: Aplicare convertBigQueryNumeric îmbunătățit pentru valorile NUMERIC
// PĂSTRATE: Toate funcționalitățile + pattern-uri consistente cu alte API-uri
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

// FIX PRINCIPAL: Helper pentru conversie BigQuery NUMERIC îmbunătățit (identic cu proiectele)
const convertBigQueryNumeric = (value: any): number => {
  // Console log pentru debugging valorilor primite (doar pentru valorile non-zero)
  if (value !== null && value !== undefined && value !== 0) {
    console.log(`[CONTRACTE] convertBigQueryNumeric - input:`, {
      value,
      type: typeof value,
      isObject: typeof value === 'object',
      hasValue: value?.hasOwnProperty?.('value'),
      stringified: JSON.stringify(value)
    });
  }

  if (value === null || value === undefined) return 0;
  
  // Cazul 1: Obiect BigQuery cu proprietatea 'value'
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const extractedValue = value.value;
    console.log(`[CONTRACTE] BigQuery object detected - extracted value:`, extractedValue, `type:`, typeof extractedValue);
    
    // Recursiv pentru cazuri anidite
    if (typeof extractedValue === 'object' && extractedValue !== null) {
      return convertBigQueryNumeric(extractedValue);
    }
    
    const numericValue = parseFloat(String(extractedValue)) || 0;
    console.log(`[CONTRACTE] Converted to numeric:`, numericValue);
    return numericValue;
  }
  
  // Cazul 2: String cu valoare numerică
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return 0;
    
    const parsed = parseFloat(trimmed);
    const result = isNaN(parsed) ? 0 : parsed;
    if (result !== 0) {
      console.log(`[CONTRACTE] String converted:`, value, `->`, result);
    }
    return result;
  }
  
  // Cazul 3: Număr direct
  if (typeof value === 'number') {
    const result = isNaN(value) || !isFinite(value) ? 0 : value;
    if (result !== 0 && result !== value) {
      console.log(`[CONTRACTE] Number processed:`, value, `->`, result);
    }
    return result;
  }
  
  // Cazul 4: BigInt (posibil pentru NUMERIC mari)
  if (typeof value === 'bigint') {
    const result = Number(value);
    console.log(`[CONTRACTE] BigInt converted:`, value, `->`, result);
    return result;
  }
  
  // Cazul 5: Alte tipuri - încearcă conversie
  try {
    const stringValue = String(value);
    const parsed = parseFloat(stringValue);
    const result = isNaN(parsed) ? 0 : parsed;
    if (result !== 0) {
      console.log(`[CONTRACTE] Other type converted:`, value, `(${typeof value}) ->`, result);
    }
    return result;
  } catch (error) {
    console.warn(`[CONTRACTE] Cannot convert value:`, value, error);
    return 0;
  }
};

// FIX PRINCIPAL: Helper pentru parsarea sigură a datelor BigQuery cu format UTC
const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  
  try {
    let dateString = dateValue;
    
    // Dacă este obiect BigQuery cu proprietatea value
    if (typeof dateValue === 'object' && dateValue !== null && 'value' in dateValue) {
      dateString = dateValue.value;
    }
    
    if (!dateString) return null;
    
    // Convertește la string și elimină UTC-ul de la sfârșit care cauzează probleme
    const cleanDateString = dateString.toString().replace(/\s+UTC\s*$/, '').trim();
    
    console.log(`[CONTRACTE] Parsare dată: "${dateString}" -> "${cleanDateString}"`);
    
    // Încearcă să parseze data
    const parsedDate = new Date(cleanDateString);
    
    // Verifică dacă data este validă
    if (isNaN(parsedDate.getTime())) {
      console.warn(`[CONTRACTE] Data invalidă după parsare: "${cleanDateString}"`);
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
    // Folosește aceeași logică de sanitizare
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

// GET - Listare și căutare contracte
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id');
    const clientId = searchParams.get('client_id');
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

    // Filtru pentru proiect (IMPORTANT pentru verificarea existenței)
    if (proiectId) {
      whereClause += ' AND proiect_id = @proiectId';
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    // Filtru pentru client
    if (clientId) {
      whereClause += ' AND client_id = @clientId';
      params.clientId = clientId;
      types.clientId = 'STRING';
    }

    // Filtru pentru status
    if (status) {
      whereClause += ' AND Status = @status';
      params.status = status;
      types.status = 'STRING';
    }

    // Căutare în multiple câmpuri
    if (search) {
      whereClause += ` AND (
        LOWER(numar_contract) LIKE LOWER(@search) OR
        LOWER(client_nume) LIKE LOWER(@search) OR
        LOWER(Denumire_Contract) LIKE LOWER(@search)
      )`;
      params.search = `%${search}%`;
      types.search = 'STRING';
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

    // Adaugă limit și offset la parametri
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

    // FIX PRINCIPAL: Procesează rezultatele cu conversie îmbunătățită pentru valorile NUMERIC
    const contracteProcesate = rows.map((contract: any) => {
      // Parsează JSON-urile
      const etape = parseJsonField(contract.etape);
      const continutJson = parseJsonField(contract.continut_json);

      console.log(`[CONTRACTE] Procesare contract ${contract.numar_contract}:`, {
        data_creare_raw: contract.data_creare,
        data_actualizare_raw: contract.data_actualizare,
        valoare_raw: contract.Valoare,
        valoare_ron_raw: contract.valoare_ron,
        curs_valutar_raw: contract.curs_valutar
      });

      // FIX CRITIC: Aplică convertBigQueryNumeric îmbunătățit pentru valorile NUMERIC
      const valoareConvertita = convertBigQueryNumeric(contract.Valoare);
      const valoareRonConvertita = convertBigQueryNumeric(contract.valoare_ron);
      const cursValutarConvertit = convertBigQueryNumeric(contract.curs_valutar);

      console.log(`[CONTRACTE] ✅ CONVERTED VALUES pentru ${contract.numar_contract}:`, {
        Valoare: valoareConvertita,
        valoare_ron: valoareRonConvertita,
        curs_valutar: cursValutarConvertit
      });

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
        // FIX PRINCIPAL: Folosește valorile convertite cu funcția îmbunătățită
        Valoare: valoareConvertita,
        Moneda: contract.Moneda,
        curs_valutar: cursValutarConvertit,
        data_curs_valutar: formatDate(contract.data_curs_valutar),
        valoare_ron: valoareRonConvertita,
        etape: etape,
        etape_count: etape ? (Array.isArray(etape) ? etape.length : 0) : 0,
        articole_suplimentare: parseJsonField(contract.articole_suplimentare),
        continut_json: continutJson,
        // FIX PRINCIPAL: Folosește parseDate pentru data_creare și data_actualizare
        data_creare: parseDate(contract.data_creare),
        data_actualizare: parseDate(contract.data_actualizare),
        Observatii: contract.Observatii,
        versiune: contract.versiune || 1
      };
    });

    // Query pentru totalul de contracte (pentru paginare)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` c
      ${whereClause.replace('LIMIT @limit OFFSET @offset', '')}
    `;

    // Elimină parametrii de paginare din params pentru count
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
      }, { status: 409 }); // Conflict
    }

    // Pentru crearea efectivă, se folosește /api/actions/contracts/generate
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

    // Construiește query-ul de update dinamic cu tipizare explicită
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

    if (updateFields.length === 1) { // doar timestamp
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

    // Soft delete prin schimbarea status-ului
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

    console.log(`[CONTRACTE] Contract ${contractId} marcat ca anulat`);

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
