// =================================================================
// API AUTO-MATCHING TRANZACTII CU ETAPEFACTURI
// Generat: 17 septembrie 2025, 23:55 (Romania)
// Cale: app/api/tranzactii/auto-match/route.ts
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
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
const TRANZACTII_TABLE = `\`${PROJECT_ID}.${DATASET}.TranzactiiImportate${tableSuffix}\``;
const ETAPE_FACTURI_TABLE = `\`${PROJECT_ID}.${DATASET}.EtapeFacuri${tableSuffix}\``;
const TRANZACTII_BANCARE_TABLE = `\`${PROJECT_ID}.${DATASET}.TranzactiiBancare${tableSuffix}\``;

console.log(`🔧 [Auto Match] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================

interface TranzactieCandidat {
  id: string;
  suma: number;
  data_procesare: string;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  directie: string;
}

interface EtapaFacturaCandidat {
  id: string;
  factura_id: string;
  etapa_id: string;
  proiect_id: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  curs_valutar: number;
  data_curs_valutar: string;
  status_incasare: string;
  valoare_incasata: number;
  // Join cu FacturiGenerate
  factura_serie: string;
  factura_numar: string;
  factura_data: string;
  factura_client_id: string;
  factura_client_nume: string;
  factura_client_cui: string;
  factura_subtotal: number;
  factura_total_tva: number;
  factura_total: number;
}

interface CheltuialaCandidat {
  id: string;
  proiect_id: string;
  furnizor_nume: string;
  furnizor_cui: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  status_achitare: string;
}

interface MatchResult {
  tranzactie_id: string;
  target_type: 'etapa_factura' | 'cheltuiala';
  target_id: string;
  confidence_score: number;
  matching_algorithm: string;
  suma_tranzactie: number;
  suma_target: number;
  suma_target_ron: number;
  diferenta_ron: number;
  diferenta_procent: number;
  moneda_target: string;
  curs_valutar_folosit?: number;
  data_curs_valutar?: string;
  matching_details: any;
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================

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
 * Calculează confidence score pentru matching
 */
function calculateMatchingScore(
  tranzactie: TranzactieCandidat,
  etapa: EtapaFacturaCandidat,
  diferentaProcent: number
): { score: number; details: any } {
  let score = 0;
  const details: any = {
    suma_score: 0,
    timp_score: 0,
    cui_score: 0,
    nume_score: 0,
    referinta_score: 0,
    status_score: 0
  };

  // 1. SCOR SUMĂ (40 puncte max) - cel mai important
  if (diferentaProcent <= 0.5) {
    details.suma_score = 40; // Perfect match
  } else if (diferentaProcent <= 1) {
    details.suma_score = 35; // Foarte bun
  } else if (diferentaProcent <= 2) {
    details.suma_score = 30; // Bun
  } else if (diferentaProcent <= 3) {
    details.suma_score = 25; // Acceptabil
  } else if (diferentaProcent <= 5) {
    details.suma_score = 15; // Marginal
  }
  score += details.suma_score;

  // 2. SCOR TIMP (20 puncte max)
  const tranzactieDate = new Date(tranzactie.data_procesare);
  const facturaDate = new Date(etapa.factura_data);
  const daysDiff = Math.abs((tranzactieDate.getTime() - facturaDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 1) {
    details.timp_score = 20; // Același/următoarea zi
  } else if (daysDiff <= 3) {
    details.timp_score = 18; // În 3 zile
  } else if (daysDiff <= 7) {
    details.timp_score = 15; // În săptămână
  } else if (daysDiff <= 15) {
    details.timp_score = 12; // În 2 săptămâni
  } else if (daysDiff <= 30) {
    details.timp_score = 8; // În lună
  } else if (daysDiff <= 60) {
    details.timp_score = 4; // În 2 luni
  }
  score += details.timp_score;

  // 3. SCOR CUI (20 puncte max)
  if (tranzactie.cui_contrapartida && etapa.factura_client_cui) {
    if (tranzactie.cui_contrapartida === etapa.factura_client_cui) {
      details.cui_score = 20; // CUI perfect match
    }
  }
  score += details.cui_score;

  // 4. SCOR NUME (10 puncte max)
  if (tranzactie.nume_contrapartida && etapa.factura_client_nume) {
    const nameSimilarity = levenshteinSimilarity(
      tranzactie.nume_contrapartida,
      etapa.factura_client_nume
    );
    if (nameSimilarity >= 90) {
      details.nume_score = 10;
    } else if (nameSimilarity >= 70) {
      details.nume_score = 8;
    } else if (nameSimilarity >= 50) {
      details.nume_score = 5;
    }
  }
  score += details.nume_score;

  // 5. SCOR REFERINȚĂ FACTURĂ (5 puncte max)
  const tranzactieRefs = extractInvoiceNumbers(tranzactie.detalii_tranzactie);
  const facturaRef = `${etapa.factura_serie}${etapa.factura_numar}`.replace(/\s+/g, '');
  
  if (tranzactieRefs.some(ref => ref === facturaRef || ref === etapa.factura_numar)) {
    details.referinta_score = 5; // Referință exactă
  } else if (tranzactieRefs.some(ref => ref.includes(etapa.factura_numar))) {
    details.referinta_score = 3; // Referință parțială
  }
  score += details.referinta_score;

  // 6. SCOR STATUS (5 puncte max)
  if (etapa.status_incasare === 'Neincasat') {
    details.status_score = 5; // Perfect pentru matching
  } else if (etapa.status_incasare === 'Partial') {
    details.status_score = 3; // Poate fi completat
  }
  score += details.status_score;

  return { score: Math.min(score, 100), details };
}

// =================================================================
// CĂUTARE CANDIDAȚI PENTRU MATCHING
// =================================================================

/**
 * Găsește candidații EtapeFacturi pentru tranzacțiile de încasare
 */
async function findEtapeFacturiCandidates(tranzactii: TranzactieCandidat[]): Promise<EtapaFacturaCandidat[]> {
  if (tranzactii.length === 0) return [];

  try {
    // Căutăm etapele de factură care pot fi matchate
    const query = `
      SELECT 
        ef.id,
        ef.factura_id,
        ef.etapa_id,
        ef.proiect_id,
        ef.valoare,
        ef.moneda,
        ef.valoare_ron,
        ef.curs_valutar,
        ef.data_curs_valutar,
        ef.status_incasare,
        ef.valoare_incasata,
        
        -- Date factură
        fg.serie as factura_serie,
        fg.numar as factura_numar,
        fg.data_factura as factura_data,
        fg.client_id as factura_client_id,
        fg.client_nume as factura_client_nume,
        fg.client_cui as factura_client_cui,
        fg.subtotal as factura_subtotal,
        fg.total_tva as factura_total_tva,
        fg.total as factura_total
        
      FROM \`hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi\` ef
      INNER JOIN \`hale-mode-464009-i6.PanouControlUnitar.FacturiGenerate\` fg 
        ON ef.factura_id = fg.id
      WHERE 
        ef.activ = TRUE 
        AND fg.status != 'anulata'
        AND ef.status_incasare IN ('Neincasat', 'Partial')
        AND ef.valoare_ron > 0
        AND fg.data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
      ORDER BY fg.data_factura DESC, ef.valoare_ron DESC
    `;

    const [results] = await bigquery.query(query);
    return results as EtapaFacturaCandidat[];

  } catch (error) {
    console.error('❌ Eroare căutare candidați EtapeFacturi:', error);
    return [];
  }
}

