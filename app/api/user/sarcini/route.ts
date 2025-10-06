// ==================================================================
// CALEA: app/api/user/sarcini/route.ts
// DATA: 23.09.2025 18:45 (ora României)
// DESCRIERE: API pentru sarcini utilizatori normali - IDENTIC cu admin
// FUNCȚIONALITATE: CRUD sarcini cu progres și responsabili - FĂRĂ restricții financiare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = bigquery.dataset(DATASET);
const SARCINI_TABLE = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const RESPONSABILI_TABLE = `\`${PROJECT_ID}.${DATASET}.SarciniResponsabili${tableSuffix}\``;
const TIME_TRACKING_TABLE = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;

console.log(`🔧 [User Sarcini] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiect_id = searchParams.get('proiect_id');

    if (!proiect_id) {
      return NextResponse.json({ error: 'proiect_id este obligatoriu' }, { status: 400 });
    }

    // Query pentru sarcini - IDENTIC cu admin
    const sarcinQuery = `
      SELECT
        s.*,
        ARRAY(
          SELECT AS STRUCT
            sr.responsabil_uid,
            sr.responsabil_nume,
            sr.rol_in_sarcina
          FROM ${RESPONSABILI_TABLE} sr
          WHERE sr.sarcina_id = s.id
        ) as responsabili,
        COALESCE(
          (SELECT SUM(CAST(tt.ore_lucrate AS FLOAT64))
           FROM ${TIME_TRACKING_TABLE} tt
           WHERE tt.sarcina_id = s.id),
          0
        ) as total_ore_lucrate
      FROM ${SARCINI_TABLE} s
      WHERE s.proiect_id = @proiect_id
      ORDER BY s.data_creare DESC
    `;

    const [rows] = await bigquery.query({
      query: sarcinQuery,
      params: { proiect_id }
    });

    // Procesare date pentru a asigura consistența
    const sarcini = rows.map((row: any) => ({
      ...row,
      responsabili: row.responsabili || [],
      total_ore_lucrate: Number(row.total_ore_lucrate) || 0,
      progres_procent: Number(row.progres_procent) || 0,
      timp_estimat_zile: Number(row.timp_estimat_zile) || 0,
      timp_estimat_ore: Number(row.timp_estimat_ore) || 0,
      timp_estimat_total_ore: Number(row.timp_estimat_total_ore) || 0
    }));

    return NextResponse.json({
      success: true,
      sarcini
    });

  } catch (error) {
    console.error('Eroare la încărcarea sarcinilor:', error);
    return NextResponse.json(
      { error: 'Eroare la încărcarea sarcinilor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sarcinaData = await request.json();

    // Validări de bază
    if (!sarcinaData.proiect_id || !sarcinaData.titlu || !sarcinaData.created_by) {
      return NextResponse.json({ error: 'Date lipsă: proiect_id, titlu și created_by sunt obligatorii' }, { status: 400 });
    }

    // Calculează timp total estimat în ore
    const zile = Number(sarcinaData.timp_estimat_zile) || 0;
    const ore = Number(sarcinaData.timp_estimat_ore) || 0;
    const timpTotalOre = (zile * 8) + ore;

    // Inserare sarcină în BigQuery cu gestionare NULL-uri
    const insertSarcinaQuery = `
      INSERT INTO ${SARCINI_TABLE}
      (
        id, proiect_id, tip_proiect, titlu, descriere, status, prioritate,
        progres_procent, progres_descriere, data_scadenta, observatii,
        timp_estimat_zile, timp_estimat_ore, timp_estimat_total_ore,
        created_by, data_creare, updated_at
      )
      VALUES
      (
        @id, @proiect_id, @tip_proiect, @titlu, @descriere, @status, @prioritate,
        @progres_procent, @progres_descriere,
        ${sarcinaData.data_scadenta ? '@data_scadenta' : 'NULL'},
        @observatii,
        @timp_estimat_zile, @timp_estimat_ore, @timp_estimat_total_ore,
        @created_by, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
      )
    `;

    // Construim parametrii, excludând data_scadenta dacă e null
    const queryParams: any = {
      id: sarcinaData.id,
      proiect_id: sarcinaData.proiect_id,
      tip_proiect: sarcinaData.tip_proiect || 'proiect',
      titlu: sarcinaData.titlu,
      descriere: sarcinaData.descriere || '',
      status: sarcinaData.status || 'De făcut',
      prioritate: sarcinaData.prioritate || 'Medie',
      progres_procent: sarcinaData.progres_procent || 0,
      progres_descriere: sarcinaData.progres_descriere || '',
      observatii: sarcinaData.observatii || '',
      timp_estimat_zile: zile,
      timp_estimat_ore: ore,
      timp_estimat_total_ore: timpTotalOre,
      created_by: sarcinaData.created_by
    };

    // Adăugăm data_scadenta doar dacă nu e null
    if (sarcinaData.data_scadenta) {
      queryParams.data_scadenta = sarcinaData.data_scadenta;
    }

    await bigquery.query({
      query: insertSarcinaQuery,
      params: queryParams
    });

    // Inserare responsabili - IDENTIC cu admin
    if (sarcinaData.responsabili && sarcinaData.responsabili.length > 0) {
      const insertResponsabiliQuery = `
        INSERT INTO ${RESPONSABILI_TABLE}
        (sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, data_asignare)
        VALUES
      `;

      const values = sarcinaData.responsabili.map((_, index: number) =>
        `(@sarcina_id, @uid_${index}, @nume_${index}, @rol_${index}, CURRENT_TIMESTAMP())`
      ).join(', ');

      const params: any = { sarcina_id: sarcinaData.id };
      sarcinaData.responsabili.forEach((resp: any, index: number) => {
        params[`uid_${index}`] = resp.uid;
        params[`nume_${index}`] = resp.nume_complet;
        params[`rol_${index}`] = resp.rol;
      });

      await bigquery.query({
        query: insertResponsabiliQuery + values,
        params
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Sarcină creată cu succes',
      sarcina_id: sarcinaData.id
    });

  } catch (error) {
    console.error('Eroare la crearea sarcinii:', error);
    return NextResponse.json(
      { error: 'Eroare la crearea sarcinii' },
      { status: 500 }
    );
  }
}