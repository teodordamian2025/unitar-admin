// ==================================================================
// CALEA: app/api/analytics/time-tracking/route.ts
// CREAT: 14.09.2025 12:30 (ora României)
// DESCRIERE: API pentru extragerea datelor de analiză time tracking
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Force dynamic rendering for this route (fixes DynamicServerError)
export const dynamic = 'force-dynamic';
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';
const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Tabele cu suffix dinamic
const TABLE_TIME_TRACKING = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_CHELTUIELI = `\`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\``;
const TABLE_SETARI_COSTURI = `\`${PROJECT_ID}.${DATASET}.SetariCosturi${tableSuffix}\``;

console.log(`🔧 Time Tracking Analytics - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: TimeTracking${tableSuffix}, Proiecte${tableSuffix}, Sarcini${tableSuffix}`);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // ultimele 30 zile
    const userId = searchParams.get('userId'); // optional - pentru un utilizator specific
    const proiectId = searchParams.get('proiectId'); // optional - pentru un proiect specific
    const type = searchParams.get('type') || 'overview'; // overview, individual, team, project

    let query = '';
    let queryParams: any[] = [];

    switch (type) {
      case 'overview':
        query = `
          WITH analytics_data AS (
            SELECT
              tt.data_lucru,
              tt.utilizator_uid,
              tt.utilizator_nume,
              tt.ore_lucrate,
              tt.proiect_id,
              p.Denumire as proiect_nume,
              p.Status as proiect_status,
              s.titlu as sarcina_titlu,
              s.status as sarcina_status,
              s.prioritate,
              s.timp_estimat_total_ore,
              EXTRACT(DAYOFWEEK FROM tt.data_lucru) as day_of_week,
              EXTRACT(WEEK FROM tt.data_lucru) as week_number
            FROM ${TABLE_TIME_TRACKING} tt
            LEFT JOIN ${TABLE_PROIECTE} p
              ON tt.proiect_id = p.ID_Proiect
            LEFT JOIN ${TABLE_SARCINI} s
              ON tt.sarcina_id = s.id
            WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL ${period} DAY)
              AND tt.ore_lucrate > 0
          )
          SELECT 
            -- Statistici generale
            COUNT(DISTINCT utilizator_uid) as total_utilizatori,
            COUNT(DISTINCT proiect_id) as total_proiecte,
            ROUND(SUM(ore_lucrate), 2) as total_ore_lucrate,
            ROUND(AVG(ore_lucrate), 2) as media_ore_pe_zi,
            
            -- Distribuție pe zile săptămâna
            ROUND(AVG(CASE WHEN day_of_week = 2 THEN ore_lucrate END), 2) as media_luni,
            ROUND(AVG(CASE WHEN day_of_week = 3 THEN ore_lucrate END), 2) as media_marti,
            ROUND(AVG(CASE WHEN day_of_week = 4 THEN ore_lucrate END), 2) as media_miercuri,
            ROUND(AVG(CASE WHEN day_of_week = 5 THEN ore_lucrate END), 2) as media_joi,
            ROUND(AVG(CASE WHEN day_of_week = 6 THEN ore_lucrate END), 2) as media_vineri,
            ROUND(AVG(CASE WHEN day_of_week = 7 THEN ore_lucrate END), 2) as media_sambata,
            ROUND(AVG(CASE WHEN day_of_week = 1 THEN ore_lucrate END), 2) as media_duminica,
            
            -- Eficiență (ore reale vs estimate)
            ROUND(
              SAFE_DIVIDE(
                SUM(ore_lucrate), 
                SUM(COALESCE(timp_estimat_total_ore, ore_lucrate))
              ) * 100, 
              1
            ) as eficienta_procent
            
          FROM analytics_data
        `;
        queryParams = [{ name: 'period', parameterType: { type: 'INT64' }, parameterValue: { value: period } }];
        break;

      case 'daily-trend':
        query = `
          SELECT
            tt.data_lucru,
            ROUND(SUM(tt.ore_lucrate), 2) as total_ore,
            COUNT(DISTINCT tt.utilizator_uid) as utilizatori_activi,
            COUNT(DISTINCT tt.proiect_id) as proiecte_active,
            ROUND(AVG(tt.ore_lucrate), 2) as media_ore_per_utilizator
          FROM ${TABLE_TIME_TRACKING} tt
          WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL ${period} DAY)
            AND tt.ore_lucrate > 0
          GROUP BY tt.data_lucru
          ORDER BY tt.data_lucru ASC
        `;
        queryParams = [{ name: 'period', parameterType: { type: 'INT64' }, parameterValue: { value: period } }];
        break;

      case 'team-performance':
        query = `
          SELECT
            tt.utilizator_uid,
            tt.utilizator_nume,
            ROUND(SUM(tt.ore_lucrate), 2) as total_ore,
            ROUND(AVG(tt.ore_lucrate), 2) as media_ore_zilnic,
            COUNT(DISTINCT tt.data_lucru) as zile_active,
            COUNT(DISTINCT tt.proiect_id) as proiecte_lucrate,
            COUNT(DISTINCT tt.sarcina_id) as sarcini_lucrate,

            -- Calculez eficiența
            ROUND(
              SAFE_DIVIDE(
                SUM(tt.ore_lucrate),
                SUM(COALESCE(s.timp_estimat_total_ore, tt.ore_lucrate))
              ) * 100,
              1
            ) as eficienta_procent,

            -- Distribuție pe priorități (mapare valori reale din DB)
            ROUND(SUM(CASE WHEN s.prioritate = 'Critică' THEN tt.ore_lucrate ELSE 0 END), 2) as ore_urgent,
            ROUND(SUM(CASE WHEN s.prioritate = 'Înaltă' THEN tt.ore_lucrate ELSE 0 END), 2) as ore_ridicata,
            ROUND(SUM(CASE WHEN s.prioritate = 'Medie' THEN tt.ore_lucrate ELSE 0 END), 2) as ore_normala,
            ROUND(SUM(CASE WHEN s.prioritate = 'Scăzută' THEN tt.ore_lucrate ELSE 0 END), 2) as ore_scazuta

          FROM ${TABLE_TIME_TRACKING} tt
          LEFT JOIN ${TABLE_SARCINI} s
            ON tt.sarcina_id = s.id
          WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL ${period} DAY)
            AND tt.ore_lucrate > 0
          GROUP BY tt.utilizator_uid, tt.utilizator_nume
          ORDER BY total_ore DESC
        `;
        queryParams = [{ name: 'period', parameterType: { type: 'INT64' }, parameterValue: { value: period } }];
        break;

      case 'project-breakdown':
        // ✅ 23.01.2026: Query extins cu date financiare complete pentru admin
        query = `
          WITH cost_settings AS (
            SELECT
              COALESCE(cost_ora, 40) as cost_ora,
              COALESCE(cost_zi, 320) as cost_zi,
              COALESCE(ore_pe_zi, 8) as ore_pe_zi,
              COALESCE(moneda, 'EUR') as moneda_cost
            FROM ${TABLE_SETARI_COSTURI}
            WHERE activ = TRUE
            ORDER BY data_creare DESC
            LIMIT 1
          ),
          cheltuieli_proiect AS (
            SELECT
              proiect_id,
              ROUND(SUM(COALESCE(valoare_ron, valoare)), 2) as total_cheltuieli_ron
            FROM ${TABLE_CHELTUIELI}
            WHERE activ = TRUE
            GROUP BY proiect_id
          ),
          time_data AS (
            SELECT
              tt.proiect_id,
              ROUND(SUM(tt.ore_lucrate), 2) as total_ore,
              COUNT(DISTINCT tt.utilizator_uid) as utilizatori_implicati,
              COUNT(DISTINCT tt.sarcina_id) as sarcini_lucrate,
              ROUND(AVG(tt.ore_lucrate), 2) as media_ore_pe_sesiune,
              SUM(COALESCE(s.timp_estimat_total_ore, 8)) as total_ore_estimate
            FROM ${TABLE_TIME_TRACKING} tt
            LEFT JOIN ${TABLE_SARCINI} s ON tt.sarcina_id = s.id
            WHERE tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL ${period} DAY)
              AND tt.ore_lucrate > 0
            GROUP BY tt.proiect_id
          )
          SELECT
            td.proiect_id,
            p.Denumire as proiect_nume,
            p.Status as proiect_status,
            COALESCE(p.Valoare_Estimata, 0) as valoare_estimata,
            p.moneda,
            COALESCE(p.valoare_ron, p.Valoare_Estimata) as valoare_ron,
            COALESCE(p.curs_valutar, 5) as curs_valutar,
            td.total_ore,
            td.utilizatori_implicati,
            td.sarcini_lucrate,
            td.media_ore_pe_sesiune,

            -- Progres general (ore lucrate vs estimate din sarcini)
            ROUND(
              SAFE_DIVIDE(td.total_ore, td.total_ore_estimate) * 100,
              1
            ) as progres_procent,

            -- Date financiare
            COALESCE(ch.total_cheltuieli_ron, 0) as cheltuieli_directe_ron,
            cs.cost_ora,
            cs.moneda_cost,

            -- Cost timp lucrat = ore * cost/oră
            ROUND(td.total_ore * cs.cost_ora, 2) as cost_timp_lucrat,

            -- Cheltuieli în moneda proiectului
            CASE
              WHEN p.moneda = 'RON' THEN COALESCE(ch.total_cheltuieli_ron, 0)
              ELSE ROUND(SAFE_DIVIDE(COALESCE(ch.total_cheltuieli_ron, 0), COALESCE(p.curs_valutar, 5)), 2)
            END as cheltuieli_directe,

            -- Cost total proiect = cheltuieli + cost timp
            ROUND(
              CASE
                WHEN p.moneda = 'RON' THEN COALESCE(ch.total_cheltuieli_ron, 0)
                ELSE SAFE_DIVIDE(COALESCE(ch.total_cheltuieli_ron, 0), COALESCE(p.curs_valutar, 5))
              END + (td.total_ore * cs.cost_ora),
              2
            ) as cost_total,

            -- Profit/Pierdere = Valoare - Cost total
            ROUND(
              COALESCE(p.Valoare_Estimata, 0) - (
                CASE
                  WHEN p.moneda = 'RON' THEN COALESCE(ch.total_cheltuieli_ron, 0)
                  ELSE SAFE_DIVIDE(COALESCE(ch.total_cheltuieli_ron, 0), COALESCE(p.curs_valutar, 5))
                END + (td.total_ore * cs.cost_ora)
              ),
              2
            ) as profit_pierdere,

            -- Este profitabil?
            CASE
              WHEN COALESCE(p.Valoare_Estimata, 0) - (
                CASE
                  WHEN p.moneda = 'RON' THEN COALESCE(ch.total_cheltuieli_ron, 0)
                  ELSE SAFE_DIVIDE(COALESCE(ch.total_cheltuieli_ron, 0), COALESCE(p.curs_valutar, 5))
                END + (td.total_ore * cs.cost_ora)
              ) >= 0 THEN TRUE
              ELSE FALSE
            END as este_profitabil,

            -- Ore alocate disponibile = (Valoare - Cheltuieli) / cost_ora
            ROUND(
              SAFE_DIVIDE(
                COALESCE(p.Valoare_Estimata, 0) - CASE
                  WHEN p.moneda = 'RON' THEN COALESCE(ch.total_cheltuieli_ron, 0)
                  ELSE SAFE_DIVIDE(COALESCE(ch.total_cheltuieli_ron, 0), COALESCE(p.curs_valutar, 5))
                END,
                cs.cost_ora
              ),
              2
            ) as ore_alocate_disponibile,

            -- Progres economic = (ore lucrate / ore alocate disponibile) * 100
            ROUND(
              SAFE_DIVIDE(
                td.total_ore * 100,
                NULLIF(
                  SAFE_DIVIDE(
                    COALESCE(p.Valoare_Estimata, 0) - CASE
                      WHEN p.moneda = 'RON' THEN COALESCE(ch.total_cheltuieli_ron, 0)
                      ELSE SAFE_DIVIDE(COALESCE(ch.total_cheltuieli_ron, 0), COALESCE(p.curs_valutar, 5))
                    END,
                    cs.cost_ora
                  ),
                  0
                )
              ),
              1
            ) as progres_economic

          FROM time_data td
          LEFT JOIN ${TABLE_PROIECTE} p ON td.proiect_id = p.ID_Proiect
          LEFT JOIN cheltuieli_proiect ch ON td.proiect_id = ch.proiect_id
          CROSS JOIN cost_settings cs
          ORDER BY td.total_ore DESC
        `;
        queryParams = [{ name: 'period', parameterType: { type: 'INT64' }, parameterValue: { value: period } }];
        break;

      case 'individual':
        if (!userId) {
          return NextResponse.json({ error: 'userId este necesar pentru tipul individual' }, { status: 400 });
        }

        query = `
          WITH user_stats AS (
            SELECT
              tt.data_lucru,
              tt.ore_lucrate,
              tt.proiect_id,
              p.Denumire as proiect_nume,
              s.titlu as sarcina_titlu,
              s.prioritate,
              s.timp_estimat_total_ore,
              s.status as sarcina_status,
              EXTRACT(DAYOFWEEK FROM tt.data_lucru) as day_of_week
            FROM ${TABLE_TIME_TRACKING} tt
            LEFT JOIN ${TABLE_PROIECTE} p
              ON tt.proiect_id = p.ID_Proiect
            LEFT JOIN ${TABLE_SARCINI} s
              ON tt.sarcina_id = s.id
            WHERE tt.utilizator_uid = '${userId}'
              AND tt.data_lucru >= DATE_SUB(CURRENT_DATE(), INTERVAL ${period} DAY)
              AND tt.ore_lucrate > 0
          )
          SELECT 
            -- Statistici personale
            ROUND(SUM(ore_lucrate), 2) as total_ore,
            ROUND(AVG(ore_lucrate), 2) as media_ore_zilnic,
            COUNT(DISTINCT data_lucru) as zile_active,
            COUNT(DISTINCT proiect_id) as proiecte_lucrate,
            
            -- Eficiență personală
            ROUND(
              SAFE_DIVIDE(
                SUM(ore_lucrate),
                SUM(COALESCE(timp_estimat_total_ore, ore_lucrate))
              ) * 100,
              1
            ) as eficienta_procent,
            
            -- Pattern săptămânal
            ROUND(AVG(CASE WHEN day_of_week = 2 THEN ore_lucrate END), 2) as avg_luni,
            ROUND(AVG(CASE WHEN day_of_week = 3 THEN ore_lucrate END), 2) as avg_marti,
            ROUND(AVG(CASE WHEN day_of_week = 4 THEN ore_lucrate END), 2) as avg_miercuri,
            ROUND(AVG(CASE WHEN day_of_week = 5 THEN ore_lucrate END), 2) as avg_joi,
            ROUND(AVG(CASE WHEN day_of_week = 6 THEN ore_lucrate END), 2) as avg_vineri,
            
            -- Top proiect
            (SELECT proiect_nume FROM user_stats 
             GROUP BY proiect_id, proiect_nume 
             ORDER BY SUM(ore_lucrate) DESC LIMIT 1) as top_proiect
            
          FROM user_stats
        `;
        queryParams = [
          { name: 'userId', parameterType: { type: 'STRING' }, parameterValue: { value: userId } },
          { name: 'period', parameterType: { type: 'INT64' }, parameterValue: { value: period } }
        ];
        break;

      default:
        return NextResponse.json({ error: 'Tip analiză necunoscut' }, { status: 400 });
    }

    const options = {
      query: query,
      location: 'EU',
    };

    const [rows] = await bigquery.query(options);
    
    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        type,
        period: parseInt(period),
        timestamp: new Date().toISOString(),
        total_records: rows.length
      }
    });

  } catch (error) {
    console.error('Eroare analytics time tracking:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la extragerea datelor de analiză' },
      { status: 500 }
    );
  }
}
