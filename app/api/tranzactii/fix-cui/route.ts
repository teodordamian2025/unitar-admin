// ==================================================================
// CALEA: app/api/tranzactii/fix-cui/route.ts
// DATA: 2026-01-01
// DESCRIERE: API pentru corectarea CUI-urilor la tranzacțiile existente
// FUNCȚIONALITATE: Re-mapare CUI bazată pe:
//   - PLĂȚI (ieșire): FacturiPrimiteANAF_v2 → Clienti_v2
//   - ÎNCASĂRI (intrare): Clienti_v2
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { matchCUIFromClienti, matchCUIFromFurnizori, normalizeCUI, isValidRomanianCUI } from '@/lib/cui-matcher';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// ==================================================================
// TYPES
// ==================================================================

interface TransactionToFix {
  id: string;
  nume_contrapartida: string;
  cui_contrapartida: string | null;
  directie: string;
  detalii_tranzactie: string | null;
  data_procesare: any;
  suma: number;
}

interface FixResult {
  id: string;
  nume: string;
  old_cui: string | null;
  new_cui: string | null;
  source: 'furnizori' | 'clienti' | 'unchanged' | 'no_match';
  confidence: number;
}

// ==================================================================
// GET: Preview tranzacții cu CUI potențial greșit
// ==================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const directie = searchParams.get('directie') || 'iesire'; // Default: plăți
    const limit = parseInt(searchParams.get('limit') || '100');
    const onlyInvalid = searchParams.get('only_invalid') === 'true';

    console.log(`🔍 [Fix CUI] Preview tranzacții: directie=${directie}, limit=${limit}, onlyInvalid=${onlyInvalid}`);

    // Query tranzacții candidate pentru fix
    // Selectăm tranzacțiile care:
    // 1. Au CUI null/invalid SAU
    // 2. Toate tranzacțiile de tip plată (pentru a le verifica)
    const query = `
      SELECT
        id,
        nume_contrapartida,
        cui_contrapartida,
        directie,
        detalii_tranzactie,
        data_procesare,
        suma
      FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
      WHERE
        directie = @directie
        AND nume_contrapartida IS NOT NULL
        AND nume_contrapartida != 'Necunoscut'
        AND data_procesare >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        ${onlyInvalid ? `AND (cui_contrapartida IS NULL OR LENGTH(CAST(cui_contrapartida AS STRING)) < 2)` : ''}
      ORDER BY data_procesare DESC
      LIMIT @limit
    `;

    const [rows] = await bigquery.query({
      query,
      params: { directie, limit }
    });

    console.log(`📊 [Fix CUI] Găsite ${rows.length} tranzacții pentru analiză`);

    // Analizăm fiecare tranzacție și propunem CUI corect
    const results: FixResult[] = [];
    let toFix = 0;
    let alreadyCorrect = 0;
    let noMatch = 0;

    for (const row of rows as TransactionToFix[]) {
      const isPlata = row.directie === 'iesire';
      let newCui: string | null = null;
      let source: 'furnizori' | 'clienti' | 'unchanged' | 'no_match' = 'no_match';
      let confidence = 0;

      if (isPlata) {
        // Pentru plăți: caută în furnizori (FacturiPrimiteANAF_v2)
        const matchFurnizor = await matchCUIFromFurnizori(row.nume_contrapartida, 85);

        if (matchFurnizor.cui) {
          newCui = matchFurnizor.cui;
          source = 'furnizori';
          confidence = matchFurnizor.confidence;
        } else {
          // Fallback: caută în clienți
          const matchClient = await matchCUIFromClienti(row.nume_contrapartida, 85);
          if (matchClient.cui || matchClient.cnp) {
            newCui = matchClient.cui || matchClient.cnp;
            source = 'clienti';
            confidence = matchClient.confidence;
          }
        }
      } else {
        // Pentru încasări: caută în clienți
        const matchClient = await matchCUIFromClienti(row.nume_contrapartida, 85);
        if (matchClient.cui || matchClient.cnp) {
          newCui = matchClient.cui || matchClient.cnp;
          source = 'clienti';
          confidence = matchClient.confidence;
        }
      }

      // Verificăm dacă CUI-ul s-a schimbat
      const oldCuiNormalized = normalizeCUI(row.cui_contrapartida);
      const newCuiNormalized = newCui ? normalizeCUI(newCui) : null;

      if (newCuiNormalized && oldCuiNormalized !== newCuiNormalized) {
        toFix++;
      } else if (newCuiNormalized && oldCuiNormalized === newCuiNormalized) {
        source = 'unchanged';
        alreadyCorrect++;
      } else {
        noMatch++;
      }

      results.push({
        id: row.id,
        nume: row.nume_contrapartida,
        old_cui: row.cui_contrapartida,
        new_cui: newCui,
        source,
        confidence
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        to_fix: toFix,
        already_correct: alreadyCorrect,
        no_match: noMatch
      },
      transactions: results
    });

  } catch (error: any) {
    console.error('❌ [Fix CUI] Eroare GET:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la analiza tranzacțiilor'
    }, { status: 500 });
  }
}

