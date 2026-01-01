// =================================================================
// API: Generare Propuneri Plăți Automate
// POST /api/plati/propuneri/generate
// Data: 2026-01-01
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

import type {
  ConfigurarePropuneriPlati,
  TranzactiePlataCandidat,
  FacturaPrimitaCandidat,
  CheltuialaCandidat,
  TargetPlataUnificat,
  GeneratePropuneriPlatiResult
} from '@/lib/plati-propuneri/types';

import { DEFAULT_CONFIG } from '@/lib/plati-propuneri/types';

import {
  calculateMatchScorePlati,
  findBestMatchPlati,
  determineMatchingAlgorithm,
  isAutoApprovable,
  extractDate
} from '@/lib/plati-propuneri/matcher';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// =================================================================
// HELPER: Citire configurări
// =================================================================

async function getConfig(): Promise<ConfigurarePropuneriPlati> {
  try {
    const [rows] = await bigquery.query(`
      SELECT config_key, config_value
      FROM \`${PROJECT_ID}.${DATASET}.TranzactiiSyncConfig\`
      WHERE category = 'plati_propuneri'
    `);

    const config = { ...DEFAULT_CONFIG };

    for (const row of rows) {
      switch (row.config_key) {
        case 'propuneri_plati_auto_approve_threshold':
          config.auto_approve_threshold = parseFloat(row.config_value);
          break;
        case 'propuneri_plati_min_score':
          config.min_score = parseFloat(row.config_value);
          break;
        case 'propuneri_plati_expirare_zile':
          config.expirare_zile = parseInt(row.config_value);
          break;
        case 'propuneri_plati_notificare_enabled':
          config.notificare_enabled = row.config_value === 'true';
          break;
        case 'propuneri_plati_cui_score':
          config.cui_score = parseInt(row.config_value);
          break;
        case 'propuneri_plati_valoare_score':
          config.valoare_score = parseInt(row.config_value);
          break;
        case 'propuneri_plati_referinta_score':
          config.referinta_score = parseInt(row.config_value);
          break;
        case 'propuneri_plati_data_score':
          config.data_score = parseInt(row.config_value);
          break;
      }
    }

    // Citim cota TVA din SetariFacturare
    const [tvaRows] = await bigquery.query(`
      SELECT cota_tva_standard
      FROM \`${PROJECT_ID}.${DATASET}.SetariFacturare_v2\`
      LIMIT 1
    `);

    if (tvaRows.length > 0 && tvaRows[0].cota_tva_standard) {
      config.cota_tva = parseInt(tvaRows[0].cota_tva_standard);
    }

    return config;
  } catch (error) {
    console.warn('⚠️ Eroare citire config, folosim default:', error);
    return DEFAULT_CONFIG;
  }
}

// =================================================================
// HELPER: Verificare existență tabel
// =================================================================

