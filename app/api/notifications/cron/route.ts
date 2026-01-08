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
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;
const TABLE_PROIECTE_RESPONSABILI = `\`${PROJECT_ID}.${DATASET}.ProiecteResponsabili${tableSuffix}\``;
const TABLE_SUBPROIECTE_RESPONSABILI = `\`${PROJECT_ID}.${DATASET}.SubproiecteResponsabili${tableSuffix}\``;

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
// Apelat de GitHub Actions cron zilnic la 07:00 GMT
// =====================================================

export async function GET(request: NextRequest) {
  try {
    // Verificare autorizare cron (GitHub Actions trimite CRON_SECRET)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // În production, verificăm header Authorization
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Notifications Cron] Unauthorized - invalid cron secret');
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

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
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor din Utilizatori_v2 + ProiecteResponsabili_v2
    // Responsabil în Proiecte_v2 este un NUME (ex: "Ionescu Mihai"), nu un UID!
    // Trebuie să facem JOIN cu Utilizatori_v2 pentru a găsi UID-ul corect

    const proiecteApropiateQuery = `
      WITH proiecte_apropiate AS (
        SELECT
          p.ID_Proiect as id,
          p.Denumire as denumire,
          p.Client as client,
          p.Data_Final as data_final,
          p.Responsabil as responsabil_nume,
          p.progres_procent
        FROM ${TABLE_PROIECTE} p
        WHERE p.Data_Final IS NOT NULL
          AND p.Data_Final BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
          AND p.Status = 'Activ'
          AND (p.progres_procent IS NULL OR p.progres_procent < 100)
      ),
      -- Obține UID-ul responsabilului principal din Utilizatori
      responsabil_principal AS (
        SELECT
          pa.id,
          pa.denumire,
          pa.client,
          pa.data_final,
          pa.responsabil_nume,
          pa.progres_procent,
          u.uid as responsabil_uid,
          CONCAT(u.nume, ' ', u.prenume) as user_name
        FROM proiecte_apropiate pa
        LEFT JOIN ${TABLE_UTILIZATORI} u ON (
          CONCAT(u.nume, ' ', u.prenume) = pa.responsabil_nume
          OR CONCAT(u.prenume, ' ', u.nume) = pa.responsabil_nume
          OR u.nume = pa.responsabil_nume
        )
        WHERE u.uid IS NOT NULL
      ),
      -- Adaugă și responsabilii din ProiecteResponsabili_v2
      responsabili_aditionali AS (
        SELECT
          pa.id,
          pa.denumire,
          pa.client,
          pa.data_final,
          pr.responsabil_nume,
          pa.progres_procent,
          pr.responsabil_uid,
          pr.responsabil_nume as user_name
        FROM proiecte_apropiate pa
        INNER JOIN ${TABLE_PROIECTE_RESPONSABILI} pr ON pr.proiect_id = pa.id
      )
      -- Combină ambele surse, eliminând duplicatele
      SELECT DISTINCT * FROM responsabil_principal
      UNION DISTINCT
      SELECT DISTINCT * FROM responsabili_aditionali
    `;

    const [proiecteApropiate] = await bigquery.query({ query: proiecteApropiateQuery });
    stats.proiecte_apropiate = proiecteApropiate.length;
    console.log(`📊 Proiecte cu termene apropiate: ${proiecteApropiate.length} (responsabili unici)`);

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
        user_name: proiect.user_name || proiect.responsabil_nume, // FIX: Folosește numele utilizatorului
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${proiect.id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_proiect_aproape',
        proiect.responsabil_uid, // Acum este UID-ul real din Utilizatori_v2
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Proiect aproape: ${proiect.denumire} - ${proiect.user_name} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 2. PROIECTE CU TERMENE DEPĂȘITE
    // ============================================
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor (la fel ca proiecte apropiate)

    const proiecteDepasiteQuery = `
      WITH proiecte_depasite AS (
        SELECT
          p.ID_Proiect as id,
          p.Denumire as denumire,
          p.Client as client,
          p.Data_Final as data_final,
          p.Responsabil as responsabil_nume,
          p.progres_procent
        FROM ${TABLE_PROIECTE} p
        WHERE p.Data_Final IS NOT NULL
          AND p.Data_Final < CURRENT_DATE()
          AND p.Status = 'Activ'
          AND (p.progres_procent IS NULL OR p.progres_procent < 100)
      ),
      responsabil_principal AS (
        SELECT
          pd.id,
          pd.denumire,
          pd.client,
          pd.data_final,
          pd.responsabil_nume,
          pd.progres_procent,
          u.uid as responsabil_uid,
          CONCAT(u.nume, ' ', u.prenume) as user_name
        FROM proiecte_depasite pd
        LEFT JOIN ${TABLE_UTILIZATORI} u ON (
          CONCAT(u.nume, ' ', u.prenume) = pd.responsabil_nume
          OR CONCAT(u.prenume, ' ', u.nume) = pd.responsabil_nume
          OR u.nume = pd.responsabil_nume
        )
        WHERE u.uid IS NOT NULL
      ),
      responsabili_aditionali AS (
        SELECT
          pd.id,
          pd.denumire,
          pd.client,
          pd.data_final,
          pr.responsabil_nume,
          pd.progres_procent,
          pr.responsabil_uid,
          pr.responsabil_nume as user_name
        FROM proiecte_depasite pd
        INNER JOIN ${TABLE_PROIECTE_RESPONSABILI} pr ON pr.proiect_id = pd.id
      )
      SELECT DISTINCT * FROM responsabil_principal
      UNION DISTINCT
      SELECT DISTINCT * FROM responsabili_aditionali
    `;

    const [proiecteDepasite] = await bigquery.query({ query: proiecteDepasiteQuery });
    stats.proiecte_depasite = proiecteDepasite.length;
    console.log(`📊 Proiecte cu termene depășite: ${proiecteDepasite.length} (responsabili unici)`);

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
        user_name: proiect.user_name || proiect.responsabil_nume, // FIX: Folosește numele utilizatorului
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${proiect.id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_proiect_depasit',
        proiect.responsabil_uid, // Acum este UID-ul real
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Proiect DEPĂȘIT: ${proiect.denumire} - ${proiect.user_name} (${zileIntarziere} zile întârziere)`);
      }
    }

    // ============================================
    // 3. SUBPROIECTE CU TERMENE APROPIATE
    // ============================================
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor din Utilizatori_v2 + SubproiecteResponsabili_v2

    const subproiecteApropiateQuery = `
      WITH subproiecte_apropiate AS (
        SELECT
          sp.ID_Subproiect as id,
          sp.Denumire as denumire,
          sp.ID_Proiect as proiect_id,
          sp.Data_Final as data_final,
          sp.Responsabil as responsabil_nume,
          sp.progres_procent,
          p.Denumire as proiect_denumire
        FROM ${TABLE_SUBPROIECTE} sp
        LEFT JOIN ${TABLE_PROIECTE} p ON sp.ID_Proiect = p.ID_Proiect
        WHERE sp.Data_Final IS NOT NULL
          AND sp.Data_Final BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
          AND sp.Status = 'Activ'
          AND (sp.progres_procent IS NULL OR sp.progres_procent < 100)
          AND sp.activ = true
      ),
      responsabil_principal AS (
        SELECT
          sa.id,
          sa.denumire,
          sa.proiect_id,
          sa.data_final,
          sa.responsabil_nume,
          sa.progres_procent,
          sa.proiect_denumire,
          u.uid as responsabil_uid,
          CONCAT(u.nume, ' ', u.prenume) as user_name
        FROM subproiecte_apropiate sa
        LEFT JOIN ${TABLE_UTILIZATORI} u ON (
          CONCAT(u.nume, ' ', u.prenume) = sa.responsabil_nume
          OR CONCAT(u.prenume, ' ', u.nume) = sa.responsabil_nume
          OR u.nume = sa.responsabil_nume
        )
        WHERE u.uid IS NOT NULL
      ),
      responsabili_aditionali AS (
        SELECT
          sa.id,
          sa.denumire,
          sa.proiect_id,
          sa.data_final,
          sr.responsabil_nume,
          sa.progres_procent,
          sa.proiect_denumire,
          sr.responsabil_uid,
          sr.responsabil_nume as user_name
        FROM subproiecte_apropiate sa
        INNER JOIN ${TABLE_SUBPROIECTE_RESPONSABILI} sr ON sr.subproiect_id = sa.id
      )
      SELECT DISTINCT * FROM responsabil_principal
      UNION DISTINCT
      SELECT DISTINCT * FROM responsabili_aditionali
    `;

    const [subproiecteApropiate] = await bigquery.query({ query: subproiecteApropiateQuery });
    stats.subproiecte_apropiate = subproiecteApropiate.length;
    console.log(`📊 Subproiecte cu termene apropiate: ${subproiecteApropiate.length} (responsabili unici)`);

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
        user_name: subproiect.user_name || subproiect.responsabil_nume, // FIX: Folosește numele utilizatorului
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${subproiect.proiect_id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_subproiect_aproape',
        subproiect.responsabil_uid, // Acum este UID-ul real
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Subproiect aproape: ${subproiect.denumire} - ${subproiect.user_name} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 4. SUBPROIECTE CU TERMENE DEPĂȘITE
    // ============================================
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor

    const subproiecteDepasiteQuery = `
      WITH subproiecte_depasite AS (
        SELECT
          sp.ID_Subproiect as id,
          sp.Denumire as denumire,
          sp.ID_Proiect as proiect_id,
          sp.Data_Final as data_final,
          sp.Responsabil as responsabil_nume,
          sp.progres_procent,
          p.Denumire as proiect_denumire
        FROM ${TABLE_SUBPROIECTE} sp
        LEFT JOIN ${TABLE_PROIECTE} p ON sp.ID_Proiect = p.ID_Proiect
        WHERE sp.Data_Final IS NOT NULL
          AND sp.Data_Final < CURRENT_DATE()
          AND sp.Status = 'Activ'
          AND (sp.progres_procent IS NULL OR sp.progres_procent < 100)
          AND sp.activ = true
      ),
      responsabil_principal AS (
        SELECT
          sd.id,
          sd.denumire,
          sd.proiect_id,
          sd.data_final,
          sd.responsabil_nume,
          sd.progres_procent,
          sd.proiect_denumire,
          u.uid as responsabil_uid,
          CONCAT(u.nume, ' ', u.prenume) as user_name
        FROM subproiecte_depasite sd
        LEFT JOIN ${TABLE_UTILIZATORI} u ON (
          CONCAT(u.nume, ' ', u.prenume) = sd.responsabil_nume
          OR CONCAT(u.prenume, ' ', u.nume) = sd.responsabil_nume
          OR u.nume = sd.responsabil_nume
        )
        WHERE u.uid IS NOT NULL
      ),
      responsabili_aditionali AS (
        SELECT
          sd.id,
          sd.denumire,
          sd.proiect_id,
          sd.data_final,
          sr.responsabil_nume,
          sd.progres_procent,
          sd.proiect_denumire,
          sr.responsabil_uid,
          sr.responsabil_nume as user_name
        FROM subproiecte_depasite sd
        INNER JOIN ${TABLE_SUBPROIECTE_RESPONSABILI} sr ON sr.subproiect_id = sd.id
      )
      SELECT DISTINCT * FROM responsabil_principal
      UNION DISTINCT
      SELECT DISTINCT * FROM responsabili_aditionali
    `;

    const [subproiecteDepasite] = await bigquery.query({ query: subproiecteDepasiteQuery });
    stats.subproiecte_depasite = subproiecteDepasite.length;
    console.log(`📊 Subproiecte cu termene depășite: ${subproiecteDepasite.length} (responsabili unici)`);

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
        user_name: subproiect.user_name || subproiect.responsabil_nume, // FIX: Folosește numele utilizatorului
        link_detalii: `${baseUrl}/admin/rapoarte/proiecte?id=${subproiect.proiect_id}`,
      };

      const result = await trimitereNotificare(
        baseUrl,
        'termen_subproiect_depasit',
        subproiect.responsabil_uid, // Acum este UID-ul real
        context,
        dryRun
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Subproiect DEPĂȘIT: ${subproiect.denumire} - ${subproiect.user_name} (${zileIntarziere} zile întârziere)`);
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
