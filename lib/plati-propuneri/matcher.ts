// =================================================================
// MATCHER: Algoritm Scoring pentru Matching Plăți
// Bazat pe algoritmul din lib/incasari-propuneri/matcher.ts
// Data: 2026-01-01
// =================================================================

import type {
  ConfigurarePropuneriPlati,
  TranzactiePlataCandidat,
  TargetPlataUnificat,
  MatchScorePlati,
  ReferintaFacturaPlata,
  DEFAULT_CONFIG
} from './types';

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Extrage data din câmp BigQuery DATE (poate fi string sau {value: string})
 */
export function extractDate(field: any): string | null {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (field.value) return field.value;
  return null;
}

/**
 * Calculează diferența în zile între două date
 */
export function daysDifference(date1: string | null, date2: string | null): number {
  if (!date1 || !date2) return 999;
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

/**
 * Normalizează CUI (elimină RO, spații, etc.)
 */
export function normalizeCUI(cui: string | null | undefined): string {
  if (!cui) return '';
  return cui.toUpperCase().replace(/^RO/i, '').replace(/\s+/g, '').trim();
}

/**
 * Verifică dacă două CUI-uri sunt egale
 */
export function cuiMatch(cui1: string | null | undefined, cui2: string | null | undefined): boolean {
  const normalized1 = normalizeCUI(cui1);
  const normalized2 = normalizeCUI(cui2);
  return normalized1 !== '' && normalized2 !== '' && normalized1 === normalized2;
}

/**
 * Normalizează nume pentru comparație
 * - Lowercase
 * - Elimină forme juridice (SRL, SA, PFA, II, IFN, etc.)
 * - Elimină caractere speciale și diacritice
 * - Elimină orașe comune de la final
 * - Elimină spații multiple
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';

  let normalized = name.toLowerCase();

  // Elimină forme juridice comune românești (inclusiv IFN - Instituție Financiară Nebancară)
  const juridicalForms = [
    // Forme cu puncte
    's\\.r\\.l\\.?', 's\\.a\\.?', 'p\\.f\\.a\\.?', 'i\\.i\\.?', 'i\\.f\\.?',
    's\\.c\\.a\\.?', 'o\\.n\\.g\\.?', 's\\.c\\.s\\.?', 's\\.n\\.c\\.?', 's\\.c\\.?',
    'i\\.f\\.n\\.?',
    // Forme fără puncte
    'srl', 'sa', 'pfa', 'ii', 'if', 'sca', 'ong', 'scs', 'snc', 'sc',
    'ifn',  // Instituție Financiară Nebancară
    'ltd', 'llc', 'gmbh', 'ag', 'plc', 'inc', 'corp',  // Forme internaționale
    'spa', 'sas', 'sarl'  // Forme italiene/franceze
  ];

  for (const form of juridicalForms) {
    // Elimină forma juridică fie la final, fie ca cuvânt separat
    normalized = normalized.replace(new RegExp(`\\b${form}\\b`, 'gi'), '');
  }

  // Normalizare spații ÎNAINTE de a căuta orașe (pentru că formele juridice pot lăsa spații multiple)
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Elimină orașe comune românești de la final
  // Pattern: "FIRMA SRL BUCUREȘTI" → "FIRMA"
  const cities = [
    'bucuresti', 'cluj', 'timisoara', 'iasi', 'constanta', 'craiova', 'brasov',
    'galati', 'ploiesti', 'oradea', 'braila', 'arad', 'pitesti', 'sibiu',
    'bacau', 'targu mures', 'baia mare', 'buzau', 'botosani', 'satu mare',
    'ramnicu valcea', 'suceava', 'piatra neamt', 'drobeta turnu severin',
    'targu jiu', 'targoviste', 'focsani', 'tulcea', 'resita', 'alba iulia',
    // Variante fără diacritice și prescurtate
    'buc', 'bv', 'cj', 'tm', 'is', 'ct', 'dj', 'gl', 'ph', 'bh', 'ar', 'sb'
  ];

  // Elimină orașe de la final
  for (const city of cities) {
    normalized = normalized.replace(new RegExp(`\\s+${city}$`, 'gi'), '');
  }

  // Elimină diacritice românești
  normalized = normalized
    .replace(/ă/g, 'a')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/ș/g, 's')
    .replace(/ş/g, 's')
    .replace(/ț/g, 't')
    .replace(/ţ/g, 't');

  // Elimină caractere speciale, păstrăm doar litere și cifre
  normalized = normalized.replace(/[^a-z0-9]/g, ' ');

  // Elimină spații multiple și trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculează similaritatea între două nume (0-1)
 * Folosește Jaccard similarity pe cuvinte
 */
export function calculateNameSimilarity(name1: string | null | undefined, name2: string | null | undefined): number {
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);

  if (!normalized1 || !normalized2) return 0;

  // Dacă sunt identice după normalizare
  if (normalized1 === normalized2) return 1;

  // Split în cuvinte
  const words1 = new Set(normalized1.split(' ').filter(w => w.length >= 2));
  const words2 = new Set(normalized2.split(' ').filter(w => w.length >= 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  // Jaccard similarity: intersection / union
  const words1Array = Array.from(words1);
  const words2Array = Array.from(words2);

  const intersection = new Set(words1Array.filter(w => words2.has(w)));
  const union = new Set([...words1Array, ...words2Array]);

  const jaccardSimilarity = intersection.size / union.size;

  // Bonus dacă toate cuvintele dintr-un set sunt în celălalt (subset match)
  const subset1In2 = words1Array.every(w => words2.has(w));
  const subset2In1 = words2Array.every(w => words1.has(w));

  if (subset1In2 || subset2In1) {
    return Math.max(jaccardSimilarity, 0.85); // Minim 85% dacă e subset complet
  }

  return jaccardSimilarity;
}

/**
 * Verifică dacă două nume sunt suficient de similare pentru a fi considerate match
 * Threshold implicit: 60% similaritate
 */
export function nameMatch(
  name1: string | null | undefined,
  name2: string | null | undefined,
  threshold: number = 0.60
): boolean {
  return calculateNameSimilarity(name1, name2) >= threshold;
}

/**
 * Normalizează număr factură pentru comparație
 * Ex: "X-123" → "X123", "X/123" → "X123", " X 123 " → "X123"
 * Ex: "811, 26464" → "81126464"
 */
export function normalizeInvoiceNumber(number: string | null | undefined): string {
  if (!number) return '';
  // Eliminăm: liniuțe, slash-uri, spații, virgule, puncte
  return number.toUpperCase().replace(/[-\/\s,\.]/g, '').trim();
}

// =================================================================
// EXTRACTOR REFERINȚE FACTURI DIN DETALII TRANZACȚIE
// =================================================================

/**
 * Pattern-uri pentru extragerea referințelor de facturi din detalii
 * Ordonate după specificitate (cele mai exacte primele)
 */
const REFERINTA_PATTERNS: Array<{
  regex: RegExp;
  confidence: 'exact' | 'partial' | 'inferred';
  extractSerie: boolean;
  // Special flag pentru pattern-uri care capturează numere separate prin virgulă/spațiu
  concatenateGroups?: boolean;
}> = [
  // Pattern-uri EXACTE cu serie
  { regex: /FACTURA\s+(?:SERIA\s+)?([A-Z]{1,4})\s*(?:NR\.?\s*)?(\d+)/gi, confidence: 'exact', extractSerie: true },
  { regex: /FACT\.?\s*(?:NR\.?\s*)?([A-Z]{1,4})[-\s]?(\d+)/gi, confidence: 'exact', extractSerie: true },
  { regex: /([A-Z]{1,4})[-\s]?(\d{2,})\s*(?:DIN|\/)/gi, confidence: 'exact', extractSerie: true },
  { regex: /PLATA\s+(?:FACTURA\s+)?([A-Z]{1,4})[-\s]?(\d+)/gi, confidence: 'exact', extractSerie: true },
  { regex: /C\.?V\.?\s*(?:FACTURA\s+)?([A-Z]{1,4})[-\s]?(\d+)/gi, confidence: 'exact', extractSerie: true },

  // Pattern-uri SPECIALE pentru format "Nr facturii XXX, YYYY" (ex: "811, 26464" → "81126464")
  // Capturează două grupuri de cifre separate prin virgulă/spațiu și le concatenează
  { regex: /NR\.?\s*FACTURI[I]?\s+(\d{2,})[,\s]+(\d{2,})/gi, confidence: 'exact', extractSerie: false, concatenateGroups: true },
  { regex: /FACTURA\s+(\d{2,})[,\s]+(\d{2,})/gi, confidence: 'exact', extractSerie: false, concatenateGroups: true },

  // Pattern-uri PARȚIALE (doar număr, fără serie)
  { regex: /FACTURA\s+(?:NR\.?\s*)?(\d{2,})/gi, confidence: 'partial', extractSerie: false },
  { regex: /FACT\.?\s*(?:NR\.?\s*)?(\d{2,})/gi, confidence: 'partial', extractSerie: false },
  { regex: /PLATA\s+(?:NR\.?\s*)?(\d{3,})/gi, confidence: 'partial', extractSerie: false },
  { regex: /NR\.?\s*FACTURI[I]?\s+(\d{3,})/gi, confidence: 'partial', extractSerie: false },
  { regex: /NR\.?\s*(\d{3,})/gi, confidence: 'partial', extractSerie: false },

  // Pattern-uri INFERRED (mai puțin sigure)
  { regex: /F[-\s]?(\d{4,})/gi, confidence: 'inferred', extractSerie: false },
];

/**
 * Extrage toate referințele de facturi din textul detaliilor tranzacției
 */
export function extractReferinteFacturi(detalii: string | null): ReferintaFacturaPlata[] {
  if (!detalii) return [];

  const referinte: ReferintaFacturaPlata[] = [];
  const seen = new Set<string>();

  for (const pattern of REFERINTA_PATTERNS) {
    let match;
    // Reset regex pentru fiecare iterație
    pattern.regex.lastIndex = 0;

    while ((match = pattern.regex.exec(detalii)) !== null) {
      let serie: string | null = null;
      let numar: string;

      if (pattern.concatenateGroups && match[2]) {
        // Special: concatenăm grupurile de cifre (ex: "811, 26464" → "81126464")
        numar = match[1] + match[2];
      } else if (pattern.extractSerie && match[2]) {
        serie = match[1];
        numar = match[2];
      } else {
        numar = match[1];
      }

      // Normalizăm și deduplicăm
      const key = `${serie || ''}-${numar}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        referinte.push({
          serie,
          numar: numar.replace(/^0+/, ''), // Eliminăm zerouri din față
          confidence: pattern.confidence,
          source_pattern: pattern.regex.source
        });
      }
    }
  }

  // Sortăm: exact > partial > inferred
  const confidenceOrder = { exact: 0, partial: 1, inferred: 2 };
  referinte.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

  return referinte;
}

/**
 * Verifică dacă o referință extrasă match-uiește cu seria-numărul din target
 */
export function referintaMatchesTarget(
  referinta: ReferintaFacturaPlata,
  targetSerieNumar: string | null
): boolean {
  if (!targetSerieNumar) return false;

  const normalizedTarget = normalizeInvoiceNumber(targetSerieNumar);
  const normalizedRef = normalizeInvoiceNumber(
    referinta.serie ? `${referinta.serie}${referinta.numar}` : referinta.numar
  );

  // Match exact
  if (normalizedTarget === normalizedRef) return true;

  // Match doar pe număr (dacă referința nu are serie)
  if (!referinta.serie && normalizedTarget.endsWith(referinta.numar)) return true;

  // Match parțial - numărul apare în target
  if (normalizedTarget.includes(referinta.numar)) return true;

  return false;
}

// =================================================================
// FUNCȚIA PRINCIPALĂ DE SCORING
// =================================================================

/**
 * Calculează scorul de matching între o tranzacție plată și un target (factură/cheltuială)
 */
export function calculateMatchScorePlati(
  tranzactie: TranzactiePlataCandidat,
  target: TargetPlataUnificat,
  config: ConfigurarePropuneriPlati
): MatchScorePlati {
  const matchingReasons: string[] = [];

  // Calculăm name similarity înainte de inițializare
  const nameSimilarity = calculateNameSimilarity(tranzactie.nume_contrapartida, target.furnizor_nume);
  const isNameMatch = nameSimilarity >= 0.60;

  // Inițializare scor
  const score: MatchScorePlati = {
    total: 0,
    cui_score: 0,
    valoare_score: 0,
    referinta_score: 0,
    data_score: 0,
    details: {
      cui_match: false,
      cui_tranzactie: normalizeCUI(tranzactie.cui_contrapartida),
      cui_target: normalizeCUI(target.furnizor_cui),
      name_match: isNameMatch,
      name_similarity: nameSimilarity,
      nume_tranzactie: tranzactie.nume_contrapartida || '',
      nume_target: target.furnizor_nume || '',
      suma_plata: Math.abs(tranzactie.suma),
      suma_target: target.valoare_cu_tva,
      diferenta_ron: 0,
      diferenta_procent: 100,
      referinta_gasita: null,
      referinta_confidence: null,
      data_plata: extractDate(tranzactie.data_procesare) || '',
      data_factura: target.data_factura,
      zile_diferenta: 999,
      matching_algorithm: 'necunoscut',
      matching_reasons: []
    },
    is_candidate: false,
    is_auto_approvable: false
  };

  const sumaPlata = Math.abs(tranzactie.suma);
  const sumaTarget = target.valoare_cu_tva;

  // ==================== 1. SCOR CUI / NUME (35p default) ====================
  // Prioritate: CUI exact > Nume exact > Nume parțial
  //
  // NOTĂ: cui_contrapartida din tranzacție poate fi incorect (extras din nr factură)
  // Deci dacă CUI nu match-uiește dar NUMELE se potrivește, acordăm puncte
  // pentru că target.furnizor_cui (din FacturiPrimiteANAF_v2) este corect

  const cuiMatches = cuiMatch(tranzactie.cui_contrapartida, target.furnizor_cui);

  if (cuiMatches) {
    // CUI exact match - punctaj maxim
    score.cui_score = config.cui_score;
    score.details.cui_match = true;
    matchingReasons.push(`CUI furnizor: ${score.details.cui_target} (+${score.cui_score}p)`);
  } else if (nameSimilarity >= 0.85) {
    // Nume foarte similar (≥85%) - acordăm punctaj CUI maxim
    // Logică: Dacă numele se potrivesc aproape perfect, CUI din target e cel corect
    score.cui_score = config.cui_score;
    score.details.cui_match = false; // CUI-urile nu sunt egale tehnic
    score.details.name_match = true;
    matchingReasons.push(`Nume furnizor: ${(nameSimilarity * 100).toFixed(0)}% similar (+${score.cui_score}p)`);
  } else if (nameSimilarity >= 0.60) {
    // Nume parțial similar (60-84%) - acordăm punctaj parțial
    const partialScore = Math.round(config.cui_score * 0.7); // 70% din punctaj
    score.cui_score = partialScore;
    score.details.cui_match = false;
    score.details.name_match = true;
    matchingReasons.push(`Nume parțial: ${(nameSimilarity * 100).toFixed(0)}% similar (+${partialScore}p)`);
  } else {
    // Nici CUI nici nume nu se potrivesc
    matchingReasons.push(`Fără potrivire CUI/nume`);
  }

  // ==================== 2. SCOR VALOARE (35p default) ====================
  if (sumaTarget > 0) {
    const diferenta = Math.abs(sumaPlata - sumaTarget);
    const diferentaProcent = (diferenta / sumaTarget) * 100;

    score.details.diferenta_ron = diferenta;
    score.details.diferenta_procent = diferentaProcent;

    // Scor bazat pe diferența procentuală
    if (diferentaProcent <= 0.5) {
      score.valoare_score = config.valoare_score; // 100%
      matchingReasons.push(`Sumă perfectă: ±${diferentaProcent.toFixed(2)}% (+${score.valoare_score}p)`);
    } else if (diferentaProcent <= 1) {
      score.valoare_score = Math.round(config.valoare_score * 0.9); // 90%
      matchingReasons.push(`Sumă foarte bună: ±${diferentaProcent.toFixed(2)}% (+${score.valoare_score}p)`);
    } else if (diferentaProcent <= 2) {
      score.valoare_score = Math.round(config.valoare_score * 0.8); // 80%
      matchingReasons.push(`Sumă bună: ±${diferentaProcent.toFixed(2)}% (+${score.valoare_score}p)`);
    } else if (diferentaProcent <= 5) {
      score.valoare_score = Math.round(config.valoare_score * 0.6); // 60%
      matchingReasons.push(`Sumă acceptabilă: ±${diferentaProcent.toFixed(2)}% (+${score.valoare_score}p)`);
    } else if (diferentaProcent <= 10) {
      score.valoare_score = Math.round(config.valoare_score * 0.4); // 40%
      matchingReasons.push(`Sumă marginală: ±${diferentaProcent.toFixed(2)}% (+${score.valoare_score}p)`);
    } else {
      matchingReasons.push(`Diferență mare sumă: ±${diferentaProcent.toFixed(2)}%`);
    }
  }

  // ==================== 3. SCOR REFERINȚĂ (20p default) ====================
  const referinte = extractReferinteFacturi(tranzactie.detalii_tranzactie);

  for (const ref of referinte) {
    if (referintaMatchesTarget(ref, target.serie_numar)) {
      score.referinta_score = config.referinta_score;
      score.details.referinta_gasita = ref.serie ? `${ref.serie}-${ref.numar}` : ref.numar;
      score.details.referinta_confidence = ref.confidence;

      if (ref.confidence === 'exact') {
        matchingReasons.push(`Referință exactă: ${score.details.referinta_gasita} (+${score.referinta_score}p)`);
      } else if (ref.confidence === 'partial') {
        matchingReasons.push(`Referință parțială: ${score.details.referinta_gasita} (+${score.referinta_score}p)`);
      } else {
        matchingReasons.push(`Referință inferată: ${score.details.referinta_gasita} (+${score.referinta_score}p)`);
      }

      break; // Prima referință găsită e suficientă
    }
  }

  // ==================== 4. SCOR DATA (10p default) ====================
  const dataPlata = extractDate(tranzactie.data_procesare);
  const dataFactura = target.data_factura;
  const zileDiferenta = daysDifference(dataPlata, dataFactura);
  score.details.zile_diferenta = zileDiferenta;

  if (zileDiferenta <= 7) {
    score.data_score = config.data_score; // 100%
    matchingReasons.push(`Timing excelent: ${zileDiferenta} zile (+${score.data_score}p)`);
  } else if (zileDiferenta <= 14) {
    score.data_score = Math.round(config.data_score * 0.7); // 70%
    matchingReasons.push(`Timing bun: ${zileDiferenta} zile (+${score.data_score}p)`);
  } else if (zileDiferenta <= 30) {
    score.data_score = Math.round(config.data_score * 0.4); // 40%
    matchingReasons.push(`Timing acceptabil: ${zileDiferenta} zile (+${score.data_score}p)`);
  }

  // ==================== TOTAL ====================
  score.total = Math.min(
    score.cui_score + score.valoare_score + score.referinta_score + score.data_score,
    100
  );

  // ==================== EVALUARE ====================
  score.is_candidate = score.total >= config.min_score;

  // Auto-approvable doar dacă avem CUI SAU referință (nu doar sumă apropiată)
  score.is_auto_approvable =
    score.total >= config.auto_approve_threshold &&
    (score.cui_score > 0 || score.referinta_score > 0);

  // Determinare algoritm de matching
  // Distingem între CUI match și NAME match pentru claritate
  const hasCuiMatch = score.details.cui_match;
  const hasNameMatch = score.details.name_match && !score.details.cui_match;
  const identifierType = hasCuiMatch ? 'cui' : (hasNameMatch ? 'nume' : '');

  if (score.cui_score > 0 && score.referinta_score > 0) {
    score.details.matching_algorithm = `${identifierType}_referinta_valoare`;
  } else if (score.cui_score > 0 && score.valoare_score > 0) {
    score.details.matching_algorithm = `${identifierType}_valoare`;
  } else if (score.referinta_score > 0 && score.valoare_score > 0) {
    score.details.matching_algorithm = 'referinta_valoare';
  } else if (score.valoare_score > 0) {
    score.details.matching_algorithm = 'valoare_apropiata';
  } else {
    score.details.matching_algorithm = 'necunoscut';
  }

  score.details.matching_reasons = matchingReasons;

  return score;
}

// =================================================================
// FUNCȚII HELPER PENTRU GĂSIRE MATCHES
// =================================================================

/**
 * Găsește cel mai bun match pentru o tranzacție din lista de targets
 */
export function findBestMatchPlati(
  tranzactie: TranzactiePlataCandidat,
  targets: TargetPlataUnificat[],
  config: ConfigurarePropuneriPlati
): { target: TargetPlataUnificat; score: MatchScorePlati } | null {
  let bestMatch: { target: TargetPlataUnificat; score: MatchScorePlati } | null = null;
  let bestScore = 0;

  for (const target of targets) {
    const score = calculateMatchScorePlati(tranzactie, target, config);

    if (score.is_candidate && score.total > bestScore) {
      bestMatch = { target, score };
      bestScore = score.total;
    }
  }

  return bestMatch;
}

/**
 * Găsește toate match-urile posibile pentru o tranzacție (sortate după scor)
 */
export function findAllMatchesPlati(
  tranzactie: TranzactiePlataCandidat,
  targets: TargetPlataUnificat[],
  config: ConfigurarePropuneriPlati,
  limit: number = 10
): Array<{ target: TargetPlataUnificat; score: MatchScorePlati }> {
  const matches: Array<{ target: TargetPlataUnificat; score: MatchScorePlati }> = [];

  for (const target of targets) {
    const score = calculateMatchScorePlati(tranzactie, target, config);

    if (score.is_candidate) {
      matches.push({ target, score });
    }
  }

  // Sortăm după scor descrescător
  matches.sort((a, b) => b.score.total - a.score.total);

  return matches.slice(0, limit);
}

/**
 * Determină algoritmul de matching pe baza scorului
 */
export function determineMatchingAlgorithm(score: MatchScorePlati): string {
  return score.details.matching_algorithm;
}

/**
 * Verifică dacă un match poate fi auto-aprobat
 */
export function isAutoApprovable(
  score: MatchScorePlati,
  config: ConfigurarePropuneriPlati
): boolean {
  return score.total >= config.auto_approve_threshold &&
    (score.cui_score > 0 || score.referinta_score > 0);
}

// =================================================================
// FUNCȚII HELPER PENTRU UI
// =================================================================

/**
 * Generează badge pentru scor
 */
export function getScoreBadgePlati(score: number): {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
} {
  if (score >= 95) {
    return { label: 'Excelent', color: '#15803d', bgColor: '#dcfce7', emoji: '🎯' };
  } else if (score >= 85) {
    return { label: 'Foarte bun', color: '#166534', bgColor: '#bbf7d0', emoji: '✅' };
  } else if (score >= 70) {
    return { label: 'Bun', color: '#1d4ed8', bgColor: '#dbeafe', emoji: '👍' };
  } else if (score >= 60) {
    return { label: 'Acceptabil', color: '#ca8a04', bgColor: '#fef9c3', emoji: '⚠️' };
  } else if (score >= 50) {
    return { label: 'Verificare', color: '#ea580c', bgColor: '#fed7aa', emoji: '🔍' };
  } else {
    return { label: 'Slab', color: '#dc2626', bgColor: '#fee2e2', emoji: '❌' };
  }
}

/**
 * Generează descriere text pentru matching
 */
export function generateMatchDescriptionPlati(score: MatchScorePlati): string {
  const parts: string[] = [];

  if (score.cui_score > 0) {
    if (score.details.cui_match) {
      parts.push('CUI ✓');
    } else if (score.details.name_match) {
      parts.push(`Nume ${(score.details.name_similarity * 100).toFixed(0)}% ✓`);
    }
  }

  if (score.referinta_score > 0) {
    parts.push(`Ref: ${score.details.referinta_gasita}`);
  }

  if (score.valoare_score > 0) {
    parts.push(`Sumă: ±${score.details.diferenta_procent.toFixed(1)}%`);
  }

  if (score.data_score > 0) {
    parts.push(`${score.details.zile_diferenta} zile`);
  }

  return parts.join(' | ');
}
