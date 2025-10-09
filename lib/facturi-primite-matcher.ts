// =====================================================
// AUTO-MATCH LOGIC: Facturi Primite → Cheltuieli Proiecte
// Algoritm scoring pentru asociere automată/semiautomată
// Data: 08.10.2025
// =====================================================

import { BigQuery } from '@google-cloud/bigquery';
import type { FacturaPrimita, MatchResult } from './facturi-primite-types';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

/**
 * Calculează match score între factură și cheltuială
 * Returnează scor 0-1 (0% - 100%)
 */
export function calculateMatchScore(
  factura: FacturaPrimita,
  cheltuiala: any
): MatchResult {
  let score_cui = 0;
  let score_valoare = 0;
  let score_data = 0;
  let score_numar = 0;

  // === 1. CUI Match (40% weight) ===
  const cui_match =
    factura.cif_emitent &&
    cheltuiala.furnizor_cui &&
    factura.cif_emitent.trim() === cheltuiala.furnizor_cui.trim();

  if (cui_match) {
    score_cui = 0.4;
  }

  // === 2. Valoare Match (30% weight) ===
  const factura_valoare_ron = factura.valoare_ron || factura.valoare_totala || 0;
  const cheltuiala_valoare_ron = cheltuiala.valoare_ron || 0;

  if (factura_valoare_ron > 0 && cheltuiala_valoare_ron > 0) {
    const valoare_diff = Math.abs(factura_valoare_ron - cheltuiala_valoare_ron);
    const valoare_diff_percent = (valoare_diff / factura_valoare_ron) * 100;

    if (valoare_diff_percent <= 2) {
      score_valoare = 0.3; // Perfect match (±2%)
    } else if (valoare_diff_percent <= 5) {
      score_valoare = 0.2; // Good match (±5%)
    } else if (valoare_diff_percent <= 10) {
      score_valoare = 0.1; // Acceptable match (±10%)
    }
  }

  // === 3. Data Match (20% weight) ===
  const factura_data = extractDate(factura.data_factura);
  const cheltuiala_data = extractDate(cheltuiala.data_factura_furnizor);

  let data_diff_days = 999;

  if (factura_data && cheltuiala_data) {
    const diff_ms = Math.abs(factura_data.getTime() - cheltuiala_data.getTime());
    data_diff_days = Math.floor(diff_ms / (1000 * 60 * 60 * 24));

    if (data_diff_days === 0) {
      score_data = 0.2; // Same day
    } else if (data_diff_days <= 3) {
      score_data = 0.15; // Within 3 days
    } else if (data_diff_days <= 7) {
      score_data = 0.1; // Within 7 days
    } else if (data_diff_days <= 14) {
      score_data = 0.05; // Within 14 days
    }
  }

  // === 4. Serie/Număr Match (10% weight) ===
  const numar_match =
    factura.serie_numar &&
    cheltuiala.nr_factura_furnizor &&
    normalizeInvoiceNumber(factura.serie_numar) ===
      normalizeInvoiceNumber(cheltuiala.nr_factura_furnizor);

  if (numar_match) {
    score_numar = 0.1;
  }

  // === Calculează scor total ===
  const score_total = score_cui + score_valoare + score_data + score_numar;

  return {
    cheltuiala_id: cheltuiala.id,
    proiect_id: cheltuiala.proiect_id,
    proiect_denumire: cheltuiala.proiect_denumire,
    subproiect_id: cheltuiala.subproiect_id,
    subproiect_denumire: cheltuiala.subproiect_denumire,
    score_total: parseFloat(score_total.toFixed(2)),
    score_cui,
    score_valoare,
    score_data,
    score_numar,
    cui_match,
    valoare_diff_percent: parseFloat(
      ((Math.abs(factura_valoare_ron - cheltuiala_valoare_ron) / factura_valoare_ron) * 100).toFixed(2)
    ),
    data_diff_days,
    numar_match,
    cheltuiala: {
      furnizor_nume: cheltuiala.furnizor_nume,
      furnizor_cui: cheltuiala.furnizor_cui,
      valoare: cheltuiala.valoare,
      valoare_ron: cheltuiala.valoare_ron,
      moneda: cheltuiala.moneda,
      data_factura_furnizor: extractDateString(cheltuiala.data_factura_furnizor) || undefined,
      nr_factura_furnizor: cheltuiala.nr_factura_furnizor,
      descriere: cheltuiala.descriere,
    },
  };
}

