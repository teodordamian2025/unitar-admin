// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// DESCRIERE: Generare factură hibridă (PDF instant + ANAF background)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = 'PanouControlUnitar';

interface FacturaInput {
  proiectId: string;
  liniiFactura: {
    denumire: string;
    cantitate: number;
    pretUnitar: number;
    cotaTva: number;
  }[];
  observatii?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FacturaInput = await request.json();
    
    // 1. Preluare date proiect + client din BigQuery
    const proiectQuery = `
      SELECT 
        p.ID_Proiect,
        p.Denumire as proiect_denumire,
        p.Client as client_nume,
        p.Valoare_Estimata,
        p.Data_Start,
        p.Data_Final,
        p.Status,
        c.id as client_id,
        c.nume as client_nume_complet,
        c.cui as client_cui,
        c.nr_reg_com as client_nrc,
        c.adresa as client_adresa,
        c.judet as client_judet,
        c.oras as client_oras,
        c.iban as client_iban,
        c.banca as client_banca,
        c.telefon as client_telefon,
        c.email as client_email
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Clienti\` c 
        ON p.Client = c.nume
      WHERE p.ID_Proiect = @proiectId
    `;

    const [proiectRows] = await bigquery.query({
      query: proiectQuery,
      params: { proiectId: body.proiectId },
      location: 'EU'
    });

    if (proiectRows.length === 0) {
      return NextResponse.json(
        { error: 'Proiectul nu a fost găsit' },
        { status: 404 }
      );
    }

    const proiectData = proiectRows[0];

    // 2. Verificare date client
    if (!proiectData.client_cui) {
      return NextResponse.json(
        { error: 'Clientul nu are CUI-ul completat în baza de date' },
        { status: 400 }
      );
    }

    // 3. Generare număr factură
    const numarFactura = await generateInvoiceNumber();

    // 4. Calculare totaluri
    const { subtotal, totalTva, totalGeneral } = calculateTotals(body.liniiFactura);

    // 5. Structura factură completă
    const facturaCompleta = {
      id: numarFactura,
      numar: numarFactura,
      data: new Date().toISOString().split('T')[0],
      scadenta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      
      client: {
        id: proiectData.client_id,
        denumire: proiectData.client_nume_complet || proiectData.client_nume,
        cui: proiectData.client_cui,
        nrRegCom: proiectData.client_nrc || '',
        adresa: buildClientAddress(proiectData),
        iban: proiectData.client_iban || '',
        banca: proiectData.client_banca || '',
        telefon: proiectData.client_telefon || '',
        email: proiectData.client_email || ''
      },
      
      furnizor: {
        denumire: 'UNITAR PROIECT TDA S.R.L.',
        cui: 'RO39613458',
        nrRegCom: 'J40/10789/2018',
        adresa: 'Șos. Panduri nr. 94-96, Sector 5, București',
        iban: 'RO49TREZ7010671234567890',
        banca: 'Trezoreria Statului'
      },
      
      proiect: {
        id: proiectData.ID_Proiect,
        denumire: proiectData.proiect_denumire,
        dataStart: proiectData.Data_Start,
        dataFinalizare: proiectData.Data_Final,
        valoareEstimata: proiectData.Valoare_Estimata
      },
      
      linii: body.liniiFactura.map(linie => {
        const valoare = linie.cantitate * linie.pretUnitar;
        const valoreTva = valoare * (linie.cotaTva / 100);
        return {
          ...linie,
          valoare,
          valoreTva,
          total: valoare + valoreTva
        };
      }),
      
      subtotal,
      totalTva,
      totalGeneral,
      observatii: body.observatii || ''
    };

    // 6. Generare PDF
    const pdfBuffer = await generatePDF(facturaCompleta);
    
    // 7. Salvare PDF
    const pdfPath = await savePDF(pdfBuffer, numarFactura);
    
    // 8. Salvare în BigQuery (tabelul FacturiGenerate)
    await saveInvoiceToFacturiGenerate(facturaCompleta, pdfPath);

    // 9. Procesare ANAF în background (viitoarea implementare)
    // processANAFBackground(facturaCompleta);

