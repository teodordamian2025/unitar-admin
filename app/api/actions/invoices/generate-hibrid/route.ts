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

    // Calculează totalurile din liniiFactura cu verificări sigure
    let subtotal = 0;
    let totalTva = 0;
    
    liniiFactura.forEach((linie: any) => {
      const cantitate = Number(linie.cantitate) || 0;
      const pretUnitar = Number(linie.pretUnitar) || 0;
      const cotaTva = Number(linie.cotaTva) || 0;
      
      const valoare = cantitate * pretUnitar;
      const tva = valoare * (cotaTva / 100);
      
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

    // Funcție sigură pentru formatare numerică în template
    const safeFormat = (num: number) => (Number(num) || 0).toFixed(2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `factura-${proiectId}-${timestamp}.pdf`;

    // Creează HTML template pentru factură
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Factura ${safeInvoiceData.numarFactura}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 3px; /* MĂRIT DE LA 12px LA 3px */
                line-height: 1.2; /* MĂRIT DE LA 0.8 LA 1.2 pentru mai mult spațiu */
                color: #333;
                padding: 15px; /* MĂRIT DE LA 5px LA 15px */
                background: white;
                min-height: 1000px; /* ADĂUGAT: Înălțime minimă */
                display: flex; /* ADĂUGAT: Flex layout */
                flex-direction: column; /* ADĂUGAT: Coloană */
                justify-content: space-between; /* ADĂUGAT: Distribuie pe înălțime */
            }
            .header {
                text-align: center;
                margin-bottom: 20px; /* MĂRIT DE LA 2px LA 20px */
            }
            .header h1 {
                font-size: 12px; /* MĂRIT DE LA 6px LA 12px */
                color: #2c3e50;
                margin-bottom: 10px; /* MĂRIT DE LA 1px LA 10px */
            }
            .company-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px; /* MĂRIT DE LA 2px LA 20px */
                gap: 20px; /* MĂRIT DE LA 5px LA 20px */
            }
            .company-left, .company-right {
                flex: 1;
            }
            .company-left h3, .company-right h3 {
                font-size: 3.5px; /* REDUS DE LA 14px LA 3.5px */
                color: #34495e;
                margin-bottom: 0.5px; /* REDUS DE LA 8px LA 0.5px */
                border-bottom: 1px solid #bdc3c7;
                padding-bottom: 0.25px; /* REDUS DE LA 4px LA 0.25px */
            }
            .info-line {
                margin-bottom: 0.25px; /* REDUS DE LA 4px LA 0.25px */
                font-size: 3px; /* REDUS DE LA 11px LA 3px */
            }
            .invoice-details {
                background: #f8f9fa;
                padding: 15px; /* MĂRIT DE LA 2px LA 15px */
                border-radius: 3px; /* MĂRIT DE LA 1px LA 3px */
                margin-bottom: 20px; /* MĂRIT DE LA 2px LA 20px */
            }
            .invoice-number {
                font-size: 10px; /* MĂRIT DE LA 6px LA 10px */
                font-weight: bold;
                color: #e74c3c;
                margin-bottom: 8px; /* MĂRIT DE LA 1px LA 8px */
            }
            .invoice-meta {
                display: flex;
                gap: 3px; /* REDUS DE LA 30px LA 3px */
            }
            .table-container {
                margin-bottom: 20px; /* MĂRIT DE LA 2px LA 20px */
                flex-grow: 1; /* ADĂUGAT: Ocupă spațiul disponibil */
            }
            table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                font-size: 2.5px; /* ADĂUGAT - font foarte mic pentru tabele */
            }
            th {
                background: #34495e;
                color: white;
                padding: 8px 4px; /* MĂRIT DE LA 1px LA 8px */
                text-align: left;
                font-size: 4px; /* MĂRIT DE LA 2.5px LA 4px */
                font-weight: bold;
            }
            td {
                padding: 6px 4px; /* MĂRIT DE LA 0.5px LA 6px */
                border-bottom: 1px solid #ecf0f1;
                font-size: 4px; /* MĂRIT DE LA 2.5px LA 4px */
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section {
                margin-top: 2px; /* REDUS DE LA 20px LA 2px */
                margin-left: auto;
                width: 150px; /* REDUS DE LA 300px LA 150px */
            }
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 0.5px 0; /* REDUS DE LA 8px LA 0.5px */
                border-bottom: 1px solid #ecf0f1;
                font-size: 3px; /* ADĂUGAT - font mic pentru totaluri */
            }
            .totals-row.final {
                border-top: 2px solid #34495e;
                border-bottom: 2px solid #34495e;
                font-weight: bold;
                font-size: 3.5px; /* REDUS DE LA 14px LA 3.5px */
                background: #f8f9fa;
                padding: 1px 0; /* REDUS DE LA 12px LA 1px */
            }
            .payment-info {
                margin-top: 3px; /* REDUS DE LA 40px LA 3px */
                background: #f8f9fa;
                padding: 2px; /* REDUS DE LA 20px LA 2px */
                border-radius: 1px; /* REDUS DE LA 5px LA 1px */
            }
            .payment-info h4 {
                color: #34495e;
                margin-bottom: 1px; /* REDUS DE LA 10px LA 1px */
                font-size: 3px; /* REDUS DE LA 13px LA 3px */
            }
            .bank-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 2px; /* REDUS DE LA 20px LA 2px */
                margin-top: 1px; /* REDUS DE LA 15px LA 1px */
            }
            .signatures {
                margin-top: 4px; /* REDUS DE LA 50px LA 4px */
                display: flex;
                justify-content: space-between;
            }
            .signature-box {
                text-align: center;
                width: 50px; /* REDUS DE LA 200px LA 50px */
            }
            .signature-line {
                border-top: 1px solid #34495e;
                margin-top: 3px; /* REDUS DE LA 40px LA 3px */
                padding-top: 0.5px; /* REDUS DE LA 8px LA 0.5px */
                font-size: 3px; /* REDUS DE LA 11px LA 3px */
            }
            .footer {
                margin-top: 5px; /* REDUS DE LA 60px LA 5px */
                text-align: center;
                font-size: 2.5px; /* REDUS DE LA 10px LA 2.5px */
                color: #7f8c8d;
                border-top: 1px solid #ecf0f1;
                padding-top: 2px; /* REDUS DE LA 20px LA 2px */
            }
            .footer .generated-info {
                margin-bottom: 1px; /* REDUS DE LA 10px LA 1px */
                font-size: 3px; /* REDUS DE LA 11px LA 3px */
                color: #34495e;
            }
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
                <div class="info-line">CUI: RO12345678</div>
                <div class="info-line">Nr. Reg. Com.: J40/1234/2024</div>
                <div class="info-line">Adresa: Str. Exemplu Nr. 1, Bucuresti</div>
                <div class="info-line">Telefon: 0721234567</div>
                <div class="info-line">Email: contact@unitarproiecttda.ro</div>
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
                      // Verificări sigure pentru tipuri
                      const cantitate = Number(linie.cantitate) || 0;
                      const pretUnitar = Number(linie.pretUnitar) || 0;
                      const cotaTva = Number(linie.cotaTva) || 0;
                      
                      const valoare = cantitate * pretUnitar;
                      const tva = valoare * (cotaTva / 100);
                      const totalLinie = valoare + tva;
                      
                      // Funcție sigură pentru formatare
                      const safeFixed = (num) => (Number(num) || 0).toFixed(2);
                      
                      return `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${linie.denumire || 'N/A'}</td>
                        <td class="text-center">${safeFixed(cantitate)}</td>
                        <td class="text-right">${safeFixed(pretUnitar)} RON</td>
                        <td class="text-right">${safeFixed(valoare)} RON</td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="totals-row">
                    <span>Subtotal:</span>
                    <span>${safeFormat(subtotal)} RON</span>
                </div>
                ${totalTva > 0 ? `
                <div class="totals-row">
                    <span>TVA:</span>
                    <span>${safeFormat(totalTva)} RON</span>
                </div>
                ` : ''}
                <div class="totals-row final">
                    <span>TOTAL DE PLATĂ:</span>
                    <span>${safeFormat(total)} RON</span>
                </div>
            </div>
        </div>

        <div class="payment-info">
            <h4>Conditii de plata</h4>
            <div class="info-line">Termen de plata: ${safeInvoiceData.termenPlata}</div>
            <div class="info-line">Metoda de plata: Transfer bancar</div>
            
            <div class="bank-details">
                <div>
                    <h4>Informatii bancare</h4>
                    <div class="info-line">Banca: BCR</div>
                    <div class="info-line">IBAN: RO49RNCB0082004530120001</div>
                    <div class="info-line">SWIFT: RNCBROBU</div>
                </div>
            </div>
        </div>

        <div class="signatures">
            <div class="signature-box">
                <div>Furnizor</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
            <div class="signature-box">
                <div>Client</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
        </div>

        <div class="footer">
            <div class="generated-info">
                <strong>Factura generata automat de sistemul UNITAR PROIECT TDA</strong><br>
                Data generarii: ${new Date().toLocaleString('ro-RO')}
            </div>
            <div>
                Aceasta factura a fost generata electronic si nu necesita semnatura fizica.<br>
                Pentru intrebari contactati: contact@unitarproiecttda.ro | 0721234567
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
        subtotal: Number(subtotal.toFixed(2)),
        tva: Number(totalTva.toFixed(2)),
        total: Number(total.toFixed(2)),
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
