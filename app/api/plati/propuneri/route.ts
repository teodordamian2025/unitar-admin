// =================================================================
// API: CRUD Propuneri Plăți
// GET /api/plati/propuneri - Lista propuneri
// POST /api/plati/propuneri - Aprobare/Respingere propuneri
// Data: 2026-01-01
// =================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

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
// GET: Lista propuneri cu filtre
// =================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const autoOnly = searchParams.get('auto_only') === 'true';
    const minScore = parseFloat(searchParams.get('min_score') || '0');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeStats = searchParams.get('include_stats') !== 'false';

    // Construim WHERE clause
    const conditions: string[] = [];

    if (status !== 'all') {
      conditions.push(`pp.status = '${status}'`);
    }

    if (autoOnly) {
      conditions.push('pp.auto_approvable = TRUE');
    }

    if (minScore > 0) {
      conditions.push(`pp.score >= ${minScore}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query principal
    const query = `
      SELECT
        pp.*,
        -- Verificăm validitatea
        CASE
          WHEN pp.target_type = 'factura_primita' THEN (
            SELECT COUNT(*) = 0
            FROM \`${PROJECT_ID}.${DATASET}.TranzactiiMatching_v2\` tm
            WHERE tm.target_type = 'factura_primita' AND tm.target_id = pp.factura_primita_id
          )
          WHEN pp.target_type = 'cheltuiala' THEN (
            SELECT ch.status_achitare IN ('Neincasat', 'Partial')
            FROM \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli_v2\` ch
            WHERE ch.id = pp.cheltuiala_id
          )
          ELSE FALSE
        END as is_target_valid,
        -- Verificăm tranzacția
        tb.status as tranzactie_status,
        tb.matching_tip as tranzactie_matching_tip,
        CASE
          WHEN tb.matching_tip IS NOT NULL AND tb.matching_tip != 'none' THEN FALSE
          WHEN tb.status = 'matched' THEN FALSE
          ELSE TRUE
        END as is_tranzactie_valid
      FROM \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\` pp
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\` tb
        ON pp.tranzactie_id = tb.id
      ${whereClause}
      ORDER BY pp.auto_approvable DESC, pp.score DESC, pp.data_creare DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [rows] = await bigquery.query(query);

    // Procesăm rezultatele
    const propuneri = rows.map((row: any) => ({
      ...row,
      // Parsăm matching_details dacă e string
      matching_details: typeof row.matching_details === 'string'
        ? JSON.parse(row.matching_details)
        : row.matching_details,
      // Flag validitate combinat
      is_valid: row.is_target_valid && row.is_tranzactie_valid,
      // Normalizăm datele BigQuery
      tranzactie_data: row.tranzactie_data?.value || row.tranzactie_data
    }));

    // Statistici (opțional)
    let stats: {
      total: number;
      pending: number;
      auto_approvable: number;
      review_needed: number;
      approved: number;
      rejected: number;
      expired: number;
    } | null = null;
    if (includeStats) {
      const [statsRows] = await bigquery.query(`
        SELECT
          COUNT(*) as total,
          COUNTIF(status = 'pending') as pending,
          COUNTIF(status = 'pending' AND auto_approvable = TRUE) as auto_approvable,
          COUNTIF(status = 'pending' AND auto_approvable = FALSE) as review_needed,
          COUNTIF(status = 'approved') as approved,
          COUNTIF(status = 'rejected') as rejected,
          COUNTIF(status = 'expired') as expired
        FROM \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\`
      `);

      if (statsRows.length > 0) {
        stats = {
          total: parseInt(statsRows[0].total) || 0,
          pending: parseInt(statsRows[0].pending) || 0,
          auto_approvable: parseInt(statsRows[0].auto_approvable) || 0,
          review_needed: parseInt(statsRows[0].review_needed) || 0,
          approved: parseInt(statsRows[0].approved) || 0,
          rejected: parseInt(statsRows[0].rejected) || 0,
          expired: parseInt(statsRows[0].expired) || 0
        };
      }
    }

    return NextResponse.json({
      success: true,
      propuneri,
      stats,
      pagination: { limit, offset, count: propuneri.length }
    });

  } catch (error: any) {
    console.error('❌ Eroare GET propuneri plăți:', error);

    // Dacă tabelul nu există, returnăm array gol
    if (error.message?.includes('Not found')) {
      return NextResponse.json({
        success: true,
        propuneri: [],
        stats: {
          total: 0,
          pending: 0,
          auto_approvable: 0,
          review_needed: 0,
          approved: 0,
          rejected: 0,
          expired: 0
        },
        pagination: { limit: 100, offset: 0, count: 0 }
      });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la încărcarea propunerilor'
    }, { status: 500 });
  }
}

