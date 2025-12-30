// ==================================================================
// API MARCARE ÎNCASĂRI FACTURI
// Generat: 09.12.2025
// Cale: app/api/actions/invoices/incasare/route.ts
// FEATURES:
// - Încasare manuală (doar data + observații)
// - Match cu tranzacții bancare existente
// - Actualizare status factură și EtapeFacturi_v2
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateUnifiedMatchScore,
  TranzactieInput,
  FacturaInput,
  CONFIG_MANUAL_MATCH,
  generateMatchDescription,
  getScoreBadge
} from '@/lib/matching/scoring';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES !== 'false';
const tableSuffix = useV2Tables ? '_v2' : '';

// Tabele
const TABLE_FACTURI = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_ETAPE_FACTURI = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;
const TABLE_TRANZACTII_BANCARE = `\`${PROJECT_ID}.${DATASET}.TranzactiiBancare${tableSuffix}\``;
const TABLE_TRANZACTII_MATCHING = `\`${PROJECT_ID}.${DATASET}.TranzactiiMatching${tableSuffix}\``;

console.log(`🔧 Incasare API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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
// GET - Listează tranzacții bancare disponibile pentru match
// ==================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facturaId = searchParams.get('factura_id');
    const toleranta = parseFloat(searchParams.get('toleranta') || '10'); // % toleranță

    if (!facturaId) {
      return NextResponse.json({
        success: false,
        error: 'factura_id este obligatoriu'
      }, { status: 400 });
    }

    // Obținem detalii factură
    const facturaQuery = `
      SELECT
        id, serie, numar, total, valoare_platita, client_cui, client_nume,
        data_factura,
        (total - COALESCE(valoare_platita, 0)) as rest_de_plata
      FROM ${TABLE_FACTURI}
      WHERE id = @facturaId
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura nu a fost găsită'
      }, { status: 404 });
    }

    const factura = facturaRows[0];
    const restDePlata = parseFloat(factura.rest_de_plata) || parseFloat(factura.total) || 0;
    const clientCui = factura.client_cui || '';
    const clientNume = factura.client_nume || '';

    // Căutăm tranzacții bancare neimperecheate de tip "intrare" (încasări)
    // Folosim toleranță mai mare pentru filtrare inițială, apoi scoring unificat
    const minSuma = restDePlata * (1 - Math.max(toleranta, 20) / 100);
    const maxSuma = restDePlata * (1 + Math.max(toleranta, 20) / 100);

    const tranzactiiQuery = `
      SELECT
        t.id,
        t.data_procesare,
        t.suma,
        t.directie,
        t.tip_categorie,
        t.nume_contrapartida,
        t.cui_contrapartida,
        t.detalii_tranzactie,
        t.status,
        t.matching_tip,
        t.referinta_bancii
      FROM ${TABLE_TRANZACTII_BANCARE} t
      WHERE
        t.directie = 'intrare'
        AND (t.matching_tip IS NULL OR t.matching_tip = 'none' OR t.status != 'matched')
        AND t.suma > 0
        AND t.suma BETWEEN @minSuma AND @maxSuma
        AND t.data_procesare >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      ORDER BY
        ABS(t.suma - @restDePlata) ASC,
        t.data_procesare DESC
      LIMIT 100
    `;

    const [tranzactii] = await bigquery.query({
      query: tranzactiiQuery,
      params: {
        restDePlata,
        minSuma,
        maxSuma
      },
      types: {
        restDePlata: 'FLOAT64',
        minSuma: 'FLOAT64',
        maxSuma: 'FLOAT64'
      },
      location: 'EU'
    });

    // Construim obiectul FacturaInput pentru scoring unificat
    const facturaInput: FacturaInput = {
      id: factura.id,
      serie: factura.serie || null,
      numar: factura.numar || '',
      total: parseFloat(factura.total) || 0,
      rest_de_plata: restDePlata,
      client_cui: factura.client_cui || null,
      client_nume: factura.client_nume || '',
      data_factura: factura.data_factura?.value || factura.data_factura || new Date().toISOString().split('T')[0]
    };

    // Calculăm scorul unificat pentru fiecare tranzacție
    const tranzactiiNormalizate = tranzactii.map((t: any) => {
      const tranzactieInput: TranzactieInput = {
        id: t.id,
        suma: parseFloat(t.suma) || 0,
        data_procesare: t.data_procesare,
        nume_contrapartida: t.nume_contrapartida || null,
        cui_contrapartida: t.cui_contrapartida || null,
        detalii_tranzactie: t.detalii_tranzactie || null,
        directie: t.directie
      };

      // Calculăm scorul cu algoritmul unificat (min_score mai mic pentru a afișa mai multe opțiuni)
      const scoreResult = calculateUnifiedMatchScore(tranzactieInput, facturaInput, {
        ...CONFIG_MANUAL_MATCH,
        min_score: 30 // Afișăm și scoruri mai mici pentru selecție manuală
      });

      const sumaTranzactie = parseFloat(t.suma) || 0;
      const badge = getScoreBadge(scoreResult.total);

      return {
        ...t,
        data_procesare: t.data_procesare?.value || t.data_procesare,
        suma: sumaTranzactie,
        matching_score: scoreResult.total,
        diferenta: Math.abs(sumaTranzactie - restDePlata),
        diferenta_procent: restDePlata > 0
          ? Math.abs((sumaTranzactie - restDePlata) / restDePlata * 100)
          : 0,
        // Detalii scoring unificat
        scoring_details: {
          referinta_score: scoreResult.referinta_score,
          cui_score: scoreResult.cui_score,
          suma_score: scoreResult.suma_score,
          timp_score: scoreResult.timp_score,
          referinta_gasita: scoreResult.details.referinta_gasita,
          referinta_confidence: scoreResult.details.referinta_confidence,
          cui_match: scoreResult.details.cui_match,
          matching_algorithm: scoreResult.matching_algorithm,
          matching_description: generateMatchDescription(scoreResult)
        },
        badge_label: badge.label,
        badge_color: badge.color,
        badge_bg: badge.bgColor
      };
    });

    // Sortăm după scor descrescător
    tranzactiiNormalizate.sort((a: any, b: any) => b.matching_score - a.matching_score);

    // Limităm la 50 rezultate
    const tranzactiiFiltrate = tranzactiiNormalizate.slice(0, 50);

    return NextResponse.json({
      success: true,
      factura: {
        id: factura.id,
        serie: factura.serie,
        numar: factura.numar,
        total: parseFloat(factura.total) || 0,
        valoare_platita: parseFloat(factura.valoare_platita) || 0,
        rest_de_plata: restDePlata,
        client_cui: factura.client_cui,
        client_nume: factura.client_nume
      },
      tranzactii: tranzactiiFiltrate,
      metadata: {
        toleranta,
        min_suma: minSuma,
        max_suma: maxSuma,
        total_results: tranzactiiFiltrate.length,
        scoring_algorithm: 'unified_v2',
        note: 'Scoring unificat cu extragere referințe din detalii tranzacție'
      }
    });

  } catch (error: any) {
    console.error('❌ Eroare căutare tranzacții pentru match:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la căutarea tranzacțiilor'
    }, { status: 500 });
  }
}

