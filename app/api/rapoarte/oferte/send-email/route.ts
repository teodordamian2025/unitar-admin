// ==================================================================
// CALEA: app/api/rapoarte/oferte/send-email/route.ts
// DATA: 08.04.2026 (refactor 01.05.2026 - multipart/form-data + PDF complet)
// DESCRIERE: API pentru trimiterea ofertelor pe email
// ACTUALIZAT:
//   - multipart/form-data in loc de JSON+base64 (rezolva 413 pe Vercel)
//   - suport pentru attach_pdf_complet (DOCX -> HTML -> PDF prin mammoth + puppeteer)
// PATTERN: Reutilizeaza generateOfertaDocx + sendEmail din notifications
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { sendEmail, wrapEmailHTML, isValidEmail } from '@/lib/notifications/send-email';
import { launchBrowser } from '@/lib/puppeteer-helper';
import { generateOfertaDocx } from '@/lib/oferte-docx-generator';
import mammoth from 'mammoth';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

const PDF_COMPLET_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; color: #2c3e50; line-height: 1.5; margin: 0; padding: 0; }
  h1 { font-size: 18pt; margin: 14pt 0 8pt; color: #2c3e50; }
  h2 { font-size: 15pt; margin: 12pt 0 6pt; color: #2c3e50; }
  h3 { font-size: 13pt; margin: 10pt 0 5pt; color: #2c3e50; }
  h4 { font-size: 12pt; margin: 8pt 0 4pt; color: #2c3e50; }
  p { margin: 5pt 0; }
  table { border-collapse: collapse; margin: 8pt 0; width: 100%; }
  td, th { border: 1px solid #b0b0b0; padding: 5pt 7pt; vertical-align: top; }
  th { background: #ecf0f1; font-weight: 600; }
  ul, ol { margin: 5pt 0 5pt 20pt; padding: 0; }
  li { margin: 2pt 0; }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  img { max-width: 100%; height: auto; }
`;

async function generatePdfCompletBuffer(oferta: any): Promise<Buffer | null> {
  let browser;
  try {
    const docxResult = await generateOfertaDocx(oferta);
    const mammothResult = await mammoth.convertToHtml({ buffer: docxResult.buffer });
    const bodyHtml = mammothResult.value || '';

    const fullHtml = `<!DOCTYPE html>
<html lang="ro"><head><meta charset="UTF-8"><title>${oferta.numar_oferta || 'Oferta'}</title><style>${PDF_COMPLET_STYLES}</style></head><body>${bodyHtml}</body></html>`;

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' }
    });
    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error('[OFERTA-EMAIL] Eroare generare PDF complet:', err);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

async function generatePdfBuffer(oferta: any): Promise<Buffer | null> {
  try {
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
      browser = await launchBrowser();
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

interface ParsedRequest {
  oferta_id: string;
  tip_email?: string;
  subiect: string;
  continut: string;
  destinatari: string[];
  attach_docx: boolean;
  attach_pdf: boolean;
  attach_pdf_complet: boolean;
  trimis_de?: string;
  trimis_de_nume?: string;
  from_address?: string;
  manual_files: Array<{ name: string; type: string; buffer: Buffer }>;
}

async function parseRequest(request: NextRequest): Promise<ParsedRequest> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const destinatariRaw = form.get('destinatari');
    let destinatari: string[] = [];
    if (typeof destinatariRaw === 'string') {
      try {
        destinatari = JSON.parse(destinatariRaw);
      } catch {
        destinatari = destinatariRaw.split(/[,;\s]+/).filter(Boolean);
      }
    }

    const manual_files: Array<{ name: string; type: string; buffer: Buffer }> = [];
    const fileEntries = form.getAll('manual_files');
    for (const entry of fileEntries) {
      if (entry instanceof File) {
        const buf = Buffer.from(await entry.arrayBuffer());
        manual_files.push({
          name: entry.name,
          type: entry.type || 'application/octet-stream',
          buffer: buf,
        });
      }
    }

    return {
      oferta_id: String(form.get('oferta_id') || ''),
      tip_email: String(form.get('tip_email') || ''),
      subiect: String(form.get('subiect') || ''),
      continut: String(form.get('continut') || ''),
      destinatari,
      attach_docx: String(form.get('attach_docx') || '') === 'true',
      attach_pdf: String(form.get('attach_pdf') || '') === 'true',
      attach_pdf_complet: String(form.get('attach_pdf_complet') || '') === 'true',
      trimis_de: String(form.get('trimis_de') || ''),
      trimis_de_nume: String(form.get('trimis_de_nume') || ''),
      from_address: String(form.get('from_address') || ''),
      manual_files,
    };
  }

  // Fallback: JSON body cu manual_attachments base64 (compatibilitate)
  const body = await request.json();
  const manual_files: Array<{ name: string; type: string; buffer: Buffer }> = [];
  if (Array.isArray(body.manual_attachments)) {
    for (const att of body.manual_attachments) {
      if (att?.name && att?.content) {
        manual_files.push({
          name: att.name,
          type: att.type || 'application/octet-stream',
          buffer: Buffer.from(att.content, 'base64'),
        });
      }
    }
  }
  return {
    oferta_id: body.oferta_id,
    tip_email: body.tip_email,
    subiect: body.subiect,
    continut: body.continut,
    destinatari: Array.isArray(body.destinatari) ? body.destinatari : [],
    attach_docx: !!body.attach_docx,
    attach_pdf: !!body.attach_pdf,
    attach_pdf_complet: !!body.attach_pdf_complet,
    trimis_de: body.trimis_de,
    trimis_de_nume: body.trimis_de_nume,
    from_address: body.from_address,
    manual_files,
  };
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseRequest(request);
    const {
      oferta_id, tip_email, subiect, continut, destinatari,
      attach_docx, attach_pdf, attach_pdf_complet,
      trimis_de, trimis_de_nume, from_address, manual_files
    } = parsed;

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

    const ALLOWED_FROM: Record<string, string> = {
      'office@unitarproiect.eu': 'UNITAR PROIECT <office@unitarproiect.eu>',
      'contact@unitarproiect.eu': 'UNITAR PROIECT <contact@unitarproiect.eu>',
    };
    if (!from_address || !ALLOWED_FROM[from_address]) {
      return NextResponse.json({ error: 'Selecteaza adresa expeditor (office@ sau contact@)' }, { status: 400 });
    }
    const fromFormatted = ALLOWED_FROM[from_address];

    const validEmails = destinatari.filter((e: string) => isValidEmail(e));
    if (validEmails.length === 0) {
      return NextResponse.json({ error: 'Niciun email valid' }, { status: 400 });
    }

    const [ofertaRows] = await bigquery.query({
      query: `SELECT * FROM ${TABLE_OFERTE} WHERE id = @id AND activ = true`,
      params: { id: oferta_id },
      location: 'EU',
    });

    if (ofertaRows.length === 0) {
      return NextResponse.json({ error: 'Oferta nu a fost gasita' }, { status: 404 });
    }

    const oferta = ofertaRows[0];

    const attachments: any[] = [];

    if (attach_pdf) {
      console.log('[OFERTA-EMAIL] Generare PDF simplificat pentru atasament...');
      const pdfBuffer = await generatePdfBuffer(oferta);
      if (pdfBuffer) {
        attachments.push({
          filename: `${oferta.numar_oferta || 'oferta'}.pdf`,
          content: pdfBuffer.toString('base64'),
          encoding: 'base64' as const,
          contentType: 'application/pdf'
        });
        console.log('[OFERTA-EMAIL] PDF simplificat generat si atasat');
      } else {
        console.warn('[OFERTA-EMAIL] Nu s-a putut genera PDF-ul simplificat');
      }
    }

    if (attach_pdf_complet) {
      console.log('[OFERTA-EMAIL] Generare PDF complet (DOCX->HTML->PDF)...');
      const pdfBuffer = await generatePdfCompletBuffer(oferta);
      if (pdfBuffer) {
        attachments.push({
          filename: `${oferta.numar_oferta || 'oferta'}_complet.pdf`,
          content: pdfBuffer.toString('base64'),
          encoding: 'base64' as const,
          contentType: 'application/pdf'
        });
        console.log('[OFERTA-EMAIL] PDF complet generat si atasat');
      } else {
        console.warn('[OFERTA-EMAIL] Nu s-a putut genera PDF-ul complet');
      }
    }

    if (attach_docx) {
      console.log('[OFERTA-EMAIL] Generare DOCX pentru atasament...');
      try {
        const docxResult = await generateOfertaDocx(oferta);
        attachments.push({
          filename: `${oferta.numar_oferta || 'oferta'}.docx`,
          content: docxResult.buffer.toString('base64'),
          encoding: 'base64' as const,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        console.log('[OFERTA-EMAIL] DOCX generat si atasat');
      } catch (err) {
        console.warn('[OFERTA-EMAIL] Eroare generare DOCX:', err);
      }
    }

    for (const file of manual_files) {
      attachments.push({
        filename: file.name,
        content: file.buffer.toString('base64'),
        encoding: 'base64' as const,
        contentType: file.type
      });
    }

    const htmlContent = wrapEmailHTML(
      formatOfertaEmail(continut),
      subiect
    );

    const emailResult = await sendEmail({
      to: validEmails,
      from: fromFormatted,
      subject: subiect.trim(),
      text: continut.trim(),
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined
    });

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
