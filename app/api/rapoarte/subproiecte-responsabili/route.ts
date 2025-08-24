// ==================================================================
// CALEA: app/api/rapoarte/subproiecte-responsabili/route.ts
// DATA: 24.08.2025 21:30 (ora României)
// DESCRIERE: API pentru gestionarea responsabililor la subproiecte
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
const table = 'SubproiecteResponsabili';

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subproiectId = searchParams.get('subproiect_id');
    
    if (!subproiectId) {
      return NextResponse.json({ 
        success: false,
        error: 'subproiect_id este necesar' 
      }, { status: 400 });
    }

    const query = `
      SELECT 
        sr.*,
        u.email,
        u.prenume,
        u.nume,
        u.rol as rol_sistem
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` sr
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Utilizatori\` u 
        ON sr.responsabil_uid = u.uid
      WHERE sr.subproiect_id = @subproiectId
      ORDER BY 
        CASE sr.rol_in_subproiect 
          WHEN 'Principal' THEN 1 
          WHEN 'Normal' THEN 2 
          WHEN 'Observator' THEN 3 
          ELSE 4 
        END,
        sr.data_atribuire ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { subproiectId },
      types: { subproiectId: 'STRING' },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea responsabililor subproiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea responsabililor subproiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST responsabil subproiect request:', body);
    
    const { 
      id,
      subproiect_id,
      responsabil_uid,
      responsabil_nume,
      rol_in_subproiect = 'Normal',
      data_atribuire,
      atribuit_de
    } = body;

    // Validări
    if (!id || !subproiect_id || !responsabil_uid || !responsabil_nume) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile id, subproiect_id, responsabil_uid și responsabil_nume sunt obligatorii' 
      }, { status: 400 });
    }

    // Verifică dacă responsabilul este deja atribuit la acest subproiect
    const checkQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE subproiect_id = @subproiectId AND responsabil_uid = @responsabilUid
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: { 
        subproiectId: subproiect_id,
        responsabilUid: responsabil_uid
      },
      types: { 
        subproiectId: 'STRING',
        responsabilUid: 'STRING'
      },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Responsabilul este deja atribuit la acest subproiect' 
      }, { status: 409 });
    }

    // Insert nou responsabil
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, subproiect_id, responsabil_uid, responsabil_nume, rol_in_subproiect, data_atribuire, atribuit_de)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(subproiect_id)}',
        '${escapeString(responsabil_uid)}',
        '${escapeString(responsabil_nume)}',
        '${escapeString(rol_in_subproiect)}',
        ${data_atribuire ? `TIMESTAMP('${data_atribuire}')` : 'CURRENT_TIMESTAMP()'},
        ${atribuit_de ? `'${escapeString(atribuit_de)}'` : 'NULL'}
      )
    `;

    console.log('Insert responsabil subproiect query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Responsabil ${responsabil_nume} adăugat la subproiectul ${subproiect_id}`);

    return NextResponse.json({
      success: true,
      message: 'Responsabil adăugat cu succes la subproiect',
      data: { id, subproiect_id, responsabil_uid, responsabil_nume, rol_in_subproiect }
    });

  } catch (error) {
    console.error('Eroare la adăugarea responsabilului la subproiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea responsabilului la subproiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const subproiectId = searchParams.get('subproiect_id');
    const responsabilUid = searchParams.get('responsabil_uid');

    if (!id && !(subproiectId && responsabilUid)) {
      return NextResponse.json({ 
        success: false,
        error: 'Necesar id sau combinația subproiect_id + responsabil_uid' 
      }, { status: 400 });
    }

    let deleteQuery: string;
    
    if (id) {
      deleteQuery = `
        DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        WHERE id = '${escapeString(id)}'
      `;
    } else {
      deleteQuery = `
        DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        WHERE subproiect_id = '${escapeString(subproiectId!)}' 
          AND responsabil_uid = '${escapeString(responsabilUid!)}'
      `;
    }

    console.log('Delete responsabil subproiect query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Responsabil eliminat din subproiect: ${id || `${subproiectId}-${responsabilUid}`}`);

    return NextResponse.json({
      success: true,
      message: 'Responsabil eliminat cu succes din subproiect'
    });

  } catch (error) {
    console.error('Eroare la eliminarea responsabilului din subproiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la eliminarea responsabilului din subproiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
