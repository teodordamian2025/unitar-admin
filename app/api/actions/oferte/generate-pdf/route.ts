// ==================================================================
// CALEA: app/api/actions/oferte/generate-pdf/route.ts
// DATA: 08.04.2026
// DESCRIERE: Generare PDF oferta cu Puppeteer (HTML -> PDF)
// PATTERN: Adaptat din documents/generate-for-email (factura PDF)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import puppeteer from 'puppeteer';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

function sanitizeFilename(name: string): string {
  if (!name) return '';
  return name
    .replace(/ă/g, 'a').replace(/Ă/g, 'A')
    .replace(/â/g, 'a').replace(/Â/g, 'A')
    .replace(/î/g, 'i').replace(/Î/g, 'I')
    .replace(/ș/g, 's').replace(/Ș/g, 'S')
    .replace(/ț/g, 't').replace(/Ț/g, 'T')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

function formatDate(dateValue: any): string {
  if (!dateValue) return new Date().toLocaleDateString('ro-RO');
  try {
    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : String(dateValue);
    return new Date(dateStr).toLocaleDateString('ro-RO');
  } catch {
    return new Date().toLocaleDateString('ro-RO');
  }
}

const TIP_LABELS: Record<string, string> = {
  'consolidari': 'Consolidari',
  'constructii_noi': 'Constructii Noi',
  'expertiza_monument': 'Expertiza Monument',
  'expertiza_tehnica': 'Expertiza Tehnica',
  'statie_electrica': 'Statie Electrica',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oferta_id } = body;

    if (!oferta_id) {
      return NextResponse.json({ error: 'oferta_id este obligatoriu' }, { status: 400 });
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
    const tipLabel = TIP_LABELS[oferta.tip_oferta] || oferta.tip_oferta || '';
    const dataOferta = formatDate(oferta.data_oferta);
    const dataExpirare = formatDate(oferta.data_expirare);
    const termen = oferta.termen_executie || '30';

    // Grafic de plata
    const t1 = detalii.grafic_plata_t1 ?? 40;
    const t2 = detalii.grafic_plata_t2 ?? 40;
    const t3 = detalii.grafic_plata_t3 ?? 20;

    // Build services HTML
    let serviciiHtml = '';
    if (servicii.length > 1) {
      serviciiHtml = `
        <table class="services-table">
          <thead>
            <tr>
              <th style="width:40px">Nr.</th>
              <th>Serviciu</th>
              <th style="width:150px; text-align:right">Pret (${moneda})</th>
            </tr>
          </thead>
          <tbody>
            ${servicii.map((s, i) => `
              <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${s.denumire}</td>
                <td style="text-align:right">${s.pret.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ${moneda}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2" style="text-align:right; font-weight:bold">TOTAL:</td>
              <td style="text-align:right; font-weight:bold">${valoareStr} ${moneda} + TVA</td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      serviciiHtml = `<p class="price-line"><strong>Valoare oferta:</strong> ${valoareStr} ${moneda} + TVA</p>`;
    }

    // Detalii tehnice HTML
    let detaliiHtml = '';
    if (detalii.faza_proiectare) detaliiHtml += `<div class="detail-item"><strong>Faza proiectare:</strong> ${detalii.faza_proiectare}</div>`;
    if (detalii.tip_cladire) detaliiHtml += `<div class="detail-item"><strong>Tip cladire:</strong> ${detalii.tip_cladire}</div>`;
    if (detalii.regim_inaltime) detaliiHtml += `<div class="detail-item"><strong>Regim inaltime:</strong> ${detalii.regim_inaltime}</div>`;
    if (detalii.material_structura) detaliiHtml += `<div class="detail-item"><strong>Material structura:</strong> ${detalii.material_structura}</div>`;
    if (detalii.suprafata_construita) detaliiHtml += `<div class="detail-item"><strong>Suprafata construita:</strong> ${detalii.suprafata_construita}</div>`;
    if (detalii.tip_interventie) detaliiHtml += `<div class="detail-item"><strong>Tip interventie:</strong> ${detalii.tip_interventie}</div>`;
    if (detalii.scop_expertiza) detaliiHtml += `<div class="detail-item"><strong>Scop expertiza:</strong> ${detalii.scop_expertiza}</div>`;
    if (detalii.cod_lmi) detaliiHtml += `<div class="detail-item"><strong>Cod LMI:</strong> ${detalii.cod_lmi}</div>`;
    if (detalii.categorie_monument) detaliiHtml += `<div class="detail-item"><strong>Categorie monument:</strong> ${detalii.categorie_monument}</div>`;
    if (detalii.structura_propusa) detaliiHtml += `<div class="detail-item"><strong>Structura propusa:</strong> ${detalii.structura_propusa}</div>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
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
          .payment-schedule { margin-top: 10px; }
          .payment-schedule table { width: 100%; border-collapse: collapse; }
          .payment-schedule th { background: #f8f0fc; padding: 6px 10px; font-size: 10px; text-align: center; border: 1px solid #ddd; }
          .payment-schedule td { padding: 6px 10px; font-size: 11px; text-align: center; border: 1px solid #ddd; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #95a5a6; border-top: 1px solid #ddd; padding-top: 10px; }
          .description { margin: 10px 0; font-size: 11px; line-height: 1.6; white-space: pre-wrap; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { text-align: center; width: 40%; }
          .sig-box .line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>OFERTA DE PRET</h1>
          <div class="company">UNITAR PROIECT TDA SRL</div>
          <div class="oferta-number">${oferta.numar_oferta || ''} / ${dataOferta}</div>
          ${tipLabel ? `<div style="font-size:12px; color:#7f8c8d; margin-top:4px">Tip: ${tipLabel}</div>` : ''}
        </div>

        <div class="meta-info">
          <div class="meta-box">
            <h3>Furnizor</h3>
            <div class="info-line"><strong>UNITAR PROIECT TDA SRL</strong></div>
            <div class="info-line">CUI: ${process.env.UNITAR_CUI || '35639210'}</div>
            <div class="info-line">${process.env.UNITAR_ADRESA || ''}</div>
            <div class="info-line">Tel: ${process.env.UNITAR_TELEFON || '0765 486 044'}</div>
            <div class="info-line">Email: ${process.env.UNITAR_EMAIL || 'contact@unitarproiect.eu'}</div>
          </div>
          <div class="meta-box">
            <h3>Client / Beneficiar</h3>
            <div class="info-line"><strong>${oferta.client_nume || ''}</strong></div>
            ${oferta.client_cui ? `<div class="info-line">CUI: ${oferta.client_cui}</div>` : ''}
            ${oferta.client_adresa ? `<div class="info-line">${oferta.client_adresa}</div>` : ''}
            ${oferta.client_telefon ? `<div class="info-line">Tel: ${oferta.client_telefon}</div>` : ''}
            ${oferta.client_email ? `<div class="info-line">Email: ${oferta.client_email}</div>` : ''}
          </div>
        </div>

        <div class="section">
          <h3>Obiectul ofertei</h3>
          <div class="info-line"><strong>${oferta.proiect_denumire || ''}</strong></div>
          ${oferta.proiect_adresa ? `<div class="info-line">Adresa: ${oferta.proiect_adresa}</div>` : ''}
          ${oferta.proiect_descriere ? `<div class="description">${oferta.proiect_descriere}</div>` : ''}
        </div>

        ${detaliiHtml ? `
        <div class="section">
          <h3>Detalii tehnice</h3>
          ${detaliiHtml}
        </div>
        ` : ''}

        <div class="section">
          <h3>Oferta financiara</h3>
          ${serviciiHtml}
          <div class="info-line" style="margin-top:10px"><strong>Termen de executie:</strong> ${termen} zile lucratoare</div>
          <div class="info-line"><strong>Valabilitate oferta:</strong> pana la ${dataExpirare}</div>
        </div>

        <div class="section">
          <h3>Grafic de plata</h3>
          <div class="payment-schedule">
            <table>
              <thead>
                <tr>
                  <th>T1 - La semnare contract</th>
                  <th>T2 - Predare electronica</th>
                  <th>T3 - Predare finala</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${t1}%</td>
                  <td>${t2}%</td>
                  <td>${t3}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        ${oferta.observatii ? `
        <div class="section">
          <h3>Observatii</h3>
          <div class="description">${oferta.observatii}</div>
        </div>
        ` : ''}

        <div class="signatures">
          <div class="sig-box">
            <strong>Furnizor</strong>
            <div>UNITAR PROIECT TDA SRL</div>
            <div class="line">Semnatura si stampila</div>
          </div>
          <div class="sig-box">
            <strong>Beneficiar</strong>
            <div>${oferta.client_nume || ''}</div>
            <div class="line">Semnatura si stampila</div>
          </div>
        </div>

        <div class="footer">
          Document generat automat de UNITAR PROIECT TDA SRL | contact@unitarproiect.eu | 0765 486 044
        </div>
      </body>
      </html>
    `;

    // Generate PDF with Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
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

      const fileName = `${sanitizeFilename(oferta.numar_oferta || 'Oferta')}.pdf`;

      console.log(`[OFERTA-PDF] PDF generat: ${fileName}`);

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'X-Oferta-Number': oferta.numar_oferta || '',
        },
      });

    } finally {
      if (browser) {
        await browser.close();
      }
    }

  } catch (error) {
    console.error('[OFERTA-PDF] Eroare:', error);
    return NextResponse.json({
      error: 'Eroare la generarea PDF-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