// =================================================================
// POST: Aprobare/Respingere propuneri
// =================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      propunere_id,
      propunere_ids,
      motiv_respingere,
      user_id = 'admin',
      user_name = 'Admin'
    } = body;

    if (!action || !['approve', 'reject', 'approve_all'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Acțiune invalidă. Folosiți: approve, reject, approve_all'
      }, { status: 400 });
    }

    // ===================
    // APPROVE ALL (auto-aprobabile)
    // ===================
    if (action === 'approve_all') {
      // Obținem toate propunerile auto-aprobabile și valide
      const [propuneriRows] = await bigquery.query(`
        SELECT pp.*
        FROM \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\` pp
        INNER JOIN \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\` tb
          ON pp.tranzactie_id = tb.id
        WHERE
          pp.status = 'pending'
          AND pp.auto_approvable = TRUE
          AND (tb.matching_tip IS NULL OR tb.matching_tip = 'none')
          AND tb.status != 'matched'
      `);

      let approvedCount = 0;
      const errors: string[] = [];

      for (const propunere of propuneriRows) {
        try {
          await applyPropunere(propunere, user_id, user_name);
          approvedCount++;
        } catch (err: any) {
          errors.push(`${propunere.id}: ${err.message}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: `${approvedCount} propuneri aprobate`,
        approved: approvedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    // ===================
    // APPROVE/REJECT INDIVIDUAL
    // ===================
    const ids = propunere_ids || (propunere_id ? [propunere_id] : []);

    if (ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'propunere_id sau propunere_ids este obligatoriu'
      }, { status: 400 });
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        // Obținem propunerea
        const [propuneriRows] = await bigquery.query(`
          SELECT * FROM \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\`
          WHERE id = '${id}'
        `);

        if (propuneriRows.length === 0) {
          errors.push(`${id}: Propunerea nu a fost găsită`);
          continue;
        }

        const propunere = propuneriRows[0];

        if (propunere.status !== 'pending') {
          errors.push(`${id}: Propunerea nu mai este în stare pending`);
          continue;
        }

        if (action === 'approve') {
          await applyPropunere(propunere, user_id, user_name);
        } else if (action === 'reject') {
          await rejectPropunere(id, motiv_respingere || 'Respins de admin', user_id);
        }

        processedCount++;
      } catch (err: any) {
        errors.push(`${id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: processedCount > 0,
      message: action === 'approve'
        ? `${processedCount} propuneri aprobate`
        : `${processedCount} propuneri respinse`,
      processed: processedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ Eroare POST propuneri plăți:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la procesarea propunerii'
    }, { status: 500 });
  }
}

// =================================================================
// HELPER: Aplicare propunere (aprobare)
// =================================================================

async function applyPropunere(propunere: any, userId: string, userName: string): Promise<void> {
  const sumaPlata = Math.abs(propunere.suma_plata);

  // 1. Inserăm în TranzactiiMatching_v2
  const matchingRecord = {
    id: crypto.randomUUID(),
    tranzactie_id: propunere.tranzactie_id,
    target_type: propunere.target_type,
    target_id: propunere.target_type === 'factura_primita' ? propunere.factura_primita_id : propunere.cheltuiala_id,
    target_details: propunere.matching_details || '{}',
    confidence_score: propunere.score,
    matching_algorithm: propunere.matching_algorithm || 'propunere_plati',
    suma_tranzactie: sumaPlata,
    suma_target: propunere.suma_target,
    suma_target_ron: propunere.suma_target_cu_tva,
    diferenta_ron: propunere.diferenta_ron,
    diferenta_procent: propunere.diferenta_procent,
    moneda_target: 'RON',
    status: 'active',
    validated_by: userId,
    data_creare: new Date().toISOString(),
    creat_de: 'propunere_plati'
  };

  const matchingTable = bigquery.dataset(DATASET).table('TranzactiiMatching_v2');
  await matchingTable.insert([matchingRecord]);

  // 2. Actualizăm tranzacția
  await bigquery.query(`
    UPDATE \`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\`
    SET
      matching_tip = 'propunere_plati',
      matching_confidence = ${propunere.score},
      matched_cheltuiala_id = ${propunere.cheltuiala_id ? `'${propunere.cheltuiala_id}'` : 'NULL'},
      status = 'matched',
      processed = TRUE,
      data_actualizare = CURRENT_TIMESTAMP()
    WHERE id = '${propunere.tranzactie_id}'
  `);

  // 3. Actualizăm target-ul (factură sau cheltuială)
  if (propunere.target_type === 'factura_primita') {
    // Actualizăm factura primită
    await bigquery.query(`
      UPDATE \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
      SET
        status_procesare = 'asociat',
        data_asociere = CURRENT_TIMESTAMP(),
        observatii = CONCAT(COALESCE(observatii, ''), ' | Plată asociată: ', '${sumaPlata}', ' RON')
      WHERE id = '${propunere.factura_primita_id}'
    `);

    // Dacă factura are cheltuială asociată, actualizăm și cheltuiala
    if (propunere.cheltuiala_asociata_din_factura) {
      await bigquery.query(`
        UPDATE \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli_v2\`
        SET
          status_achitare = 'Incasat',
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = '${propunere.cheltuiala_asociata_din_factura}'
      `);
    }
  } else if (propunere.target_type === 'cheltuiala') {
    // Actualizăm cheltuiala
    await bigquery.query(`
      UPDATE \`${PROJECT_ID}.${DATASET}.ProiecteCheltuieli_v2\`
      SET
        status_achitare = 'Incasat',
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = '${propunere.cheltuiala_id}'
    `);
  }

  // 4. Actualizăm propunerea
  await bigquery.query(`
    UPDATE \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\`
    SET
      status = 'approved',
      data_aprobare = CURRENT_TIMESTAMP(),
      aprobat_de = '${userId}'
    WHERE id = '${propunere.id}'
  `);

  console.log(`✅ Propunere plată aprobată: ${propunere.id} (${sumaPlata} RON → ${propunere.target_type})`);
}

// =================================================================
// HELPER: Respingere propunere
// =================================================================

async function rejectPropunere(propunereId: string, motiv: string, userId: string): Promise<void> {
  await bigquery.query(`
    UPDATE \`${PROJECT_ID}.${DATASET}.PlatiPropuneri_v2\`
    SET
      status = 'rejected',
      motiv_respingere = '${motiv.replace(/'/g, "''")}',
      data_respingere = CURRENT_TIMESTAMP(),
      respins_de = '${userId}'
    WHERE id = '${propunereId}'
  `);

  console.log(`❌ Propunere plată respinsă: ${propunereId}`);
}
