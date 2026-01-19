// ==================================================================
// CALEA: app/api/admin/timetracking-history/filters/route.ts
// DATA: 19.01.2026 (ora României)
// DESCRIERE: API pentru opțiuni filtrare time tracking admin
// FUNCȚIONALITATE: Lista utilizatori și proiecte pentru dropdown-uri filtrare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function GET(request: NextRequest) {
  try {
    // Query pentru utilizatori unici cu înregistrări time tracking
    const usersQuery = `
      SELECT DISTINCT
        tt.utilizator_uid,
        COALESCE(tt.utilizator_nume, u.nume, u.email) as utilizator_nume
      FROM ${TABLE_TIME_TRACKING} tt
      LEFT JOIN ${TABLE_UTILIZATORI} u ON tt.utilizator_uid = u.uid
      WHERE tt.utilizator_uid IS NOT NULL
      ORDER BY utilizator_nume
    `;

    // Query pentru proiecte unice cu înregistrări time tracking
    const projectsQuery = `
      SELECT DISTINCT
        tt.proiect_id,
        p.Denumire as proiect_nume
      FROM ${TABLE_TIME_TRACKING} tt
      LEFT JOIN ${TABLE_PROIECTE} p ON tt.proiect_id = p.ID_Proiect
      WHERE tt.proiect_id IS NOT NULL
      ORDER BY proiect_nume
    `;

    const [usersRows, projectsRows] = await Promise.all([
      bigquery.query({ query: usersQuery, location: 'EU' }),
      bigquery.query({ query: projectsQuery, location: 'EU' })
    ]);

    return NextResponse.json({
      success: true,
      users: usersRows[0].map((row: any) => ({
        uid: row.utilizator_uid,
        name: row.utilizator_nume || 'Utilizator necunoscut'
      })),
      projects: projectsRows[0].map((row: any) => ({
        id: row.proiect_id,
        name: row.proiect_nume || row.proiect_id
      }))
    });

  } catch (error) {
    console.error('❌ EROARE LA OBȚINEREA FILTRELOR:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea opțiunilor de filtrare',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
