// =================================================================
// API: Listare și Gestionare Propuneri Încasări
// GET /api/incasari/propuneri - Lista propuneri
// POST /api/incasari/propuneri - Aprobare/Respingere
// Generat: 2025-12-17
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

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
// GET - Lista propuneri cu filtre
// =================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parametri filtrare
    const status = searchParams.get('status') || 'pending';
    const auto_only = searchParams.get('auto_only') === 'true';
    const min_score = parseInt(searchParams.get('min_score') || '0');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const include_stats = searchParams.get('include_stats') !== 'false';

    // Construim query
    let whereConditions = ['1=1'];

    if (status && status !== 'all') {
      whereConditions.push(`p.status = '${status}'`);
    }

    if (auto_only) {
      whereConditions.push('p.auto_approvable = TRUE');
    }

    if (min_score > 0) {
      whereConditions.push(`p.score >= ${min_score}`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Query principal - suportă atât facturi interne (FacturiGenerate) cât și externe (FacturiEmiseANAF)
    const [propuneri] = await bigquery.query(`
      SELECT
        p.*,
        -- Date suplimentare factură internă (FacturiGenerate_v2)
        fg.status as factura_status_curent,
        fg.valoare_platita as factura_valoare_platita_curent,
        -- Date suplimentare factură externă (FacturiEmiseANAF_v2)
        fe.status_achitare as factura_anaf_status_curent,
        fe.valoare_platita as factura_anaf_valoare_platita_curent,
        -- Date suplimentare tranzacție
        tb.status as tranzactie_status_curent,
        tb.matching_tip as tranzactie_matching_curent
      FROM \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\` p
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\` fg ON p.factura_id = fg.id AND COALESCE(p.factura_sursa, 'facturi_generate') = 'facturi_generate'
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\` fe ON p.factura_id = fe.id AND p.factura_sursa = 'facturi_emise_anaf'
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\` tb ON p.tranzactie_id = tb.id
      WHERE ${whereClause}
      ORDER BY
        p.auto_approvable DESC,
        p.score DESC,
        p.data_creare DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    // Normalizăm datele
    const propuneriNormalizate = propuneri.map((p: any) => {
      // Determinăm validitatea în funcție de sursa facturii
      const facturaSursa = p.factura_sursa || 'facturi_generate';
      let facturaValida = true;

      if (facturaSursa === 'facturi_emise_anaf') {
        // Pentru facturi externe, verificăm status_achitare
        facturaValida = p.factura_anaf_status_curent !== 'Incasat';
      } else {
        // Pentru facturi interne, verificăm status
        facturaValida = p.factura_status_curent !== 'platita' &&
                        p.factura_status_curent !== 'anulata' &&
                        p.factura_status_curent !== 'storno' &&
                        p.factura_status_curent !== 'stornata';
      }

      const tranzactieValida = p.tranzactie_matching_curent === null ||
                               p.tranzactie_matching_curent === 'none';

      return {
        ...p,
        score: parseFloat(p.score) || 0,
        suma_tranzactie: parseFloat(p.suma_tranzactie) || 0,
        suma_factura: parseFloat(p.suma_factura) || 0,
        rest_de_plata: parseFloat(p.rest_de_plata) || 0,
        diferenta_ron: parseFloat(p.diferenta_ron) || 0,
        diferenta_procent: parseFloat(p.diferenta_procent) || 0,
        tranzactie_data: p.tranzactie_data?.value || p.tranzactie_data,
        data_creare: p.data_creare,
        matching_details: typeof p.matching_details === 'string'
          ? JSON.parse(p.matching_details)
          : p.matching_details,
        // Flag pentru validitate (tranzacția/factura nu au fost deja procesate)
        is_valid: facturaValida && tranzactieValida
      };
    });

    // Statistici opționale
    let stats: any = null;
    if (include_stats) {
      const [statsRows] = await bigquery.query(`
        SELECT
          COUNT(*) as total,
          COUNTIF(status = 'pending') as pending,
          COUNTIF(status = 'pending' AND auto_approvable = TRUE) as auto_approvable,
          COUNTIF(status = 'pending' AND auto_approvable = FALSE) as review_needed,
          COUNTIF(status = 'approved') as approved,
          COUNTIF(status = 'rejected') as rejected
        FROM \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\`
      `);

      stats = {
        total: parseInt(statsRows[0]?.total) || 0,
        pending: parseInt(statsRows[0]?.pending) || 0,
        auto_approvable: parseInt(statsRows[0]?.auto_approvable) || 0,
        review_needed: parseInt(statsRows[0]?.review_needed) || 0,
        approved: parseInt(statsRows[0]?.approved) || 0,
        rejected: parseInt(statsRows[0]?.rejected) || 0
      };
    }

    return NextResponse.json({
      success: true,
      propuneri: propuneriNormalizate,
      stats,
      pagination: {
        limit,
        offset,
        total: propuneriNormalizate.length,
        has_more: propuneriNormalizate.length === limit
      }
    });

  } catch (error: any) {
    console.error('❌ Eroare listare propuneri:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la listarea propunerilor'
    }, { status: 500 });
  }
}

