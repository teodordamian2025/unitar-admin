// =================================================================
// EXTRACTOR REFERINȚE FACTURI DIN DETALII TRANZACȚII
// Generat: 2025-12-17
// Pattern-uri optimizate pentru extrasele bancare românești
// =================================================================

import { FacturaReference } from './types';

/**
 * Pattern-uri pentru extragere referințe facturi din detalii bancare
 * Ordonate după specificitate (cele mai exacte primele)
 */
const FACTURA_PATTERNS: Array<{
  pattern: RegExp;
  extractor: (match: RegExpExecArray) => { serie: string | null; numar: string } | null;
  confidence: 'exact' | 'partial' | 'inferred';
  name: string;
}> = [
  // ==================== PATTERN-URI EXACTE ====================

  // "SERIA UPA NR 1037" sau "SERIA UPA NR. 1037" sau "SERIA UPRO NR 001234"
  {
    pattern: /SERIA\s+(UPA|UPRO)\s+(?:NR\.?\s*)?(\d+)/gi,
    extractor: (m) => ({ serie: m[1].toUpperCase(), numar: m[2] }),
    confidence: 'exact',
    name: 'seria_nr'
  },

  // "Factura nr. UPA-1037" sau "Factura nr UPRO 001234" sau "factura UPA 1037"
  {
    pattern: /FACT(?:URA)?\.?\s*(?:NR\.?\s*)?(UPA|UPRO)[-\s]?(\d+)/gi,
    extractor: (m) => ({ serie: m[1].toUpperCase(), numar: m[2] }),
    confidence: 'exact',
    name: 'factura_serie_nr'
  },

  // "UPA-1037" sau "UPA 1037" sau "UPA1037" sau "UPRO-001234" (serie + număr explicit)
  // Separator opțional pentru a acoperi și cazuri precum "UPA1053" (fără separator)
  {
    pattern: /\b(UPA|UPRO)[-\s]?(\d{2,})\b/gi,
    extractor: (m) => ({ serie: m[1].toUpperCase(), numar: m[2] }),
    confidence: 'exact',
    name: 'serie_numar_direct'
  },

  // "cv ff UPA 1031" sau "c/v ff UPA 1031" (contravaloare factură fiscală)
  {
    pattern: /C\/?V\s*F{1,2}\s*(UPA|UPRO)[-\s]?(\d+)/gi,
    extractor: (m) => ({ serie: m[1].toUpperCase(), numar: m[2] }),
    confidence: 'exact',
    name: 'cv_ff_serie'
  },

  // "cval fact UPA 99" sau "cval factura UPA 1037"
  {
    pattern: /CVAL\s+FACT(?:URA)?\.?\s*(UPA|UPRO)[-\s]?(\d+)/gi,
    extractor: (m) => ({ serie: m[1].toUpperCase(), numar: m[2] }),
    confidence: 'exact',
    name: 'cval_fact_serie'
  },

  // ==================== PATTERN-URI PARȚIALE ====================

  // "fact UPA 99" sau "fact. UPA 1037" (prescurtat)
  {
    pattern: /FACT\.?\s*(UPA|UPRO)[-\s]?(\d+)/gi,
    extractor: (m) => ({ serie: m[1].toUpperCase(), numar: m[2] }),
    confidence: 'partial',
    name: 'fact_serie_short'
  },

  // "Factura nr. 1037" sau "factura nr 001234" (fără serie, presupunem UPA)
  {
    pattern: /FACT(?:URA)?\.?\s*(?:NR\.?\s*)(\d{3,})\b/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'partial',
    name: 'factura_nr_fara_serie'
  },

  // "cv ff 1031" sau "c/v ff 1031" (fără serie)
  {
    pattern: /C\/?V\s*F{1,2}\s+(\d{3,})\b/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'partial',
    name: 'cv_ff_fara_serie'
  },

  // "FF 1051" sau "FF1051" sau "/ROC/FF 1051/22.12.2025" (factură fiscală fără C/V prefix)
  // Acoperă cazuri din extrase bancare unde FF apare singur urmat de număr
  {
    pattern: /\bF{2}\s*(\d{3,})(?:\/|\b)/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'partial',
    name: 'ff_numar_singur'
  },

  // "cval fact 1037" sau "cval factura 1037" (fără serie)
  {
    pattern: /CVAL\s+FACT(?:URA)?\.?\s*(\d{3,})\b/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'partial',
    name: 'cval_fact_fara_serie'
  },

  // "plata fact 1037" sau "plata factura 1037"
  {
    pattern: /PLATA\s+FACT(?:URA)?\.?\s*(UPA|UPRO)?[-\s]?(\d{3,})\b/gi,
    extractor: (m) => ({ serie: m[1]?.toUpperCase() || null, numar: m[2] }),
    confidence: 'partial',
    name: 'plata_fact'
  },

  // "fact 1037" sau "fact. 1037" (foarte scurt, fără serie)
  {
    pattern: /\bFACT\.?\s+(\d{3,})\b/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'partial',
    name: 'fact_nr_short'
  },

  // ==================== PATTERN-URI INFERITE ====================

  // "F-1037" sau "F 1037" sau "F1037" (format scurt)
  {
    pattern: /\bF[-\s]?(\d{4,})\b/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'inferred',
    name: 'f_numar'
  },

  // "nr. 1037" sau "nr 1037" în context de plată
  {
    pattern: /(?:PLATA|INCAS|ACHIT)\D*NR\.?\s*(\d{3,})\b/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'inferred',
    name: 'nr_context_plata'
  },

  // Doar număr mare (>=4 cifre) după cuvinte cheie
  {
    pattern: /(?:FACTURA|FACT|PLATA|C\/V|CV|CVAL|ACHITARE|INCASARE)\D{0,10}(\d{4,})\b/gi,
    extractor: (m) => ({ serie: null, numar: m[1] }),
    confidence: 'inferred',
    name: 'numar_dupa_keyword'
  },
];

