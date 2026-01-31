// =====================================================
// AUTO-MATCH LOGIC: Facturi Primite → Cheltuieli Proiecte & Tranzacții Bancare
// Algoritm scoring pentru asociere automată/semiautomată
// Data: 08.10.2025 (Updated: 2026-01-05)
// =====================================================

import { BigQuery } from '@google-cloud/bigquery';
import type { FacturaPrimita, MatchResult } from './facturi-primite-types';
import {
  normalizeCUI,
  cuiMatch,
  calculateNameSimilarity,
  extractReferinteFacturi,
  referintaMatchesTarget,
  extractDate as extractDatePlati,
  daysDifference
} from './plati-propuneri/matcher';

// Interface pentru match-uri cu tranzacții bancare
export interface TranzactieMatch {
  tranzactie_id: string;
  data_procesare: string;
  suma: number;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  iban_contrapartida?: string;
  score_total: number;
  score_cui: number;
  score_valoare: number;
  score_referinta: number;
  score_data: number;
  cui_match: boolean;
  name_match: boolean;
  name_similarity: number;
  referinta_gasita?: string;
  matching_reasons: string[];
}

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
 *
 * IMPORTANT: Cheltuielile sunt fără TVA, facturile primite sunt cu TVA
 * Comparăm cheltuiala.valoare_ron cu factura.valoare_fara_tva
 * Pentru valută, aplicăm marja 3% din cauza diferențelor de curs valutar
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
  // Folosim cuiMatch care normalizează CUI-urile (elimină prefix RO, spații, etc.)
  const cui_match = cuiMatch(factura.cif_emitent, cheltuiala.furnizor_cui);

  if (cui_match) {
    score_cui = 0.4;
  }

  // === 2. Valoare Match (30% weight) ===
  // IMPORTANT: Comparăm valori fără TVA
  // Cheltuielile sunt fără TVA, facturile pot avea valoare_fara_tva sau valoare_totala (cu TVA)

  // Obține valoarea facturii fără TVA
  let factura_valoare_fara_tva = 0;
  if (factura.valoare_fara_tva && parseFloat(String(factura.valoare_fara_tva)) > 0) {
    // Dacă avem valoare_fara_tva, o folosim direct
    factura_valoare_fara_tva = parseFloat(String(factura.valoare_fara_tva));
  } else if (factura.valoare_totala && factura.valoare_totala > 0) {
    // Fallback: calculăm din valoare_totala folosind cota TVA sau standard 21% (România 2024+)
    const cotaTva = factura.cota_tva || 21;
    factura_valoare_fara_tva = parseFloat(String(factura.valoare_totala)) / (1 + cotaTva / 100);
  }

  // Valoarea cheltuielii (deja fără TVA)
  const cheltuiala_valoare = parseFloat(String(cheltuiala.valoare_ron || cheltuiala.valoare || 0));

  // Determină marja toleranță: 3% pentru valută, 2% pentru RON
  const isValuta = cheltuiala.moneda && cheltuiala.moneda !== 'RON';
  const margeTolerantaBase = isValuta ? 3 : 2;

  if (factura_valoare_fara_tva > 0 && cheltuiala_valoare > 0) {
    const valoare_diff = Math.abs(factura_valoare_fara_tva - cheltuiala_valoare);
    const valoare_diff_percent = (valoare_diff / cheltuiala_valoare) * 100;

    // Praguri ajustate pentru marja de toleranță valută
    if (valoare_diff_percent <= margeTolerantaBase) {
      score_valoare = 0.3; // Perfect match
    } else if (valoare_diff_percent <= margeTolerantaBase + 3) {
      score_valoare = 0.2; // Good match
    } else if (valoare_diff_percent <= margeTolerantaBase + 8) {
      score_valoare = 0.1; // Acceptable match
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

  // Calculează diferența procentuală pentru afișare
  const valoare_diff_final = factura_valoare_fara_tva > 0 && cheltuiala_valoare > 0
    ? Math.abs(factura_valoare_fara_tva - cheltuiala_valoare) / cheltuiala_valoare * 100
    : 999;

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
    valoare_diff_percent: parseFloat(valoare_diff_final.toFixed(2)),
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
      status_achitare: cheltuiala.status_achitare,
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
    // Query cheltuieli neasociate din ultimele 365 zile (extins de la 90)
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
        p.Denumire AS proiect_denumire,
        sp.Denumire AS subproiect_denumire
      FROM \`PanouControlUnitar.ProiecteCheltuieli_v2\` ch
      LEFT JOIN \`PanouControlUnitar.Proiecte_v2\` p ON ch.proiect_id = p.ID_Proiect
      LEFT JOIN \`PanouControlUnitar.Subproiecte_v2\` sp ON ch.subproiect_id = sp.ID_Subproiect
      WHERE ch.activ = TRUE
        AND (ch.status_facturare IS NULL OR ch.status_facturare NOT IN ('Facturat', 'asociat'))
        AND ch.data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
      ORDER BY ch.data_creare DESC
    `;

    const [rows] = await bigquery.query(query);

    console.log(`📊 [findMatches] Factura CUI: ${factura.cif_emitent}, Nume: ${factura.nume_emitent}, Valoare: ${factura.valoare_ron}`);
    console.log(`📊 [findMatches] Cheltuieli găsite în DB: ${rows.length}`);

    // Calculează scor pentru fiecare cheltuială
    const allScores = rows.map(cheltuiala => calculateMatchScore(factura, cheltuiala));

    // Log top 5 scores pentru debugging
    const topScores = [...allScores].sort((a, b) => b.score_total - a.score_total).slice(0, 5);
    console.log(`📊 [findMatches] Top 5 scoruri (înainte de filter):`);
    topScores.forEach((m, i) => {
      console.log(`   ${i + 1}. Score: ${(m.score_total * 100).toFixed(0)}% - ${m.cheltuiala.furnizor_nume || 'N/A'} (CUI: ${m.cheltuiala.furnizor_cui || 'N/A'}) - ${m.cheltuiala.valoare_ron} RON`);
    });

    const matches = allScores
      .filter(match => match.score_total >= minScore)
      .sort((a, b) => b.score_total - a.score_total);

    console.log(`📊 [findMatches] Matches după filter (score >= ${minScore * 100}%): ${matches.length}`);

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

    // Update cheltuială - folosim 'Facturat' pentru consistență cu UI
    await bigquery.query({
      query: `
        UPDATE \`PanouControlUnitar.ProiecteCheltuieli_v2\`
        SET
          status_facturare = 'Facturat',
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

    // Update cheltuială - folosim 'Facturat' pentru consistență cu UI
    await bigquery.query({
      query: `
        UPDATE \`PanouControlUnitar.ProiecteCheltuieli_v2\`
        SET
          status_facturare = 'Facturat',
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

// =====================================================
// CĂUTARE TRANZACȚII BANCARE PENTRU FACTURĂ
// =====================================================

/**
 * Găsește tranzacții bancare care se potrivesc cu factura
 * Folosește algoritmul similar cu propuneri-plati
 */
export async function findTranzactiiMatches(
  factura: FacturaPrimita,
  minScore: number = 0.5
): Promise<TranzactieMatch[]> {
  try {
    // Query tranzacții de tip plată (suma negativă) din ultimele 90 zile
    const query = `
      SELECT
        tb.id,
        tb.data_procesare,
        tb.suma,
        tb.nume_contrapartida,
        tb.cui_contrapartida,
        tb.detalii_tranzactie,
        tb.iban_contrapartida,
        tb.status,
        tb.matching_tip
      FROM \`PanouControlUnitar.TranzactiiBancare_v2\` tb
      WHERE tb.suma < 0
        AND (tb.matching_tip IS NULL OR tb.matching_tip = 'none')
        AND tb.status != 'matched'
        AND tb.data_procesare >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      ORDER BY tb.data_procesare DESC
      LIMIT 500
    `;

    const [rows] = await bigquery.query(query);

    console.log(`📊 [findTranzactiiMatches] Factura: ${factura.serie_numar}, CUI: ${factura.cif_emitent}, Valoare: ${factura.valoare_ron}`);
    console.log(`📊 [findTranzactiiMatches] Tranzacții bancare găsite: ${rows.length}`);

    const facturaValoare = parseFloat(String(factura.valoare_ron || factura.valoare_totala || 0));
    const facturaDataStr = extractDateString(factura.data_factura);

    // Calculează scor pentru fiecare tranzacție
    const matches: TranzactieMatch[] = [];

    for (const trx of rows) {
      const matchingReasons: string[] = [];
      let score_cui = 0;
      let score_valoare = 0;
      let score_referinta = 0;
      let score_data = 0;

      const trxSuma = Math.abs(trx.suma);
      const trxDataStr = extractDatePlati(trx.data_procesare);
      const nameSimilarity = calculateNameSimilarity(trx.nume_contrapartida, factura.nume_emitent);

      // 1. CUI Match (35 puncte)
      const isCuiMatch = cuiMatch(trx.cui_contrapartida, factura.cif_emitent);
      const isNameMatch = nameSimilarity >= 0.60;

      if (isCuiMatch) {
        score_cui = 35;
        matchingReasons.push(`CUI: ${normalizeCUI(factura.cif_emitent)} (+35p)`);
      } else if (nameSimilarity >= 0.85) {
        score_cui = 35;
        matchingReasons.push(`Nume: ${Math.round(nameSimilarity * 100)}% similar (+35p)`);
      } else if (nameSimilarity >= 0.60) {
        score_cui = Math.round(35 * 0.7);
        matchingReasons.push(`Nume parțial: ${Math.round(nameSimilarity * 100)}% (+${score_cui}p)`);
      }

      // 2. Valoare Match (35 puncte)
      if (facturaValoare > 0 && trxSuma > 0) {
        const diferenta = Math.abs(trxSuma - facturaValoare);
        const diferentaProcent = (diferenta / facturaValoare) * 100;

        if (diferentaProcent <= 0.5) {
          score_valoare = 35;
          matchingReasons.push(`Sumă perfectă: ±${diferentaProcent.toFixed(2)}% (+35p)`);
        } else if (diferentaProcent <= 1) {
          score_valoare = Math.round(35 * 0.9);
          matchingReasons.push(`Sumă foarte bună: ±${diferentaProcent.toFixed(2)}% (+${score_valoare}p)`);
        } else if (diferentaProcent <= 2) {
          score_valoare = Math.round(35 * 0.8);
          matchingReasons.push(`Sumă bună: ±${diferentaProcent.toFixed(2)}% (+${score_valoare}p)`);
        } else if (diferentaProcent <= 5) {
          score_valoare = Math.round(35 * 0.6);
          matchingReasons.push(`Sumă acceptabilă: ±${diferentaProcent.toFixed(2)}% (+${score_valoare}p)`);
        } else if (diferentaProcent <= 10) {
          score_valoare = Math.round(35 * 0.4);
          matchingReasons.push(`Sumă marginală: ±${diferentaProcent.toFixed(2)}% (+${score_valoare}p)`);
        }
      }

      // 3. Referință factură în detalii (20 puncte)
      const referinte = extractReferinteFacturi(trx.detalii_tranzactie);
      let referintaGasita: string | undefined;

      for (const ref of referinte) {
        if (referintaMatchesTarget(ref, factura.serie_numar || '')) {
          score_referinta = 20;
          referintaGasita = ref.serie ? `${ref.serie}-${ref.numar}` : ref.numar;
          matchingReasons.push(`Referință: ${referintaGasita} (+20p)`);
          break;
        }
      }

      // 4. Data Match (10 puncte)
      const zileDiferenta = daysDifference(trxDataStr, facturaDataStr || null);

      if (zileDiferenta <= 7) {
        score_data = 10;
        matchingReasons.push(`Timing: ${zileDiferenta} zile (+10p)`);
      } else if (zileDiferenta <= 14) {
        score_data = 7;
        matchingReasons.push(`Timing: ${zileDiferenta} zile (+7p)`);
      } else if (zileDiferenta <= 30) {
        score_data = 4;
        matchingReasons.push(`Timing: ${zileDiferenta} zile (+4p)`);
      }

      // Calculează scor total (max 100)
      const scoreTotal = Math.min(score_cui + score_valoare + score_referinta + score_data, 100);

      // Filtrează după scor minim
      if (scoreTotal >= minScore * 100) {
        matches.push({
          tranzactie_id: trx.id,
          data_procesare: trxDataStr || '',
          suma: trxSuma,
          nume_contrapartida: trx.nume_contrapartida || '',
          cui_contrapartida: trx.cui_contrapartida || '',
          detalii_tranzactie: trx.detalii_tranzactie || '',
          iban_contrapartida: trx.iban_contrapartida,
          score_total: scoreTotal / 100, // Normalizăm la 0-1
          score_cui,
          score_valoare,
          score_referinta,
          score_data,
          cui_match: isCuiMatch,
          name_match: isNameMatch,
          name_similarity: nameSimilarity,
          referinta_gasita: referintaGasita,
          matching_reasons: matchingReasons
        });
      }
    }

    // Sortează după scor descrescător
    matches.sort((a, b) => b.score_total - a.score_total);

    console.log(`📊 [findTranzactiiMatches] Match-uri tranzacții (score >= ${minScore * 100}%): ${matches.length}`);
    if (matches.length > 0) {
      console.log(`   Top match: ${matches[0].nume_contrapartida} - ${(matches[0].score_total * 100).toFixed(0)}% - ${matches[0].suma} RON`);
    }

    return matches;

  } catch (error: any) {
    console.error('❌ Eroare la căutare tranzacții:', error.message);
    throw error;
  }
}
