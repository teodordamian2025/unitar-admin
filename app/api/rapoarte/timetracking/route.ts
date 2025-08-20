// ==================================================================
// CALEA: app/api/rapoarte/timetracking/route.ts
// DATA: 20.08.2025 00:55 (ora României)
// DESCRIERE: API pentru time tracking manual pe sarcini
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

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper pentru formatare DATE BigQuery
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

    // Query pentru înregistrări time tracking cu detalii sarcină
    let query = `
      SELECT 
        tt.id,
        tt.sarcina_id,
        tt.utilizator_uid,
        tt.utilizator_nume,
        tt.data_lucru,
        tt.ore_lucrate,
        tt.descriere_lucru,
        tt.tip_inregistrare,
        tt.created_at,
        -- Detalii sarcină
        s.titlu as sarcina_titlu,
        s.proiect_id,
        s.tip_proiect
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` tt
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Sarcini\` s 
        ON tt.sarcina_id = s.id
      WHERE tt.tip_inregistrare = 'Manual'
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

    if (proiectId) {
      conditions.push('s.proiect_id = @proiectId');
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Sortare după data lucrului descrescător
    query += ' ORDER BY tt.data_lucru DESC, tt.created_at DESC';

    // Limitare pentru performanță
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
      tip_inregistrare = 'Manual'
    } = body;

    // Validări
    if (!id || !sarcina_id || !utilizator_uid || !utilizator_nume || !data_lucru || !ore_lucrate) {
      return NextResponse.json({ 
        success: false,
        error: 'ID, sarcina_id, utilizator_uid, utilizator_nume, data_lucru și ore_lucrate sunt obligatorii' 
      }, { status: 400 });
    }

    const oreLucrateNum = parseFloat(ore_lucrate);
    if (isNaN(oreLucrateNum) || oreLucrateNum <= 0 || oreLucrateNum > 24) {
      return NextResponse.json({ 
        success: false,
        error: 'Orele lucrate trebuie să fie între 0.1 și 24' 
      }, { status: 400 });
    }

    // Verificare dacă data nu este în viitor
    const dataLucruDate = new Date(data_lucru);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Sfârșitul zilei de astăzi
    
    if (dataLucruDate > today) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu poți înregistra timp pentru zile viitoare' 
      }, { status: 400 });
    }

    // Verificare total ore pe ziua respectivă pentru utilizator
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

    if (totalOreNoi > 16) { // Limită flexibilă de 16 ore/zi
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

    // Insert înregistrare timp
    const dataLucruLiteral = formatDateLiteral(data_lucru);

    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, sarcina_id, utilizator_uid, utilizator_nume, data_lucru, 
       ore_lucrate, descriere_lucru, tip_inregistrare, created_at)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(sarcina_id)}',
        '${escapeString(utilizator_uid)}',
        '${escapeString(utilizator_nume)}',
        ${dataLucruLiteral},
        ${oreLucrateNum},
        ${descriere_lucru ? `'${escapeString(descriere_lucru)}'` : 'NULL'},
        '${escapeString(tip_inregistrare)}',
        CURRENT_TIMESTAMP()
      )
    `;

    console.log('Insert time tracking query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Time tracking ${id} adăugat cu succes: ${oreLucrateNum}h pe ${data_lucru}`);

    return NextResponse.json({
      success: true,
      message: 'Timp înregistrat cu succes',
      data: { 
        id, 
        ore_lucrate: oreLucrateNum, 
        data_lucru,
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

    // Validare ore dacă se actualizează
    if (updateData.ore_lucrate) {
      const oreLucrateNum = parseFloat(updateData.ore_lucrate);
      if (isNaN(oreLucrateNum) || oreLucrateNum <= 0 || oreLucrateNum > 24) {
        return NextResponse.json({ 
          success: false,
          error: 'Orele lucrate trebuie să fie între 0.1 și 24' 
        }, { status: 400 });
      }
    }

    // Construire query UPDATE dinamic
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
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
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

    // Ștergere înregistrare timp
    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
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
