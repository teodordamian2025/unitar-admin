// ==================================================================
// CALEA: app/api/rapoarte/oferte/send-email/route.ts
// DATA: 08.04.2026
// DESCRIERE: API pentru trimiterea ofertelor pe email
// ACTUALIZAT: Adaugat generare PDF on-the-fly, DOCX on-the-fly, manual attachments
// PATTERN: Reutilizeaza client-email/send + sendEmail din notifications
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { sendEmail, wrapEmailHTML, isValidEmail } from '@/lib/notifications/send-email';
import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
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

// Generate DOCX buffer from template (same logic as generate/route.ts but returns buffer)
async function generateDocxBuffer(oferta: any): Promise<Buffer | null> {
  const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'oferte', 'templates');
  const TEMPLATE_MAP: Record<string, string> = {
    'consolidari': 'Oferta_Consolidari.docx',
    'constructii_noi': 'Oferta_Constructii_Noi.docx',
    'expertiza_monument': 'Oferta_Expertiza_Monument.docx',
    'expertiza_tehnica': 'Oferta_Expertiza_Tehnica.docx',
    'statie_electrica': 'Oferta_Statie_Electrica_Model.docx',
  };

  const tipOferta = oferta.tip_oferta || 'expertiza_tehnica';
  const templateFile = TEMPLATE_MAP[tipOferta];
  if (!templateFile) return null;

  const templatePath = path.join(TEMPLATES_DIR, templateFile);
  if (!existsSync(templatePath)) return null;

  try {
    const templateBuffer = await readFile(templatePath);
    const zip = new JSZip();
    await zip.loadAsync(templateBuffer);
    // Return the template as-is for attachment (full generation is complex)
    // The user should generate DOCX first via the dedicated endpoint
    return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
  } catch {
    return null;
  }
}

