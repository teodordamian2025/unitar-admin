import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';

// Inițializare BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proiectId, clientData, invoiceData } = body;

    console.log('Generez factură pentru:', { proiectId, clientData, invoiceData });

    // Crează directorul pentru facturi dacă nu există
    const facturesDir = path.join(process.cwd(), 'uploads', 'facturi');
    if (!fs.existsSync(facturesDir)) {
      fs.mkdirSync(facturesDir, { recursive: true });
    }

    // Generează numele fișierului
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `factura-${proiectId}-${timestamp}.pdf`;
    const filePath = path.join(facturesDir, fileName);

    // Creează documentul PDF
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(filePath));

    // HEADER - Informații furnizor
    doc.fontSize(24)
       .text('FACTURĂ', 50, 50, { align: 'center' });

    doc.moveDown(1);

    // Informații furnizor (stânga)
    doc.fontSize(11)
       .text('Furnizor:', 50, 120)
       .text('UNITAR PROIECT SRL', 50, 135)
       .text('CUI: RO12345678', 50, 150)
       .text('Nr. Reg. Com.: J40/1234/2024', 50, 165)
       .text('Adresa: Str. Exemplu Nr. 1, București', 50, 180)
       .text('Telefon: 0721234567', 50, 195)
       .text('Email: contact@unitarproiect.ro', 50, 210);

    // Informații client (dreapta)
    doc.text('Client:', 350, 120)
       .text(clientData.nume || 'Client Necunoscut', 350, 135)
       .text(`CUI: ${clientData.cui || 'N/A'}`, 350, 150)
       .text(`Nr. Reg. Com.: ${clientData.nr_reg_com || 'N/A'}`, 350, 165)
       .text(`Adresa: ${clientData.adresa || 'N/A'}`, 350, 180)
       .text(`Telefon: ${clientData.telefon || 'N/A'}`, 350, 195)
       .text(`Email: ${clientData.email || 'N/A'}`, 350, 210);

    // Informații factură
    doc.fontSize(32)
       .text(`Factura nr: ${invoiceData.numarFactura}`, 50, 250);
    
    doc.fontSize(14)
       .text(`Data: ${new Date().toLocaleDateString('ro-RO')}`, 50, 285)
       .text(`Proiect: ${invoiceData.denumireProiect || `Proiect #${proiectId}`}`, 50, 305);

    // Linie separator
    doc.moveTo(50, 340)
       .lineTo(550, 340)
       .stroke();

    // TABEL - Header
    const tableTop = 360;
    doc.fontSize(11)
       .text('Nr.', 50, tableTop, { width: 30, align: 'center' })
       .text('Descriere', 90, tableTop, { width: 250 })
       .text('Cantitate', 350, tableTop, { width: 60, align: 'center' })
       .text('Preț Unitar', 420, tableTop, { width: 60, align: 'right' })
       .text('Total', 490, tableTop, { width: 60, align: 'right' });

    // Linie după header
    doc.moveTo(50, tableTop + 20)
       .lineTo(550, tableTop + 20)
       .stroke();

    // TABEL - Conținut
    let currentY = tableTop + 30;
    const subtotal = invoiceData.subtotal || 0;
    const tva = invoiceData.tva || 0;
    const total = invoiceData.total || subtotal;

    doc.fontSize(14)
       .text('1', 50, currentY, { width: 30, align: 'center' })
       .text(invoiceData.descriere || 'Servicii de consultanță și dezvoltare proiect', 90, currentY, { width: 250 })
       .text('1', 350, currentY, { width: 60, align: 'center' })
       .text(`${subtotal.toFixed(2)} RON`, 420, currentY, { width: 60, align: 'right' })
       .text(`${subtotal.toFixed(2)} RON`, 490, currentY, { width: 60, align: 'right' });

    currentY += 40;

    // Linie separator
    doc.moveTo(350, currentY)
       .lineTo(550, currentY)
       .stroke();

    currentY += 15;

    // TOTALURI
    doc.fontSize(11)
       .text('Subtotal:', 420, currentY, { width: 60, align: 'right' })
       .text(`${subtotal.toFixed(2)} RON`, 490, currentY, { width: 60, align: 'right' });

    currentY += 20;

    if (tva > 0) {
      doc.text('TVA 19%:', 420, currentY, { width: 60, align: 'right' })
         .text(`${tva.toFixed(2)} RON`, 490, currentY, { width: 60, align: 'right' });
      currentY += 20;
    }

    // Linie groasă pentru total
    doc.moveTo(420, currentY)
       .lineTo(550, currentY)
       .lineWidth(2)
       .stroke()
       .lineWidth(1);

    currentY += 10;

    doc.fontSize(14)
       .text('TOTAL:', 420, currentY, { width: 60, align: 'right' })
       .text(`${total.toFixed(2)} RON`, 490, currentY, { width: 60, align: 'right' });

    // FOOTER
    currentY += 80;

    // ELIMINĂ LINIA PROBLEMATICĂ: doc.font('Helvetica')
    // Folosim fontul implicit al PDFKit care este compatibil cu Vercel
    
    doc.fontSize(12)
       .text('Condiții de plată:', 50, currentY)
       .text(`Termen de plată: ${invoiceData.termenPlata || '30 zile'}`, 50, currentY + 15)
       .text('Metoda de plată: Transfer bancar', 50, currentY + 30);

    currentY += 60;

    doc.fontSize(9)
       .text('Informații bancare:', 50, currentY)
       .text('Banca: BCR', 50, currentY + 15)
       .text('IBAN: RO49RNCB0082004530120001', 50, currentY + 30)
       .text('SWIFT: RNCBROBU', 50, currentY + 45);

    // Semnături
    currentY += 80;
    doc.fontSize(11)
       .text('Furnizor', 50, currentY, { align: 'center', width: 200 })
       .text('Client', 350, currentY, { align: 'center', width: 200 });

    doc.text('_________________', 50, currentY + 40, { align: 'center', width: 200 })
       .text('_________________', 350, currentY + 40, { align: 'center', width: 200 });

    // Footer final
    currentY += 100;
    doc.fontSize(14)
       .text(`Factură generată automat de sistemul UNITAR PROIECT`, 50, currentY, { align: 'center' });

    doc.fontSize(12)
       .text(`Data generării: ${new Date().toLocaleString('ro-RO')}`, 50, currentY + 20, { align: 'center' });

    doc.fontSize(10)
       .text('Această factură a fost generată electronic și nu necesită semnătură fizică.', 50, currentY + 40, { align: 'center' });

    doc.fontSize(8)
       .text('Pentru întrebări contactați: contact@unitarproiect.ro | 0721234567', 50, currentY + 60, { align: 'center' });

    // Finalizează documentul
    doc.end();

    // Salvează în BigQuery
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('FacturiGenerate');

    const facturaData = [{
      id: crypto.randomUUID(),
      proiect_id: proiectId,
      numar_factura: invoiceData.numarFactura,
      client_nume: clientData.nume,
      client_cui: clientData.cui,
      descriere: invoiceData.descriere || 'Servicii de consultanță',
      subtotal: subtotal,
      tva: tva,
      total: total,
      status: 'generata',
      data_generare: new Date().toISOString(),
      cale_fisier: fileName,
      tip_factura: 'hibrid'
    }];

    await table.insert(facturaData);

    console.log('Factură generată cu succes:', fileName);

    return NextResponse.json({
      success: true,
      message: 'Factură generată cu succes',
      fileName: fileName,
      filePath: `/uploads/facturi/${fileName}`
    });

  } catch (error) {
    console.error('Eroare la generarea facturii:', error);
    return NextResponse.json({
      error: 'Eroare la generarea facturii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