    return NextResponse.json({
      success: true,
      invoiceId: numarFactura,
      pdfPath: `/api/actions/invoices/download/${numarFactura}`,
      downloadUrl: `/api/actions/invoices/download/${numarFactura}`,
      message: 'Factura a fost generată cu succes! PDF disponibil instant.'
    });

  } catch (error) {
    console.error('Eroare generare factură hibridă:', error);
    return NextResponse.json(
      { 
        error: 'Eroare la generarea facturii',
        details: error instanceof Error ? error.message : 'Eroare necunoscută'
      },
      { status: 500 }
    );
  }
}

// Helper Functions
// ================================================================

function buildClientAddress(proiectData: any): string {
  const parts = [
    proiectData.client_adresa,
    proiectData.client_oras,
    proiectData.client_judet
  ].filter(Boolean);
  
  return parts.join(', ');
}

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  
  const countQuery = `
    SELECT COUNT(*) as count 
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\` 
    WHERE EXTRACT(YEAR FROM data_factura) = @year
  `;
  
  const [rows] = await bigquery.query({
    query: countQuery,
    params: { year },
    location: 'EU'
  });
  
  const count = (rows[0]?.count || 0) + 1;
  return `UNI${year}${count.toString().padStart(4, '0')}`;
}

function calculateTotals(linii: any[]) {
  let subtotal = 0;
  let totalTva = 0;
  
  linii.forEach(linie => {
    const valoare = linie.cantitate * linie.pretUnitar;
    const tva = valoare * (linie.cotaTva / 100);
    subtotal += valoare;
    totalTva += tva;
  });
  
  return {
    subtotal,
    totalTva,
    totalGeneral: subtotal + totalTva
  };
}

async function generatePDF(factura: any): Promise<Buffer> {
  const html = generateInvoiceHTML(factura);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      bottom: '20mm',
      left: '15mm',
      right: '15mm'
    }
  });
  
  await browser.close();
  return Buffer.from(pdf);
}

async function savePDF(pdfBuffer: Buffer, invoiceNumber: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'facturi');
  await fs.mkdir(uploadsDir, { recursive: true });
  
  const fileName = `${invoiceNumber}.pdf`;
  const filePath = path.join(uploadsDir, fileName);
  
  await fs.writeFile(filePath, pdfBuffer);
  return `/uploads/facturi/${fileName}`;
}

async function saveInvoiceToFacturiGenerate(factura: any, pdfPath: string) {
  const insertQuery = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\`
    (
      id, proiect_id, serie, numar, data_factura, data_scadenta,
      client_id, client_nume, client_cui, subtotal, total_tva, total,
      status, data_creare, data_actualizare, date_complete_json
    )
    VALUES (
      @id, @proiect_id, @serie, @numar, @data_factura, @data_scadenta,
      @client_id, @client_nume, @client_cui, @subtotal, @total_tva, @total,
      @status, @data_creare, @data_actualizare, @date_complete_json
    )
  `;
  
  const params = {
    id: factura.id,
    proiect_id: factura.proiect.id,
    serie: 'UNI',
    numar: factura.numar,
    data_factura: factura.data,
    data_scadenta: factura.scadenta,
    client_id: factura.client.id,
    client_nume: factura.client.denumire,
    client_cui: factura.client.cui,
    subtotal: factura.subtotal,
    total_tva: factura.totalTva,
    total: factura.totalGeneral,
    status: 'pdf_generated',
    data_creare: new Date().toISOString(),
    data_actualizare: new Date().toISOString(),
    date_complete_json: JSON.stringify({
      pdfPath,
      linii: factura.linii,
      observatii: factura.observatii,
      furnizor: factura.furnizor,
      client: factura.client
    })
  };
  
  await bigquery.query({
    query: insertQuery,
    params,
    location: 'EU'
  });
}