// =================================================================
// POST - Aprobare sau Respingere propuneri
// =================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action, // 'approve' | 'reject' | 'approve_all'
      propunere_id, // pentru approve/reject individual
      propunere_ids, // pentru batch
      motiv_respingere,
      user_id,
      user_name
    } = body;

    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'action este obligatoriu (approve/reject/approve_all)'
      }, { status: 400 });
    }

    // ==================== APPROVE ALL ====================
    if (action === 'approve_all') {
      return await approveAll(user_id, user_name);
    }

    // ==================== APPROVE/REJECT INDIVIDUAL sau BATCH ====================
    const ids = propunere_ids || (propunere_id ? [propunere_id] : []);

    if (ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'propunere_id sau propunere_ids este obligatoriu'
      }, { status: 400 });
    }

    if (action === 'approve') {
      return await approveMultiple(ids, user_id, user_name);
    } else if (action === 'reject') {
      return await rejectMultiple(ids, motiv_respingere, user_id, user_name);
    }

    return NextResponse.json({
      success: false,
      error: 'action invalid (approve/reject/approve_all)'
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ Eroare procesare propunere:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la procesarea propunerii'
    }, { status: 500 });
  }
}

// =================================================================
// FUNCȚII HELPER
// =================================================================

/**
 * Aprobă toate propunerile auto-aprobabile
 * Suportă atât facturi interne (FacturiGenerate) cât și externe (FacturiEmiseANAF)
 */
async function approveAll(userId: string, userName: string) {
  // Obținem propunerile auto-aprobabile care sunt încă valide
  // Verificăm validitatea în funcție de sursa facturii
  const [propuneri] = await bigquery.query(`
    SELECT p.id
    FROM \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\` p
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\` fg
      ON p.factura_id = fg.id AND COALESCE(p.factura_sursa, 'facturi_generate') = 'facturi_generate'
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\` fe
      ON p.factura_id = fe.id AND p.factura_sursa = 'facturi_emise_anaf'
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\` tb
      ON p.tranzactie_id = tb.id
    WHERE
      p.status = 'pending'
      AND p.auto_approvable = TRUE
      -- Tranzacția nu e deja matched
      AND (tb.matching_tip IS NULL OR tb.matching_tip = 'none')
      -- Factura validă în funcție de sursa
      AND (
        -- Facturi interne: status nu e platita/anulata
        (COALESCE(p.factura_sursa, 'facturi_generate') = 'facturi_generate'
         AND fg.status NOT IN ('platita', 'anulata', 'storno', 'stornata'))
        OR
        -- Facturi externe: status_achitare nu e Incasat
        (p.factura_sursa = 'facturi_emise_anaf'
         AND fe.status_achitare != 'Incasat')
      )
  `);

  if (propuneri.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Nu există propuneri auto-aprobabile',
      approved_count: 0
    });
  }

  const ids = propuneri.map((p: any) => p.id);
  return await approveMultiple(ids, userId, userName);
}

/**
 * Aprobă multiple propuneri
 */
async function approveMultiple(ids: string[], userId: string, userName: string) {
  const results = {
    success: true,
    approved: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const id of ids) {
    try {
      await approveSingle(id, userId, userName);
      results.approved++;
    } catch (error: any) {
      results.failed++;
      results.errors.push(`${id}: ${error.message}`);
    }
  }

  results.success = results.failed === 0;

  return NextResponse.json({
    ...results,
    message: `${results.approved} propuneri aprobate${results.failed > 0 ? `, ${results.failed} eșuate` : ''}`
  });
}

