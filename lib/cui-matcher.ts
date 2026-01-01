// ==================================================================
// CALEA: lib/cui-matcher.ts
// DATA: 09.11.2025 (ora României)
// DESCRIERE: Helper pentru matching CUI din tabelul Clienti_v2
// FUNCȚIONALITATE: Levenshtein similarity + normalizare nume firmă
// ==================================================================

import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Folosim întotdeauna tabele V2
const tableSuffix = '_v2';

// Configurare BigQuery
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ==================================================================
// TYPES
// ==================================================================

export interface CUIMatchResult {
  cui: string | null;
  cnp: string | null;
  confidence: number;
  client_id: string | null;
  client_nume: string | null;
  tip_client: string | null;
}

interface ClientRecord {
  id: string;
  nume: string;
  tip_client: string;
  cui: string | null;
  cnp: string | null;
  activ: boolean;
}

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

/**
 * Validează dacă un CUI românesc are format corect
 * CUI-uri românești pot avea între 2-10 cifre (firme vechi pot avea CUI-uri scurte, ex: 566)
 * Nu validează cifra de control, doar formatul numeric
 *
 * @param cui - CUI de validat (poate avea prefix RO)
 * @returns true dacă formatul e valid
 */
export function isValidRomanianCUI(cui: string | null | undefined): boolean {
  if (!cui) return false;

  // Normalizează: remove prefix RO și spații
  const normalized = cui.toString().toUpperCase().replace(/^RO/, '').replace(/\s+/g, '').trim();

  // CUI românesc: 2-10 cifre (firmele foarte vechi pot avea 2-3 cifre)
  // Nu acceptăm 1 cifră (prea scurt) sau >10 cifre (invalid)
  if (!/^\d{2,10}$/.test(normalized)) {
    return false;
  }

  // Excludem numere care sunt evident altceva (anii, numere de facturi comune)
  // Numere de 4 cifre care încep cu 19 sau 20 sunt probabil ani
  if (normalized.length === 4 && /^(19|20)\d{2}$/.test(normalized)) {
    return false;
  }

  return true;
}

/**
 * Normalizează CUI pentru comparație (elimină prefix RO și spații)
 */
export function normalizeCUI(cui: string | null | undefined): string {
  if (!cui) return '';
  return cui.toString().toUpperCase().replace(/^RO/, '').replace(/\s+/g, '').trim();
}

/**
 * Calculează similaritatea Levenshtein între două string-uri
 * Returnează valoare între 0-100 (100 = match perfect)
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const matrix: number[][] = [];
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2 === 0 ? 100 : 0;
  if (len2 === 0) return 0;

  // Inițializare matrice
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Calculare distanță
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
 * Normalizează numele firmei/persoanei pentru comparație
 * Remove: SRL, SA, SNC, PFA, II, IF, IFN, orașe, spații multiple, caractere speciale
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  let normalized = name.toUpperCase();

  // Remove forme juridice (inclusiv IFN - Instituție Financiară Nebancară)
  normalized = normalized
    .replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?N\.?C\.?|P\.?F\.?A\.?|I\.?I\.?|I\.?F\.?|I\.?F\.?N\.?|S\.?C\.?A\.?|S\.?C\.?S\.?|S\.?C\.?)\b/g, '')
    .replace(/\b(SRL|SA|SNC|PFA|II|IF|IFN|SCA|SCS|SC|LTD|LLC|GMBH|AG|PLC|INC|CORP|SPA|SAS|SARL)\b/g, '');

  // Normalizare spații ÎNAINTE de a căuta orașe
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove orașe comune românești de la final
  const cities = [
    'BUCURESTI', 'CLUJ', 'TIMISOARA', 'IASI', 'CONSTANTA', 'CRAIOVA', 'BRASOV',
    'GALATI', 'PLOIESTI', 'ORADEA', 'BRAILA', 'ARAD', 'PITESTI', 'SIBIU',
    'BACAU', 'TARGU MURES', 'BAIA MARE', 'BUZAU', 'BOTOSANI', 'SATU MARE'
  ];
  for (const city of cities) {
    normalized = normalized.replace(new RegExp(`\\s+${city}$`, 'g'), '');
  }

  // Remove caractere speciale și normalizare spații
  normalized = normalized
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

// ==================================================================
// MAIN FUNCTION: MATCHING CUI FROM CLIENTI_V2
// ==================================================================

/**
 * Găsește CUI pentru un nume de contrapartidă prin matching în Clienti_v2
 *
 * @param numeContrapartida - Numele firmei/persoanei din tranzacție
 * @param minConfidence - Threshold minim pentru similaritate (default 85%)
 * @returns CUIMatchResult cu CUI/CNP găsit și confidence score
 */
