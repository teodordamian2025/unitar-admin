// ==================================================================
// CALEA: app/api/user/timetracking/route.ts
// DATA: 21.09.2025 16:40 (ora României)
// DESCRIERE: API time tracking pentru utilizatori normali
// FUNCȚIONALITATE: CRUD înregistrări timp personal fără date financiare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

console.log(`🔧 User TimeTracking API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: TimeTracking${tableSuffix}, Proiecte${tableSuffix}, Subproiecte${tableSuffix}, Sarcini${tableSuffix}, Utilizatori${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper function pentru validare și escape SQL
// Escapes: single quotes, newlines, carriage returns, backslashes
const escapeString = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')     // Escape backslashes first
    .replace(/'/g, "''")         // Escape single quotes
    .replace(/\n/g, '\\n')       // Escape newlines
    .replace(/\r/g, '\\r');      // Escape carriage returns
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
    // FIX: Acceptă ambele variante pentru compatibilitate: proiect_id (standard codebase) sau project_id (legacy)
    const projectId = searchParams.get('proiect_id') || searchParams.get('project_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log('⏱️ USER TIME TRACKING API PARAMS:', { userId, startDate, endDate, projectId, page, limit });
    console.log(`📊 Using table: ${TABLE_TIME_TRACKING}`);
    console.log(`🔧 V2 Tables enabled: ${useV2Tables}`);

    // Query pentru time tracking utilizatori normali
    // FIX: Eliminat UNION ALL cu PlanificatorPersonal_v2 pentru a evita înregistrări duplicate
    // PIN-ul salvează deja în TimeTracking_v2 la unpin (tip_inregistrare = 'pin_silent')
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

    // ✅ FIX: Filtrare FORȚATĂ pe utilizator (utilizatori normali văd doar propriile înregistrări)
    // Dacă userId nu este furnizat sau este 'utilizator_curent', returnăm eroare
    if (!userId || userId === 'utilizator_curent') {
      return NextResponse.json({
        success: false,
        error: 'user_id este obligatoriu pentru a vizualiza înregistrările de timp'
      }, { status: 400 });
    }

    // ÎNTOTDEAUNA filtrăm pe utilizator pentru securitate
    conditions.push('tt.utilizator_uid = @userId');
    params.userId = userId;
    types.userId = 'STRING';

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

    // Filtrare pe proiect
    if (projectId) {
      conditions.push('tt.proiect_id = @projectId');
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

    console.log(`✅ USER TIME TRACKING LOADED: ${rows.length} results for user_id: ${userId}`);
    if (rows.length > 0) {
      console.log('📋 Sample row:', {
        id: rows[0].id,
        utilizator_uid: rows[0].utilizator_uid,
        data_lucru: rows[0].data_lucru,
        ore_lucrate: rows[0].ore_lucrate,
        proiect_nume: rows[0].proiect_nume
      });
    } else {
      console.log('⚠️ No data found for user_id:', userId, 'between', startDate, 'and', endDate);
      console.log('🔍 Debugging: Check if data exists in TimeTracking_v2 table');
    }

    // Query pentru total count - simplificat (fără UNION)
    // FIX: Eliminat UNION ALL cu PlanificatorPersonal_v2 pentru a evita înregistrări duplicate
    let countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_TIME_TRACKING} tt
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

    // Procesează rezultatele cu context complet - EXCLUDE datele financiare
    const processedData = rows.map((row: any) => ({
      id: row.id,
      utilizator_uid: row.utilizator_uid,
      utilizator_nume: row.utilizator_nume,
      proiect_id: row.proiect_id,
      subproiect_id: row.subproiect_id,
      sarcina_id: row.sarcina_id,
      sarcina_titlu: row.sarcina_nume,
      descriere_lucru: row.task_description,
      task_description: row.task_description,  // ✅ Pentru compatibilitate frontend
      data_lucru: row.data_lucru,
      ore_lucrate: convertBigQueryNumeric(row.ore_lucrate),
      tip_inregistrare: row.tip_inregistrare,
      created_at: row.created_at,
      // Context pentru UI
      tip_obiectiv: row.tip_obiectiv,
      proiect_nume: row.proiect_nume,
      subproiect_nume: row.subproiect_nume,
      // Context complet pentru display
      context_display: [
        row.proiect_nume,
        row.subproiect_nume,
        row.sarcina_nume
      ].filter(Boolean).join(' → '),
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

// Helper pentru obținere nume utilizator din Utilizatori_v2
async function getUserFullName(userId: string): Promise<string> {
  try {
    const query = `
      SELECT nume, prenume
      FROM ${TABLE_UTILIZATORI}
      WHERE uid = @userId
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { userId },
      types: { userId: 'STRING' },
      location: 'EU',
    });

    if (rows.length > 0) {
      const { nume, prenume } = rows[0];
      const fullName = `${nume || ''} ${prenume || ''}`.trim();
      console.log(`[USER-NAME] Găsit nume pentru ${userId}: ${fullName}`);
      return fullName || 'Utilizator';
    }

    console.warn(`[USER-NAME] Nu s-a găsit utilizatorul ${userId} în tabela Utilizatori`);
    return 'Utilizator';
  } catch (error) {
    console.error(`[USER-NAME] Eroare la obținerea numelui pentru ${userId}:`, error);
    return 'Utilizator';
  }
}