/**
 * Aproba o singura propunere si aplica incasarea
 * Suporta atat facturi din FacturiGenerate_v2 cat si din FacturiEmiseANAF_v2
 */
async function approveSingle(propunereId: string, userId: string, userName: string) {
  // 1. Obtinem propunerea cu detalii (incl. sursa)
  const [propuneriRows] = await bigquery.query(`
    SELECT p.*,
      COALESCE(fg.total, fe.valoare_ron, fe.valoare_totala) as factura_total,
      COALESCE(fg.valoare_platita, fe.valoare_platita, 0) as factura_platita_existenta,
      COALESCE(p.factura_sursa, 'facturi_generate') as factura_sursa_calc
    FROM \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\` p
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\` fg ON p.factura_id = fg.id
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\` fe ON p.factura_id = fe.id
    WHERE p.id = '${propunereId}'
  `);

  if (propuneriRows.length === 0) {
    throw new Error('Propunerea nu a fost gasita');
  }

  const propunere = propuneriRows[0];

  if (propunere.status !== 'pending') {
    throw new Error(`Propunerea are deja status: ${propunere.status}`);
  }

  const sumaTranzactie = parseFloat(propunere.suma_tranzactie) || 0;
  const facturaTotal = parseFloat(propunere.factura_total) || 0;
  const facturaPlatita = parseFloat(propunere.factura_platita_existenta) || 0;
  const nouaValoarePlatita = facturaPlatita + sumaTranzactie;
  const facturaSursa = propunere.factura_sursa_calc || propunere.factura_sursa || 'facturi_generate';

  // Calculam noul status
  let newFacturaStatus = 'activa';
  let newStatusAchitare = 'Neincasat';
  if (nouaValoarePlatita >= facturaTotal * 0.99) {
    newFacturaStatus = 'platita';
    newStatusAchitare = 'Incasat';
  } else if (nouaValoarePlatita > 0) {
    newFacturaStatus = 'partial_platita';
    newStatusAchitare = 'Partial';
  }

  const dataTranzactie = propunere.tranzactie_data?.value || propunere.tranzactie_data || new Date().toISOString().split('T')[0];

  // 2. Actualizam factura in functie de sursa
  if (facturaSursa === 'facturi_emise_anaf') {
    // Factura externa din FacturiEmiseANAF_v2
    await bigquery.query(`
      UPDATE \`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\`
      SET
        valoare_platita = ${nouaValoarePlatita},
        status_achitare = '${newStatusAchitare}',
        data_ultima_plata = CURRENT_TIMESTAMP(),
        matched_tranzactie_id = '${propunere.tranzactie_id}',
        matching_tip = 'auto_propunere'
      WHERE id = '${propunere.factura_id}'
    `);
    console.log(`📝 [Propuneri] Actualizat FacturiEmiseANAF_v2: ${propunere.factura_id}`);
  } else {
    // Factura interna din FacturiGenerate_v2
    await bigquery.query(`
      UPDATE \`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\`
      SET
        valoare_platita = ${nouaValoarePlatita},
        status = '${newFacturaStatus}',
        data_plata = ${newFacturaStatus === 'platita' ? `TIMESTAMP('${dataTranzactie}')` : 'data_plata'},
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = '${propunere.factura_id}'
    `);

    // Actualizam si EtapeFacturi pentru facturi interne
    const statusIncasare = newFacturaStatus === 'platita' ? 'Incasat' :
      (nouaValoarePlatita > 0 ? 'Partial' : 'Neincasat');

    await bigquery.query(`
      UPDATE \`${PROJECT_ID}.${DATASET}.EtapeFacturi_v2\`
      SET
        status_incasare = '${statusIncasare}',
        data_incasare = ${statusIncasare === 'Incasat' ? `DATE('${dataTranzactie}')` : 'data_incasare'},
        valoare_incasata = COALESCE(valoare_incasata, 0) + ${sumaTranzactie},
        observatii = CONCAT(COALESCE(observatii, ''), '\\n[${new Date().toISOString().split('T')[0]}] Incasare automata: ${sumaTranzactie.toFixed(2)} RON (propunere #${propunereId.substring(0, 8)})'),
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE factura_id = '${propunere.factura_id}' AND activ = TRUE
    `);

    // Sincronizam si FacturiEmiseANAF_v2 (daca exista legatura prin factura_generata_id)
    await bigquery.query(`
      UPDATE \`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\`
      SET
        valoare_platita = ${nouaValoarePlatita},
        status_achitare = '${newStatusAchitare}',
        data_ultima_plata = CURRENT_TIMESTAMP(),
        matched_tranzactie_id = '${propunere.tranzactie_id}',
        matching_tip = 'sync_propunere_aprobata'
      WHERE factura_generata_id = '${propunere.factura_id}'
    `);
    console.log(`📝 [Propuneri] Sincronizat FacturiEmiseANAF_v2 pentru factura_generata_id=${propunere.factura_id}`);
  }

  // 3. Actualizam tranzactia bancara
  await bigquery.query(`
    UPDATE \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
    SET
      matching_tip = 'auto_propunere',
      matching_confidence = ${propunere.score},
      matched_factura_id = '${propunere.factura_id}',
      status = 'matched',
      processed = TRUE,
      data_actualizare = CURRENT_TIMESTAMP(),
      actualizat_de = '${userId || 'system'}'
    WHERE id = '${propunere.tranzactie_id}'
  `);

  // 5. Inserăm în TranzactiiMatching_v2
  const matchingId = uuidv4();
  const targetType = facturaSursa === 'facturi_emise_anaf' ? 'factura_emisa_anaf' : 'factura';

  await bigquery.query(`
    INSERT INTO \`${PROJECT_ID}.${DATASET}.TranzactiiMatching_v2\` (
      id, tranzactie_id, target_type, target_id, target_details,
      confidence_score, matching_algorithm,
      suma_tranzactie, suma_target, suma_target_ron,
      diferenta_ron, diferenta_procent, moneda_target,
      matching_details, status, data_creare, creat_de
    ) VALUES (
      '${matchingId}',
      '${propunere.tranzactie_id}',
      '${targetType}',
      '${propunere.factura_id}',
      JSON '${JSON.stringify({
    serie: propunere.factura_serie,
    numar: propunere.factura_numar,
    client_nume: propunere.factura_client_nume,
    sursa: facturaSursa
  })}',
      ${propunere.score},
      '${propunere.matching_algorithm || 'auto_propunere'}',
      ${sumaTranzactie},
      ${facturaTotal},
      ${propunere.rest_de_plata},
      ${propunere.diferenta_ron || 0},
      ${propunere.diferenta_procent || 0},
      'RON',
      JSON '${JSON.stringify({
    propunere_id: propunereId,
    approved_by: userName || userId || 'system',
    referinta_gasita: propunere.referinta_gasita,
    factura_sursa: facturaSursa
  })}',
      'active',
      CURRENT_TIMESTAMP(),
      '${userId || 'system'}'
    )
  `);

  // 6. Actualizăm propunerea ca aprobată
  await bigquery.query(`
    UPDATE \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\`
    SET
      status = 'approved',
      data_aprobare = CURRENT_TIMESTAMP(),
      aprobat_de = '${userId || 'system'}'
    WHERE id = '${propunereId}'
  `);

  const sursaLabel = facturaSursa === 'facturi_emise_anaf' ? '[ANAF Externa]' : '[Generata]';
  console.log(`✅ Propunere ${propunereId} aprobată: ${sumaTranzactie.toFixed(2)} RON → ${propunere.factura_serie || ''}-${propunere.factura_numar} ${sursaLabel}`);
}

/**
 * Respinge multiple propuneri
 */
async function rejectMultiple(ids: string[], motiv: string, userId: string, userName: string) {
  const idsList = ids.map(id => `'${id}'`).join(',');
  const motivSanitizat = (motiv || 'Respins de admin').replace(/'/g, "''");

  await bigquery.query(`
    UPDATE \`${PROJECT_ID}.${DATASET}.IncasariPropuneri_v2\`
    SET
      status = 'rejected',
      motiv_respingere = '${motivSanitizat}',
      data_respingere = CURRENT_TIMESTAMP(),
      respins_de = '${userId || 'system'}'
    WHERE id IN (${idsList}) AND status = 'pending'
  `);

  return NextResponse.json({
    success: true,
    message: `${ids.length} propuneri respinse`,
    rejected_count: ids.length
  });
}
