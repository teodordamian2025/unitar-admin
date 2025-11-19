// =================================================================
// API MANUAL MATCHING CU CANDIDATI INTELIGENTI
// Generat: 18 septembrie 2025, 00:15 (Romania)
// Cale: app/api/tranzactii/manual-match/route.ts
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
// DEFAULT: Folosește _v2 (migrare completă), doar dacă explicit setată la 'false' folosește tabelele vechi
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES !== 'false';
const tableSuffix = useV2Tables ? '_v2' : '';

// Configurare BigQuery
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = bigquery.dataset(DATASET);

// ✅ Definire tabele cu suffix dinamic
const TRANZACTII_TABLE = `\`${PROJECT_ID}.${DATASET}.TranzactiiImportate${tableSuffix}\``;
const ETAPE_FACTURI_TABLE = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;  // Corectat typo: EtapeFacuri → EtapeFacturi
const TRANZACTII_BANCARE_TABLE = `\`${PROJECT_ID}.${DATASET}.TranzactiiBancare${tableSuffix}\``;
const TABLE_ETAPE_FACTURI = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_PROIECTE_CHELTUIELI = `\`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli${tableSuffix}\``;
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;
const TABLE_TRANZACTII_MATCHING = `\`${PROJECT_ID}.${DATASET}.TranzactiiMatching${tableSuffix}\``;