async function tableExists(): Promise<boolean> {
  try {
    await bigquery.query(`SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\` LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

// =================================================================
// HELPER: Obține tranzacții plăți candidate
// =================================================================

async function getTranzactiiPlatiCandidate(limit: number = 500): Promise<TranzactiePlataCandidat[]> {
  const propuneriTableExists = await tableExists();

  const excludeClause = propuneriTableExists
    ? `AND NOT EXISTS (
        SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\` p
        WHERE p.tranzactie_id = t.id AND p.status = 'pending'
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
      t.directie = 'iesire'
      AND ABS(t.suma) > 50
      AND (t.matching_tip IS NULL OR t.matching_tip = 'none')
      AND (t.status IS NULL OR t.status NOT IN ('matched', 'ignorat'))
      AND t.data_procesare >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      ${excludeClause}
    ORDER BY t.data_procesare DESC, ABS(t.suma) DESC
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

// =================================================================
// HELPER: Obține facturi primite candidate
// =================================================================

async function getFacturiPrimiteCandidate(): Promise<FacturaPrimitaCandidat[]> {
  const [rows] = await bigquery.query(`
    SELECT
      fp.id,
      fp.serie_numar,
      fp.cif_emitent,
      fp.nume_emitent,
      fp.data_factura,
      fp.valoare_totala,
      fp.valoare_ron,
      fp.moneda,
      fp.status_procesare,
      fp.cheltuiala_asociata_id,
      -- Date cheltuială asociată (dacă există)
      ch.proiect_id as cheltuiala_proiect_id,
      p.Denumire as cheltuiala_proiect_denumire,
      ch.subproiect_id as cheltuiala_subproiect_id,
      sp.Denumire as cheltuiala_subproiect_denumire,
      ch.descriere as cheltuiala_descriere
    FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\` fp
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli_v2\` ch
      ON fp.cheltuiala_asociata_id = ch.id
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.Proiecte_v2\` p
      ON ch.proiect_id = p.ID_Proiect
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte_v2\` sp
      ON ch.subproiect_id = sp.ID_Subproiect
    WHERE
      fp.activ = TRUE
      AND fp.status_procesare NOT IN ('eroare')
      AND fp.valoare_ron > 0
      AND fp.data_factura >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      -- Excludem facturile deja asociate cu tranzacții
      AND NOT EXISTS (
        SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.TranzactiiMatching_v2\` tm
        WHERE tm.target_type = 'factura_primita' AND tm.target_id = fp.id
      )
    ORDER BY fp.data_factura DESC
  `);

  return rows.map((row: any) => ({
    id: row.id,
    serie_numar: row.serie_numar,
    cif_emitent: row.cif_emitent,
    nume_emitent: row.nume_emitent,
    data_factura: row.data_factura,
    valoare_totala: parseFloat(row.valoare_totala) || 0,
    valoare_ron: parseFloat(row.valoare_ron) || 0,
    moneda: row.moneda || 'RON',
    status_procesare: row.status_procesare,
    cheltuiala_asociata_id: row.cheltuiala_asociata_id,
    cheltuiala_proiect_id: row.cheltuiala_proiect_id,
    cheltuiala_proiect_denumire: row.cheltuiala_proiect_denumire,
    cheltuiala_subproiect_id: row.cheltuiala_subproiect_id,
    cheltuiala_subproiect_denumire: row.cheltuiala_subproiect_denumire,
    cheltuiala_descriere: row.cheltuiala_descriere
  }));
}

// =================================================================
// HELPER: Obține cheltuieli candidate (fără factură asociată)
// =================================================================

async function getCheltuieliCandidate(): Promise<CheltuialaCandidat[]> {
  const [rows] = await bigquery.query(`
    SELECT
      ch.id,
      ch.proiect_id,
      p.Denumire as proiect_denumire,
      ch.subproiect_id,
      sp.Denumire as subproiect_denumire,
      ch.tip_cheltuiala,
      ch.furnizor_cui,
      ch.furnizor_nume,
      ch.descriere,
      ch.valoare,
      ch.moneda,
      ch.valoare_ron,
      ch.status_achitare,
      ch.nr_factura_furnizor,
      ch.data_factura_furnizor,
      ch.data_creare
    FROM \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli_v2\` ch
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.Proiecte_v2\` p
      ON ch.proiect_id = p.ID_Proiect
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte_v2\` sp
      ON ch.subproiect_id = sp.ID_Subproiect
    WHERE
      ch.activ = TRUE
      AND ch.status_achitare IN ('Neincasat', 'Partial')
      AND ch.valoare_ron > 0
      AND DATE(ch.data_creare) >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      -- Excludem cheltuielile deja asociate cu tranzacții
      AND NOT EXISTS (
        SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.TranzactiiMatching_v2\` tm
        WHERE tm.target_type = 'cheltuiala' AND tm.target_id = ch.id
      )
      -- Excludem cheltuielile care au factură primită asociată (vor fi matchuite prin factură)
      AND NOT EXISTS (
        SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\` fp
        WHERE fp.cheltuiala_asociata_id = ch.id AND fp.activ = TRUE
      )
    ORDER BY ch.data_creare DESC
  `);

  return rows.map((row: any) => ({
    id: row.id,
    proiect_id: row.proiect_id,
    proiect_denumire: row.proiect_denumire,
    subproiect_id: row.subproiect_id,
    subproiect_denumire: row.subproiect_denumire,
    tip_cheltuiala: row.tip_cheltuiala,
    furnizor_cui: row.furnizor_cui,
    furnizor_nume: row.furnizor_nume,
    descriere: row.descriere,
    valoare: parseFloat(row.valoare) || 0,
    moneda: row.moneda || 'RON',
    valoare_ron: parseFloat(row.valoare_ron) || 0,
    status_achitare: row.status_achitare,
    nr_factura_furnizor: row.nr_factura_furnizor,
    data_factura_furnizor: row.data_factura_furnizor,
    data_creare: row.data_creare
  }));
}

// =================================================================
// HELPER: Convertește la target unificat
// =================================================================

function convertFacturaToTarget(factura: FacturaPrimitaCandidat): TargetPlataUnificat {
  return {
    id: factura.id,
    tip: 'factura_primita',
    furnizor_cui: factura.cif_emitent,
    furnizor_nume: factura.nume_emitent,
    serie_numar: factura.serie_numar,
    data_factura: extractDate(factura.data_factura),
    valoare_cu_tva: factura.valoare_ron || factura.valoare_totala,  // Factura e deja cu TVA
    valoare_fara_tva: (factura.valoare_ron || factura.valoare_totala) / 1.21,  // Estimare
    proiect_id: factura.cheltuiala_proiect_id || null,
    proiect_denumire: factura.cheltuiala_proiect_denumire || null,
    subproiect_id: factura.cheltuiala_subproiect_id || null,
    subproiect_denumire: factura.cheltuiala_subproiect_denumire || null,
    descriere: factura.cheltuiala_descriere || null,
    cheltuiala_asociata_id: factura.cheltuiala_asociata_id
  };
}

function convertCheltuialaToTarget(cheltuiala: CheltuialaCandidat, cotaTva: number): TargetPlataUnificat {
  const valoareCuTva = cheltuiala.valoare_ron * (1 + cotaTva / 100);

  return {
    id: cheltuiala.id,
    tip: 'cheltuiala',
    furnizor_cui: cheltuiala.furnizor_cui,
    furnizor_nume: cheltuiala.furnizor_nume,
    serie_numar: cheltuiala.nr_factura_furnizor,
    data_factura: extractDate(cheltuiala.data_factura_furnizor) || extractDate(cheltuiala.data_creare),
    valoare_cu_tva: valoareCuTva,
    valoare_fara_tva: cheltuiala.valoare_ron,
    proiect_id: cheltuiala.proiect_id,
    proiect_denumire: cheltuiala.proiect_denumire,
    subproiect_id: cheltuiala.subproiect_id,
    subproiect_denumire: cheltuiala.subproiect_denumire,
    descriere: cheltuiala.descriere,
    cheltuiala_asociata_id: null
  };
}

// =================================================================
// HELPER: Salvare propuneri
// =================================================================

async function savePropuneri(propuneri: any[]): Promise<void> {
  if (propuneri.length === 0) return;

  const exists = await tableExists();
  if (!exists) {
    throw new Error(
      'Tabelul PlatiPropuneri_v2 nu există. ' +
      'Rulați scriptul SQL: scripts/plati-propuneri-create-table.sql în BigQuery Console.'
    );
  }

  const table = bigquery.dataset(DATASET).table('PlatiPropuneri_v2');
  await table.insert(propuneri);
}

// =================================================================
// HELPER: Trimitere notificare
// =================================================================

async function sendNotification(stats: { total: number; auto: number; review: number }): Promise<void> {
  if (stats.total === 0) return;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tip_notificare: 'plati_propuneri_noi',
        user_id: ['admin'],
        context: {
          count: stats.total.toString(),
          auto_count: stats.auto.toString(),
          review_count: stats.review.toString(),
          link_detalii: `${baseUrl}/admin/financiar/propuneri-plati`
        }
      })
    });

    console.log(`📧 Notificare trimisă: ${stats.total} propuneri plăți noi`);
  } catch (error) {
    console.error('⚠️ Eroare trimitere notificare:', error);
  }
}

