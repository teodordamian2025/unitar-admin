// =================================================================
// MODUL PARTAJAT: Scoring Unificat pentru Matching Tranzacții-Facturi
// Creat: 2025-12-22
// Bazat pe algoritmul din /lib/incasari-propuneri/matcher.ts
// Folosit de: auto-match, manual-match, propuneri-incasari
// =================================================================

import {
  extractFacturaReferences,
  referenceMatchesFactura,
  normalizeCUI,
  cuiMatch,
  levenshteinSimilarity,
  extractDate,
  daysDifference
} from '@/lib/incasari-propuneri/extractor';

// Re-export funcțiile helper pentru a fi disponibile
export {
  extractFacturaReferences,
  referenceMatchesFactura,
  normalizeCUI,
  cuiMatch,
  levenshteinSimilarity,
  extractDate,
  daysDifference
};

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================

export interface ScoringConfig {
  // Ponderi pentru factori (total = 100)
  referinta_score: number;      // Default: 60
  cui_score: number;            // Default: 25
  suma_score: number;           // Default: 15
  timp_bonus_max: number;       // Default: 5 (bonus, nu afectează total 100)

  // Threshold-uri
  min_score: number;            // Scor minim pentru a fi considerat candidat
  auto_approve_threshold: number; // Scor minim pentru auto-aprobare

  // Toleranțe
  suma_tolerance_strict: number; // Toleranță strictă pentru scor maxim (default: 0.5%)

  // Opțiuni
  enable_adjusted_mode: boolean; // Ajustare automată când CUI lipsește
  enable_logging: boolean;       // Logging detaliat pentru debug
}

export interface UnifiedMatchScore {
  total: number;
  referinta_score: number;
  cui_score: number;
  suma_score: number;
  timp_score: number;

  details: {
    // Referință
    referinta_gasita: string | null;
    referinta_confidence: 'exact' | 'partial' | 'inferred' | null;
    referinta_pattern: string | null;

    // CUI
    cui_match: boolean;
    cui_tranzactie: string;
    cui_factura: string;

    // Sumă
    suma_tranzactie: number;
    suma_target: number;
    suma_diferenta_ron: number;
    suma_diferenta_procent: number;

    // Timp
    zile_diferenta: number;

    // Mod scoring
    scoring_mode: 'standard' | 'adjusted';
    adjusted_reason?: string;
  };

  // Evaluare
  is_candidate: boolean;
  is_auto_approvable: boolean;
  matching_algorithm: string;
  matching_reasons: string[];
}

export interface TranzactieInput {
  id: string;
  suma: number;
  data_procesare: string | { value: string };
  nume_contrapartida: string | null;
  cui_contrapartida: string | null;
  detalii_tranzactie: string | null;
  directie?: string;
}

export interface FacturaInput {
  id: string;
  serie: string | null;
  numar: string;
  total: number;              // Total cu TVA
  valoare_fara_tva?: number;  // Subtotal fără TVA
  rest_de_plata: number;      // Suma rămasă de încasat (cu TVA)
  client_cui: string | null;
  client_nume: string;
  data_factura: string | { value: string };
  status?: string;
}

// =================================================================
// CONFIGURĂRI DEFAULT
// =================================================================

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  // Ponderi (bazate pe Propuneri Automate - cel mai bun algoritm)
  referinta_score: 60,
  cui_score: 25,
  suma_score: 15,
  timp_bonus_max: 5,

  // Threshold-uri
  min_score: 60,
  auto_approve_threshold: 90,

  // Toleranțe
  suma_tolerance_strict: 0.5,

  // Opțiuni
  enable_adjusted_mode: true,
  enable_logging: false
};

// Configurări specifice per context
export const CONFIG_AUTO_MATCH: Partial<ScoringConfig> = {
  min_score: 75,
  auto_approve_threshold: 85,
  enable_logging: true
};

export const CONFIG_MANUAL_MATCH: Partial<ScoringConfig> = {
  min_score: 50,
  auto_approve_threshold: 100, // Nu avem auto-approve pentru manual
  enable_logging: true
};

export const CONFIG_PROPUNERI: Partial<ScoringConfig> = {
  min_score: 60,
  auto_approve_threshold: 90,
  enable_logging: false
};

// =================================================================
// FUNCȚIA PRINCIPALĂ DE SCORING
// =================================================================

/**
 * Calculează scorul unificat de matching între o tranzacție și o factură
 * Algoritm bazat pe Propuneri Automate (cel mai eficient)
 */
