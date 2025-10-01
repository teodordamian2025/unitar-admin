// ==================================================================
// CALEA: app/api/analytics/live-timer/hierarchy/route.ts
// DATA: 27.09.2025 23:45 (ora României)
// DESCRIERE: API pentru încărcarea ierarhiei proiecte → subproiecte → sarcini pentru Live Timer
// FUNCȚIONALITATE: Returnează structura ierarhică corectă bazată pe tip_proiect din BigQuery
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;

console.log(`🔧 Live Timer Hierarchy API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Proiecte${tableSuffix}, Subproiecte${tableSuffix}, Sarcini${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper function pentru a extrage valoarea din obiectele BigQuery
function extractBigQueryValue(field: any): any {
  if (field && typeof field === 'object' && 'value' in field) {
    return field.value;
  }
  return field;
}

// Helper function pentru a procesa rândurile BigQuery
function processBigQueryRows(rows: any[]): any[] {
  return rows.map(row => {
    const processedRow: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      processedRow[key] = extractBigQueryValue(value);
    }
    
    return processedRow;
  });
}

// GET - Obținere ierarhie proiect → subproiecte → sarcini
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id');

    if (!proiectId) {
      return NextResponse.json({ 
        success: false, 
        error: 'proiect_id este obligatoriu' 
      }, { status: 400 });
    }

    // 1. Obțin informații despre proiectul principal
    const proiectQuery = `
      SELECT
        ID_Proiect,
        Denumire,
        Status,
        Adresa,
        Client
      FROM ${TABLE_PROIECTE}
      WHERE ID_Proiect = @proiect_id
    `;

    const [proiectRows] = await bigquery.query({
      query: proiectQuery,
      location: 'EU',
      params: { proiect_id: proiectId }
    });

    if (proiectRows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Proiectul nu a fost găsit' 
      }, { status: 404 });
    }

    const proiectData = processBigQueryRows(proiectRows)[0];

    // 2. Obțin subproiectele active ale proiectului
    const subproiecteQuery = `
      SELECT
        ID_Subproiect,
        Denumire,
        Status,
        Responsabil,
        Data_Start,
        Data_Final,
        Valoare_Estimata,
        moneda
      FROM ${TABLE_SUBPROIECTE}
      WHERE ID_Proiect = @proiect_id
        AND Status = 'Activ'
        AND (activ IS NULL OR activ = true)
      ORDER BY Denumire ASC
    `;

    const [subproiecteRows] = await bigquery.query({
      query: subproiecteQuery,
      location: 'EU',
      params: { proiect_id: proiectId }
    });

    const subproiecteData = processBigQueryRows(subproiecteRows);

    // 3. Obțin sarcinile generale ale proiectului (tip_proiect = 'proiect')
    const sarciniProiectQuery = `
      SELECT
        id,
        titlu,
        descriere,
        prioritate,
        status,
        data_scadenta,
        timp_estimat_total_ore,
        progres_procent
      FROM ${TABLE_SARCINI}
      WHERE proiect_id = @proiect_id
        AND tip_proiect = 'proiect'
        AND status IN ('De făcut', 'În lucru')
      ORDER BY
        CASE prioritate
          WHEN 'Urgent' THEN 1
          WHEN 'Ridicată' THEN 2
          WHEN 'Medie' THEN 3
          WHEN 'Scăzută' THEN 4
          ELSE 5
        END,
        data_scadenta ASC,
        titlu ASC
    `;

    const [sarciniProiectRows] = await bigquery.query({
      query: sarciniProiectQuery,
      location: 'EU',
      params: { proiect_id: proiectId }
    });

    const sarciniProiectData = processBigQueryRows(sarciniProiectRows);

    // 4. Pentru fiecare subproiect, obțin sarcinile sale
    const subproiecteComplete = await Promise.all(
      subproiecteData.map(async (subproiect) => {
        const sarciniSubproiectQuery = `
          SELECT
            id,
            titlu,
            descriere,
            prioritate,
            status,
            data_scadenta,
            timp_estimat_total_ore,
            progres_procent
          FROM ${TABLE_SARCINI}
          WHERE proiect_id = @subproiect_id
            AND tip_proiect = 'subproiect'
            AND status IN ('De făcut', 'În lucru')
          ORDER BY
            CASE prioritate
              WHEN 'Urgent' THEN 1
              WHEN 'Ridicată' THEN 2
              WHEN 'Medie' THEN 3
              WHEN 'Scăzută' THEN 4
              ELSE 5
            END,
            data_scadenta ASC,
            titlu ASC
        `;

        const [sarciniSubproiectRows] = await bigquery.query({
          query: sarciniSubproiectQuery,
          location: 'EU',
          params: { subproiect_id: subproiect.ID_Subproiect }
        });

        const sarciniSubproiectData = processBigQueryRows(sarciniSubproiectRows);

        return {
          ...subproiect,
          sarcini: sarciniSubproiectData,
          total_sarcini: sarciniSubproiectData.length
        };
      })
    );

    // 5. Calculez statistici pentru răspuns
    const totalSarciniSubproiecte = subproiecteComplete.reduce(
      (total, sub) => total + sub.total_sarcini, 0
    );

    const hierarchyData = {
      proiect: {
        ...proiectData,
        sarcini_generale: sarciniProiectData,
        total_sarcini_generale: sarciniProiectData.length
      },
      subproiecte: subproiecteComplete,
      has_subproiecte: subproiecteComplete.length > 0,
      summary: {
        total_subproiecte: subproiecteComplete.length,
        total_sarcini_proiect: sarciniProiectData.length,
        total_sarcini_subproiecte: totalSarciniSubproiecte,
        total_sarcini_global: sarciniProiectData.length + totalSarciniSubproiecte
      }
    };

    return NextResponse.json({
      success: true,
      data: hierarchyData,
      meta: {
        proiect_id: proiectId,
        timestamp: new Date().toISOString(),
        query_type: 'hierarchy'
      }
    });

  } catch (error) {
    console.error('Eroare GET hierarchy live timer:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la obținerea ierarhiei proiect-subproiecte' },
      { status: 500 }
    );
  }
}
