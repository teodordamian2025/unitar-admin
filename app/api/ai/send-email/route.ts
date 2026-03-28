// app/api/ai/send-email/route.ts
// Endpoint pentru trimitere email de către agentul AI cu suport alias (office@ / contact@)

import { NextRequest, NextResponse } from 'next/server';
import { getEmailTransporter } from '@/lib/notifications/send-email';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const DATASET = 'PanouControlUnitar';

// Adrese de email permise ca expeditor
const ALLOWED_FROM: Record<string, string> = {
  'office@unitarproiect.eu': 'UNITAR PROIECT <office@unitarproiect.eu>',
  'contact@unitarproiect.eu': 'UNITAR PROIECT <contact@unitarproiect.eu>',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { destinatar, subiect, continut, from_address, proiect_id, sent_by, sent_by_name } = body;

    // Validare parametri obligatorii
    if (!destinatar || !subiect || !continut) {
      return NextResponse.json(
        { success: false, error: 'Parametri obligatorii lipsă: destinatar, subiect, continut' },
        { status: 400 }
      );
    }

    // Validare email destinatar
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(destinatar)) {
      return NextResponse.json(
        { success: false, error: 'Adresa email a destinatarului nu este validă' },
        { status: 400 }
      );
    }

    // Validare from_address
    const fromKey = from_address || 'office@unitarproiect.eu';
    const fromFormatted = ALLOWED_FROM[fromKey];
    if (!fromFormatted) {
      return NextResponse.json(
        { success: false, error: `Adresa expeditor "${fromKey}" nu este permisă. Permise: ${Object.keys(ALLOWED_FROM).join(', ')}` },
        { status: 400 }
      );
    }

    // Construiește HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #6366f1; }
    .header img { max-height: 50px; }
    .content { padding: 20px 0; white-space: pre-wrap; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="color: #6366f1; margin: 0;">UNITAR PROIECT</h2>
    </div>
    <div class="content">${continut.replace(/\n/g, '<br>')}</div>
    <div class="footer">
      <p>UNITAR PROIECT TDA S.R.L. | ${fromKey}</p>
    </div>
  </div>
</body>
</html>`;

    // Trimite emailul
    const transport = getEmailTransporter();
    const info = await transport.sendMail({
      from: fromFormatted,
      to: destinatar,
      subject: subiect,
      text: continut,
      html: htmlContent,
    });

    // Loggare în BigQuery (tabel Email_Client_Log_v2 dacă există)
    try {
      const logId = `EMAIL_AI_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await bigquery.dataset(DATASET).table('Email_Client_Log_v2').insert([{
        id: logId,
        destinatar,
        subiect,
        continut_text: continut.substring(0, 5000),
        from_address: fromKey,
        proiect_id: proiect_id || null,
        sent_by: sent_by || 'ai_agent',
        sent_by_name: sent_by_name || 'Asistent AI',
        message_id: info.messageId || null,
        status: 'trimis',
        sursa: 'ai_chatbot',
        data_trimitere: new Date().toISOString(),
        data_creare: BigQuery.date(new Date().toISOString().split('T')[0]),
      }]);
    } catch (logError: any) {
      // Logging e optional - nu bloca trimiterea
      console.warn('⚠️ Nu s-a putut loga emailul în BigQuery:', logError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Email trimis cu succes',
      messageId: info.messageId,
      destinatar,
      subiect,
      from_address: fromKey,
    });

  } catch (error: any) {
    console.error('❌ Eroare trimitere email AI:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare necunoscută la trimitere email' },
      { status: 500 }
    );
  }
}