console.log(`🔧 [Manual Match] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================

interface TranzactieSource {
  id: string;
  suma: number;
  data_procesare: string | { value: string }; // BigQuery DATE poate returna object sau string
  directie: string;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  tip_categorie: string;
}

interface EtapaFacturaCandidat {
  id: string;
  factura_id: string;
  etapa_id: string;
  proiect_id: string;
  subproiect_id: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  curs_valutar: number;
  data_curs_valutar: string;
  status_incasare: string;
  valoare_incasata: number;
  procent_din_etapa: number;
  data_facturare: string;
  observatii: string;
  // Date factură
  factura_serie: string;
  factura_numar: string;
  factura_data: string;
  factura_client_id: string;
  factura_client_nume: string;
  factura_client_cui: string;
  factura_subtotal: number;
  factura_total_tva: number;
  factura_total: number;
  // Date proiect
  proiect_denumire: string;
  subproiect_denumire: string;
  // Score matching calculat
  matching_score: number;
  matching_reasons: string[];
  suma_ramasa: number;
  diferenta_ron: number;
  diferenta_procent: number;
}

interface CheltuialaCandidat {
  id: string;
  proiect_id: string;
  subproiect_id: string;
  tip_cheltuiala: string;
  furnizor_nume: string;
  furnizor_cui: string;
  furnizor_contact: string;
  descriere: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  status_achitare: string;
  nr_factura_furnizor: string;
  data_factura_furnizor: string;
  // Date proiect
  proiect_denumire: string;
  subproiect_denumire: string;
  // Score matching calculat
  matching_score: number;
  matching_reasons: string[];
  diferenta_ron: number;
  diferenta_procent: number;
}

interface ManualMatchRequest {
  tranzactie_id: string;
  target_type: 'etapa_factura' | 'cheltuiala';
  target_id: string;
  confidence_manual: number;
  notes?: string;
  force_match?: boolean; // Pentru override diferențe mari
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Verifică dacă un obiect este BigNumber din BigQuery (NUMERIC field)
 * Format: {s: 1, e: 2, c: [digits]}
 */
function isBigNumber(obj: any): boolean {
  return obj &&
         typeof obj === 'object' &&
         obj.hasOwnProperty('s') &&
         obj.hasOwnProperty('e') &&
         obj.hasOwnProperty('c') &&
         Array.isArray(obj.c);
}

/**
 * Convertește BigNumber la număr simplu
 */
function bigNumberToNumber(bn: any): number {
  if (!isBigNumber(bn)) return bn;

  // Construim numărul din componente
  const sign = bn.s;
  const exp = bn.e;
  const coeffs = bn.c;

  // Reconstruim numărul
  let numStr = coeffs.join('');

  // Aplicăm exponentul
  if (exp >= 0) {
    // Adăugăm zerouri sau plasăm punctul zecimal
    const totalDigits = numStr.length;
    const decimalPos = exp + 1;

    if (decimalPos >= totalDigits) {
      // Adăugăm zerouri la final
      numStr = numStr + '0'.repeat(decimalPos - totalDigits);
    } else if (decimalPos < totalDigits) {
      // Inserăm punctul zecimal
      numStr = numStr.slice(0, decimalPos) + '.' + numStr.slice(decimalPos);
    }
  } else {
    // Exponent negativ - număr mic
    numStr = '0.' + '0'.repeat(Math.abs(exp) - 1) + numStr;
  }

  const result = parseFloat(numStr) * sign;
  return result;
}

/**
 * Normalizează un obiect BigQuery convertind toate DATE/TIMESTAMP/NUMERIC fields
 * de la obiecte speciale la valori simple
 */
function normalizeBigQueryObject(obj: any): any {
  if (!obj) return obj;

  // Dacă e un array, procesăm fiecare element
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeBigQueryObject(item));
  }

  // ✅ Dacă e un BigNumber (NUMERIC field din BigQuery), convertim la număr
  if (isBigNumber(obj)) {
    return bigNumberToNumber(obj);
  }

  // Dacă e un obiect {value: "..."} (DATE field din BigQuery), returnăm doar valoarea
  if (obj && typeof obj === 'object' && obj.value && Object.keys(obj).length === 1) {
    return obj.value;
  }

  // Dacă e un obiect obișnuit, procesăm recursiv toate proprietățile
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const normalized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        normalized[key] = normalizeBigQueryObject(obj[key]);
      }
    }
    return normalized;
  }

  // Pentru Date objects, convertim la ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Pentru primitive values, returnăm ca atare
  return obj;
}

/**
 * Calculează similaritatea Levenshtein între două string-uri
 */
function levenshteinSimilarity(str1: string, str2: string): number {
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
 * Extrage numere facturi din text
 */
function extractInvoiceNumbers(text: string): string[] {
  if (!text) return [];
  
  const patterns = [
    /(?:FACTURA|FACT\.?|F)\s*(?:NR\.?\s*)?([A-Z]?\s*\d+)/gi,
    /([A-Z]?\d+)\/\d{2}\/\d{2}\/\d{4}/gi
  ];
  
  const numbers: string[] = [];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        const cleanNumber = match[1].replace(/\s+/g, '').toUpperCase();
        if (cleanNumber) numbers.push(cleanNumber);
      }
    }
    // Reset regex pentru următoarea utilizare
    pattern.lastIndex = 0;
  });
  
  return Array.from(new Set(numbers));
}

/**
 * Calculează matching score pentru etape facturi
 */
function calculateEtapaMatchingScore(
  tranzactie: TranzactieSource,
  etapa: any,
  tolerantaProcent: number = 3,
  sumaRamasaCalculata?: number  // ✅ Parametru opțional pentru suma cu TVA
): { score: number; reasons: string[]; diferenta_ron: number; diferenta_procent: number } {
  const reasons: string[] = [];
  let score = 0;

  // Calculăm suma rămasă de încasat
  // Dacă avem suma calculată cu TVA, o folosim; altfel calculăm fără TVA (fallback)
  const sumaRamasa = sumaRamasaCalculata !== undefined
    ? sumaRamasaCalculata
    : (etapa.valoare_ron - (etapa.valoare_incasata || 0));

  const diferentaRon = Math.abs(tranzactie.suma - sumaRamasa);
  const diferentaProcent = sumaRamasa > 0 ? (diferentaRon / sumaRamasa) * 100 : 100;

  // 1. SCOR SUMĂ (50 puncte max)
  if (diferentaProcent <= 0.5) {
    score += 50;
    reasons.push('🎯 Sumă perfectă (±0.5%)');
  } else if (diferentaProcent <= 1) {
    score += 45;
    reasons.push('✅ Sumă foarte bună (±1%)');
  } else if (diferentaProcent <= 2) {
    score += 40;
    reasons.push('✅ Sumă bună (±2%)');
  } else if (diferentaProcent <= tolerantaProcent) {
    score += 30;
    reasons.push(`⚠️ Sumă acceptabilă (±${tolerantaProcent}%)`);
  } else if (diferentaProcent <= 5) {
    score += 15;
    reasons.push('⚠️ Sumă marginală (±5%)');
  } else {
    reasons.push('❌ Diferență mare de sumă');
  }

  // 2. SCOR TIMP (20 puncte max)
  const dataProc = (tranzactie.data_procesare as any)?.value || tranzactie.data_procesare;
  const tranzactieDate = new Date(dataProc);
  // Normalizare DATE field pentru factura_data (poate fi {value: "..."} din BigQuery)
  const facturaData = (etapa.factura_data as any)?.value || etapa.factura_data;
  const facturaDate = new Date(facturaData);
  const daysDiff = Math.abs((tranzactieDate.getTime() - facturaDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 1) {
    score += 20;
    reasons.push('⏰ Timing perfect (1 zi)');
  } else if (daysDiff <= 3) {
    score += 18;
    reasons.push('⏰ Timing foarte bun (3 zile)');
  } else if (daysDiff <= 7) {
    score += 15;
    reasons.push('⏰ Timing bun (1 săptămână)');
  } else if (daysDiff <= 15) {
    score += 12;
    reasons.push('⏰ Timing acceptabil (2 săptămâni)');
  } else if (daysDiff <= 30) {
    score += 8;
    reasons.push('⏰ Timing marginal (1 lună)');
  } else {
    reasons.push('❌ Timing slab (>1 lună)');
  }

  // 3. SCOR CUI (15 puncte max)
  if (tranzactie.cui_contrapartida && etapa.factura_client_cui) {
    if (tranzactie.cui_contrapartida === etapa.factura_client_cui) {
      score += 15;
      reasons.push('🆔 CUI perfect match');
    }
  }

  // 4. SCOR NUME (10 puncte max)
  if (tranzactie.nume_contrapartida && etapa.factura_client_nume) {
    const nameSimilarity = levenshteinSimilarity(
      tranzactie.nume_contrapartida,
      etapa.factura_client_nume
    );
    if (nameSimilarity >= 90) {
      score += 10;
      reasons.push('👤 Nume perfect match');
    } else if (nameSimilarity >= 70) {
      score += 8;
      reasons.push('👤 Nume foarte similar');
    } else if (nameSimilarity >= 50) {
      score += 5;
      reasons.push('👤 Nume similar');
    }
  }

  // 5. SCOR REFERINȚĂ FACTURĂ (5 puncte max)
  const tranzactieRefs = extractInvoiceNumbers(tranzactie.detalii_tranzactie);
  const facturaRef = `${etapa.factura_serie}${etapa.factura_numar}`.replace(/\s+/g, '');
  
  if (tranzactieRefs.some(ref => ref === facturaRef || ref === etapa.factura_numar)) {
    score += 5;
    reasons.push('📄 Referință factură exactă');
  } else if (tranzactieRefs.some(ref => ref.includes(etapa.factura_numar))) {
    score += 3;
    reasons.push('📄 Referință factură parțială');
  }

  return { 
    score: Math.min(score, 100), 
    reasons, 
    diferenta_ron: diferentaRon,
    diferenta_procent: diferentaProcent
  };
}

/**
 * Calculează matching score pentru cheltuieli
 */
function calculateCheltuialaMatchingScore(
  tranzactie: TranzactieSource,
  cheltuiala: any,
  tolerantaProcent: number = 3
): { score: number; reasons: string[]; diferenta_ron: number; diferenta_procent: number } {
  const reasons: string[] = [];
  let score = 0;
  
  const sumaPlata = Math.abs(tranzactie.suma);
  const diferentaRon = Math.abs(sumaPlata - cheltuiala.valoare_ron);
  const diferentaProcent = (diferentaRon / cheltuiala.valoare_ron) * 100;

  // 1. SCOR SUMĂ (60 puncte max)
  if (diferentaProcent <= 0.5) {
    score += 60;
    reasons.push('🎯 Sumă perfectă (±0.5%)');
  } else if (diferentaProcent <= 1) {
    score += 55;
    reasons.push('✅ Sumă foarte bună (±1%)');
  } else if (diferentaProcent <= 2) {
    score += 50;
    reasons.push('✅ Sumă bună (±2%)');
  } else if (diferentaProcent <= tolerantaProcent) {
    score += 40;
    reasons.push(`⚠️ Sumă acceptabilă (±${tolerantaProcent}%)`);
  } else if (diferentaProcent <= 5) {
    score += 25;
    reasons.push('⚠️ Sumă marginală (±5%)');
  } else {
    reasons.push('❌ Diferență mare de sumă');
  }

  // 2. SCOR CUI FURNIZOR (25 puncte max)
  if (tranzactie.cui_contrapartida && cheltuiala.furnizor_cui) {
    if (tranzactie.cui_contrapartida === cheltuiala.furnizor_cui) {
      score += 25;
      reasons.push('🆔 CUI furnizor perfect match');
    }
  }

  // 3. SCOR NUME FURNIZOR (15 puncte max)
  if (tranzactie.nume_contrapartida && cheltuiala.furnizor_nume) {
    const similarity = levenshteinSimilarity(
      tranzactie.nume_contrapartida,
      cheltuiala.furnizor_nume
    );
    if (similarity >= 80) {
      score += 15;
      reasons.push('👤 Nume furnizor perfect match');
    } else if (similarity >= 60) {
      score += 10;
      reasons.push('👤 Nume furnizor similar');
    } else if (similarity >= 40) {
      score += 5;
      reasons.push('👤 Nume furnizor parțial similar');
    }
  }

  return { 
    score: Math.min(score, 100), 
    reasons, 
    diferenta_ron: diferentaRon,
    diferenta_procent: diferentaProcent
  };
}

// =================================================================
// CĂUTARE CANDIDAȚI PENTRU MATCHING MANUAL
// =================================================================

/**
 * Găsește candidații EtapeFacturi pentru o tranzacție specifică
 */
async function findEtapeFacturiCandidatesForTransaction(
  tranzactie: TranzactieSource,
  tolerantaProcent: number = 10 // Mai permisiv pentru manual
): Promise<EtapaFacturaCandidat[]> {
  try {
    // Normalizare date field (BigQuery returnează {value: "2025-08-16"})
    const dataProc = (tranzactie.data_procesare as any)?.value || tranzactie.data_procesare || new Date().toISOString().split('T')[0];

    // Pentru încasări, căutăm etape cu status neincasat/partial
    const query = `
      SELECT
        ef.id,
        ef.factura_id,
        ef.etapa_id,
        ef.proiect_id,
        ef.subproiect_id,
        ef.valoare,
        ef.moneda,
        ef.valoare_ron,
        ef.curs_valutar,
        ef.data_curs_valutar,
        ef.status_incasare,
        ef.valoare_incasata,
        ef.procent_din_etapa,
        ef.data_facturare,
        ef.observatii,

        -- Date factură
        fg.serie as factura_serie,
        fg.numar as factura_numar,
        fg.data_factura as factura_data,
        fg.client_id as factura_client_id,
        fg.client_nume as factura_client_nume,
        fg.client_cui as factura_client_cui,
        fg.subtotal as factura_subtotal,
        fg.total_tva as factura_total_tva,
        fg.total as factura_total,

        -- Date proiect
        p.Denumire as proiect_denumire,
        COALESCE(sp.Denumire, '') as subproiect_denumire

      FROM ${TABLE_ETAPE_FACTURI} ef
      INNER JOIN ${TABLE_FACTURI_GENERATE} fg
        ON ef.factura_id = fg.id
      INNER JOIN ${TABLE_PROIECTE} p
        ON ef.proiect_id = p.ID_Proiect
      LEFT JOIN ${TABLE_SUBPROIECTE} sp
        ON ef.subproiect_id = sp.ID_Subproiect
      WHERE
        ef.activ = TRUE
        AND fg.status != 'anulata'
        AND ef.status_incasare IN ('Neincasat', 'Partial')
        AND ef.valoare_ron > 0
        AND (ef.valoare_ron - COALESCE(ef.valoare_incasata, 0)) > 0
        AND fg.data_factura >= DATE_SUB(DATE('${dataProc}'), INTERVAL 6 MONTH)
        AND fg.data_factura <= DATE_ADD(DATE('${dataProc}'), INTERVAL 3 MONTH)
      ORDER BY
        ABS(ef.valoare_ron - ${tranzactie.suma}) ASC,
        fg.data_factura DESC
      LIMIT 50
    `;

    const [results] = await bigquery.query(query);

    // Calculăm scoring pentru fiecare candidat
    const candidatesWithScore: EtapaFacturaCandidat[] = results.map((row: any) => {
      // ✅ FIX TVA: Calculăm suma rămasă CU TVA (încasările sunt cu TVA inclusă!)
      // Folosim proporția din total factură (cu TVA) în loc de valoare_ron (fără TVA)
      const procentDinEtapa = (row.procent_din_etapa || 100) / 100;
      const sumaDeIncasatCuTVA = Number(row.factura_total || 0) * procentDinEtapa;
      const sumaRamasa = sumaDeIncasatCuTVA - Number(row.valoare_incasata || 0);

      const { score, reasons, diferenta_ron, diferenta_procent } = calculateEtapaMatchingScore(
        tranzactie,
        row,
        tolerantaProcent,
        sumaRamasa  // Pasăm suma calculată cu TVA
      );

      return {
        ...row,
        suma_ramasa: sumaRamasa,
        matching_score: score,
        matching_reasons: reasons,
        diferenta_ron,
        diferenta_procent
      };
    });

    // Sortăm după score descrescător
    return candidatesWithScore.sort((a, b) => b.matching_score - a.matching_score);

  } catch (error) {
    console.error('❌ Eroare căutare candidați EtapeFacturi:', error);
    return [];
  }
}

/**
 * Găsește candidații ProiecteCheltuieli pentru o tranzacție specifică
 */
async function findCheltuieliCandidatesForTransaction(
  tranzactie: TranzactieSource,
  tolerantaProcent: number = 10
): Promise<CheltuialaCandidat[]> {
  try {
    const sumaPlata = Math.abs(tranzactie.suma);

    // Normalizare date field (BigQuery returnează {value: "2025-08-16"})
    const dataProc = (tranzactie.data_procesare as any)?.value || tranzactie.data_procesare || new Date().toISOString().split('T')[0];

    const query = `
      SELECT
        pc.id,
        pc.proiect_id,
        pc.subproiect_id,
        pc.tip_cheltuiala,
        pc.furnizor_nume,
        pc.furnizor_cui,
        pc.furnizor_contact,
        pc.descriere,
        pc.valoare,
        pc.moneda,
        pc.valoare_ron,
        pc.status_achitare,
        pc.nr_factura_furnizor,
        pc.data_factura_furnizor,

        -- Date proiect
        p.Denumire as proiect_denumire,
        COALESCE(sp.Denumire, '') as subproiect_denumire

      FROM ${TABLE_PROIECTE_CHELTUIELI} pc
      INNER JOIN ${TABLE_PROIECTE} p
        ON pc.proiect_id = p.ID_Proiect
      LEFT JOIN ${TABLE_SUBPROIECTE} sp
        ON pc.subproiect_id = sp.ID_Subproiect
      WHERE
        pc.activ = TRUE
        AND pc.status_achitare IN ('Neincasat', 'Partial')
        AND pc.valoare_ron > 0
        AND pc.data_creare >= DATE_SUB(DATE('${dataProc}'), INTERVAL 6 MONTH)
        AND pc.data_creare <= DATE_ADD(DATE('${dataProc}'), INTERVAL 1 MONTH)
      ORDER BY
        ABS(pc.valoare_ron - ${sumaPlata}) ASC,
        pc.data_creare DESC
      LIMIT 50
    `;

    const [results] = await bigquery.query(query);
    
    // Calculăm scoring pentru fiecare candidat
    const candidatesWithScore: CheltuialaCandidat[] = results.map((row: any) => {
      const { score, reasons, diferenta_ron, diferenta_procent } = calculateCheltuialaMatchingScore(
        tranzactie, 
        row, 
        tolerantaProcent
      );

      return {
        ...row,
        matching_score: score,
        matching_reasons: reasons,
        diferenta_ron,
        diferenta_procent
      };
    });

    // Sortăm după score descrescător
    return candidatesWithScore.sort((a, b) => b.matching_score - a.matching_score);

  } catch (error) {
    console.error('❌ Eroare căutare candidați Cheltuieli:', error);
    return [];
  }
}

// =================================================================
// APLICARE MATCHING MANUAL
// =================================================================

/**
 * Curăță un obiect pentru insert BigQuery - înlocuiește undefined cu null
 */
function cleanForBigQuery(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForBigQuery(item));
  }
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = cleanForBigQuery(obj[key]);
        // Doar adăugăm key-ul dacă valoarea nu e null (BigQuery acceptă null explicit sau omitere)
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Aplică un matching manual selectat de utilizator
 */
async function applyManualMatch(matchRequest: ManualMatchRequest): Promise<void> {
  try {
    // Obținem detaliile tranzacției
    const [tranzactiiRows] = await bigquery.query(`
      SELECT * FROM ${TRANZACTII_BANCARE_TABLE}
      WHERE id = "${matchRequest.tranzactie_id}"
    `);

    if (tranzactiiRows.length === 0) {
      throw new Error('Tranzacția nu a fost găsită');
    }

    const tranzactie = tranzactiiRows[0];

    // Obținem detaliile target-ului
    let targetDetails: any = {};
    let sumaTarget = 0;
    let sumaTargetRon = 0;
    let monedaTarget = 'RON';
    let cursValutar: number | null = null;
    let dataCursValutar: string | null = null;

    if (matchRequest.target_type === 'etapa_factura') {
      const [etapeRows] = await bigquery.query(`
        SELECT
          ef.*,
          fg.serie as factura_serie,
          fg.numar as factura_numar,
          fg.client_nume as factura_client_nume,
          fg.client_cui as factura_client_cui,
          fg.total as factura_total
        FROM ${TABLE_ETAPE_FACTURI} ef
        INNER JOIN ${TABLE_FACTURI_GENERATE} fg
          ON ef.factura_id = fg.id
        WHERE ef.id = "${matchRequest.target_id}"
      `);

      if (etapeRows.length === 0) {
        throw new Error('Etapa factură nu a fost găsită');
      }

      const etapa = etapeRows[0];
      targetDetails = etapa;
      sumaTarget = etapa.valoare;

      // ✅ FIX TVA: Calculăm suma rămasă CU TVA (încasările sunt cu TVA inclusă!)
      // Folosim proporția din total factură (cu TVA) în loc de valoare_ron (fără TVA)
      const procentDinEtapa = (etapa.procent_din_etapa || 100) / 100;
      const sumaDeIncasatCuTVA = Number(etapa.factura_total || 0) * procentDinEtapa;
      sumaTargetRon = sumaDeIncasatCuTVA - Number(etapa.valoare_incasata || 0);

      monedaTarget = etapa.moneda || 'RON';
      cursValutar = etapa.curs_valutar ? Number(etapa.curs_valutar) : null;
      // Normalizare DATE field pentru BigQuery
      const dataCursRaw = etapa.data_curs_valutar;
      dataCursValutar = dataCursRaw
        ? (typeof dataCursRaw === 'object' && dataCursRaw?.value ? dataCursRaw.value : dataCursRaw)
        : null;

    } else if (matchRequest.target_type === 'cheltuiala') {
      const [cheltuieliRows] = await bigquery.query(`
        SELECT * FROM ${TABLE_PROIECTE_CHELTUIELI}
        WHERE id = "${matchRequest.target_id}"
      `);

      if (cheltuieliRows.length === 0) {
        throw new Error('Cheltuiala nu a fost găsită');
      }

      const cheltuiala = cheltuieliRows[0];
      targetDetails = cheltuiala;
      sumaTarget = cheltuiala.valoare;
      sumaTargetRon = cheltuiala.valoare_ron;
      monedaTarget = cheltuiala.moneda;
    }

    // Calculăm diferențele
    const diferentaRon = Math.abs(tranzactie.suma - sumaTargetRon);
    const diferentaProcent = sumaTargetRon > 0 ? (diferentaRon / sumaTargetRon) * 100 : 0;

    // Verificăm dacă matching-ul este forțat pentru diferențe mari
    if (diferentaProcent > 10 && !matchRequest.force_match) {
      throw new Error(`Diferența de sumă este prea mare (${diferentaProcent.toFixed(1)}%). Folosește force_match pentru a forța matching-ul.`);
    }

    // Inserăm matching-ul în TranzactiiMatching
    // ✅ Pregătim obiectele JSON separate (vor fi stringify-ate)
    const normalizedTargetDetails = normalizeBigQueryObject(targetDetails);
    const matchingDetailsObject = {
      notes: matchRequest.notes || null,
      force_match: matchRequest.force_match || false,
      manual_confidence: Number(matchRequest.confidence_manual),
      created_by: 'manual_user'
    };

    // ✅ Pregătim recordul cu toate valorile curate (fără undefined)
    const rawMatchingRecord = {
      id: crypto.randomUUID(),
      tranzactie_id: matchRequest.tranzactie_id,
      target_type: matchRequest.target_type,
      target_id: matchRequest.target_id,
      target_details: JSON.stringify(normalizedTargetDetails), // ✅ CRITICAL: JSON fields trebuie stringify
      confidence_score: Number(matchRequest.confidence_manual),
      matching_algorithm: 'manual',
      suma_tranzactie: Number(Math.abs(tranzactie.suma)),
      suma_target: Number(sumaTarget),
      suma_target_ron: Number(sumaTargetRon),
      diferenta_ron: Number(diferentaRon),
      diferenta_procent: Number(diferentaProcent),
      moneda_target: monedaTarget,
      curs_valutar_folosit: cursValutar, // poate fi null
      data_curs_valutar: dataCursValutar, // poate fi null (deja normalizat mai sus)
      matching_details: JSON.stringify(matchingDetailsObject), // ✅ CRITICAL: JSON fields trebuie stringify
      status: 'active',
      data_creare: new Date().toISOString(),
      creat_de: 'manual_matching'
    };

    // ✅ CRITICAL FIX: Curăță toate valorile undefined pentru BigQuery
    const matchingRecord = cleanForBigQuery(rawMatchingRecord);

    console.log('🔍 [DEBUG] Matching record pregătit pentru insert:', JSON.stringify(matchingRecord, null, 2));

    // Inserăm în BigQuery
    const matchingTable = dataset.table(`TranzactiiMatching${tableSuffix}`);

    try {
      await matchingTable.insert([matchingRecord]);
    } catch (insertError: any) {
      // Log detaliat pentru debugging BigQuery errors
      console.error('❌ [DEBUG] BigQuery insert error details:', {
        errorName: insertError.name,
        errorMessage: insertError.message,
        errors: insertError.errors,
        response: insertError.response
      });

      // Log fiecare error individual pentru a vedea ce câmp exact e problematic
      if (insertError.errors && Array.isArray(insertError.errors)) {
        insertError.errors.forEach((err: any, idx: number) => {
          console.error(`❌ [DEBUG] Error ${idx + 1}:`, JSON.stringify(err, null, 2));
        });
      }

      throw insertError; // Re-aruncăm eroarea pentru a o prinde în catch-ul exterior
    }

    // Actualizăm tranzacția
    await bigquery.query(`
      UPDATE ${TRANZACTII_BANCARE_TABLE}
      SET
        matching_tip = 'manual',
        matching_confidence = ${matchRequest.confidence_manual},
        status = 'matched',
        processed = TRUE,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = "${matchRequest.tranzactie_id}"
    `);

    // Actualizăm target-ul (EtapeFacturi sau ProiecteCheltuieli)
    if (matchRequest.target_type === 'etapa_factura') {
      const sumaIncasata = Math.abs(tranzactie.suma);
      // ✅ FIX TVA: Calculăm suma totală cu TVA pentru a determina statusul corect
      const procentDinEtapaActualizare = (targetDetails.procent_din_etapa || 100) / 100;
      const sumaTotalaCuTVA = sumaTargetRon + Number(targetDetails.valoare_incasata || 0); // Recalculăm din totalul deja calculat
      const newValoareIncasata = Number(targetDetails.valoare_incasata || 0) + sumaIncasata;

      // Determinăm statusul bazat pe comparația cu suma CU TVA
      let newStatus = 'Neincasat';
      if (newValoareIncasata >= sumaTotalaCuTVA * 0.99) { // toleranță 1% pentru rotunjiri
        newStatus = 'Incasat';
      } else if (newValoareIncasata > 0) {
        newStatus = 'Partial';
      }

      await bigquery.query(`
        UPDATE ${TABLE_ETAPE_FACTURI}
        SET
          valoare_incasata = ${newValoareIncasata},
          status_incasare = '${newStatus}',
          data_incasare = ${newStatus === 'Incasat' ? 'CURRENT_DATE()' : 'data_incasare'},
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = "${matchRequest.target_id}"
      `);

      // Actualizăm și EtapeContract prin etapa_id
      if (targetDetails.etapa_id) {
        await bigquery.query(`
          UPDATE ${TABLE_ETAPE_CONTRACT}
          SET
            status_incasare = ${newStatus},
            data_incasare = CASE WHEN ${newStatus} = 'Incasat' THEN CURRENT_DATE() ELSE data_incasare END,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Etapa = "${targetDetails.etapa_id}"
        `);
      }

      // 🔔 NOTIFICARE ADMIN: Incasare nouă înregistrată (MANUAL MATCH)
      try {
        const dataProc = tranzactie.data_procesare?.value || tranzactie.data_procesare || new Date().toISOString().split('T')[0];

        // Obținem detalii proiect pentru notificare
        const [proiectRows] = await bigquery.query(`
          SELECT Denumire FROM ${TABLE_PROIECTE}
          WHERE ID_Proiect = "${targetDetails.proiect_id}"
        `);
        const proiectDenumire = proiectRows[0]?.Denumire || 'N/A';

        // Trimitem notificare prin API
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tip_notificare: 'factura_achitata',
            user_id: ['admin'], // Va fi expandat cu toți admins de către API
            context: {
              // Date tranzacție
              suma_tranzactie: Math.abs(sumaIncasata).toFixed(2),
              data_tranzactie: dataProc,

              // Match details
              has_match: true,
              matching_confidence: matchRequest.confidence_manual.toFixed(0),

              // Date factură
              factura_id: targetDetails.factura_id,
              factura_serie: targetDetails.factura_serie || '',
              factura_numar: targetDetails.factura_numar || '',
              factura_total: sumaTargetRon.toFixed(2),

              // Date client
              client_nume: targetDetails.factura_client_nume || '',
              client_cui: targetDetails.factura_client_cui || '',

              // Date proiect
              proiect_id: targetDetails.proiect_id,
              proiect_denumire: proiectDenumire,

              // Diferențe
              diferenta_ron: diferentaRon ? diferentaRon.toFixed(2) : null,
              diferenta_procent: diferentaProcent ? diferentaProcent.toFixed(1) : null,

              // Link
              link_detalii: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin/tranzactii/dashboard`
            }
          })
        });

        console.log(`📧 Notificare admin trimisă pentru incasare manuală ${sumaIncasata} RON`);
      } catch (notifError) {
        console.error('⚠️ Eroare trimitere notificare (nu blochează matching-ul):', notifError);
        // Nu aruncăm eroarea - notificarea nu trebuie să blocheze matching-ul
      }

    } else if (matchRequest.target_type === 'cheltuiala') {
      await bigquery.query(`
        UPDATE ${TABLE_PROIECTE_CHELTUIELI}
        SET
          status_achitare = 'Incasat',
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = "${matchRequest.target_id}"
      `);
    }

    console.log(`✅ Manual matching aplicat: ${matchRequest.tranzactie_id} → ${matchRequest.target_type}:${matchRequest.target_id}`);

  } catch (error) {
    console.error('❌ Eroare aplicare manual matching:', error);
    throw error;
  }
}

