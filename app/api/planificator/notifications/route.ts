// ==================================================================
// CALEA: app/api/planificator/notifications/route.ts
// DATA: 27.09.2025 16:40 (ora României)
// DESCRIERE: API pentru notificări inteligente planificator
// FUNCȚIONALITATE: GET notificări deadline-uri și sugestii adăugare items
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const DATASET_ID = 'PanouControlUnitar';

interface NotificationItem {
  id: string;
  tip: 'deadline_warning' | 'deadline_critical' | 'suggestion_add';
  titlu: string;
  mesaj: string;
  data_scadenta?: string;
  zile_ramase?: number;
  item_id?: string;
  tip_item?: string;
  urgenta: 'low' | 'medium' | 'high' | 'critical';
  actiuni?: Array<{
    tip: 'add_to_planner' | 'view_item' | 'dismiss';
    label: string;
    data?: any;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Decodează token-ul Firebase și obține UID-ul real al utilizatorului
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const notifications: NotificationItem[] = [];

    // 1. Notificări pentru deadline-uri din planificator
    const planificatorDeadlinesQuery = `
      SELECT
        p.id,
        p.tip_item,
        p.item_id,
        p.is_pinned,

        -- Date proiecte
        pr.Denumire as proiect_denumire,
        pr.Data_Final as proiect_data_final,

        -- Date subproiecte
        sp.Denumire as subproiect_denumire,
        sp.Data_Final as subproiect_data_final,
        pr2.Denumire as subproiect_proiect_nume,

        -- Date sarcini
        s.titlu as sarcina_titlu,
        s.data_scadenta as sarcina_data_scadenta,
        pr3.Denumire as sarcina_proiect_nume,

        -- Calculare zile până scadenta
        CASE
          WHEN p.tip_item = 'sarcina' AND s.data_scadenta IS NOT NULL THEN
            DATE_DIFF(s.data_scadenta, CURRENT_DATE(), DAY)
          WHEN p.tip_item = 'subproiect' AND sp.Data_Final IS NOT NULL THEN
            DATE_DIFF(sp.Data_Final, CURRENT_DATE(), DAY)
          WHEN p.tip_item = 'proiect' AND pr.Data_Final IS NOT NULL THEN
            DATE_DIFF(pr.Data_Final, CURRENT_DATE(), DAY)
          ELSE NULL
        END as zile_ramase

      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` p

      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` pr
        ON p.tip_item = 'proiect' AND p.item_id = pr.ID_Proiect

      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Subproiecte\` sp
        ON p.tip_item = 'subproiect' AND p.item_id = sp.ID_Subproiect
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` pr2
        ON sp.ID_Proiect = pr2.ID_Proiect

      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
        ON p.tip_item = 'sarcina' AND p.item_id = s.id
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` pr3
        ON s.proiect_id = pr3.ID_Proiect

      WHERE p.utilizator_uid = @userId
        AND p.activ = TRUE
      HAVING zile_ramase IS NOT NULL AND zile_ramase <= 7
      ORDER BY zile_ramase ASC
    `;

    const [deadlineRows] = await bigquery.query({
      query: planificatorDeadlinesQuery,
      params: { userId }
    });

    // Procesare notificări deadline-uri
    deadlineRows.forEach((row: any) => {
      const zileRamase = row.zile_ramase;
      let tip: 'deadline_warning' | 'deadline_critical' = 'deadline_warning';
      let urgenta: 'high' | 'critical' = 'high';

      if (zileRamase <= 0) {
        tip = 'deadline_critical';
        urgenta = 'critical';
      } else if (zileRamase <= 1) {
        urgenta = 'critical';
      }

      let nume = '';
      let dataScadenta = '';

      if (row.tip_item === 'proiect') {
        nume = row.proiect_denumire;
        dataScadenta = row.proiect_data_final?.value || row.proiect_data_final;
      } else if (row.tip_item === 'subproiect') {
        nume = `${row.subproiect_denumire} (${row.subproiect_proiect_nume})`;
        dataScadenta = row.subproiect_data_final?.value || row.subproiect_data_final;
      } else if (row.tip_item === 'sarcina') {
        nume = `${row.sarcina_titlu} (${row.sarcina_proiect_nume})`;
        dataScadenta = row.sarcina_data_scadenta?.value || row.sarcina_data_scadenta;
      }

      const notification: NotificationItem = {
        id: `deadline_${row.id}`,
        tip,
        titlu: zileRamase <= 0 ? '🚨 Deadline Expirat!' : '⚠️ Deadline Apropiat',
        mesaj: zileRamase <= 0
          ? `${nume} a expirat pe ${new Date(dataScadenta).toLocaleDateString('ro-RO')}`
          : `${nume} expiră ${zileRamase === 1 ? 'mâine' : `în ${zileRamase} zile`} (${new Date(dataScadenta).toLocaleDateString('ro-RO')})`,
        data_scadenta: dataScadenta,
        zile_ramase: zileRamase,
        item_id: row.item_id,
        tip_item: row.tip_item,
        urgenta,
        actiuni: [
          {
            tip: 'view_item',
            label: 'Vizualizează',
            data: { item_id: row.item_id, tip_item: row.tip_item }
          }
        ]
      };

      notifications.push(notification);
    });

    // 2. Sugestii pentru items cu deadline apropiat care nu sunt în planificator
    const suggestionsQuery = `
      WITH PlanificatorExistent AS (
        SELECT tip_item, item_id
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\`
        WHERE utilizator_uid = @userId AND activ = TRUE
      ),

      SarciniUrgeNote AS (
        SELECT
          'sarcina' as tip_item,
          s.id as item_id,
          s.titlu as nume,
          p.Denumire as proiect_nume,
          s.data_scadenta as data_scadenta,
          DATE_DIFF(s.data_scadenta, CURRENT_DATE(), DAY) as zile_ramase,
          s.prioritate
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
        LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` p
          ON s.proiect_id = p.ID_Proiect
        WHERE s.data_scadenta IS NOT NULL
          AND DATE_DIFF(s.data_scadenta, CURRENT_DATE(), DAY) BETWEEN 0 AND 5
          AND s.status NOT IN ('Finalizată', 'Anulată')
          AND s.id NOT IN (SELECT item_id FROM PlanificatorExistent WHERE tip_item = 'sarcina')
        ORDER BY s.data_scadenta ASC
        LIMIT 5
      )

