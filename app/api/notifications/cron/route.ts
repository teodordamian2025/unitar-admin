// CALEA: /app/api/notifications/cron/route.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: Cron job pentru verificare termene apropiate (proiecte, subproiecte, sarcini)

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import type { NotificareContext } from '@/lib/notifications/types';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini\``;
const TABLE_NOTIFICARI = `\`${PROJECT_ID}.${DATASET}.Notificari${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// Helper pentru extragere dată din object BigQuery
function extractDateValue(date: { value: string } | string | undefined): string | undefined {
  if (!date) return undefined;
  return typeof date === 'object' && 'value' in date ? date.value : date;
}

// =====================================================
// GET: Verifică termene apropiate și trimite notificări
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') === 'true'; // Pentru testare fără trimitere
    const zileAvans = parseInt(searchParams.get('zile_avans') || '7'); // Câte zile înainte să notifice

    console.log(`🔔 Cron notificări termene - START (dry_run: ${dryRun}, zile_avans: ${zileAvans})`);

    const notificariTrimise: string[] = [];
    const baseUrl = request.url.split('/api/')[0];

    // ============================================
    // 1. PROIECTE CU TERMENE APROPIATE
    // ============================================

    const proiecteQuery = `
      SELECT
        ID_Proiect as id,
        Denumire as denumire,
        Client as client,
        Data_Final as data_final,
        Responsabil as responsabil_uid
      FROM ${TABLE_PROIECTE}
      WHERE Data_Final IS NOT NULL
        AND Data_Final BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
        AND Status = 'Activ'
    `;

    const [proiecte] = await bigquery.query({ query: proiecteQuery });
    console.log(`📊 Proiecte cu termene apropiate: ${proiecte.length}`);

    for (const proiect of proiecte) {
      if (!proiect.responsabil_uid) continue;

      const dataFinal = extractDateValue(proiect.data_final);
      const zileRamase = dataFinal ? Math.ceil((new Date(dataFinal).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Verifică dacă nu a fost deja trimisă notificare în ultimele 24h
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM ${TABLE_NOTIFICARI}
        WHERE user_id = @user_id
          AND tip_notificare = 'termen_proiect_aproape'
          AND JSON_EXTRACT_SCALAR(continut_json, '$.proiect_id') = @proiect_id
          AND data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      `;

      const [checkRows] = await bigquery.query({
        query: checkQuery,
        params: {
          user_id: proiect.responsabil_uid,
          proiect_id: proiect.id,
        },
      });

      if (checkRows[0]?.count > 0) {
        console.log(`⏭️ Skip - notificare proiect deja trimisă recent pentru ${proiect.id}`);
        continue;
      }

      // Trimite notificare
      if (!dryRun) {
        try {
          const context: NotificareContext = {
            proiect_id: proiect.id,
            proiect_denumire: proiect.denumire,
            proiect_client: proiect.client,
            proiect_deadline: dataFinal || '',
            zile_ramase: zileRamase,
            user_name: proiect.responsabil_uid,
          };

          const notifyResponse = await fetch(`${baseUrl}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tip_notificare: 'termen_proiect_aproape',
              user_id: proiect.responsabil_uid,
              context,
            }),
          });

          const result = await notifyResponse.json();
          if (result.success) {
            notificariTrimise.push(`Proiect: ${proiect.denumire} (${zileRamase} zile)`);
          }
        } catch (error) {
          console.error(`⚠️ Eroare notificare proiect ${proiect.id}:`, error);
        }
      } else {
        notificariTrimise.push(`[DRY RUN] Proiect: ${proiect.denumire} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 2. SARCINI CU TERMENE APROPIATE
    // ============================================

    const sarciniQuery = `
      SELECT
        s.id as id,
        s.titlu as titlu,
        s.prioritate as prioritate,
        s.data_scadenta as data_scadenta,
        s.proiect_id as proiect_id,
        sr.responsabil_uid as responsabil_uid,
        sr.responsabil_nume as responsabil_nume
      FROM ${TABLE_SARCINI} s
      INNER JOIN \`${PROJECT_ID}.${DATASET}.SarciniResponsabili\` sr ON s.id = sr.sarcina_id
      WHERE s.data_scadenta IS NOT NULL
        AND s.data_scadenta BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
        AND s.status IN ('Neinceput', 'In Progres')
    `;

    const [sarcini] = await bigquery.query({ query: sarciniQuery });
    console.log(`📋 Sarcini cu termene apropiate: ${sarcini.length}`);

    for (const sarcina of sarcini) {
      if (!sarcina.responsabil_uid) continue;

      const dataScadenta = extractDateValue(sarcina.data_scadenta);
      const zileRamase = dataScadenta ? Math.ceil((new Date(dataScadenta).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Verifică dacă nu a fost deja trimisă notificare în ultimele 24h
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM ${TABLE_NOTIFICARI}
        WHERE user_id = @user_id
          AND tip_notificare = 'termen_sarcina_aproape'
          AND JSON_EXTRACT_SCALAR(continut_json, '$.sarcina_id') = @sarcina_id
          AND data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      `;

      const [checkRows] = await bigquery.query({
        query: checkQuery,
        params: {
          user_id: sarcina.responsabil_uid,
          sarcina_id: sarcina.id,
        },
      });

      if (checkRows[0]?.count > 0) {
        console.log(`⏭️ Skip - notificare sarcină deja trimisă recent pentru ${sarcina.id}`);
        continue;
      }

      // Trimite notificare
      if (!dryRun) {
        try {
          const context: NotificareContext = {
            sarcina_id: sarcina.id,
            sarcina_titlu: sarcina.titlu,
            sarcina_prioritate: sarcina.prioritate,
            sarcina_deadline: dataScadenta || '',
            proiect_id: sarcina.proiect_id,
            zile_ramase: zileRamase,
            user_name: sarcina.responsabil_nume,
          };

          const notifyResponse = await fetch(`${baseUrl}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tip_notificare: 'termen_sarcina_aproape',
              user_id: sarcina.responsabil_uid,
              context,
            }),
          });

          const result = await notifyResponse.json();
          if (result.success) {
            notificariTrimise.push(`Sarcină: ${sarcina.titlu} (${zileRamase} zile)`);
          }
        } catch (error) {
          console.error(`⚠️ Eroare notificare sarcină ${sarcina.id}:`, error);
        }
      } else {
        notificariTrimise.push(`[DRY RUN] Sarcină: ${sarcina.titlu} (${zileRamase} zile)`);
      }
    }

    console.log(`✅ Cron notificări termene - FINISH (${notificariTrimise.length} notificări)`);

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      zile_avans: zileAvans,
      proiecte_gasite: proiecte.length,
      sarcini_gasite: sarcini.length,
      notificari_trimise: notificariTrimise.length,
      detalii: notificariTrimise,
    });

  } catch (error: any) {
    console.error('❌ Eroare cron notificări termene:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