/**
 * Găsește candidații ProiecteCheltuieli pentru tranzacțiile de plată
 */
async function findCheltuieliCandidates(tranzactii: TranzactieCandidat[]): Promise<CheltuialaCandidat[]> {
  if (tranzactii.length === 0) return [];

  try {
    const query = `
      SELECT 
        id,
        proiect_id,
        furnizor_nume,
        furnizor_cui,
        valoare,
        moneda,
        valoare_ron,
        status_achitare
      FROM \`hale-mode-464009-i6.PanouControlUnitar.ProiecteCheltuieli\`
      WHERE 
        activ = TRUE 
        AND status_achitare IN ('Neincasat', 'Partial')
        AND valoare_ron > 0
        AND data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
      ORDER BY data_creare DESC, valoare_ron DESC
    `;

    const [results] = await bigquery.query(query);
    return results as CheltuialaCandidat[];

  } catch (error) {
    console.error('❌ Eroare căutare candidați Cheltuieli:', error);
    return [];
  }
}

// =================================================================
// ALGORITM DE MATCHING
// =================================================================

/**
 * Efectuează matching automat pentru încasări cu EtapeFacturi
 */
async function matchIncasariCuEtapeFacturi(
  tranzactii: TranzactieCandidat[],
  etape: EtapaFacturaCandidat[],
  tolerantaProcent: number = 3
): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];
  
  const incasari = tranzactii.filter(t => t.directie === 'in' && t.suma > 0);
  
  console.log(`🔍 Matching încasări: ${incasari.length} tranzacții cu ${etape.length} etape`);

  for (const tranzactie of incasari) {
    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    for (const etapa of etape) {
      // Calculăm diferența de sumă în RON
      const sumaRamasaIncasare = etapa.valoare_ron - (etapa.valoare_incasata || 0);
      if (sumaRamasaIncasare <= 0) continue; // Etapa deja încasată complet

      const diferentaRon = Math.abs(tranzactie.suma - sumaRamasaIncasare);
      const diferentaProcent = (diferentaRon / sumaRamasaIncasare) * 100;

      // Verificăm dacă diferența este în toleranță
      if (diferentaProcent > tolerantaProcent) continue;

      // Calculăm confidence score
      const { score, details } = calculateMatchingScore(tranzactie, etapa, diferentaProcent);

      // Determinăm algoritmul de matching
      let algorithm = 'auto_suma';
      if (details.cui_score > 0) algorithm = 'auto_cui';
      if (details.referinta_score > 0) algorithm = 'auto_referinta';

      if (score > bestScore && score >= 70) { // Threshold minim 70
        bestMatch = {
          tranzactie_id: tranzactie.id,
          target_type: 'etapa_factura',
          target_id: etapa.id,
          confidence_score: score,
          matching_algorithm: algorithm,
          suma_tranzactie: tranzactie.suma,
          suma_target: etapa.valoare,
          suma_target_ron: sumaRamasaIncasare,
          diferenta_ron: diferentaRon,
          diferenta_procent: diferentaProcent,
          moneda_target: etapa.moneda,
          curs_valutar_folosit: etapa.curs_valutar,
          data_curs_valutar: etapa.data_curs_valutar,
          matching_details: {
            factura_id: etapa.factura_id,
            etapa_id: etapa.etapa_id,
            proiect_id: etapa.proiect_id,
            factura_serie: etapa.factura_serie,
            factura_numar: etapa.factura_numar,
            client_cui: etapa.factura_client_cui,
            client_nume: etapa.factura_client_nume,
            score_breakdown: details,
            valoare_ramasa: sumaRamasaIncasare
          }
        };
        bestScore = score;
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
      console.log(`✅ Match găsit: Tranzacție ${tranzactie.suma} RON cu etapă ${bestMatch.suma_target_ron} RON (${bestMatch.confidence_score}% confidence)`);
    }
  }

  return matches;
}

