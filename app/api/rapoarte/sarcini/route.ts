// ==================================================================
// CALEA: app/api/rapoarte/sarcini/route.ts
// DATA: 20.08.2025 00:45 (ora României)
// DESCRIERE: API CRUD pentru sarcini cu responsabili multipli și time tracking
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
    const proiectId = searchParams.get('proiect_id');
    const tipProiect = searchParams.get('tip_proiect');
    const responsabilUid = searchParams.get('responsabil_uid');
    const status = searchParams.get('status');

    // Query pentru sarcini cu responsabili și time tracking
    let query = `
      SELECT 
        s.id,
        s.proiect_id,
        s.tip_proiect,
        s.titlu,
        s.descriere,
        s.prioritate,
        s.status,
        s.data_creare,
        s.data_scadenta,
        s.data_finalizare,
        s.observatii,
        s.created_by,
        s.updated_at,
        -- Responsabili agregați
        ARRAY_AGG(
          STRUCT(
            sr.responsabil_uid,
            sr.responsabil_nume,
            sr.rol_in_sarcina,
            sr.data_atribuire
          )
        ) as responsabili,
        -- Total ore lucrate
        COALESCE(SUM(tt.ore_lucrate), 0) as total_ore_lucrate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Sarcini\` s
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.SarciniResponsabili\` sr 
        ON s.id = sr.sarcina_id
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.TimeTracking\` tt 
        ON s.id = tt.sarcina_id
      WHERE 1=1
    `;

    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    if (proiectId) {
      conditions.push('s.proiect_id = @proiectId');
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (tipProiect) {
      conditions.push('s.tip_proiect = @tipProiect');
      params.tipProiect = tipProiect;
      types.tipProiect = 'STRING';
    }

    if (responsabilUid) {
      conditions.push('sr.responsabil_uid = @responsabilUid');
      params.responsabilUid = responsabilUid;
      types.responsabilUid = 'STRING';
    }

    if (status) {
      conditions.push('s.status = @status');
      params.status = status;
      types.status = 'STRING';
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += `
      GROUP BY s.id, s.proiect_id, s.tip_proiect, s.titlu, s.descriere, 
               s.prioritate, s.status, s.data_creare, s.data_scadenta, 
               s.data_finalizare, s.observatii, s.created_by, s.updated_at
      ORDER BY s.data_creare DESC
    `;

    console.log('Executing sarcini query:', query);
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
    console.error('Eroare la încărcarea sarcinilor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea sarcinilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST sarcină request body:', body);
    
    const { 
      id,
      proiect_id,
      tip_proiect,
      titlu,
      descriere,
      prioritate = 'Medie',
      status = 'De făcut',
      data_scadenta,
      observatii,
      created_by,
      responsabili = [] // Array cu responsabili
    } = body;

    // Validări
    if (!id || !proiect_id || !titlu || !created_by) {
      return NextResponse.json({ 
        success: false,
        error: 'ID, proiect_id, titlu și created_by sunt obligatorii' 
      }, { status: 400 });
    }

    if (!responsabili || responsabili.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Cel puțin un responsabil este obligatoriu' 
      }, { status: 400 });
    }

    // 1. Inserare sarcină
    const dataScadentaLiteral = formatDateLiteral(data_scadenta);

    const insertSarcinaQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Sarcini\`
      (id, proiect_id, tip_proiect, titlu, descriere, prioritate, status, 
       data_creare, data_scadenta, observatii, created_by, updated_at)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(proiect_id)}',
        '${escapeString(tip_proiect || 'proiect')}',
        '${escapeString(titlu)}',
        ${descriere ? `'${escapeString(descriere)}'` : 'NULL'},
        '${escapeString(prioritate)}',
        '${escapeString(status)}',
        CURRENT_TIMESTAMP(),
        ${dataScadentaLiteral},
        ${observatii ? `'${escapeString(observatii)}'` : 'NULL'},
        '${escapeString(created_by)}',
        CURRENT_TIMESTAMP()
      )
    `;

    console.log('Insert sarcină query:', insertSarcinaQuery);

    await bigquery.query({
      query: insertSarcinaQuery,
      location: 'EU',
    });

    // 2. Inserare responsabili
    for (const responsabil of responsabili) {
      const insertResponsabilQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.SarciniResponsabili\`
        (id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, 
         data_atribuire, atribuit_de)
        VALUES (
          '${escapeString(`${id}_RESP_${responsabil.uid}`)}',
          '${escapeString(id)}',
          '${escapeString(responsabil.uid)}',
          '${escapeString(responsabil.nume_complet || responsabil.nume)}',
          '${escapeString(responsabil.rol || 'Principal')}',
          CURRENT_TIMESTAMP(),
          '${escapeString(created_by)}'
        )
      `;

      console.log('Insert responsabil query:', insertResponsabilQuery);

      await bigquery.query({
        query: insertResponsabilQuery,
        location: 'EU',
      });
    }

    console.log(`Sarcină ${id} adăugată cu succes cu ${responsabili.length} responsabili`);

    return NextResponse.json({
      success: true,
      message: 'Sarcină adăugată cu succes',
      data: { id, titlu, responsabili: responsabili.length }
    });

  } catch (error) {
    console.error('Eroare la adăugarea sarcinii:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea sarcinii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, responsabili_update = false, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID sarcină necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log('Update sarcină:', id, updateData);

    // 1. Update sarcină
    const updateFields: string[] = [];
    const allowedFields = [
      'titlu', 'descriere', 'prioritate', 'status', 'data_scadenta', 
      'data_finalizare', 'observatii'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        if (key === 'data_scadenta' || key === 'data_finalizare') {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
        } else if (key === 'data_finalizare' && value === 'NOW') {
          updateFields.push(`${key} = CURRENT_TIMESTAMP()`);
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else {
          updateFields.push(`${key} = '${escapeString(value.toString())}'`);
        }
      }
    });

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP()');

      const updateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Sarcini\`
        SET ${updateFields.join(', ')}
        WHERE id = '${escapeString(id)}'
      `;

      console.log('Update sarcină query:', updateQuery);

      await bigquery.query({
        query: updateQuery,
        location: 'EU',
      });
    }

    // 2. Update responsabili dacă este cazul
    if (responsabili_update && updateData.responsabili) {
      // Șterge responsabilii existenți
      const deleteResponsabiliQuery = `
        DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.SarciniResponsabili\`
        WHERE sarcina_id = '${escapeString(id)}'
      `;

      await bigquery.query({
        query: deleteResponsabiliQuery,
        location: 'EU',
      });

      // Adaugă responsabilii noi
      for (const responsabil of updateData.responsabili) {
        const insertResponsabilQuery = `
          INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.SarciniResponsabili\`
          (id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, 
           data_atribuire, atribuit_de)
          VALUES (
            '${escapeString(`${id}_RESP_${responsabil.uid}`)}',
            '${escapeString(id)}',
            '${escapeString(responsabil.uid)}',
            '${escapeString(responsabil.nume_complet || responsabil.nume)}',
            '${escapeString(responsabil.rol || 'Principal')}',
            CURRENT_TIMESTAMP(),
            '${escapeString(updateData.updated_by || 'system')}'
          )
        `;

        await bigquery.query({
          query: insertResponsabilQuery,
          location: 'EU',
        });
      }
    }

    console.log(`Sarcină ${id} actualizată cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Sarcină actualizată cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea sarcinii:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea sarcinii',
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
        error: 'ID sarcină necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Șterge responsabilii asociați
    const deleteResponsabiliQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.SarciniResponsabili\`
      WHERE sarcina_id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteResponsabiliQuery,
      location: 'EU',
    });

    // Șterge înregistrările de timp
    const deleteTimeTrackingQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.TimeTracking\`
      WHERE sarcina_id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteTimeTrackingQuery,
      location: 'EU',
    });

    // Șterge sarcina
    const deleteSarcinaQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Sarcini\`
      WHERE id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteSarcinaQuery,
      location: 'EU',
    });

    console.log(`Sarcină ${id} ștearsă cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Sarcină ștearsă cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea sarcinii:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea sarcinii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