// Helper pentru validarea și auto-populate obiective
async function validateAndPopulateObjective(objectiveData: any) {
  const { proiect_id, subproiect_id, sarcina_id } = objectiveData;

  // Validare: cel puțin unul din obiective trebuie specificat
  if (!proiect_id && !subproiect_id && !sarcina_id) {
    throw new Error('Trebuie să specifici cel puțin un obiectiv: proiect, subproiect sau sarcină');
  }

  // Auto-populate logica ierarhică
  let finalProiectId = proiect_id;
  let finalSubproiectId = subproiect_id;
  let finalSarcinaId = sarcina_id;

  // Dacă e specificată sarcina, găsesc proiectul și subproiectul
  if (sarcina_id && !finalProiectId) {
    const sarcinaQuery = `
      SELECT proiect_id, subproiect_id
      FROM ${TABLE_SARCINI}
      WHERE id = @sarcina_id
    `;

    const [sarcinaRows] = await bigquery.query({
      query: sarcinaQuery,
      params: { sarcina_id }
    });

    if (sarcinaRows.length > 0) {
      finalProiectId = sarcinaRows[0].proiect_id;
      finalSubproiectId = sarcinaRows[0].subproiect_id;
    }
  }

  // Dacă e specificat subproiectul, găsesc proiectul
  if (subproiect_id && !finalProiectId) {
    const subproiectQuery = `
      SELECT ID_Proiect as proiect_id
      FROM ${TABLE_SUBPROIECTE}
      WHERE ID_Subproiect = @subproiect_id
    `;

    const [subproiectRows] = await bigquery.query({
      query: subproiectQuery,
      params: { subproiect_id }
    });

    if (subproiectRows.length > 0) {
      finalProiectId = subproiectRows[0].proiect_id;
    }
  }

  return {
    proiect_id: finalProiectId,
    subproiect_id: finalSubproiectId,
    sarcina_id: finalSarcinaId
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST time tracking request pentru user cu obiective multiple:', body);

    const {
      user_id = 'utilizator_curent',
      proiect_id,
      subproiect_id,
      sarcina_id,
      task_description,
      data_lucru,
      duration_minutes,
      start_time,
      end_time
    } = body;

    // Validări de bază
    if (!task_description || !duration_minutes) {
      return NextResponse.json({
        success: false,
        error: 'Câmpurile task_description și duration_minutes sunt obligatorii'
      }, { status: 400 });
    }

    // Validare și auto-populate obiective
    const objectives = await validateAndPopulateObjective({
      proiect_id,
      subproiect_id,
      sarcina_id
    });

    // Obține numele real al utilizatorului din Utilizatori_v2
    const utilizatorNume = await getUserFullName(user_id);
    console.log(`[TIME-TRACKING-POST] User ${user_id} → Nume: ${utilizatorNume}`);

    const dataLucruFormatted = data_lucru ? formatDateLiteral(data_lucru) : 'CURRENT_DATE()';
    const oreCalculate = duration_minutes / 60; // Convertește minutele în ore

    // Generare ID unic pentru înregistrare
    const recordId = `tt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Query cu toate tipurile de obiective
    const insertQuery = `
      INSERT INTO ${TABLE_TIME_TRACKING}
      (id, utilizator_uid, utilizator_nume, proiect_id, subproiect_id, sarcina_id,
       descriere_lucru, data_lucru, ore_lucrate, tip_inregistrare, created_at)
      VALUES (
        '${escapeString(recordId)}',
        '${escapeString(user_id)}',
        '${escapeString(utilizatorNume)}',
        ${objectives.proiect_id ? `'${escapeString(objectives.proiect_id)}'` : 'NULL'},
        ${objectives.subproiect_id ? `'${escapeString(objectives.subproiect_id)}'` : 'NULL'},
        ${objectives.sarcina_id ? `'${escapeString(objectives.sarcina_id)}'` : 'NULL'},
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
      'proiect_id', 'subproiect_id', 'sarcina_id', 'descriere_lucru', 'data_lucru',
      'ore_lucrate', 'duration_minutes', 'tip_inregistrare'
    ];

    // ✅ Conversie câmpuri din UI → câmpuri BigQuery
    // task_description → descriere_lucru
    if (updateData.task_description !== undefined) {
      updateData.descriere_lucru = updateData.task_description;
      delete updateData.task_description;
    }

    // duration_minutes → ore_lucrate (convertește minute în ore)
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

    // ✅ FIX: Șters update pentru coloane inexistente (rate_per_hour, valoare_totala)
    // Aceste coloane nu există în TimeTracking_v2 - datele financiare sunt excluse pentru utilizatori normali

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

    console.log('=== DEBUG USER TIME TRACKING PUT: Query UPDATE ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG USER TIME TRACKING PUT: Update executat ===');

    // Verificare suplimentară - query pentru a vedea dacă înregistrarea există
    const checkQuery = `
      SELECT id, descriere_lucru, ore_lucrate
      FROM ${TABLE_TIME_TRACKING}
      WHERE id = '${escapeString(id)}'
      LIMIT 1
    `;

    console.log('=== DEBUG USER TIME TRACKING PUT: Verificare după UPDATE ===');
    const [checkRows] = await bigquery.query({
      query: checkQuery,
      location: 'EU',
    });

    if (checkRows.length === 0) {
      console.error('⚠️ ATENȚIE: Înregistrarea cu ID', id, 'NU EXISTĂ în tabela TimeTracking_v2!');
      return NextResponse.json({
        success: false,
        error: `Înregistrarea cu ID ${id} nu a fost găsită în baza de date. Posibil provenită din PlanificatorPersonal_v2 (read-only).`
      }, { status: 404 });
    }

    console.log('✅ Verificare după UPDATE - înregistrarea există:', checkRows[0]);

    return NextResponse.json({
      success: true,
      message: 'Înregistrare timp actualizată cu succes',
      data: checkRows[0]
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
    // FIX: Citește id din body JSON (ca la PUT), nu din query params
    const body = await request.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID înregistrare necesar pentru ștergere'
      }, { status: 400 });
    }

    const deleteQuery = `
      DELETE FROM ${TABLE_TIME_TRACKING}
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
    CREATE TABLE IF NOT EXISTS ${TABLE_TIME_TRACKING} (
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