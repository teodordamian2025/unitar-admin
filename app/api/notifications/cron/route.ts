// CALEA: /app/api/notifications/cron/route.ts
// DATA: 05.10.2025 (ora României) - ACTUALIZAT: 17.01.2026
// DESCRIERE: Cron job pentru verificare termene apropiate ȘI DEPĂȘITE (proiecte, subproiecte, sarcini)
// MODIFICAT: 12.01.2026 - Consolidare email-uri per user + link-uri corecte admin/user + ID proiect vizibil
// MODIFICAT: 14.01.2026 - FIX: Exclude proiecte/subproiecte cu status_achitare = 'Incasat' din notificări
// MODIFICAT: 16.01.2026 - FIX: Exclude proiecte/subproiecte care au facturi deja plătite (verificare directă în FacturiGenerate_v2)
// MODIFICAT: 17.01.2026 - FIX: Rezolvat eroare BigQuery "LEFT ANTISEMI JOIN" prin separarea NOT EXISTS cu OR în două clauze AND

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import type { NotificareContext } from '@/lib/notifications/types';
import { sendNotificationEmail, renderTemplate } from '@/lib/notifications/send-email';

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
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_FACTURI_EMISE_ANAF = `\`${PROJECT_ID}.${DATASET}.FacturiEmiseANAF${tableSuffix}\``;
const TABLE_ANAF_EFACTURA = `\`${PROJECT_ID}.${DATASET}.AnafEFactura${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// =====================================================
// INTERFACES pentru consolidare email-uri per user
// =====================================================

interface NotificareItem {
  tip: 'proiect' | 'subproiect' | 'sarcina';
  tip_notificare: string;
  denumire: string;
  proiect_id: string;
  proiect_denumire?: string;
  client?: string;
  deadline: string;
  zile_ramase?: number;
  zile_intarziere?: number;
  link_detalii: string;
  prioritate?: string;
}

interface UserNotificationsGroup {
  user_id: string;
  user_name: string;
  user_email: string;
  user_rol: 'admin' | 'normal';
  notificari: NotificareItem[];
}

// Map pentru colectarea notificărilor per user
const userNotificationsMap = new Map<string, UserNotificationsGroup>();

// Helper pentru generarea link-ului corect în funcție de rol
function getProjectLink(baseUrl: string, proiectId: string, userRol: 'admin' | 'normal'): string {
  if (userRol === 'admin') {
    return `${baseUrl}/admin/rapoarte/proiecte/${proiectId}`;
  }
  return `${baseUrl}/projects/${proiectId}`;
}

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

// Helper pentru adăugare notificare în grupul userului
function addNotificationToUser(
  userId: string,
  userName: string,
  userEmail: string,
  userRol: 'admin' | 'normal',
  notificare: NotificareItem
) {
  if (!userNotificationsMap.has(userId)) {
    userNotificationsMap.set(userId, {
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      user_rol: userRol,
      notificari: [],
    });
  }
  userNotificationsMap.get(userId)!.notificari.push(notificare);
}

// Helper pentru trimitere email consolidat pentru un user
async function sendConsolidatedEmail(
  userGroup: UserNotificationsGroup,
  baseUrl: string,
  dryRun: boolean
): Promise<{ success: boolean; count: number }> {
  if (dryRun || userGroup.notificari.length === 0) {
    return { success: true, count: userGroup.notificari.length };
  }

  if (!userGroup.user_email) {
    console.warn(`⚠️ User ${userGroup.user_id} nu are email configurat`);
    return { success: false, count: 0 };
  }

  // Generează subiect și conținut email consolidat
  const notifCount = userGroup.notificari.length;
  const subject = notifCount === 1
    ? `Reminder: ${userGroup.notificari[0].denumire} - termen ${userGroup.notificari[0].zile_ramase !== undefined ? 'aproape' : 'depășit'}`
    : `${notifCount} notificări despre termene proiecte`;

  // Generează HTML pentru fiecare notificare
  const notificariHtml = userGroup.notificari.map((n, index) => {
    const isOverdue = n.zile_intarziere !== undefined && n.zile_intarziere > 0;
    const statusColor = isOverdue ? '#EF4444' : '#F59E0B';
    const statusText = isOverdue
      ? `⚠️ DEPĂȘIT cu ${n.zile_intarziere} zile`
      : `⏰ Mai sunt ${n.zile_ramase} zile`;

    const tipLabel = n.tip === 'proiect' ? 'Proiect' : n.tip === 'subproiect' ? 'Subproiect' : 'Sarcină';

    return `
      <div style="background: #ffffff; border: 1px solid #E5E7EB; border-left: 4px solid ${statusColor}; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <span style="background: ${statusColor}20; color: ${statusColor}; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">${tipLabel}</span>
            <span style="background: #3B82F620; color: #3B82F6; font-size: 11px; font-weight: 500; padding: 4px 8px; border-radius: 4px; margin-left: 8px;">ID: ${n.proiect_id}</span>
          </div>
          <span style="color: ${statusColor}; font-weight: 600; font-size: 13px;">${statusText}</span>
        </div>
        <h3 style="margin: 0 0 8px 0; color: #1F2937; font-size: 16px; font-weight: 600;">${n.denumire}</h3>
        ${n.proiect_denumire && n.tip !== 'proiect' ? `<p style="margin: 0 0 4px 0; color: #6B7280; font-size: 13px;">📁 Proiect: ${n.proiect_denumire}</p>` : ''}
        ${n.client ? `<p style="margin: 0 0 4px 0; color: #6B7280; font-size: 13px;">👤 Client: ${n.client}</p>` : ''}
        <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 13px;">📅 Termen: ${n.deadline}</p>
        <a href="${n.link_detalii}" style="display: inline-block; background: #3B82F6; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;">Vezi Detalii ${tipLabel}</a>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <p>Bună <strong>${userGroup.user_name}</strong>,</p>
    <p style="color: #4B5563; margin-bottom: 20px;">Ai ${notifCount} ${notifCount === 1 ? 'notificare' : 'notificări'} despre termene proiecte care necesită atenția ta:</p>
    ${notificariHtml}
    <p style="margin-top: 24px; color: #6B7280; font-size: 14px;">
      Pentru a vizualiza toate notificările, accesează <a href="${baseUrl}/notifications" style="color: #3B82F6; text-decoration: none;">pagina de notificări</a>.
    </p>
  `;

  const textContent = userGroup.notificari.map(n => {
    const status = n.zile_intarziere !== undefined && n.zile_intarziere > 0
      ? `DEPĂȘIT cu ${n.zile_intarziere} zile`
      : `Mai sunt ${n.zile_ramase} zile`;
    return `
