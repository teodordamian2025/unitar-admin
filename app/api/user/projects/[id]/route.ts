// ==================================================================
// CALEA: app/api/user/projects/[id]/route.ts
// DATA: 04.10.2025 23:30 (ora României)
// DESCRIERE: API pentru detalii proiect utilizatori normali - FĂRĂ date financiare
// FUNCȚIONALITATE: Returnează detalii complete proiect cu contracte, facturi - dar exclude valorile financiare
// MODIFICAT: Adăugat progres_procent, ID_Subproiect și fix tabele _v2
// MODIFICAT: 21.01.2026 - Adăugat timp economic (doar ore, fără valori financiare)
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
const PROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const SUBPROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const CONTRACTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const FACTURI_TABLE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const ETAPE_CONTRACT_TABLE = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;
const ETAPE_FACTURI_TABLE = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;
// ✅ 21.01.2026: Tabele pentru calcul timp economic
const TIME_TRACKING_TABLE = `\`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\``;
const SARCINI_TABLE = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const CHELTUIELI_TABLE = `\`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\``;
const SETARI_COSTURI_TABLE = `\`${PROJECT_ID}.${DATASET}.SetariCosturi${tableSuffix}\``;

console.log(`🔧 [User Projects ID] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json({ error: 'ID proiect lipsește' }, { status: 400 });
    }

    // Query pentru proiectul principal - EXCLUDE toate câmpurile financiare
    const proiectQuery = `
      SELECT
        ID_Proiect,
        Denumire,
        Client,
        Status,
        Data_Start,
        Data_Final,
        Descriere,
        Responsabil,
        status_predare,
        progres_procent,
        Observatii
        -- Exclude: Prioritate (not in Proiecte table), Valoare_Estimata, valoare_ron, moneda, buget_*, cost_*
      FROM ${PROIECTE_TABLE}
      WHERE ID_Proiect = @projectId
    `;

    const [proiectRows] = await bigquery.query({
      query: proiectQuery,
      params: { projectId }
    });

    if (proiectRows.length === 0) {
      return NextResponse.json({ error: 'Proiectul nu a fost găsit' }, { status: 404 });
    }

    const proiect = proiectRows[0];

    // Query pentru subproiecte - din tabela Subproiecte
    const subproiecteQuery = `
      SELECT
        ID_Subproiect,
        ID_Proiect,
        Denumire,
        Status,
        Data_Start,
        Data_Final,
        Responsabil,
        status_predare,
        progres_procent
        -- Exclude: financial fields (Valoare_Estimata, valoare_ron, moneda)
      FROM ${SUBPROIECTE_TABLE}
      WHERE ID_Proiect = @projectId AND activ = true
      ORDER BY Data_Start DESC
    `;

    const [subproiecteRows] = await bigquery.query({
      query: subproiecteQuery,
      params: { projectId }
    });

    // Query pentru contracte - EXCLUDE valorile financiare
    const contracteQuery = `
      SELECT
        c.ID_Contract,
        c.numar_contract,
        c.serie_contract,
        c.Data_Semnare,
        c.Status AS Status_Contract,
        c.Observatii
        -- Exclude: Valoare, Moneda, etc.
      FROM ${CONTRACTE_TABLE} c
      WHERE c.proiect_id = @projectId
      ORDER BY c.Data_Semnare DESC
    `;

    let contracteRows: any[] = [];
    try {
      [contracteRows] = await bigquery.query({
        query: contracteQuery,
        params: { projectId }
      });
    } catch (error) {
      console.warn('Tabelul Contracte nu există sau nu are date:', error);
    }

    // Query pentru facturi - Include detalii complete DAR EXCLUDE valorile financiare
    // ✅ FIX 10.01.2026: Adăugat CTE incasari_facturi pentru calcul corect status încasări (ca la admin)
    const facturiQuery = `
      WITH incasari_facturi AS (
        -- Agregăm încasările din EtapeFacturi pentru fiecare factură (identic cu admin)
        SELECT
          factura_id,
          SUM(COALESCE(valoare_incasata, 0)) as total_incasat
        FROM ${ETAPE_FACTURI_TABLE}
        WHERE activ = true AND factura_id IS NOT NULL
        GROUP BY factura_id
      )
      SELECT
        fg.id as ID_Factura,
        fg.serie as Serie_Factura,
        fg.numar as Numar_Factura,
        fg.data_factura as Data_Emitere,
        fg.data_scadenta as Data_Scadenta,
        fg.status as Status_Plata,

        -- Corespondență cu subproiecte (similar cu admin)
        s.Denumire as Subproiect_Asociat,
        ef.tip_etapa,

        -- ✅ FIX: Calcul status scadență cu încasări corecte din EtapeFacturi
        CASE
          WHEN fg.data_scadenta < CURRENT_DATE() AND (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) > 0 THEN 'Expirată'
          WHEN DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) <= 7 AND (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) > 0 THEN 'Expiră curând'
          WHEN (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) <= 0 THEN 'Plătită'
          ELSE 'În regulă'
        END as Status_Scadenta,

        -- ✅ NOU 10.01.2026: Status încasări (identic cu admin) - pentru afișare corectă în UI user
        CASE
          WHEN (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) <= 0 OR COALESCE(inc.total_incasat, fg.valoare_platita, 0) >= fg.total THEN 'incasat_complet'
          WHEN COALESCE(inc.total_incasat, fg.valoare_platita, 0) > 0 AND (fg.total - COALESCE(inc.total_incasat, fg.valoare_platita, 0)) > 0 THEN 'incasat_partial'
          ELSE 'neincasat'
        END as status_incasari,

        -- ✅ NOU 10.01.2026: Procent încasat (fără sume în lei) - pentru afișare în UI user
        CASE
          WHEN fg.total > 0 THEN ROUND((COALESCE(inc.total_incasat, fg.valoare_platita, 0) / fg.total) * 100, 0)
          ELSE 0
        END as procent_incasat

        -- EXCLUDE: total, valoare_platita, rest_de_plata (sumele rămân ascunse)
      FROM ${FACTURI_TABLE} fg
      LEFT JOIN ${ETAPE_FACTURI_TABLE} ef
        ON fg.id = ef.factura_id AND ef.activ = true
      LEFT JOIN ${SUBPROIECTE_TABLE} s
        ON ef.subproiect_id = s.ID_Subproiect AND s.activ = true
      LEFT JOIN incasari_facturi inc
        ON fg.id = inc.factura_id
      WHERE fg.proiect_id = @projectId
      ORDER BY fg.data_factura DESC
    `;

    let facturiRows: any[] = [];
    try {
      [facturiRows] = await bigquery.query({
        query: facturiQuery,
        params: { projectId }
      });
    } catch (error) {
      console.warn('Tabelul FacturiGenerate nu există sau nu are date:', error);
    }

    // ✅ 21.01.2026: Query pentru calcul timp economic (DOAR ore, fără valori financiare)
    // Acest calcul este similar cu cel din gantt-data dar returnează doar orele
    const timpEconomicQuery = `
      WITH
      -- Ore lucrate pe proiect (din TimeTracking)
      time_tracking_stats AS (
        SELECT
          COALESCE(tt.proiect_id, s.proiect_id) as proiect_id,
          SUM(COALESCE(tt.ore_lucrate, 0)) as total_worked_hours
        FROM ${TIME_TRACKING_TABLE} tt
        LEFT JOIN ${SARCINI_TABLE} s ON tt.sarcina_id = s.id
        WHERE tt.proiect_id = @projectId OR s.proiect_id = @projectId
        GROUP BY COALESCE(tt.proiect_id, s.proiect_id)
      ),
      -- Ore estimate din sarcini
      estimated_hours_stats AS (
        SELECT
          proiect_id,
          SUM(COALESCE(timp_estimat_total_ore, 0)) as total_estimated_hours
        FROM ${SARCINI_TABLE}
        WHERE proiect_id = @projectId
        GROUP BY proiect_id
      ),
      -- Cheltuieli (pentru calcul ore economic)
      cheltuieli_stats AS (
        SELECT
          proiect_id,
          SUM(COALESCE(valoare_ron, valoare, 0)) as total_cheltuieli_ron
        FROM ${CHELTUIELI_TABLE}
        WHERE activ = TRUE AND proiect_id = @projectId
        GROUP BY proiect_id
      ),
      -- Setări costuri
      cost_settings AS (
        SELECT
          COALESCE(
            (SELECT cost_ora FROM ${SETARI_COSTURI_TABLE} WHERE activ = TRUE ORDER BY data_creare DESC LIMIT 1),
            40
          ) as cost_ora,
          COALESCE(
            (SELECT ore_pe_zi FROM ${SETARI_COSTURI_TABLE} WHERE activ = TRUE ORDER BY data_creare DESC LIMIT 1),
            8
          ) as ore_pe_zi
      ),
      -- Valoare proiect (doar pentru calcul intern)
      proiect_valoare AS (
        SELECT
          ID_Proiect,
          COALESCE(Valoare_Estimata, 0) as Valoare_Estimata,
          COALESCE(valoare_ron, Valoare_Estimata, 0) as valoare_ron,
          COALESCE(curs_valutar, 5) as curs_valutar,
          moneda
        FROM ${PROIECTE_TABLE}
        WHERE ID_Proiect = @projectId
      )
      SELECT
        -- Ore lucrate
        COALESCE(tts.total_worked_hours, 0) as workedHours,
        -- Ore estimate din sarcini
        COALESCE(ehs.total_estimated_hours, 0) as estimatedHours,
        -- Ore alocate economic = (Valoare - Cheltuieli) / Cost oră
        -- NOTĂ: Returnăm doar orele, nu valorile financiare
        SAFE_DIVIDE(
          pv.Valoare_Estimata - (
            CASE
              WHEN pv.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
              ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pv.curs_valutar, 0)
            END
          ),
          csett.cost_ora
        ) as economicHoursAllocated,
        -- Ore rămase economic
        SAFE_DIVIDE(
          pv.Valoare_Estimata - (
            CASE
              WHEN pv.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
              ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pv.curs_valutar, 0)
            END
          ),
          csett.cost_ora
        ) - COALESCE(tts.total_worked_hours, 0) as economicHoursRemaining,
        -- Progres economic (%)
        SAFE_DIVIDE(
          COALESCE(tts.total_worked_hours, 0) * 100,
          NULLIF(
            SAFE_DIVIDE(
              pv.Valoare_Estimata - (
                CASE
                  WHEN pv.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
                  ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(pv.curs_valutar, 0)
                END
              ),
              csett.cost_ora
            ),
            0
          )
        ) as economicProgress,
        -- Ore pe zi (pentru afișare în zile)
        csett.ore_pe_zi as ore_pe_zi
      FROM proiect_valoare pv
      LEFT JOIN time_tracking_stats tts ON pv.ID_Proiect = tts.proiect_id
      LEFT JOIN estimated_hours_stats ehs ON pv.ID_Proiect = ehs.proiect_id
      LEFT JOIN cheltuieli_stats chs ON pv.ID_Proiect = chs.proiect_id
      CROSS JOIN cost_settings csett
    `;

    let timpEconomic: any = null;
    try {
      const [timpEconomicRows] = await bigquery.query({
        query: timpEconomicQuery,
        params: { projectId }
      });
      if (timpEconomicRows.length > 0) {
        timpEconomic = timpEconomicRows[0];
      }
    } catch (error) {
      console.warn('Nu s-a putut calcula timpul economic:', error);
    }

    // Procesare date pentru a elimina orice urmă de informații financiare
    const processedProiect = {
      ...proiect,
      // Asigură că nu există câmpuri financiare (PĂSTRĂM progres_procent și status_predare)
      Valoare_Estimata: undefined,
      valoare_ron: undefined,
      moneda: undefined,
      buget_total: undefined,
      cost_total: undefined,
      profit_estimat: undefined
    };

    const processedSubproiecte = subproiecteRows.map((sub: any) => ({
      ...sub,
      // Elimină câmpurile financiare (PĂSTRĂM progres_procent și status_predare)
      Valoare_Estimata: undefined,
      valoare_ron: undefined,
      moneda: undefined,
      buget_total: undefined,
      cost_total: undefined,
      profit_estimat: undefined
    }));

    const processedContracte = contracteRows.map((contract: any) => ({
      ...contract,
      // Elimină câmpurile financiare
      Valoare_Contract: undefined,
      Moneda: undefined,
      TVA_Procent: undefined,
      Valoare_cu_TVA: undefined
    }));

    const processedFacturi = facturiRows.map((factura: any) => ({
      ID_Factura: factura.ID_Factura,
      Serie_Factura: factura.Serie_Factura,
      Numar_Factura: factura.Numar_Factura,
      Data_Emitere: factura.Data_Emitere,
      Data_Scadenta: factura.Data_Scadenta,
      Status_Plata: factura.Status_Plata,
      Status_Scadenta: factura.Status_Scadenta,
      Subproiect_Asociat: factura.Subproiect_Asociat,
      tip_etapa: factura.tip_etapa,
      // ✅ NOU 10.01.2026: Status încasări și procent (fără sume financiare)
      status_incasari: factura.status_incasari,
      procent_incasat: factura.procent_incasat
      // EXCLUDE complet toate câmpurile financiare (nu le mapăm deloc)
    }));

    return NextResponse.json({
      success: true,
      proiect: processedProiect,
      subproiecte: processedSubproiecte,
      contracte: processedContracte,
      facturi: processedFacturi,
      // ✅ 21.01.2026: Timp economic (doar ore, fără valori financiare)
      timpEconomic: timpEconomic ? {
        workedHours: Number(timpEconomic.workedHours || 0),
        estimatedHours: Number(timpEconomic.estimatedHours || 0),
        economicHoursAllocated: Number(timpEconomic.economicHoursAllocated || 0),
        economicHoursRemaining: Number(timpEconomic.economicHoursRemaining || 0),
        economicProgress: Number(timpEconomic.economicProgress || 0),
        ore_pe_zi: Number(timpEconomic.ore_pe_zi || 8)
      } : null
    });

  } catch (error) {
    console.error('Eroare la încărcarea detaliilor proiectului:', error);
    return NextResponse.json(
      { error: 'Eroare la încărcarea detaliilor proiectului' },
      { status: 500 }
    );
  }
}