export function calculateUnifiedMatchScore(
  tranzactie: TranzactieInput,
  factura: FacturaInput,
  configOverride: Partial<ScoringConfig> = {}
): UnifiedMatchScore {
  const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, ...configOverride };

  const matchingReasons: string[] = [];

  // Inițializare scor
  const score: UnifiedMatchScore = {
    total: 0,
    referinta_score: 0,
    cui_score: 0,
    suma_score: 0,
    timp_score: 0,
    details: {
      referinta_gasita: null,
      referinta_confidence: null,
      referinta_pattern: null,
      cui_match: false,
      cui_tranzactie: normalizeCUI(tranzactie.cui_contrapartida),
      cui_factura: normalizeCUI(factura.client_cui),
      suma_tranzactie: Math.abs(tranzactie.suma),
      suma_target: factura.rest_de_plata,
      suma_diferenta_ron: 0,
      suma_diferenta_procent: 100,
      zile_diferenta: 999,
      scoring_mode: 'standard'
    },
    is_candidate: false,
    is_auto_approvable: false,
    matching_algorithm: 'necunoscut',
    matching_reasons: []
  };

  // Verificăm dacă avem CUI pentru ambele părți
  const hasCUI = Boolean(tranzactie.cui_contrapartida && factura.client_cui);

  // Mode adjusted când CUI lipsește
  let effectiveConfig = { ...config };
  if (!hasCUI && config.enable_adjusted_mode) {
    score.details.scoring_mode = 'adjusted';
    score.details.adjusted_reason = 'CUI indisponibil - ponderi ajustate';
    // În modul adjusted, creștem ponderea sumei și numelui
    // Dar păstrăm prioritatea referinței
  }

  // ==================== 1. SCOR REFERINȚĂ (60p default) ====================
  const referinte = extractFacturaReferences(tranzactie.detalii_tranzactie);

  for (const ref of referinte) {
    if (referenceMatchesFactura(ref, factura.serie, factura.numar)) {
      score.referinta_score = config.referinta_score;
      score.details.referinta_gasita = ref.serie ? `${ref.serie}-${ref.numar}` : ref.numar;
      score.details.referinta_confidence = ref.confidence;
      score.details.referinta_pattern = ref.source_pattern;

      // Bonus pentru match exact cu serie
      if (ref.confidence === 'exact' && ref.serie) {
        score.referinta_score = Math.min(score.referinta_score + 5, 65);
        matchingReasons.push(`📄 Referință exactă: ${score.details.referinta_gasita} (+${score.referinta_score}p)`);
      } else if (ref.confidence === 'exact') {
        matchingReasons.push(`📄 Referință exactă: ${score.details.referinta_gasita} (+${score.referinta_score}p)`);
      } else if (ref.confidence === 'partial') {
        matchingReasons.push(`📄 Referință parțială: ${score.details.referinta_gasita} (+${score.referinta_score}p)`);
      } else {
        matchingReasons.push(`📄 Referință inferată: ${score.details.referinta_gasita} (+${score.referinta_score}p)`);
      }

      break; // Prima referință găsită e suficientă
    }
  }

  // ==================== 2. SCOR CUI (25p default) ====================
  if (cuiMatch(tranzactie.cui_contrapartida, factura.client_cui)) {
    score.cui_score = config.cui_score;
    score.details.cui_match = true;
    matchingReasons.push(`🆔 CUI match: ${score.details.cui_tranzactie} (+${score.cui_score}p)`);
  }

  // ==================== 3. SCOR SUMĂ (15p default) ====================
  const sumaTranzactie = Math.abs(tranzactie.suma);
  const restDePlata = factura.rest_de_plata;

  if (restDePlata > 0) {
    const diferenta = Math.abs(sumaTranzactie - restDePlata);
    const diferentaProcent = (diferenta / restDePlata) * 100;

    score.details.suma_diferenta_ron = diferenta;
    score.details.suma_diferenta_procent = diferentaProcent;

    // Scor bazat pe diferența procentuală (degradare progresivă)
    if (diferentaProcent <= 0.5) {
      score.suma_score = config.suma_score; // 100%
      matchingReasons.push(`💰 Sumă perfectă: ±${diferentaProcent.toFixed(2)}% (+${score.suma_score}p)`);
    } else if (diferentaProcent <= 1) {
      score.suma_score = Math.round(config.suma_score * 0.9); // 90%
      matchingReasons.push(`💰 Sumă foarte bună: ±${diferentaProcent.toFixed(2)}% (+${score.suma_score}p)`);
    } else if (diferentaProcent <= 2) {
      score.suma_score = Math.round(config.suma_score * 0.8); // 80%
      matchingReasons.push(`💰 Sumă bună: ±${diferentaProcent.toFixed(2)}% (+${score.suma_score}p)`);
    } else if (diferentaProcent <= 3) {
      score.suma_score = Math.round(config.suma_score * 0.7); // 70%
      matchingReasons.push(`💰 Sumă acceptabilă: ±${diferentaProcent.toFixed(2)}% (+${score.suma_score}p)`);
    } else if (diferentaProcent <= 5) {
      score.suma_score = Math.round(config.suma_score * 0.5); // 50%
      matchingReasons.push(`⚠️ Sumă marginală: ±${diferentaProcent.toFixed(2)}% (+${score.suma_score}p)`);
    } else if (diferentaProcent <= 10) {
      score.suma_score = Math.round(config.suma_score * 0.3); // 30%
      matchingReasons.push(`⚠️ Sumă diferită: ±${diferentaProcent.toFixed(2)}% (+${score.suma_score}p)`);
    } else {
      matchingReasons.push(`❌ Diferență mare sumă: ±${diferentaProcent.toFixed(2)}%`);
    }
  }

  // ==================== 4. BONUS TIMP (max 5p) ====================
  const dataTranzactie = extractDate(tranzactie.data_procesare);
  const dataFactura = extractDate(factura.data_factura);
  const zileDiferenta = daysDifference(dataTranzactie, dataFactura);
  score.details.zile_diferenta = zileDiferenta;

  if (zileDiferenta <= 7) {
    score.timp_score = config.timp_bonus_max; // 5p
    matchingReasons.push(`⏰ Timing excelent: ${zileDiferenta} zile (+${score.timp_score}p)`);
  } else if (zileDiferenta <= 14) {
    score.timp_score = Math.round(config.timp_bonus_max * 0.6); // 3p
    matchingReasons.push(`⏰ Timing bun: ${zileDiferenta} zile (+${score.timp_score}p)`);
  } else if (zileDiferenta <= 30) {
    score.timp_score = Math.round(config.timp_bonus_max * 0.2); // 1p
    matchingReasons.push(`⏰ Timing acceptabil: ${zileDiferenta} zile (+${score.timp_score}p)`);
  }

  // ==================== TOTAL ====================
  score.total = Math.min(
    score.referinta_score + score.cui_score + score.suma_score + score.timp_score,
    100 // Cap la 100
  );

  // ==================== EVALUARE ====================
  score.is_candidate = score.total >= config.min_score;

  // Auto-approvable doar dacă avem și referință SAU CUI (nu doar sumă)
  score.is_auto_approvable =
    score.total >= config.auto_approve_threshold &&
    (score.referinta_score > 0 || score.cui_score > 0);

  // Determinare algoritm de matching
  if (score.referinta_score > 0 && score.cui_score > 0) {
    score.matching_algorithm = 'referinta_cui_suma';
  } else if (score.referinta_score > 0) {
    score.matching_algorithm = 'referinta_suma';
  } else if (score.cui_score > 0 && score.suma_score > 0) {
    score.matching_algorithm = 'cui_suma';
  } else if (score.suma_score > 0) {
    score.matching_algorithm = 'suma_apropiata';
  } else {
    score.matching_algorithm = 'necunoscut';
  }

  score.matching_reasons = matchingReasons;

  // Logging pentru debug
  if (config.enable_logging) {
    console.log(`📊 [Scoring] Tranzacție ${tranzactie.id?.slice(0, 8)}... → Factură ${factura.serie || ''}${factura.numar}: ${score.total}p (${score.matching_algorithm})`);
    if (score.referinta_score > 0) {
      console.log(`   └─ Referință: ${score.details.referinta_gasita} (${score.details.referinta_confidence})`);
    }
  }

  return score;
}

