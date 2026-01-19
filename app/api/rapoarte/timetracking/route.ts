// ==================================================================
// CALEA: app/api/rapoarte/timetracking/route.ts
// DATA: 21.08.2025 02:20 (ora României)
// MODIFICAT: Adăugat proiect_id pentru denormalizare + păstrate toate funcționalitățile existente
// PĂSTRATE: Toate funcționalitățile din versiunea anterioară + validări + filtrări
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// ✅ V2 Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

console.log(`🔧 TimeTracking API - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = DATASET;
const table = `TimeTracking${tableSuffix}`;
const TIMETRACKING_TABLE = `\`${PROJECT_ID}.${DATASET}.${table}\``;
const SARCINI_TABLE = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;

// Helper function pentru escape SQL - PĂSTRAT
// Escapes: single quotes, newlines, carriage returns, backslashes
const escapeString = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')     // Escape backslashes first
    .replace(/'/g, "''")         // Escape single quotes
    .replace(/\n/g, '\\n')       // Escape newlines
    .replace(/\r/g, '\\r');      // Escape carriage returns
};

// Helper pentru formatare DATE BigQuery - PĂSTRAT
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sarcinaId = searchParams.get('sarcina_id');
    const utilizatorUid = searchParams.get('utilizator_uid');
    const dataLucru = searchParams.get('data_lucru');
    const proiectId = searchParams.get('proiect_id');
    const validareLimita = searchParams.get('validare_limita');

    // ADĂUGAT: Pentru validarea limitei de 8/16 ore pe zi
    if (validareLimita === 'true' && utilizatorUid && dataLucru) {
      const validareQuery = `
        SELECT COALESCE(SUM(ore_lucrate), 0) as total_ore_ziua
        FROM ${TIMETRACKING_TABLE}
        WHERE utilizator_uid = @utilizator_uid 
        AND data_lucru = @data_lucru
      `;

      const [rows] = await bigquery.query({
        query: validareQuery,
        params: { utilizator_uid: utilizatorUid, data_lucru: dataLucru },
        types: { utilizator_uid: 'STRING', data_lucru: 'DATE' },
        location: 'EU',
      });

      return NextResponse.json({
        success: true,
        total_ore_ziua: parseFloat(rows[0]?.total_ore_ziua || 0)
      });
    }

    // ACTUALIZAT: Query pentru înregistrări time tracking cu detalii sarcină + proiect_id + subproiect_id
    // FIX 19.01.2026: Adăugat JOIN-uri cu Subproiecte pentru filtrare corectă pe proiect
    const SUBPROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;

    let query = `
      SELECT
        tt.id,
        tt.sarcina_id,
        tt.proiect_id,
        tt.subproiect_id,
        tt.utilizator_uid,
        tt.utilizator_nume,
        tt.data_lucru,
        tt.ore_lucrate,
        tt.descriere_lucru,
        tt.tip_inregistrare,
        tt.created_at,
        -- Detalii sarcină
        s.titlu as sarcina_titlu,
        s.proiect_id as sarcina_proiect_id,
        s.tip_proiect
      FROM ${TIMETRACKING_TABLE} tt
      LEFT JOIN ${SARCINI_TABLE} s
        ON tt.sarcina_id = s.id
      -- FIX: JOIN pentru a verifica dacă subproiectul asociat direct aparține proiectului
      LEFT JOIN ${SUBPROIECTE_TABLE} sp
        ON tt.subproiect_id = sp.ID_Subproiect
      -- FIX: JOIN pentru a verifica dacă sarcina e pe un subproiect care aparține proiectului
      LEFT JOIN ${SUBPROIECTE_TABLE} sp_sarcina
        ON s.tip_proiect = 'subproiect' AND s.proiect_id = sp_sarcina.ID_Subproiect
      WHERE 1=1
    `;

    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    if (sarcinaId) {
      conditions.push('tt.sarcina_id = @sarcinaId');
      params.sarcinaId = sarcinaId;
      types.sarcinaId = 'STRING';
    }

    if (utilizatorUid) {
      conditions.push('tt.utilizator_uid = @utilizatorUid');
      params.utilizatorUid = utilizatorUid;
      types.utilizatorUid = 'STRING';
    }

    if (dataLucru) {
      conditions.push('tt.data_lucru = @dataLucru');
      params.dataLucru = dataLucru;
      types.dataLucru = 'DATE';
    }

    // FIX 19.01.2026: Filtrare corectă pentru a include doar înregistrările care aparțin proiectului specificat
    // Include:
    // 1. Înregistrări directe pe proiect (tt.proiect_id = proiectId)
    // 2. Înregistrări pe subproiect al proiectului (sp.ID_Proiect = proiectId)
    // 3. Înregistrări pe sarcină directă pe proiect (s.tip_proiect = 'proiect' AND s.proiect_id = proiectId)
    // 4. Înregistrări pe sarcină pe subproiect al proiectului (s.tip_proiect = 'subproiect' AND sp_sarcina.ID_Proiect = proiectId)
    if (proiectId) {
      conditions.push(`(
        tt.proiect_id = @proiectId
        OR sp.ID_Proiect = @proiectId
        OR (s.tip_proiect = 'proiect' AND s.proiect_id = @proiectId)
        OR (s.tip_proiect = 'subproiect' AND sp_sarcina.ID_Proiect = @proiectId)
      )`);
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Sortare după data lucrului descrescător - PĂSTRAT
    query += ' ORDER BY tt.data_lucru DESC, tt.created_at DESC';

    // Limitare pentru performanță - PĂSTRAT
    const limit = searchParams.get('limit');
    if (limit && !isNaN(Number(limit))) {
      query += ` LIMIT ${Number(limit)}`;
    } else {
      query += ' LIMIT 200';
    }

    console.log('Executing time tracking query:', query);
    console.log('With params:', params);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea time tracking:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea time tracking',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST time tracking request body:', body);
    
    const {
      id,
      sarcina_id,
      utilizator_uid,
      utilizator_nume,
      data_lucru,
      ore_lucrate,
      descriere_lucru,
      tip_inregistrare = 'manual',
      proiect_id,
      subproiect_id
    } = body;

    // Validări - PĂSTRATE
    if (!id || !utilizator_uid || !utilizator_nume || !data_lucru || !ore_lucrate) {
      return NextResponse.json({
        success: false,
        error: 'ID, utilizator_uid, utilizator_nume, data_lucru și ore_lucrate sunt obligatorii. sarcina_id este opțională pentru timp direct pe proiect/subproiect.'
      }, { status: 400 });
    }

    const oreLucrateNum = parseFloat(ore_lucrate);
    if (isNaN(oreLucrateNum) || oreLucrateNum <= 0 || oreLucrateNum > 24) {
      return NextResponse.json({ 
        success: false,
        error: 'Orele lucrate trebuie să fie între 0.1 și 24' 
      }, { status: 400 });
    }

    // Verificare dacă data nu este în viitor - PĂSTRAT
    const dataLucruDate = new Date(data_lucru);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (dataLucruDate > today) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu poți înregistra timp pentru zile viitoare' 
      }, { status: 400 });
    }

    // ADĂUGAT: Obține proiect_id din sarcină sau din request direct
    let proiect_id_for_storage = proiect_id; // Pentru când se înregistrează direct pe proiect/subproiect

    if (sarcina_id) {
      // Dacă avem sarcină, verifică că există și obține proiect_id din ea
      const sarcinaQuery = `
        SELECT proiect_id
        FROM ${SARCINI_TABLE}
        WHERE id = @sarcina_id
      `;

      const [sarcinaRows] = await bigquery.query({
        query: sarcinaQuery,
        params: { sarcina_id },
        types: { sarcina_id: 'STRING' },
        location: 'EU',
      });

      if (sarcinaRows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Sarcina specificată nu există'
        }, { status: 404 });
      }

      proiect_id_for_storage = sarcinaRows[0].proiect_id;
    } else {
      // Fără sarcină - verifică că avem cel puțin proiect_id sau subproiect_id
      if (!proiect_id && !subproiect_id) {
        return NextResponse.json({
          success: false,
          error: 'Pentru înregistrare fără sarcină, trebuie specificat proiect_id sau subproiect_id'
        }, { status: 400 });
      }
    }

    // Verificare total ore pe ziua respectivă pentru utilizator - PĂSTRAT
    const checkTotalQuery = `
      SELECT SUM(ore_lucrate) as total_ore
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE utilizator_uid = @utilizatorUid 
        AND data_lucru = @dataLucru
        AND id != @currentId
    `;

    const [totalRows] = await bigquery.query({
      query: checkTotalQuery,
      params: { 
        utilizatorUid: utilizator_uid, 
        dataLucru: data_lucru,
        currentId: id 
      },
      types: { 
        utilizatorUid: 'STRING', 
        dataLucru: 'DATE',
        currentId: 'STRING'
      },
      location: 'EU',
    });

    const totalOreExistente = totalRows[0]?.total_ore || 0;
    const totalOreNoi = totalOreExistente + oreLucrateNum;

    // Limită flexibilă de 16 ore/zi - PĂSTRAT
    if (totalOreNoi > 16) {
      return NextResponse.json({ 
        success: false,
        error: `Limită depășită! Total ore pe ${data_lucru}: ${totalOreNoi.toFixed(2)}h. Maxim permis: 16h.`,
        details: {
          ore_existente: totalOreExistente,
          ore_noi: oreLucrateNum,
          total: totalOreNoi
        }
      }, { status: 400 });
    }

    // ACTUALIZAT: Insert înregistrare timp cu proiect_id și subproiect_id
    const dataLucruLiteral = formatDateLiteral(data_lucru);

    // Încearcă să adauge coloana subproiect_id dacă nu există
    try {
      const alterQuery = `
        ALTER TABLE ${TIMETRACKING_TABLE}
        ADD COLUMN IF NOT EXISTS subproiect_id STRING
      `;
      await bigquery.query({ query: alterQuery, location: 'EU' });
      console.log('Coloana subproiect_id verificată/adăugată cu succes');
    } catch (alterError) {
      console.log('Coloana subproiect_id există deja sau eroare minora:', alterError.message);
    }

    const insertQuery = `
      INSERT INTO ${TIMETRACKING_TABLE}
      (id, sarcina_id, proiect_id, subproiect_id, utilizator_uid, utilizator_nume, data_lucru,
       ore_lucrate, descriere_lucru, tip_inregistrare, created_at)
      VALUES (
        '${escapeString(id)}',
        ${sarcina_id ? `'${escapeString(String(sarcina_id))}'` : 'NULL'},
        ${proiect_id_for_storage ? `'${escapeString(String(proiect_id_for_storage))}'` : 'NULL'},
        ${subproiect_id ? `'${escapeString(String(subproiect_id))}'` : 'NULL'},
        '${escapeString(utilizator_uid)}',
        '${escapeString(utilizator_nume)}',
        ${dataLucruLiteral},
        ${oreLucrateNum},
        ${descriere_lucru ? `'${escapeString(descriere_lucru)}'` : 'NULL'},
        '${escapeString(tip_inregistrare)}',
        CURRENT_TIMESTAMP()
      )
    `;

    console.log('Insert time tracking query cu proiect_id:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Time tracking ${id} adăugat cu succes: ${oreLucrateNum}h pe ${data_lucru} pentru proiectul ${proiect_id}`);

    return NextResponse.json({
      success: true,
      message: 'Timp înregistrat cu succes',
      data: { 
        id, 
        ore_lucrate: oreLucrateNum, 
        data_lucru,
        proiect_id,
        total_ore_zi: totalOreNoi 
      }
    });

  } catch (error) {
    console.error('Eroare la înregistrarea timpului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la înregistrarea timpului',
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

    console.log('Update time tracking:', id, updateData);

    // Validare ore dacă se actualizează - PĂSTRAT
    if (updateData.ore_lucrate) {
      const oreLucrateNum = parseFloat(updateData.ore_lucrate);
      if (isNaN(oreLucrateNum) || oreLucrateNum <= 0 || oreLucrateNum > 24) {
        return NextResponse.json({ 
          success: false,
          error: 'Orele lucrate trebuie să fie între 0.1 și 24' 
        }, { status: 400 });
      }
    }

    // Construire query UPDATE dinamic - PĂSTRAT
    const updateFields: string[] = [];
    const allowedFields = ['ore_lucrate', 'descriere_lucru', 'data_lucru'];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        if (key === 'data_lucru') {
          const dataLiteral = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${dataLiteral}`);
        } else if (key === 'ore_lucrate') {
          updateFields.push(`${key} = ${parseFloat(value as string)}`);
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
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
      UPDATE ${TIMETRACKING_TABLE}
      SET ${updateFields.join(', ')}
      WHERE id = '${escapeString(id)}'
    `;

    console.log('Update time tracking query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log(`Time tracking ${id} actualizat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Înregistrare timp actualizată cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea time tracking:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea înregistrării timp',
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

    // Ștergere înregistrare timp - PĂSTRAT
    const deleteQuery = `
      DELETE FROM ${TIMETRACKING_TABLE}
      WHERE id = '${escapeString(id)}'
    `;

    console.log('Delete time tracking query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Time tracking ${id} șters cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Înregistrare timp ștearsă cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea time tracking:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea înregistrării timp',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
