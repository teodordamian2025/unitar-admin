// =====================================================
// API: Găsește facturi ANAF potrivite pentru o cheltuială
// URL: GET /api/anaf/facturi-primite/match-for-cheltuiala
// Data: 31.01.2026
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const FACTURI_TABLE = `${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2`;

/**
 * GET /api/anaf/facturi-primite/match-for-cheltuiala
 * Query params:
 *   - cheltuiala_id: ID cheltuială (pentru a exclude facturi deja asociate la altă cheltuială)
 *   - cui: CUI furnizor din cheltuială
 *   - valoare: Valoare cheltuială (fără TVA)
 *   - moneda: Moneda cheltuială
 *   - nr_factura: (opțional) Număr factură cunoscut
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cheltuialaId = searchParams.get('cheltuiala_id');
    const cui = searchParams.get('cui');
    const valoare = parseFloat(searchParams.get('valoare') || '0');
    const moneda = searchParams.get('moneda') || 'RON';
    const nrFactura = searchParams.get('nr_factura');

    console.log(`🔍 [Match for Cheltuiala] CUI: ${cui}, Valoare: ${valoare} ${moneda}`);

    // Query facturi neasociate din ultimele 365 zile
    const query = `
      SELECT
        id as factura_id,
        serie_numar,
        data_factura,
        valoare_totala,
        valoare_fara_tva,
        valoare_tva,
        cota_tva,
        moneda,
        nume_emitent,
        cif_emitent,
        status_procesare,
        cheltuiala_asociata_id
      FROM \`${FACTURI_TABLE}\`
      WHERE activ = TRUE
        AND (cheltuiala_asociata_id IS NULL OR cheltuiala_asociata_id = '')
        AND data_preluare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
      ORDER BY data_factura DESC
      LIMIT 100
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    console.log(`📊 [Match] Găsite ${rows.length} facturi neasociate`);

    // Calculează scor pentru fiecare factură
    const matches: any[] = [];

    for (const factura of rows) {
      let score_cui = 0;
      let score_valoare = 0;
      let score_data = 0;
      let score_numar = 0;

      // 1. CUI Match (40%)
      const facturaCUI = (factura.cif_emitent || '').trim();
      const cheltuialaCUI = (cui || '').trim();
      const cui_match = facturaCUI && cheltuialaCUI && facturaCUI === cheltuialaCUI;

      if (cui_match) {
        score_cui = 0.4;
      }

      // 2. Valoare Match (30%)
      // Folosim valoare_fara_tva din factură pentru comparație cu cheltuiala (care e fără TVA)
      let facturaValoareFaraTVA = 0;
      if (factura.valoare_fara_tva) {
        facturaValoareFaraTVA = parseFloat(String(factura.valoare_fara_tva));
      } else if (factura.valoare_totala) {
        // Calculăm din valoare_totala folosind cota TVA sau 19% standard
        const cotaTva = factura.cota_tva || 19;
        facturaValoareFaraTVA = parseFloat(String(factura.valoare_totala)) / (1 + cotaTva / 100);
      }

      // Marja toleranță: 3% pentru valută, 2% pentru RON
      const isValuta = moneda && moneda !== 'RON';
      const margeTolerantaBase = isValuta ? 3 : 2;

      let valoare_diff_percent = 999;
      if (facturaValoareFaraTVA > 0 && valoare > 0) {
        const valoareDiff = Math.abs(facturaValoareFaraTVA - valoare);
        valoare_diff_percent = (valoareDiff / valoare) * 100;

        if (valoare_diff_percent <= margeTolerantaBase) {
          score_valoare = 0.3;
        } else if (valoare_diff_percent <= margeTolerantaBase + 3) {
          score_valoare = 0.2;
        } else if (valoare_diff_percent <= margeTolerantaBase + 8) {
          score_valoare = 0.1;
        }
      }

      // 3. Serie/Număr Match (20% - mai mult dacă avem nr_factura cunoscut)
      if (nrFactura && factura.serie_numar) {
        const normalizedFactura = normalizeInvoiceNumber(factura.serie_numar);
        const normalizedCheltuiala = normalizeInvoiceNumber(nrFactura);
        if (normalizedFactura === normalizedCheltuiala) {
          score_numar = 0.2;
        } else if (normalizedFactura.includes(normalizedCheltuiala) || normalizedCheltuiala.includes(normalizedFactura)) {
          score_numar = 0.1;
        }
      }

      // Calculează scor total
      const score_total = score_cui + score_valoare + score_data + score_numar;

      // Include doar facturile cu scor > 30% sau CUI match
      if (score_total >= 0.3 || cui_match) {
        matches.push({
          factura_id: factura.factura_id,
          serie_numar: factura.serie_numar,
          data_factura: factura.data_factura?.value || factura.data_factura,
          valoare_totala: parseFloat(String(factura.valoare_totala || 0)),
          valoare_fara_tva: facturaValoareFaraTVA,
          moneda: factura.moneda || 'RON',
          nume_emitent: factura.nume_emitent || '',
          cif_emitent: factura.cif_emitent || '',
          score_total,
          score_cui,
          score_valoare,
          score_data,
          score_numar,
          cui_match,
          valoare_diff_percent: parseFloat(valoare_diff_percent.toFixed(2)),
        });
      }
    }

    // Sortează descrescător după scor
    matches.sort((a, b) => b.score_total - a.score_total);

    console.log(`✅ [Match] Returnăm ${matches.length} potriviri (scor >= 30%)`);

    return NextResponse.json({
      success: true,
      matches: matches.slice(0, 20), // Max 20 rezultate
    });

  } catch (error: any) {
    console.error('❌ Eroare la căutare match-uri:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Helper: Normalizează număr factură pentru comparație
function normalizeInvoiceNumber(number: string): string {
  return number.toUpperCase().replace(/[-\/\s]/g, '').trim();
}