// =================================================================
// FUNCȚII HELPER PENTRU UI
// =================================================================

/**
 * Generează badge-uri pentru UI bazat pe scor
 */
export function getScoreBadge(score: number): {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
} {
  if (score >= 95) {
    return { label: 'Excelent', color: '#15803d', bgColor: '#dcfce7', emoji: '🎯' };
  } else if (score >= 90) {
    return { label: 'Foarte bun', color: '#166534', bgColor: '#bbf7d0', emoji: '✅' };
  } else if (score >= 80) {
    return { label: 'Bun', color: '#1d4ed8', bgColor: '#dbeafe', emoji: '👍' };
  } else if (score >= 70) {
    return { label: 'Acceptabil', color: '#ca8a04', bgColor: '#fef9c3', emoji: '⚠️' };
  } else if (score >= 60) {
    return { label: 'Verificare', color: '#ea580c', bgColor: '#fed7aa', emoji: '🔍' };
  } else {
    return { label: 'Slab', color: '#dc2626', bgColor: '#fee2e2', emoji: '❌' };
  }
}

/**
 * Generează descriere text pentru matching
 */
export function generateMatchDescription(score: UnifiedMatchScore): string {
  const parts: string[] = [];

  if (score.referinta_score > 0) {
    parts.push(`Referință: ${score.details.referinta_gasita} (${score.details.referinta_confidence})`);
  }

  if (score.cui_score > 0) {
    parts.push('CUI ✓');
  }

  if (score.suma_score > 0) {
    parts.push(`Sumă: ±${score.details.suma_diferenta_procent.toFixed(1)}%`);
  }

  if (score.timp_score > 0) {
    parts.push(`${score.details.zile_diferenta} zile`);
  }

  return parts.join(' | ');
}