// Generate PDF buffer using Puppeteer
async function generatePdfBuffer(oferta: any): Promise<Buffer | null> {
  try {
    const puppeteer = await import('puppeteer');

    const valoare = typeof oferta.valoare === 'object' && oferta.valoare && 'value' in oferta.valoare
      ? parseFloat(oferta.valoare.value)
      : parseFloat(oferta.valoare) || 0;
    const moneda = oferta.moneda || 'EUR';
    const valoareStr = valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let detalii: any = {};
    if (oferta.detalii_tehnice) {
      try { detalii = JSON.parse(oferta.detalii_tehnice); } catch { /* ignore */ }
    }

    const servicii: Array<{denumire: string; pret: number}> = detalii.servicii || [];

    const formatDate = (dateValue: any): string => {
      if (!dateValue) return new Date().toLocaleDateString('ro-RO');
      try {
        const dateStr = typeof dateValue === 'object' && dateValue.value ? dateValue.value : String(dateValue);
        return new Date(dateStr).toLocaleDateString('ro-RO');
      } catch { return new Date().toLocaleDateString('ro-RO'); }
    };

    const dataOferta = formatDate(oferta.data_oferta);
    const dataExpirare = formatDate(oferta.data_expirare);
    const termen = oferta.termen_executie || '30';
    const t1 = detalii.grafic_plata_t1 ?? 40;
    const t2 = detalii.grafic_plata_t2 ?? 40;
    const t3 = detalii.grafic_plata_t3 ?? 20;

    let serviciiHtml = '';
    if (servicii.length > 1) {
      serviciiHtml = `
        <table class="services-table">
          <thead><tr><th style="width:40px">Nr.</th><th>Serviciu</th><th style="width:150px; text-align:right">Pret (${moneda})</th></tr></thead>
          <tbody>
            ${servicii.map((s, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${s.denumire}</td><td style="text-align:right">${s.pret.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ${moneda}</td></tr>`).join('')}
            <tr class="total-row"><td colspan="2" style="text-align:right; font-weight:bold">TOTAL:</td><td style="text-align:right; font-weight:bold">${valoareStr} ${moneda} + TVA</td></tr>
          </tbody>
        </table>`;
    } else {
      serviciiHtml = `<p class="price-line"><strong>Valoare oferta:</strong> ${valoareStr} ${moneda} + TVA</p>`;
    }

    let detaliiHtml = '';
    if (detalii.faza_proiectare) detaliiHtml += `<div class="detail-item"><strong>Faza proiectare:</strong> ${detalii.faza_proiectare}</div>`;
    if (detalii.tip_cladire) detaliiHtml += `<div class="detail-item"><strong>Tip cladire:</strong> ${detalii.tip_cladire}</div>`;
    if (detalii.regim_inaltime) detaliiHtml += `<div class="detail-item"><strong>Regim inaltime:</strong> ${detalii.regim_inaltime}</div>`;
    if (detalii.tip_interventie) detaliiHtml += `<div class="detail-item"><strong>Tip interventie:</strong> ${detalii.tip_interventie}</div>`;
    if (detalii.scop_expertiza) detaliiHtml += `<div class="detail-item"><strong>Scop expertiza:</strong> ${detalii.scop_expertiza}</div>`;

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 30px 40px; color: #2c3e50; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #8e44ad; padding-bottom: 15px; }
      .header h1 { font-size: 22px; color: #8e44ad; margin-bottom: 5px; }
      .header .company { font-size: 14px; color: #7f8c8d; }
      .header .oferta-number { font-size: 16px; font-weight: bold; color: #2c3e50; margin-top: 8px; }
      .meta-info { display: flex; justify-content: space-between; margin-bottom: 25px; }
      .meta-box { width: 48%; }
      .meta-box h3 { font-size: 13px; color: #8e44ad; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
      .info-line { margin-bottom: 4px; font-size: 11px; line-height: 1.5; }
      .section { margin-bottom: 20px; }
      .section h3 { font-size: 13px; color: #8e44ad; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
      .services-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      .services-table th { background: #8e44ad; color: white; padding: 8px 10px; font-size: 11px; text-align: left; }
      .services-table td { padding: 7px 10px; border-bottom: 1px solid #ecf0f1; font-size: 11px; }
      .services-table .total-row td { border-top: 2px solid #8e44ad; padding-top: 10px; font-size: 12px; }
      .price-line { font-size: 14px; margin: 10px 0; padding: 10px; background: #f8f0fc; border-radius: 6px; }
      .detail-item { margin-bottom: 4px; font-size: 11px; }
      .payment-schedule table { width: 100%; border-collapse: collapse; }
      .payment-schedule th { background: #f8f0fc; padding: 6px 10px; font-size: 10px; text-align: center; border: 1px solid #ddd; }
      .payment-schedule td { padding: 6px 10px; font-size: 11px; text-align: center; border: 1px solid #ddd; }
      .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #95a5a6; border-top: 1px solid #ddd; padding-top: 10px; }
      .description { margin: 10px 0; font-size: 11px; line-height: 1.6; white-space: pre-wrap; }
      .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
      .sig-box { text-align: center; width: 40%; }
      .sig-box .line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 11px; }
    </style></head><body>
      <div class="header">
        <h1>OFERTA DE PRET</h1>
        <div class="company">UNITAR PROIECT TDA SRL</div>
        <div class="oferta-number">${oferta.numar_oferta || ''} / ${dataOferta}</div>
      </div>
      <div class="meta-info">
        <div class="meta-box">
          <h3>Furnizor</h3>
          <div class="info-line"><strong>UNITAR PROIECT TDA SRL</strong></div>
          <div class="info-line">CUI: ${process.env.UNITAR_CUI || '35639210'}</div>
          <div class="info-line">Tel: ${process.env.UNITAR_TELEFON || '0765 486 044'}</div>
          <div class="info-line">Email: ${process.env.UNITAR_EMAIL || 'contact@unitarproiect.eu'}</div>
        </div>
        <div class="meta-box">
          <h3>Client / Beneficiar</h3>
          <div class="info-line"><strong>${oferta.client_nume || ''}</strong></div>
          ${oferta.client_cui ? `<div class="info-line">CUI: ${oferta.client_cui}</div>` : ''}
          ${oferta.client_adresa ? `<div class="info-line">${oferta.client_adresa}</div>` : ''}
          ${oferta.client_email ? `<div class="info-line">Email: ${oferta.client_email}</div>` : ''}
        </div>
      </div>
      <div class="section">
        <h3>Obiectul ofertei</h3>
        <div class="info-line"><strong>${oferta.proiect_denumire || ''}</strong></div>
        ${oferta.proiect_adresa ? `<div class="info-line">Adresa: ${oferta.proiect_adresa}</div>` : ''}
        ${oferta.proiect_descriere ? `<div class="description">${oferta.proiect_descriere}</div>` : ''}
      </div>
      ${detaliiHtml ? `<div class="section"><h3>Detalii tehnice</h3>${detaliiHtml}</div>` : ''}
      <div class="section">
        <h3>Oferta financiara</h3>
        ${serviciiHtml}
        <div class="info-line" style="margin-top:10px"><strong>Termen de executie:</strong> ${termen} zile lucratoare</div>
        <div class="info-line"><strong>Valabilitate oferta:</strong> pana la ${dataExpirare}</div>
      </div>
      <div class="section">
        <h3>Grafic de plata</h3>
        <div class="payment-schedule">
          <table><thead><tr><th>T1 - La semnare</th><th>T2 - Predare electronica</th><th>T3 - Predare finala</th></tr></thead>
          <tbody><tr><td>${t1}%</td><td>${t2}%</td><td>${t3}%</td></tr></tbody></table>
        </div>
      </div>
      ${oferta.observatii ? `<div class="section"><h3>Observatii</h3><div class="description">${oferta.observatii}</div></div>` : ''}
      <div class="signatures">
        <div class="sig-box"><strong>Furnizor</strong><div>UNITAR PROIECT TDA SRL</div><div class="line">Semnatura si stampila</div></div>
        <div class="sig-box"><strong>Beneficiar</strong><div>${oferta.client_nume || ''}</div><div class="line">Semnatura si stampila</div></div>
      </div>
      <div class="footer">Document generat automat de UNITAR PROIECT TDA SRL | contact@unitarproiect.eu | 0765 486 044</div>
    </body></html>`;

    let browser;
    try {
      browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
      });
      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) await browser.close();
    }
  } catch (err) {
    console.error('[OFERTA-EMAIL] Eroare generare PDF:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      oferta_id,
      tip_email,
      subiect,
      continut,
      destinatari,
      attach_docx,
      attach_pdf,
      manual_attachments,
      trimis_de,
      trimis_de_nume,
      from_address
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

    // Validare from_address
    const ALLOWED_FROM: Record<string, string> = {
      'office@unitarproiect.eu': 'UNITAR PROIECT <office@unitarproiect.eu>',
      'contact@unitarproiect.eu': 'UNITAR PROIECT <contact@unitarproiect.eu>',
    };
    if (!from_address || !ALLOWED_FROM[from_address]) {
      return NextResponse.json({ error: 'Selecteaza adresa expeditor (office@ sau contact@)' }, { status: 400 });
    }
    const fromFormatted = ALLOWED_FROM[from_address];

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

    // Pregateste atasamentele
    const attachments: any[] = [];

    // Atasament PDF (generat on-the-fly)
    if (attach_pdf) {
      console.log('[OFERTA-EMAIL] Generare PDF pentru atasament...');
      const pdfBuffer = await generatePdfBuffer(oferta);
      if (pdfBuffer) {
        attachments.push({
          filename: `${oferta.numar_oferta || 'oferta'}.pdf`,
          content: pdfBuffer.toString('base64'),
          encoding: 'base64' as const,
          contentType: 'application/pdf'
        });
        console.log('[OFERTA-EMAIL] PDF generat si atasat');
      } else {
        console.warn('[OFERTA-EMAIL] Nu s-a putut genera PDF-ul');
      }
    }

    // Atasament DOCX (generat on-the-fly din template)
    if (attach_docx) {
      console.log('[OFERTA-EMAIL] Generare DOCX pentru atasament...');
      // First try to use the dedicated generate endpoint to get a properly filled DOCX
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000';

        const genResponse = await fetch(`${baseUrl}/api/actions/oferte/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oferta_id: oferta.id })
        });

        if (genResponse.ok) {
          const docxBuffer = Buffer.from(await genResponse.arrayBuffer());
          attachments.push({
            filename: `${oferta.numar_oferta || 'oferta'}.docx`,
            content: docxBuffer.toString('base64'),
            encoding: 'base64' as const,
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
          console.log('[OFERTA-EMAIL] DOCX generat si atasat');
        } else {
          console.warn('[OFERTA-EMAIL] Nu s-a putut genera DOCX-ul via API');
        }
      } catch (err) {
        console.warn('[OFERTA-EMAIL] Eroare generare DOCX:', err);
      }
    }

    // Atasamente manuale (fisiere uploadate din calculator)
    if (manual_attachments && Array.isArray(manual_attachments)) {
      for (const att of manual_attachments) {
        if (att.name && att.content) {
          attachments.push({
            filename: att.name,
            content: att.content,
            encoding: 'base64' as const,
            contentType: att.type || 'application/octet-stream'
          });
        }
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
      from: fromFormatted,
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
      const attachInfo = attachments.length > 0
        ? ` cu ${attachments.length} atasament(e)`
        : '';
      return NextResponse.json({
        success: true,
        message: `Email trimis cu succes catre ${validEmails.length} destinatar(i)${attachInfo}`,
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