// =================================================================
// POST: Generare propuneri
// =================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      dry_run = false,
      limit = 500,
      send_notification = true
    } = body;

    console.log(`🔍 Începe generare propuneri plăți (dry_run: ${dry_run}, limit: ${limit})`);

    // 1. Citim configurarea
    const config = await getConfig();
    console.log(`⚙️ Config: threshold=${config.auto_approve_threshold}%, min_score=${config.min_score}%, TVA=${config.cota_tva}%`);

    // 2. Obținem candidații
    const tranzactii = await getTranzactiiPlatiCandidate(limit);
    const facturiPrimite = await getFacturiPrimiteCandidate();
    const cheltuieli = await getCheltuieliCandidate();

    console.log(`📊 Candidați: ${tranzactii.length} tranzacții plăți, ${facturiPrimite.length} facturi primite, ${cheltuieli.length} cheltuieli`);

    if (tranzactii.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nu există tranzacții plăți noi pentru procesare',
        propuneri_generate: 0,
        propuneri_auto_approvable: 0,
        propuneri_review: 0,
        tranzactii_procesate: 0
      });
    }

    // 3. Convertim la targets unificate
    // PRIORITATE: Facturi primite > Cheltuieli (conform cerință)
    const targets: TargetPlataUnificat[] = [
      ...facturiPrimite.map(fp => convertFacturaToTarget(fp)),
      ...cheltuieli.map(ch => convertCheltuialaToTarget(ch, config.cota_tva))
    ];

    console.log(`📋 Targets unificate: ${targets.length}`);

    // 4. Procesăm fiecare tranzacție
    const propuneri: any[] = [];
    let autoApprovable = 0;
    let reviewNeeded = 0;

    for (const tranzactie of tranzactii) {
      const match = findBestMatchPlati(tranzactie, targets, config);

      if (match) {
        const { target, score } = match;
        const isAuto = isAutoApprovable(score, config);

        if (isAuto) autoApprovable++;
        else reviewNeeded++;

        const dataTranzactie = extractDate(tranzactie.data_procesare);
        const sumaPlata = Math.abs(tranzactie.suma);

        propuneri.push({
          id: uuidv4(),
          tranzactie_id: tranzactie.id,

          target_type: target.tip,
          factura_primita_id: target.tip === 'factura_primita' ? target.id : null,
          cheltuiala_id: target.tip === 'cheltuiala' ? target.id : null,
          cheltuiala_asociata_din_factura: target.cheltuiala_asociata_id || null,

          score: score.total,
          auto_approvable: isAuto,

          suma_plata: sumaPlata,
          suma_target: target.valoare_fara_tva,
          suma_target_cu_tva: target.valoare_cu_tva,
          diferenta_ron: score.details.diferenta_ron,
          diferenta_procent: score.details.diferenta_procent,

          matching_algorithm: determineMatchingAlgorithm(score),
          referinta_gasita: score.details.referinta_gasita,
          matching_details: JSON.stringify(score),

          status: 'pending',
          motiv_respingere: null,

          furnizor_cui: target.furnizor_cui,
          furnizor_nume: target.furnizor_nume,
          factura_serie_numar: target.serie_numar,
          proiect_id: target.proiect_id,
          proiect_denumire: target.proiect_denumire,
          subproiect_id: target.subproiect_id,
          subproiect_denumire: target.subproiect_denumire,
          cheltuiala_descriere: target.descriere,

          tranzactie_data: dataTranzactie,
          tranzactie_contrapartida: tranzactie.nume_contrapartida,
          tranzactie_cui: tranzactie.cui_contrapartida,
          tranzactie_detalii: (tranzactie.detalii_tranzactie || '').substring(0, 500),

          data_creare: new Date().toISOString(),
          creat_de: 'auto_generate'
        });

        console.log(`✅ Propunere: ${sumaPlata.toFixed(2)} RON → ${target.tip}:${target.serie_numar || target.id.slice(0, 8)} (${score.total}%${isAuto ? ' AUTO' : ''})`);
      }
    }

    // 5. Salvăm propunerile (dacă nu e dry_run)
    if (!dry_run && propuneri.length > 0) {
      await savePropuneri(propuneri);
      console.log(`💾 Salvate ${propuneri.length} propuneri plăți`);

      // 6. Trimitem notificare
      if (send_notification && config.notificare_enabled) {
        await sendNotification({
          total: propuneri.length,
          auto: autoApprovable,
          review: reviewNeeded
        });
      }
    }

    const result: GeneratePropuneriPlatiResult = {
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
        : `${propuneri.length} propuneri plăți generate cu succes`,
      propuneri: dry_run ? propuneri.map(p => ({
        tranzactie_id: p.tranzactie_id,
        target_type: p.target_type,
        factura_primita_id: p.factura_primita_id,
        cheltuiala_id: p.cheltuiala_id,
        furnizor_nume: p.furnizor_nume,
        factura_serie_numar: p.factura_serie_numar,
        suma_plata: p.suma_plata,
        suma_target_cu_tva: p.suma_target_cu_tva,
        score: p.score,
        auto_approvable: p.auto_approvable,
        referinta_gasita: p.referinta_gasita,
        matching_algorithm: p.matching_algorithm
      })) : undefined
    });

  } catch (error: any) {
    console.error('❌ Eroare generare propuneri plăți:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la generarea propunerilor plăți',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// GET pentru preview (dry_run)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');

  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ dry_run: true, limit, send_notification: false }),
    headers: { 'Content-Type': 'application/json' }
  });

  return POST(mockRequest);
}