/**
 * Normalizează numărul facturii (elimină leading zeros pentru comparație)
 */
export function normalizeNumarFactura(numar: string): string {
  if (!numar) return '';
  // Elimină leading zeros dar păstrează cel puțin un caracter
  return numar.replace(/^0+/, '') || '0';
}

/**
 * Normalizează CUI-ul pentru comparație (elimină prefix RO și spații)
 */
export function normalizeCUI(cui: string | null | undefined): string {
  if (!cui) return '';
  return cui
    .toString()
    .toUpperCase()
    .replace(/^RO/i, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Verifică dacă două CUI-uri sunt echivalente
 */
export function cuiMatch(cui1: string | null | undefined, cui2: string | null | undefined): boolean {
  const norm1 = normalizeCUI(cui1);
  const norm2 = normalizeCUI(cui2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

/**
 * Extrage referințele de factură din textul detaliilor tranzacției
 * Returnează array sortat după confidence (exact > partial > inferred)
 */
export function extractFacturaReferences(detalii: string | null | undefined): FacturaReference[] {
  if (!detalii) return [];

  const text = detalii.toUpperCase();
  const results: FacturaReference[] = [];
  const seen = new Set<string>(); // Pentru deduplicare

  for (const { pattern, extractor, confidence, name } of FACTURA_PATTERNS) {
    // Reset regex lastIndex pentru fiecare pattern
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = extractor(match);
      if (extracted && extracted.numar) {
        // Normalizăm numărul pentru deduplicare
        const normalizedNumar = normalizeNumarFactura(extracted.numar);
        const key = `${extracted.serie || 'NULL'}-${normalizedNumar}`;

        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            serie: extracted.serie,
            numar: extracted.numar,
            confidence,
            source_pattern: name
          });
        }
      }
    }
  }

  // Sortăm după confidence: exact > partial > inferred
  const confidenceOrder = { exact: 0, partial: 1, inferred: 2 };
  results.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

  return results;
}

/**
 * Verifică dacă o referință extrasă corespunde cu o factură
 */
export function referenceMatchesFactura(
  ref: FacturaReference,
  facturaSerie: string | null | undefined,
  facturaNumar: string | null | undefined
): boolean {
  if (!facturaNumar) return false;

  const normalizedRefNumar = normalizeNumarFactura(ref.numar);
  const normalizedFacturaNumar = normalizeNumarFactura(facturaNumar);

  // Dacă avem serie în referință, trebuie să se potrivească
  if (ref.serie) {
    const normalizedRefSerie = ref.serie.toUpperCase();
    const normalizedFacturaSerie = (facturaSerie || '').toUpperCase();

    // Verificăm match exact sau UPA/UPRO equivalence
    const serieMatch = normalizedRefSerie === normalizedFacturaSerie ||
      (normalizedRefSerie === 'UPRO' && normalizedFacturaSerie === 'UPA') ||
      (normalizedRefSerie === 'UPA' && normalizedFacturaSerie === 'UPRO');

    return serieMatch && normalizedRefNumar === normalizedFacturaNumar;
  }

  // Fără serie - doar numărul trebuie să se potrivească
  return normalizedRefNumar === normalizedFacturaNumar;
}

/**
 * Calculează similaritatea Levenshtein între două stringuri
 * Returnează procent 0-100
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      const indicator = s1[j - 1] === s2[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
        matrix[i - 1][j - 1] + indicator
      );
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/**
 * Extrage data din formatul BigQuery DATE
 */
export function extractDate(dateValue: string | { value: string } | null | undefined): string | null {
  if (!dateValue) return null;
  if (typeof dateValue === 'object' && 'value' in dateValue) {
    return dateValue.value;
  }
  return String(dateValue);
}

/**
 * Calculează diferența în zile între două date
 */
export function daysDifference(date1: string | null, date2: string | null): number {
  if (!date1 || !date2) return 999; // Valoare mare pentru diferență necunoscută

  const d1 = new Date(date1);
  const d2 = new Date(date2);

  return Math.abs(Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}