export async function matchCUIFromClienti(
  numeContrapartida: string,
  minConfidence: number = 85
): Promise<CUIMatchResult> {

  if (!numeContrapartida || numeContrapartida.trim().length < 3) {
    return {
      cui: null,
      cnp: null,
      confidence: 0,
      client_id: null,
      client_nume: null,
      tip_client: null
    };
  }

  try {
    // Normalizare nume input
    const numeNormalizat = normalizeCompanyName(numeContrapartida);

    console.log(`🔍 [matchCUIFromClienti] Căutare pentru: "${numeContrapartida}" → normalized: "${numeNormalizat}"`);

    // Query Clienti_v2 - iau TOȚI clienții activi (cu deduplicare pentru versioning)
    const query = `
      WITH LatestVersions AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY id ORDER BY data_actualizare DESC, data_creare DESC) as rn
        FROM \`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\`
        WHERE activ = TRUE
      )
      SELECT id, nume, cui, cnp, tip_client, activ
      FROM LatestVersions
      WHERE rn = 1
      ORDER BY data_creare DESC
    `;

    const [clienti] = await bigquery.query({ query, location: 'EU' });

    console.log(`📊 [matchCUIFromClienti] Găsiți ${clienti.length} clienți activi în Clienti_v2`);

    if (clienti.length === 0) {
      console.log(`⚠️ [matchCUIFromClienti] Nu există clienți activi în baza de date`);
      return {
        cui: null,
        cnp: null,
        confidence: 0,
        client_id: null,
        client_nume: null,
        tip_client: null
      };
    }

    // Calcul similaritate pentru fiecare client
    let bestMatch: CUIMatchResult | null = null;
    let bestScore = 0;

    for (const client of clienti as ClientRecord[]) {
      const numeClient = normalizeCompanyName(client.nume);

      const similarity = levenshteinSimilarity(numeNormalizat, numeClient);

      if (similarity > bestScore && similarity >= minConfidence) {
        bestScore = similarity;

        // Prioritate: CUI pentru firme, CNP pentru persoane fizice
        const cuiValue = client.cui ? normalizeCUI(client.cui) : null;
        const cnpValue = client.cnp || null;

        // Validare CUI - acceptăm doar CUI-uri cu format valid
        const cuiValid = isValidRomanianCUI(cuiValue);

        bestMatch = {
          cui: cuiValid ? cuiValue : null,  // Returnăm null dacă CUI-ul e invalid
          cnp: cnpValue,
          confidence: similarity,
          client_id: client.id,
          client_nume: client.nume,
          tip_client: client.tip_client
        };

        if (!cuiValid && cuiValue) {
          console.log(`⚠️ [matchCUIFromClienti] CUI invalid ignorat: "${cuiValue}" pentru "${client.nume}"`);
        }

        console.log(`✅ [matchCUIFromClienti] Match găsit: "${client.nume}" (${similarity}%) - CUI: ${cuiValid ? cuiValue : 'INVALID'}, CNP: ${cnpValue}`);
      }
    }

    if (bestMatch) {
      console.log(`🎯 [matchCUIFromClienti] Best match: "${bestMatch.client_nume}" (${bestMatch.confidence}%)`);
      return bestMatch;
    } else {
      console.log(`❌ [matchCUIFromClienti] Nu s-a găsit match cu confidence >= ${minConfidence}%`);
      return {
        cui: null,
        cnp: null,
        confidence: 0,
        client_id: null,
        client_nume: null,
        tip_client: null
      };
    }

  } catch (error) {
    console.error('❌ [matchCUIFromClienti] Eroare:', error);
    return {
      cui: null,
      cnp: null,
      confidence: 0,
      client_id: null,
      client_nume: null,
      tip_client: null
    };
  }
}

// ==================================================================
// MATCHING CUI FROM FURNIZORI (FacturiPrimiteANAF_v2)
// ==================================================================

export interface FurnizorMatchResult {
  cui: string | null;
  confidence: number;
  furnizor_nume: string | null;
  factura_id: string | null;
}

/**
 * Găsește CUI pentru un furnizor prin matching în FacturiPrimiteANAF_v2
 * Folosit pentru tranzacții de tip PLATĂ (ieșire) unde contrapartida e furnizor
 *
 * @param numeContrapartida - Numele furnizorului din tranzacție
 * @param minConfidence - Threshold minim pentru similaritate (default 85%)
 * @returns FurnizorMatchResult cu CUI găsit și confidence score
 */
