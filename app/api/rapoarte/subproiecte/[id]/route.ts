// ==================================================================
// CALEA: app/api/rapoarte/subproiecte/[id]/route.ts
// DATA: 04.10.2025 21:50 (ora României)
// DESCRIERE: API pentru actualizare statusuri subproiecte (status_predare, status_contract, progres_procent)
// MODIFICAT: Adăugat suport pentru progres_procent + recalculare automată progres proiect părinte
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``; // NOU: Pentru recalculare progres

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

// NOU: Funcție pentru recalculare progres proiect din subproiecte (04.10.2025)
async function recalculateProiectProgres(proiectId: string): Promise<number> {
  try {
    console.log(`🔄 Recalculare progres pentru proiect: ${proiectId}`);

    // Calculează media progresului subproiectelor active
    const calcQuery = `
      SELECT
        COALESCE(ROUND(AVG(COALESCE(progres_procent, 0)), 0), 0) as avg_progres
      FROM ${TABLE_SUBPROIECTE}
      WHERE ID_Proiect = @proiectId AND activ = true
    `;

    const [calcRows] = await bigquery.query({
      query: calcQuery,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU',
    });

    const avgProgres = parseInt(calcRows[0]?.avg_progres?.toString() || '0');
    console.log(`📊 Progres mediu calculat pentru proiect ${proiectId}: ${avgProgres}%`);

    // Actualizează progresul proiectului
    const updateQuery = `
      UPDATE ${TABLE_PROIECTE}
      SET progres_procent = @avgProgres
      WHERE ID_Proiect = @proiectId
    `;

    await bigquery.query({
      query: updateQuery,
      params: { avgProgres, proiectId },
      types: { avgProgres: 'INT64', proiectId: 'STRING' },
      location: 'EU',
    });

    console.log(`✅ Progres proiect ${proiectId} actualizat la ${avgProgres}%`);
    return avgProgres;

  } catch (error) {
    console.error('❌ Eroare la recalcularea progresului proiectului:', error);
    throw error;
  }
}

// PUT: Actualizare status_predare sau status_contract
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subproiectId } = await props.params;
    const body = await request.json();

    console.log('🔷 UPDATE Subproiect:', { subproiectId, body });

    // Validare: acceptăm status_predare, status_contract, progres_procent sau Status (09.01.2026)
    const allowedFields = ['status_predare', 'status_contract', 'progres_procent', 'Status'];
    const fieldToUpdate = Object.keys(body).find(key => allowedFields.includes(key));

    if (!fieldToUpdate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Doar status_predare, status_contract, progres_procent sau Status pot fi actualizate prin acest endpoint'
        },
        { status: 400 }
      );
    }

    const newValue = body[fieldToUpdate];

    // Validare valori permise pentru statusuri (09.01.2026: adăugat Status)
    const validValues: { [key: string]: string[] } = {
      status_predare: ['Nepredat', 'Predat'],
      status_contract: ['Nu e cazul', 'Nesemnat', 'Semnat'],
      Status: ['Activ', 'Planificat', 'Suspendat', 'Finalizat']
    };

    // Validare specială pentru progres_procent (0-100)
    if (fieldToUpdate === 'progres_procent') {
      const progresValue = parseInt(newValue);
      if (isNaN(progresValue) || progresValue < 0 || progresValue > 100) {
        return NextResponse.json(
          {
            success: false,
            error: 'Progresul trebuie să fie un număr între 0 și 100'
          },
          { status: 400 }
        );
      }
    } else if (!validValues[fieldToUpdate].includes(newValue)) {
      return NextResponse.json(
        {
          success: false,
          error: `Valoare invalidă pentru ${fieldToUpdate}. Valori permise: ${validValues[fieldToUpdate].join(', ')}`
        },
        { status: 400 }
      );
    }

    // Obține ID_Proiect pentru recalculare progres (doar dacă updatăm progres_procent)
    let proiectId: string | null = null;
    if (fieldToUpdate === 'progres_procent') {
      const getProiectQuery = `
        SELECT ID_Proiect
        FROM ${TABLE_SUBPROIECTE}
        WHERE ID_Subproiect = @subproiectId
        LIMIT 1
      `;
      const [proiectRows] = await bigquery.query({
        query: getProiectQuery,
        params: { subproiectId },
        types: { subproiectId: 'STRING' },
        location: 'EU',
      });
      proiectId = proiectRows[0]?.ID_Proiect || null;
    }

    // UPDATE query - parametrizat corect pentru tipuri diferite
    let updateQuery: string;
    let params: any;
    let types: any;

    if (fieldToUpdate === 'progres_procent') {
      // Pentru progres_procent folosim INT64
      updateQuery = `
        UPDATE ${TABLE_SUBPROIECTE}
        SET
          ${fieldToUpdate} = @newValue,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE ID_Subproiect = @subproiectId
      `;
      params = { newValue: parseInt(newValue), subproiectId };
      types = { newValue: 'INT64', subproiectId: 'STRING' };
    } else {
      // Pentru statusuri folosim STRING
      updateQuery = `
        UPDATE ${TABLE_SUBPROIECTE}
        SET
          ${fieldToUpdate} = @newValue,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE ID_Subproiect = @subproiectId
      `;
      params = { newValue: newValue, subproiectId };
      types = { newValue: 'STRING', subproiectId: 'STRING' };
    }

    console.log('🔷 Executing UPDATE query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      params,
      types,
      location: 'EU',
    });

    console.log(`✅ Subproiect ${subproiectId} actualizat: ${fieldToUpdate} = ${newValue}`);

    // CRUCIAL: Dacă am updatat progres_procent, recalculăm progresul proiectului părinte
    let progresProiect: number | undefined;
    if (fieldToUpdate === 'progres_procent' && proiectId) {
      try {
        progresProiect = await recalculateProiectProgres(proiectId);
        console.log(`✅ Progres proiect ${proiectId} recalculat: ${progresProiect}%`);
      } catch (recalcError) {
        console.error('⚠️ Eroare la recalcularea progresului proiectului (non-blocking):', recalcError);
        // Nu oprește procesul - actualizarea subproiectului a reușit
      }
    }

    return NextResponse.json({
      success: true,
      message: `${fieldToUpdate} actualizat cu succes`,
      data: {
        ID_Subproiect: subproiectId,
        [fieldToUpdate]: fieldToUpdate === 'progres_procent' ? parseInt(newValue) : newValue,
        ...(progresProiect !== undefined && { progres_proiect: progresProiect })
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
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subproiectId } = await props.params;

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