/**
 * Efectuează matching automat pentru plăți cu ProiecteCheltuieli
 */
async function matchPlatiCuCheltuieli(
  tranzactii: TranzactieCandidat[],
  cheltuieli: CheltuialaCandidat[],
  tolerantaProcent: number = 3
): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];
  
  const plati = tranzactii.filter(t => t.directie === 'out' && t.suma < 0);
  
  console.log(`🔍 Matching plăți: ${plati.length} tranzacții cu ${cheltuieli.length} cheltuieli`);

  for (const tranzactie of plati) {
    const sumaPlata = Math.abs(tranzactie.suma);
    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    for (const cheltuiala of cheltuieli) {
      const diferentaRon = Math.abs(sumaPlata - cheltuiala.valoare_ron);
      const diferentaProcent = (diferentaRon / cheltuiala.valoare_ron) * 100;

      if (diferentaProcent > tolerantaProcent) continue;

      // Scor simplificat pentru cheltuieli
      let score = 0;
      
      // Scor sumă (60 puncte)
      if (diferentaProcent <= 0.5) score += 60;
      else if (diferentaProcent <= 1) score += 50;
      else if (diferentaProcent <= 2) score += 40;
      else if (diferentaProcent <= 3) score += 30;

      // Scor CUI furnizor (25 puncte)
      if (tranzactie.cui_contrapartida && cheltuiala.furnizor_cui) {
        if (tranzactie.cui_contrapartida === cheltuiala.furnizor_cui) {
          score += 25;
        }
      }

      // Scor nume furnizor (15 puncte)
      if (tranzactie.nume_contrapartida && cheltuiala.furnizor_nume) {
        const similarity = levenshteinSimilarity(
          tranzactie.nume_contrapartida,
          cheltuiala.furnizor_nume
        );
        if (similarity >= 80) score += 15;
        else if (similarity >= 60) score += 10;
        else if (similarity >= 40) score += 5;
      }

      if (score > bestScore && score >= 60) { // Threshold mai mic pentru plăți
        bestMatch = {
          tranzactie_id: tranzactie.id,
          target_type: 'cheltuiala',
          target_id: cheltuiala.id,
          confidence_score: score,
          matching_algorithm: tranzactie.cui_contrapartida === cheltuiala.furnizor_cui ? 'auto_cui' : 'auto_suma',
          suma_tranzactie: sumaPlata,
          suma_target: cheltuiala.valoare,
          suma_target_ron: cheltuiala.valoare_ron,
          diferenta_ron: diferentaRon,
          diferenta_procent: diferentaProcent,
          moneda_target: cheltuiala.moneda,
          matching_details: {
            proiect_id: cheltuiala.proiect_id,
            furnizor_cui: cheltuiala.furnizor_cui,
            furnizor_nume: cheltuiala.furnizor_nume
          }
        };
        bestScore = score;
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
      console.log(`✅ Match plată găsit: ${sumaPlata} RON cu cheltuială ${bestMatch.suma_target_ron} RON (${bestMatch.confidence_score}% confidence)`);
    }
  }

  return matches;
}

