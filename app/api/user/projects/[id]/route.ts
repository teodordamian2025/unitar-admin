// ==================================================================
// CALEA: app/api/user/projects/[id]/route.ts
// DATA: 04.10.2025 23:30 (ora României)
// DESCRIERE: API pentru detalii proiect utilizatori normali - FĂRĂ date financiare
// FUNCȚIONALITATE: Returnează detalii complete proiect cu contracte, facturi - dar exclude valorile financiare
// MODIFICAT: Adăugat progres_procent, ID_Subproiect și fix tabele _v2
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

    // Query pentru facturi - EXCLUDE valorile financiare și plățile
    const facturiQuery = `
      SELECT
        f.ID_Factura,
        f.Numar_Factura,
        f.Data_Emitere,
        f.Status_Plata,
        ec.Denumire_Etapa as Subproiect_Asociat
        -- Exclude: Valoare_Factura, Suma_*, TVA_*, Total_*
      FROM ${FACTURI_TABLE} f
      LEFT JOIN ${ETAPE_CONTRACT_TABLE} ec
        ON f.ID_Etapa = ec.ID_Etapa
      WHERE f.ID_Proiect = @projectId
      ORDER BY f.Data_Emitere DESC
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
      ...factura,
      // Elimină câmpurile financiare
      Valoare_Factura: undefined,
      Suma_fara_TVA: undefined,
      TVA_Valoare: undefined,
      Total_cu_TVA: undefined,
      Moneda: undefined,
      Suma_Incasata: undefined,
      Suma_Restanta: undefined
    }));

    return NextResponse.json({
      success: true,
      proiect: processedProiect,
      subproiecte: processedSubproiecte,
      contracte: processedContracte,
      facturi: processedFacturi
    });

  } catch (error) {
    console.error('Eroare la încărcarea detaliilor proiectului:', error);
    return NextResponse.json(
      { error: 'Eroare la încărcarea detaliilor proiectului' },
      { status: 500 }
    );
  }
}