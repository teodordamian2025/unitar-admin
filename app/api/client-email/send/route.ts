// ==================================================================
// CALEA: /app/api/client-email/send/route.ts
// DATA: 29.01.2026
// DESCRIERE: API pentru trimiterea email-urilor către clienți
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { sendEmail, wrapEmailHTML, isValidEmail } from '@/lib/notifications/send-email';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const TABLE_EMAIL_LOG = `\`${PROJECT_ID}.${DATASET}.EmailClientLog_v2\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      proiect_id,
      client_id,
      client_nume,
      tip_email,
      subiect,
      continut,
      destinatari,
      template_folosit,
      trimis_de,
      trimis_de_nume
    } = body;

    // Validări
    if (!proiect_id) {
      return NextResponse.json({ error: 'proiect_id este obligatoriu' }, { status: 400 });
    }
    if (!client_id) {
      return NextResponse.json({ error: 'client_id este obligatoriu' }, { status: 400 });
    }
    if (!subiect?.trim()) {
      return NextResponse.json({ error: 'Subiectul email-ului este obligatoriu' }, { status: 400 });
    }
    if (!continut?.trim()) {
      return NextResponse.json({ error: 'Conținutul email-ului este obligatoriu' }, { status: 400 });
    }
    if (!destinatari || !Array.isArray(destinatari) || destinatari.length === 0) {
      return NextResponse.json({ error: 'Cel puțin un destinatar este obligatoriu' }, { status: 400 });
    }

    // Validare email-uri destinatari
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];

    for (const email of destinatari) {
      if (isValidEmail(email)) {
        validEmails.push(email);
      } else {
        invalidEmails.push(email);
      }
    }

    if (validEmails.length === 0) {
      return NextResponse.json({
        error: 'Niciun email valid în lista de destinatari',
        invalidEmails
      }, { status: 400 });
    }

    // Construiește HTML email
    const htmlContent = wrapEmailHTML(
      formatEmailContent(continut),
      subiect
    );

    // Trimite email
    const emailResult = await sendEmail({
      to: validEmails,
      subject: subiect.trim(),
      text: continut.trim(),
      html: htmlContent
    });

    // Generează ID unic pentru log
    const logId = `email_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // ✅ Helper pentru escape string și null (BigQuery nu acceptă parametri null fără tipuri)
    const escapeValue = (val: string | null | undefined): string => {
      if (val === null || val === undefined || val === '') return 'NULL';
      // Escape single quotes și newlines pentru BigQuery string literals
      return `'${String(val).replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
    };

    // Salvează în jurnal cu valori inline
    const insertQuery = `
      INSERT INTO ${TABLE_EMAIL_LOG}
      (id, proiect_id, client_id, client_nume, tip_email, subiect, destinatari, continut_preview, template_folosit, trimis_de, trimis_de_nume, email_status, email_message_id, email_error, data_trimitere, data_creare)
      VALUES
      (${escapeValue(logId)}, ${escapeValue(proiect_id)}, ${escapeValue(client_id)}, ${escapeValue(client_nume)}, ${escapeValue(tip_email || 'custom')}, ${escapeValue(subiect.trim())}, ${escapeValue(JSON.stringify(validEmails))}, ${escapeValue(continut.trim().substring(0, 500))}, ${escapeValue(template_folosit)}, ${escapeValue(trimis_de)}, ${escapeValue(trimis_de_nume)}, ${escapeValue(emailResult.success ? 'trimis' : 'eroare')}, ${escapeValue(emailResult.messageId)}, ${escapeValue(emailResult.error)}, TIMESTAMP('${now}'), TIMESTAMP('${now}'))
    `;

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: `Email trimis cu succes către ${validEmails.length} destinatar(i)`,
        messageId: emailResult.messageId,
        logId,
        deliveredTo: validEmails,
        invalidEmails: invalidEmails.length > 0 ? invalidEmails : undefined
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Eroare la trimiterea email-ului',
        details: emailResult.error,
        logId
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Eroare la trimiterea email-ului client:', error);
    return NextResponse.json({
      error: 'Eroare la trimiterea email-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// Formatează conținutul email pentru HTML
function formatEmailContent(content: string): string {
  // Convertește newlines în <br> și paragrafe
  const paragraphs = content.split('\n\n');

  return paragraphs.map(p => {
    const lines = p.split('\n').map(line => {
      // Detectează liste (linii care încep cu -, *, sau numere)
      if (/^[-*]\s/.test(line)) {
        return `<li>${line.substring(2)}</li>`;
      }
      if (/^\d+\.\s/.test(line)) {
        return `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
      }
      return line;
    });

    // Dacă sunt elemente de listă, wrap în <ul>
    if (lines.some(l => l.startsWith('<li>'))) {
      const listItems = lines.filter(l => l.startsWith('<li>')).join('');
      const nonListItems = lines.filter(l => !l.startsWith('<li>')).join('<br>');
      return `${nonListItems ? `<p>${nonListItems}</p>` : ''}<ul style="margin: 10px 0; padding-left: 20px;">${listItems}</ul>`;
    }

    return `<p>${lines.join('<br>')}</p>`;
  }).join('');
}