// ==================================================================
// POST: Aplică corectări CUI
// ==================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      directie = 'iesire',
      dry_run = false,
      limit = 500,
      min_confidence = 85,
      months = 6  // Interval în luni (default 6, max 24)
    } = body;

    const intervalMonths = Math.min(Math.max(1, months), 24); // Clamp 1-24

    console.log(`🔧 [Fix CUI] Aplicare corectări: directie=${directie}, dry_run=${dry_run}, limit=${limit}, months=${intervalMonths}`);

    // Query tranzacții pentru fix
    const query = `
      SELECT
        id,
        nume_contrapartida,
        cui_contrapartida,
        directie,
        detalii_tranzactie
      FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
      WHERE
        directie = @directie
        AND nume_contrapartida IS NOT NULL
        AND nume_contrapartida != 'Necunoscut'
        AND data_procesare >= DATE_SUB(CURRENT_DATE(), INTERVAL ${intervalMonths} MONTH)
      ORDER BY data_procesare DESC
      LIMIT @limit
    `;

    const [rows] = await bigquery.query({
      query,
      params: { directie, limit }
    });

    console.log(`📊 [Fix CUI] Procesez ${rows.length} tranzacții...`);

    const updates: { id: string; new_cui: string; old_cui: string | null; source: string }[] = [];
    let fromFurnizori = 0;
    let fromClienti = 0;
    let unchanged = 0;
    let noMatch = 0;

    for (const row of rows as TransactionToFix[]) {
      const isPlata = row.directie === 'iesire';
      let newCui: string | null = null;
      let source = '';
      let confidence = 0;

      if (isPlata) {
        // Pentru plăți: caută în furnizori
        const matchFurnizor = await matchCUIFromFurnizori(row.nume_contrapartida, min_confidence);

        if (matchFurnizor.cui) {
          newCui = matchFurnizor.cui;
          source = 'furnizori';
          confidence = matchFurnizor.confidence;
        } else {
          // Fallback: caută în clienți
          const matchClient = await matchCUIFromClienti(row.nume_contrapartida, min_confidence);
          if (matchClient.cui || matchClient.cnp) {
            newCui = matchClient.cui || matchClient.cnp;
            source = 'clienti';
            confidence = matchClient.confidence;
          }
        }
      } else {
        // Pentru încasări: caută în clienți
        const matchClient = await matchCUIFromClienti(row.nume_contrapartida, min_confidence);
        if (matchClient.cui || matchClient.cnp) {
          newCui = matchClient.cui || matchClient.cnp;
          source = 'clienti';
          confidence = matchClient.confidence;
        }
      }

      // Verificăm dacă CUI-ul trebuie actualizat
      const oldCuiNormalized = normalizeCUI(row.cui_contrapartida);
      const newCuiNormalized = newCui ? normalizeCUI(newCui) : null;

      if (newCuiNormalized && oldCuiNormalized !== newCuiNormalized) {
        updates.push({
          id: row.id,
          new_cui: newCuiNormalized,
          old_cui: row.cui_contrapartida,
          source
        });

        if (source === 'furnizori') fromFurnizori++;
        else if (source === 'clienti') fromClienti++;
      } else if (newCuiNormalized) {
        unchanged++;
      } else {
        noMatch++;
      }
    }

    console.log(`📊 [Fix CUI] Rezultate analiză:`);
    console.log(`   └─ De actualizat: ${updates.length}`);
    console.log(`   └─ Din furnizori: ${fromFurnizori}`);
    console.log(`   └─ Din clienți: ${fromClienti}`);
    console.log(`   └─ Neschimbate: ${unchanged}`);
    console.log(`   └─ Fără match: ${noMatch}`);

    // Aplicăm updates în BigQuery (dacă nu e dry_run)
    if (!dry_run && updates.length > 0) {
      // Batch update - procesăm în grupuri de 50
      const batchSize = 50;
      let updatedCount = 0;

      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        // Construim CASE statement pentru batch update
        const caseStatements = batch.map(u =>
          `WHEN id = '${u.id}' THEN '${u.new_cui}'`
        ).join('\n          ');

        const ids = batch.map(u => `'${u.id}'`).join(', ');

        const updateQuery = `
          UPDATE \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
          SET
            cui_contrapartida = CASE
              ${caseStatements}
              ELSE cui_contrapartida
            END,
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE id IN (${ids})
        `;

        await bigquery.query(updateQuery);
        updatedCount += batch.length;
        console.log(`✅ [Fix CUI] Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tranzacții actualizate`);
      }

      console.log(`✅ [Fix CUI] Total actualizate: ${updatedCount} tranzacții`);
    }

    return NextResponse.json({
      success: true,
      dry_run,
      summary: {
        total_analyzed: rows.length,
        to_update: updates.length,
        from_furnizori: fromFurnizori,
        from_clienti: fromClienti,
        unchanged,
        no_match: noMatch
      },
      updates: dry_run ? updates.slice(0, 20) : undefined, // Preview primele 20 în dry_run
      message: dry_run
        ? `Preview: ${updates.length} tranzacții ar fi actualizate`
        : `${updates.length} tranzacții actualizate cu succes`
    });

  } catch (error: any) {
    console.error('❌ [Fix CUI] Eroare POST:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la corectarea CUI'
    }, { status: 500 });
  }
}