export async function matchCUIFromFurnizori(
  numeContrapartida: string,
  minConfidence: number = 85
): Promise<FurnizorMatchResult> {

  if (!numeContrapartida || numeContrapartida.trim().length < 3) {
    return {
      cui: null,
      confidence: 0,
      furnizor_nume: null,
      factura_id: null
    };
  }

  try {
    // Normalizare nume input
    const numeNormalizat = normalizeCompanyName(numeContrapartida);

    console.log(`🔍 [matchCUIFromFurnizori] Căutare pentru: "${numeContrapartida}" → normalized: "${numeNormalizat}"`);

    // Query FacturiPrimiteANAF_v2 - iau toți furnizorii unici cu CUI valid
    // Selectăm distinct pe cif_emitent (fără GROUP BY pentru a evita problema ORDER BY)
    const query = `
      WITH FurnizoriUnici AS (
        SELECT
          cif_emitent,
          nume_emitent,
          id as factura_id,
          ROW_NUMBER() OVER (PARTITION BY cif_emitent ORDER BY data_preluare DESC) as rn
        FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF${tableSuffix}\`
        WHERE activ = TRUE
          AND cif_emitent IS NOT NULL
          AND cif_emitent != ''
          AND nume_emitent IS NOT NULL
      )
      SELECT cif_emitent, nume_emitent, factura_id
      FROM FurnizoriUnici
      WHERE rn = 1
    `;

    const [furnizori] = await bigquery.query({ query, location: 'EU' });

    console.log(`📊 [matchCUIFromFurnizori] Găsiți ${furnizori.length} furnizori unici în FacturiPrimiteANAF_v2`);

    if (furnizori.length === 0) {
      console.log(`⚠️ [matchCUIFromFurnizori] Nu există furnizori în baza de date`);
      return {
        cui: null,
        confidence: 0,
        furnizor_nume: null,
        factura_id: null
      };
    }

    // Calcul similaritate pentru fiecare furnizor
    let bestMatch: FurnizorMatchResult | null = null;
    let bestScore = 0;

    // Cache pentru a evita procesarea aceluiași CIF de mai multe ori
    const processedCifs = new Set<string>();

    for (const furnizor of furnizori as any[]) {
      const cifEmitent = normalizeCUI(furnizor.cif_emitent);

      // Skip dacă am procesat deja acest CIF
      if (processedCifs.has(cifEmitent)) continue;
      processedCifs.add(cifEmitent);

      const numeFurnizor = normalizeCompanyName(furnizor.nume_emitent);
      const similarity = levenshteinSimilarity(numeNormalizat, numeFurnizor);

      if (similarity > bestScore && similarity >= minConfidence) {
        // Validare CUI
        if (!isValidRomanianCUI(cifEmitent)) {
          console.log(`⚠️ [matchCUIFromFurnizori] CUI invalid ignorat: "${cifEmitent}" pentru "${furnizor.nume_emitent}"`);
          continue;
        }

        bestScore = similarity;
        bestMatch = {
          cui: cifEmitent,
          confidence: similarity,
          furnizor_nume: furnizor.nume_emitent,
          factura_id: furnizor.factura_id
        };

        console.log(`✅ [matchCUIFromFurnizori] Match găsit: "${furnizor.nume_emitent}" (${similarity}%) - CUI: ${cifEmitent}`);
      }
    }

    if (bestMatch) {
      console.log(`🎯 [matchCUIFromFurnizori] Best match: "${bestMatch.furnizor_nume}" (${bestMatch.confidence}%) → CUI: ${bestMatch.cui}`);
      return bestMatch;
    } else {
      console.log(`❌ [matchCUIFromFurnizori] Nu s-a găsit match cu confidence >= ${minConfidence}%`);
      return {
        cui: null,
        confidence: 0,
        furnizor_nume: null,
        factura_id: null
      };
    }

  } catch (error) {
    console.error('❌ [matchCUIFromFurnizori] Eroare:', error);
    return {
      cui: null,
      confidence: 0,
      furnizor_nume: null,
      factura_id: null
    };
  }
}

// ==================================================================
// EXPORT
// ==================================================================

export default {
  matchCUIFromClienti,
  matchCUIFromFurnizori,
  levenshteinSimilarity,
  normalizeCompanyName,
  isValidRomanianCUI,
  normalizeCUI
};
