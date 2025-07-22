import { NextRequest, NextResponse } from 'next/server';
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
    const { proiectId, liniiFactura, observatii } = body;

    console.log('Date primite:', { proiectId, liniiFactura, observatii });

    // Validări și defaults
    if (!proiectId) {
      return NextResponse.json({ error: 'Lipsește proiectId' }, { status: 400 });
    }

    if (!liniiFactura || !Array.isArray(liniiFactura) || liniiFactura.length === 0) {
      return NextResponse.json({ error: 'Lipsesc liniile facturii' }, { status: 400 });
    }

    // Calculează totalurile din liniiFactura
    let subtotal = 0;
    let totalTva = 0;
    
    liniiFactura.forEach((linie: any) => {
      const valoare = linie.cantitate * linie.pretUnitar;
      const tva = valoare * (linie.cotaTva / 100);
      subtotal += valoare;
      totalTva += tva;
    });
    
    const total = subtotal + totalTva;

    // Extrage informații despre client din prima linie (temporar - până implementăm clientInfo din modal)
    const primeaLinie = liniiFactura[0];
    const descrierePrincipala = primeaLinie.denumire || 'Servicii de consultanță';
    
    // Setează defaults pentru datele lipsă - va fi înlocuit cu datele reale din modal
    const safeClientData = {
      nume: 'Client din Proiect', // Va veni din clientInfo din modal
      cui: 'RO00000000',
      nr_reg_com: 'J40/0000/2024',
      adresa: 'Adresa client',
      telefon: 'N/A',
      email: 'N/A'
    };

    const safeInvoiceData = {
      numarFactura: `INV-${proiectId}-${Date.now()}`,
      denumireProiect: `Proiect #${proiectId}`,
      descriere: descrierePrincipala,
      subtotal: Number(subtotal.toFixed(2)),
      tva: Number(totalTva.toFixed(2)),
      total: Number(total.toFixed(2)),
      termenPlata: '30 zile'
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `factura-${proiectId}-${timestamp}.pdf`;

    // Creează HTML template pentru factură
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Factură ${safeInvoiceData.numarFactura}</title>
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
                padding: 40px;
                background: white;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .header h1 {
                font-size: 28px;
                color: #2c3e50;
                margin-bottom: 10px;
            }
            .company-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                gap: 40px;
            }
            .company-left, .company-right {
                flex: 1;
            }
            .company-left h3, .company-right h3 {
                font-size: 14px;
                color: #34495e;
                margin-bottom: 8px;
                border-bottom: 1px solid #bdc3c7;
                padding-bottom: 4px;
            }
            .info-line {
                margin-bottom: 4px;
                font-size: 11px;
            }
            .invoice-details {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 5px;
                margin-bottom: 30px;
            }
            .invoice-number {
                font-size: 24px;
                font-weight: bold;
                color: #e74c3c;
                margin-bottom: 10px;
            }
            .invoice-meta {
                display: flex;
                gap: 30px;
            }
            .table-container {
                margin-bottom: 30px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th {
                background: #34495e;
                color: white;
                padding: 12px 8px;
                text-align: left;
                font-size: 11px;
                font-weight: bold;
            }
            td {
                padding: 10px 8px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 11px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section {
                margin-top: 20px;
                margin-left: auto;
                width: 300px;
            }
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #ecf0f1;
            }
            .totals-row.final {
                border-top: 2px solid #34495e;
                border-bottom: 2px solid #34495e;
                font-weight: bold;
                font-size: 14px;
                background: #f8f9fa;
                padding: 12px 0;
            }
            .payment-info {
                margin-top: 40px;
                background: #f8f9fa;
                padding: 20px;
                border-radius: 5px;
            }
            .payment-info h4 {
                color: #34495e;
                margin-bottom: 10px;
                font-size: 13px;
            }
            .bank-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 15px;
            }
            .signatures {
                margin-top: 50px;
                display: flex;
                justify-content: space-between;
            }
            .signature-box {
                text-align: center;
                width: 200px;
            }
            .signature-line {
                border-top: 1px solid #34495e;
                margin-top: 40px;
                padding-top: 8px;
                font-size: 11px;
            }
            .footer {
                margin-top: 60px;
                text-align: center;
                font-size: 10px;
                color: #7f8c8d;
                border-top: 1px solid #ecf0f1;
                padding-top: 20px;
            }
            .footer .generated-info {
                margin-bottom: 10px;
                font-size: 11px;
                color: #34495e;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>FACTURĂ</h1>
        </div>

        <div class="company-info">
            <div class="company-left">
                <h3>FURNIZOR</h3>
                <div class="info-line"><strong>UNITAR PROIECT SRL</strong></div>
                <div class="info-line">CUI: RO12345678</div>
                <div class="info-line">Nr. Reg. Com.: J40/1234/2024</div>
                <div class="info-line">Adresa: Str. Exemplu Nr. 1, București</div>
                <div class="info-line">Telefon: 0721234567</div>
                <div class="info-line">Email: contact@unitarproiect.ro</div>
            </div>
            <div class="company-right">
                <h3>CLIENT</h3>
                <div class="info-line"><strong>${safeClientData.nume}</strong></div>
                <div class="info-line">CUI: ${safeClientData.cui}</div>
                <div class="info-line">Nr. Reg. Com.: ${safeClientData.nr_reg_com}</div>
                <div class="info-line">Adresa: ${safeClientData.adresa}</div>
                <div class="info-line">Telefon: ${safeClientData.telefon}</div>
                <div class="info-line">Email: ${safeClientData.email}</div>
            </div>
        </div>

        <div class="invoice-details">
            <div class="invoice-number">Factura nr: ${safeInvoiceData.numarFactura}</div>
            <div class="invoice-meta">
                <div><strong>Data:</strong> ${new Date().toLocaleDateString('ro-RO')}</div>
                <div><strong>Proiect:</strong> ${safeInvoiceData.denumireProiect}</div>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">Nr.</th>
                        <th style="width: 300px;">Descriere</th>
                        <th style="width: 60px;" class="text-center">Cant.</th>
                        <th style="width: 80px;" class="text-right">Preț Unitar</th>
                        <th style="width: 80px;" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${liniiFactura.map((linie, index) => {
                      const valoare = linie.cantitate * linie.pretUnitar;
                      const tva = valoare * (linie.cotaTva / 100);
                      const totalLinie = valoare + tva;
                      
                      return `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${linie.denumire}</td>
                        <td class="text-center">${linie.cantitate}</td>
                        <td class="text-right">${linie.pretUnitar.toFixed(2)} RON</td>
                        <td class="text-right">${valoare.toFixed(2)} RON</td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="totals-row">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)} RON</span>
                </div>
                ${totalTva > 0 ? `
                <div class="totals-row">
                    <span>TVA:</span>
                    <span>${totalTva.toFixed(2)} RON</span>
                </div>
                ` : ''}
                <div class="totals-row final">
                    <span>TOTAL DE PLATĂ:</span>
                    <span>${total.toFixed(2)} RON</span>
                </div>
            </div>
        </div>

        <div class="payment-info">
            <h4>Condiții de plată</h4>
            <div class="info-line">Termen de plată: ${safeInvoiceData.termenPlata}</div>
            <div class="info-line">Metoda de plată: Transfer bancar</div>
            
            <div class="bank-details">
                <div>
                    <h4>Informații bancare</h4>
                    <div class="info-line">Banca: BCR</div>
                    <div class="info-line">IBAN: RO49RNCB0082004530120001</div>
                    <div class="info-line">SWIFT: RNCBROBU</div>
                </div>
            </div>
        </div>

        <div class="signatures">
            <div class="signature-box">
                <div>Furnizor</div>
                <div class="signature-line">Semnătură și ștampilă</div>
            </div>
            <div class="signature-box">
                <div>Client</div>
                <div class="signature-line">Semnătură și ștampilă</div>
            </div>
        </div>

        <div class="footer">
            <div class="generated-info">
                <strong>Factură generată automat de sistemul UNITAR PROIECT</strong><br>
                Data generării: ${new Date().toLocaleString('ro-RO')}
            </div>
            <div>
                Această factură a fost generată electronic și nu necesită semnătură fizică.<br>
                Pentru întrebări contactați: contact@unitarproiect.ro | 0721234567
            </div>
        </div>
    </body>
    </html>`;

    // Salvează în BigQuery
    try {
      const dataset = bigquery.dataset('PanouControlUnitar');
      const table = dataset.table('FacturiGenerate');

      const facturaData = [{
        id: crypto.randomUUID(),
        proiect_id: proiectId,
        numar_factura: safeInvoiceData.numarFactura,
        client_nume: safeClientData.nume,
        client_cui: safeClientData.cui,
        descriere: descrierePrincipala,
        subtotal: subtotal,
        tva: totalTva,
        total: total,
        status: 'generata',
        data_generare: new Date().toISOString(),
        cale_fisier: fileName,
        tip_factura: 'hibrid_html'
      }];

      await table.insert(facturaData);
      console.log('Metadata factură salvată în BigQuery');
    } catch (bgError) {
      console.error('Eroare la salvarea în BigQuery:', bgError);
    }

    // Returnează JSON cu HTML pentru generarea PDF pe client
    return NextResponse.json({
      success: true,
      message: 'Factură pregătită pentru generare',
      fileName: fileName,
      htmlContent: htmlTemplate,
      invoiceData: {
        numarFactura: safeInvoiceData.numarFactura,
        total: total,
        client: safeClientData.nume
      }
    });

  } catch (error) {
    console.error('Eroare la generarea facturii:', error);
    return NextResponse.json({
      error: 'Eroare la generarea facturii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
