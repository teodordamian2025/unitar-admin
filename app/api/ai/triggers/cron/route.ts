// app/api/ai/triggers/cron/route.ts
// Cron job pentru procesare triggers AI + remindere + generare triggers automate
// Rulează zilnic prin GitHub Actions sau manual

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const DATASET = 'PanouControlUnitar';

function extractDateValue(val: any): string {
  if (!val) return '';
  if (typeof val === 'object' && val.value) return val.value;
  return String(val);
}

// Helper pentru creare trigger (non-blocking)
async function createTrigger(trigger: {
  tip_trigger: string;
  eveniment: string;
  actiune_sugerata: string;
  mesaj_utilizator: string;
  user_id: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  context_json?: any;
  prioritate?: number;
  programare_data?: string;
  creat_de?: string;
}) {
  try {
    // Check duplicat
    const [checkRows] = await bigquery.query({
      query: `SELECT COUNT(*) as cnt FROM \`${DATASET}.AI_Triggers_v2\`
              WHERE user_id = @user_id AND eveniment = @eveniment AND entity_id = @entity_id
              AND status IN ('activ', 'afisat')`,
      params: { user_id: trigger.user_id, eveniment: trigger.eveniment, entity_id: trigger.entity_id || '' },
    });
    if (checkRows[0]?.cnt > 0) return null;

    const id = `TRIG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    await bigquery.dataset(DATASET).table('AI_Triggers_v2').insert([{
      id,
      ...trigger,
      context_json: trigger.context_json ? JSON.stringify(trigger.context_json) : null,
      prioritate: trigger.prioritate || 5,
      status: 'activ',
      programare_data: trigger.programare_data || null,
      amanat_pana_la: null,
      raspuns_utilizator: null,
      creat_de: trigger.creat_de || 'cron',
      procesat_la: null,
      creat_la: now,
      actualizat_la: now,
      data_creare: BigQuery.date(now.split('T')[0]),
    }]);
    return id;
  } catch (e: any) {
    console.warn('⚠️ Nu s-a putut crea trigger:', e.message);
    return null;
  }
}

// Helper: marchează reminder-ele procesate
async function markRemindersProcessed(reminderIds: string[]) {
  if (reminderIds.length === 0) return;
  const ids = reminderIds.map(id => `'${id}'`).join(',');
  await bigquery.query({
    query: `UPDATE \`${DATASET}.AI_Memory_v2\` SET reminder_executat = TRUE, actualizat_la = CURRENT_TIMESTAMP() WHERE id IN (${ids})`,
  });
}

