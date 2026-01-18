// ==================================================================
// CALEA: app/api/planificari-zilnice/[id]/route.ts
// DATA: 18.01.2026
// DESCRIERE: API pentru operații pe planificări zilnice individuale
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_PLANIFICARI = `\`${PROJECT_ID}.${DATASET}.PlanificariZilnice${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// GET - Obține o planificare specifică
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const query = `
      SELECT * FROM ${TABLE_PLANIFICARI}
      WHERE id = @id AND activ = TRUE
    `;

    const [rows] = await bigquery.query({
      query,
      params: { id },
      types: { id: 'STRING' },
      location: 'EU'
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Planificarea nu a fost găsită'
      }, { status: 404 });
    }

    const planificare = {
      ...rows[0],
      data_planificare: rows[0].data_planificare?.value || rows[0].data_planificare,
      data_creare: rows[0].data_creare?.value || rows[0].data_creare,
      data_actualizare: rows[0].data_actualizare?.value || rows[0].data_actualizare,
    };

    return NextResponse.json({
      success: true,
      data: planificare
    });

  } catch (error) {
    console.error('Eroare obținere planificare:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea planificării',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizează o planificare
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      data_planificare,
      utilizator_uid,
      utilizator_nume,
      ore_planificate,
      prioritate,
      observatii
    } = body;

    // Construiește SET clause dinamic
    const setClauses: string[] = ['data_actualizare = CURRENT_TIMESTAMP()'];
    const updateParams: any = { id };
    const updateTypes: any = { id: 'STRING' };

    if (data_planificare) {
      setClauses.push('data_planificare = @data_planificare');
      updateParams.data_planificare = data_planificare;
      updateTypes.data_planificare = 'DATE';
    }

    if (utilizator_uid) {
      setClauses.push('utilizator_uid = @utilizator_uid');
      updateParams.utilizator_uid = utilizator_uid;
      updateTypes.utilizator_uid = 'STRING';
    }

    if (utilizator_nume) {
      setClauses.push('utilizator_nume = @utilizator_nume');
      updateParams.utilizator_nume = utilizator_nume;
      updateTypes.utilizator_nume = 'STRING';
    }

    if (ore_planificate !== undefined) {
      setClauses.push('ore_planificate = @ore_planificate');
      updateParams.ore_planificate = ore_planificate;
      updateTypes.ore_planificate = 'NUMERIC';
    }

    if (prioritate) {
      setClauses.push('prioritate = @prioritate');
      updateParams.prioritate = prioritate;
      updateTypes.prioritate = 'STRING';
    }

    if (observatii !== undefined) {
      setClauses.push('observatii = @observatii');
      updateParams.observatii = observatii;
      updateTypes.observatii = 'STRING';
    }

    const updateQuery = `
      UPDATE ${TABLE_PLANIFICARI}
      SET ${setClauses.join(', ')}
      WHERE id = @id AND activ = TRUE
    `;

    await bigquery.query({
      query: updateQuery,
      params: updateParams,
      types: updateTypes,
      location: 'EU'
    });

    return NextResponse.json({
      success: true,
      message: 'Planificare actualizată cu succes',
      data: { id, ...body }
    });

  } catch (error) {
    console.error('Eroare actualizare planificare:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la actualizarea planificării',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Șterge o planificare (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const deleteQuery = `
      UPDATE ${TABLE_PLANIFICARI}
      SET activ = FALSE, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { id },
      types: { id: 'STRING' },
      location: 'EU'
    });

    return NextResponse.json({
      success: true,
      message: 'Planificare ștearsă cu succes'
    });

  } catch (error) {
    console.error('Eroare ștergere planificare:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la ștergerea planificării',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
