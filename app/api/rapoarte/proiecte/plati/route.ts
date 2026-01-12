// ==================================================================
// API: Listare Plăți pe Proiect
// GET /api/rapoarte/proiecte/plati?proiectId=xxx
// Returnează tranzacțiile bancare matchate la facturile proiectului
// Data: 13.01.2026
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiectId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!proiectId) {
      return NextResponse.json({
        success: false,
        error: 'proiectId este obligatoriu'
      }, { status: 400 });
    }

    console.log(`💳 [Plăți] Căutare plăți pentru proiect: ${proiectId}`);

    // Query pentru a obține tranzacțiile bancare matchate la facturile proiectului
    // Surse: TranzactiiBancare_v2 matchate + Chitante_v2
    const query = `
      WITH facturi_proiect AS (
        -- Toate facturile pentru acest proiect
        SELECT id, serie, numar, total, client_nume
        FROM \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
        WHERE proiect_id = @proiectId
      ),
      tranzactii_matchate AS (
        -- Tranzacții bancare matchate la facturile proiectului
        SELECT
          tb.id,
          tb.data_procesare as data_tranzactie,
          tb.suma,
          tb.valuta as moneda,
          CONCAT(
            COALESCE(tb.nume_contrapartida, 'Contrapartidă necunoscută'),
            CASE
              WHEN fp.serie IS NOT NULL AND fp.numar IS NOT NULL
              THEN CONCAT(' - Factura ', fp.serie, '-', fp.numar)
              ELSE ''
            END
          ) as descriere,
          tb.matched_factura_id as factura_id,
          'confirmat' as status,
          'tranzactie_bancara' as sursa,
          tb.matching_confidence as confidence,
          tb.matching_tip,
          fp.client_nume
        FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\` tb
        INNER JOIN facturi_proiect fp ON tb.matched_factura_id = fp.id
        WHERE tb.status = 'matched'
          AND tb.directie = 'CREDIT'
      ),
      chitante_proiect AS (
        -- Chitanțe emise pentru facturile proiectului
        SELECT
          c.id,
          c.data_chitanta as data_tranzactie,
          c.valoare_incasata as suma,
          COALESCE(c.moneda, 'RON') as moneda,
          CONCAT(
            'Chitanță ', c.serie, '-', c.numar,
            CASE
              WHEN c.factura_serie IS NOT NULL AND c.factura_numar IS NOT NULL
              THEN CONCAT(' pentru Factura ', c.factura_serie, '-', c.factura_numar)
              ELSE ''
            END
          ) as descriere,
          c.factura_id,
          'confirmat' as status,
          'chitanta' as sursa,
          100 as confidence,
          'chitanta' as matching_tip,
          c.client_nume
        FROM \`${PROJECT_ID}.${DATASET}.Chitante_v2\` c
        WHERE c.proiect_id = @proiectId
          AND c.activ = TRUE
          AND c.anulata = FALSE
      ),
      incasari_etape AS (
        -- Încasări înregistrate direct pe etapele facturilor
        SELECT
          CONCAT('ef_', ef.id) as id,
          ef.data_incasare as data_tranzactie,
          ef.valoare_incasata as suma,
          COALESCE(ef.moneda, 'RON') as moneda,
          CONCAT(
            'Încasare etapă: ', COALESCE(ef.observatii, 'Fără descriere'),
            CASE
              WHEN fg.serie IS NOT NULL AND fg.numar IS NOT NULL
              THEN CONCAT(' - Factura ', fg.serie, '-', fg.numar)
              ELSE ''
            END
          ) as descriere,
          ef.factura_id,
          'confirmat' as status,
          'incasare_etapa' as sursa,
          100 as confidence,
          'manual' as matching_tip,
          fg.client_nume
        FROM \`${PROJECT_ID}.${DATASET}.EtapeFacturi_v2\` ef
        INNER JOIN \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\` fg ON ef.factura_id = fg.id
        WHERE ef.proiect_id = @proiectId
          AND ef.activ = TRUE
          AND ef.status_incasare IN ('Incasat', 'Partial')
          AND ef.valoare_incasata > 0
          AND ef.data_incasare IS NOT NULL
      )
      -- Combinăm toate sursele de plăți
      SELECT * FROM tranzactii_matchate
      UNION ALL
      SELECT * FROM chitante_proiect
      UNION ALL
      SELECT * FROM incasari_etape
      ORDER BY data_tranzactie DESC
      LIMIT @limit
    `;

    const [rows] = await bigquery.query({
      query,
      params: { proiectId, limit },
      types: { proiectId: 'STRING', limit: 'INT64' },
      location: 'EU'
    });

    // Normalizăm datele (BigQuery returnează DATE ca obiecte {value: "..."})
    const platiNormalizate = rows.map((row: any) => ({
      id: row.id,
      data_tranzactie: row.data_tranzactie?.value || row.data_tranzactie,
      suma: parseFloat(row.suma) || 0,
      moneda: row.moneda || 'RON',
      descriere: row.descriere || '',
      factura_id: row.factura_id,
      status: row.status,
      sursa: row.sursa,
      confidence: row.confidence,
      matching_tip: row.matching_tip,
      client_nume: row.client_nume
    }));

    // Calculăm totaluri
    const totalIncasat = platiNormalizate.reduce((sum: number, p: any) => sum + p.suma, 0);

    console.log(`💳 [Plăți] Găsite ${platiNormalizate.length} plăți pentru proiect ${proiectId}, total: ${totalIncasat.toFixed(2)} RON`);

    return NextResponse.json({
      success: true,
      plati: platiNormalizate,
      summary: {
        total_plati: platiNormalizate.length,
        total_incasat: totalIncasat,
        moneda_principala: 'RON'
      }
    });

  } catch (error: any) {
    console.error('❌ Eroare listare plăți proiect:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la listarea plăților'
    }, { status: 500 });
  }
}