/**
 * Găsește toate match-urile posibile pentru o factură
 * Returnează array sortat descrescător după scor
 */
export async function findMatches(
  factura: FacturaPrimita,
  minScore: number = 0.5
): Promise<MatchResult[]> {
  try {
    // Query cheltuieli neasociate din ultimele 90 zile
    const query = `
      SELECT
        ch.id,
        ch.proiect_id,
        ch.subproiect_id,
        ch.tip_cheltuiala,
        ch.furnizor_nume,
        ch.furnizor_cui,
        ch.furnizor_contact,
        ch.descriere,
        ch.valoare,
        ch.moneda,
        ch.curs_valutar,
        ch.data_curs_valutar,
        ch.valoare_ron,
        ch.status_predare,
        ch.status_contract,
        ch.status_facturare,
        ch.status_achitare,
        ch.nr_factura_furnizor,
        ch.data_factura_furnizor,
        ch.nr_contract_furnizor,
        ch.data_contract_furnizor,
        ch.data_creare,
        ch.data_actualizare,
        ch.activ,
        ch.observatii,
        p.Denumire_Proiect AS proiect_denumire,
        sp.Denumire AS subproiect_denumire
      FROM \`PanouControlUnitar.ProiecteCheltuieli_v2\` ch
      LEFT JOIN \`PanouControlUnitar.Proiecte_v2\` p ON ch.proiect_id = p.ID_Proiect
      LEFT JOIN \`PanouControlUnitar.Subproiecte_v2\` sp ON ch.subproiect_id = sp.ID_Subproiect
      WHERE ch.activ = TRUE
        AND (ch.status_facturare IS NULL OR ch.status_facturare != 'asociat')
        AND ch.data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
      ORDER BY ch.data_creare DESC
    `;

    const [rows] = await bigquery.query(query);

    // Calculează scor pentru fiecare cheltuială
    const matches = rows
      .map(cheltuiala => calculateMatchScore(factura, cheltuiala))
      .filter(match => match.score_total >= minScore)
      .sort((a, b) => b.score_total - a.score_total);

    return matches;

  } catch (error: any) {
    console.error('❌ Eroare la căutare matches:', error.message);
    throw error;
  }
}

/**
 * Auto-asociază factură cu cheltuiala cu cel mai mare scor (dacă ≥ 80%)
 * Returnează match result sau null dacă nu s-a găsit match suficient de bun
 */
export async function autoAssociate(
  factura: FacturaPrimita
): Promise<MatchResult | null> {
  try {
    const matches = await findMatches(factura, 0.8); // Threshold 80%

    if (matches.length === 0) {
      console.log(`⚠️ Nu s-au găsit match-uri automate pentru factura ${factura.serie_numar}`);
      return null;
    }

    const bestMatch = matches[0];

    console.log(
      `✅ Auto-asociere găsită pentru factura ${factura.serie_numar} cu cheltuiala ${bestMatch.cheltuiala_id} (score: ${(bestMatch.score_total * 100).toFixed(0)}%)`
    );

    // Update factură
    await bigquery.query({
      query: `
        UPDATE \`PanouControlUnitar.FacturiPrimiteANAF_v2\`
        SET
          cheltuiala_asociata_id = @cheltuiala_id,
          asociere_automata = TRUE,
          asociere_confidence = @confidence,
          status_procesare = 'asociat',
          data_asociere = CURRENT_TIMESTAMP()
        WHERE id = @factura_id
      `,
      params: {
        factura_id: factura.id,
        cheltuiala_id: bestMatch.cheltuiala_id,
        confidence: bestMatch.score_total,
      },
    });

    // Update cheltuială
    await bigquery.query({
      query: `
        UPDATE \`PanouControlUnitar.ProiecteCheltuieli_v2\`
        SET
          status_facturare = 'asociat',
          nr_factura_furnizor = @nr_factura,
          data_factura_furnizor = @data_factura,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @cheltuiala_id
      `,
      params: {
        cheltuiala_id: bestMatch.cheltuiala_id,
        nr_factura: factura.serie_numar || null,
        data_factura: extractDateString(factura.data_factura) || null,
      },
    });

    return bestMatch;

  } catch (error: any) {
    console.error('❌ Eroare la auto-asociere:', error.message);
    throw error;
  }
}