function generateInvoiceHTML(factura: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Factură ${factura.numar}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Arial', sans-serif; 
          font-size: 12px; 
          line-height: 1.4;
          color: #333;
        }
        .container { max-width: 210mm; margin: 0 auto; padding: 20px; }
        
        .header { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 30px; 
          border-bottom: 3px solid #4caf50; 
          padding-bottom: 20px; 
        }
        
        .company-info { width: 48%; }
        .invoice-info { width: 48%; text-align: right; }
        
        .company-logo { 
          font-size: 22px; 
          font-weight: bold; 
          color: #4caf50; 
          margin-bottom: 10px; 
        }
        
        .invoice-title { 
          font-size: 32px; 
          font-weight: bold; 
          color: #4caf50; 
          margin-bottom: 15px; 
        }
        
        .invoice-number {
          font-size: 18px;
          font-weight: bold;
          background: #f8f9fa;
          padding: 8px 12px;
          border-radius: 4px;
          display: inline-block;
          margin-bottom: 10px;
        }
        
        .client-section { 
          margin: 30px 0; 
          padding: 20px; 
          background-color: #f8f9fa; 
          border-radius: 8px;
          border-left: 4px solid #4caf50;
        }
        
        .client-title {
          font-size: 16px;
          font-weight: bold;
          color: #4caf50;
          margin-bottom: 15px;
        }
        
        .project-info { 
          margin: 20px 0; 
          padding: 15px; 
          background-color: #e8f5e8; 
          border-radius: 6px; 
        }
        
        .table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 25px 0; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .table th, .table td { 
          border: 1px solid #ddd; 
          padding: 12px 8px; 
          text-align: left; 
        }
        
        .table th { 
          background: linear-gradient(135deg, #4caf50, #45a049);
          color: white; 
          font-weight: bold; 
          font-size: 11px;
          text-transform: uppercase;
        }
        
        .table tr:nth-child(even) { 
          background-color: #f9f9f9; 
        }
        
        .table tr:hover {
          background-color: #f0f8f0;
        }
        
        .table td.number { 
          text-align: right; 
          font-weight: 500;
        }
        
        .table td.center { 
          text-align: center; 
        }
        
        .total-section { 
          margin-top: 30px; 
          display: flex;
          justify-content: flex-end;
        }
        
        .total-box {
          background: white;
          border: 2px solid #4caf50;
          border-radius: 8px;
          padding: 20px;
          min-width: 300px;
        }
        
        .total-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 8px 0; 
          padding: 5px 0;
        }
        
        .total-label { 
          font-weight: 600; 
          color: #555;
        }
        
        .total-value { 
          font-weight: bold; 
          color: #333;
        }
        
        .final-total { 
          border-top: 2px solid #4caf50; 
          padding-top: 15px; 
          margin-top: 15px;
          font-size: 18px;
        }
        
        .final-total .total-value {
          color: #4caf50;
          font-size: 20px;
        }
        
        .observatii {
          margin-top: 30px;
          padding: 15px;
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 4px;
        }
        
        .footer { 
          margin-top: 50px; 
          font-size: 10px; 
          color: #666; 
          text-align: center;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
        
        .info-row {
          margin: 5px 0;
        }
        
        .info-label {
          font-weight: 600;
          color: #555;
          display: inline-block;
          min-width: 100px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header cu informații firmă și factură -->
        <div class="header">
          <div class="company-info">
            <div class="company-logo">${factura.furnizor.denumire}</div>
            <div class="info-row">
              <span class="info-label">CUI:</span> ${factura.furnizor.cui}
            </div>
            <div class="info-row">
              <span class="info-label">Nr. Reg. Com:</span> ${factura.furnizor.nrRegCom}
            </div>
            <div class="info-row">
              <span class="info-label">Adresa:</span> ${factura.furnizor.adresa}
            </div>
            <div class="info-row">
              <span class="info-label">IBAN:</span> ${factura.furnizor.iban}
            </div>
            <div class="info-row">
              <span class="info-label">Banca:</span> ${factura.furnizor.banca}
            </div>
          </div>
          
          <div class="invoice-info">
            <div class="invoice-title">FACTURĂ</div>
            <div class="invoice-number">Nr: ${factura.numar}</div>
            <div class="info-row">
              <span class="info-label">Data emiterii:</span> 
              ${new Date(factura.data).toLocaleDateString('ro-RO')}
            </div>
            <div class="info-row">
              <span class="info-label">Data scadenței:</span> 
              ${new Date(factura.scadenta).toLocaleDateString('ro-RO')}
            </div>
          </div>
        </div>

        <!-- Informații client -->
        <div class="client-section">
          <div class="client-title">📋 Cumpărător</div>
          <div style="display: flex; justify-content: space-between;">
            <div style="width: 48%;">
              <div class="info-row">
                <span class="info-label">Denumire:</span> 
                <strong>${factura.client.denumire}</strong>
              </div>
              <div class="info-row">
                <span class="info-label">CUI:</span> ${factura.client.cui}
              </div>
              <div class="info-row">
                <span class="info-label">Nr. Reg. Com:</span> ${factura.client.nrRegCom}
              </div>
              <div class="info-row">
                <span class="info-label">Adresa:</span> ${factura.client.adresa}
              </div>
            </div>
            <div style="width: 48%;">
              ${factura.client.telefon ? `<div class="info-row"><span class="info-label">Telefon:</span> ${factura.client.telefon}</div>` : ''}
              ${factura.client.email ? `<div class="info-row"><span class="info-label">Email:</span> ${factura.client.email}</div>` : ''}
              ${factura.client.iban ? `<div class="info-row"><span class="info-label">IBAN:</span> ${factura.client.iban}</div>` : ''}
              ${factura.client.banca ? `<div class="info-row"><span class="info-label">Banca:</span> ${factura.client.banca}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- Informații proiect -->
        <div class="project-info">
          <strong>🏗️ Proiect:</strong> ${factura.proiect.denumire} (ID: ${factura.proiect.id})<br>
          <strong>📅 Perioada:</strong> 
          ${factura.proiect.dataStart ? new Date(factura.proiect.dataStart).toLocaleDateString('ro-RO') : 'N/A'} - 
          ${factura.proiect.dataFinalizare ? new Date(factura.proiect.dataFinalizare).toLocaleDateString('ro-RO') : 'În curs'}
          ${factura.proiect.valoareEstimata ? `<br><strong>💰 Valoare estimată:</strong> ${factura.proiect.valoareEstimata.toFixed(2)} RON` : ''}
        </div>

        <!-- Tabel servicii/produse -->
        <table class="table">
          <thead>
            <tr>
              <th style="width: 50px;">Nr.</th>
              <th>Denumirea produselor sau serviciilor</th>
              <th style="width: 80px;">Cant.</th>
              <th style="width: 100px;">Preț unit. (RON)</th>
              <th style="width: 100px;">Valoare (RON)</th>
              <th style="width: 80px;">TVA %</th>
              <th style="width: 100px;">TVA (RON)</th>
              <th style="width: 120px;">Total (RON)</th>
            </tr>
          </thead>
          <tbody>
            ${factura.linii.map((linie: any, index: number) => `
              <tr>
                <td class="center">${index + 1}</td>
                <td>${linie.denumire}</td>
                <td class="center">${linie.cantitate}</td>
                <td class="number">${linie.pretUnitar.toFixed(2)}</td>
                <td class="number">${linie.valoare.toFixed(2)}</td>
                <td class="center">${linie.cotaTva}%</td>
                <td class="number">${linie.valoreTva.toFixed(2)}</td>
                <td class="number"><strong>${linie.total.toFixed(2)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totaluri -->
        <div class="total-section">
          <div class="total-box">
            <div class="total-row">
              <div class="total-label">Total fără TVA:</div>
              <div class="total-value">${factura.subtotal.toFixed(2)} RON</div>
            </div>
            <div class="total-row">
              <div class="total-label">TVA:</div>
              <div class="total-value">${factura.totalTva.toFixed(2)} RON</div>
            </div>
            <div class="total-row final-total">
              <div class="total-label">TOTAL DE PLATĂ:</div>
              <div class="total-value">${factura.totalGeneral.toFixed(2)} RON</div>
            </div>
          </div>
        </div>

        <!-- Observații -->
        ${factura.observatii ? `
          <div class="observatii">
            <h4 style="color: #856404; margin-bottom: 10px;">📝 Observații:</h4>
            <p>${factura.observatii}</p>
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p><strong>Factură generată automat de sistemul UNITAR PROIECT</strong></p>
          <p>Data și ora generării: ${new Date().toLocaleString('ro-RO')}</p>
          <p>Această factură este valabilă fără semnătură și ștampilă conform Legii 571/2003</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
