// =====================================================
// API: Asociere Manuală Factură → Cheltuială / Tranzacție
// URL: POST /api/anaf/facturi-primite/associate
// Data: 08.10.2025 (Updated: 2026-01-05)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { manualAssociate, findMatches, findTranzactiiMatches } from '@/lib/facturi-primite-matcher';
import type { AssociateInvoiceRequest } from '@/lib/facturi-primite-types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/anaf/facturi-primite/associate
 * Body: { factura_id, cheltuiala_id?, tranzactie_id?, user_id, observatii?, score? }
 * - Cu cheltuiala_id: asociază cu cheltuială proiect
 * - Cu tranzactie_id: asociază cu tranzacție bancară (plată)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { factura_id, cheltuiala_id, tranzactie_id, user_id, observatii, score } = body;

    if (!factura_id || !user_id) {
      return NextResponse.json(
        { success: false, error: 'factura_id și user_id sunt obligatorii' },
        { status: 400 }
      );
    }

    if (!cheltuiala_id && !tranzactie_id) {
      return NextResponse.json(
        { success: false, error: 'Trebuie specificat cheltuiala_id sau tranzactie_id' },
        { status: 400 }
      );
    }

    const { BigQuery } = require('@google-cloud/bigquery');
    const crypto = require('crypto');

    const bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const DATASET = 'PanouControlUnitar';

    // ASOCIERE CU TRANZACȚIE BANCARĂ
    if (tranzactie_id) {
      console.log(`🔗 Asociere manuală: Factură ${factura_id} → Tranzacție ${tranzactie_id}`);

      // 1. Verifică că factura există
      const [facturaRows] = await bigquery.query({
        query: `SELECT * FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\` WHERE id = @id`,
        params: { id: factura_id }
      });

      if (facturaRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Factura nu a fost găsită' }, { status: 404 });
      }

      const factura = facturaRows[0];

      // 2. Verifică că tranzacția există și nu e deja matched
      const [trxRows] = await bigquery.query({
        query: `SELECT * FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\` WHERE id = @id`,
        params: { id: tranzactie_id }
      });

      if (trxRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Tranzacția nu a fost găsită' }, { status: 404 });
      }

      const tranzactie = trxRows[0];

      if (tranzactie.status === 'matched') {
        return NextResponse.json({ success: false, error: 'Tranzacția este deja asociată' }, { status: 400 });
      }

      // 3. Creează înregistrare în TranzactiiMatching_v2
      const matchingId = crypto.randomUUID();
      const sumaPlata = Math.abs(tranzactie.suma);

      await bigquery.query(`
        INSERT INTO \`${PROJECT_ID}.${DATASET}.TranzactiiMatching_v2\`
        (id, tranzactie_id, target_type, target_id, target_details, confidence_score,
         matching_algorithm, suma_tranzactie, suma_target, suma_target_ron, diferenta_ron,
         diferenta_procent, moneda_target, status, validated_by, data_creare, creat_de)
        VALUES
        ('${matchingId}', '${tranzactie_id}', 'factura_primita', '${factura_id}',
         '${JSON.stringify({ serie_numar: factura.serie_numar, furnizor: factura.nume_emitent }).replace(/'/g, "''")}',
         ${score || 100}, 'manual_associate', ${sumaPlata},
         ${parseFloat(factura.valoare_totala || factura.valoare_ron || 0)},
         ${parseFloat(factura.valoare_ron || factura.valoare_totala || 0)},
         ${Math.abs(sumaPlata - parseFloat(factura.valoare_ron || factura.valoare_totala || 0))},
         ${parseFloat(factura.valoare_ron || factura.valoare_totala || 0) > 0
           ? ((Math.abs(sumaPlata - parseFloat(factura.valoare_ron || factura.valoare_totala || 0)) / parseFloat(factura.valoare_ron || factura.valoare_totala || 0)) * 100).toFixed(2)
           : 0},
         'RON', 'active', '${user_id}', CURRENT_TIMESTAMP(), 'facturi_primite_associate')
      `);

      // 4. Actualizează tranzacția
      await bigquery.query(`
        UPDATE \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
        SET
          matching_tip = 'factura_primita',
          matching_confidence = ${score || 100},
          status = 'matched',
          processed = TRUE,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = '${tranzactie_id}'
      `);

      // 5. Actualizează factura
      await bigquery.query(`
        UPDATE \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
        SET
          status_procesare = 'asociat',
          data_asociere = CURRENT_TIMESTAMP(),
          observatii = CONCAT(COALESCE(observatii, ''), ' | Plată asociată manual: ${sumaPlata} RON de ${user_id}')
        WHERE id = '${factura_id}'
      `);

      console.log(`✅ Asociere tranzacție completă: Factură ${factura_id} ↔ Tranzacție ${tranzactie_id}`);

      return NextResponse.json({
        success: true,
        message: 'Factură asociată cu tranzacția bancară',
        matching_id: matchingId
      });
    }

    // ASOCIERE CU CHELTUIALĂ PROIECT (logica existentă)
    if (cheltuiala_id) {
      console.log(`🔗 Asociere manuală: Factură ${factura_id} → Cheltuială ${cheltuiala_id}`);

      await manualAssociate(factura_id, cheltuiala_id, user_id, observatii);

      return NextResponse.json({
        success: true,
        message: 'Factură asociată cu cheltuiala',
      });
    }

  } catch (error: any) {
    console.error('❌ Eroare la asociere manuală:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/anaf/facturi-primite/associate?factura_id=xxx
 * Returnează sugestii de match-uri pentru o factură (cheltuieli + tranzacții)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const facturaId = searchParams.get('factura_id');

    if (!facturaId) {
      return NextResponse.json(
        { success: false, error: 'Missing factura_id' },
        { status: 400 }
      );
    }

    // Fetch factură din DB
    const { BigQuery } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    const query = `
      SELECT *
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiPrimiteANAF_v2\`
      WHERE id = @id
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, params: { id: facturaId } });

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Factură nu a fost găsită' },
        { status: 404 }
      );
    }

    const factura = rows[0];

    // Găsește match-uri în paralel (threshold 50%)
    const [cheltuieliMatches, tranzactiiMatches] = await Promise.all([
      findMatches(factura, 0.5),
      findTranzactiiMatches(factura, 0.5)
    ]);

    return NextResponse.json({
      success: true,
      matches: cheltuieliMatches, // Pentru compatibilitate cu UI-ul existent
      tranzactii: tranzactiiMatches, // Nou: tranzacții bancare găsite
      summary: {
        cheltuieli_count: cheltuieliMatches.length,
        tranzactii_count: tranzactiiMatches.length,
        total_matches: cheltuieliMatches.length + tranzactiiMatches.length
      }
    });

  } catch (error: any) {
    console.error('❌ Eroare la găsire match-uri:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