/**
 * Asociere manuală (din UI admin)
 */
export async function manualAssociate(
  facturaId: string,
  cheltuialaId: string,
  userId: string,
  observatii?: string
): Promise<void> {
  try {
    // Fetch factură pentru a avea date complete
    const [facturaRows] = await bigquery.query({
      query: `SELECT * FROM \`PanouControlUnitar.FacturiPrimiteANAF_v2\` WHERE id = @id LIMIT 1`,
      params: { id: facturaId },
    });

    if (facturaRows.length === 0) {
      throw new Error(`Factura ${facturaId} nu a fost găsită`);
    }

    const factura = facturaRows[0] as FacturaPrimita;

    // Update factură
    await bigquery.query({
      query: `
        UPDATE \`PanouControlUnitar.FacturiPrimiteANAF_v2\`
        SET
          cheltuiala_asociata_id = @cheltuiala_id,
          asociere_automata = FALSE,
          asociere_confidence = 1.0,
          asociere_manual_user_id = @user_id,
          status_procesare = 'asociat',
          data_asociere = CURRENT_TIMESTAMP(),
          observatii = @observatii
        WHERE id = @factura_id
      `,
      params: {
        factura_id: facturaId,
        cheltuiala_id: cheltuialaId,
        user_id: userId,
        observatii: observatii || null,
      },
    });

    // Update cheltuială
    await bigquery.query({
      query: `
        UPDATE \`PanouControlUnitar.ProiecteCheltuieli_v2\`
        SET
          status_facturare = 'asociat',
          nr_factura_furnizor = @nr_factura,
          data_factura_furnizor = @data_factura,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @cheltuiala_id
      `,
      params: {
        cheltuiala_id: cheltuialaId,
        nr_factura: factura.serie_numar || null,
        data_factura: extractDateString(factura.data_factura) || null,
      },
    });

    console.log(
      `✅ Asociere manuală completă: Factură ${facturaId} → Cheltuială ${cheltuialaId}`
    );

  } catch (error: any) {
    console.error('❌ Eroare la asociere manuală:', error.message);
    throw error;
  }
}

// === HELPERS ===

/**
 * Extract Date object din BigQuery DATE field
 */
function extractDate(field: any): Date | null {
  if (!field) return null;

  let dateString: string;

  if (typeof field === 'string') {
    dateString = field;
  } else if (field.value) {
    dateString = field.value;
  } else {
    return null;
  }

  try {
    return new Date(dateString);
  } catch {
    return null;
  }
}

/**
 * Extract date string in format YYYY-MM-DD
 */
function extractDateString(field: any): string | null | undefined {
  const date = extractDate(field);
  if (!date) return null;

  return date.toISOString().split('T')[0];
}

/**
 * Normalizează număr factură pentru comparație
 * Ex: "X-123" → "X123", "X/123" → "X123", " X 123 " → "X123"
 */
function normalizeInvoiceNumber(number: string): string {
  return number.toUpperCase().replace(/[-\/\s]/g, '').trim();
}
