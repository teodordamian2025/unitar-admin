// =================================================================
// MATCHER: Algoritm de matching tranzacții cu facturi
// Generat: 2025-12-17
// =================================================================

import {
  FacturaReference,
  MatchScore,
  TranzactieCandidat,
  FacturaCandidat,
  ConfigurarePropuneri
} from './types';

import {
  extractFacturaReferences,
  referenceMatchesFactura,
  normalizeCUI,
  cuiMatch,
  levenshteinSimilarity,
  extractDate,
  daysDifference
} from './extractor';

/**
 * Configurare default pentru scoring
 */
export const DEFAULT_CONFIG: ConfigurarePropuneri = {
  auto_approve_threshold: 90,
  min_score: 60,
  expirare_zile: 30,
  notificare_enabled: true,
  referinta_score: 60,
  cui_score: 25,
  suma_score: 15
};

/**
 * Calculează scorul de matching între o tranzacție și o factură
 */
export function calculateMatchScore(
  tranzactie: TranzactieCandidat,
  factura: FacturaCandidat,
  config: ConfigurarePropuneri = DEFAULT_CONFIG
): MatchScore {
  const score: MatchScore = {
    total: 0,
    referinta_score: 0,
    cui_score: 0,
    suma_score: 0,
    timp_score: 0,
    details: {
      referinta_gasita: null,
      referinta_confidence: null,
      cui_match: false,
      cui_tranzactie: normalizeCUI(tranzactie.cui_contrapartida),
      cui_factura: normalizeCUI(factura.client_cui),
      suma_diferenta_procent: 100,
      zile_diferenta: 999
    }
  };

  // ==================== 1. SCOR REFERINȚĂ (60p default) ====================
  const referinte = extractFacturaReferences(tranzactie.detalii_tranzactie);

  for (const ref of referinte) {
    if (referenceMatchesFactura(ref, factura.serie, factura.numar)) {
      score.referinta_score = config.referinta_score;
      score.details.referinta_gasita = ref.serie ? `${ref.serie}-${ref.numar}` : ref.numar;
      score.details.referinta_confidence = ref.confidence;

      // Bonus pentru match exact vs partial
      if (ref.confidence === 'exact' && ref.serie) {
        score.referinta_score = Math.min(score.referinta_score + 5, 65);
      }
      break; // Prima referință găsită e suficientă
    }
  }

  // ==================== 2. SCOR CUI (25p default) ====================
  if (cuiMatch(tranzactie.cui_contrapartida, factura.client_cui)) {
    score.cui_score = config.cui_score;
    score.details.cui_match = true;
  }

  // ==================== 3. SCOR SUMĂ (15p default) ====================
  const restDePlata = factura.rest_de_plata;
  const sumaTranzactie = Math.abs(tranzactie.suma);

  if (restDePlata > 0) {
    const diferenta = Math.abs(sumaTranzactie - restDePlata);
    const diferentaProcent = (diferenta / restDePlata) * 100;
    score.details.suma_diferenta_procent = diferentaProcent;

    // Scor bazat pe diferența procentuală
    if (diferentaProcent <= 0.5) {
      score.suma_score = config.suma_score; // Full score
    } else if (diferentaProcent <= 1) {
      score.suma_score = Math.round(config.suma_score * 0.9); // 90%
    } else if (diferentaProcent <= 2) {
      score.suma_score = Math.round(config.suma_score * 0.8); // 80%
    } else if (diferentaProcent <= 3) {
      score.suma_score = Math.round(config.suma_score * 0.7); // 70%
    } else if (diferentaProcent <= 5) {
      score.suma_score = Math.round(config.suma_score * 0.5); // 50%
    } else if (diferentaProcent <= 10) {
      score.suma_score = Math.round(config.suma_score * 0.3); // 30%
    }
  }

  // ==================== 4. BONUS TIMP (opțional, max 5p) ====================
  const dataTranzactie = extractDate(tranzactie.data_procesare);
  const dataFactura = extractDate(factura.data_factura);
  const zileDiferenta = daysDifference(dataTranzactie, dataFactura);
  score.details.zile_diferenta = zileDiferenta;

  // Bonus mic pentru timing apropiat (nu afectează threshold-ul)
  if (zileDiferenta <= 7) {
    score.timp_score = 5;
  } else if (zileDiferenta <= 14) {
    score.timp_score = 3;
  } else if (zileDiferenta <= 30) {
    score.timp_score = 1;
  }

  // ==================== TOTAL ====================
  score.total = Math.min(
    score.referinta_score + score.cui_score + score.suma_score + score.timp_score,
    100 // Cap la 100
  );

  return score;
}

