// ==================================================================
// API MARCARE INCASARI FACTURI EMISE ANAF
// Generat: 2026-01-08
// Cale: app/api/iapp/facturi-emise/incasare/route.ts
// FEATURES:
// - Incasare manuala sau match cu tranzactii bancare
// - Suport facturi interne (legate de FacturiGenerate) si externe (FGO etc)
// - Actualizare status in FacturiEmiseANAF_v2 si FacturiGenerate_v2 (daca exista)
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

// Tabele
const TABLE_FACTURI_EMISE = `\`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF_v2\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate_v2\``;
const TABLE_ETAPE_FACTURI = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi_v2\``;
const TABLE_TRANZACTII_BANCARE = `\`${PROJECT_ID}.${DATASET}.TranzactiiBancare_v2\``;
const TABLE_TRANZACTII_MATCHING = `\`${PROJECT_ID}.${DATASET}.TranzactiiMatching_v2\``;

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
// GET - Listeaza tranzactii bancare disponibile pentru match
// ==================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facturaEmisaId = searchParams.get('factura_emisa_id');
    const toleranta = parseFloat(searchParams.get('toleranta') || '10');

    if (!facturaEmisaId) {
      return NextResponse.json({
        success: false,
        error: 'factura_emisa_id este obligatoriu'
      }, { status: 400 });
    }

    // Obtinem detalii factura emisa
    const facturaQuery = `
      SELECT
        fe.id,
        fe.serie_numar,
        fe.valoare_totala,
        fe.valoare_ron,
        fe.moneda,
        fe.cif_client,
        fe.nume_client,
        fe.data_factura,
        fe.factura_generata_id,
        COALESCE(fe.valoare_platita, 0) as valoare_platita,
        COALESCE(fe.status_achitare, 'Neincasat') as status_achitare,
        -- Calculam rest de plata in RON
        COALESCE(fe.valoare_ron, fe.valoare_totala) - COALESCE(fe.valoare_platita, 0) as rest_de_plata
      FROM ${TABLE_FACTURI_EMISE} fe
      WHERE fe.id = @facturaId
        AND fe.activ = TRUE
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId: facturaEmisaId },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura nu a fost gasita'
      }, { status: 404 });
    }

    const factura = facturaRows[0];
    const restDePlata = parseFloat(factura.rest_de_plata) || parseFloat(factura.valoare_ron) || parseFloat(factura.valoare_totala) || 0;

    if (restDePlata <= 0) {
      return NextResponse.json({
        success: true,
        factura: {
          id: factura.id,
          serie_numar: factura.serie_numar,
          valoare_totala: parseFloat(factura.valoare_totala) || 0,
          valoare_ron: parseFloat(factura.valoare_ron) || parseFloat(factura.valoare_totala) || 0,
          valoare_platita: parseFloat(factura.valoare_platita) || 0,
          rest_de_plata: 0,
          status_achitare: factura.status_achitare,
          cif_client: factura.cif_client,
          nume_client: factura.nume_client
        },
        tranzactii: [],
        metadata: {
          message: 'Factura este deja achitata integral'
        }
      });
    }

    // Cautam tranzactii bancare neimperecheate
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
      params: { restDePlata, minSuma, maxSuma },
      types: { restDePlata: 'FLOAT64', minSuma: 'FLOAT64', maxSuma: 'FLOAT64' },
      location: 'EU'
    });

    // Parsam serie si numar din serie_numar
    let serieFactura: string | null = null;
    let numarFactura: string = '';
    if (factura.serie_numar) {
      const parts = factura.serie_numar.split(/[-\/]/);
      if (parts.length >= 2) {
        serieFactura = parts[0];
        numarFactura = parts.slice(1).join('-');
      } else {
        numarFactura = factura.serie_numar;
      }
    }

    // Construim FacturaInput pentru scoring
    const facturaInput: FacturaInput = {
      id: factura.id,
      serie: serieFactura,
      numar: numarFactura,
      total: parseFloat(factura.valoare_ron) || parseFloat(factura.valoare_totala) || 0,
      rest_de_plata: restDePlata,
      client_cui: factura.cif_client || null,
      client_nume: factura.nume_client || '',
      data_factura: factura.data_factura?.value || factura.data_factura || new Date().toISOString().split('T')[0]
    };

    // Calculam scorul pentru fiecare tranzactie
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

      const scoreResult = calculateUnifiedMatchScore(tranzactieInput, facturaInput, {
        ...CONFIG_MANUAL_MATCH,
        min_score: 30
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

    // Sortam dupa scor descrescator
    tranzactiiNormalizate.sort((a: any, b: any) => b.matching_score - a.matching_score);

    // Limitam la 50 rezultate
    const tranzactiiFiltrate = tranzactiiNormalizate.slice(0, 50);

    return NextResponse.json({
      success: true,
      factura: {
        id: factura.id,
        serie_numar: factura.serie_numar,
        serie: serieFactura,
        numar: numarFactura,
        valoare_totala: parseFloat(factura.valoare_totala) || 0,
        valoare_ron: parseFloat(factura.valoare_ron) || parseFloat(factura.valoare_totala) || 0,
        valoare_platita: parseFloat(factura.valoare_platita) || 0,
        rest_de_plata: restDePlata,
        status_achitare: factura.status_achitare,
        cif_client: factura.cif_client,
        nume_client: factura.nume_client,
        factura_generata_id: factura.factura_generata_id
      },
      tranzactii: tranzactiiFiltrate,
      metadata: {
        toleranta,
        min_suma: minSuma,
        max_suma: maxSuma,
        total_results: tranzactiiFiltrate.length,
        scoring_algorithm: 'unified_v2'
      }
    });

  } catch (error: any) {
    console.error('Eroare cautare tranzactii pentru match:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la cautarea tranzactiilor'
    }, { status: 500 });
  }
}

// ==================================================================
// POST - Marcheaza incasare (manuala sau cu match tranzactie)
// ==================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      factura_emisa_id,
      tip_incasare,       // 'manual' sau 'tranzactie'
      valoare_incasata,
      data_incasare,
      observatii,
      tranzactie_id,      // doar pentru tip_incasare='tranzactie'
      user_id,
      user_name
    } = body;

    // Validari
    if (!factura_emisa_id) {
      return NextResponse.json({
        success: false,
        error: 'factura_emisa_id este obligatoriu'
      }, { status: 400 });
    }

    if (!tip_incasare || !['manual', 'tranzactie'].includes(tip_incasare)) {
      return NextResponse.json({
        success: false,
        error: 'tip_incasare trebuie sa fie "manual" sau "tranzactie"'
      }, { status: 400 });
    }

    if (tip_incasare === 'tranzactie' && !tranzactie_id) {
      return NextResponse.json({
        success: false,
        error: 'tranzactie_id este obligatoriu pentru tip_incasare="tranzactie"'
      }, { status: 400 });
    }

    // Obtinem detalii factura emisa
    const facturaQuery = `
      SELECT
        fe.id,
        fe.serie_numar,
        fe.valoare_totala,
        fe.valoare_ron,
        fe.moneda,
        fe.cif_client,
        fe.nume_client,
        fe.data_factura,
        fe.factura_generata_id,
        COALESCE(fe.valoare_platita, 0) as valoare_platita,
        COALESCE(fe.status_achitare, 'Neincasat') as status_achitare,
        COALESCE(fe.valoare_ron, fe.valoare_totala) - COALESCE(fe.valoare_platita, 0) as rest_de_plata
      FROM ${TABLE_FACTURI_EMISE} fe
      WHERE fe.id = @facturaId
        AND fe.activ = TRUE
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId: factura_emisa_id },
      types: { facturaId: 'STRING' },
      location: 'EU'
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura nu a fost gasita'
      }, { status: 404 });
    }

    const factura = facturaRows[0];
    const restDePlata = parseFloat(factura.rest_de_plata) || 0;
    const totalFactura = parseFloat(factura.valoare_ron) || parseFloat(factura.valoare_totala) || 0;

    let sumaIncasata = 0;
    let dataIncasareFinala = data_incasare || new Date().toISOString().split('T')[0];
    let tranzactieInfo: any = null;

    // Determinam suma in functie de tipul incasarii
    if (tip_incasare === 'tranzactie') {
      // Obtinem detalii tranzactie
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
          error: 'Tranzactia bancara nu a fost gasita'
        }, { status: 404 });
      }

      tranzactieInfo = tranzactiiRows[0];

      // Verificam daca tranzactia nu e deja folosita
      if (tranzactieInfo.matching_tip &&
          tranzactieInfo.matching_tip !== 'none' &&
          tranzactieInfo.status === 'matched') {
        return NextResponse.json({
          success: false,
          error: 'Aceasta tranzactie bancara este deja asociata cu o alta factura'
        }, { status: 400 });
      }

      sumaIncasata = parseFloat(tranzactieInfo.suma) || 0;
      dataIncasareFinala = tranzactieInfo.data_procesare?.value ||
                          tranzactieInfo.data_procesare ||
                          dataIncasareFinala;
    } else {
      // Incasare manuala
      if (!valoare_incasata || valoare_incasata <= 0) {
        return NextResponse.json({
          success: false,
          error: 'valoare_incasata este obligatorie si trebuie sa fie pozitiva'
        }, { status: 400 });
      }
      sumaIncasata = parseFloat(valoare_incasata);
    }

    // Verificam sa nu depaseasca restul de plata (cu toleranta 5%)
    if (sumaIncasata > restDePlata * 1.05) {
      return NextResponse.json({
        success: false,
        error: `Suma incasata (${sumaIncasata.toFixed(2)} RON) depaseste restul de plata (${restDePlata.toFixed(2)} RON)`
      }, { status: 400 });
    }

    // Calculam noua valoare platita si noul status
    const valoarePlatitaVeche = parseFloat(factura.valoare_platita) || 0;
    const valoarePlatitaNoua = valoarePlatitaVeche + sumaIncasata;

    let newStatusAchitare = 'Neincasat';
    if (valoarePlatitaNoua >= totalFactura * 0.99) {
      newStatusAchitare = 'Incasat';
    } else if (valoarePlatitaNoua > 0) {
      newStatusAchitare = 'Partial';
    }

    // === ACTUALIZARE FACTURI EMISE ANAF ===
    const updateFacturaEmisaQuery = `
      UPDATE ${TABLE_FACTURI_EMISE}
      SET
        valoare_platita = @valoarePlatita,
        status_achitare = @statusAchitare,
        data_ultima_plata = CURRENT_TIMESTAMP(),
        matched_tranzactie_id = CASE WHEN @tipIncasare = 'tranzactie' THEN @tranzactieId ELSE matched_tranzactie_id END,
        matching_tip = CASE WHEN @tipIncasare = 'tranzactie' THEN 'manual_factura_emisa' ELSE matching_tip END,
        observatii = CONCAT(COALESCE(observatii, ''), '\\n[', CURRENT_DATE(), '] Incasare ', @tipIncasare, ': ', CAST(@sumaIncasata AS STRING), ' RON')
      WHERE id = @facturaId
    `;

    await bigquery.query({
      query: updateFacturaEmisaQuery,
      params: {
        valoarePlatita: valoarePlatitaNoua,
        statusAchitare: newStatusAchitare,
        tipIncasare: tip_incasare,
        tranzactieId: tranzactie_id || null,
        sumaIncasata,
        facturaId: factura_emisa_id
      },
      types: {
        valoarePlatita: 'FLOAT64',
        statusAchitare: 'STRING',
        tipIncasare: 'STRING',
        tranzactieId: 'STRING',
        sumaIncasata: 'FLOAT64',
        facturaId: 'STRING'
      },
      location: 'EU'
    });

    // === ACTUALIZARE FACTURI GENERATE (daca exista legatura) ===
    if (factura.factura_generata_id) {
      let newStatusFacturaGenerata = 'activa';
      if (valoarePlatitaNoua >= totalFactura * 0.99) {
        newStatusFacturaGenerata = 'platita';
      } else if (valoarePlatitaNoua > 0) {
        newStatusFacturaGenerata = 'partial_platita';
      }

      const updateFacturaGenerataQuery = `
        UPDATE ${TABLE_FACTURI_GENERATE}
        SET
          valoare_platita = @valoarePlatita,
          status = @status,
          data_plata = CASE WHEN @status = 'platita' THEN TIMESTAMP(@dataIncasare) ELSE data_plata END,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @facturaId
      `;

      await bigquery.query({
        query: updateFacturaGenerataQuery,
        params: {
          valoarePlatita: valoarePlatitaNoua,
          status: newStatusFacturaGenerata,
          dataIncasare: dataIncasareFinala,
          facturaId: factura.factura_generata_id
        },
        types: {
          valoarePlatita: 'NUMERIC',
          status: 'STRING',
          dataIncasare: 'STRING',
          facturaId: 'STRING'
        },
        location: 'EU'
      });

      // Actualizam si EtapeFacturi_v2
      const statusIncasareEtape = newStatusFacturaGenerata === 'platita' ? 'Incasat' :
                                (valoarePlatitaNoua > 0 ? 'Partial' : 'Neincasat');

      const updateEtapeQuery = `
        UPDATE ${TABLE_ETAPE_FACTURI}
        SET
          status_incasare = @statusIncasare,
          data_incasare = CASE WHEN @statusIncasare = 'Incasat' THEN DATE(@dataIncasare) ELSE data_incasare END,
          valoare_incasata = COALESCE(valoare_incasata, 0) + @sumaIncasata,
          observatii = CONCAT(COALESCE(observatii, ''), '\\n[', CURRENT_DATE(), '] Incasare din Facturi Emise ANAF: ', CAST(@sumaIncasata AS STRING), ' RON'),
          data_actualizare = CURRENT_TIMESTAMP(),
          actualizat_de = @userId
        WHERE factura_id = @facturaId AND activ = TRUE
      `;

      await bigquery.query({
        query: updateEtapeQuery,
        params: {
          statusIncasare: statusIncasareEtape,
          dataIncasare: dataIncasareFinala,
          sumaIncasata,
          userId: user_id || 'system',
          facturaId: factura.factura_generata_id
        },
        types: {
          statusIncasare: 'STRING',
          dataIncasare: 'STRING',
          sumaIncasata: 'NUMERIC',
          userId: 'STRING',
          facturaId: 'STRING'
        },
        location: 'EU'
      });
    }

    // === ACTUALIZARE TRANZACTIE BANCARA (daca e cazul) ===
    if (tip_incasare === 'tranzactie' && tranzactie_id) {
      const updateTranzactieQuery = `
        UPDATE ${TABLE_TRANZACTII_BANCARE}
        SET
          matching_tip = 'manual_factura_emisa',
          matching_confidence = 100,
          matched_factura_id = @facturaGenerataId,
          status = 'matched',
          processed = TRUE,
          data_actualizare = CURRENT_TIMESTAMP(),
          actualizat_de = @userId,
          matching_metadata = PARSE_JSON(@matchingMetadata)
        WHERE id = @tranzactieId
      `;

      await bigquery.query({
        query: updateTranzactieQuery,
        params: {
          facturaGenerataId: factura.factura_generata_id || factura_emisa_id,
          userId: user_id || 'system',
          tranzactieId: tranzactie_id,
          matchingMetadata: JSON.stringify({
            factura_emisa_id: factura_emisa_id,
            factura_generata_id: factura.factura_generata_id,
            tip: 'factura_emisa_anaf'
          })
        },
        types: {
          facturaGenerataId: 'STRING',
          userId: 'STRING',
          tranzactieId: 'STRING',
          matchingMetadata: 'STRING'
        },
        location: 'EU'
      });

      // Inseram in TranzactiiMatching_v2 pentru audit
      const matchingId = uuidv4();
      const insertMatchingQuery = `
        INSERT INTO ${TABLE_TRANZACTII_MATCHING} (
          id, tranzactie_id, target_type, target_id, target_details,
          confidence_score, matching_algorithm,
          suma_tranzactie, suma_target, suma_target_ron,
          diferenta_ron, diferenta_procent, moneda_target,
          matching_details, status, data_creare, creat_de
        ) VALUES (
          @id, @tranzactieId, 'factura_emisa_anaf', @facturaId, PARSE_JSON(@targetDetails),
          100, 'manual_factura_emisa_match',
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
          facturaId: factura_emisa_id,
          targetDetails: JSON.stringify({
            serie_numar: factura.serie_numar,
            nume_client: factura.nume_client,
            cif_client: factura.cif_client,
            total: totalFactura,
            factura_generata_id: factura.factura_generata_id
          }),
          sumaIncasata,
          totalFactura,
          diferentaRon: Math.abs(sumaIncasata - restDePlata),
          diferentaProcent: restDePlata > 0 ? Math.abs((sumaIncasata - restDePlata) / restDePlata * 100) : 0,
          matchingDetails: JSON.stringify({
            tip_incasare: 'manual_factura_emisa_match',
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

    console.log(`Incasare inregistrata pentru factura ${factura.serie_numar}: ${sumaIncasata.toFixed(2)} RON (${tip_incasare})`);

    return NextResponse.json({
      success: true,
      message: `Incasare de ${sumaIncasata.toFixed(2)} RON inregistrata cu succes`,
      factura: {
        id: factura_emisa_id,
        serie_numar: factura.serie_numar,
        total: totalFactura,
        valoare_platita_noua: valoarePlatitaNoua,
        rest_de_plata_nou: Math.max(0, totalFactura - valoarePlatitaNoua),
        status_achitare_nou: newStatusAchitare,
        factura_generata_id: factura.factura_generata_id
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
    console.error('Eroare marcare incasare factura emisa:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la inregistrarea incasarii'
    }, { status: 500 });
  }
}