${n.tip.toUpperCase()} (ID: ${n.proiect_id}): ${n.denumire}
${n.proiect_denumire && n.tip !== 'proiect' ? `Proiect: ${n.proiect_denumire}` : ''}
${n.client ? `Client: ${n.client}` : ''}
Termen: ${n.deadline}
Status: ${status}
Link: ${n.link_detalii}
---`;
  }).join('\n');

  try {
    const result = await sendNotificationEmail(
      userGroup.user_email,
      subject,
      `Bună ${userGroup.user_name},\n\nAi ${notifCount} notificări despre termene proiecte:\n${textContent}`,
      htmlContent,
      {} as NotificareContext
    );
    return { success: result.success, count: notifCount };
  } catch (error: any) {
    console.error(`❌ Eroare trimitere email consolidat pentru ${userGroup.user_email}:`, error);
    return { success: false, count: 0 };
  }
}

// Helper generic pentru trimitere notificare în clopotel (fără email)
async function trimitereNotificareClopotel(
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
    // Trimite doar pentru clopotel (UI), nu email - email-ul va fi consolidat
    const notifyResponse = await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tip_notificare: tipNotificare,
        user_id: userId,
        context,
        skip_email: true, // Flag pentru a nu trimite email individual
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
      facturi_scadenta_apropiata: 0, // NOU 23.01.2026
      facturi_scadenta_depasita: 0,  // NOU 23.01.2026
      facturi_netrimise_anaf: 0,
    };

    // ============================================
    // 1. PROIECTE CU TERMENE APROPIATE
    // ============================================
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor din Utilizatori_v2 + ProiecteResponsabili_v2
    // Responsabil în Proiecte_v2 este un NUME (ex: "Ionescu Mihai"), nu un UID!
    // Trebuie să facem JOIN cu Utilizatori_v2 pentru a găsi UID-ul corect

    // Resetăm map-ul de notificări pentru fiecare rulare
    userNotificationsMap.clear();

    // FIX 14.01.2026: Exclude proiectele cu status_achitare = 'Incasat' - nu mai trimitem notificări pentru facturi deja încasate
    // FIX 16.01.2026: Verificare directă dacă proiectul are facturi deja plătite în FacturiGenerate_v2
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
          AND COALESCE(p.status_achitare, 'Neachitat') != 'Incasat'
          -- FIX 16.01.2026: Exclude proiectele care au facturi deja plătite integral
          AND NOT EXISTS (
            SELECT 1 FROM ${TABLE_FACTURI_GENERATE} fg
            WHERE fg.proiect_id = p.ID_Proiect
            AND (fg.status = 'platita' OR COALESCE(fg.valoare_platita, 0) >= COALESCE(fg.total, 0) * 0.99)
          )
      ),
      -- Obține UID-ul responsabilului principal din Utilizatori (cu rol și email)
      responsabil_principal AS (
        SELECT
          pa.id,
          pa.denumire,
          pa.client,
          pa.data_final,
          pa.responsabil_nume,
          pa.progres_procent,
          u.uid as responsabil_uid,
          CONCAT(u.nume, ' ', u.prenume) as user_name,
          u.email as user_email,
          u.rol as user_rol
        FROM proiecte_apropiate pa
        LEFT JOIN ${TABLE_UTILIZATORI} u ON (
          CONCAT(u.nume, ' ', u.prenume) = pa.responsabil_nume
          OR CONCAT(u.prenume, ' ', u.nume) = pa.responsabil_nume
          OR u.nume = pa.responsabil_nume
        )
        WHERE u.uid IS NOT NULL
      ),
      -- Adaugă și responsabilii din ProiecteResponsabili_v2 (cu rol și email)
      responsabili_aditionali AS (
        SELECT
          pa.id,
          pa.denumire,
          pa.client,
          pa.data_final,
          pr.responsabil_nume,
          pa.progres_procent,
          pr.responsabil_uid,
          pr.responsabil_nume as user_name,
          u.email as user_email,
          u.rol as user_rol
        FROM proiecte_apropiate pa
        INNER JOIN ${TABLE_PROIECTE_RESPONSABILI} pr ON pr.proiect_id = pa.id
        LEFT JOIN ${TABLE_UTILIZATORI} u ON pr.responsabil_uid = u.uid
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
      const userRol = (proiect.user_rol === 'admin' ? 'admin' : 'normal') as 'admin' | 'normal';

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

      // Generează link corect în funcție de rol
      const linkDetalii = getProjectLink(baseUrl, proiect.id, userRol);

      const context: NotificareContext = {
        proiect_id: proiect.id,
        proiect_denumire: proiect.denumire,
        proiect_client: proiect.client,
        proiect_deadline: dataFinal || '',
        zile_ramase: zileRamase,
        user_name: proiect.user_name || proiect.responsabil_nume,
        link_detalii: linkDetalii,
      };

      // Trimite notificare doar în clopotel (UI), nu email
      const result = await trimitereNotificareClopotel(
        baseUrl,
        'termen_proiect_aproape',
        proiect.responsabil_uid,
        context,
        dryRun
      );

      // Adaugă în grupul pentru email consolidat
      addNotificationToUser(
        proiect.responsabil_uid,
        proiect.user_name || proiect.responsabil_nume,
        proiect.user_email || '',
        userRol,
        {
          tip: 'proiect',
          tip_notificare: 'termen_proiect_aproape',
          denumire: proiect.denumire,
          proiect_id: proiect.id,
          client: proiect.client,
          deadline: dataFinal || '',
          zile_ramase: zileRamase,
          link_detalii: linkDetalii,
        }
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Proiect aproape: ${proiect.denumire} - ${proiect.user_name} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 2. PROIECTE CU TERMENE DEPĂȘITE
    // ============================================
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor (la fel ca proiecte apropiate)

    // FIX 14.01.2026: Exclude proiectele cu status_achitare = 'Incasat' - nu mai trimitem notificări pentru facturi deja încasate
    // FIX 16.01.2026: Verificare directă dacă proiectul are facturi deja plătite în FacturiGenerate_v2
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
          AND COALESCE(p.status_achitare, 'Neachitat') != 'Incasat'
          -- FIX 16.01.2026: Exclude proiectele care au facturi deja plătite integral
          AND NOT EXISTS (
            SELECT 1 FROM ${TABLE_FACTURI_GENERATE} fg
            WHERE fg.proiect_id = p.ID_Proiect
            AND (fg.status = 'platita' OR COALESCE(fg.valoare_platita, 0) >= COALESCE(fg.total, 0) * 0.99)
          )
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
          CONCAT(u.nume, ' ', u.prenume) as user_name,
          u.email as user_email,
          u.rol as user_rol
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
          pr.responsabil_nume as user_name,
          u.email as user_email,
          u.rol as user_rol
        FROM proiecte_depasite pd
        INNER JOIN ${TABLE_PROIECTE_RESPONSABILI} pr ON pr.proiect_id = pd.id
        LEFT JOIN ${TABLE_UTILIZATORI} u ON pr.responsabil_uid = u.uid
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
      const userRol = (proiect.user_rol === 'admin' ? 'admin' : 'normal') as 'admin' | 'normal';

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

      // Generează link corect în funcție de rol
      const linkDetalii = getProjectLink(baseUrl, proiect.id, userRol);

      const context: NotificareContext = {
        proiect_id: proiect.id,
        proiect_denumire: proiect.denumire,
        proiect_client: proiect.client,
        proiect_deadline: dataFinal || '',
        zile_intarziere: zileIntarziere,
        user_name: proiect.user_name || proiect.responsabil_nume,
        link_detalii: linkDetalii,
      };

      // Trimite notificare doar în clopotel (UI), nu email
      const result = await trimitereNotificareClopotel(
        baseUrl,
        'termen_proiect_depasit',
        proiect.responsabil_uid,
        context,
        dryRun
      );

      // Adaugă în grupul pentru email consolidat
      addNotificationToUser(
        proiect.responsabil_uid,
        proiect.user_name || proiect.responsabil_nume,
        proiect.user_email || '',
        userRol,
        {
          tip: 'proiect',
          tip_notificare: 'termen_proiect_depasit',
          denumire: proiect.denumire,
          proiect_id: proiect.id,
          client: proiect.client,
          deadline: dataFinal || '',
          zile_intarziere: zileIntarziere,
          link_detalii: linkDetalii,
        }
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Proiect DEPĂȘIT: ${proiect.denumire} - ${proiect.user_name} (${zileIntarziere} zile întârziere)`);
      }
    }

    // ============================================
    // 3. SUBPROIECTE CU TERMENE APROPIATE
    // ============================================
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor din Utilizatori_v2 + SubproiecteResponsabili_v2

    // FIX 14.01.2026: Exclude subproiectele cu status_achitare = 'Incasat' - nu mai trimitem notificări pentru facturi deja încasate
    // FIX 16.01.2026: Verificare directă dacă proiectul părinte are facturi deja plătite în FacturiGenerate_v2
    const subproiecteApropiateQuery = `
      WITH subproiecte_apropiate AS (
        SELECT
          sp.ID_Subproiect as id,
          sp.Denumire as denumire,
          sp.ID_Proiect as proiect_id,
          sp.Data_Final as data_final,
          sp.Responsabil as responsabil_nume,
          sp.progres_procent,
          p.Denumire as proiect_denumire,
          p.Client as client
        FROM ${TABLE_SUBPROIECTE} sp
        LEFT JOIN ${TABLE_PROIECTE} p ON sp.ID_Proiect = p.ID_Proiect
        WHERE sp.Data_Final IS NOT NULL
          AND sp.Data_Final BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
          AND sp.Status = 'Activ'
          AND (sp.progres_procent IS NULL OR sp.progres_procent < 100)
          AND sp.activ = true
          AND COALESCE(sp.status_achitare, 'Neachitat') != 'Incasat'
          -- FIX 16.01.2026: Exclude subproiectele care au facturi deja plătite (prin proiectul părinte)
          AND NOT EXISTS (
            SELECT 1 FROM ${TABLE_FACTURI_GENERATE} fg
            WHERE fg.proiect_id = sp.ID_Proiect
            AND (fg.status = 'platita' OR COALESCE(fg.valoare_platita, 0) >= COALESCE(fg.total, 0) * 0.99)
          )
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
          sa.client,
          u.uid as responsabil_uid,
          CONCAT(u.nume, ' ', u.prenume) as user_name,
          u.email as user_email,
          u.rol as user_rol
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
          sa.client,
          sr.responsabil_uid,
          sr.responsabil_nume as user_name,
          u.email as user_email,
          u.rol as user_rol
        FROM subproiecte_apropiate sa
        INNER JOIN ${TABLE_SUBPROIECTE_RESPONSABILI} sr ON sr.subproiect_id = sa.id
        LEFT JOIN ${TABLE_UTILIZATORI} u ON sr.responsabil_uid = u.uid
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
      const userRol = (subproiect.user_rol === 'admin' ? 'admin' : 'normal') as 'admin' | 'normal';

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

      // Generează link corect în funcție de rol (link la proiect părinte)
      const linkDetalii = getProjectLink(baseUrl, subproiect.proiect_id, userRol);

      const context: NotificareContext = {
        subproiect_id: subproiect.id,
        subproiect_denumire: subproiect.denumire,
        proiect_id: subproiect.proiect_id,
        proiect_denumire: subproiect.proiect_denumire,
        proiect_deadline: dataFinal || '',
        zile_ramase: zileRamase,
        user_name: subproiect.user_name || subproiect.responsabil_nume,
        link_detalii: linkDetalii,
      };

      // Trimite notificare doar în clopotel (UI), nu email
      const result = await trimitereNotificareClopotel(
        baseUrl,
        'termen_subproiect_aproape',
        subproiect.responsabil_uid,
        context,
        dryRun
      );

      // Adaugă în grupul pentru email consolidat
      addNotificationToUser(
        subproiect.responsabil_uid,
        subproiect.user_name || subproiect.responsabil_nume,
        subproiect.user_email || '',
        userRol,
        {
          tip: 'subproiect',
          tip_notificare: 'termen_subproiect_aproape',
          denumire: subproiect.denumire,
          proiect_id: subproiect.proiect_id,
          proiect_denumire: subproiect.proiect_denumire,
          client: subproiect.client,
          deadline: dataFinal || '',
          zile_ramase: zileRamase,
          link_detalii: linkDetalii,
        }
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Subproiect aproape: ${subproiect.denumire} - ${subproiect.user_name} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 4. SUBPROIECTE CU TERMENE DEPĂȘITE
    // ============================================
    // FIX 08.01.2026: Rezolvare corectă a UID-urilor

    // FIX 14.01.2026: Exclude subproiectele cu status_achitare = 'Incasat' - nu mai trimitem notificări pentru facturi deja încasate
    // FIX 16.01.2026: Verificare directă dacă proiectul părinte are facturi deja plătite în FacturiGenerate_v2
    const subproiecteDepasiteQuery = `
      WITH subproiecte_depasite AS (
        SELECT
          sp.ID_Subproiect as id,
          sp.Denumire as denumire,
          sp.ID_Proiect as proiect_id,
          sp.Data_Final as data_final,
          sp.Responsabil as responsabil_nume,
          sp.progres_procent,
          p.Denumire as proiect_denumire,
          p.Client as client
        FROM ${TABLE_SUBPROIECTE} sp
        LEFT JOIN ${TABLE_PROIECTE} p ON sp.ID_Proiect = p.ID_Proiect
        WHERE sp.Data_Final IS NOT NULL
          AND sp.Data_Final < CURRENT_DATE()
          AND sp.Status = 'Activ'
          AND (sp.progres_procent IS NULL OR sp.progres_procent < 100)
          AND sp.activ = true
          AND COALESCE(sp.status_achitare, 'Neachitat') != 'Incasat'
          -- FIX 16.01.2026: Exclude subproiectele care au facturi deja plătite (prin proiectul părinte)
          AND NOT EXISTS (
            SELECT 1 FROM ${TABLE_FACTURI_GENERATE} fg
            WHERE fg.proiect_id = sp.ID_Proiect
            AND (fg.status = 'platita' OR COALESCE(fg.valoare_platita, 0) >= COALESCE(fg.total, 0) * 0.99)
          )
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
          sd.client,
          u.uid as responsabil_uid,
          CONCAT(u.nume, ' ', u.prenume) as user_name,
          u.email as user_email,
          u.rol as user_rol
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
          sd.client,
          sr.responsabil_uid,
          sr.responsabil_nume as user_name,
          u.email as user_email,
          u.rol as user_rol
        FROM subproiecte_depasite sd
        INNER JOIN ${TABLE_SUBPROIECTE_RESPONSABILI} sr ON sr.subproiect_id = sd.id
        LEFT JOIN ${TABLE_UTILIZATORI} u ON sr.responsabil_uid = u.uid
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
      const userRol = (subproiect.user_rol === 'admin' ? 'admin' : 'normal') as 'admin' | 'normal';

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

      // Generează link corect în funcție de rol (link la proiect părinte)
      const linkDetalii = getProjectLink(baseUrl, subproiect.proiect_id, userRol);

      const context: NotificareContext = {
        subproiect_id: subproiect.id,
        subproiect_denumire: subproiect.denumire,
        proiect_id: subproiect.proiect_id,
        proiect_denumire: subproiect.proiect_denumire,
        proiect_deadline: dataFinal || '',
        zile_intarziere: zileIntarziere,
        user_name: subproiect.user_name || subproiect.responsabil_nume,
        link_detalii: linkDetalii,
      };

      // Trimite notificare doar în clopotel (UI), nu email
      const result = await trimitereNotificareClopotel(
        baseUrl,
        'termen_subproiect_depasit',
        subproiect.responsabil_uid,
        context,
        dryRun
      );

      // Adaugă în grupul pentru email consolidat
      addNotificationToUser(
        subproiect.responsabil_uid,
        subproiect.user_name || subproiect.responsabil_nume,
        subproiect.user_email || '',
        userRol,
        {
          tip: 'subproiect',
          tip_notificare: 'termen_subproiect_depasit',
          denumire: subproiect.denumire,
          proiect_id: subproiect.proiect_id,
          proiect_denumire: subproiect.proiect_denumire,
          client: subproiect.client,
          deadline: dataFinal || '',
          zile_intarziere: zileIntarziere,
          link_detalii: linkDetalii,
        }
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
        sr.responsabil_nume as responsabil_nume,
        u.email as user_email,
        u.rol as user_rol,
        p.Denumire as proiect_denumire,
        p.Client as client
      FROM ${TABLE_SARCINI} s
      INNER JOIN ${TABLE_SARCINI_RESPONSABILI} sr ON s.id = sr.sarcina_id
      LEFT JOIN ${TABLE_UTILIZATORI} u ON sr.responsabil_uid = u.uid
      LEFT JOIN ${TABLE_PROIECTE} p ON s.proiect_id = p.ID_Proiect
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
      const userRol = (sarcina.user_rol === 'admin' ? 'admin' : 'normal') as 'admin' | 'normal';

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

      // Link la proiect (unde sunt sarcinile vizibile)
      const linkDetalii = getProjectLink(baseUrl, sarcina.proiect_id, userRol);

      const context: NotificareContext = {
        sarcina_id: sarcina.id,
        sarcina_titlu: sarcina.titlu,
        sarcina_prioritate: sarcina.prioritate,
        sarcina_deadline: dataScadenta || '',
        proiect_id: sarcina.proiect_id,
        proiect_denumire: sarcina.proiect_denumire,
        zile_ramase: zileRamase,
        user_name: sarcina.responsabil_nume,
        link_detalii: linkDetalii,
      };

      // Trimite notificare doar în clopotel (UI), nu email
      const result = await trimitereNotificareClopotel(
        baseUrl,
        'termen_sarcina_aproape',
        sarcina.responsabil_uid,
        context,
        dryRun
      );

      // Adaugă în grupul pentru email consolidat
      addNotificationToUser(
        sarcina.responsabil_uid,
        sarcina.responsabil_nume,
        sarcina.user_email || '',
        userRol,
        {
          tip: 'sarcina',
          tip_notificare: 'termen_sarcina_aproape',
          denumire: sarcina.titlu,
          proiect_id: sarcina.proiect_id,
          proiect_denumire: sarcina.proiect_denumire,
          client: sarcina.client,
          deadline: dataScadenta || '',
          zile_ramase: zileRamase,
          prioritate: sarcina.prioritate,
          link_detalii: linkDetalii,
        }
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
        sr.responsabil_nume as responsabil_nume,
        u.email as user_email,
        u.rol as user_rol,
        p.Denumire as proiect_denumire,
        p.Client as client
      FROM ${TABLE_SARCINI} s
      INNER JOIN ${TABLE_SARCINI_RESPONSABILI} sr ON s.id = sr.sarcina_id
      LEFT JOIN ${TABLE_UTILIZATORI} u ON sr.responsabil_uid = u.uid
      LEFT JOIN ${TABLE_PROIECTE} p ON s.proiect_id = p.ID_Proiect
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
      const userRol = (sarcina.user_rol === 'admin' ? 'admin' : 'normal') as 'admin' | 'normal';

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

      // Link la proiect (unde sunt sarcinile vizibile)
      const linkDetalii = getProjectLink(baseUrl, sarcina.proiect_id, userRol);

      const context: NotificareContext = {
        sarcina_id: sarcina.id,
        sarcina_titlu: sarcina.titlu,
        sarcina_prioritate: sarcina.prioritate,
        sarcina_deadline: dataScadenta || '',
        proiect_id: sarcina.proiect_id,
        proiect_denumire: sarcina.proiect_denumire,
        zile_intarziere: zileIntarziere,
        user_name: sarcina.responsabil_nume,
        link_detalii: linkDetalii,
      };

      // Trimite notificare doar în clopotel (UI), nu email
      const result = await trimitereNotificareClopotel(
        baseUrl,
        'termen_sarcina_depasita',
        sarcina.responsabil_uid,
        context,
        dryRun
      );

      // Adaugă în grupul pentru email consolidat
      addNotificationToUser(
        sarcina.responsabil_uid,
        sarcina.responsabil_nume,
        sarcina.user_email || '',
        userRol,
        {
          tip: 'sarcina',
          tip_notificare: 'termen_sarcina_depasita',
          denumire: sarcina.titlu,
          proiect_id: sarcina.proiect_id,
          proiect_denumire: sarcina.proiect_denumire,
          client: sarcina.client,
          deadline: dataScadenta || '',
          zile_intarziere: zileIntarziere,
          prioritate: sarcina.prioritate,
          link_detalii: linkDetalii,
        }
      );

      if (result.success) {
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Sarcină DEPĂȘITĂ: ${sarcina.titlu} (${zileIntarziere} zile întârziere)`);
      }
    }

    // ============================================
    // 7. FACTURI CU SCADENȚĂ APROPIATĂ (pentru admini)
    // ============================================
    // NOU 23.01.2026: Verifică facturile cu scadență în următoarele 7 zile
    // EXCLUDE: facturi marcate cu exclude_notificari_plata = TRUE

    const facturiScadentaApropiataQuery = `
      SELECT
        fg.id,
        fg.serie,
        fg.numar,
        fg.data_factura,
        fg.data_scadenta,
        fg.client_nume,
        fg.client_cui,
        fg.total,
        fg.valoare_platita,
        fg.proiect_id,
        (fg.total - COALESCE(fg.valoare_platita, 0)) as rest_de_plata,
        DATE_DIFF(fg.data_scadenta, CURRENT_DATE(), DAY) as zile_pana_scadenta
      FROM ${TABLE_FACTURI_GENERATE} fg
      WHERE fg.data_scadenta IS NOT NULL
        AND fg.data_scadenta BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ${zileAvans} DAY)
        AND (fg.total - COALESCE(fg.valoare_platita, 0)) > 0
        AND COALESCE(fg.is_storno, false) = false
        AND fg.stornata_de_factura_id IS NULL
        AND fg.status NOT IN ('storno', 'stornata', 'platita')
        -- ✅ NOU 23.01.2026: Exclude facturile marcate pentru excludere din notificări
        AND COALESCE(fg.exclude_notificari_plata, false) = false
      ORDER BY fg.data_scadenta ASC
    `;

    const [facturiScadentaApropiate] = await bigquery.query({ query: facturiScadentaApropiataQuery });
    stats.facturi_scadenta_apropiata = facturiScadentaApropiate.length;
    console.log(`💳 Facturi cu scadență apropiată (${zileAvans} zile): ${facturiScadentaApropiate.length}`);

    if (facturiScadentaApropiate.length > 0) {
      // Obține toți adminii pentru notificare
      const adminiScadentaQuery = `
        SELECT uid, nume, prenume, email
        FROM ${TABLE_UTILIZATORI}
        WHERE rol = 'admin' AND activ = true AND email IS NOT NULL
      `;
      const [adminiScadenta] = await bigquery.query({ query: adminiScadentaQuery });

      for (const factura of facturiScadentaApropiate) {
        const serieNumar = `${factura.serie || ''} ${factura.numar || ''}`.trim();
        const dataScadenta = extractDateValue(factura.data_scadenta);
        const zileRamase = parseInt(factura.zile_pana_scadenta) || 0;

        // Verifică dacă notificarea a fost deja trimisă pentru această factură
        const dejaTrimisaScadentaQuery = `
          SELECT COUNT(*) as count
          FROM ${TABLE_NOTIFICARI}
          WHERE tip_notificare = 'factura_scadenta_aproape'
            AND JSON_EXTRACT_SCALAR(continut_json, '$.factura_id') = @factura_id
            AND data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
        `;

        const [checkScadentaRows] = await bigquery.query({
          query: dejaTrimisaScadentaQuery,
          params: { factura_id: factura.id },
        });

        if ((checkScadentaRows[0]?.count || 0) > 0) {
          console.log(`⏭️ Skip - notificare factură scadență aproape deja trimisă recent pentru ${serieNumar}`);
          continue;
        }

        const linkDetalii = `${baseUrl}/admin/rapoarte/facturi?search=${encodeURIComponent(serieNumar)}`;

        for (const admin of adminiScadenta) {
          const adminName = `${admin.nume || ''} ${admin.prenume || ''}`.trim() || 'Admin';

          const context: NotificareContext = {
            factura_id: factura.id,
            serie_factura: factura.serie,
            numar_factura: factura.numar,
            client_nume: factura.client_nume,
            suma_totala: parseFloat(factura.total) || 0,
            suma_achitata: parseFloat(factura.valoare_platita) || 0,
            data_scadenta: dataScadenta || '',
            zile_ramase: zileRamase,
            user_name: adminName,
            link_detalii: linkDetalii,
          };

          await trimitereNotificareClopotel(
            baseUrl,
            'factura_scadenta_aproape',
            admin.uid,
            context,
            dryRun
          );

          addNotificationToUser(
            admin.uid,
            adminName,
            admin.email || '',
            'admin',
            {
              tip: 'proiect',
              tip_notificare: 'factura_scadenta_aproape',
              denumire: `Factură ${serieNumar} - ${factura.client_nume}`,
              proiect_id: factura.id,
              client: factura.client_nume,
              deadline: dataScadenta || '',
              zile_ramase: zileRamase,
              link_detalii: linkDetalii,
            }
          );
        }
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Factură scadență aproape: ${serieNumar} - ${factura.client_nume} (${zileRamase} zile)`);
      }
    }

    // ============================================
    // 8. FACTURI CU SCADENȚĂ DEPĂȘITĂ (pentru admini)
    // ============================================
    // NOU 23.01.2026: Verifică facturile cu scadență depășită
    // EXCLUDE: facturi marcate cu exclude_notificari_plata = TRUE

    const facturiScadentaDepasitaQuery = `
      SELECT
        fg.id,
        fg.serie,
        fg.numar,
        fg.data_factura,
        fg.data_scadenta,
        fg.client_nume,
        fg.client_cui,
        fg.total,
        fg.valoare_platita,
        fg.proiect_id,
        (fg.total - COALESCE(fg.valoare_platita, 0)) as rest_de_plata,
        DATE_DIFF(CURRENT_DATE(), fg.data_scadenta, DAY) as zile_intarziere
      FROM ${TABLE_FACTURI_GENERATE} fg
      WHERE fg.data_scadenta IS NOT NULL
        AND fg.data_scadenta < CURRENT_DATE()
        AND (fg.total - COALESCE(fg.valoare_platita, 0)) > 0
        AND COALESCE(fg.is_storno, false) = false
        AND fg.stornata_de_factura_id IS NULL
        AND fg.status NOT IN ('storno', 'stornata', 'platita')
        -- ✅ NOU 23.01.2026: Exclude facturile marcate pentru excludere din notificări
        AND COALESCE(fg.exclude_notificari_plata, false) = false
      ORDER BY fg.data_scadenta ASC
      LIMIT 50
    `;

    const [facturiScadentaDepasita] = await bigquery.query({ query: facturiScadentaDepasitaQuery });
    stats.facturi_scadenta_depasita = facturiScadentaDepasita.length;
    console.log(`💳 Facturi cu scadență depășită: ${facturiScadentaDepasita.length}`);

    if (facturiScadentaDepasita.length > 0) {
      // Obține toți adminii pentru notificare
      const adminiDepasitaQuery = `
        SELECT uid, nume, prenume, email
        FROM ${TABLE_UTILIZATORI}
        WHERE rol = 'admin' AND activ = true AND email IS NOT NULL
      `;
      const [adminiDepasita] = await bigquery.query({ query: adminiDepasitaQuery });

      for (const factura of facturiScadentaDepasita) {
        const serieNumar = `${factura.serie || ''} ${factura.numar || ''}`.trim();
        const dataScadenta = extractDateValue(factura.data_scadenta);
        const zileIntarziere = parseInt(factura.zile_intarziere) || 0;

        // Verifică dacă notificarea a fost deja trimisă pentru această factură
        const dejaTrimisaDepasitaQuery = `
          SELECT COUNT(*) as count
          FROM ${TABLE_NOTIFICARI}
          WHERE tip_notificare = 'factura_scadenta_depasita'
            AND JSON_EXTRACT_SCALAR(continut_json, '$.factura_id') = @factura_id
            AND data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
        `;

        const [checkDepasitaRows] = await bigquery.query({
          query: dejaTrimisaDepasitaQuery,
          params: { factura_id: factura.id },
        });

        if ((checkDepasitaRows[0]?.count || 0) > 0) {
          console.log(`⏭️ Skip - notificare factură scadență depășită deja trimisă recent pentru ${serieNumar}`);
          continue;
        }

        const linkDetalii = `${baseUrl}/admin/rapoarte/facturi?search=${encodeURIComponent(serieNumar)}`;

        for (const admin of adminiDepasita) {
          const adminName = `${admin.nume || ''} ${admin.prenume || ''}`.trim() || 'Admin';

          const context: NotificareContext = {
            factura_id: factura.id,
            serie_factura: factura.serie,
            numar_factura: factura.numar,
            client_nume: factura.client_nume,
            suma_totala: parseFloat(factura.total) || 0,
            suma_achitata: parseFloat(factura.valoare_platita) || 0,
            data_scadenta: dataScadenta || '',
            zile_intarziere: zileIntarziere,
            user_name: adminName,
            link_detalii: linkDetalii,
          };

          await trimitereNotificareClopotel(
            baseUrl,
            'factura_scadenta_depasita',
            admin.uid,
            context,
            dryRun
          );

          addNotificationToUser(
            admin.uid,
            adminName,
            admin.email || '',
            'admin',
            {
              tip: 'proiect',
              tip_notificare: 'factura_scadenta_depasita',
              denumire: `Factură ${serieNumar} - ${factura.client_nume}`,
              proiect_id: factura.id,
              client: factura.client_nume,
              deadline: dataScadenta || '',
              zile_intarziere: zileIntarziere,
              link_detalii: linkDetalii,
            }
          );
        }
        notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Factură scadență DEPĂȘITĂ: ${serieNumar} - ${factura.client_nume} (${zileIntarziere} zile întârziere)`);
      }
    }

    // ============================================
    // 9. FACTURI NETRIMISE LA ANAF (>2 zile de la emitere)
    // ============================================
    // Verifică facturile generate care nu au ajuns în e-Factura ANAF după 2 zile
    // Trimite notificare către toți adminii

    // ✅ STORNO TRACKING (14.01.2026): Exclude facturi storno și stornate
    const facturiNetrimiseQuery = `
      SELECT
        fg.id,
        fg.serie,
        fg.numar,
        fg.data_factura,
        fg.data_creare,
        fg.client_nume,
        fg.client_cui,
        fg.total,
        fg.efactura_enabled,
        fg.efactura_status,
        fg.anaf_upload_id,
        DATE_DIFF(CURRENT_DATE(), DATE(fg.data_creare), DAY) as zile_de_la_emitere
      FROM ${TABLE_FACTURI_GENERATE} fg
      WHERE fg.data_creare >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND fg.data_creare <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)
        AND (
          -- Facturi care nu au efactura_status = 'ok' sau 'trimis'
          fg.efactura_status IS NULL
          OR fg.efactura_status NOT IN ('ok', 'trimis', 'validat', 'CONFIRMAT')
        )
        -- Excludem facturile care au un record valid în AnafEFactura_v2 cu status OK
        AND NOT EXISTS (
          SELECT 1 FROM ${TABLE_ANAF_EFACTURA} ae
          WHERE ae.factura_id = fg.id
          AND ae.anaf_status IN ('ok', 'trimis', 'validat', 'CONFIRMAT')
        )
        -- Excludem facturile care apar în FacturiEmiseANAF_v2 cu status CONFIRMAT
        -- FIX 16.01.2026: Verificăm atât prin factura_generata_id cât și prin serie+numar+valoare
        -- FIX 17.01.2026: Separat NOT EXISTS în două clauze pentru a evita eroarea BigQuery
        -- "LEFT ANTISEMI JOIN cannot be used without a condition that is an equality of fields from both sides"
        -- Match prin factura_generata_id (link direct)
        AND NOT EXISTS (
          SELECT 1 FROM ${TABLE_FACTURI_EMISE_ANAF} fea
          WHERE fea.factura_generata_id = fg.id
          AND fea.status_anaf IN ('CONFIRMAT', 'DESCARCAT')
        )
        -- Match prin serie+numar (cu spațiu) și valoare identică - ca fallback
        AND NOT EXISTS (
          SELECT 1 FROM ${TABLE_FACTURI_EMISE_ANAF} fea
          WHERE fea.serie_numar = CONCAT(fg.serie, ' ', fg.numar)
          AND ABS(COALESCE(fea.valoare_totala, 0) - COALESCE(fg.total, 0)) < 0.01
          AND fea.status_anaf IN ('CONFIRMAT', 'DESCARCAT')
        )
        -- ✅ STORNO TRACKING (14.01.2026): Exclude facturi storno și stornate
        AND COALESCE(fg.is_storno, false) = false
        AND fg.stornata_de_factura_id IS NULL
        AND fg.status NOT IN ('storno', 'stornata')
      ORDER BY fg.data_creare DESC
    `;

    const [facturiNetrimise] = await bigquery.query({ query: facturiNetrimiseQuery });
    stats.facturi_netrimise_anaf = facturiNetrimise.length;
    console.log(`📄 Facturi netrimise la ANAF (>2 zile): ${facturiNetrimise.length}`);

    if (facturiNetrimise.length > 0) {
      // Obține toți adminii pentru a le trimite notificarea
      const adminiQuery = `
        SELECT uid, nume, prenume, email
        FROM ${TABLE_UTILIZATORI}
        WHERE rol = 'admin' AND activ = true AND email IS NOT NULL
      `;

      const [admini] = await bigquery.query({ query: adminiQuery });
      console.log(`👤 Admini pentru notificare facturi ANAF: ${admini.length}`);

      for (const factura of facturiNetrimise) {
        // FIX 16.01.2026: Adăugat spațiu între serie și numar pentru căutare corectă
        const serieNumar = `${factura.serie || ''} ${factura.numar || ''}`.trim();
        const dataFactura = extractDateValue(factura.data_factura);
        const dataCreare = extractDateValue(factura.data_creare);

        // Verifică dacă notificarea a fost deja trimisă pentru această factură
        // Folosim o verificare per factură, nu per admin (pentru a nu spama)
        const dejaTrimisaQuery = `
          SELECT COUNT(*) as count
          FROM ${TABLE_NOTIFICARI}
          WHERE tip_notificare = 'factura_netrimisa_anaf'
            AND JSON_EXTRACT_SCALAR(continut_json, '$.factura_id') = @factura_id
            AND data_creare >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
        `;

        const [checkRows] = await bigquery.query({
          query: dejaTrimisaQuery,
          params: { factura_id: factura.id },
        });

        if ((checkRows[0]?.count || 0) > 0) {
          console.log(`⏭️ Skip - notificare factură netrimisă ANAF deja trimisă recent pentru ${serieNumar}`);
          continue;
        }

        // Link cu filtru de căutare după numărul facturii
        const linkDetalii = `${baseUrl}/admin/rapoarte/facturi?search=${encodeURIComponent(serieNumar)}`;

        for (const admin of admini) {
          const adminName = `${admin.nume || ''} ${admin.prenume || ''}`.trim() || 'Admin';

          const context: NotificareContext = {
            factura_id: factura.id,
            serie_factura: factura.serie,
            numar_factura: factura.numar,
            serie_numar: serieNumar,
            client_nume: factura.client_nume,
            client_cui: factura.client_cui,
            suma_totala: factura.total,
            data_factura: dataFactura || '',
            data_emitere: dataCreare || '',
            zile_de_la_emitere: factura.zile_de_la_emitere,
            efactura_status: factura.efactura_status || 'netrimis',
            user_name: adminName,
            link_detalii: linkDetalii,
          };

          // Trimite notificare în clopotel (UI) pentru fiecare admin
          const result = await trimitereNotificareClopotel(
            baseUrl,
            'factura_netrimisa_anaf',
            admin.uid,
            context,
            dryRun
          );

          // Adaugă în grupul pentru email consolidat
          addNotificationToUser(
            admin.uid,
            adminName,
            admin.email || '',
            'admin',
            {
              tip: 'proiect', // folosim 'proiect' pentru compatibilitate cu interfața existentă
              tip_notificare: 'factura_netrimisa_anaf',
              denumire: `Factură ${serieNumar} - ${factura.client_nume}`,
              proiect_id: factura.id, // folosim factura_id pentru referință
              client: factura.client_nume,
              deadline: dataFactura || '',
              zile_intarziere: factura.zile_de_la_emitere,
              link_detalii: linkDetalii,
            }
          );

          if (result.success) {
            notificariTrimise.push(`${dryRun ? '[DRY RUN] ' : ''}Factură NETRIMISĂ ANAF: ${serieNumar} - ${factura.client_nume} (${factura.zile_de_la_emitere} zile)`);
          }
        }
      }
    }

    // ============================================
    // 8. TRIMITERE EMAIL-URI CONSOLIDATE PER USER
    // ============================================
    console.log(`📧 Trimitere email-uri consolidate pentru ${userNotificationsMap.size} utilizatori...`);

    let emailsTrimise = 0;
    let emailsEsuate = 0;

    // Convertim Map la array pentru iterare compatibilă
    const userGroups = Array.from(userNotificationsMap.values());

    for (const userGroup of userGroups) {
      if (userGroup.notificari.length === 0) continue;

      const emailResult = await sendConsolidatedEmail(userGroup, baseUrl, dryRun);
      if (emailResult.success) {
        emailsTrimise++;
        console.log(`✅ Email consolidat trimis către ${userGroup.user_email} (${userGroup.notificari.length} notificări)`);
      } else {
        emailsEsuate++;
        console.log(`❌ Eroare trimitere email către ${userGroup.user_email}`);
      }
    }

    console.log(`✅ Cron notificări termene - FINISH (${notificariTrimise.length} notificări, ${emailsTrimise} email-uri consolidate, ${emailsEsuate} eșuate)`);

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      zile_avans: zileAvans,
      tables_version: tableSuffix || 'legacy',
      stats,
      notificari_trimise: notificariTrimise.length,
      emails_consolidate: {
        total_users: userNotificationsMap.size,
        trimise: emailsTrimise,
        esuate: emailsEsuate,
      },
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
