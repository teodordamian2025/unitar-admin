// ==================================================================
// CALEA: app/api/actions/oferte/generate-pdf-complet/route.ts
// DATA: 01.05.2026
// DESCRIERE: Generare PDF complet (acelasi continut ca DOCX) prin
//            DOCX -> HTML (mammoth) -> PDF (puppeteer)
// PATTERN: Reutilizeaza generateOfertaDocx + mammoth + launchBrowser
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import mammoth from 'mammoth';
import { launchBrowser } from '@/lib/puppeteer-helper';
import { generateOfertaDocx, OfertaForDocx } from '@/lib/oferte-docx-generator';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

const PDF_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 11pt;
    color: #2c3e50;
    line-height: 1.5;
    margin: 0;
    padding: 0;
  }
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

export async function POST(request: NextRequest) {
  let browser;
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

    const oferta = ofertaRows[0] as OfertaForDocx & { numar_oferta?: string };

    let docxResult;
    try {
      docxResult = await generateOfertaDocx(oferta);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Eroare necunoscuta';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const mammothResult = await mammoth.convertToHtml({ buffer: docxResult.buffer });
    const bodyHtml = mammothResult.value || '';

    if (mammothResult.messages?.length) {
      console.log('[OFERTA-PDF-COMPLET] Mammoth warnings:', mammothResult.messages.map(m => m.message).join('; '));
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8" />
<title>${oferta.numar_oferta || 'Oferta'}</title>
<style>${PDF_STYLES}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' },
    });

    const fileName = `${sanitizeFilename(oferta.numar_oferta || 'Oferta')}_complet.pdf`;
    console.log(`[OFERTA-PDF-COMPLET] PDF generat: ${fileName}`);

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Oferta-Number': oferta.numar_oferta || '',
      },
    });
  } catch (error) {
    console.error('[OFERTA-PDF-COMPLET] Eroare:', error);
    return NextResponse.json({
      error: 'Eroare la generarea PDF complet',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
