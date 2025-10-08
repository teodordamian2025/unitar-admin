// CALEA: /app/api/notifications/send/route.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: API pentru trimitere notificări cu smart grouping și email

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';
import type {
  SendNotificationRequest,
  SendNotificationResponse,
  NotificareSetting,
  PrioritateNotificare,
  TipNotificare,
} from '@/lib/notifications/types';
import { sendNotificationEmail } from '@/lib/notifications/send-email';
import { extractDateValue } from '@/lib/notifications/types';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_NOTIFICARI = `\`${PROJECT_ID}.${DATASET}.Notificari${tableSuffix}\``;
const TABLE_NOTIFICARI_SETARI = `\`${PROJECT_ID}.${DATASET}.NotificariSetari${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// =====================================================
// POST: Trimite notificare
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const body: SendNotificationRequest = await request.json();
    const { tip_notificare, user_id, context, prioritate, force_email } = body;

    // Validare
    if (!tip_notificare || !user_id || !context) {
      return NextResponse.json(
        { error: 'Missing required fields: tip_notificare, user_id, context' },
        { status: 400 }
      );
    }

    // Convertește user_id la array
    const user_ids = Array.isArray(user_id) ? user_id : [user_id];

    // 1. Citește setări pentru acest tip de notificare
    const settingsQuery = `
      SELECT *
      FROM ${TABLE_NOTIFICARI_SETARI}
      WHERE tip_notificare = @tip_notificare
        AND activ = true
      LIMIT 1
    `;

    const [settingsRows] = await bigquery.query({
      query: settingsQuery,
      params: { tip_notificare },
    });

    if (settingsRows.length === 0) {
      return NextResponse.json(
        { error: `No active settings found for notification type: ${tip_notificare}` },
        { status: 404 }
      );
    }

    const settings = settingsRows[0] as NotificareSetting;

    // 2. Fetch user info pentru fiecare destinatar
    const usersQuery = `
      SELECT uid as user_id, nume, email
      FROM ${TABLE_UTILIZATORI}
      WHERE uid IN UNNEST(@user_ids)
    `;

    const [userRows] = await bigquery.query({
      query: usersQuery,
      params: { user_ids },
    });

    if (userRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid users found' },
        { status: 404 }
      );
    }

    const notification_ids: string[] = [];
    const email_results: boolean[] = [];

    // 3. Process fiecare destinatar
    for (const user of userRows) {
      const notification_id = uuidv4();
      const final_context = {
        ...context,
        user_name: user.nume,
        user_email: user.email,
      };

      // Build titlu și mesaj din templates
      const { renderTemplate } = await import('@/lib/notifications/send-email');
      const titlu = renderTemplate(settings.template_subiect, final_context);
      const mesaj = renderTemplate(settings.template_continut, final_context);

      // 4. Save în BigQuery (Notificari_v2) dacă canal_clopotel = true
      if (settings.canal_clopotel) {
        const insertQuery = `
          INSERT INTO ${TABLE_NOTIFICARI} (
            id, tip_notificare, user_id,
            proiect_id, subproiect_id, sarcina_id, factura_id, contract_id,
            continut_json, titlu, mesaj, link_actiune,
            citita, trimis_email, prioritate,
            data_creare, creator_id
          ) VALUES (
            @id, @tip_notificare, @user_id,
            @proiect_id, @subproiect_id, @sarcina_id, @factura_id, @contract_id,
            @continut_json, @titlu, @mesaj, @link_actiune,
            false, @trimis_email, @prioritate,
            CURRENT_DATE(), @creator_id
          )
        `;

        await bigquery.query({
          query: insertQuery,
          params: {
            id: notification_id,
            tip_notificare,
            user_id: user.user_id,
            proiect_id: context.proiect_id || null,
            subproiect_id: context.subproiect_id || null,
            sarcina_id: context.sarcina_id || null,
            factura_id: context.factura_id || null,
            contract_id: context.contract_id || null,
            continut_json: JSON.stringify(final_context),
            titlu,
            mesaj,
            link_actiune: context.link_detalii || null,
            trimis_email: settings.canal_email || force_email || false,
            prioritate: prioritate || ('normal' as PrioritateNotificare),
            creator_id: context.creator_id || null,
          },
        });

        notification_ids.push(notification_id);
      }

      // 5. Trimite email dacă canal_email = true sau force_email
      if ((settings.canal_email || force_email) && user.email) {
        try {
          const emailResult = await sendNotificationEmail(
            user.email,
            settings.template_subiect,
            settings.template_continut,
            settings.template_html,
            final_context,
            {
              cc: settings.email_cc,
              bcc: settings.email_bcc,
              replyTo: settings.email_reply_to,
            }
          );

          email_results.push(emailResult.success);

          // Update email status în BigQuery
          if (settings.canal_clopotel && notification_id) {
            const updateQuery = `
              UPDATE ${TABLE_NOTIFICARI}
              SET email_deliverat = @deliverat,
                  email_eroare = @eroare,
                  data_trimitere_email = CURRENT_TIMESTAMP()
              WHERE id = @id
            `;

            await bigquery.query({
              query: updateQuery,
              params: {
                id: notification_id,
                deliverat: emailResult.success,
                eroare: emailResult.error || null,
              },
            });
          }
        } catch (emailError: any) {
          console.error('Email send error:', emailError);
          email_results.push(false);
        }
      }
    }

    const response: SendNotificationResponse = {
      success: true,
      notification_ids,
      email_sent: email_results.some(r => r),
      errors: email_results.filter(r => !r).length > 0
        ? [`Failed to send ${email_results.filter(r => !r).length} emails`]
        : undefined,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Send notification error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// GET: Check settings pentru un tip de notificare
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tip_notificare = searchParams.get('tip_notificare');

    if (!tip_notificare) {
      return NextResponse.json(
        { error: 'Missing tip_notificare parameter' },
        { status: 400 }
      );
    }

    const query = `
      SELECT *
      FROM ${TABLE_NOTIFICARI_SETARI}
      WHERE tip_notificare = @tip_notificare
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { tip_notificare },
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Settings not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: rows[0],
    });

  } catch (error: any) {
    console.error('❌ Get settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
