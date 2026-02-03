// ==================================================================
// CALEA: app/api/documents/list-for-project/route.ts
// DATA: 03.02.2026
// DESCRIERE: API pentru listarea documentelor unui proiect (facturi, contracte, PV-uri)
// SCOP: Utilizat în SendEmailClientModal pentru selectarea documentelor de atașat
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_FACTURI = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_CONTRACTE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const TABLE_PV = `\`${PROJECT_ID}.${DATASET}.ProcesVerbale${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper pentru formatare date BigQuery
const formatDate = (dateValue: any): string => {
  if (!dateValue) return '';
  try {
    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : String(dateValue);
    return new Date(dateStr).toLocaleDateString('ro-RO');
  } catch {
    return '';
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id');

    if (!proiectId) {
      return NextResponse.json({
        error: 'proiect_id este obligatoriu'
      }, { status: 400 });
    }

    console.log(`[DOCUMENTS-LIST] Încărcare documente pentru proiect: ${proiectId}`);

    // Query paralel pentru toate tipurile de documente
    const [facturiResult, contracteResult, pvResult] = await Promise.all([
      // FACTURI - doar cele active (nu stornate)
      bigquery.query({
        query: `
          SELECT
            id, serie, numar, data_factura, client_nume, total, status,
            efactura_enabled, is_storno
          FROM ${TABLE_FACTURI}
          WHERE proiect_id = @proiectId
            AND (is_storno IS NULL OR is_storno = FALSE)
            AND (stornata_de_factura_id IS NULL OR stornata_de_factura_id = '')
          ORDER BY data_factura DESC, numar DESC
        `,
        params: { proiectId },
        types: { proiectId: 'STRING' },
        location: 'EU',
      }),

      // CONTRACTE - doar cele valide (nu anulate)
      bigquery.query({
        query: `
          SELECT
            ID_Contract as id, numar_contract, serie_contract,
            Data_Semnare, client_nume, Valoare, Moneda, Status,
            continut_json
          FROM ${TABLE_CONTRACTE}
          WHERE proiect_id = @proiectId
            AND Status != 'Anulat'
          ORDER BY Data_Semnare DESC, numar_contract DESC
        `,
        params: { proiectId },
        types: { proiectId: 'STRING' },
        location: 'EU',
      }),

      // PROCESE VERBALE - doar cele active
      bigquery.query({
        query: `
          SELECT
            ID_PV as id, numar_pv, serie_pv, data_predare,
            client_nume, denumire_pv, valoare_totala, moneda, status_predare
          FROM ${TABLE_PV}
          WHERE proiect_id = @proiectId
            AND activ = TRUE
          ORDER BY data_predare DESC, numar_pv DESC
        `,
        params: { proiectId },
        types: { proiectId: 'STRING' },
        location: 'EU',
      }),
    ]);

    const [facturiRows] = facturiResult;
    const [contracteRows] = contracteResult;
    const [pvRows] = pvResult;

    // Formatare facturi
    const facturi = (facturiRows || []).map((row: any) => ({
      id: row.id,
      type: 'factura' as const,
      numar: row.serie ? `${row.serie}-${row.numar}` : row.numar,
      data: formatDate(row.data_factura),
      client: row.client_nume || 'Client necunoscut',
      valoare: Number(row.total) || 0,
      status: row.status || 'emisa',
      efactura: row.efactura_enabled || false,
      label: `Factură ${row.serie ? `${row.serie}-${row.numar}` : row.numar}`,
      filename: `Factura_${row.serie || 'F'}-${row.numar}.pdf`
    }));

    // Formatare contracte
    const contracte = (contracteRows || []).map((row: any) => ({
      id: row.id,
      type: 'contract' as const,
      numar: row.numar_contract,
      serie: row.serie_contract,
      data: formatDate(row.Data_Semnare),
      client: row.client_nume || 'Client necunoscut',
      valoare: Number(row.Valoare) || 0,
      moneda: row.Moneda || 'RON',
      status: row.Status,
      hasContent: !!row.continut_json, // Verifică dacă poate fi regenerat
      label: `Contract ${row.numar_contract}`,
      filename: `Contract_${row.numar_contract}.docx`
    }));

    // Formatare PV-uri
    const pvuri = (pvRows || []).map((row: any) => ({
      id: row.id,
      type: 'pv' as const,
      numar: row.serie_pv ? `${row.serie_pv}-${row.numar_pv}` : row.numar_pv,
      data: formatDate(row.data_predare),
      client: row.client_nume || 'Client necunoscut',
      denumire: row.denumire_pv,
      valoare: Number(row.valoare_totala) || 0,
      moneda: row.moneda || 'RON',
      status: row.status_predare,
      label: `PV ${row.serie_pv ? `${row.serie_pv}-${row.numar_pv}` : row.numar_pv}`,
      filename: `PV_${row.serie_pv || 'PV'}-${row.numar_pv}.docx`
    }));

    console.log(`[DOCUMENTS-LIST] Găsite: ${facturi.length} facturi, ${contracte.length} contracte, ${pvuri.length} PV-uri`);

    return NextResponse.json({
      success: true,
      data: {
        facturi,
        contracte,
        pvuri
      },
      counts: {
        facturi: facturi.length,
        contracte: contracte.length,
        pvuri: pvuri.length,
        total: facturi.length + contracte.length + pvuri.length
      }
    });

  } catch (error) {
    console.error('[DOCUMENTS-LIST] Eroare:', error);
    return NextResponse.json({
      error: 'Eroare la încărcarea documentelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
