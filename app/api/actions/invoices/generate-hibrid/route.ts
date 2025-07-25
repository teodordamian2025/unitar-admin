// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// MODIFICAT: Îmbunătățit cu client_id lookup din BD + metadata completa
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Definire tipuri pentru BigQuery results
interface ProiectRow {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number;
  Data_Start?: string;
  Data_Final?: string;
}

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
    const { proiectId, liniiFactura, observatii, clientInfo } = body;

    console.log('Date primite pentru factură hibridă:', { proiectId, liniiFactura, observatii, clientInfo });

    // Validări și defaults
    if (!proiectId) {
      return NextResponse.json({ error: 'Lipsește proiectId' }, { status: 400 });
    }

    if (!liniiFactura || !Array.isArray(liniiFactura) || liniiFactura.length === 0) {
      return NextResponse.json({ error: 'Lipsesc liniile facturii' }, { status: 400 });
    }

    if (!clientInfo || !clientInfo.denumire || !clientInfo.cui) {
      return NextResponse.json({ error: 'Informațiile clientului sunt incomplete' }, { status: 400 });
    }

    // ✅ NOUĂ: Caută client_id în BD pe baza CUI-ului
    let clientId = null;
    try {
      const clientQuery = `
        SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
        WHERE activ = true AND cui = @cui
        LIMIT 1
      `;
      
      const [clientRows] = await bigquery.query({
        query: clientQuery,
        params: { cui: clientInfo.cui },
        location: 'EU',
      });
      
      if (clientRows.length > 0) {
        clientId = clientRows[0].id;
        console.log('✅ Client găsit în BD:', clientId);
      } else {
        console.log('⚠️ Client nu găsit în BD pentru CUI:', clientInfo.cui);
      }
    } catch (error) {
      console.error('Eroare la căutarea clientului în BD:', error);
    }

    // ✅ NOUĂ: Încarcă informații complete despre proiect din BD
    let proiectInfo: ProiectRow | null = null;
    try {
      const proiectQuery = `
        SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
        WHERE ID_Proiect = @proiectId
        LIMIT 1
      `;
      
      const [proiectRows] = await bigquery.query({
        query: proiectQuery,
        params: { proiectId },
        location: 'EU',
      });
      
      if (proiectRows.length > 0) {
        proiectInfo = proiectRows[0] as ProiectRow;
        console.log('✅ Proiect găsit în BD:', proiectInfo.Denumire);
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectului din BD:', error);
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

    // Folosește clientInfo din modal
    const safeClientData = {
      nume: clientInfo.denumire,
      cui: clientInfo.cui,
      nr_reg_com: clientInfo.nrRegCom || '',
      adresa: clientInfo.adresa,
      telefon: clientInfo.telefon || 'N/A',
      email: clientInfo.email || 'N/A'
    };

    // ✅ ÎMBUNĂTĂȚIT: Folosește informațiile reale din proiect
    const safeInvoiceData = {
      numarFactura: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, // Format mai scurt
      denumireProiect: proiectInfo?.Denumire || `Proiect #${proiectId}`,
      descriere: liniiFactura[0]?.denumire || 'Servicii de consultanță',
      subtotal: Number(subtotal.toFixed(2)),
      tva: Number(totalTva.toFixed(2)),
      total: Number(total.toFixed(2)),
      termenPlata: '30 zile'
    };

    // Funcție sigură pentru formatare numerică în template
    const safeFormat = (num: number) => (Number(num) || 0).toFixed(2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `factura-${safeInvoiceData.numarFactura}-${timestamp}.pdf`;

    // ✅ TEMPLATE HTML FINAL - optimizat și corectat
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
                font-size: 10px;
                line-height: 1.2;
                color: #333;
                padding: 15px;
                background: white;
                min-height: 1000px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .header h1 {
                font-size: 16px;
                color: #2c3e50;
                margin-bottom: 10px;
                font-weight: bold;
            }
            .company-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                gap: 20px;
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
                font-weight: bold;
            }
            .info-line {
                margin-bottom: 4px;
                font-size: 10px;
            }
            .invoice-details {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 3px;
                margin-bottom: 20px;
            }
            .invoice-number {
                font-size: 12px;
                font-weight: bold;
                color: #e74c3c;
                margin-bottom: 8px;
            }
            .invoice-meta {
                display: flex;
                gap: 30px;
                font-size: 10px;
            }
            .table-container {
                margin-bottom: 20px;
                flex-grow: 1;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                font-size: 10px;
            }
            th {
                background: #34495e;
                color: white;
                padding: 8px 4px;
                text-align: left;
                font-size: 10px;
                font-weight: bold;
            }
            td {
                padding: 6px 4px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 10px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section {
                margin-top: 2px;
                margin-left: auto;
                width: 150px;
            }
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                border-bottom: 1px solid #ecf0f1;
                font-size: 10px;
            }
            .totals-row.final {
                border-top: 2px solid #34495e;
                border-bottom: 2px solid #34495e;
                font-weight: bold;
                font-size: 12px;
                background: #f8f9fa;
                padding: 6px 0;
            }
            .payment-info {
                margin-top: 15px;
                background: #f8f9fa;
                padding: 12px;
                border-radius: 3px;
            }
            .payment-info h4 {
                color: #34495e;
                margin-bottom: 8px;
                font-size: 11px;
                font-weight: bold;
            }
            .bank-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-top: 8px;
            }
            .bank-section {
                border: 1px solid #dee2e6;
                padding: 8px;
                border-radius: 3px;
                background: white;
            }
            .bank-section h5 {
                font-size: 10px;
                font-weight: bold;
                color: #34495e;
                margin-bottom: 5px;
                border-bottom: 1px solid #eee;
                padding-bottom: 2px;
            }
            .signatures {
                margin-top: 25px;
                display: flex;
                justify-content: space-between;
            }
            .signature-box {
                text-align: center;
                width: 120px;
            }
            .signature-line {
                border-top: 1px solid #34495e;
                margin-top: 20px;
                padding-top: 4px;
                font-size: 9px;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 8px;
                color: #7f8c8d;
                border-top: 1px solid #ecf0f1;
                padding-top: 10px;
            }
            .footer .generated-info {
                margin-bottom: 8px;
                font-size: 9px;
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
                <div class="info-line">CUI: RO35639210</div>
                <div class="info-line">Nr. Reg. Com.: J2016002024405</div>
                <div class="info-line">Adresa: Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4</div>
                <div class="info-line">Telefon: 0765486044</div>
                <div class="info-line">Email: contact@unitarproiect.eu</div>
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
                        <th style="width: 80px;" class="text-right">Pret Unitar</th>
                        <th style="width: 80px;" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${liniiFactura.map((linie, index) => {
                      const cantitate = Number(linie.cantitate) || 0;
                      const pretUnitar = Number(linie.pretUnitar) || 0;
                      const cotaTva = Number(linie.cotaTva) || 0;
                      
                      const valoare = cantitate * pretUnitar;
                      const tva = valoare * (cotaTva / 100);
                      const totalLinie = valoare + tva;
                      
                      const safeFixed = (num) => (Number(num) || 0).toFixed(2);
                      
                      return `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${linie.denumire || 'N/A'}${linie.tip === 'subproiect' ? ' (Subproiect)' : ''}</td>
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
                    <span>TOTAL DE PLATA:</span>
                    <span>${safeFormat(total)} RON</span>
                </div>
            </div>
        </div>

        <div class="payment-info">
            <h4>Conditii de plata</h4>
            <div class="info-line">Termen de plata: ${safeInvoiceData.termenPlata}</div>
            <div class="info-line">Metoda de plata: Transfer bancar</div>
            
            <div class="bank-details">
                <div class="bank-section">
                    <h5>CONT PRINCIPAL</h5>
                    <div class="info-line">Banca: ING</div>
                    <div class="info-line">IBAN: RO82INGB0000999905667533</div>
                </div>
                <div class="bank-section">
                    <h5>CONT TREZORERIE</h5>
                    <div class="info-line">IBAN: RO29TREZ7035069XXX018857</div>
                    <div class="info-line">Trezoreria sectorului 3 Bucuresti</div>
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
                Pentru intrebari contactati: contact@unitarproiect.eu | 0765486044
            </div>
        </div>
    </body>
    </html>`;

    // ✅ SALVARE COMPLETĂ și OPTIMIZATĂ în BigQuery
    try {
      const dataset = bigquery.dataset('PanouControlUnitar');
      const table = dataset.table('FacturiGenerate');

      // ✅ Calculează data scadentă (30 zile)
      const dataScadenta = new Date();
      dataScadenta.setDate(dataScadenta.getDate() + 30);

      const facturaData = [{
        id: crypto.randomUUID(),
        proiect_id: proiectId,
        serie: 'INV',
        numar: safeInvoiceData.numarFactura,
        data_factura: new Date().toISOString().split('T')[0],
        data_scadenta: dataScadenta.toISOString().split('T')[0],
        id_factura_externa: null,
        url_publica: null,
        url_download: null,
        client_id: clientId, // ✅ Client ID din BD sau null
        client_nume: safeClientData.nume,
        client_cui: safeClientData.cui,
        subtotal: Number(subtotal.toFixed(2)),
        total_tva: Number(totalTva.toFixed(2)),
        total: Number(total.toFixed(2)),
        valoare_platita: 0,
        status: 'generata',
        data_trimitere: null,
        data_plata: null,
        date_complete_json: JSON.stringify({
          liniiFactura,
          observatii,
          clientInfo: safeClientData,
          proiectInfo: proiectInfo ? {
            id: proiectInfo.ID_Proiect,
            denumire: proiectInfo.Denumire,
            client: proiectInfo.Client,
            valoare_estimata: proiectInfo.Valoare_Estimata
          } : null,
          metadata: {
            user_agent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString(),
            version: '2.0_hibrid'
          }
        }),
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString()
      }];

      await table.insert(facturaData);
      console.log('✅ Factură salvată complet în BigQuery FacturiGenerate cu client_id:', clientId);
    } catch (bgError) {
      console.error('❌ Eroare la salvarea în BigQuery:', bgError);
      // Nu oprește procesul, doar loghează eroarea
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
        client: safeClientData.nume,
        clientId: clientId,
        proiectInfo: proiectInfo ? {
          denumire: proiectInfo.Denumire,
          client: proiectInfo.Client
        } : null
      }
    });

  } catch (error) {
    console.error('Eroare la generarea facturii hibride:', error);
    return NextResponse.json({
      error: 'Eroare la generarea facturii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