/**
 * Găsește cea mai bună potrivire pentru o tranzacție
 */
export function findBestMatch(
  tranzactie: TranzactieCandidat,
  facturi: FacturaCandidat[],
  config: ConfigurarePropuneri = DEFAULT_CONFIG
): { factura: FacturaCandidat; score: MatchScore } | null {
  let bestMatch: { factura: FacturaCandidat; score: MatchScore } | null = null;
  let bestScore = 0;

  for (const factura of facturi) {
    // Skip facturi fără rest de plată
    if (factura.rest_de_plata <= 0) continue;

    const score = calculateMatchScore(tranzactie, factura, config);

    // Verificăm scorul minim
    if (score.total >= config.min_score && score.total > bestScore) {
      bestMatch = { factura, score };
      bestScore = score.total;
    }
  }

  return bestMatch;
}

/**
 * Găsește toate potrivirile posibile pentru o tranzacție (sortate după scor)
 */
export function findAllMatches(
  tranzactie: TranzactieCandidat,
  facturi: FacturaCandidat[],
  config: ConfigurarePropuneri = DEFAULT_CONFIG,
  limit: number = 5
): Array<{ factura: FacturaCandidat; score: MatchScore }> {
  const matches: Array<{ factura: FacturaCandidat; score: MatchScore }> = [];

  for (const factura of facturi) {
    if (factura.rest_de_plata <= 0) continue;

    const score = calculateMatchScore(tranzactie, factura, config);

    if (score.total >= config.min_score) {
      matches.push({ factura, score });
    }
  }

  // Sortăm după scor descrescător
  matches.sort((a, b) => b.score.total - a.score.total);

  return matches.slice(0, limit);
}

/**
 * Determină algoritmul de matching folosit
 */
export function determineMatchingAlgorithm(score: MatchScore): string {
  if (score.referinta_score > 0 && score.cui_score > 0) {
    return 'referinta_cui_suma';
  } else if (score.referinta_score > 0) {
    return 'referinta_suma';
  } else if (score.cui_score > 0 && score.suma_score > 0) {
    return 'cui_suma';
  } else if (score.suma_score > 0) {
    return 'suma_apropiata';
  }
  return 'necunoscut';
}

/**
 * Verifică dacă o propunere poate fi auto-aprobată
 */
export function isAutoApprovable(
  score: MatchScore,
  config: ConfigurarePropuneri = DEFAULT_CONFIG
): boolean {
  // Trebuie să aibă scor >= threshold ȘI referință exactă SAU CUI match
  return score.total >= config.auto_approve_threshold &&
    (score.referinta_score > 0 || score.cui_score > 0);
}

/**
 * Generează descriere pentru matching (pentru UI)
 */
export function generateMatchDescription(score: MatchScore): string {
  const parts: string[] = [];

  if (score.referinta_score > 0) {
    parts.push(`Referință factură: ${score.details.referinta_gasita} (${score.details.referinta_confidence})`);
  }

  if (score.cui_score > 0) {
    parts.push('CUI client ✓');
  }

  if (score.suma_score > 0) {
    parts.push(`Sumă: ±${score.details.suma_diferenta_procent.toFixed(1)}%`);
  }

  if (score.timp_score > 0) {
    parts.push(`Timing: ${score.details.zile_diferenta} zile`);
  }

  return parts.join(' | ');
}

/**
 * Generează badges pentru UI bazat pe scor
 */
export function getScoreBadge(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 95) {
    return { label: 'Excelent', color: '#15803d', bgColor: '#dcfce7' };
  } else if (score >= 90) {
    return { label: 'Foarte bun', color: '#166534', bgColor: '#bbf7d0' };
  } else if (score >= 80) {
    return { label: 'Bun', color: '#1d4ed8', bgColor: '#dbeafe' };
  } else if (score >= 70) {
    return { label: 'Acceptabil', color: '#ca8a04', bgColor: '#fef9c3' };
  } else if (score >= 60) {
    return { label: 'Verificare', color: '#ea580c', bgColor: '#fed7aa' };
  } else {
    return { label: 'Slab', color: '#dc2626', bgColor: '#fee2e2' };
  }
}
