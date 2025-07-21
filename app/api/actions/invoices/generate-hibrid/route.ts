// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// DESCRIERE: Generare factură hibridă cu PDFKit (Vercel compatible)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import PDFDocument from 'pdfkit';
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

    // 2. Verificare date client - folosește Client din proiect ca fallback
    const clientCui = proiectData.client_cui || 'N/A';
    const clientDenumire = proiectData.client_nume_complet || proiectData.client_nume;

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
        id: proiectData.client_id || 'temp_id',
        denumire: clientDenumire,
        cui: clientCui,
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
        // FIX: Convertește toate valorile la numere
        const cantitate = Number(linie.cantitate) || 0;
        const pretUnitar = Number(linie.pretUnitar) || 0;
        const cotaTva = Number(linie.cotaTva) || 0;
        
        const valoare = cantitate * pretUnitar;
        const valoreTva = valoare * (cotaTva / 100);
        
        return {
          denumire: linie.denumire,
          cantitate,
          pretUnitar,
          cotaTva,
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
  
  return parts.length > 0 ? parts.join(', ') : 'Adresă nedefinită';
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
    // FIX: Asigură-te că toate valorile sunt numere
    const cantitate = Number(linie.cantitate) || 0;
    const pretUnitar = Number(linie.pretUnitar) || 0;
    const cotaTva = Number(linie.cotaTva) || 0;
    
    const valoare = cantitate * pretUnitar;
    const tva = valoare * (cotaTva / 100);
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
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: `Factură ${factura.numar}`,
          Author: 'UNITAR PROIECT TDA S.R.L.',
          Subject: `Factură pentru proiectul ${factura.proiect.denumire}`,
          Keywords: 'factură, unitar, proiect'
        }
      });
      
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Culori și fonturi
      const primaryColor = '#4caf50';
      const textColor = '#333333';
      const grayColor = '#666666';
      
      // HEADER PRINCIPAL
      doc.fontSize(24)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('UNITAR PROIECT TDA S.R.L.', 50, 50);
      
      doc.fontSize(11)
         .fillColor(textColor)
         .font('Helvetica')
         .text('CUI: RO39613458 | Nr. Reg. Com: J40/10789/2018', 50, 80)
         .text('Șos. Panduri nr. 94-96, Sector 5, București', 50, 95)
         .text('IBAN: RO49TREZ7010671234567890 | Trezoreria Statului', 50, 110);
      
      // TITLU FACTURĂ (dreapta)
      doc.fontSize(32)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('FACTURĂ', 400, 50);
      
      // Casetă număr factură
      doc.rect(400, 90, 140, 25).fillAndStroke('#f8f9fa', '#ddd');
      doc.fontSize(14)
         .fillColor(textColor)
         .font('Helvetica-Bold')
         .text(`Nr: ${factura.numar}`, 410, 98);
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Data emiterii: ${new Date(factura.data).toLocaleDateString('ro-RO')}`, 400, 125)
         .text(`Data scadenței: ${new Date(factura.scadenta).toLocaleDateString('ro-RO')}`, 400, 140);
      
      // LINIE SEPARATOR
      doc.moveTo(50, 170).lineTo(550, 170).strokeColor(primaryColor).lineWidth(2).stroke();
      
      // SECȚIUNEA CLIENT
      doc.fontSize(14)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('📋 CUMPĂRĂTOR', 50, 190);
      
      // Casetă client
      doc.rect(50, 210, 500, 80).fillAndStroke('#f8f9fa', '#e0e0e0');
      
      doc.fontSize(12)
         .fillColor(textColor)
         .font('Helvetica-Bold')
         .text(factura.client.denumire, 60, 225);
      
      doc.font('Helvetica')
         .text(`CUI: ${factura.client.cui}`, 60, 245)
         .text(`Nr. Reg. Com: ${factura.client.nrRegCom}`, 60, 260)
         .text(`Adresa: ${factura.client.adresa}`, 60, 275);
      
      // Contact client (dreapta în casetă)
      if (factura.client.telefon || factura.client.email) {
        let contactY = 245;
        if (factura.client.telefon) {
          doc.text(`Telefon: ${factura.client.telefon}`, 350, contactY);
          contactY += 15;
        }
        if (factura.client.email) {
          doc.text(`Email: ${factura.client.email}`, 350, contactY);
        }
      }
      
      // INFORMAȚII PROIECT
      doc.fontSize(12)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('🏗️ PROIECT:', 50, 310);
      
      doc.fillColor(textColor)
         .font('Helvetica')
         .text(`${factura.proiect.denumire} (ID: ${factura.proiect.id})`, 130, 310);
      
      if (factura.proiect.dataStart || factura.proiect.dataFinalizare) {
        const perioada = `${factura.proiect.dataStart ? new Date(factura.proiect.dataStart).toLocaleDateString('ro-RO') : 'N/A'} - ${factura.proiect.dataFinalizare ? new Date(factura.proiect.dataFinalizare).toLocaleDateString('ro-RO') : 'În curs'}`;
        doc.text(`📅 Perioada: ${perioada}`, 50, 325);
      }
      
      // TABEL HEADER
      let tableY = 360;
      const tableHeight = 25;
      const colWidths = [40, 200, 50, 80, 80, 50, 80, 90];
      let currentX = 50;
      
      // Header background
      doc.rect(50, tableY, 500, tableHeight).fill(primaryColor);
      
      // Header text
      doc.fontSize(9)
         .fillColor('white')
         .font('Helvetica-Bold');
      
      const headers = ['Nr.', 'Denumirea serviciilor', 'Cant.', 'Preț unit.', 'Valoare', 'TVA%', 'TVA', 'Total (RON)'];
      headers.forEach((header, i) => {
        const textX = currentX + (colWidths[i] / 2);
        doc.text(header, textX - (header.length * 2.5), tableY + 8, {
          width: colWidths[i],
          align: 'center'
        });
        currentX += colWidths[i];
      });
      
      // LINII TABEL
      tableY += tableHeight;
      doc.fillColor(textColor).font('Helvetica');
      
      factura.linii.forEach((linie: any, index: number) => {
        // Alternating row colors
        if (index % 2 === 0) {
          doc.rect(50, tableY, 500, 20).fill('#f9f9f9');
        }
        
        currentX = 50;
        doc.fillColor(textColor).fontSize(9);
        
        const rowData = [
          (index + 1).toString(),
          linie.denumire.substring(0, 35) + (linie.denumire.length > 35 ? '...' : ''),
          Number(linie.cantitate).toFixed(0),
          Number(linie.pretUnitar).toFixed(2),
          Number(linie.valoare).toFixed(2),
          `${Number(linie.cotaTva).toFixed(0)}%`,
          Number(linie.valoreTva).toFixed(2),
          Number(linie.total).toFixed(2)
        ];
        
        rowData.forEach((data, i) => {
          const align = (i === 0 || i === 2 || i === 5) ? 'center' : (i >= 3 ? 'right' : 'left');
          const textX = align === 'center' ? currentX + (colWidths[i] / 2) - (data.length * 2.5) :
                       align === 'right' ? currentX + colWidths[i] - 5 :
                       currentX + 5;
          
          doc.text(data, textX, tableY + 6, {
            width: colWidths[i],
            align: align
          });
          currentX += colWidths[i];
        });
        
        tableY += 20;
      });
      
      // TABEL BORDER
      doc.rect(50, 360, 500, tableY - 360).stroke('#ddd');
      
      // TOTALURI (dreapta)
      const totalsX = 350;
      tableY += 30;
      
      // Casetă totaluri
      doc.rect(totalsX, tableY, 200, 80).fillAndStroke('#f0f8f0', primaryColor);
      
      doc.fontSize(11)
         .fillColor(textColor)
         .font('Helvetica');
      
      doc.text('Subtotal (fără TVA):', totalsX + 10, tableY + 15);
      doc.text(`${Number(factura.subtotal).toFixed(2)} RON`, totalsX + 120, tableY + 15);
      
      doc.text('TVA:', totalsX + 10, tableY + 35);
      doc.text(`${Number(factura.totalTva).toFixed(2)} RON`, totalsX + 120, tableY + 35);
      
      // Total final
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(primaryColor);
      doc.text('TOTAL DE PLATĂ:', totalsX + 10, tableY + 55);
      doc.text(`${Number(factura.totalGeneral).toFixed(2)} RON`, totalsX + 120, tableY + 55);
      
      // OBSERVAȚII (dacă există)
      if (factura.observatii) {
        tableY += 100;
        doc.fontSize(12)
           .fillColor(primaryColor)
           .font('Helvetica-Bold')
           .text('📝 Observații:', 50, tableY);
        
        doc.rect(50, tableY + 20, 500, 40).fillAndStroke('#fff3cd', '#ffc107');
        doc.fontSize(10)
           .fillColor(textColor)
           .font('Helvetica')
           .text(factura.observatii, 60, tableY + 30, {
             width: 480,
             align: 'left'
           });
        tableY += 70;
      }
      
      // FOOTER
      const footerY = doc.page.height - 80;
      doc.moveTo(50, footerY - 10).lineTo(550, footerY - 10).strokeColor('#eee').lineWidth(1).stroke();
      
      doc.fontSize(8)
         .fillColor(grayColor)
         .font('Helvetica')
         .text('Factură generată automat de sistemul UNITAR PROIECT', 50, footerY, {
           width: 500,
           align: 'center'
         })
         .text(`Data și ora generării: ${new Date().toLocaleString('ro-RO')}`, 50, footerY + 12, {
           width: 500,
           align: 'center'
         })
         .text('Această factură este valabilă fără semnătură și ștampilă conform Legii 571/2003', 50, footerY + 24, {
           width: 500,
           align: 'center'
         });
      
      doc.end();
      
    } catch (error) {
      console.error('PDFKit error:', error);
      reject(error);
    }
  });
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
