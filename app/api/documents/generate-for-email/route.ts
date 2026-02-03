// ==================================================================
// CALEA: app/api/documents/generate-for-email/route.ts
// DATA: 03.02.2026
// DESCRIERE: API pentru generarea documentelor pentru atașare la email
// SCOP: Generează facturi (PDF), contracte (DOCX), PV-uri (DOCX) on-demand
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_FACTURI = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_CONTRACTE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const TABLE_PV = `\`${PROJECT_ID}.${DATASET}.ProcesVerbale${tableSuffix}\``;
const TABLE_SETARI_BANCA = `\`${PROJECT_ID}.${DATASET}.SetariBanca\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// ========== HELPER FUNCTIONS ==========

// Curățare caractere speciale pentru filename
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

// Curățare diacritice pentru PDF
function cleanNonAscii(text: string): string {
  if (!text) return '';
  return text
    .replace(/ă/g, 'a').replace(/Ă/g, 'A')
    .replace(/â/g, 'a').replace(/Â/g, 'A')
    .replace(/î/g, 'i').replace(/Î/g, 'I')
    .replace(/ș/g, 's').replace(/Ș/g, 'S')
    .replace(/ț/g, 't').replace(/Ț/g, 'T');
}

// Formatare date BigQuery
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

// Încarcă conturi bancare
async function loadContariBancare() {
  try {
    const [rows] = await bigquery.query({
      query: `SELECT nume_banca, iban, cont_principal FROM ${TABLE_SETARI_BANCA} ORDER BY cont_principal DESC`,
      location: 'EU',
    });
    return rows || [];
  } catch {
    return [
      { nume_banca: 'ING Bank', iban: 'RO82INGB0000999905667533', cont_principal: true },
      { nume_banca: 'Trezorerie', iban: 'RO29TREZ7035069XXX018857', cont_principal: false }
    ];
  }
}

// ========== FACTURA PDF GENERATION ==========

async function generateFacturaPDF(facturaId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  console.log(`[GENERATE-DOC] Generare PDF factură: ${facturaId}`);

  // Încarcă datele facturii
  const [rows] = await bigquery.query({
    query: `SELECT * FROM ${TABLE_FACTURI} WHERE id = @facturaId`,
    params: { facturaId },
    types: { facturaId: 'STRING' },
    location: 'EU',
  });

  if (rows.length === 0) {
    console.error(`[GENERATE-DOC] Factura ${facturaId} nu a fost găsită`);
    return null;
  }

  const factura = rows[0];
  const numarComplet = factura.serie ? `${factura.serie}-${factura.numar}` : factura.numar;

  // Parsează datele complete
  let dateComplete: any = {};
  try {
    if (factura.date_complete_json) {
      dateComplete = JSON.parse(factura.date_complete_json);
    }
  } catch {
    console.log('[GENERATE-DOC] Nu s-au putut parsa datele complete JSON');
  }

  const clientInfo = dateComplete.clientInfo || {
    nume: factura.client_nume || 'Client necunoscut',
    cui: factura.client_cui || 'CUI necunoscut',
    nr_reg_com: 'N/A',
    adresa: 'Adresa necunoscuta',
    telefon: 'N/A',
    email: 'N/A',
    tip_client: 'persoana_juridica'
  };

  const liniiFactura = dateComplete.liniiFactura || [{
    denumire: 'Servicii facturate',
    cantitate: 1,
    pretUnitar: factura.subtotal || 0,
    cotaTva: factura.total_tva > 0 ? 21 : 0
  }];

  const contariBancare = await loadContariBancare();
  const isPersoanaFizica = clientInfo.tip_client === 'persoana_fizica';

  const safeFormat = (num: number) => (Number(num) || 0).toFixed(2);

  // Generează HTML pentru factură
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 18px; color: #2c3e50; }
        .company-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .company-left, .company-right { width: 48%; }
        .company-left h3, .company-right h3 { font-size: 13px; color: #34495e; border-bottom: 1px solid #bdc3c7; padding-bottom: 4px; margin-bottom: 8px; }
        .info-line { margin-bottom: 3px; font-size: 10px; }
        .invoice-details { background: #f8f9fa; padding: 12px; margin-bottom: 15px; }
        .invoice-number { font-size: 14px; font-weight: bold; color: #e74c3c; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background: #34495e; color: white; padding: 8px; text-align: left; font-size: 10px; }
        td { padding: 6px; border-bottom: 1px solid #ecf0f1; font-size: 10px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .totals { width: 200px; margin-left: auto; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #ecf0f1; font-size: 10px; }
        .totals-row.final { border-top: 2px solid #34495e; font-weight: bold; font-size: 12px; }
        .payment-info { background: #f8f9fa; padding: 12px; margin-top: 15px; }
        .payment-info h4 { font-size: 12px; margin-bottom: 8px; }
        .bank-details { display: flex; gap: 20px; flex-wrap: wrap; }
        .bank-section { border: 1px solid #dee2e6; padding: 8px; background: white; min-width: 200px; }
        .bank-section h5 { font-size: 10px; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 4px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
        .signature-box { text-align: center; width: 150px; }
        .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 9px; }
        .footer { margin-top: 20px; text-align: center; font-size: 8px; color: #7f8c8d; border-top: 1px solid #ecf0f1; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>FACTURA</h1>
      </div>

      <div class="company-info">
        <div class="company-left">
          <h3>FURNIZOR</h3>
          <div class="info-line"><strong>UNITAR PROIECT TDA SRL</strong></div>
          <div class="info-line">CUI: RO35639210</div>
          <div class="info-line">Nr. Reg. Com.: J2016002024405</div>
          <div class="info-line">Adresa: Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1</div>
          <div class="info-line">Telefon: 0765486044</div>
          <div class="info-line">Email: contact@unitarproiect.eu</div>
        </div>
        <div class="company-right">
          <h3>CLIENT</h3>
          <div class="info-line"><strong>${cleanNonAscii(clientInfo.nume)}</strong></div>
          <div class="info-line">${isPersoanaFizica ? 'CNP' : 'CUI'}: ${cleanNonAscii(clientInfo.cui)}</div>
          ${!isPersoanaFizica && clientInfo.nr_reg_com ? `<div class="info-line">Nr. Reg. Com.: ${cleanNonAscii(clientInfo.nr_reg_com)}</div>` : ''}
          <div class="info-line">Adresa: ${cleanNonAscii(clientInfo.adresa)}</div>
          <div class="info-line">Email: ${cleanNonAscii(clientInfo.email)}</div>
        </div>
      </div>

      <div class="invoice-details">
        <div class="invoice-number">Factura nr: ${cleanNonAscii(numarComplet)}</div>
        <div style="font-size: 10px; margin-top: 5px;">
          <strong>Data:</strong> ${formatDate(factura.data_factura)} |
          <strong>Proiect:</strong> ${cleanNonAscii(factura.proiect_id || 'N/A')}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">Nr.</th>
            <th>Descriere</th>
            <th style="width: 50px;" class="text-center">Cant.</th>
            <th style="width: 70px;" class="text-right">Pret Unitar</th>
            <th style="width: 60px;" class="text-center">TVA</th>
            <th style="width: 80px;" class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${liniiFactura.map((linie: any, index: number) => {
            const cantitate = Number(linie.cantitate) || 1;
            const pretUnitar = Number(linie.pretUnitar) || 0;
            const cotaTva = Number(linie.cotaTva) || 0;
            const valoare = cantitate * pretUnitar;
            const tva = valoare * (cotaTva / 100);
            const totalLinie = valoare + tva;
            return `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${cleanNonAscii(linie.denumire || 'N/A')}</td>
                <td class="text-center">${safeFormat(cantitate)}</td>
                <td class="text-right">${safeFormat(pretUnitar)}</td>
                <td class="text-center">${safeFormat(tva)}</td>
                <td class="text-right"><strong>${safeFormat(totalLinie)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Subtotal:</span><span>${safeFormat(factura.subtotal || 0)} RON</span></div>
        ${(factura.total_tva || 0) > 0 ? `<div class="totals-row"><span>TVA:</span><span>${safeFormat(factura.total_tva)} RON</span></div>` : ''}
        <div class="totals-row final"><span>TOTAL:</span><span>${safeFormat(factura.total || 0)} RON</span></div>
      </div>

      <div class="payment-info">
        <h4>Conditii de plata</h4>
        <div class="info-line">Termen de plata: 30 zile | Metoda: Transfer bancar</div>
        <div class="bank-details">
          ${(contariBancare as any[]).map((cont: any) => `
            <div class="bank-section">
              <h5>${cont.cont_principal ? 'CONT PRINCIPAL - ' : ''}${cont.nume_banca}</h5>
              <div class="info-line">IBAN: ${cont.iban.replace(/(.{4})/g, '$1 ').trim()}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="signatures">
        <div class="signature-box">
          <strong>Furnizor</strong>
          <div class="signature-line">Semnatura si stampila</div>
        </div>
        <div class="signature-box">
          <strong>Client</strong>
          <div class="signature-line">Semnatura si stampila</div>
        </div>
      </div>

      <div class="footer">
        Document generat automat de UNITAR PROIECT TDA | contact@unitarproiect.eu | 0765486044
      </div>
    </body>
    </html>
  `;

  // Generează PDF cu Puppeteer
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
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    const filename = `Factura_${sanitizeFilename(numarComplet)}.pdf`;

    console.log(`[GENERATE-DOC] PDF factură generat: ${filename}`);
    return { buffer: Buffer.from(pdfBuffer), filename };

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ========== CONTRACT DOCX GENERATION ==========

async function generateContractDOCX(contractId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  console.log(`[GENERATE-DOC] Generare DOCX contract: ${contractId}`);

  const [rows] = await bigquery.query({
    query: `SELECT * FROM ${TABLE_CONTRACTE} WHERE ID_Contract = @contractId`,
    params: { contractId },
    types: { contractId: 'STRING' },
    location: 'EU',
  });

  if (rows.length === 0) {
    console.error(`[GENERATE-DOC] Contractul ${contractId} nu a fost găsit`);
    return null;
  }

  const contract = rows[0];

  // Parsează continut_json pentru placeholderData
  let placeholderData: any = {};
  try {
    if (contract.continut_json) {
      const continut = typeof contract.continut_json === 'string'
        ? JSON.parse(contract.continut_json)
        : contract.continut_json;
      placeholderData = continut.placeholderData || {};
    }
  } catch {
    console.log('[GENERATE-DOC] Nu s-au putut parsa datele contract JSON');
  }

  // Generează conținutul text pentru DOCX
  const contractContent = generateContractTextContent(contract, placeholderData);

  // Creează DOCX
  const docxBuffer = await createSimpleDocx(contractContent);
  const filename = `Contract_${sanitizeFilename(contract.numar_contract)}.docx`;

  console.log(`[GENERATE-DOC] DOCX contract generat: ${filename}`);
  return { buffer: docxBuffer, filename };
}

// ========== PV DOCX GENERATION ==========

async function generatePVDOCX(pvId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  console.log(`[GENERATE-DOC] Generare DOCX PV: ${pvId}`);

  const [rows] = await bigquery.query({
    query: `SELECT * FROM ${TABLE_PV} WHERE ID_PV = @pvId`,
    params: { pvId },
    types: { pvId: 'STRING' },
    location: 'EU',
  });

  if (rows.length === 0) {
    console.error(`[GENERATE-DOC] PV-ul ${pvId} nu a fost găsit`);
    return null;
  }

  const pv = rows[0];
  const numarComplet = pv.serie_pv ? `${pv.serie_pv}-${pv.numar_pv}` : pv.numar_pv;

  // Generează conținutul text pentru DOCX
  const pvContent = generatePVTextContent(pv);

  // Creează DOCX
  const docxBuffer = await createSimpleDocx(pvContent);
  const filename = `PV_${sanitizeFilename(numarComplet)}.docx`;

  console.log(`[GENERATE-DOC] DOCX PV generat: ${filename}`);
  return { buffer: docxBuffer, filename };
}

// ========== DOCX HELPERS ==========

function generateContractTextContent(contract: any, placeholderData: any): string {
  const client = placeholderData.client || {};
  const proiect = placeholderData.proiect || {};
  const firma = placeholderData.firma || {};

  return `CONTRACT DE SERVICII

NR. ${contract.numar_contract} din ${formatDate(contract.Data_Semnare)}

CAP.I. PARTI CONTRACTANTE

1. Intre ${client.nume || contract.client_nume || 'Client'}, persoana juridica romana, cu sediul in ${client.adresa || 'N/A'}, inmatriculata la Oficiul Registrului Comertului sub nr. ${client.nr_reg_com || 'N/A'}, C.U.I. ${client.cui || 'N/A'}, reprezentata prin ${client.reprezentant || 'Administrator'}, denumita in continuare BENEFICIAR

si

2. S.C. UNITAR PROIECT TDA S.R.L. cu sediul social in ${firma.adresa || 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, Bucuresti'}, avand CIF ${firma.cui || 'RO35639210'} si nr. de inregistrare la Registrul Comertului ${firma.nr_reg_com || 'J2016002024405'}, reprezentata legal de Damian Teodor, in calitate de Administrator, numita in continuare PRESTATOR.

CAP. II. OBIECTUL CONTRACTULUI

Obiectul contractului il reprezinta:

${proiect.denumire || contract.Denumire_Contract || 'Servicii profesionale'}

${proiect.adresa ? `Adresa: ${proiect.adresa}` : ''}

CAP.III. DURATA CONTRACTULUI

Contractul se incheie pe o perioada determinata.
${proiect.data_start ? `- Data inceput: ${proiect.data_start}` : ''}
${proiect.data_final ? `- Data finalizare: ${proiect.data_final}` : ''}

CAP. IV. PRETUL DE EXECUTARE AL LUCRARII

Pretul pe care Beneficiarul il datoreaza prestatorului pentru serviciile sale este de ${Number(contract.Valoare || 0).toFixed(2)} ${contract.Moneda || 'RON'} la care se aplica suplimentar TVA.

---

SEMNAT IN DATA: ${formatDate(contract.Data_Semnare)}

BENEFICIAR:                                    PRESTATOR:

${client.nume || contract.client_nume || 'Client'}                    S.C. UNITAR PROIECT TDA S.R.L.
${client.reprezentant || 'Administrator'}                              DAMIAN TEODOR - Administrator

.................................              .................................
`;
}

function generatePVTextContent(pv: any): string {
  const numarComplet = pv.serie_pv ? `${pv.serie_pv}-${pv.numar_pv}` : pv.numar_pv;

  return `PROCES VERBAL DE PREDARE-PRIMIRE

NR. ${numarComplet} din ${formatDate(pv.data_predare)}

Subsemnatii:

1. S.C. UNITAR PROIECT TDA S.R.L., cu sediul in Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, Bucuresti, avand CIF RO35639210, reprezentata legal de Damian Teodor, in calitate de Administrator, denumita in continuare PRESTATOR

si

2. ${pv.client_nume || 'Client'}, denumit in continuare BENEFICIAR

Am procedat la predarea-primirea urmatoarelor:

${pv.denumire_pv || 'Livrabile conform contract'}

${pv.observatii ? `Observatii: ${pv.observatii}` : ''}

Status predare: ${pv.status_predare || 'Predat'}

${pv.valoare_totala ? `Valoare: ${Number(pv.valoare_totala).toFixed(2)} ${pv.moneda || 'RON'}` : ''}

Prezentul proces verbal s-a incheiat astazi, ${formatDate(pv.data_predare)}, in 2 (doua) exemplare originale, cate unul pentru fiecare parte.

PRESTATOR:                                     BENEFICIAR:

S.C. UNITAR PROIECT TDA S.R.L.                ${pv.client_nume || 'Client'}
DAMIAN TEODOR - Administrator

.................................              .................................
`;
}

async function createSimpleDocx(textContent: string): Promise<Buffer> {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // _rels/.rels
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // word/_rels/document.xml.rels
  zip.folder('word')?.folder('_rels')?.file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  // Convertește text în paragrafe XML
  const paragraphs = textContent.split('\n').map(line => {
    const escapedLine = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Titluri cu bold
    if (line.includes('CONTRACT') || line.includes('PROCES VERBAL') || line.includes('CAP.') || line.includes('NR.')) {
      return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapedLine}</w:t></w:r></w:p>`;
    }

    return `<w:p><w:r><w:t>${escapedLine}</w:t></w:r></w:p>`;
  }).join('');

  // word/document.xml
  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  return await zip.generateAsync({ type: 'nodebuffer' });
}

// ========== MAIN API HANDLER ==========

interface DocumentRequest {
  type: 'factura' | 'contract' | 'pv';
  id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documents } = body as { documents: DocumentRequest[] };

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({
        error: 'Lista de documente este obligatorie'
      }, { status: 400 });
    }

    console.log(`[GENERATE-DOC] Generare ${documents.length} documente pentru email`);

    const attachments: Array<{
      filename: string;
      content: string;
      contentType: string;
    }> = [];

    const errors: string[] = [];

    // Procesează fiecare document
    for (const doc of documents) {
      try {
        let result: { buffer: Buffer; filename: string } | null = null;
        let contentType = 'application/octet-stream';

        switch (doc.type) {
          case 'factura':
            result = await generateFacturaPDF(doc.id);
            contentType = 'application/pdf';
            break;

          case 'contract':
            result = await generateContractDOCX(doc.id);
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;

          case 'pv':
            result = await generatePVDOCX(doc.id);
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;

          default:
            errors.push(`Tip document necunoscut: ${doc.type}`);
            continue;
        }

        if (result) {
          attachments.push({
            filename: result.filename,
            content: result.buffer.toString('base64'),
            contentType
          });
        } else {
          errors.push(`Nu s-a putut genera ${doc.type} cu ID ${doc.id}`);
        }

      } catch (error) {
        console.error(`[GENERATE-DOC] Eroare la generarea ${doc.type} ${doc.id}:`, error);
        errors.push(`Eroare la ${doc.type} ${doc.id}: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      }
    }

    console.log(`[GENERATE-DOC] Finalizat: ${attachments.length} documente generate, ${errors.length} erori`);

    return NextResponse.json({
      success: true,
      attachments,
      errors: errors.length > 0 ? errors : undefined,
      generated: attachments.length,
      requested: documents.length
    });

  } catch (error) {
    console.error('[GENERATE-DOC] Eroare generală:', error);
    return NextResponse.json({
      error: 'Eroare la generarea documentelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