      SELECT * FROM SarciniUrgeNote
    `;

    const [suggestionRows] = await bigquery.query({
      query: suggestionsQuery,
      params: { userId }
    });

    // Procesare sugestii
    suggestionRows.forEach((row: any) => {
      const zileRamase = row.zile_ramase;
      let urgenta: 'medium' | 'high' = 'medium';

      if (zileRamase <= 2) urgenta = 'high';

      const notification: NotificationItem = {
        id: `suggestion_${row.item_id}`,
        tip: 'suggestion_add',
        titlu: '💡 Sugestie Planificator',
        mesaj: `Sarcina "${row.nume}" din ${row.proiect_nume} expiră ${zileRamase === 0 ? 'astăzi' : zileRamase === 1 ? 'mâine' : `în ${zileRamase} zile`}. O adaugi în planificator?`,
        data_scadenta: row.data_scadenta?.value || row.data_scadenta,
        zile_ramase: zileRamase,
        item_id: row.item_id,
        tip_item: row.tip_item,
        urgenta,
        actiuni: [
          {
            tip: 'add_to_planner',
            label: 'Adaugă în Planificator',
            data: { item_id: row.item_id, tip_item: row.tip_item }
          },
          {
            tip: 'dismiss',
            label: 'Nu mulțumesc',
            data: {}
          }
        ]
      };

      notifications.push(notification);
    });

    // Sortare după urgență și deadline
    notifications.sort((a, b) => {
      const urgentaOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      const urgentaCompare = urgentaOrder[a.urgenta] - urgentaOrder[b.urgenta];

      if (urgentaCompare !== 0) return urgentaCompare;

      // Dacă urgența e la fel, sortează după zile rămase
      const aZile = a.zile_ramase ?? 999;
      const bZile = b.zile_ramase ?? 999;
      return aZile - bZile;
    });

    return NextResponse.json({
      notifications,
      count: notifications.length,
      has_critical: notifications.some(n => n.urgenta === 'critical'),
      has_high: notifications.some(n => n.urgenta === 'high')
    });

  } catch (error) {
    console.error('Error getting planificator notifications:', error);
    return NextResponse.json(
      { error: 'Failed to get planificator notifications' },
      { status: 500 }
    );
  }
}