// ==================================================================
// CALEA: app/api/rapoarte/oferte/send-email/route.ts
// DATA: 04.04.2026
// DESCRIERE: API pentru trimiterea ofertelor pe email
// PATTERN: Reutilizeaza client-email/send + sendEmail din notifications
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { sendEmail, wrapEmailHTML, isValidEmail } from '@/lib/notifications/send-email';
import fs from 'fs';
import path from 'path';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;
const TABLE_EMAIL_LOG = `\`${PROJECT_ID}.${DATASET}.EmailClientLog_v2\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const escapeValue = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      oferta_id,
      tip_email, // 'oferta', 'followup', 'multumire'
      subiect,
      continut,
      destinatari,
      attach_docx,
      trimis_de,
      trimis_de_nume
    } = body;

    if (!oferta_id) {
      return NextResponse.json({ error: 'oferta_id este obligatoriu' }, { status: 400 });
    }
    if (!subiect?.trim()) {
      return NextResponse.json({ error: 'Subiectul este obligatoriu' }, { status: 400 });
    }
    if (!continut?.trim()) {
      return NextResponse.json({ error: 'Continutul este obligatoriu' }, { status: 400 });
    }
    if (!destinatari || !Array.isArray(destinatari) || destinatari.length === 0) {
      return NextResponse.json({ error: 'Cel putin un destinatar este obligatoriu' }, { status: 400 });
    }

    // Valideaza email-uri
    const validEmails = destinatari.filter((e: string) => isValidEmail(e));
    if (validEmails.length === 0) {
      return NextResponse.json({ error: 'Niciun email valid' }, { status: 400 });
    }

    // Incarca datele ofertei
    const [ofertaRows] = await bigquery.query({
      query: `SELECT * FROM ${TABLE_OFERTE} WHERE id = @id AND activ = true`,
      params: { id: oferta_id },
      location: 'EU',
    });

    if (ofertaRows.length === 0) {
      return NextResponse.json({ error: 'Oferta nu a fost gasita' }, { status: 404 });
    }

    const oferta = ofertaRows[0];

    // Pregateste atasamentul DOCX daca e cerut
    const attachments: any[] = [];
    if (attach_docx && oferta.path_fisier) {
      try {
        const filePath = path.join(process.cwd(), oferta.path_fisier);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          attachments.push({
            filename: `${oferta.numar_oferta || 'oferta'}.docx`,
            content: fileBuffer.toString('base64'),
            encoding: 'base64' as const,
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
        }
      } catch (err) {
        console.warn('Nu s-a putut atasa DOCX:', err);
      }
    }

    // Construieste HTML
    const htmlContent = wrapEmailHTML(
      formatOfertaEmail(continut),
      subiect
    );

    // Trimite email
    const emailResult = await sendEmail({
      to: validEmails,
      subject: subiect.trim(),
      text: continut.trim(),
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    // Log in EmailClientLog_v2
    const logId = `email_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await bigquery.query({
      query: `
        INSERT INTO ${TABLE_EMAIL_LOG}
        (id, proiect_id, client_id, client_nume, tip_email, subiect, destinatari, continut_preview, template_folosit, trimis_de, trimis_de_nume, email_status, email_message_id, email_error, data_trimitere, data_creare)
        VALUES
        (${escapeValue(logId)}, ${escapeValue(oferta_id)}, ${escapeValue(oferta.client_id)}, ${escapeValue(oferta.client_nume)},
         ${escapeValue(tip_email || 'oferta')}, ${escapeValue(subiect.trim())}, ${escapeValue(JSON.stringify(validEmails))},
         ${escapeValue(continut.trim().substring(0, 500))}, ${escapeValue('oferta_email')},
         ${escapeValue(trimis_de)}, ${escapeValue(trimis_de_nume)},
         ${escapeValue(emailResult.success ? 'trimis' : 'eroare')}, ${escapeValue(emailResult.messageId)},
         ${escapeValue(emailResult.error)}, TIMESTAMP('${now}'), TIMESTAMP('${now}'))
      `,
      location: 'EU',
    });

    // Daca se trimite oferta si e in Draft, actualizeaza status la Trimisa
    if (tip_email === 'oferta' && oferta.status === 'Draft') {
      const escStr = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "''");
      await bigquery.query({
        query: `
          UPDATE ${TABLE_OFERTE}
          SET status = 'Trimisa', data_trimitere = TIMESTAMP('${now}'), data_actualizare = TIMESTAMP('${now}')
          WHERE id = '${escStr(oferta_id)}' AND activ = true
        `,
        location: 'EU',
      });
    }

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        message: `Email trimis cu succes catre ${validEmails.length} destinatar(i)`,
        messageId: emailResult.messageId,
        logId,
        statusUpdated: tip_email === 'oferta' && oferta.status === 'Draft' ? 'Trimisa' : undefined
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Eroare la trimiterea email-ului',
        details: emailResult.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Eroare trimitere email oferta:', error);
    return NextResponse.json({
      error: 'Eroare la trimiterea email-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

function formatOfertaEmail(content: string): string {
  const paragraphs = content.split('\n\n');
  return paragraphs.map(p => {
    const lines = p.split('\n').map(line => {
      if (/^[-*]\s/.test(line)) return `<li>${line.substring(2)}</li>`;
      if (/^\d+\.\s/.test(line)) return `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
      return line;
    });
    if (lines.some(l => l.startsWith('<li>'))) {
      const listItems = lines.filter(l => l.startsWith('<li>')).join('');
      const nonListItems = lines.filter(l => !l.startsWith('<li>')).join('<br>');
      return `${nonListItems ? `<p>${nonListItems}</p>` : ''}<ul style="margin: 10px 0; padding-left: 20px;">${listItems}</ul>`;
    }
    return `<p>${lines.join('<br>')}</p>`;
  }).join('');
}
