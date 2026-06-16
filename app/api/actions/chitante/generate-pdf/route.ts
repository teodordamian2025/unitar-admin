// ==================================================================
// CALEA: app/api/actions/chitante/generate-pdf/route.ts
// DATA: 16.06.2026
// DESCRIERE: Generare PDF chitanta cu Puppeteer (HTML -> PDF)
// PATTERN: Adaptat din actions/oferte/generate-pdf
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { launchBrowser } from '@/lib/puppeteer-helper';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_CHITANTE = `\`${PROJECT_ID}.${DATASET}.Chitante${tableSuffix}\``;

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
    .substring(0, 60);
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

function escapeHtml(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Conversie sumă în litere (lei + bani) - limba română
function numarInLitere(n: number): string {
  const unitati = ['', 'unu', 'doi', 'trei', 'patru', 'cinci', 'sase', 'sapte', 'opt', 'noua'];
  const unitatiF = ['', 'una', 'doua', 'trei', 'patru', 'cinci', 'sase', 'sapte', 'opt', 'noua'];
  const special = ['zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'saisprezece', 'saptesprezece', 'optsprezece', 'nouasprezece'];
  const zeci = ['', '', 'douazeci', 'treizeci', 'patruzeci', 'cincizeci', 'saizeci', 'saptezeci', 'optzeci', 'nouazeci'];

  function sub1000(x: number, gen: 'm' | 'f'): string {
    let result = '';
    const sute = Math.floor(x / 100);
    const rest = x % 100;
    if (sute > 0) {
      if (sute === 1) result += 'o suta';
      else if (sute === 2) result += 'doua sute';
      else result += unitati[sute] + ' sute';
    }
    if (rest > 0) {
      if (result) result += ' ';
      if (rest < 10) {
        result += (gen === 'f' ? unitatiF[rest] : unitati[rest]);
      } else if (rest < 20) {
        result += special[rest - 10];
      } else {
        const z = Math.floor(rest / 10);
        const u = rest % 10;
        result += zeci[z];
        if (u > 0) result += ' si ' + (gen === 'f' ? unitatiF[u] : unitati[u]);
      }
    }
    return result;
  }

  if (n === 0) return 'zero';
  let result = '';
  const milioane = Math.floor(n / 1000000);
  const mii = Math.floor((n % 1000000) / 1000);
  const restul = n % 1000;

  if (milioane > 0) {
    if (milioane === 1) result += 'un milion';
    else result += sub1000(milioane, 'm') + ' milioane';
  }
  if (mii > 0) {
    if (result) result += ' ';
    if (mii === 1) result += 'o mie';
    else result += sub1000(mii, 'f') + ' mii';
  }
  if (restul > 0) {
    if (result) result += ' ';
    result += sub1000(restul, 'm');
  }
  return result.trim();
}

function sumaInLitere(valoare: number): string {
  const lei = Math.floor(valoare);
  const bani = Math.round((valoare - lei) * 100);
  let result = numarInLitere(lei) + (lei === 1 ? ' leu' : ' lei');
  if (bani > 0) {
    result += ' si ' + numarInLitere(bani) + (bani === 1 ? ' ban' : ' bani');
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chitanta_id } = body;

    if (!chitanta_id) {
      return NextResponse.json({ error: 'chitanta_id este obligatoriu' }, { status: 400 });
    }

    const [rows] = await bigquery.query({
      query: `SELECT * FROM ${TABLE_CHITANTE} WHERE id = @id`,
      params: { id: chitanta_id },
      types: { id: 'STRING' },
      location: 'EU',
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Chitanta nu a fost gasita' }, { status: 404 });
    }

    const c = rows[0];

    const valoare = typeof c.valoare_incasata === 'object' && c.valoare_incasata && 'value' in c.valoare_incasata
      ? parseFloat(c.valoare_incasata.value)
      : parseFloat(c.valoare_incasata) || 0;
    const moneda = c.moneda || 'RON';
    const valoareStr = valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const valoareLitere = sumaInLitere(valoare);

    const numarChitanta = `${c.serie ? c.serie + '-' : ''}${c.numar || ''}`;
    const dataChitanta = formatDate(c.data_chitanta);
    const facturaRef = `${c.factura_serie ? c.factura_serie + '-' : ''}${c.factura_numar || ''}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; padding: 30px 40px; color: #2c3e50; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 3px solid #16a34a; padding-bottom: 15px; }
          .header h1 { font-size: 24px; color: #16a34a; margin-bottom: 5px; letter-spacing: 2px; }
          .header .company { font-size: 14px; color: #555; }
          .header .chitanta-number { font-size: 16px; font-weight: bold; color: #2c3e50; margin-top: 10px; }
          .header .data { font-size: 12px; color: #7f8c8d; margin-top: 3px; }
          .emitent-box { margin-bottom: 25px; padding: 12px 16px; background: #f0fdf4; border-radius: 6px; border-left: 4px solid #16a34a; }
          .emitent-box h3 { font-size: 12px; color: #16a34a; margin-bottom: 6px; text-transform: uppercase; }
          .info-line { margin-bottom: 4px; font-size: 12px; line-height: 1.5; }
          .body-text { margin: 25px 0; font-size: 13px; line-height: 2; }
          .body-text .field { font-weight: bold; border-bottom: 1px dotted #999; padding: 0 4px; }
          .suma-box { margin: 25px 0; padding: 16px; background: #f8fafc; border: 2px solid #16a34a; border-radius: 8px; text-align: center; }
          .suma-box .valoare { font-size: 26px; font-weight: bold; color: #16a34a; }
          .suma-box .litere { font-size: 12px; color: #555; margin-top: 6px; font-style: italic; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
          .sig-box { text-align: center; width: 40%; }
          .sig-box .line { border-top: 1px solid #333; margin-top: 45px; padding-top: 5px; font-size: 11px; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #95a5a6; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CHITANȚĂ</h1>
          <div class="company">UNITAR PROIECT TDA SRL</div>
          <div class="chitanta-number">Nr. ${escapeHtml(numarChitanta)}</div>
          <div class="data">Data: ${escapeHtml(dataChitanta)}</div>
        </div>

        <div class="emitent-box">
          <h3>Emitent</h3>
          <div class="info-line"><strong>UNITAR PROIECT TDA SRL</strong></div>
          <div class="info-line">CUI: ${escapeHtml(process.env.UNITAR_CUI || '35639210')}</div>
          ${process.env.UNITAR_ADRESA ? `<div class="info-line">${escapeHtml(process.env.UNITAR_ADRESA)}</div>` : ''}
          ${process.env.UNITAR_TELEFON ? `<div class="info-line">Tel: ${escapeHtml(process.env.UNITAR_TELEFON)}</div>` : ''}
          ${process.env.UNITAR_EMAIL ? `<div class="info-line">Email: ${escapeHtml(process.env.UNITAR_EMAIL)}</div>` : ''}
        </div>

        <div class="body-text">
          Am primit de la <span class="field">${escapeHtml(c.client_nume || '-')}</span>
          ${c.client_cui ? `, CUI/CNP <span class="field">${escapeHtml(c.client_cui)}</span>` : ''},
          suma de <span class="field">${valoareStr} ${escapeHtml(moneda)}</span>,
          reprezentând <span class="field">${escapeHtml(c.descriere || `contravaloare factura ${facturaRef}`)}</span>${facturaRef ? `, aferentă facturii <span class="field">${escapeHtml(facturaRef)}</span>` : ''}.
        </div>

        <div class="suma-box">
          <div class="valoare">${valoareStr} ${escapeHtml(moneda)}</div>
          <div class="litere">(${escapeHtml(valoareLitere)})</div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <strong>Casier / Emitent</strong>
            ${c.reprezentant_legal ? `<div>${escapeHtml(c.reprezentant_legal)}</div>` : ''}
            <div class="line">Semnătura</div>
          </div>
          <div class="sig-box">
            <strong>Am predat</strong>
            <div>${escapeHtml(c.client_nume || '')}</div>
            <div class="line">Semnătura</div>
          </div>
        </div>

        <div class="footer">
          Document generat automat de UNITAR PROIECT TDA SRL | ${escapeHtml(process.env.UNITAR_EMAIL || 'contact@unitarproiect.eu')}
        </div>
      </body>
      </html>
    `;

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

      const fileName = `Chitanta_${sanitizeFilename(numarChitanta || c.id)}.pdf`;

      console.log(`[CHITANTA-PDF] PDF generat: ${fileName}`);

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });

    } finally {
      if (browser) {
        await browser.close();
      }
    }

  } catch (error) {
    console.error('[CHITANTA-PDF] Eroare:', error);
    return NextResponse.json({
      error: 'Eroare la generarea PDF-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