// =================================================================
// APLICARE MATCHING-URI
// =================================================================

/**
 * Salvează matching-urile în BigQuery și actualizează statuses
 */
async function applyMatches(matches: MatchResult[], dryRun: boolean = false): Promise<void> {
  if (matches.length === 0) {
    console.log('📝 Nu există matching-uri de aplicat');
    return;
  }

  if (dryRun) {
    console.log(`🔍 DRY RUN: ${matches.length} matching-uri ar fi aplicate`);
    return;
  }

  try {
    // Inserăm matching-urile în TranzactiiMatching
    const matchingRecords = matches.map(match => ({
      id: crypto.randomUUID(),
      tranzactie_id: match.tranzactie_id,
      target_type: match.target_type,
      target_id: match.target_id,
      target_details: match.matching_details,
      confidence_score: match.confidence_score,
      matching_algorithm: match.matching_algorithm,
      suma_tranzactie: match.suma_tranzactie,
      suma_target: match.suma_target,
      suma_target_ron: match.suma_target_ron,
      diferenta_ron: match.diferenta_ron,
      diferenta_procent: match.diferenta_procent,
      moneda_target: match.moneda_target,
      curs_valutar_folosit: match.curs_valutar_folosit,
      data_curs_valutar: match.data_curs_valutar,
      matching_details: match.matching_details,
      status: 'active',
      data_creare: new Date().toISOString(),
      creat_de: 'auto_match_algorithm'
    }));

    // Inserăm în batch
    const matchingTable = dataset.table('TranzactiiMatching');
    await matchingTable.insert(matchingRecords);

    // Actualizăm statusul tranzacțiilor
    const tranzactieIds = matches.map(m => `"${m.tranzactie_id}"`).join(',');
    await bigquery.query(`
      UPDATE ${TRANZACTII_BANCARE_TABLE}
      SET
        matching_tip = 'auto',
        matching_confidence = (
          SELECT confidence_score
          FROM \`${PROJECT_ID}.${DATASET}.TranzactiiMatching${tableSuffix}\`
          WHERE tranzactie_id = TranzactiiBancare.id AND status = 'active'
          ORDER BY confidence_score DESC LIMIT 1
        ),
        status = 'matched',
        processed = TRUE,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id IN (${tranzactieIds})
    `);

    // Actualizăm EtapeFacturi pentru încasări
    const etapeMatches = matches.filter(m => m.target_type === 'etapa_factura');
    for (const match of etapeMatches) {
      const sumaIncasata = match.suma_tranzactie;
      const etapaId = match.target_id;
      
      // Calculăm noul status și valoarea încasată
      const newValoareIncasata = `COALESCE(valoare_incasata, 0) + ${sumaIncasata}`;
      const newStatus = `CASE 
        WHEN ${newValoareIncasata} >= valoare_ron THEN 'Incasat'
        WHEN ${newValoareIncasata} > 0 THEN 'Partial'
        ELSE 'Neincasat'
      END`;

      await bigquery.query(`
        UPDATE \`hale-mode-464009-i6.PanouControlUnitar.EtapeFacturi\`
        SET 
          valoare_incasata = ${newValoareIncasata},
          status_incasare = ${newStatus},
          data_incasare = CASE WHEN ${newStatus} = 'Incasat' THEN CURRENT_DATE() ELSE data_incasare END,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = "${etapaId}"
      `);

      // Actualizăm și EtapeContract prin etapa_id
      if (match.matching_details.etapa_id) {
        await bigquery.query(`
          UPDATE \`hale-mode-464009-i6.PanouControlUnitar.EtapeContract\`
          SET 
            status_incasare = ${newStatus},
            data_incasare = CASE WHEN ${newStatus} = 'Incasat' THEN CURRENT_DATE() ELSE data_incasare END,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Etapa = "${match.matching_details.etapa_id}"
        `);
      }
    }

    console.log(`✅ ${matches.length} matching-uri aplicate cu succes`);

  } catch (error) {
    console.error('❌ Eroare aplicare matching-uri:', error);
    throw error;
  }
}

