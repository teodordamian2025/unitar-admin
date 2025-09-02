// ==================================================================
// CALEA: app/api/rapoarte/contracte/route.ts
// DATA: 02.09.2025 20:30 (ora României)
// DESCRIERE: CRUD complet pentru contracte - verificare existentă, listare, căutare
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

// Helper pentru conversie BigQuery NUMERIC
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const numericValue = parseFloat(String(value.value)) || 0;
    return numericValue;
  }
  
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  return 0;
};

// Helper pentru formatarea datei
const formatDate = (date?: string | { value: string }): string => {
  if (!date) return '';
  const dateValue = typeof date === 'string' ? date : date.value;
  try {
    return new Date(dateValue).toLocaleDateString('ro-RO');
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
    console.error('Eroare parsare JSON:', error);
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

    console.log('GET contracte cu parametrii:', {
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

    // Procesează rezultatele
    const contracteProcesate = rows.map((contract: any) => {
      // Parsează JSON-urile
      const etape = parseJsonField(contract.etape);
      const continutJson = parseJsonField(contract.continut_json);

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
        Valoare: convertBigQueryNumeric(contract.Valoare),
        Moneda: contract.Moneda,
        curs_valutar: convertBigQueryNumeric(contract.curs_valutar),
        data_curs_valutar: formatDate(contract.data_curs_valutar),
        valoare_ron: convertBigQueryNumeric(contract.valoare_ron),
        etape: etape,
        etape_count: etape ? (Array.isArray(etape) ? etape.length : 0) : 0,
        articole_suplimentare: parseJsonField(contract.articole_suplimentare),
        continut_json: continutJson,
        data_creare: contract.data_creare ? new Date(contract.data_creare).toISOString() : null,
        data_actualizare: contract.data_actualizare ? new Date(contract.data_actualizare).toISOString() : null,
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

    console.log(`Contracte găsite: ${contracteProcesate.length} din ${total} total`);

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
    console.error('Eroare la încărcarea contractelor:', error);
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

    console.log('POST contract nou pentru proiect:', proiect_id);

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
      console.log(`Contract existent găsit: ${existingContract.numar_contract}`);
      
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
    console.error('Eroare la crearea contractului:', error);
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

    console.log('PUT actualizare contract:', ID_Contract);

    // Construiește query-ul de update dinamic
    let updateFields = [];
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

    console.log(`Contract ${ID_Contract} actualizat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Contract actualizat cu succes',
      updated_fields: Object.keys(params).filter(k => k !== 'ID_Contract')
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

    console.log('DELETE contract:', contractId);

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

    console.log(`Contract ${contractId} marcat ca anulat`);

    return NextResponse.json({
      success: true,
      message: 'Contract anulat cu succes'
    });

  } catch (error) {
    console.error('Eroare la anularea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la anularea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
