// ==================================================================
// CALEA: app/api/rapoarte/subproiecte/[id]/route.ts
// DATA: 04.10.2025 20:30 (ora României)
// DESCRIERE: API pentru actualizare statusuri subproiecte (status_predare, status_contract)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;

console.log(`🔧 Subproiecte [ID] API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper pentru escape string SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// PUT: Actualizare status_predare sau status_contract
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subproiectId = params.id;
    const body = await request.json();

    console.log('🔷 UPDATE Subproiect:', { subproiectId, body });

    // Validare: acceptăm doar status_predare sau status_contract
    const allowedFields = ['status_predare', 'status_contract'];
    const fieldToUpdate = Object.keys(body).find(key => allowedFields.includes(key));

    if (!fieldToUpdate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Doar status_predare sau status_contract pot fi actualizate prin acest endpoint'
        },
        { status: 400 }
      );
    }

    const newValue = body[fieldToUpdate];

    // Validare valori permise
    const validValues: { [key: string]: string[] } = {
      status_predare: ['Nepredat', 'Predat'],
      status_contract: ['Nu e cazul', 'Nesemnat', 'Semnat']
    };

    if (!validValues[fieldToUpdate].includes(newValue)) {
      return NextResponse.json(
        {
          success: false,
          error: `Valoare invalidă pentru ${fieldToUpdate}. Valori permise: ${validValues[fieldToUpdate].join(', ')}`
        },
        { status: 400 }
      );
    }

    // UPDATE query
    const updateQuery = `
      UPDATE ${TABLE_SUBPROIECTE}
      SET
        ${fieldToUpdate} = '${escapeString(newValue)}',
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Subproiect = @subproiectId
    `;

    console.log('🔷 Executing UPDATE query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      params: { subproiectId },
      types: { subproiectId: 'STRING' },
      location: 'EU',
    });

    console.log(`✅ Subproiect ${subproiectId} actualizat: ${fieldToUpdate} = ${newValue}`);

    return NextResponse.json({
      success: true,
      message: `${fieldToUpdate} actualizat cu succes`,
      data: {
        ID_Subproiect: subproiectId,
        [fieldToUpdate]: newValue
      }
    });

  } catch (error) {
    console.error('❌ Eroare la actualizarea subproiectului:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Eroare la actualizarea statusului subproiectului',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}

// GET: Detalii subproiect individual (optional, pentru viitor)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subproiectId = params.id;

    const query = `
      SELECT *
      FROM ${TABLE_SUBPROIECTE}
      WHERE ID_Subproiect = @subproiectId
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { subproiectId },
      types: { subproiectId: 'STRING' },
      location: 'EU',
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Subproiect nu a fost găsit' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('❌ Eroare la citirea subproiectului:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Eroare la citirea subproiectului',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}