// ==================================================================
// POST - Marchează încasare (manuală sau cu match tranzacție)
// ==================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      factura_id,
      tip_incasare,  // 'manual' sau 'tranzactie'
      valoare_incasata,
      data_incasare,
      observatii,
      tranzactie_id,  // doar pentru tip_incasare='tranzactie'
      user_id,
      user_name
    } = body;

    // Validări
    if (!factura_id) {
      return NextResponse.json({
        success: false,
        error: 'factura_id este obligatoriu'
      }, { status: 400 });
    }

    if (!tip_incasare || !['manual', 'tranzactie'].includes(tip_incasare)) {
      return NextResponse.json({
        success: false,
        error: 'tip_incasare trebuie să fie "manual" sau "tranzactie"'
      }, { status: 400 });
    }

    if (tip_incasare === 'tranzactie' && !tranzactie_id) {
      return NextResponse.json({
        success: false,
        error: 'tranzactie_id este obligatoriu pentru tip_incasare="tranzactie"'
      }, { status: 400 });
    }

    // Obținem detalii factură
    const facturaQuery = `
      SELECT
        id, serie, numar, total, valoare_platita, client_cui, client_nume,
        proiect_id, status,
        (total - COALESCE(valoare_platita, 0)) as rest_de_plata
      FROM ${TABLE_FACTURI}
      WHERE id = @facturaId
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId: factura_id },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura nu a fost găsită'
      }, { status: 404 });
    }

    const factura = facturaRows[0];
    const restDePlata = parseFloat(factura.rest_de_plata) || parseFloat(factura.total) || 0;
    let sumaIncasata = 0;
    let dataIncasareFinala = data_incasare || new Date().toISOString().split('T')[0];
    let tranzactieInfo: any = null;

    // Determinăm suma în funcție de tipul încasării
    if (tip_incasare === 'tranzactie') {
      // Obținem detalii tranzacție
      const tranzactieQuery = `
        SELECT
          id, suma, data_procesare, nume_contrapartida, cui_contrapartida,
          detalii_tranzactie, status, matching_tip
        FROM ${TABLE_TRANZACTII_BANCARE}
        WHERE id = @tranzactieId
      `;

      const [tranzactiiRows] = await bigquery.query({
        query: tranzactieQuery,
        params: { tranzactieId: tranzactie_id },
        types: { tranzactieId: 'STRING' },
        location: 'EU'
      });

      if (tranzactiiRows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Tranzacția bancară nu a fost găsită'
        }, { status: 404 });
      }

      tranzactieInfo = tranzactiiRows[0];

      // Verificăm dacă tranzacția nu e deja folosită
      if (tranzactieInfo.matching_tip &&
          tranzactieInfo.matching_tip !== 'none' &&
          tranzactieInfo.status === 'matched') {
        return NextResponse.json({
          success: false,
          error: 'Această tranzacție bancară este deja asociată cu o altă factură'
        }, { status: 400 });
      }

      sumaIncasata = parseFloat(tranzactieInfo.suma) || 0;
      dataIncasareFinala = tranzactieInfo.data_procesare?.value ||
                          tranzactieInfo.data_procesare ||
                          dataIncasareFinala;
    } else {
      // Încasare manuală
      if (!valoare_incasata || valoare_incasata <= 0) {
        return NextResponse.json({
          success: false,
          error: 'valoare_incasata este obligatorie și trebuie să fie pozitivă'
        }, { status: 400 });
      }
      sumaIncasata = parseFloat(valoare_incasata);
    }

    // Verificăm să nu depășească restul de plată
    if (sumaIncasata > restDePlata * 1.05) { // toleranță 5% pentru diferențe de curs
      return NextResponse.json({
        success: false,
        error: `Suma încasată (${sumaIncasata.toFixed(2)} RON) depășește restul de plată (${restDePlata.toFixed(2)} RON)`
      }, { status: 400 });
    }

    // Calculăm noua valoare plătită și noul status
    const valoarePlatitaVeche = parseFloat(factura.valoare_platita) || 0;
    const valoarePlatitaNoua = valoarePlatitaVeche + sumaIncasata;
    const totalFactura = parseFloat(factura.total) || 0;

    let newStatus = 'activa';
    if (valoarePlatitaNoua >= totalFactura * 0.99) { // toleranță 1% pentru rotunjiri
      newStatus = 'platita';
    } else if (valoarePlatitaNoua > 0) {
      newStatus = 'partial_platita';
    }

    // === ACTUALIZARE FACTURĂ ===
    const updateFacturaQuery = `
      UPDATE ${TABLE_FACTURI}
      SET
        valoare_platita = @valoarePlatita,
        status = @status,
        data_plata = CASE WHEN @status = 'platita' THEN TIMESTAMP(@dataIncasare) ELSE data_plata END,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: updateFacturaQuery,
      params: {
        valoarePlatita: valoarePlatitaNoua,
        status: newStatus,
        dataIncasare: dataIncasareFinala,
        facturaId: factura_id
      },
      types: {
        valoarePlatita: 'NUMERIC',
        status: 'STRING',
        dataIncasare: 'STRING',
        facturaId: 'STRING'
      },
      location: 'EU'
    });

    // === ACTUALIZARE ETAPE FACTURI ===
    const statusIncasare = newStatus === 'platita' ? 'Incasat' :
                          (valoarePlatitaNoua > 0 ? 'Partial' : 'Neincasat');

    const observatiiText = `[${new Date().toISOString().split('T')[0]}] Încasare ${tip_incasare}: ${sumaIncasata.toFixed(2)} RON${observatii ? ' - ' + observatii : ''}`;

    const updateEtapeQuery = `
      UPDATE ${TABLE_ETAPE_FACTURI}
      SET
        status_incasare = @statusIncasare,
        data_incasare = CASE WHEN @statusIncasare = 'Incasat' THEN DATE(@dataIncasare) ELSE data_incasare END,
        valoare_incasata = COALESCE(valoare_incasata, 0) + @sumaProrata,
        observatii = CONCAT(COALESCE(observatii, ''), '\\n', @observatiiText),
        data_actualizare = CURRENT_TIMESTAMP(),
        actualizat_de = @userId
      WHERE factura_id = @facturaId AND activ = TRUE
    `;

    // Calculăm suma prorata (proporțional cu valoare_ron din etape)
    const sumaProrata = totalFactura > 0 ? sumaIncasata : 0;

    await bigquery.query({
      query: updateEtapeQuery,
      params: {
        statusIncasare,
        dataIncasare: dataIncasareFinala,
        sumaProrata,
        observatiiText,
        userId: user_id || 'system',
        facturaId: factura_id
      },
      types: {
        statusIncasare: 'STRING',
        dataIncasare: 'STRING',
        sumaProrata: 'NUMERIC',
        observatiiText: 'STRING',
        userId: 'STRING',
        facturaId: 'STRING'
      },
      location: 'EU'
    });

    // === ACTUALIZARE TRANZACȚIE BANCARĂ (dacă e cazul) ===
    if (tip_incasare === 'tranzactie' && tranzactie_id) {
      // Actualizăm tranzacția ca "matched"
      const updateTranzactieQuery = `
        UPDATE ${TABLE_TRANZACTII_BANCARE}
        SET
          matching_tip = 'manual_factura',
          matching_confidence = 100,
          matched_factura_id = @facturaId,
          status = 'matched',
          processed = TRUE,
          data_actualizare = CURRENT_TIMESTAMP(),
          actualizat_de = @userId
        WHERE id = @tranzactieId
      `;

      await bigquery.query({
        query: updateTranzactieQuery,
        params: {
          facturaId: factura_id,
          userId: user_id || 'system',
          tranzactieId: tranzactie_id
        },
        types: {
          facturaId: 'STRING',
          userId: 'STRING',
          tranzactieId: 'STRING'
        },
        location: 'EU'
      });

      // Inserăm în TranzactiiMatching_v2 pentru audit
      const matchingId = uuidv4();
      const insertMatchingQuery = `
        INSERT INTO ${TABLE_TRANZACTII_MATCHING} (
          id, tranzactie_id, target_type, target_id, target_details,
          confidence_score, matching_algorithm,
          suma_tranzactie, suma_target, suma_target_ron,
          diferenta_ron, diferenta_procent, moneda_target,
          matching_details, status, data_creare, creat_de
        ) VALUES (
          @id, @tranzactieId, 'factura', @facturaId, PARSE_JSON(@targetDetails),
          100, 'manual_factura_match',
          @sumaIncasata, @totalFactura, @totalFactura,
          @diferentaRon, @diferentaProcent, 'RON',
          PARSE_JSON(@matchingDetails), 'active', CURRENT_TIMESTAMP(), @userId
        )
      `;

      await bigquery.query({
        query: insertMatchingQuery,
        params: {
          id: matchingId,
          tranzactieId: tranzactie_id,
          facturaId: factura_id,
          targetDetails: JSON.stringify({
            serie: factura.serie,
            numar: factura.numar,
            client_nume: factura.client_nume,
            client_cui: factura.client_cui,
            total: totalFactura
          }),
          sumaIncasata,
          totalFactura,
          diferentaRon: Math.abs(sumaIncasata - restDePlata),
          diferentaProcent: restDePlata > 0 ? Math.abs((sumaIncasata - restDePlata) / restDePlata * 100) : 0,
          matchingDetails: JSON.stringify({
            tip_incasare: 'manual_factura_match',
            observatii: observatii || '',
            matched_by: user_name || user_id || 'system'
          }),
          userId: user_id || 'system'
        },
        types: {
          id: 'STRING',
          tranzactieId: 'STRING',
          facturaId: 'STRING',
          targetDetails: 'STRING',
          sumaIncasata: 'NUMERIC',
          totalFactura: 'NUMERIC',
          diferentaRon: 'NUMERIC',
          diferentaProcent: 'NUMERIC',
          matchingDetails: 'STRING',
          userId: 'STRING'
        },
        location: 'EU'
      });
    }

    // Construim răspunsul
    const numarComplet = factura.serie ? `${factura.serie}-${factura.numar}` : factura.numar;

    console.log(`✅ Încasare înregistrată pentru factura ${numarComplet}: ${sumaIncasata.toFixed(2)} RON (${tip_incasare})`);

    return NextResponse.json({
      success: true,
      message: `Încasare de ${sumaIncasata.toFixed(2)} RON înregistrată cu succes`,
      factura: {
        id: factura_id,
        numar_complet: numarComplet,
        total: totalFactura,
        valoare_platita_noua: valoarePlatitaNoua,
        rest_de_plata_nou: Math.max(0, totalFactura - valoarePlatitaNoua),
        status_nou: newStatus
      },
      incasare: {
        tip: tip_incasare,
        valoare: sumaIncasata,
        data: dataIncasareFinala,
        tranzactie_id: tranzactie_id || null,
        observatii: observatii || null
      }
    });

  } catch (error: any) {
    console.error('❌ Eroare marcare încasare:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la înregistrarea încasării'
    }, { status: 500 });
  }
}