// Helper: trimite notificări pentru triggers via sistemul existent
async function sendTriggerNotification(baseUrl: string, trigger: any) {
  try {
    await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tip_notificare: 'ai_sugestie',
        user_id: trigger.user_id,
        context: {
          proiect_id: trigger.entity_id || '',
          proiect_denumire: trigger.entity_name || '',
          mesaj: trigger.mesaj_utilizator,
          actiune: trigger.actiune_sugerata,
          trigger_id: trigger.id || '',
          link_detalii: trigger.entity_type === 'proiect'
            ? `/admin/rapoarte/proiecte?search=${trigger.entity_id}`
            : '/admin/rapoarte/proiecte',
        },
      }),
    });
  } catch (e) {
    // Non-blocking
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') === 'true';

    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host');
    const baseUrl = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : host
        ? `${host.includes('localhost') ? 'http' : 'https'}://${host}`
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const stats = {
      remindere_procesate: 0,
      triggers_reactivate: 0,
      proiecte_finalizate_fara_pv: 0,
      proiecte_finalizate_fara_factura: 0,
      proiecte_fara_contract: 0,
      contracte_fara_factura: 0,
      facturi_neachitate_vechi: 0,
      triggers_notificate: 0,
    };

    // ========== 1. PROCESARE REMINDERE SCADENTE ==========
    const [reminders] = await bigquery.query({
      query: `
        SELECT id, user_id, continut, entity_type, entity_id, tags
        FROM \`${DATASET}.AI_Memory_v2\`
        WHERE tip_memorie = 'reminder'
          AND reminder_executat = FALSE
          AND activ = TRUE
          AND reminder_data <= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE())
          AND (expira_la IS NULL OR expira_la > CURRENT_TIMESTAMP())
        ORDER BY prioritate DESC
        LIMIT 50
      `,
    });

    const reminderIds: string[] = [];
    for (const r of (reminders || [])) {
      stats.remindere_procesate++;
      reminderIds.push(r.id);

      if (!dryRun) {
        await createTrigger({
          tip_trigger: 'reminder',
          eveniment: 'reminder_scadent',
          actiune_sugerata: 'afiseaza_reminder',
          mesaj_utilizator: `⏰ Reminder: ${r.continut}`,
          user_id: r.user_id,
          entity_type: r.entity_type || 'general',
          entity_id: r.entity_id || '',
          prioritate: 8,
          creat_de: 'cron',
        });
        await sendTriggerNotification(baseUrl, {
          user_id: r.user_id,
          entity_id: r.entity_id,
          entity_name: '',
          mesaj_utilizator: `⏰ Reminder: ${r.continut}`,
          actiune_sugerata: 'afiseaza_reminder',
        });
      }
    }

    if (!dryRun && reminderIds.length > 0) {
      await markRemindersProcessed(reminderIds);
    }

    // ========== 2. REACTIVARE TRIGGERS AMÂNATE ==========
    if (!dryRun) {
      const [amanate] = await bigquery.query({
        query: `
          UPDATE \`${DATASET}.AI_Triggers_v2\`
          SET status = 'activ', actualizat_la = CURRENT_TIMESTAMP()
          WHERE status = 'amanat'
            AND amanat_pana_la IS NOT NULL
            AND amanat_pana_la <= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE())
        `,
      });
      stats.triggers_reactivate = (amanate as any)?.numDmlAffectedRows || 0;
    }

    // ========== 3. PROIECTE FINALIZATE FĂRĂ PV ==========
    try {
      const [proiecteFaraPV] = await bigquery.query({
        query: `
          SELECT p.ID_Proiect, p.Denumire, p.Client, p.Responsabil
          FROM \`${DATASET}.Proiecte_v2\` p
          LEFT JOIN \`${DATASET}.ProcesVerbale_v2\` pv ON pv.proiect_id = p.ID_Proiect
          WHERE p.Status IN ('Incheiat', 'Finalizat')
            AND p.status_predare IN ('Nepredat', 'In curs')
            AND pv.ID_PV IS NULL
          LIMIT 20
        `,
      });

      for (const p of (proiecteFaraPV || [])) {
        stats.proiecte_finalizate_fara_pv++;
        if (!dryRun) {
          // Găsește UID responsabil
          const uid = await getResponsabilUID(p.Responsabil);
          if (uid) {
            await createTrigger({
              tip_trigger: 'missing_document',
              eveniment: 'proiect_finalizat_fara_pv',
              actiune_sugerata: 'genereaza_pv',
              mesaj_utilizator: `📋 Proiectul "${p.Denumire}" (${p.ID_Proiect}) este finalizat dar nu are Proces Verbal. Vrei să generez PV-ul?`,
              user_id: uid,
              entity_type: 'proiect',
              entity_id: p.ID_Proiect,
              entity_name: p.Denumire,
              prioritate: 7,
              context_json: { client: p.Client },
              creat_de: 'cron',
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('⚠️ Check proiecte fara PV:', e.message);
    }

    // ========== 4. PROIECTE FINALIZATE FĂRĂ FACTURĂ ==========
    try {
      const [proiecteFaraFactura] = await bigquery.query({
        query: `
          SELECT p.ID_Proiect, p.Denumire, p.Client, p.Responsabil, p.Valoare_Estimata, p.moneda
          FROM \`${DATASET}.Proiecte_v2\` p
          LEFT JOIN \`${DATASET}.FacturiGenerate_v2\` f ON f.proiect_id = p.ID_Proiect
          WHERE p.Status IN ('Incheiat', 'Finalizat')
            AND p.status_facturare IN ('Nefacturat')
            AND f.id IS NULL
            AND p.Valoare_Estimata > 0
          LIMIT 20
        `,
      });

      for (const p of (proiecteFaraFactura || [])) {
        stats.proiecte_finalizate_fara_factura++;
        if (!dryRun) {
          const uid = await getResponsabilUID(p.Responsabil);
          if (uid) {
            const valoare = parseFloat(p.Valoare_Estimata) || 0;
            const moneda = p.moneda || 'RON';
            await createTrigger({
              tip_trigger: 'missing_document',
              eveniment: 'proiect_finalizat_fara_factura',
              actiune_sugerata: 'genereaza_factura',
              mesaj_utilizator: `💰 Proiectul "${p.Denumire}" (${p.ID_Proiect}) este finalizat dar nefacturat (${valoare.toLocaleString('ro-RO')} ${moneda}). Vrei să generez factura?`,
              user_id: uid,
              entity_type: 'proiect',
              entity_id: p.ID_Proiect,
              entity_name: p.Denumire,
              prioritate: 8,
              context_json: { client: p.Client, valoare, moneda },
              creat_de: 'cron',
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('⚠️ Check proiecte fara factura:', e.message);
    }

    // ========== 5. PROIECTE ACTIVE FĂRĂ CONTRACT ==========
    try {
      const [proiecteFaraContract] = await bigquery.query({
        query: `
          SELECT p.ID_Proiect, p.Denumire, p.Client, p.Responsabil, p.Valoare_Estimata
          FROM \`${DATASET}.Proiecte_v2\` p
          LEFT JOIN \`${DATASET}.Contracte_v2\` c ON c.proiect_id = p.ID_Proiect
          WHERE p.Status = 'Activ'
            AND p.status_contract IN ('Fara contract', 'Nu e cazul')
            AND c.ID_Contract IS NULL
            AND p.Valoare_Estimata > 0
          LIMIT 20
        `,
      });

      for (const p of (proiecteFaraContract || [])) {
        stats.proiecte_fara_contract++;
        if (!dryRun) {
          const uid = await getResponsabilUID(p.Responsabil);
          if (uid) {
            await createTrigger({
              tip_trigger: 'missing_document',
              eveniment: 'proiect_activ_fara_contract',
              actiune_sugerata: 'genereaza_contract',
              mesaj_utilizator: `📄 Proiectul activ "${p.Denumire}" (${p.ID_Proiect}) nu are contract. Vrei să generez contractul?`,
              user_id: uid,
              entity_type: 'proiect',
              entity_id: p.ID_Proiect,
              entity_name: p.Denumire,
              prioritate: 6,
              context_json: { client: p.Client },
              creat_de: 'cron',
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('⚠️ Check proiecte fara contract:', e.message);
    }

    // ========== 6. FACTURI NEACHITATE > 30 ZILE ==========
    try {
      const [facturiVechi] = await bigquery.query({
        query: `
          SELECT f.id, f.serie, f.numar, f.client_nume, f.total, f.rest_de_plata,
                 f.data_factura, f.data_scadenta, f.proiect_id
          FROM \`${DATASET}.FacturiGenerate_v2\` f
          WHERE f.status != 'Achitata'
            AND f.rest_de_plata > 0
            AND f.data_scadenta IS NOT NULL
            AND DATE_DIFF(CURRENT_DATE(), f.data_scadenta, DAY) > 30
          ORDER BY f.rest_de_plata DESC
          LIMIT 10
        `,
      });

      for (const f of (facturiVechi || [])) {
        stats.facturi_neachitate_vechi++;
        if (!dryRun) {
          // Notifică toți adminii
          const admins = await getAdminUIDs();
          for (const uid of admins) {
            const serie = f.serie || '';
            const numar = f.numar || '';
            const rest = parseFloat(f.rest_de_plata) || 0;
            await createTrigger({
              tip_trigger: 'deadline_approaching',
              eveniment: 'factura_neachitata_veche',
              actiune_sugerata: 'trimite_email_reamintire',
              mesaj_utilizator: `⚠️ Factura ${serie}-${numar} (${f.client_nume}) are ${rest.toLocaleString('ro-RO')} RON neachitați, scadentă depășită cu peste 30 zile. Vrei să trimit un email de reamintire clientului?`,
              user_id: uid,
              entity_type: 'factura',
              entity_id: f.id,
              entity_name: `${serie}-${numar}`,
              prioritate: 9,
              context_json: { client: f.client_nume, rest_de_plata: rest, proiect_id: f.proiect_id },
              creat_de: 'cron',
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('⚠️ Check facturi vechi:', e.message);
    }

    // ========== 7. NOTIFICĂ TRIGGERS ACTIVE ==========
    if (!dryRun) {
      try {
        const [activeTrigs] = await bigquery.query({
          query: `
            SELECT id, user_id, mesaj_utilizator, actiune_sugerata, entity_type, entity_id, entity_name
            FROM \`${DATASET}.AI_Triggers_v2\`
            WHERE status = 'activ'
              AND (programare_data IS NULL OR programare_data <= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE()))
            ORDER BY prioritate DESC
            LIMIT 20
          `,
        });

        for (const t of (activeTrigs || [])) {
          stats.triggers_notificate++;
          await sendTriggerNotification(baseUrl, t);
          // Mark as afisat
          await bigquery.query({
            query: `UPDATE \`${DATASET}.AI_Triggers_v2\` SET status = 'afisat', procesat_la = CURRENT_TIMESTAMP() WHERE id = @id`,
            params: { id: t.id },
          });
        }
      } catch (e: any) {
        console.warn('⚠️ Notificare triggers:', e.message);
      }
    }

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Eroare cron triggers AI:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la procesare cron' },
      { status: 500 }
    );
  }
}

// Helper: găsește UID responsabil din nume
async function getResponsabilUID(responsabilNume: string): Promise<string | null> {
  if (!responsabilNume) return null;
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT uid FROM \`${DATASET}.Utilizatori_v2\`
        WHERE LOWER(CONCAT(IFNULL(prenume,''), ' ', IFNULL(nume,''))) LIKE LOWER(@search)
           OR LOWER(CONCAT(IFNULL(nume,''), ' ', IFNULL(prenume,''))) LIKE LOWER(@search)
        LIMIT 1
      `,
      params: { search: `%${responsabilNume}%` },
    });
    return rows?.[0]?.uid || null;
  } catch {
    return null;
  }
}

// Helper: găsește toți adminii
async function getAdminUIDs(): Promise<string[]> {
  try {
    const [rows] = await bigquery.query({
      query: `SELECT uid FROM \`${DATASET}.Utilizatori_v2\` WHERE rol = 'admin' LIMIT 10`,
    });
    return (rows || []).map((r: any) => r.uid);
  } catch {
    return [];
  }
}
