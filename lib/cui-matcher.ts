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
 * Remove: SRL, SA, SNC, PFA, II, IF, spații multiple, caractere speciale
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  return name
    .toUpperCase()
    .replace(/\b(S\.?R\.?L\.?|S\.?A\.?|S\.?N\.?C\.?|P\.?F\.?A\.?|I\.?I\.?|I\.?F\.?)\b/g, '') // Remove entitate juridică
    .replace(/\b(SRL|SA|SNC|PFA|II|IF)\b/g, '') // Remove fără puncte
    .replace(/[^\w\s]/g, ' ') // Remove caractere speciale
    .replace(/\s+/g, ' ') // Remove spații multiple
    .trim();
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
        const cuiValue = client.cui ? client.cui.replace(/^RO/, '') : null;
        const cnpValue = client.cnp || null;

        bestMatch = {
          cui: cuiValue,
          cnp: cnpValue,
          confidence: similarity,
          client_id: client.id,
          client_nume: client.nume,
          tip_client: client.tip_client
        };

        console.log(`✅ [matchCUIFromClienti] Match găsit: "${client.nume}" (${similarity}%) - CUI: ${cuiValue}, CNP: ${cnpValue}`);
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
// EXPORT
// ==================================================================

export default {
  matchCUIFromClienti,
  levenshteinSimilarity,
  normalizeCompanyName
};
