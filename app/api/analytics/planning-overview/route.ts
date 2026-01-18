// ==================================================================
// CALEA: app/api/analytics/planning-overview/route.ts
// DATA: 18.01.2026
// DESCRIERE: API pentru vizualizare planning toți utilizatorii
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_PLANIFICARI = `\`${PROJECT_ID}.${DATASET}.PlanificariZilnice${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

console.log(`🔧 Planning Overview API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// GET - Obține planificările pentru toți utilizatorii într-o perioadă
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data_start = searchParams.get('data_start');
    const data_end = searchParams.get('data_end');
    const proiect_id = searchParams.get('proiect_id');
    const echipa = searchParams.get('echipa'); // viitor - filtrare pe echipă

    // Validare date obligatorii
    if (!data_start || !data_end) {
      return NextResponse.json({
        success: false,
        error: 'data_start și data_end sunt obligatorii'
      }, { status: 400 });
    }

    // 1. Obține toți utilizatorii activi
    const utilizatoriQuery = `
      SELECT
        uid,
        nume,
        email,
        rol,
        echipa
      FROM ${TABLE_UTILIZATORI}
      WHERE activ = TRUE
      ORDER BY nume ASC
    `;

    const [utilizatoriRows] = await bigquery.query({
      query: utilizatoriQuery,
      location: 'EU'
    });

    // 2. Obține planificările pentru perioada specificată
    let planificariQuery = `
      SELECT
        pz.id,
        pz.data_planificare,
        pz.utilizator_uid,
        pz.utilizator_nume,
        pz.proiect_id,
        pz.subproiect_id,
        pz.sarcina_id,
        pz.proiect_denumire,
        pz.subproiect_denumire,
        pz.sarcina_titlu,
        pz.ore_planificate,
        pz.prioritate,
        pz.observatii,
        p.culoare as proiect_culoare
      FROM ${TABLE_PLANIFICARI} pz
      LEFT JOIN ${TABLE_PROIECTE} p ON pz.proiect_id = p.id
      WHERE pz.activ = TRUE
        AND pz.data_planificare >= @data_start
        AND pz.data_planificare <= @data_end
    `;

    const params: any = { data_start, data_end };
    const types: any = { data_start: 'DATE', data_end: 'DATE' };

    if (proiect_id) {
      planificariQuery += ` AND (pz.proiect_id = @proiect_id OR pz.subproiect_id = @proiect_id OR pz.sarcina_id = @proiect_id)`;
      params.proiect_id = proiect_id;
      types.proiect_id = 'STRING';
    }

    planificariQuery += ` ORDER BY pz.data_planificare ASC, pz.utilizator_nume ASC`;

    const [planificariRows] = await bigquery.query({
      query: planificariQuery,
      params,
      types,
      location: 'EU'
    });

    // 3. Procesează datele pentru format calendar
    const utilizatori = utilizatoriRows.map((u: any) => ({
      uid: u.uid,
      nume: u.nume,
      email: u.email,
      rol: u.rol,
      echipa: u.echipa
    }));

    // Creează map pentru planificări per utilizator per zi
    const planificariMap: Record<string, Record<string, any[]>> = {};
    const orePerZiPerUtilizator: Record<string, Record<string, number>> = {};

    for (const row of planificariRows as any[]) {
      const dataStr = row.data_planificare?.value || row.data_planificare;
      const uid = row.utilizator_uid;

      if (!planificariMap[uid]) {
        planificariMap[uid] = {};
        orePerZiPerUtilizator[uid] = {};
      }

      if (!planificariMap[uid][dataStr]) {
        planificariMap[uid][dataStr] = [];
        orePerZiPerUtilizator[uid][dataStr] = 0;
      }

      planificariMap[uid][dataStr].push({
        id: row.id,
        proiect_id: row.proiect_id,
        subproiect_id: row.subproiect_id,
        sarcina_id: row.sarcina_id,
        proiect_denumire: row.proiect_denumire,
        subproiect_denumire: row.subproiect_denumire,
        sarcina_titlu: row.sarcina_titlu,
        ore_planificate: parseFloat(row.ore_planificate) || 0,
        prioritate: row.prioritate,
        observatii: row.observatii,
        proiect_culoare: row.proiect_culoare
      });

      orePerZiPerUtilizator[uid][dataStr] += parseFloat(row.ore_planificate) || 0;
    }

    // 4. Generează lista de zile în perioadă
    const zile: string[] = [];
    const startDate = new Date(data_start);
    const endDate = new Date(data_end);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      zile.push(d.toISOString().split('T')[0]);
    }

    // 5. Calculează statistici
    const statistici = {
      total_utilizatori: utilizatori.length,
      total_planificari: (planificariRows as any[]).length,
      zile_in_perioada: zile.length,
      ore_totale_planificate: (planificariRows as any[]).reduce(
        (sum: number, r: any) => sum + (parseFloat(r.ore_planificate) || 0),
        0
      )
    };

    // 6. Calculează status alocare per utilizator per zi
    const ORA_STANDARD = 8; // ore de lucru standard pe zi
    const alocareStatus: Record<string, Record<string, string>> = {};

    for (const uid of Object.keys(orePerZiPerUtilizator)) {
      alocareStatus[uid] = {};
      for (const data of Object.keys(orePerZiPerUtilizator[uid])) {
        const ore = orePerZiPerUtilizator[uid][data];
        if (ore > ORA_STANDARD) {
          alocareStatus[uid][data] = 'supraalocat'; // > 8h
        } else if (ore === ORA_STANDARD) {
          alocareStatus[uid][data] = 'complet'; // exact 8h
        } else if (ore > 0) {
          alocareStatus[uid][data] = 'partial'; // < 8h
        } else {
          alocareStatus[uid][data] = 'liber'; // 0h
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        utilizatori,
        planificariMap,
        orePerZiPerUtilizator,
        alocareStatus,
        zile,
        statistici
      }
    });

  } catch (error) {
    console.error('Eroare obținere planning overview:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea datelor de planning',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