// =================================================================
// ENDPOINTS
// =================================================================

/**
 * GET - Returnează tranzacții neimperecheate SAU candidați pentru matching manual
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const action = searchParams.get('action');
    const tranzactieId = searchParams.get('tranzactie_id');
    const targetType = searchParams.get('target_type') || 'all'; // 'etape_facturi', 'cheltuieli', 'all'
    const tolerance = parseFloat(searchParams.get('tolerance') || '10');

    // Caz 1: Returnează lista de tranzacții neimperecheate
    if (status === 'neimperecheate') {
      const limit = parseInt(searchParams.get('limit') || '500'); // Crescut de la 100 la 500
      const offset = parseInt(searchParams.get('offset') || '0');

      const query = `
        SELECT
          id, data_procesare, suma, directie, tip_categorie,
          nume_contrapartida, cui_contrapartida, detalii_tranzactie, status
        FROM ${TRANZACTII_BANCARE_TABLE}
        WHERE (matching_tip IS NULL OR matching_tip = 'none')
          AND (status IS NULL OR status != 'matched')
        ORDER BY data_procesare DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const [results] = await bigquery.query(query);

      return NextResponse.json({
        success: true,
        data: results.map((row: any) => ({
          ...row,
          data_procesare: row.data_procesare?.value || row.data_procesare
        })),
        pagination: {
          limit,
          offset,
          count: results.length
        }
      });
    }

    // Caz 2: Returnează candidați pentru o tranzacție specifică
    if (!tranzactieId) {
      return NextResponse.json({
        success: false,
        error: 'tranzactie_id este obligatoriu pentru căutare candidați'
      }, { status: 400 });
    }

    // Obținem detaliile tranzacției
    const [tranzactiiRows] = await bigquery.query(`
      SELECT
        id, suma, data_procesare, directie, nume_contrapartida,
        cui_contrapartida, detalii_tranzactie, tip_categorie
      FROM ${TRANZACTII_BANCARE_TABLE}
      WHERE id = "${tranzactieId}"
    `);

    if (tranzactiiRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tranzacția nu a fost găsită'
      }, { status: 404 });
    }

    const tranzactie = tranzactiiRows[0] as TranzactieSource;

    console.log(`🔍 Căutare candidați pentru tranzacția ${tranzactie.suma} RON (${tranzactie.directie})`);

    // Inițializăm structura corectă pentru candidați (obiect cu 2 array-uri)
    let etapeCandidati: EtapaFacturaCandidat[] = [];
    let cheltuieliCandidati: CheltuialaCandidat[] = [];

    // Căutăm candidații pe baza direcției și target_type
    if (tranzactie.directie === 'intrare' && (targetType === 'all' || targetType === 'etape_facturi')) {
      etapeCandidati = await findEtapeFacturiCandidatesForTransaction(tranzactie, tolerance);
      console.log(`📋 Găsiți ${etapeCandidati.length} candidați EtapeFacturi`);
    }

    if (tranzactie.directie === 'iesire' && (targetType === 'all' || targetType === 'cheltuieli')) {
      cheltuieliCandidati = await findCheltuieliCandidatesForTransaction(tranzactie, tolerance);
      console.log(`📋 Găsiți ${cheltuieliCandidati.length} candidați Cheltuieli`);
    }

    return NextResponse.json({
      success: true,
      candidati: {
        etape_facturi: etapeCandidati,
        cheltuieli: cheltuieliCandidati
      },
      tranzactie: tranzactie
    });

  } catch (error: any) {
    console.error('❌ Eroare căutare candidați manual matching:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la căutarea candidaților pentru matching'
    }, { status: 500 });
  }
}

/**
 * POST - Aplică matching manual selectat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Suport pentru ambele formate (vechi și nou)
    const matchRequest: ManualMatchRequest = {
      tranzactie_id: body.tranzactie_id,
      target_type: body.target_type || 'etapa_factura', // default pentru compatibilitate
      target_id: body.target_id || body.factura_id, // acceptă și factura_id pentru backwards compatibility
      confidence_manual: body.confidence_manual || 85, // default confidence pentru manual matching
      notes: body.notes,
      force_match: body.force_match
    };

    // Validări
    if (!matchRequest.tranzactie_id || !matchRequest.target_id) {
      return NextResponse.json({
        success: false,
        error: 'tranzactie_id și target_id/factura_id sunt obligatorii'
      }, { status: 400 });
    }

    if (matchRequest.target_type && !['etapa_factura', 'cheltuiala'].includes(matchRequest.target_type)) {
      return NextResponse.json({
        success: false,
        error: 'target_type trebuie să fie "etapa_factura" sau "cheltuiala"'
      }, { status: 400 });
    }

    if (matchRequest.confidence_manual && (matchRequest.confidence_manual < 1 || matchRequest.confidence_manual > 100)) {
      return NextResponse.json({
        success: false,
        error: 'confidence_manual trebuie să fie între 1 și 100'
      }, { status: 400 });
    }

    console.log(`🔧 Aplicare manual matching: ${matchRequest.tranzactie_id} → ${matchRequest.target_type}:${matchRequest.target_id}`);

    // Aplicăm matching-ul
    await applyManualMatch(matchRequest);

    return NextResponse.json({
      success: true,
      message: 'Matching manual aplicat cu succes',
      match: {
        tranzactie_id: matchRequest.tranzactie_id,
        target_type: matchRequest.target_type,
        target_id: matchRequest.target_id,
        confidence: matchRequest.confidence_manual,
        notes: matchRequest.notes
      }
    });

  } catch (error: any) {
    console.error('❌ Eroare aplicare manual matching:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la aplicarea matching-ului manual'
    }, { status: 500 });
  }
}