/**
 * Verifică dacă un match poate fi auto-aprobat
 */
export function isAutoApprovable(
  score: UnifiedMatchScore,
  config: Partial<ScoringConfig> = {}
): boolean {
  const fullConfig = { ...DEFAULT_SCORING_CONFIG, ...config };
  return score.total >= fullConfig.auto_approve_threshold &&
    (score.referinta_score > 0 || score.cui_score > 0);
}

/**
 * Găsește cel mai bun match pentru o tranzacție din lista de facturi
 */
export function findBestMatch(
  tranzactie: TranzactieInput,
  facturi: FacturaInput[],
  config: Partial<ScoringConfig> = {}
): { factura: FacturaInput; score: UnifiedMatchScore } | null {
  const fullConfig = { ...DEFAULT_SCORING_CONFIG, ...config };

  let bestMatch: { factura: FacturaInput; score: UnifiedMatchScore } | null = null;
  let bestScore = 0;

  for (const factura of facturi) {
    // Skip facturi fără rest de plată
    if (factura.rest_de_plata <= 0) continue;

    const score = calculateUnifiedMatchScore(tranzactie, factura, fullConfig);

    // Verificăm scorul minim
    if (score.total >= fullConfig.min_score && score.total > bestScore) {
      bestMatch = { factura, score };
      bestScore = score.total;
    }
  }

  return bestMatch;
}

/**
 * Găsește toate match-urile posibile pentru o tranzacție (sortate după scor)
 */
export function findAllMatches(
  tranzactie: TranzactieInput,
  facturi: FacturaInput[],
  config: Partial<ScoringConfig> = {},
  limit: number = 10
): Array<{ factura: FacturaInput; score: UnifiedMatchScore }> {
  const fullConfig = { ...DEFAULT_SCORING_CONFIG, ...config };

  const matches: Array<{ factura: FacturaInput; score: UnifiedMatchScore }> = [];

  for (const factura of facturi) {
    if (factura.rest_de_plata <= 0) continue;

    const score = calculateUnifiedMatchScore(tranzactie, factura, fullConfig);

    if (score.is_candidate) {
      matches.push({ factura, score });
    }
  }

  // Sortăm după scor descrescător
  matches.sort((a, b) => b.score.total - a.score.total);

  return matches.slice(0, limit);
}

// =================================================================
// CONVERTOR DE LA FORMATUL VECHI LA NOU
// =================================================================

/**
 * Convertește formatul EtapaFactura din auto-match la FacturaInput
 */
export function convertEtapaToFacturaInput(etapa: any): FacturaInput {
  // Calculăm suma rămasă CU TVA
  const procentDinEtapa = (etapa.procent_din_etapa || 100) / 100;
  const sumaTotalaCuTVA = Number(etapa.factura_total || 0) * procentDinEtapa;
  const restDePlata = sumaTotalaCuTVA - Number(etapa.valoare_incasata || 0);

  return {
    id: etapa.id,
    serie: etapa.factura_serie || null,
    numar: etapa.factura_numar || '',
    total: sumaTotalaCuTVA,
    valoare_fara_tva: Number(etapa.valoare_ron || 0),
    rest_de_plata: restDePlata,
    client_cui: etapa.factura_client_cui || null,
    client_nume: etapa.factura_client_nume || '',
    data_factura: etapa.factura_data,
    status: etapa.status_incasare
  };
}

/**
 * Convertește formatul Cheltuiala la FacturaInput (pentru plăți ieșire)
 */
export function convertCheltuialaToFacturaInput(cheltuiala: any, cotaTva: number = 19): FacturaInput {
  // Cheltuielile sunt fără TVA, trebuie să adăugăm
  const valoareCuTva = Number(cheltuiala.valoare_ron || 0) * (1 + cotaTva / 100);

  return {
    id: cheltuiala.id,
    serie: null,
    numar: cheltuiala.nr_factura_furnizor || cheltuiala.id.slice(0, 8),
    total: valoareCuTva,
    valoare_fara_tva: Number(cheltuiala.valoare_ron || 0),
    rest_de_plata: valoareCuTva, // Presupunem neachitată complet
    client_cui: cheltuiala.furnizor_cui || null,
    client_nume: cheltuiala.furnizor_nume || '',
    data_factura: cheltuiala.data_factura_furnizor || cheltuiala.data_creare,
    status: cheltuiala.status_achitare
  };
}
