// ==================================================================
// CALEA: app/api/rapoarte/sarcini-responsabili/route.ts
// DATA: 08.01.2026 (ora Romaniei)
// DESCRIERE: API pentru gestionarea responsabililor la sarcini
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// V2 Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

console.log(`SarciniResponsabili API - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const table = `SarciniResponsabili${tableSuffix}`;
const SARCINI_RESPONSABILI_TABLE = `\`${PROJECT_ID}.${DATASET}.${table}\``;
const UTILIZATORI_TABLE = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sarcinaId = searchParams.get('sarcina_id');

    if (!sarcinaId) {
      return NextResponse.json({
        success: false,
        error: 'sarcina_id este necesar'
      }, { status: 400 });
    }

    const query = `
      SELECT
        sr.*,
        u.email,
        u.prenume,
        u.nume,
        u.rol as rol_sistem
      FROM ${SARCINI_RESPONSABILI_TABLE} sr
      LEFT JOIN ${UTILIZATORI_TABLE} u
        ON sr.responsabil_uid = u.uid
      WHERE sr.sarcina_id = @sarcinaId
      ORDER BY
        CASE sr.rol_in_sarcina
          WHEN 'Principal' THEN 1
          WHEN 'Normal' THEN 2
          WHEN 'Observator' THEN 3
          ELSE 4
        END,
        sr.data_atribuire ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { sarcinaId },
      types: { sarcinaId: 'STRING' },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la incarcarea responsabililor sarcina:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la incarcarea responsabililor sarcina',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST responsabil sarcina request:', body);

    const {
      id,
      sarcina_id,
      responsabil_uid,
      responsabil_nume,
      rol_in_sarcina = 'Normal',
      data_atribuire,
      atribuit_de
    } = body;

    // Validari
    if (!id || !sarcina_id || !responsabil_uid || !responsabil_nume) {
      return NextResponse.json({
        success: false,
        error: 'Campurile id, sarcina_id, responsabil_uid si responsabil_nume sunt obligatorii'
      }, { status: 400 });
    }

    // Verifica daca responsabilul este deja atribuit la aceasta sarcina
    const checkQuery = `
      SELECT id FROM ${SARCINI_RESPONSABILI_TABLE}
      WHERE sarcina_id = @sarcinaId AND responsabil_uid = @responsabilUid
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: {
        sarcinaId: sarcina_id,
        responsabilUid: responsabil_uid
      },
      types: {
        sarcinaId: 'STRING',
        responsabilUid: 'STRING'
      },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Responsabilul este deja atribuit la aceasta sarcina'
      }, { status: 409 });
    }

    // Insert nou responsabil
    const insertQuery = `
      INSERT INTO ${SARCINI_RESPONSABILI_TABLE}
      (id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, data_atribuire, atribuit_de)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(sarcina_id)}',
        '${escapeString(responsabil_uid)}',
        '${escapeString(responsabil_nume)}',
        '${escapeString(rol_in_sarcina)}',
        ${data_atribuire ? `TIMESTAMP('${data_atribuire}')` : 'CURRENT_TIMESTAMP()'},
        ${atribuit_de ? `'${escapeString(atribuit_de)}'` : 'NULL'}
      )
    `;

    console.log('Insert responsabil sarcina query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Responsabil ${responsabil_nume} adaugat la sarcina ${sarcina_id}`);

    return NextResponse.json({
      success: true,
      message: 'Responsabil adaugat cu succes la sarcina',
      data: { id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina }
    });

  } catch (error) {
    console.error('Eroare la adaugarea responsabilului la sarcina:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la adaugarea responsabilului la sarcina',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sarcinaId = searchParams.get('sarcina_id');
    const responsabilUid = searchParams.get('responsabil_uid');

    if (!id && !(sarcinaId && responsabilUid)) {
      return NextResponse.json({
        success: false,
        error: 'Necesar id sau combinatia sarcina_id + responsabil_uid'
      }, { status: 400 });
    }

    let deleteQuery: string;

    if (id) {
      deleteQuery = `
        DELETE FROM ${SARCINI_RESPONSABILI_TABLE}
        WHERE id = '${escapeString(id)}'
      `;
    } else {
      deleteQuery = `
        DELETE FROM ${SARCINI_RESPONSABILI_TABLE}
        WHERE sarcina_id = '${escapeString(sarcinaId!)}'
          AND responsabil_uid = '${escapeString(responsabilUid!)}'
      `;
    }

    console.log('Delete responsabil sarcina query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Responsabil eliminat din sarcina: ${id || `${sarcinaId}-${responsabilUid}`}`);

    return NextResponse.json({
      success: true,
      message: 'Responsabil eliminat cu succes din sarcina'
    });

  } catch (error) {
    console.error('Eroare la eliminarea responsabilului din sarcina:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la eliminarea responsabilului din sarcina',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
