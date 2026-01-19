// ==================================================================
// CALEA: app/api/planificari-zilnice/route.ts
// DATA: 18.01.2026
// DESCRIERE: API pentru gestionarea planificărilor zilnice de lucrători
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_PLANIFICARI = `\`${PROJECT_ID}.${DATASET}.PlanificariZilnice${tableSuffix}\``;
const TABLE_PLANIFICATOR_PERSONAL = `\`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

console.log(`🔧 Planificări Zilnice API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// GET - Listare planificări
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data_start = searchParams.get('data_start');
    const data_end = searchParams.get('data_end');
    const utilizator_uid = searchParams.get('utilizator_uid');
    const proiect_id = searchParams.get('proiect_id');

    let query = `
      SELECT
        pz.*,
        u.nume as utilizator_nume_complet,
        u.email as utilizator_email
      FROM ${TABLE_PLANIFICARI} pz
      LEFT JOIN ${TABLE_UTILIZATORI} u ON pz.utilizator_uid = u.uid
      WHERE pz.activ = TRUE
    `;

    const params: any = {};
    const types: any = {};

    if (data_start) {
      query += ' AND pz.data_planificare >= @data_start';
      params.data_start = data_start;
      types.data_start = 'DATE';
    }

    if (data_end) {
      query += ' AND pz.data_planificare <= @data_end';
      params.data_end = data_end;
      types.data_end = 'DATE';
    }

    if (utilizator_uid) {
      query += ' AND pz.utilizator_uid = @utilizator_uid';
      params.utilizator_uid = utilizator_uid;
      types.utilizator_uid = 'STRING';
    }

    if (proiect_id) {
      query += ' AND (pz.proiect_id = @proiect_id OR pz.subproiect_id = @proiect_id OR pz.sarcina_id = @proiect_id)';
      params.proiect_id = proiect_id;
      types.proiect_id = 'STRING';
    }

    query += ' ORDER BY pz.data_planificare ASC, pz.utilizator_nume ASC';

    const queryOptions: any = {
      query,
      location: 'EU',
    };

    if (Object.keys(params).length > 0) {
      queryOptions.params = params;
      queryOptions.types = types;
    }

    const [rows] = await bigquery.query(queryOptions);

    // Procesare date pentru BigQuery
    const planificari = rows.map((row: any) => ({
      ...row,
      data_planificare: row.data_planificare?.value || row.data_planificare,
      data_creare: row.data_creare?.value || row.data_creare,
      data_actualizare: row.data_actualizare?.value || row.data_actualizare,
    }));

    return NextResponse.json({
      success: true,
      data: planificari,
      total: planificari.length
    });

  } catch (error) {
    console.error('Eroare listare planificări zilnice:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la listarea planificărilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Creare planificare nouă
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      data_planificare: rawDataPlanificare,
      utilizator_uid,
      utilizator_nume,
      proiect_id,
      subproiect_id,
      sarcina_id,
      proiect_denumire,
      subproiect_denumire,
      sarcina_titlu,
      ore_planificate = 8,
      prioritate = 'normala',
      observatii,
      creat_de,
      creat_de_nume,
      sync_planificator_personal = false
    } = body;

    // Validări de bază
    if (!utilizator_uid || !utilizator_nume) {
      return NextResponse.json({
        success: false,
        error: 'utilizator_uid și utilizator_nume sunt obligatorii'
      }, { status: 400 });
    }

    // Validare și normalizare data_planificare
    let data_planificare = rawDataPlanificare;

    // Dacă data este obiect BigQuery ({value: "2025-01-19"}), extrage valoarea
    if (data_planificare && typeof data_planificare === 'object' && data_planificare.value) {
      data_planificare = data_planificare.value;
    }

    // Dacă data lipsește sau e goală, folosește data curentă
    if (!data_planificare || data_planificare === '' || data_planificare === 'undefined' || data_planificare === 'null') {
      data_planificare = new Date().toISOString().split('T')[0];
      console.log(`[Planificări Zilnice] data_planificare lipsea, folosind data curentă: ${data_planificare}`);
    }

    // Validare format dată YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data_planificare)) {
      console.error(`[Planificări Zilnice] Format dată invalid: ${data_planificare}`);
      return NextResponse.json({
        success: false,
        error: `Format dată invalid: ${data_planificare}. Folosiți formatul YYYY-MM-DD.`
      }, { status: 400 });
    }

    // Verifică dacă data este validă
    const parsedDate = new Date(data_planificare);
    if (isNaN(parsedDate.getTime())) {
      console.error(`[Planificări Zilnice] Dată invalidă: ${data_planificare}`);
      return NextResponse.json({
        success: false,
        error: `Dată invalidă: ${data_planificare}`
      }, { status: 400 });
    }

    console.log(`[Planificări Zilnice] POST - utilizator: ${utilizator_uid}, data: ${data_planificare}, proiect: ${proiect_id || 'N/A'}, subproiect: ${subproiect_id || 'N/A'}, sarcina: ${sarcina_id || 'N/A'}`);

    if (!proiect_id && !subproiect_id && !sarcina_id) {
      return NextResponse.json({
        success: false,
        error: 'Trebuie specificat cel puțin un proiect_id, subproiect_id sau sarcina_id'
      }, { status: 400 });
    }

    // Validare finală - asigură că data_planificare este un string valid înainte de BigQuery
    if (typeof data_planificare !== 'string' || !data_planificare) {
      console.error(`[Planificări Zilnice] CRITICAL: data_planificare invalid după validare: ${data_planificare}, type: ${typeof data_planificare}`);
      return NextResponse.json({
        success: false,
        error: 'Eroare internă: data_planificare invalidă'
      }, { status: 500 });
    }

    const id = uuidv4();

    console.log(`[Planificări Zilnice] Executing check query with data_planificare: "${data_planificare}"`);

    // Verifică dacă există deja alocare pentru aceeași zi/utilizator/element
    // Folosim DATE() function în query pentru a evita probleme cu parametrizarea DATE în BigQuery
    const checkQuery = `
      SELECT id FROM ${TABLE_PLANIFICARI}
      WHERE data_planificare = DATE(@data_planificare)
        AND utilizator_uid = @utilizator_uid
        AND activ = TRUE
        AND (
          (proiect_id = @proiect_id AND @proiect_id IS NOT NULL)
          OR (subproiect_id = @subproiect_id AND @subproiect_id IS NOT NULL)
          OR (sarcina_id = @sarcina_id AND @sarcina_id IS NOT NULL)
        )
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: {
        data_planificare: data_planificare,
        utilizator_uid: utilizator_uid,
        proiect_id: proiect_id || null,
        subproiect_id: subproiect_id || null,
        sarcina_id: sarcina_id || null
      },
      types: {
        data_planificare: 'STRING',
        utilizator_uid: 'STRING',
        proiect_id: 'STRING',
        subproiect_id: 'STRING',
        sarcina_id: 'STRING'
      },
      location: 'EU'
    });

    if (existingRows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Există deja o alocare pentru acest utilizator, această zi și acest element'
      }, { status: 409 });
    }

    // Insert planificare - folosim DATE() pentru conversie string -> DATE
    const insertQuery = `
      INSERT INTO ${TABLE_PLANIFICARI} (
        id, data_planificare, utilizator_uid, utilizator_nume,
        proiect_id, subproiect_id, sarcina_id,
        proiect_denumire, subproiect_denumire, sarcina_titlu,
        ore_planificate, prioritate, observatii,
        creat_de, creat_de_nume, data_creare, activ,
        sync_planificator_personal
      ) VALUES (
        @id, DATE(@data_planificare), @utilizator_uid, @utilizator_nume,
        @proiect_id, @subproiect_id, @sarcina_id,
        @proiect_denumire, @subproiect_denumire, @sarcina_titlu,
        @ore_planificate, @prioritate, @observatii,
        @creat_de, @creat_de_nume, CURRENT_TIMESTAMP(), TRUE,
        @sync_planificator_personal
      )
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id,
        data_planificare,
        utilizator_uid,
        utilizator_nume,
        proiect_id: proiect_id || null,
        subproiect_id: subproiect_id || null,
        sarcina_id: sarcina_id || null,
        proiect_denumire: proiect_denumire || null,
        subproiect_denumire: subproiect_denumire || null,
        sarcina_titlu: sarcina_titlu || null,
        ore_planificate: ore_planificate || 8,
        prioritate: prioritate || 'normala',
        observatii: observatii || null,
        creat_de: creat_de || null,
        creat_de_nume: creat_de_nume || null,
        sync_planificator_personal
      },
      types: {
        id: 'STRING',
        data_planificare: 'STRING',
        utilizator_uid: 'STRING',
        utilizator_nume: 'STRING',
        proiect_id: 'STRING',
        subproiect_id: 'STRING',
        sarcina_id: 'STRING',
        proiect_denumire: 'STRING',
        subproiect_denumire: 'STRING',
        sarcina_titlu: 'STRING',
        ore_planificate: 'NUMERIC',
        prioritate: 'STRING',
        observatii: 'STRING',
        creat_de: 'STRING',
        creat_de_nume: 'STRING',
        sync_planificator_personal: 'BOOL'
      },
      location: 'EU'
    });

    // Sync cu PlanificatorPersonal dacă solicitat (Faza 3)
    let planificatorPersonalId: string | null = null;
    if (sync_planificator_personal) {
      planificatorPersonalId = await syncToPlanificatorPersonal({
        utilizator_uid,
        proiect_id,
        subproiect_id,
        sarcina_id,
        data_planificare
      });

      // Update planificarea cu ID-ul din Planificator Personal
      if (planificatorPersonalId) {
        await bigquery.query({
          query: `
            UPDATE ${TABLE_PLANIFICARI}
            SET planificator_personal_id = @planificatorPersonalId
            WHERE id = @id
          `,
          params: { id, planificatorPersonalId },
          types: { id: 'STRING', planificatorPersonalId: 'STRING' },
          location: 'EU'
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        data_planificare,
        utilizator_uid,
        utilizator_nume,
        proiect_id,
        subproiect_id,
        sarcina_id,
        ore_planificate,
        prioritate,
        planificator_personal_id: planificatorPersonalId
      },
      message: 'Planificare creată cu succes'
    });

  } catch (error) {
    console.error('Eroare creare planificare zilnică:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la crearea planificării',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// Funcție helper pentru sync cu Planificator Personal (Faza 3)
async function syncToPlanificatorPersonal({
  utilizator_uid,
  proiect_id,
  subproiect_id,
  sarcina_id,
  data_planificare
}: {
  utilizator_uid: string;
  proiect_id?: string;
  subproiect_id?: string;
  sarcina_id?: string;
  data_planificare: string;
}): Promise<string | null> {
  try {
    // Determină tipul și ID-ul item-ului
    let tip_item: string;
    let item_id: string;

    if (sarcina_id) {
      tip_item = 'sarcina';
      item_id = sarcina_id;
    } else if (subproiect_id) {
      tip_item = 'subproiect';
      item_id = subproiect_id;
    } else if (proiect_id) {
      tip_item = 'proiect';
      item_id = proiect_id;
    } else {
      return null;
    }

    // Verifică dacă există deja în planificator
    const checkQuery = `
      SELECT id FROM ${TABLE_PLANIFICATOR_PERSONAL}
      WHERE utilizator_uid = @utilizator_uid
        AND tip_item = @tip_item
        AND item_id = @item_id
        AND activ = TRUE
      LIMIT 1
    `;

    const [existing] = await bigquery.query({
      query: checkQuery,
      params: { utilizator_uid, tip_item, item_id },
      types: { utilizator_uid: 'STRING', tip_item: 'STRING', item_id: 'STRING' },
      location: 'EU'
    });

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Obține următoarea poziție
    const positionQuery = `
      SELECT COALESCE(MAX(ordine_pozitie), 0) + 1 as next_position
      FROM ${TABLE_PLANIFICATOR_PERSONAL}
      WHERE utilizator_uid = @utilizator_uid AND activ = TRUE
    `;

    const [positionRows] = await bigquery.query({
      query: positionQuery,
      params: { utilizator_uid },
      types: { utilizator_uid: 'STRING' },
      location: 'EU'
    });

    const nextPosition = positionRows[0]?.next_position || 1;
    const newId = uuidv4();

    // Insert în Planificator Personal
    const insertQuery = `
      INSERT INTO ${TABLE_PLANIFICATOR_PERSONAL} (
        id, utilizator_uid, tip_item, item_id, ordine_pozitie,
        comentariu_personal, is_pinned, data_adaugare, activ
      ) VALUES (
        @id, @utilizator_uid, @tip_item, @item_id, @ordine_pozitie,
        @comentariu_personal, FALSE, CURRENT_TIMESTAMP(), TRUE
      )
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: newId,
        utilizator_uid,
        tip_item,
        item_id,
        ordine_pozitie: nextPosition,
        comentariu_personal: `Planificat pentru ${data_planificare} (adăugat din Gantt)`
      },
      types: {
        id: 'STRING',
        utilizator_uid: 'STRING',
        tip_item: 'STRING',
        item_id: 'STRING',
        ordine_pozitie: 'INT64',
        comentariu_personal: 'STRING'
      },
      location: 'EU'
    });

    return newId;

  } catch (error) {
    console.error('Eroare sync cu Planificator Personal:', error);
    return null;
  }
}
