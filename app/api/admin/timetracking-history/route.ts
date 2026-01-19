// ==================================================================
// CALEA: app/api/admin/timetracking-history/route.ts
// DATA: 19.01.2026 (ora României)
// DESCRIERE: API pentru istoric time tracking - acces admin la toate înregistrările
// FUNCȚIONALITATE: Lista, filtrare, sortare și editare înregistrări timp toate utilizatorilor
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// Tabele cu suffix dinamic
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

console.log(`🔧 Admin TimeTracking History API - Tables Mode: ${useV2Tables ? 'V2 (Optimized)' : 'V1 (Standard)'}`);

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

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parametri filtrare
    const userId = searchParams.get('user_id');
    const projectId = searchParams.get('project_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const search = searchParams.get('search');

    // Parametri sortare
    const sortBy = searchParams.get('sort_by') || 'date'; // date, project, duration, user
    const sortOrder = searchParams.get('sort_order') || 'desc'; // asc, desc

    // Paginare
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log('📊 ADMIN TIME TRACKING HISTORY API PARAMS:', {
      userId, projectId, startDate, endDate, search, sortBy, sortOrder, page, limit
    });

    // Construiește query-ul principal
    let baseQuery = `
      SELECT
        tt.id,
        tt.utilizator_uid,
        COALESCE(tt.utilizator_nume, u.nume, u.email) as utilizator_nume,
        tt.proiect_id,
        tt.subproiect_id,
        tt.sarcina_id,
        tt.descriere_lucru as task_description,
        tt.data_lucru,
        tt.ore_lucrate,
        tt.tip_inregistrare,
        tt.created_at,
        p.Denumire as proiect_nume,
        sp.Denumire as subproiect_nume,
        s.titlu as sarcina_nume,
        CASE
          WHEN tt.sarcina_id IS NOT NULL THEN 'sarcina'
          WHEN tt.subproiect_id IS NOT NULL THEN 'subproiect'
          ELSE 'proiect'
        END as tip_obiectiv
      FROM ${TABLE_TIME_TRACKING} tt
      LEFT JOIN ${TABLE_UTILIZATORI} u ON tt.utilizator_uid = u.uid
      LEFT JOIN ${TABLE_PROIECTE} p ON tt.proiect_id = p.ID_Proiect
      LEFT JOIN ${TABLE_SUBPROIECTE} sp ON tt.subproiect_id = sp.ID_Subproiect
      LEFT JOIN ${TABLE_SARCINI} s ON tt.sarcina_id = s.id
    `;

    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtrare pe utilizator
    if (userId) {
      conditions.push('tt.utilizator_uid = @userId');
      params.userId = userId;
      types.userId = 'STRING';
    }

    // Filtrare pe proiect
    if (projectId) {
      conditions.push('tt.proiect_id = @projectId');
      params.projectId = projectId;
      types.projectId = 'STRING';
    }

    // Filtrare pe interval de date
    if (startDate) {
      conditions.push('tt.data_lucru >= @startDate');
      params.startDate = startDate;
      types.startDate = 'DATE';
    }

    if (endDate) {
      conditions.push('tt.data_lucru <= @endDate');
      params.endDate = endDate;
      types.endDate = 'DATE';
    }

    // Căutare în descriere
    if (search) {
      conditions.push(`(
        LOWER(tt.descriere_lucru) LIKE LOWER(@search) OR
        LOWER(COALESCE(tt.utilizator_nume, u.nume)) LIKE LOWER(@search) OR
        LOWER(p.Denumire) LIKE LOWER(@search) OR
        LOWER(tt.proiect_id) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare
    let orderClause = '';
    switch (sortBy) {
      case 'date':
        orderClause = `tt.data_lucru ${sortOrder.toUpperCase()}, tt.created_at ${sortOrder.toUpperCase()}`;
        break;
      case 'project':
        orderClause = `p.Denumire ${sortOrder.toUpperCase()}, tt.data_lucru DESC`;
        break;
      case 'duration':
        orderClause = `tt.ore_lucrate ${sortOrder.toUpperCase()}, tt.data_lucru DESC`;
        break;
      case 'user':
        orderClause = `utilizator_nume ${sortOrder.toUpperCase()}, tt.data_lucru DESC`;
        break;
      default:
        orderClause = `tt.data_lucru DESC, tt.created_at DESC`;
    }

    baseQuery += ` ORDER BY ${orderClause}`;
    baseQuery += ` LIMIT @limit OFFSET @offset`;

    params.limit = limit;
    params.offset = offset;
    types.limit = 'INT64';
    types.offset = 'INT64';

    // Execută query-ul principal
    const [rows] = await bigquery.query({
      query: baseQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`✅ ADMIN TIME TRACKING HISTORY: ${rows.length} results`);

    // Query pentru total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_TIME_TRACKING} tt
      LEFT JOIN ${TABLE_UTILIZATORI} u ON tt.utilizator_uid = u.uid
      LEFT JOIN ${TABLE_PROIECTE} p ON tt.proiect_id = p.ID_Proiect
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

    // Procesează rezultatele
    const processedData = rows.map((row: any) => ({
      id: row.id,
      utilizator_uid: row.utilizator_uid,
      utilizator_nume: row.utilizator_nume || 'Utilizator necunoscut',
      proiect_id: row.proiect_id,
      subproiect_id: row.subproiect_id,
      sarcina_id: row.sarcina_id,
      sarcina_titlu: row.sarcina_nume,
      descriere_lucru: row.task_description,
      task_description: row.task_description,
      data_lucru: row.data_lucru,
      ore_lucrate: convertBigQueryNumeric(row.ore_lucrate),
      tip_inregistrare: row.tip_inregistrare,
      created_at: row.created_at,
      tip_obiectiv: row.tip_obiectiv,
      proiect_nume: row.proiect_nume,
      subproiect_nume: row.subproiect_nume,
      context_display: [
        row.proiect_nume,
        row.subproiect_nume,
        row.sarcina_nume
      ].filter(Boolean).join(' → ')
    }));

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
    console.error('❌ EROARE ADMIN TIME TRACKING HISTORY:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la încărcarea istoricului time tracking',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizare înregistrare (admin poate edita orice înregistrare)
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

    console.log('📝 ADMIN TIME TRACKING PUT:', { id, updateData });

    const updateFields: string[] = [];

    // Câmpuri permise pentru actualizare
    const allowedFields = [
      'proiect_id', 'subproiect_id', 'sarcina_id', 'descriere_lucru', 'data_lucru',
      'ore_lucrate', 'duration_minutes', 'tip_inregistrare', 'utilizator_nume'
    ];

    // Conversie câmpuri din UI → câmpuri BigQuery
    if (updateData.task_description !== undefined) {
      updateData.descriere_lucru = updateData.task_description;
      delete updateData.task_description;
    }

    if (updateData.duration_minutes !== undefined) {
      updateData.ore_lucrate = updateData.duration_minutes / 60;
      delete updateData.duration_minutes;
    }

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

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nu există câmpuri de actualizat'
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE ${TABLE_TIME_TRACKING}
      SET ${updateFields.join(', ')}
      WHERE id = '${escapeString(id)}'
    `;

    console.log('📝 ADMIN TIME TRACKING UPDATE QUERY:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    // Verificare după update
    const checkQuery = `
      SELECT id, descriere_lucru, ore_lucrate, utilizator_nume
      FROM ${TABLE_TIME_TRACKING}
      WHERE id = '${escapeString(id)}'
      LIMIT 1
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      location: 'EU',
    });

    if (checkRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Înregistrarea cu ID ${id} nu a fost găsită`
      }, { status: 404 });
    }

    console.log('✅ ADMIN TIME TRACKING UPDATE SUCCESS:', checkRows[0]);

    return NextResponse.json({
      success: true,
      message: 'Înregistrare actualizată cu succes',
      data: checkRows[0]
    });

  } catch (error) {
    console.error('❌ EROARE ADMIN TIME TRACKING PUT:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la actualizarea înregistrării',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Ștergere înregistrare (admin poate șterge orice înregistrare)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID înregistrare necesar pentru ștergere'
      }, { status: 400 });
    }

    console.log('🗑️ ADMIN TIME TRACKING DELETE:', id);

    const deleteQuery = `
      DELETE FROM ${TABLE_TIME_TRACKING}
      WHERE id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log('✅ ADMIN TIME TRACKING DELETE SUCCESS');

    return NextResponse.json({
      success: true,
      message: 'Înregistrare ștearsă cu succes'
    });

  } catch (error) {
    console.error('❌ EROARE ADMIN TIME TRACKING DELETE:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la ștergerea înregistrării',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// GET pentru lista utilizatori unici (pentru dropdown filtru)
export async function OPTIONS(request: NextRequest) {
  try {
    const usersQuery = `
      SELECT DISTINCT
        tt.utilizator_uid,
        COALESCE(tt.utilizator_nume, u.nume, u.email) as utilizator_nume
      FROM ${TABLE_TIME_TRACKING} tt
      LEFT JOIN ${TABLE_UTILIZATORI} u ON tt.utilizator_uid = u.uid
      WHERE tt.utilizator_uid IS NOT NULL
      ORDER BY utilizator_nume
    `;

    const projectsQuery = `
      SELECT DISTINCT
        tt.proiect_id,
        p.Denumire as proiect_nume
      FROM ${TABLE_TIME_TRACKING} tt
      LEFT JOIN ${TABLE_PROIECTE} p ON tt.proiect_id = p.ID_Proiect
      WHERE tt.proiect_id IS NOT NULL
      ORDER BY proiect_nume
    `;

    const [usersRows] = await bigquery.query({
      query: usersQuery,
      location: 'EU',
    });

    const [projectsRows] = await bigquery.query({
      query: projectsQuery,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      users: usersRows.map((row: any) => ({
        uid: row.utilizator_uid,
        name: row.utilizator_nume || 'Utilizator necunoscut'
      })),
      projects: projectsRows.map((row: any) => ({
        id: row.proiect_id,
        name: row.proiect_nume || row.proiect_id
      }))
    });

  } catch (error) {
    console.error('❌ EROARE LA OBȚINEREA FILTRELOR:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea opțiunilor de filtrare'
    }, { status: 500 });
  }
}
