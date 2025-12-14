// CALEA: /app/api/notifications/cron/route.ts
// DATA: 05.10.2025 (ora României) - ACTUALIZAT: 14.12.2025
// DESCRIERE: Cron job pentru verificare termene apropiate ȘI DEPĂȘITE (proiecte, subproiecte, sarcini)

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import type { NotificareContext } from '@/lib/notifications/types';

// Force dynamic rendering for this route (fixes DynamicServerError)
export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate - FORȚAT _v2 pentru toate tabelele
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ CORECT: Toate tabelele folosesc sufixul _v2
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;
const TABLE_SARCINI_RESPONSABILI = `\`${PROJECT_ID}.${DATASET}.SarciniResponsabili${tableSuffix}\``;
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

// Helper pentru calcul zile diferență
function calculeazaZileDiferenta(dataTarget: string | undefined): { zileRamase: number; zileIntarziere: number } {
  if (!dataTarget) return { zileRamase: 0, zileIntarziere: 0 };

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Resetăm la începutul zilei
  const target = new Date(dataTarget);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  const diffZile = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffZile >= 0) {
    return { zileRamase: diffZile, zileIntarziere: 0 };
  } else {
    return { zileRamase: 0, zileIntarziere: Math.abs(diffZile) };
  }
}

// Helper generic pentru trimitere notificare
async function trimitereNotificare(
  baseUrl: string,
  tipNotificare: string,
  userId: string,
  context: NotificareContext,
  dryRun: boolean
): Promise<{ success: boolean; message: string }> {
  if (dryRun) {
    return { success: true, message: `[DRY RUN] ${tipNotificare}` };
  }

  try {
    const notifyResponse = await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tip_notificare: tipNotificare,
        user_id: userId,
        context,
      }),
    });

    const result = await notifyResponse.json();
    return { success: result.success, message: result.success ? 'OK' : result.error };
  } catch (error: any) {
    console.error(`⚠️ Eroare trimitere ${tipNotificare}:`, error);
    return { success: false, message: error.message };
  }
}

// Helper pentru verificare notificare deja trimisă
async function notificareTrimisaRecent(
  userId: string,
  tipNotificare: string,
  entityField: string,
  entityId: string
): Promise<boolean> {
  const checkQuery = `
    SELECT COUNT(*) as count
    FROM ${TABLE_NOTIFICARI}
    WHERE user_id = @user_id
      AND tip_notificare = @tip_notificare
      AND JSON_EXTRACT_SCALAR(continut_json, '$.${entityField}') = @entity_id
      AND data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  `;

  const [checkRows] = await bigquery.query({
    query: checkQuery,
    params: {
      user_id: userId,
      tip_notificare: tipNotificare,
      entity_id: entityId,
    },
  });

  return (checkRows[0]?.count || 0) > 0;
}

