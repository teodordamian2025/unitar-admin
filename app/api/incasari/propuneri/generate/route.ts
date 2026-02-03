// =================================================================
// API: Generare Propuneri Încasări Automate
// POST /api/incasari/propuneri/generate
// Generat: 2025-12-17
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

import {
  TranzactieCandidat,
  FacturaCandidat,
  ConfigurarePropuneri,
  GeneratePropuneriResult
} from '@/lib/incasari-propuneri/types';

import {
  calculateMatchScore,
  findBestMatch,
  determineMatchingAlgorithm,
  isAutoApprovable,
  DEFAULT_CONFIG
} from '@/lib/incasari-propuneri/matcher';

import { extractDate } from '@/lib/incasari-propuneri/extractor';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

/**
 * Citește configurările din BigQuery
 */
async function getConfig(): Promise<ConfigurarePropuneri> {
  try {
    const [rows] = await bigquery.query(`
      SELECT config_key, config_value
      FROM \`${PROJECT_ID}.${DATASET}.TranzactiiSyncConfig\`
      WHERE category = 'incasari_propuneri'
    `);

    const config = { ...DEFAULT_CONFIG };

    for (const row of rows) {
      switch (row.config_key) {
        case 'propuneri_auto_approve_threshold':
          config.auto_approve_threshold = parseFloat(row.config_value);
          break;
        case 'propuneri_min_score':
          config.min_score = parseFloat(row.config_value);
          break;
        case 'propuneri_expirare_zile':
          config.expirare_zile = parseInt(row.config_value);
          break;
        case 'propuneri_notificare_enabled':
          config.notificare_enabled = row.config_value === 'true';
          break;
        case 'propuneri_referinta_score':
          config.referinta_score = parseInt(row.config_value);
          break;
        case 'propuneri_cui_score':
          config.cui_score = parseInt(row.config_value);
          break;
        case 'propuneri_suma_score':
          config.suma_score = parseInt(row.config_value);
          break;
      }
    }

    return config;
  } catch (error) {
    console.warn('⚠️ Eroare citire config, folosim default:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Verifică dacă tabelul IncasariPropuneri_v2 există
 */
async function tableExists(): Promise<boolean> {
  try {
    await bigquery.query(`SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\` LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obține tranzacțiile candidate pentru matching
 */
async function getTranzactiiCandidate(limit: number = 500, checkExisting: boolean = true): Promise<TranzactieCandidat[]> {
  // Verificăm dacă tabelul propuneri există (pentru a exclude cele cu propuneri pending)
  const propuneriTableExists = checkExisting ? await tableExists() : false;

  // Exclude tranzactii care au deja propuneri:
  // - pending: propunere in asteptare
  // - rejected: user a respins explicit propunerea
  // - approved: deja aprobata (si matching_tip setat)
  // Permitem re-propuneri doar pentru 'expired' (propuneri vechi nereactionate)
  const excludeClause = propuneriTableExists
    ? `AND NOT EXISTS (
        SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\` p
        WHERE p.tranzactie_id = t.id AND p.status IN ('pending', 'rejected', 'approved')
      )`
    : '';

  const [rows] = await bigquery.query(`
    SELECT
      t.id,
      t.suma,
      t.data_procesare,
      t.nume_contrapartida,
      t.cui_contrapartida,
      t.detalii_tranzactie,
      t.referinta_bancii,
      t.directie,
      t.status,
      t.matching_tip
    FROM \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\` t
    WHERE
      t.directie = 'intrare'
      AND t.suma > 100
      AND (t.matching_tip IS NULL OR t.matching_tip = 'none')
      AND (t.status IS NULL OR t.status != 'matched')
      AND t.data_procesare >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      ${excludeClause}
    ORDER BY t.data_procesare DESC, t.suma DESC
    LIMIT ${limit}
  `);

  return rows.map((row: any) => ({
    id: row.id,
    suma: parseFloat(row.suma) || 0,
    data_procesare: row.data_procesare,
    nume_contrapartida: row.nume_contrapartida,
    cui_contrapartida: row.cui_contrapartida,
    detalii_tranzactie: row.detalii_tranzactie,
    referinta_bancii: row.referinta_bancii,
    directie: row.directie,
    status: row.status,
    matching_tip: row.matching_tip
  }));
}

/**
 * Obtine facturile candidate pentru matching din FacturiGenerate_v2
 * ✅ STORNO TRACKING (14.01.2026): Exclude facturi storno și stornate explicit
 */
async function getFacturiGenerateCandidate(): Promise<FacturaCandidat[]> {
  const [rows] = await bigquery.query(`
    SELECT
      fg.id,
      fg.serie,
      fg.numar,
      fg.total,
      fg.valoare_platita,
      (fg.total - COALESCE(fg.valoare_platita, 0)) as rest_de_plata,
      fg.client_cui,
      fg.client_nume,
      fg.data_factura,
      fg.status,
      fg.proiect_id
    FROM \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\` fg
    WHERE
      fg.status NOT IN ('platita', 'anulata', 'storno', 'stornata')
      AND (fg.total - COALESCE(fg.valoare_platita, 0)) > 0
      AND fg.data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
      -- ✅ STORNO TRACKING (14.01.2026): Exclude facturi storno și stornate
      AND COALESCE(fg.is_storno, false) = false
      AND fg.stornata_de_factura_id IS NULL
    ORDER BY fg.data_factura DESC
  `);

  return rows.map((row: any) => ({
    id: row.id,
    serie: row.serie,
    numar: row.numar,
    total: parseFloat(row.total) || 0,
    valoare_platita: parseFloat(row.valoare_platita) || 0,
    rest_de_plata: parseFloat(row.rest_de_plata) || 0,
    client_cui: row.client_cui,
    client_nume: row.client_nume,
    data_factura: row.data_factura,
    status: row.status,
    proiect_id: row.proiect_id,
    sursa: 'facturi_generate' as const
  }));
}

/**
 * Obtine facturile externe din FacturiEmiseANAF_v2 (care nu au link la FacturiGenerate)
 * ✅ STORNO TRACKING (14.01.2026): Exclude facturi storno și stornate explicit
 */
async function getFacturiEmiseExterneCandidate(): Promise<FacturaCandidat[]> {
  const [rows] = await bigquery.query(`
    SELECT
      fe.id,
      fe.serie_numar,
      COALESCE(fe.valoare_ron, fe.valoare_totala) as total,
      COALESCE(fe.valoare_platita, 0) as valoare_platita,
      COALESCE(fe.valoare_ron, fe.valoare_totala) - COALESCE(fe.valoare_platita, 0) as rest_de_plata,
      fe.cif_client as client_cui,
      fe.nume_client as client_nume,
      fe.data_factura,
      COALESCE(fe.status_achitare, 'Neincasat') as status,
      fe.factura_generata_id
    FROM \`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\` fe
    WHERE
      fe.activ = TRUE
      -- Doar facturi externe care NU au link la FacturiGenerate_v2
      AND fe.factura_generata_id IS NULL
      -- Doar neachitate sau partial achitate
      AND COALESCE(fe.status_achitare, 'Neincasat') != 'Incasat'
      AND (COALESCE(fe.valoare_ron, fe.valoare_totala) - COALESCE(fe.valoare_platita, 0)) > 0
      AND fe.data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR)
      -- Doar facturi, nu note credit negative
      AND COALESCE(fe.valoare_ron, fe.valoare_totala) > 0
      -- ✅ STORNO TRACKING (14.01.2026): Exclude facturi storno și stornate
      AND COALESCE(fe.is_storno, false) = false
      AND fe.stornata_de_factura_id IS NULL
    ORDER BY fe.data_factura DESC
  `);

  return rows.map((row: any) => {
    // Parsam serie si numar din serie_numar
    let serie: string | null = null;
    let numar: string = '';
    if (row.serie_numar) {
      const parts = row.serie_numar.split(/[-\/]/);
      if (parts.length >= 2) {
        serie = parts[0];
        numar = parts.slice(1).join('-');
      } else {
        numar = row.serie_numar;
      }
    }

    return {
      id: row.id,
      serie,
      numar,
      total: parseFloat(row.total) || 0,
      valoare_platita: parseFloat(row.valoare_platita) || 0,
      rest_de_plata: parseFloat(row.rest_de_plata) || 0,
      client_cui: row.client_cui,
      client_nume: row.client_nume,
      data_factura: row.data_factura,
      status: row.status,
      proiect_id: null,
      sursa: 'facturi_emise_anaf' as const,
      factura_emisa_id: row.id
    };
  });
}

/**
 * Obtine toate facturile candidate pentru matching (ambele surse)
 */
async function getFacturiCandidate(): Promise<FacturaCandidat[]> {
  const [facturiGenerate, facturiEmise] = await Promise.all([
    getFacturiGenerateCandidate(),
    getFacturiEmiseExterneCandidate()
  ]);

  // Combinam ambele surse
  const toateFacturile = [...facturiGenerate, ...facturiEmise];

  console.log(`📊 [Propuneri] Facturi candidate: ${facturiGenerate.length} din FacturiGenerate + ${facturiEmise.length} externe din FacturiEmiseANAF = ${toateFacturile.length} total`);

  return toateFacturile;
}

/**
 * Sanitize string pentru SQL - escapează caracterele speciale
 */
function sanitizeSQL(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  // Escapează ghilimele simple pentru SQL
  const sanitized = String(value).replace(/'/g, "''");
  return `'${sanitized}'`;
}

/**
 * Salvează propunerile în BigQuery folosind batch loading (nu streaming)
 * Aceasta metodă evită problema "streaming buffer" care blochează UPDATE-uri imediate
 */
async function savePropuneri(propuneri: any[]): Promise<void> {
  if (propuneri.length === 0) return;

  // Verificăm dacă tabelul există
  const exists = await tableExists();
  if (!exists) {
    throw new Error(
      'Tabelul IncasariPropuneri_v2 nu există. ' +
      'Rulați scriptul SQL: scripts/incasari-propuneri-create-table.sql în BigQuery Console.'
    );
  }

  // Folosim SQL INSERT în loc de streaming API pentru a evita problema streaming buffer
  // Streaming buffer blochează UPDATE-uri pe rândurile nou inserate pentru ~90 secunde
  // Batch loading (INSERT via query) nu are această limitare

  // Construim valorile pentru INSERT batch
  const values = propuneri.map(p => {
    return `(
      ${sanitizeSQL(p.id)},
      ${sanitizeSQL(p.tranzactie_id)},
      ${sanitizeSQL(p.factura_id)},
      ${sanitizeSQL(p.etapa_factura_id)},
      ${p.score || 0},
      ${p.auto_approvable === true},
      ${p.suma_tranzactie || 0},
      ${p.suma_factura || 0},
      ${p.rest_de_plata || 0},
      ${p.diferenta_ron || 0},
      ${p.diferenta_procent || 0},
      ${sanitizeSQL(p.matching_algorithm)},
      ${sanitizeSQL(p.referinta_gasita)},
      ${p.matching_details ? `JSON '${p.matching_details.replace(/'/g, "''")}'` : 'NULL'},
      ${sanitizeSQL(p.status)},
      ${sanitizeSQL(p.motiv_respingere)},
      ${sanitizeSQL(p.factura_serie)},
      ${sanitizeSQL(p.factura_numar)},
      ${sanitizeSQL(p.factura_client_nume)},
      ${sanitizeSQL(p.factura_client_cui)},
      ${p.tranzactie_data ? `DATE('${p.tranzactie_data}')` : 'NULL'},
      ${sanitizeSQL(p.tranzactie_contrapartida)},
      ${sanitizeSQL(p.tranzactie_cui)},
      ${sanitizeSQL(p.tranzactie_detalii)},
      TIMESTAMP('${p.data_creare}'),
      ${sanitizeSQL(p.creat_de)},
      ${sanitizeSQL(p.factura_sursa)},
      ${sanitizeSQL(p.factura_emisa_id)}
    )`;
  }).join(',\n');

  const insertQuery = `
    INSERT INTO \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\` (
      id,
      tranzactie_id,
      factura_id,
      etapa_factura_id,
      score,
      auto_approvable,
      suma_tranzactie,
      suma_factura,
      rest_de_plata,
      diferenta_ron,
      diferenta_procent,
      matching_algorithm,
      referinta_gasita,
      matching_details,
      status,
      motiv_respingere,
      factura_serie,
      factura_numar,
      factura_client_nume,
      factura_client_cui,
      tranzactie_data,
      tranzactie_contrapartida,
      tranzactie_cui,
      tranzactie_detalii,
      data_creare,
      creat_de,
      factura_sursa,
      factura_emisa_id
    ) VALUES ${values}
  `;

  await bigquery.query({
    query: insertQuery,
    location: 'EU'
  });
}

/**
 * Trimite notificare admin despre propuneri noi
 */
async function sendNotification(stats: { total: number; auto: number; review: number }): Promise<void> {
  if (stats.total === 0) return;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tip_notificare: 'incasari_propuneri_noi',
        user_id: ['admin'],
        context: {
          count: stats.total.toString(),
          auto_count: stats.auto.toString(),
          review_count: stats.review.toString(),
          link_detalii: `${baseUrl}/admin/financiar/propuneri-incasari`
        }
      })
    });

    console.log(`📧 Notificare trimisă: ${stats.total} propuneri noi`);
  } catch (error) {
    console.error('⚠️ Eroare trimitere notificare:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      dry_run = false,
      limit = 500,
      send_notification = true
    } = body;

    console.log(`🔍 Începe generare propuneri (dry_run: ${dry_run}, limit: ${limit})`);

    // 1. Citim configurarea
    const config = await getConfig();
    console.log(`⚙️ Config: threshold=${config.auto_approve_threshold}%, min_score=${config.min_score}%`);

    // 2. Obținem candidații
    const tranzactii = await getTranzactiiCandidate(limit);
    const facturi = await getFacturiCandidate();

    console.log(`📊 Candidați: ${tranzactii.length} tranzacții, ${facturi.length} facturi`);

    if (tranzactii.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nu există tranzacții noi pentru procesare',
        propuneri_generate: 0,
        propuneri_auto_approvable: 0,
        propuneri_review: 0,
        tranzactii_procesate: 0
      });
    }

    // 3. Procesăm fiecare tranzacție
    const propuneri: any[] = [];
    let autoApprovable = 0;
    let reviewNeeded = 0;

    for (const tranzactie of tranzactii) {
      const match = findBestMatch(tranzactie, facturi, config);

      if (match) {
        const { factura, score } = match;
        const isAuto = isAutoApprovable(score, config);

        if (isAuto) autoApprovable++;
        else reviewNeeded++;

        const dataTranzactie = extractDate(tranzactie.data_procesare);
        const diferentaRon = Math.abs(tranzactie.suma - factura.rest_de_plata);
        const diferentaProcent = score.details.suma_diferenta_procent;

        // Determinam sursa facturii
        const facturaSursa = factura.sursa || 'facturi_generate';
        const facturaEmisaId = factura.factura_emisa_id || null;

        propuneri.push({
          id: uuidv4(),
          tranzactie_id: tranzactie.id,
          factura_id: factura.id,
          etapa_factura_id: null,

          score: score.total,
          auto_approvable: isAuto,

          suma_tranzactie: tranzactie.suma,
          suma_factura: factura.total,
          rest_de_plata: factura.rest_de_plata,
          diferenta_ron: diferentaRon,
          diferenta_procent: diferentaProcent,

          matching_algorithm: determineMatchingAlgorithm(score),
          referinta_gasita: score.details.referinta_gasita,
          matching_details: JSON.stringify(score),

          status: 'pending',
          motiv_respingere: null,

          factura_serie: factura.serie,
          factura_numar: factura.numar,
          factura_client_nume: factura.client_nume,
          factura_client_cui: factura.client_cui,
          // Camp nou pentru sursa facturii
          factura_sursa: facturaSursa,
          factura_emisa_id: facturaEmisaId,

          tranzactie_data: dataTranzactie,
          tranzactie_contrapartida: tranzactie.nume_contrapartida,
          tranzactie_cui: tranzactie.cui_contrapartida,
          tranzactie_detalii: (tranzactie.detalii_tranzactie || '').substring(0, 500),

          data_creare: new Date().toISOString(),
          creat_de: 'auto_generate'
        });

        const sursaLabel = facturaSursa === 'facturi_emise_anaf' ? ' [EXTERN]' : '';
        console.log(`✅ Propunere: ${tranzactie.suma.toFixed(2)} RON → ${factura.serie || ''}-${factura.numar} (${score.total}%${isAuto ? ' AUTO' : ''}${sursaLabel})`);
      }
    }

    // 4. Salvăm propunerile (dacă nu e dry_run)
    if (!dry_run && propuneri.length > 0) {
      await savePropuneri(propuneri);
      console.log(`💾 Salvate ${propuneri.length} propuneri`);

      // 5. Trimitem notificare
      if (send_notification && config.notificare_enabled) {
        await sendNotification({
          total: propuneri.length,
          auto: autoApprovable,
          review: reviewNeeded
        });
      }
    }

    const result: GeneratePropuneriResult = {
      success: true,
      propuneri_generate: propuneri.length,
      propuneri_auto_approvable: autoApprovable,
      propuneri_review: reviewNeeded,
      tranzactii_procesate: tranzactii.length
    };

    return NextResponse.json({
      ...result,
      message: dry_run
        ? `Preview: ${propuneri.length} propuneri ar fi generate`
        : `${propuneri.length} propuneri generate cu succes`,
      propuneri: dry_run ? propuneri.map(p => ({
        tranzactie_id: p.tranzactie_id,
        factura_id: p.factura_id,
        factura_ref: `${p.factura_serie || ''}-${p.factura_numar}`,
        suma_tranzactie: p.suma_tranzactie,
        rest_de_plata: p.rest_de_plata,
        score: p.score,
        auto_approvable: p.auto_approvable,
        referinta_gasita: p.referinta_gasita,
        matching_algorithm: p.matching_algorithm
      })) : undefined
    });

  } catch (error: any) {
    console.error('❌ Eroare generare propuneri:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la generarea propunerilor',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// GET pentru preview (dry_run)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');

  // Redirectăm către POST cu dry_run=true
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ dry_run: true, limit, send_notification: false }),
    headers: { 'Content-Type': 'application/json' }
  });

  return POST(mockRequest);
}
