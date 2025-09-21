// ==================================================================
// CALEA: app/api/user/projects/route.ts
// DATA: 21.09.2025 16:35 (ora României)
// DESCRIERE: API proiecte pentru utilizatori normali cu restricții financiare
// FUNCȚIONALITATE: CRUD proiecte cu valori financiare automat zero RON
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

const dataset = 'PanouControlUnitar';
const table = 'Proiecte';
const PROJECT_ID = 'hale-mode-464009-i6';

// Helper function pentru validare și escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper function pentru formatare DATE pentru BigQuery
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '') {
    return 'NULL';
  }

  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }

  console.warn('Data nu este în format ISO YYYY-MM-DD:', dateString);
  return 'NULL';
};

// Helper pentru conversie BigQuery NUMERIC
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'object' && value !== null && 'value' in value) {
    const extractedValue = value.value;
    if (typeof extractedValue === 'object' && extractedValue !== null) {
      return convertBigQueryNumeric(extractedValue);
    }
    return parseFloat(String(extractedValue)) || 0;
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

  try {
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    return 0;
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const client = searchParams.get('client');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log('📋 USER PROJECTS API PARAMS:', { search, status, client, page, limit });

    // Query pentru utilizatori normali - FĂRĂ date financiare
    let baseQuery = `
      SELECT
        p.ID_Proiect,
        p.Denumire,
        p.Client,
        p.Adresa,
        p.Descriere,
        p.Data_Start,
        p.Data_Final,
        p.Status,
        p.status_predare,
        p.status_contract,
        p.Responsabil,
        p.Observatii,
        -- Date client
        c.id as client_id,
        c.nume as client_nume,
        c.cui as client_cui,
        c.adresa as client_adresa,
        c.telefon as client_telefon,
        c.email as client_email
      FROM \`${PROJECT_ID}.${dataset}.${table}\` p
      LEFT JOIN \`${PROJECT_ID}.${dataset}.Clienti\` c
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
    `;

    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre identice cu admin dar fără filtre financiare
    if (search) {
      conditions.push(`(
        LOWER(p.ID_Proiect) LIKE LOWER(@search) OR
        LOWER(p.Denumire) LIKE LOWER(@search) OR
        LOWER(p.Client) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Adresa, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(c.nume, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(c.cui, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    if (status) {
      conditions.push('p.Status = @status');
      params.status = status;
      types.status = 'STRING';
    }

    if (client) {
      conditions.push(`(
        LOWER(p.Client) LIKE LOWER(@client) OR
        LOWER(COALESCE(c.nume, '')) LIKE LOWER(@client)
      )`);
      params.client = `%${client}%`;
      types.client = 'STRING';
    }

    // Filtrare pe date (fără restricții financiare)
    const dataStartFrom = searchParams.get('data_start_start');
    const dataStartTo = searchParams.get('data_start_end');

    if (dataStartFrom) {
      conditions.push('p.Data_Start >= @dataStartFrom');
      params.dataStartFrom = dataStartFrom;
      types.dataStartFrom = 'DATE';
    }

    if (dataStartTo) {
      conditions.push('p.Data_Start <= @dataStartTo');
      params.dataStartTo = dataStartTo;
      types.dataStartTo = 'DATE';
    }

    // Filtrare pe status-uri non-financiare
    const statusPredare = searchParams.get('status_predare');
    if (statusPredare) {
      conditions.push('COALESCE(p.status_predare, "Nepredat") = @statusPredare');
      params.statusPredare = statusPredare;
      types.statusPredare = 'STRING';
    }

    const statusContract = searchParams.get('status_contract');
    if (statusContract) {
      conditions.push('COALESCE(p.status_contract, "Nu e cazul") = @statusContract');
      params.statusContract = statusContract;
      types.statusContract = 'STRING';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare și paginare
    baseQuery += `
      ORDER BY p.Data_Start DESC
      LIMIT @limit OFFSET @offset
    `;

    params.limit = limit;
    params.offset = offset;
    types.limit = 'INT64';
    types.offset = 'INT64';

    console.log('📋 USER QUERY PARAMS:', params);

    // Execută query-ul principal
    const [rows] = await bigquery.query({
      query: baseQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`✅ USER PROJECTS LOADED: ${rows.length} results`);

    // Query pentru total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM \`${PROJECT_ID}.${dataset}.${table}\` p
      LEFT JOIN \`${PROJECT_ID}.${dataset}.Clienti\` c
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
    `;

    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

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

    const total = convertBigQueryNumeric(countRows[0]?.total) || 0;

    // Procesează rezultatele - EXCLUDE datele financiare
    const processedData = rows.map((row: any) => ({
      ID_Proiect: row.ID_Proiect,
      Denumire: row.Denumire,
      Client: row.Client,
      Adresa: row.Adresa,
      Descriere: row.Descriere,
      Data_Start: row.Data_Start,
      Data_Final: row.Data_Final,
      Status: row.Status,
      status_predare: row.status_predare,
      status_contract: row.status_contract,
      Responsabil: row.Responsabil,
      Observatii: row.Observatii,
      // Date client (non-financiare)
      client_id: row.client_id,
      client_nume: row.client_nume,
      client_cui: row.client_cui,
      client_adresa: row.client_adresa,
      client_telefon: row.client_telefon,
      client_email: row.client_email,
      // Pentru compatibilitate UI - setează implicit 0 RON
      Valoare_Estimata: 0,
      valoare_ron: 0,
      moneda: 'RON',
      curs_valutar: 1,
      status_facturare: 'Nu se aplică',
      status_achitare: 'Nu se aplică'
    }));

    console.log('💼 Procesare proiecte user completă - date financiare excluse');

    return NextResponse.json({
      success: true,
      data: processedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ EROARE LA ÎNCĂRCAREA PROIECTELOR USER:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la încărcarea proiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST request body primit pentru user:', body);

    const {
      ID_Proiect,
      Denumire,
      Client,
      Adresa,
      Descriere,
      Data_Start,
      Data_Final,
      Status = 'Activ',
      status_predare = 'Nepredat',
      status_contract = 'Nu e cazul',
      Responsabil,
      Observatii
    } = body;

    // Validări
    if (!ID_Proiect || !Denumire || !Client) {
      return NextResponse.json({
        success: false,
        error: 'Câmpurile ID_Proiect, Denumire și Client sunt obligatorii'
      }, { status: 400 });
    }

    console.log('=== DEBUG USER BACKEND: Date primite ===');
    console.log('Data_Start primit:', Data_Start);
    console.log('Data_Final primit:', Data_Final);

    // Formatare DATE literale pentru BigQuery
    const dataStartFormatted = formatDateLiteral(Data_Start);
    const dataFinalFormatted = formatDateLiteral(Data_Final);

    // Query pentru utilizatori normali - AUTOMAT zero RON pentru toate valorile financiare
    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.${dataset}.${table}\`
      (ID_Proiect, Denumire, Client, Adresa, Descriere, Data_Start, Data_Final,
       Status, Valoare_Estimata, moneda, curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare,
       Responsabil, Observatii)
      VALUES (
        '${escapeString(ID_Proiect)}',
        '${escapeString(Denumire)}',
        '${escapeString(Client)}',
        ${Adresa ? `'${escapeString(Adresa)}'` : 'NULL'},
        ${Descriere ? `'${escapeString(Descriere)}'` : 'NULL'},
        ${dataStartFormatted},
        ${dataFinalFormatted},
        '${escapeString(Status)}',
        0,
        'RON',
        1,
        0,
        '${escapeString(status_predare)}',
        '${escapeString(status_contract)}',
        'Nu se aplică',
        'Nu se aplică',
        ${Responsabil ? `'${escapeString(Responsabil)}'` : 'NULL'},
        ${Observatii ? `'${escapeString(Observatii)}'` : 'NULL'}
      )
    `;

    console.log('=== DEBUG USER BACKEND: Query INSERT cu valori financiare zero ===');
    console.log(insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log('=== DEBUG USER BACKEND: Insert executat cu succes (zero RON) ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect adăugat cu succes (fără valori financiare)'
    });

  } catch (error) {
    console.error('=== EROARE USER BACKEND la adăugarea proiectului ===');
    console.error('Error details:', error);

    return NextResponse.json({
      success: false,
      error: 'Eroare la adăugarea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID proiect necesar pentru actualizare'
      }, { status: 400 });
    }

    console.log('=== DEBUG USER PUT: Date primite pentru actualizare ===');
    console.log('ID:', id);
    console.log('Update data:', updateData);

    // Construire query UPDATE pentru utilizatori normali - EXCLUDE câmpurile financiare
    const updateFields: string[] = [];

    if (status) {
      updateFields.push(`Status = '${escapeString(status)}'`);
    }

    // Câmpuri permise pentru utilizatori normali (fără valori financiare)
    const allowedFields = [
      'Denumire', 'Client', 'Adresa', 'Descriere', 'Data_Start', 'Data_Final',
      'status_predare', 'status_contract', 'Responsabil', 'Observatii'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        // Tratament special pentru câmpurile DATE
        if (['Data_Start', 'Data_Final'].includes(key)) {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else if (typeof value === 'string') {
          updateFields.push(`${key} = '${escapeString(value)}'`);
        } else {
          updateFields.push(`${key} = '${escapeString(value.toString())}'`);
        }
      }
    });

    // FORȚEAZĂ valorile financiare să rămână zero RON
    updateFields.push('Valoare_Estimata = 0');
    updateFields.push('valoare_ron = 0');
    updateFields.push('moneda = "RON"');
    updateFields.push('curs_valutar = 1');
    updateFields.push('status_facturare = "Nu se aplică"');
    updateFields.push('status_achitare = "Nu se aplică"');

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nu există câmpuri de actualizat'
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    console.log('=== DEBUG USER PUT: Query UPDATE cu restricții financiare ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG USER PUT: Update executat cu succes (restricții financiare) ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect actualizat cu succes (fără modificări financiare)'
    });

  } catch (error) {
    console.error('=== EROARE USER BACKEND la actualizarea proiectului ===');
    console.error('Error details:', error);

    return NextResponse.json({
      success: false,
      error: 'Eroare la actualizarea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID proiect necesar pentru ștergere'
      }, { status: 400 });
    }

    const deleteQuery = `
      DELETE FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    console.log('=== DEBUG USER DELETE: Query ștergere ===');
    console.log(deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log('=== DEBUG USER DELETE: Ștergere executată cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect șters cu succes'
    });

  } catch (error) {
    console.error('=== EROARE USER BACKEND la ștergerea proiectului ===');
    console.error('Error details:', error);

    return NextResponse.json({
      success: false,
      error: 'Eroare la ștergerea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}