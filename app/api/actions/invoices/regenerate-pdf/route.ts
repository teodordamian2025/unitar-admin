// ==================================================================
// CALEA: app/api/actions/invoices/regenerate-pdf/route.ts
// DESCRIERE: Regenerează PDF din datele facturii salvate în BigQuery
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = 'PanouControlUnitar';

export async function POST(request: NextRequest) {
  try {
    const { facturaId, numar } = await request.json();
    
    if (!facturaId) {
      return NextResponse.json({ error: 'facturaId este obligatoriu' }, { status: 400 });
    }
    
    // Preluare date completă factură din BigQuery
    const query = `
      SELECT 
        id,
        numar,
        data_factura,
        data_scadenta,
        client_nume,
        client_cui,
        subtotal,
        total_tva,
        total,
        date_complete_json,
        data_creare
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.FacturiGenerate\`
      WHERE id = @facturaId
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { facturaId },
      location: 'EU'
    });
    
    if (rows.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Factura nu a fost găsită în baza de date' 
      }, { status: 404 });
    }
    
    const factura = rows[0];
    
    // Parse datele complete JSON
    let dateComplete;
    try {
      dateComplete = typeof factura.date_complete_json === 'string' 
        ? JSON.parse(factura.date_complete_json)
        : factura.date_complete_json;
    } catch (error) {
      return NextResponse.json({ 
        success: false,
        error: 'Datele complete ale facturii sunt corupte' 
      }, { status: 500 });
    }
    
    // Regenerează HTML template-ul facturii
    const htmlContent = generateInvoiceHTML(factura, dateComplete);
    
    return NextResponse.json({
      success: true,
      htmlContent,
      fileName: `Factura_${factura.numar}.pdf`,
      facturaData: {
        id: factura.id,
        numar: factura.numar,
        total: factura.total
      }
    });
    
  } catch (error) {
    console.error('Eroare regenerare PDF:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la regenerarea PDF-ului'
    }, { status: 500 });
  }
}

// ✅ Funcție pentru generarea HTML template (identică cu cea din generate-hibrid)
function generateInvoiceHTML(factura: any, dateComplete: any) {
  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    
    let dateValue: string;
    if (typeof date === 'object' && date.value) {
      dateValue = date.value;
    } else if (typeof date === 'string') {
      dateValue = date;
    } else {
      return 'N/A';
    }
    
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return 'Data invalidă';
    }
  };

  const formatCurrency = (amount: any) => {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Extrage informațiile din dateComplete
  const liniiFactura = dateComplete.liniiFactura || [];
  const clientInfo = dateComplete.clientInfo || {};
  const observatii = dateComplete.observatii || '';

  const currentDate = new Date().toLocaleDateString('ro-RO');

  return `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura ${factura.numar}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
            padding: 20px;
        }
        
        .invoice-container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #2c3e50;
        }
        
        .company-info {
            flex: 1;
        }
        
        .company-info h1 {
            font-size: 18px;
            color: #2c3e50;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .company-details {
            font-size: 11px;
            line-height: 1.5;
            color: #666;
        }
        
        .invoice-number {
            text-align: right;
            flex: 1;
        }
        
        .invoice-number h2 {
            font-size: 24px;
            color: #27ae60;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .invoice-meta {
            font-size: 11px;
            color: #666;
            text-align: right;
        }
        
        .client-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        
        .client-info {
            flex: 1;
            margin-right: 20px;
        }
        
        .client-info h3 {
            font-size: 14px;
            color: #2c3e50;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .client-details {
            font-size: 11px;
            line-height: 1.6;
        }
        
        .invoice-details {
            flex: 1;
        }
        
        .invoice-details h3 {
            font-size: 14px;
            color: #2c3e50;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 11px;
        }
        
        .detail-label {
            color: #666;
        }
        
        .detail-value {
            font-weight: bold;
            color: #333;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 11px;
        }
        
        .items-table th {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .items-table td {
            border: 1px solid #dee2e6;
            padding: 10px 8px;
            vertical-align: top;
        }
        
        .items-table .text-right {
            text-align: right;
        }
        
        .items-table .text-center {
            text-align: center;
        }
        
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
        }
        
        .totals-table {
            width: 300px;
            border-collapse: collapse;
            font-size: 12px;
        }
        
        .totals-table td {
            padding: 8px 12px;
            border: 1px solid #dee2e6;
        }
        
        .totals-table .label {
            background: #f8f9fa;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .totals-table .value {
            text-align: right;
            font-weight: bold;
        }
        
        .totals-table .total-row {
            background: #27ae60;
            color: white;
            font-weight: bold;
            font-size: 14px;
        }
        
        .notes-section {
            margin-bottom: 30px;
        }
        
        .notes-section h3 {
            font-size: 14px;
            color: #2c3e50;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .notes-content {
            font-size: 11px;
            line-height: 1.6;
            color: #666;
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #3498db;
        }
        
        .footer {
            border-top: 1px solid #dee2e6;
            padding-top: 20px;
            text-align: center;
            font-size: 10px;
            color: #999;
        }
        
        .bank-info {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
        }
        
        .bank-info h3 {
            font-size: 12px;
            color: #2c3e50;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .bank-details {
            font-size: 10px;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <h1>UNITAR PROIECT TDA SRL</h1>
                <div class="company-details">
                    CUI: RO35639210<br>
                    Nr. Reg. Com.: J2016002024405<br>
                    Adresa: Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01,<br>
                    mun. Bucuresti, sector 4<br>
                    Telefon: 0765486044<br>
                    Email: contact@unitarproiect.eu
                </div>
            </div>
            <div class="invoice-number">
                <h2>FACTURA</h2>
                <div class="invoice-meta">
                    Nr: <strong>${factura.numar}</strong><br>
                    Data: ${formatDate(factura.data_factura)}<br>
                    Generata: ${currentDate}
                </div>
            </div>
        </div>

        <!-- Client & Invoice Details -->
        <div class="client-section">
            <div class="client-info">
                <h3>Facturat catre:</h3>
                <div class="client-details">
                    <strong>${clientInfo.nume || clientInfo.denumire || factura.client_nume}</strong><br>
                    CUI: ${clientInfo.cui || factura.client_cui}<br>
                    ${clientInfo.nr_reg_com ? `Nr. Reg. Com.: ${clientInfo.nr_reg_com}<br>` : ''}
                    ${clientInfo.adresa ? `Adresa: ${clientInfo.adresa}<br>` : ''}
                    ${clientInfo.telefon && clientInfo.telefon !== 'N/A' ? `Telefon: ${clientInfo.telefon}<br>` : ''}
                    ${clientInfo.email && clientInfo.email !== 'N/A' ? `Email: ${clientInfo.email}` : ''}
                </div>
            </div>
            <div class="invoice-details">
                <h3>Detalii Factura:</h3>
                <div class="detail-row">
                    <span class="detail-label">Data emiterii:</span>
                    <span class="detail-value">${formatDate(factura.data_factura)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Data scadentei:</span>
                    <span class="detail-value">${formatDate(factura.data_scadenta)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Moneda:</span>
                    <span class="detail-value">RON</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total de plata:</span>
                    <span class="detail-value" style="color: #27ae60; font-size: 14px;">${formatCurrency(factura.total)} RON</span>
                </div>
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 50%">Descriere servicii/produse</th>
                    <th style="width: 10%" class="text-center">Cant.</th>
                    <th style="width: 15%" class="text-right">Pret unitar (RON)</th>
                    <th style="width: 10%" class="text-center">TVA %</th>
                    <th style="width: 15%" class="text-right">Valoare (RON)</th>
                </tr>
            </thead>
            <tbody>
                ${liniiFactura.map((linie: any) => {
                  const cantitate = parseFloat(linie.cantitate) || 0;
                  const pretUnitar = parseFloat(linie.pretUnitar) || 0;
                  const cotaTva = parseFloat(linie.cotaTva) || 0;
                  const valoare = cantitate * pretUnitar;
                  const tva = valoare * (cotaTva / 100);
                  const total = valoare + tva;
                  
                  return `
                    <tr>
                        <td>
                            ${linie.denumire}
                            ${linie.tip === 'subproiect' ? '<br><small style="color: #3498db; font-weight: bold;">(Subproiect)</small>' : ''}
                        </td>
                        <td class="text-center">${formatCurrency(cantitate)}</td>
                        <td class="text-right">${formatCurrency(pretUnitar)}</td>
                        <td class="text-center">${cotaTva}%</td>
                        <td class="text-right">${formatCurrency(total)}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td class="label">Subtotal (fara TVA):</td>
                    <td class="value">${formatCurrency(factura.subtotal)} RON</td>
                </tr>
                <tr>
                    <td class="label">TVA:</td>
                    <td class="value">${formatCurrency(factura.total_tva)} RON</td>
                </tr>
                <tr class="total-row">
                    <td>TOTAL DE PLATA:</td>
                    <td class="value">${formatCurrency(factura.total)} RON</td>
                </tr>
            </table>
        </div>

        <!-- Notes -->
        ${observatii ? `
        <div class="notes-section">
            <h3>Observatii:</h3>
            <div class="notes-content">
                ${observatii}
            </div>
        </div>
        ` : ''}

        <!-- Bank Info -->
        <div class="bank-info">
            <h3>Informatii bancare:</h3>
            <div class="bank-details">
                <strong>ING Bank:</strong> RO82INGB0000999905667533<br>
                <strong>Trezoreria:</strong> RO29TREZ7035069XXX018857 (Trezoreria sectorului 3 Bucuresti)
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            Aceasta factura a fost generata electronic de sistemul UNITAR PROIECT.<br>
            Pentru intrebari, contactati-ne la contact@unitarproiect.eu sau 0765486044.
        </div>
    </div>
</body>
</html>
  `;
}