// =================================================================
// ENDPOINT PRINCIPAL
// =================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      min_confidence = 70,
      dry_run = false,
      tolerance_percent = 3,
      account_id = null
    } = body;

    console.log(`🚀 Începe auto-matching (confidence >= ${min_confidence}%, toleranță ${tolerance_percent}%)`);

    // Obținem configurările din BigQuery
    const [configs] = await bigquery.query(`
      SELECT config_key, config_value, config_type
      FROM \`hale-mode-464009-i6.PanouControlUnitar.TranzactiiSyncConfig\`
      WHERE config_key IN ('matching_tolerance_percent', 'auto_match_min_confidence')
    `);

    const configMap = new Map(configs.map((c: any) => [c.config_key, c.config_value]));
    const toleranta = parseFloat(configMap.get('matching_tolerance_percent') || tolerance_percent.toString());
    const minConfidence = parseFloat(configMap.get('auto_match_min_confidence') || min_confidence.toString());

    // Căutăm tranzacțiile fără matching
    const whereClause = account_id ? `AND account_id = "${account_id}"` : '';
    const [tranzactii] = await bigquery.query(`
      SELECT
        id,
        suma,
        data_procesare,
        nume_contrapartida,
        cui_contrapartida,
        detalii_tranzactie,
        directie
      FROM ${TRANZACTII_BANCARE_TABLE}
      WHERE
        (matching_tip IS NULL OR matching_tip = 'none')
        AND processed = FALSE
        AND status = 'nou'
        ${whereClause}
      ORDER BY data_procesare DESC, ABS(suma) DESC
      LIMIT 1000
    `);

    if (tranzactii.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nu există tranzacții noi pentru matching',
        stats: {
          totalTransactions: 0,
          matchesFound: 0,
          matchesApplied: 0
        }
      });
    }

    console.log(`📊 Găsite ${tranzactii.length} tranzacții pentru matching`);

    // Căutăm candidații pentru matching
    const etapeFacturiCandidates = await findEtapeFacturiCandidates(tranzactii);
    const cheltuieliCandidates = await findCheltuieliCandidates(tranzactii);

    console.log(`🎯 Candidați găsiți: ${etapeFacturiCandidates.length} etape facturi, ${cheltuieliCandidates.length} cheltuieli`);

    // Efectuăm matching-ul
    const incasariMatches = await matchIncasariCuEtapeFacturi(tranzactii, etapeFacturiCandidates, toleranta);
    const platiMatches = await matchPlatiCuCheltuieli(tranzactii, cheltuieliCandidates, toleranta);

    // Filtrăm pe confidence minim
    const allMatches = [...incasariMatches, ...platiMatches].filter(
      m => m.confidence_score >= minConfidence
    );

    console.log(`🎯 Matching-uri găsite: ${allMatches.length} (${incasariMatches.length} încasări + ${platiMatches.length} plăți)`);

    // Aplicăm matching-urile
    if (!dry_run && allMatches.length > 0) {
      await applyMatches(allMatches, false);
    }

    return NextResponse.json({
      success: true,
      message: dry_run 
        ? `Preview: ${allMatches.length} matching-uri găsite` 
        : `${allMatches.length} matching-uri aplicate cu succes`,
      stats: {
        totalTransactions: tranzactii.length,
        candidatesEtapeFacturi: etapeFacturiCandidates.length,
        candidatesCheltuieli: cheltuieliCandidates.length,
        matchesFound: allMatches.length,
        incasariMatches: incasariMatches.length,
        platiMatches: platiMatches.length,
        matchesApplied: dry_run ? 0 : allMatches.length,
        averageConfidence: allMatches.length > 0 
          ? Math.round(allMatches.reduce((sum, m) => sum + m.confidence_score, 0) / allMatches.length)
          : 0
      },
      matches: dry_run ? allMatches.map(m => ({
        tranzactie_id: m.tranzactie_id,
        target_type: m.target_type,
        confidence_score: m.confidence_score,
        suma_tranzactie: m.suma_tranzactie,
        suma_target_ron: m.suma_target_ron,
        diferenta_procent: m.diferenta_procent,
        matching_algorithm: m.matching_algorithm,
        details: m.matching_details
      })) : undefined
    });

  } catch (error: any) {
    console.error('❌ Eroare auto-matching:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare neașteptată la auto-matching',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// =================================================================
// GET - PREVIEW MATCHING-URI FĂRĂ APLICARE
// =================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const min_confidence = parseInt(searchParams.get('min_confidence') || '70');
    const tolerance_percent = parseFloat(searchParams.get('tolerance_percent') || '3');
    const account_id = searchParams.get('account_id');

    // Apelăm POST cu dry_run = true
    const mockRequest = new NextRequest('http://localhost/api/tranzactii/auto-match', {
      method: 'POST',
      body: JSON.stringify({
        min_confidence,
        tolerance_percent,
        account_id,
        dry_run: true
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return POST(mockRequest);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Eroare la preview matching'
    }, { status: 500 });
  }
}
