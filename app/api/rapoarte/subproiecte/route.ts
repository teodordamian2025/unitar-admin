// ==================================================================
// CALEA: app/api/rapoarte/subproiecte/route.ts
// DATA: 24.08.2025 22:15 (ora României)
// FIX: data_curs_valutar cu literale SQL ca la Proiecte
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// ✅ V2 Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

console.log(`🔧 Subproiecte API - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = DATASET;
const table = `Subproiecte${tableSuffix}`;
const SUBPROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.${table}\``;
const PROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

// ADĂUGAT: Helper functions ca la Proiecte
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

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

    // MODIFICAT 08.01.2026: Adăugat CTE pentru toti responsabilii subproiect (Principal, Normal, Observator)
    // FIX 10.01.2026: Adăugat email în STRUCT pentru a fi disponibil în ProiectEditModal
    // ✅ 21.01.2026: Adăugat CTEs pentru progres economic
    let query = `
      WITH responsabili_subproiect AS (
        SELECT
          sr.subproiect_id,
          ARRAY_AGG(
            STRUCT(
              sr.responsabil_uid,
              sr.responsabil_nume,
              sr.rol_in_subproiect as rol_in_proiect,
              u.prenume,
              u.nume,
              u.email
            )
            ORDER BY
              CASE sr.rol_in_subproiect
                WHEN 'Principal' THEN 1
                WHEN 'Normal' THEN 2
                WHEN 'Observator' THEN 3
                ELSE 4
              END,
              sr.data_atribuire ASC
          ) as responsabili
        FROM \`${PROJECT_ID}.${DATASET}.SubproiecteResponsabili${tableSuffix}\` sr
        LEFT JOIN \`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\` u
          ON sr.responsabil_uid = u.uid
        GROUP BY sr.subproiect_id
      ),
      -- ✅ 21.01.2026: CTE pentru ore lucrate per subproiect (pentru progres economic)
      time_tracking_stats AS (
        SELECT
          subproiect_id,
          SUM(ore_lucrate) as total_worked_hours
        FROM \`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\`
        WHERE subproiect_id IS NOT NULL
        GROUP BY subproiect_id
      ),
      -- ✅ 21.01.2026: CTE pentru cheltuieli per subproiect
      cheltuieli_stats AS (
        SELECT
          subproiect_id,
          SUM(valoare_ron) as total_cheltuieli_ron
        FROM \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\`
        WHERE subproiect_id IS NOT NULL
        GROUP BY subproiect_id
      ),
      -- ✅ 21.01.2026: CTE pentru setări cost orar
      cost_settings AS (
        SELECT
          COALESCE(cost_ora, 50) as cost_ora
        FROM \`${PROJECT_ID}.${DATASET}.SetariCosturiOrar${tableSuffix}\`
        WHERE activ = true
        ORDER BY data_creare DESC
        LIMIT 1
      )
      SELECT
        s.*,
        p.Client,
        p.Denumire as Proiect_Denumire,
        COALESCE(rs.responsabili, []) as responsabili_toti,
        -- ✅ 21.01.2026: Progres economic calculat pentru subproiecte
        ROUND(
          SAFE_DIVIDE(
            COALESCE(tts.total_worked_hours, 0) * 100,
            NULLIF(
              SAFE_DIVIDE(
                COALESCE(s.Valoare_Estimata, 0) - (
                  CASE
                    WHEN s.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
                    ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(s.curs_valutar, 0)
                  END
                ),
                csett.cost_ora
              ),
              0
            )
          ),
          1
        ) as progres_economic
      FROM ${SUBPROIECTE_TABLE} s
      LEFT JOIN ${PROIECTE_TABLE} p
        ON s.ID_Proiect = p.ID_Proiect
      LEFT JOIN responsabili_subproiect rs
        ON rs.subproiect_id = s.ID_Subproiect
      LEFT JOIN time_tracking_stats tts
        ON tts.subproiect_id = s.ID_Subproiect
      LEFT JOIN cheltuieli_stats chs
        ON chs.subproiect_id = s.ID_Subproiect
      CROSS JOIN cost_settings csett
      WHERE (s.activ IS NULL OR s.activ = true)
    `;
    
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre existente - PĂSTRATE
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(s.ID_Subproiect) LIKE LOWER(@search) OR 
        LOWER(s.Denumire) LIKE LOWER(@search) OR 
        LOWER(COALESCE(s.Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Client, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    const status = searchParams.get('status');
    if (status) {
      conditions.push('s.Status = @status');
      params.status = status;
      types.status = 'STRING';
    }

    const proiectId = searchParams.get('proiect_id');
    if (proiectId) {
      conditions.push('s.ID_Proiect = @proiectId');
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.ID_Proiect, s.data_creare ASC';

    console.log('Executing subproiecte query:', query);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`Found ${rows.length} subproiecte`);

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea subproiectelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea subproiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST subproiect request body:', body);
    
    const { 
      ID_Subproiect, 
      ID_Proiect,
      Denumire, 
      Responsabil,
      Data_Start, 
      Data_Final, 
      Status = 'Activ', 
      Valoare_Estimata,
      moneda = 'RON',
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      status_predare = 'Nepredat',
      status_contract = 'Nu e cazul',
      status_facturare = 'Nefacturat',
      status_achitare = 'Neachitat'
    } = body;

    // Validări
    if (!ID_Subproiect || !ID_Proiect || !Denumire) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile ID_Subproiect, ID_Proiect și Denumire sunt obligatorii' 
      }, { status: 400 });
    }

    // FIX PRINCIPAL: Debug date primite
    console.log('=== DEBUG SUBPROIECTE: Date primite ===');
    console.log('Data_Start primit:', Data_Start);
    console.log('Data_Final primit:', Data_Final);
    console.log('data_curs_valutar primit:', data_curs_valutar);

    // FIX PRINCIPAL: Formatare DATE literale ca la Proiecte
    const dataStartFormatted = formatDateLiteral(Data_Start);
    const dataFinalFormatted = formatDateLiteral(Data_Final);
    const dataCursFormatted = formatDateLiteral(data_curs_valutar);

    console.log('=== DEBUG SUBPROIECTE: Date formatate pentru BigQuery ===');
    console.log('Data_Start formatată:', dataStartFormatted);
    console.log('Data_Final formatată:', dataFinalFormatted);
    console.log('data_curs_valutar formatată:', dataCursFormatted);

    // FIX PRINCIPAL: Query cu DATE literale în loc de parameters
    const insertQuery = `
      INSERT INTO ${SUBPROIECTE_TABLE}
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, 
       Status, Valoare_Estimata, activ, data_creare,
       moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare)
      VALUES (
        '${escapeString(ID_Subproiect)}',
        '${escapeString(ID_Proiect)}',
        '${escapeString(Denumire)}',
        ${Responsabil ? `'${escapeString(Responsabil)}'` : 'NULL'},
        ${dataStartFormatted},
        ${dataFinalFormatted},
        '${escapeString(Status)}',
        ${Valoare_Estimata || 'NULL'},
        true,
        CURRENT_TIMESTAMP(),
        '${escapeString(moneda)}',
        ${curs_valutar || 'NULL'},
        ${dataCursFormatted},
        ${valoare_ron || 'NULL'},
        '${escapeString(status_predare)}',
        '${escapeString(status_contract)}',
        '${escapeString(status_facturare)}',
        '${escapeString(status_achitare)}'
      )
    `;

    console.log('=== DEBUG SUBPROIECTE: Query INSERT final ===');
    console.log(insertQuery);

    // Executare query fără parameters pentru DATE fields
    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`✅ Subproiect ${ID_Subproiect} adăugat cu succes pentru proiectul ${ID_Proiect} cu data_curs_valutar: ${dataCursFormatted}`);

    return NextResponse.json({
      success: true,
      message: 'Subproiect adăugat cu succes',
      data: { ID_Subproiect, ID_Proiect }
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la adăugarea subproiectului ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea subproiectului',
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
        error: 'ID subproiect necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log('=== DEBUG PUT SUBPROIECTE: Date primite pentru actualizare ===');
    console.log('ID:', id);
    console.log('Update data:', updateData);

    // FIX: Construire query UPDATE cu DATE literale
    const updateFields: string[] = [];

    const allowedFields = [
      'Denumire', 'Responsabil', 'Data_Start', 'Data_Final', 'Status', 'Valoare_Estimata',
      'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'status_predare', 'status_contract', 'status_facturare', 'status_achitare'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        // FIX: Tratament special pentru câmpurile DATE
        if (['Data_Start', 'Data_Final', 'data_curs_valutar'].includes(key)) {
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

    // Adaugă data_actualizare
    updateFields.push('data_actualizare = CURRENT_TIMESTAMP()');

    const updateQuery = `
      UPDATE ${SUBPROIECTE_TABLE}
      SET ${updateFields.join(', ')}
      WHERE ID_Subproiect = '${escapeString(id)}'
    `;

    console.log('=== DEBUG PUT SUBPROIECTE: Query UPDATE cu DATE literale ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT SUBPROIECTE: Update executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Subproiect actualizat cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la actualizarea subproiectului ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea subproiectului',
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
        error: 'ID subproiect necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete cu câmpul activ
    const deleteQuery = `
      UPDATE ${SUBPROIECTE_TABLE}
      SET activ = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Subproiect = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`✅ Subproiect ${id} șters (soft delete)`);

    return NextResponse.json({
      success: true,
      message: 'Subproiect șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea subproiectului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea subproiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
