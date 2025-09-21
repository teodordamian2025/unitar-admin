// ==================================================================
// CALEA: app/api/user/timetracking/route.ts
// DATA: 21.09.2025 16:40 (ora României)
// DESCRIERE: API time tracking pentru utilizatori normali
// FUNCȚIONALITATE: CRUD înregistrări timp personal fără date financiare
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
const table = 'TimeTracking';
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
    const userId = searchParams.get('user_id') || 'utilizator_curent';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const projectId = searchParams.get('project_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log('⏱️ USER TIME TRACKING API PARAMS:', { userId, startDate, endDate, projectId, page, limit });

    // Query pentru time tracking utilizatori normali - FĂRĂ date financiare
    let baseQuery = `
      SELECT
        id,
        utilizator_uid,
        proiect_id,
        descriere_lucru as task_description,
        data_lucru,
        ore_lucrate,
        tip_inregistrare,
        created_at,
        sarcina_id
      FROM \`${PROJECT_ID}.${dataset}.${table}\`
    `;

    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtrare pe utilizator
    if (userId && userId !== 'utilizator_curent') {
      conditions.push('utilizator_uid = @userId');
      params.userId = userId;
      types.userId = 'STRING';
    }

    // Filtrare pe interval de date
    if (startDate) {
      conditions.push('data_lucru >= @startDate');
      params.startDate = startDate;
      types.startDate = 'DATE';
    }

    if (endDate) {
      conditions.push('data_lucru <= @endDate');
      params.endDate = endDate;
      types.endDate = 'DATE';
    }

    // Filtrare pe proiect
    if (projectId) {
      conditions.push('proiect_id = @projectId');
      params.projectId = projectId;
      types.projectId = 'STRING';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare și paginare
    baseQuery += `
      ORDER BY data_lucru DESC, created_at DESC
      LIMIT @limit OFFSET @offset
    `;

    params.limit = limit;
    params.offset = offset;
    types.limit = 'INT64';
    types.offset = 'INT64';

    console.log('⏱️ USER TIME TRACKING QUERY PARAMS:', params);

    // Execută query-ul principal
    const [rows] = await bigquery.query({
      query: baseQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`✅ USER TIME TRACKING LOADED: ${rows.length} results`);

    // Query pentru total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM \`${PROJECT_ID}.${dataset}.${table}\`
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
      id: row.id,
      user_id: row.utilizator_uid,
      project_id: row.proiect_id,
      task_description: row.task_description,
      data_lucru: row.data_lucru,
      ore_lucrate: convertBigQueryNumeric(row.ore_lucrate),
      status: row.tip_inregistrare,
      data_creare: row.created_at,
      // Pentru compatibilitate - exclude datele financiare
      rate_per_hour: 0,
      valoare_totala: 0
    }));

    console.log('⏱️ Procesare time tracking user completă - date financiare excluse');

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
    console.error('❌ EROARE LA ÎNCĂRCAREA TIME TRACKING USER:', error);
    // Dacă tabela nu există, returnează array gol
    if (error instanceof Error && error.message.includes('Table') && error.message.includes('not found')) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Eroare la încărcarea înregistrărilor de timp',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST time tracking request pentru user:', body);

    const {
      user_id = 'utilizator_curent',
      project_id,
      task_description,
      data_lucru,
      duration_minutes,
      start_time,
      end_time
    } = body;

    // Validări
    if (!task_description || !duration_minutes) {
      return NextResponse.json({
        success: false,
        error: 'Câmpurile task_description și duration_minutes sunt obligatorii'
      }, { status: 400 });
    }

    const dataLucruFormatted = data_lucru ? formatDateLiteral(data_lucru) : 'CURRENT_DATE()';
    const oreCalculate = duration_minutes / 60; // Convertește minutele în ore

    // Generare ID unic pentru înregistrare
    const recordId = `tt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Query pentru utilizatori normali - conform schema BigQuery TimeTracking
    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.${dataset}.${table}\`
      (id, utilizator_uid, utilizator_nume, proiect_id, descriere_lucru,
       data_lucru, ore_lucrate, tip_inregistrare, created_at)
      VALUES (
        '${escapeString(recordId)}',
        '${escapeString(user_id)}',
        'Utilizator Normal',
        ${project_id ? `'${escapeString(project_id)}'` : 'NULL'},
        '${escapeString(task_description)}',
        ${dataLucruFormatted},
        ${oreCalculate},
        'manual',
        CURRENT_TIMESTAMP()
      )
    `;

    console.log('=== DEBUG USER TIME TRACKING: Query INSERT fără valori financiare ===');
    console.log(insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log('=== DEBUG USER TIME TRACKING: Insert executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Înregistrare timp adăugată cu succes',
      data: { id: recordId }
    });

  } catch (error) {
    console.error('=== EROARE USER TIME TRACKING la adăugare ===');
    console.error('Error details:', error);

    // Dacă tabela nu există, o creăm automat
    if (error instanceof Error && error.message.includes('Table') && error.message.includes('not found')) {
      try {
        await createTimeTrackingTable();
        // Retry insert după creare tabelă
        return await POST(request);
      } catch (createError) {
        console.error('Eroare la crearea tabelei TimeTracking:', createError);
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Eroare la adăugarea înregistrării de timp',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID înregistrare necesar pentru actualizare'
      }, { status: 400 });
    }

    console.log('=== DEBUG USER TIME TRACKING PUT: Date primite ===');
    console.log('ID:', id);
    console.log('Update data:', updateData);

    const updateFields: string[] = [];

    // Câmpuri permise pentru utilizatori normali (fără valori financiare)
    const allowedFields = [
      'proiect_id', 'descriere_lucru', 'data_lucru',
      'ore_lucrate', 'tip_inregistrare'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        if (key === 'data_lucru') {
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

    // FORȚEAZĂ valorile financiare să rămână zero
    updateFields.push('rate_per_hour = 0');
    updateFields.push('valoare_totala = 0');

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nu există câmpuri de actualizat'
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE id = '${escapeString(id)}'
    `;

    console.log('=== DEBUG USER TIME TRACKING PUT: Query UPDATE ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG USER TIME TRACKING PUT: Update executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Înregistrare timp actualizată cu succes'
    });

  } catch (error) {
    console.error('=== EROARE USER TIME TRACKING la actualizare ===');
    console.error('Error details:', error);

    return NextResponse.json({
      success: false,
      error: 'Eroare la actualizarea înregistrării de timp',
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
        error: 'ID înregistrare necesar pentru ștergere'
      }, { status: 400 });
    }

    const deleteQuery = `
      DELETE FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE id = '${escapeString(id)}'
    `;

    console.log('=== DEBUG USER TIME TRACKING DELETE: Query ștergere ===');
    console.log(deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log('=== DEBUG USER TIME TRACKING DELETE: Ștergere executată cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Înregistrare timp ștearsă cu succes'
    });

  } catch (error) {
    console.error('=== EROARE USER TIME TRACKING la ștergere ===');
    console.error('Error details:', error);

    return NextResponse.json({
      success: false,
      error: 'Eroare la ștergerea înregistrării de timp',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// Helper pentru crearea tabelei TimeTracking dacă nu există (conform schema BigQuery)
async function createTimeTrackingTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${dataset}.${table}\` (
      id STRING NOT NULL,
      sarcina_id STRING,
      utilizator_uid STRING NOT NULL,
      utilizator_nume STRING,
      data_lucru DATE NOT NULL,
      ore_lucrate NUMERIC NOT NULL,
      descriere_lucru STRING,
      tip_inregistrare STRING,
      created_at TIMESTAMP,
      proiect_id STRING
    )
  `;

  await bigquery.query({
    query: createTableQuery,
    location: 'EU',
  });

  console.log('✅ Tabela TimeTracking creată cu succes');
}