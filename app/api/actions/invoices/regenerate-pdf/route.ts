// ==================================================================
// CALEA: app/api/actions/invoices/regenerate-pdf/route.ts
// DESCRIERE: Regenerează PDF din BD folosind template-ul identic cu generate-hibrid
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

// ✅ ÎNCĂRCARE CONTURI BANCARE - Identic cu generate-hibrid
async function loadContariBancare() {
  try {
    const query = `
      SELECT nume_banca, iban, cont_principal, observatii 
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SetariBanca\`
      ORDER BY cont_principal DESC, nume_banca ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows && rows.length > 0) {
      console.log(`✅ Încărcat ${rows.length} conturi bancare din BigQuery`);
      return rows.map((row: any) => ({
        nume_banca: row.nume_banca,
        iban: row.iban,
        cont_principal: row.cont_principal,
        observatii: row.observatii
      }));
    } else {
      console.log('⚠️ Nu s-au găsit conturi bancare în BigQuery - folosesc fallback');
      return null;
    }
  } catch (error) {
    console.log('⚠️ Eroare la încărcarea conturilor bancare din BigQuery:', error);
    return null;
  }
}

// ✅ FALLBACK CONTURI - Identic cu generate-hibrid
const FALLBACK_CONTURI = [
  {
    nume_banca: 'ING Bank',
    iban: 'RO82INGB0000999905667533',
    cont_principal: true,
    observatii: 'Cont principal pentru încasări'
  },
  {
    nume_banca: 'Trezorerie',
    iban: 'RO29TREZ7035069XXX018857',
    cont_principal: false,
    observatii: 'Trezoreria sectorului 3 Bucuresti'
  }
];

// ✅ TEMPLATE HTML - Identic cu generate-hibrid
function generateBankDetailsHTML(conturi: any[]) {
  if (!conturi || conturi.length === 0) {
    conturi = FALLBACK_CONTURI;
  }

  return conturi.map((cont, index) => {
    const formatIBAN = (iban: string) => {
      return iban.replace(/(.{4})/g, '$1 ').trim();
    };

    const bankTitle = cont.cont_principal ? 
      `CONT PRINCIPAL - ${cont.nume_banca}` : 
      cont.nume_banca.toUpperCase();

    return `
                <div class="bank-section">
                    <h5>${bankTitle}</h5>
                    ${cont.nume_banca !== 'Trezorerie' ? `<div class="info-line">Banca: ${cont.nume_banca}</div>` : ''}
                    <div class="info-line">IBAN: ${formatIBAN(cont.iban)}</div>
                    ${cont.observatii ? `<div class="info-line">${cont.observatii}</div>` : ''}
                </div>`;
  }).join('');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { facturaId, numar } = body;

    console.log('📋 Regenerez PDF pentru factură:', { facturaId, numar });

    if (!facturaId) {
      return NextResponse.json({ error: 'facturaId este obligatoriu' }, { status: 400 });
    }

    // ✅ ÎNCARCĂ DATELE FACTURII DIN BigQuery
    const facturaQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      WHERE id = @facturaId
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId },
      types: { facturaId: 'STRING' },
      location: 'EU',
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({ error: 'Factura nu a fost găsită' }, { status: 404 });
    }

    const facturaData = facturaRows[0];
    
    // ✅ PARSEAZĂ DATELE COMPLETE DIN JSON
    let dateComplete: any = {};
    try {
      if (facturaData.date_complete_json) {
        dateComplete = JSON.parse(facturaData.date_complete_json);
      }
    } catch (error) {
      console.log('⚠️ Nu s-au putut parsa datele complete JSON:', error);
    }

    // ✅ ÎNCARCĂ CONTURI BANCARE
    const contariBancare = await loadContariBancare();
    const contariFinale = contariBancare || dateComplete.contariBancare || FALLBACK_CONTURI;

    // ✅ RECONSTITUIE DATELE PENTRU TEMPLATE
    const clientInfo = dateComplete.clientInfo || {
      nume: facturaData.client_nume || 'Client necunoscut',
      cui: facturaData.client_cui || 'CUI necunoscut',
      nr_reg_com: 'N/A',
      adresa: 'Adresa necunoscută',
      telefon: 'N/A',
      email: 'N/A'
    };

    const liniiFactura = dateComplete.liniiFactura || [{
      denumire: 'Servicii facturate',
      cantitate: 1,
      pretUnitar: facturaData.subtotal || 0,
      cotaTva: facturaData.total_tva > 0 ? 19 : 0,
      tip: 'proiect'
    }];

    const proiectInfo = dateComplete.proiectInfo || {
      id: facturaData.proiect_id || 'NECUNOSCUT',
      denumire: `Proiect #${facturaData.proiect_id || 'NECUNOSCUT'}`
    };

    // ✅ CALCULE TOTALE
    const subtotal = facturaData.subtotal || 0;
    const totalTva = facturaData.total_tva || 0;
    const total = facturaData.total || 0;

    const safeFormat = (num: number) => (Number(num) || 0).toFixed(2);

    // ✅ TEMPLATE HTML IDENTIC CU generate-hibrid
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Factura ${facturaData.numar || numar}</title>
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
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
                font-size: 11px;
                font-weight: bold;
            }
            .signature-line {
                border-top: 1px solid #34495e;
                margin-top: 20px;
                padding-top: 4px;
                font-size: 9px;
                font-weight: normal;
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
            .regenerated-badge {
                background: #e8f4f8;
                border: 1px solid #bee5eb;
                color: #0c5460;
                padding: 8px;
                margin: 10px 0;
                border-radius: 4px;
                text-align: center;
                font-weight: bold;
                font-size: 10px;
            }
        </style>
    </head>
    <body>
        <div class="regenerated-badge">
            📄 PDF REGENERAT din baza de date - ${new Date().toLocaleDateString('ro-RO')} ${new Date().toLocaleTimeString('ro-RO')}
        </div>
        
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
                <div class="info-line"><strong>${clientInfo.nume}</strong></div>
                <div class="info-line">CUI: ${clientInfo.cui}</div>
                <div class="info-line">Nr. Reg. Com.: ${clientInfo.nr_reg_com}</div>
                <div class="info-line">Adresa: ${clientInfo.adresa}</div>
                <div class="info-line">Telefon: ${clientInfo.telefon}</div>
                <div class="info-line">Email: ${clientInfo.email}</div>
            </div>
        </div>

        <div class="invoice-details">
            <div class="invoice-number">Factura nr: ${facturaData.numar || numar}</div>
            <div class="invoice-meta">
                <div><strong>Data:</strong> ${facturaData.data_factura ? new Date(facturaData.data_factura).toLocaleDateString('ro-RO') : new Date().toLocaleDateString('ro-RO')}</div>
                <div><strong>Proiect:</strong> ${proiectInfo.denumire}</div>
                <div><strong>Regenerat:</strong> ${new Date().toLocaleDateString('ro-RO')}</div>
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
                    ${liniiFactura.map((linie: any, index: number) => {
                      const cantitate = Number(linie.cantitate) || 0;
                      const pretUnitar = Number(linie.pretUnitar) || 0;
                      const cotaTva = Number(linie.cotaTva) || 0;
                      
                      const valoare = cantitate * pretUnitar;
                      
                      return `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${linie.denumire || 'N/A'}${linie.tip === 'subproiect' ? ' <small>[SUBPROIECT]</small>' : ''}</td>
                        <td class="text-center">${safeFormat(cantitate)}</td>
                        <td class="text-right">${safeFormat(pretUnitar)} RON</td>
                        <td class="text-right">${safeFormat(valoare)} RON</td>
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
            <div class="info-line">Termen de plata: 30 zile</div>
            <div class="info-line">Metoda de plata: Transfer bancar</div>
            
            <div class="bank-details">
                ${generateBankDetailsHTML(contariFinale)}
            </div>
        </div>

        <div class="signatures">
            <div class="signature-box">
                <div style="font-size: 11px; font-weight: bold; margin-bottom: 5px;">Furnizor</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
            <div class="signature-box">
                <div style="font-size: 11px; font-weight: bold; margin-bottom: 5px;">Client</div>
                <div class="signature-line">Semnatura si stampila</div>
            </div>
        </div>

        <div class="footer">
            <div class="generated-info">
                <strong>Factura regenerata din sistemul UNITAR PROIECT TDA</strong><br>
                Original: ${facturaData.data_creare ? new Date(facturaData.data_creare).toLocaleString('ro-RO') : 'N/A'}<br>
                Regenerat: ${new Date().toLocaleString('ro-RO')}
            </div>
            <div>
                Aceasta factura a fost regenerata din baza de date si este identica cu originalul.<br>
                Pentru intrebari contactati: contact@unitarproiect.eu | 0765486044
            </div>
        </div>
    </body>
    </html>`;

    // ✅ RETURN HTML pentru regenerare în browser (ca în FacturiList.tsx)
    return NextResponse.json({
      success: true,
      htmlContent: htmlTemplate,
      fileName: `Factura_${facturaData.numar || numar}.pdf`,
      message: 'Template HTML generat pentru regenerare PDF',
      facturaData: {
        id: facturaData.id,
        numar: facturaData.numar || numar,
        client: clientInfo.nume,
        total: total,
        contariCount: contariFinale.length
      }
    });

  } catch (error) {
    console.error('❌ Eroare la regenerarea PDF:', error);
    return NextResponse.json({
      error: 'Eroare la regenerarea PDF',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
