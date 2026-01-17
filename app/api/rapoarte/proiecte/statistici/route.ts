// ==================================================================
// CALEA: app/api/rapoarte/proiecte/statistici/route.ts
// DATA: 17.01.2026 (ora României)
// DESCRIERE: API pentru statistici timp lucrat pe proiect
// FUNCȚIONALITĂȚI: Total ore, detalii per persoană, indicatori financiari
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_CHELTUIELI = `\`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\``;
const TABLE_SETARI_COSTURI = `\`${PROJECT_ID}.${DATASET}.SetariCosturi${tableSuffix}\``;

console.log(`🔧 Statistici Proiect API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiectId');

    if (!proiectId) {
      return NextResponse.json({
        success: false,
        error: 'proiectId este obligatoriu'
      }, { status: 400 });
    }

    // 1. Obține detalii proiect
    const proiectQuery = `
      SELECT
        ID_Proiect,
        Denumire,
        Valoare_Estimata,
        moneda,
        valoare_ron,
        curs_valutar,
        Status,
        Data_Start,
        Data_Final
      FROM ${TABLE_PROIECTE}
      WHERE ID_Proiect = @proiectId
    `;

    const [proiectRows] = await bigquery.query({
      query: proiectQuery,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU',
    });

    if (proiectRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proiectul nu a fost găsit'
      }, { status: 404 });
    }

    const proiect = proiectRows[0];

    // 2. Obține subproiecte pentru proiect
    const subproiecteQuery = `
      SELECT ID_Subproiect
      FROM ${TABLE_SUBPROIECTE}
      WHERE ID_Proiect = @proiectId AND activ = TRUE
    `;

    const [subproiecteRows] = await bigquery.query({
      query: subproiecteQuery,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU',
    });

    const subproiecteIds = subproiecteRows.map((s: any) => s.ID_Subproiect);

    // 3. Obține statistici timp lucrat - include proiect + subproiecte
    let timeTrackingQuery = `
      SELECT
        utilizator_uid,
        utilizator_nume,
        SUM(ore_lucrate) as total_ore,
        COUNT(*) as numar_inregistrari,
        MIN(data_lucru) as prima_zi,
        MAX(data_lucru) as ultima_zi
      FROM ${TABLE_TIME_TRACKING}
      WHERE (proiect_id = @proiectId
    `;

    // Adaugă subproiecte în query dacă există
    if (subproiecteIds.length > 0) {
      const subproiecteList = subproiecteIds.map((id: string) => `'${id}'`).join(',');
      timeTrackingQuery += ` OR subproiect_id IN (${subproiecteList})`;
    }

    timeTrackingQuery += `)
      GROUP BY utilizator_uid, utilizator_nume
      ORDER BY total_ore DESC
    `;

    const [timeRows] = await bigquery.query({
      query: timeTrackingQuery,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU',
    });

    // 4. Calculează total ore
    const totalOreLucrate = timeRows.reduce((sum: number, row: any) => sum + parseFloat(row.total_ore || 0), 0);

    // 5. Obține cheltuieli proiect
    let cheltuieliQuery = `
      SELECT
        id,
        tip_cheltuiala,
        furnizor_nume,
        descriere,
        valoare,
        moneda,
        valoare_ron,
        status_achitare,
        status_predare
      FROM ${TABLE_CHELTUIELI}
      WHERE activ = TRUE AND (proiect_id = @proiectId
    `;

    if (subproiecteIds.length > 0) {
      const subproiecteList = subproiecteIds.map((id: string) => `'${id}'`).join(',');
      cheltuieliQuery += ` OR subproiect_id IN (${subproiecteList})`;
    }

    cheltuieliQuery += `) ORDER BY data_creare DESC`;

    const [cheltuieliRows] = await bigquery.query({
      query: cheltuieliQuery,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU',
    });

    // Calculează total cheltuieli în RON
    const totalCheltuieli = cheltuieliRows.reduce((sum: number, row: any) => {
      const valoare = parseFloat(row.valoare_ron || row.valoare || 0);
      return sum + valoare;
    }, 0);

    // 6. Obține setări cost de om
    let costOra = 40; // Default
    let costZi = 320;
    let orePeZi = 8;
    let monedaCost = 'EUR';

    try {
      const costuriQuery = `
        SELECT cost_ora, cost_zi, ore_pe_zi, moneda
        FROM ${TABLE_SETARI_COSTURI}
        WHERE activ = TRUE
        ORDER BY data_creare DESC
        LIMIT 1
      `;

      const [costuriRows] = await bigquery.query({
        query: costuriQuery,
        location: 'EU',
      });

      if (costuriRows.length > 0) {
        costOra = parseFloat(costuriRows[0].cost_ora);
        costZi = parseFloat(costuriRows[0].cost_zi);
        orePeZi = parseInt(costuriRows[0].ore_pe_zi);
        monedaCost = costuriRows[0].moneda;
      }
    } catch (e) {
      console.log('Tabel SetariCosturi nu există, folosesc valori default');
    }

    // 7. Calculează indicatori financiari
    // Valoare proiect în EUR (presupunem că setările sunt în EUR)
    const valoareProiect = parseFloat(proiect.Valoare_Estimata || 0);
    const valoareProiectRON = parseFloat(proiect.valoare_ron || proiect.Valoare_Estimata || 0);
    const cursValutar = parseFloat(proiect.curs_valutar || 5);

    // Convertim cheltuielile în moneda proiectului
    let cheltuieliInMonedaProiect = totalCheltuieli;
    if (proiect.moneda !== 'RON') {
      cheltuieliInMonedaProiect = totalCheltuieli / cursValutar;
    }

    // Productivitate = (Valoare proiect - Cheltuieli) / Timp lucrat
    const marjaBruta = valoareProiect - cheltuieliInMonedaProiect;
    const productivitatePerOra = totalOreLucrate > 0 ? marjaBruta / totalOreLucrate : 0;

    // Zile alocate disponibile = (Valoare proiect - Cheltuieli) / Cost pe oră
    const oreAlocateDisponibile = costOra > 0 ? marjaBruta / costOra : 0;
    const zileAlocateDisponibile = oreAlocateDisponibile / orePeZi;

    // Timp rămas = Ore alocate - Ore lucrate
    const oreRamase = oreAlocateDisponibile - totalOreLucrate;
    const zileRamase = oreRamase / orePeZi;
    const progresTimp = oreAlocateDisponibile > 0 ? (totalOreLucrate / oreAlocateDisponibile) * 100 : 0;

    // Cost final proiect = Cheltuieli + (Cost/oră × Timp lucrat)
    const costTimpLucrat = costOra * totalOreLucrate;
    const costFinalProiect = cheltuieliInMonedaProiect + costTimpLucrat;

    // Profit/Pierdere = Valoare proiect - Cost final
    const profitPierdere = valoareProiect - costFinalProiect;

    // 8. Structurează răspunsul
    return NextResponse.json({
      success: true,
      data: {
        proiect: {
          id: proiect.ID_Proiect,
          denumire: proiect.Denumire,
          valoare: valoareProiect,
          moneda: proiect.moneda || 'EUR',
          valoare_ron: valoareProiectRON,
          curs_valutar: cursValutar,
          status: proiect.Status,
          data_start: proiect.Data_Start?.value || proiect.Data_Start,
          data_final: proiect.Data_Final?.value || proiect.Data_Final
        },

        timp_lucrat: {
          total_ore: parseFloat(totalOreLucrate.toFixed(2)),
          total_zile: parseFloat((totalOreLucrate / orePeZi).toFixed(2)),
          persoane: timeRows.map((row: any) => ({
            utilizator_uid: row.utilizator_uid,
            utilizator_nume: row.utilizator_nume,
            ore_lucrate: parseFloat(parseFloat(row.total_ore).toFixed(2)),
            zile_lucrate: parseFloat((parseFloat(row.total_ore) / orePeZi).toFixed(2)),
            numar_inregistrari: parseInt(row.numar_inregistrari),
            prima_zi: row.prima_zi?.value || row.prima_zi,
            ultima_zi: row.ultima_zi?.value || row.ultima_zi
          })),
          numar_persoane: timeRows.length
        },

        cheltuieli: {
          total: parseFloat(cheltuieliInMonedaProiect.toFixed(2)),
          total_ron: parseFloat(totalCheltuieli.toFixed(2)),
          moneda: proiect.moneda || 'EUR',
          lista: cheltuieliRows.map((row: any) => ({
            id: row.id,
            tip: row.tip_cheltuiala,
            furnizor: row.furnizor_nume,
            descriere: row.descriere,
            valoare: parseFloat(row.valoare || 0),
            moneda: row.moneda,
            valoare_ron: parseFloat(row.valoare_ron || row.valoare || 0),
            status_achitare: row.status_achitare,
            status_predare: row.status_predare
          })),
          numar_cheltuieli: cheltuieliRows.length
        },

        indicatori: {
          // Productivitate
          productivitate_per_ora: parseFloat(productivitatePerOra.toFixed(2)),
          productivitate_label: `${productivitatePerOra.toFixed(2)} ${proiect.moneda || 'EUR'}/oră/om`,

          // Ore/Zile alocate
          ore_alocate_disponibile: parseFloat(oreAlocateDisponibile.toFixed(2)),
          zile_alocate_disponibile: parseFloat(zileAlocateDisponibile.toFixed(2)),
          ore_ramase: parseFloat(oreRamase.toFixed(2)),
          zile_ramase: parseFloat(zileRamase.toFixed(2)),
          progres_timp_procent: parseFloat(Math.min(progresTimp, 100).toFixed(1)),
          depasire_timp: oreRamase < 0,

          // Costuri
          cost_timp_lucrat: parseFloat(costTimpLucrat.toFixed(2)),
          cost_final_proiect: parseFloat(costFinalProiect.toFixed(2)),
          profit_pierdere: parseFloat(profitPierdere.toFixed(2)),
          este_profitabil: profitPierdere >= 0,

          // Setări cost folosite
          cost_ora_setat: costOra,
          cost_zi_setat: costZi,
          ore_pe_zi: orePeZi,
          moneda_cost: monedaCost
        },

        sumar: {
          valoare_proiect: parseFloat(valoareProiect.toFixed(2)),
          cheltuieli_directe: parseFloat(cheltuieliInMonedaProiect.toFixed(2)),
          cost_timp_lucrat: parseFloat(costTimpLucrat.toFixed(2)),
          total_costuri: parseFloat(costFinalProiect.toFixed(2)),
          diferenta: parseFloat(profitPierdere.toFixed(2)),
          diferenta_tip: profitPierdere >= 0 ? 'profit' : 'pierdere',
          moneda: proiect.moneda || 'EUR'
        }
      }
    });

  } catch (error) {
    console.error('Eroare la obținerea statisticilor proiect:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea statisticilor proiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