// =====================================================
// GET: Verifică termene apropiate ȘI DEPĂȘITE
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') === 'true';
    const zileAvans = parseInt(searchParams.get('zile_avans') || '7');

    console.log(`🔔 Cron notificări termene - START (dry_run: ${dryRun}, zile_avans: ${zileAvans}, tables: ${tableSuffix || 'legacy'})`);

    const notificariTrimise: string[] = [];
    const baseUrl = request.url.split('/api/')[0];

    // Statistici
    let stats = {
      proiecte_apropiate: 0,
      proiecte_depasite: 0,
      subproiecte_apropiate: 0,
      subproiecte_depasite: 0,
      sarcini_apropiate: 0,
      sarcini_depasite: 0,
    };

    // ============================================
    // 1. PROIECTE CU TERMENE APROPIATE
    // ============================================

    const proiecteApropiateQuery = `
      SELECT
        ID_Proiect as id,
        Denumire as denumire,
        Client as client,
        Data_Final as data_final,
        Responsabil as responsabil_uid,
        progres_procent
      FROM ${TABLE_PROIECTE}
      WHERE Data_Final IS NOT NULL
        AND Data_Final BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
        AND Status = 'Activ'
        AND (progres_procent IS NULL OR progres_procent < 100)
    `;

    const [proiecteApropiate] = await bigquery.query({ query: proiecteApropiateQuery });
    stats.proiecte_apropiate = proiecteApropiate.length;
    console.log(`📊 Proiecte cu termene apropiate: ${proiecteApropiate.length}`);

    for (const proiect of proiecteApropiate) {
      if (!proiect.responsabil_uid) continue;

      const dataFinal = extractDateValue(proiect.data_final);
      const { zileRamase } = calculeazaZileDiferenta(dataFinal);

      const dejaTrimisa = await notificareTrimisaRecent(
        proiect.responsabil_uid,
        'termen_proiect_aproape',
        'proiect_id',
        proiect.id
      );

      if (dejaTrimisa) {
        console.log(`⏭️ Skip - notificare proiect aproape deja trimisă recent pentru ${proiect.id}`);
        continue;
      }

      const context: NotificareContext = {
        proiect_id: proiect.id,
        proiect_denumire: proiect.denumire,
        proiect_client: proiect.client,
        proiect_deadline: dataFinal || '',
        zile_ramase: zileRamase,
        user_name: proiect.responsabil_uid,
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${proiect.id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_proiect_aproape',
        proiect.responsabil_uid,
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Proiect aproape: ${proiect.denumire} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 2. PROIECTE CU TERMENE DEPĂȘITE
    // ============================================

    const proiecteDepasiteQuery = `
      SELECT
        ID_Proiect as id,
        Denumire as denumire,
        Client as client,
        Data_Final as data_final,
        Responsabil as responsabil_uid,
        progres_procent
      FROM ${TABLE_PROIECTE}
      WHERE Data_Final IS NOT NULL
        AND Data_Final < CURRENT_DATE()
        AND Status = 'Activ'
        AND (progres_procent IS NULL OR progres_procent < 100)
    `;

    const [proiecteDepasite] = await bigquery.query({ query: proiecteDepasiteQuery });
    stats.proiecte_depasite = proiecteDepasite.length;
    console.log(`📊 Proiecte cu termene depășite: ${proiecteDepasite.length}`);

    for (const proiect of proiecteDepasite) {
      if (!proiect.responsabil_uid) continue;

      const dataFinal = extractDateValue(proiect.data_final);
      const { zileIntarziere } = calculeazaZileDiferenta(dataFinal);

      const dejaTrimisa = await notificareTrimisaRecent(
        proiect.responsabil_uid,
        'termen_proiect_depasit',
        'proiect_id',
        proiect.id
      );

      if (dejaTrimisa) {
        console.log(`⏭️ Skip - notificare proiect depășit deja trimisă recent pentru ${proiect.id}`);
        continue;
      }

      const context: NotificareContext = {
        proiect_id: proiect.id,
        proiect_denumire: proiect.denumire,
        proiect_client: proiect.client,
        proiect_deadline: dataFinal || '',
        zile_intarziere: zileIntarziere,
        user_name: proiect.responsabil_uid,
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${proiect.id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_proiect_depasit',
        proiect.responsabil_uid,
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Proiect DEPĂȘIT: ${proiect.denumire} (${zileIntarziere} zile întârziere)`);
      }
    }

    // ============================================
    // 3. SUBPROIECTE CU TERMENE APROPIATE
    // ============================================

    const subproiecteApropiateQuery = `
      SELECT
        sp.ID_Subproiect as id,
        sp.Denumire as denumire,
        sp.ID_Proiect as proiect_id,
        sp.Data_Final as data_final,
        sp.Responsabil as responsabil_uid,
        sp.progres_procent,
        p.Denumire as proiect_denumire
      FROM ${TABLE_SUBPROIECTE} sp
      LEFT JOIN ${TABLE_PROIECTE} p ON sp.ID_Proiect = p.ID_Proiect
      WHERE sp.Data_Final IS NOT NULL
        AND sp.Data_Final BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
        AND sp.Status = 'Activ'
        AND (sp.progres_procent IS NULL OR sp.progres_procent < 100)
        AND sp.activ = true
    `;

    const [subproiecteApropiate] = await bigquery.query({ query: subproiecteApropiateQuery });
    stats.subproiecte_apropiate = subproiecteApropiate.length;
    console.log(`📊 Subproiecte cu termene apropiate: ${subproiecteApropiate.length}`);

    for (const subproiect of subproiecteApropiate) {
      if (!subproiect.responsabil_uid) continue;

      const dataFinal = extractDateValue(subproiect.data_final);
      const { zileRamase } = calculeazaZileDiferenta(dataFinal);

      const dejaTrimisa = await notificareTrimisaRecent(
        subproiect.responsabil_uid,
        'termen_subproiect_aproape',
        'subproiect_id',
        subproiect.id
      );

      if (dejaTrimisa) {
        console.log(`⏭️ Skip - notificare subproiect aproape deja trimisă recent pentru ${subproiect.id}`);
        continue;
      }

      const context: NotificareContext = {
        subproiect_id: subproiect.id,
        subproiect_denumire: subproiect.denumire,
        proiect_id: subproiect.proiect_id,
        proiect_denumire: subproiect.proiect_denumire,
        proiect_deadline: dataFinal || '',
        zile_ramase: zileRamase,
        user_name: subproiect.responsabil_uid,
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${subproiect.proiect_id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_subproiect_aproape',
        subproiect.responsabil_uid,
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Subproiect aproape: ${subproiect.denumire} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 4. SUBPROIECTE CU TERMENE DEPĂȘITE
    // ============================================

    const subproiecteDepasiteQuery = `
      SELECT
        sp.ID_Subproiect as id,
        sp.Denumire as denumire,
        sp.ID_Proiect as proiect_id,
        sp.Data_Final as data_final,
        sp.Responsabil as responsabil_uid,
        sp.progres_procent,
        p.Denumire as proiect_denumire
      FROM ${TABLE_SUBPROIECTE} sp
      LEFT JOIN ${TABLE_PROIECTE} p ON sp.ID_Proiect = p.ID_Proiect
      WHERE sp.Data_Final IS NOT NULL
        AND sp.Data_Final < CURRENT_DATE()
        AND sp.Status = 'Activ'
        AND (sp.progres_procent IS NULL OR sp.progres_procent < 100)
        AND sp.activ = true
    `;

    const [subproiecteDepasite] = await bigquery.query({ query: subproiecteDepasiteQuery });
    stats.subproiecte_depasite = subproiecteDepasite.length;
    console.log(`📊 Subproiecte cu termene depășite: ${subproiecteDepasite.length}`);

    for (const subproiect of subproiecteDepasite) {
      if (!subproiect.responsabil_uid) continue;

      const dataFinal = extractDateValue(subproiect.data_final);
      const { zileIntarziere } = calculeazaZileDiferenta(dataFinal);

      const dejaTrimisa = await notificareTrimisaRecent(
        subproiect.responsabil_uid,
        'termen_subproiect_depasit',
        'subproiect_id',
        subproiect.id
      );

      if (dejaTrimisa) {
        console.log(`⏭️ Skip - notificare subproiect depășit deja trimisă recent pentru ${subproiect.id}`);
        continue;
      }

      const context: NotificareContext = {
        subproiect_id: subproiect.id,
        subproiect_denumire: subproiect.denumire,
        proiect_id: subproiect.proiect_id,
        proiect_denumire: subproiect.proiect_denumire,
        proiect_deadline: dataFinal || '',
        zile_intarziere: zileIntarziere,
        user_name: subproiect.responsabil_uid,
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${subproiect.proiect_id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_subproiect_depasit',
        subproiect.responsabil_uid,
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Subproiect DEPĂȘIT: ${subproiect.denumire} (${zileIntarziere} zile întârziere)`);
      }
    }

    // ============================================
    // 5. SARCINI CU TERMENE APROPIATE
    // ============================================

    const sarciniApropiateQuery = `
      SELECT
        s.id as id,
        s.titlu as titlu,
        s.prioritate as prioritate,
        s.data_scadenta as data_scadenta,
        s.proiect_id as proiect_id,
        s.progres_procent as progres_procent,
        sr.responsabil_uid as responsabil_uid,
        sr.responsabil_nume as responsabil_nume
      FROM ${TABLE_SARCINI} s
      INNER JOIN ${TABLE_SARCINI_RESPONSABILI} sr ON s.id = sr.sarcina_id
      WHERE s.data_scadenta IS NOT NULL
        AND s.data_scadenta BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
        AND s.status IN ('Neinceput', 'In Progres')
        AND (s.progres_procent IS NULL OR s.progres_procent < 100)
    `;

    const [sarciniApropiate] = await bigquery.query({ query: sarciniApropiateQuery });
    stats.sarcini_apropiate = sarciniApropiate.length;
    console.log(`📋 Sarcini cu termene apropiate: ${sarciniApropiate.length}`);

    for (const sarcina of sarciniApropiate) {
      if (!sarcina.responsabil_uid) continue;

      const dataScadenta = extractDateValue(sarcina.data_scadenta);
      const { zileRamase } = calculeazaZileDiferenta(dataScadenta);

      const dejaTrimisa = await notificareTrimisaRecent(
        sarcina.responsabil_uid,
        'termen_sarcina_aproape',
        'sarcina_id',
        sarcina.id
      );

      if (dejaTrimisa) {
        console.log(`⏭️ Skip - notificare sarcină aproape deja trimisă recent pentru ${sarcina.id}`);
        continue;
      }

      const context: NotificareContext = {
        sarcina_id: sarcina.id,
        sarcina_titlu: sarcina.titlu,
        sarcina_prioritate: sarcina.prioritate,
        sarcina_deadline: dataScadenta || '',
        proiect_id: sarcina.proiect_id,
        zile_ramase: zileRamase,
        user_name: sarcina.responsabil_nume,
        link_detalii: `${baseUrl}/admin/rapoarte/sarcini?id=${sarcina.id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_sarcina_aproape',
        sarcina.responsabil_uid,
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Sarcină aproape: ${sarcina.titlu} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 6. SARCINI CU TERMENE DEPĂȘITE
    // ============================================

    const sarciniDepasiteQuery = `
      SELECT
        s.id as id,
        s.titlu as titlu,
        s.prioritate as prioritate,
        s.data_scadenta as data_scadenta,
        s.proiect_id as proiect_id,
        s.progres_procent as progres_procent,
        sr.responsabil_uid as responsabil_uid,
        sr.responsabil_nume as responsabil_nume
      FROM ${TABLE_SARCINI} s
      INNER JOIN ${TABLE_SARCINI_RESPONSABILI} sr ON s.id = sr.sarcina_id
      WHERE s.data_scadenta IS NOT NULL
        AND s.data_scadenta < CURRENT_DATE()
        AND s.status IN ('Neinceput', 'In Progres')
        AND (s.progres_procent IS NULL OR s.progres_procent < 100)
    `;

    const [sarciniDepasite] = await bigquery.query({ query: sarciniDepasiteQuery });
    stats.sarcini_depasite = sarciniDepasite.length;
    console.log(`📋 Sarcini cu termene depășite: ${sarciniDepasite.length}`);

    for (const sarcina of sarciniDepasite) {
      if (!sarcina.responsabil_uid) continue;

      const dataScadenta = extractDateValue(sarcina.data_scadenta);
      const { zileIntarziere } = calculeazaZileDiferenta(dataScadenta);

      const dejaTrimisa = await notificareTrimisaRecent(
        sarcina.responsabil_uid,
        'termen_sarcina_depasita',
        'sarcina_id',
        sarcina.id
      );

      if (dejaTrimisa) {
        console.log(`⏭️ Skip - notificare sarcină depășită deja trimisă recent pentru ${sarcina.id}`);
        continue;
      }

      const context: NotificareContext = {
        sarcina_id: sarcina.id,
        sarcina_titlu: sarcina.titlu,
        sarcina_prioritate: sarcina.prioritate,
        sarcina_deadline: dataScadenta || '',
        proiect_id: sarcina.proiect_id,
        zile_intarziere: zileIntarziere,
        user_name: sarcina.responsabil_nume,
        link_detalii: `${baseUrl}/admin/rapoarte/sarcini?id=${sarcina.id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_sarcina_depasita',
        sarcina.responsabil_uid,
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Sarcină DEPĂȘITĂ: ${sarcina.titlu} (${zileIntarziere} zile întârziere)`);
      }
    }

    console.log(`✅ Cron notificări termene - FINISH (${notificariTrimise.length} notificări)`);

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      zile_avans: zileAvans,
      tables_version: tableSuffix || 'legacy',
      stats,
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
