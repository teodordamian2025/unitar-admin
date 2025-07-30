// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// MODIFICAT: Adăugat Mock Mode pentru testare e-factura + păstrează toate funcționalitățile
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

// ✅ MOCK MODE pentru testare e-factura - setează la true pentru teste sigure
const MOCK_EFACTURA_MODE = true; // ← SCHIMBĂ la false pentru producție reală

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
    const { 
      proiectId, 
      liniiFactura, 
      observatii, 
      clientInfo,
      sendToAnaf = false  // ✅ Parametru pentru e-factura ANAF
    } = body;

    console.log('📋 Date primite pentru factură:', { 
      proiectId, 
      liniiFactura: liniiFactura?.length, 
      observatii: observatii?.length, 
      clientInfo: clientInfo?.nume, 
      sendToAnaf,
      mockMode: MOCK_EFACTURA_MODE && sendToAnaf
    });

    // ✅ VALIDĂRI EXISTENTE - păstrate identice
    if (!proiectId) {
      return NextResponse.json({ error: 'Lipsește proiectId' }, { status: 400 });
    }

    if (!liniiFactura || !Array.isArray(liniiFactura) || liniiFactura.length === 0) {
      return NextResponse.json({ error: 'Lipsesc liniile facturii' }, { status: 400 });
    }

    // ✅ CALCULE TOTALE - păstrate identice
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

    // ✅ Generează facturaId la început
    const facturaId = crypto.randomUUID();

    // ✅ CLIENT DATA HANDLING - păstrat identic
    const primeaLinie = liniiFactura[0];
    const descrierePrincipala = primeaLinie.denumire || 'Servicii de consultanță';
    
    const safeClientData = clientInfo ? {
      nume: clientInfo.denumire || 'Client din Proiect',
      cui: clientInfo.cui || 'RO00000000',
      nr_reg_com: clientInfo.nrRegCom || 'J40/0000/2024',
      adresa: clientInfo.adresa || 'Adresa client',
      telefon: clientInfo.telefon || 'N/A',
      email: clientInfo.email || 'N/A'
    } : {
      nume: 'Client din Proiect',
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

    // ✅ TEMPLATE HTML - păstrat identic
    const safeFormat = (num: number) => (Number(num) || 0).toFixed(2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `factura-${proiectId}-${timestamp}.pdf`;

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
            ${MOCK_EFACTURA_MODE && sendToAnaf ? `
            .mock-warning {
                background: #fff3cd;
                border: 2px solid #ffc107;
                color: #856404;
                padding: 10px;
                margin: 10px 0;
                border-radius: 5px;
                text-align: center;
                font-weight: bold;
                font-size: 11px;
            }
            ` : ''}
        </style>
    </head>
    <body>
        ${MOCK_EFACTURA_MODE && sendToAnaf ? `
        <div class="mock-warning">
            🧪 TESTARE e-FACTURA - Această factură NU a fost trimisă la ANAF (Mock Mode)
        </div>
        ` : ''}
        
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
                ${MOCK_EFACTURA_MODE && sendToAnaf ? '<div><strong>🧪 MODE:</strong> TEST e-Factura</div>' : ''}
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
                        <td>${linie.denumire || 'N/A'}${linie.tip === 'subproiect' ? ' <small>[SUBPROIECT]</small>' : ''}</td>
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
                <strong>Factura generata automat de sistemul UNITAR PROIECT TDA</strong><br>
                Data generarii: ${new Date().toLocaleString('ro-RO')}
                ${sendToAnaf ? (MOCK_EFACTURA_MODE ? 
                  '<br><strong>🧪 TEST MODE: Simulare e-Factura (NU trimis la ANAF)</strong>' : 
                  '<br><strong>📤 Trimisa automat la ANAF ca e-Factura</strong>') : ''}
            </div>
            <div>
                Aceasta factura a fost generata electronic si nu necesita semnatura fizica.<br>
                Pentru intrebari contactati: contact@unitarproiect.eu | 0765486044
            </div>
        </div>
    </body>
    </html>`;

    // ✅ MANAGEMENT e-FACTURA - Mock Mode sau Producție
    let xmlResult: any = null;

    if (sendToAnaf) {
      if (MOCK_EFACTURA_MODE) {
        // 🧪 MOCK MODE - Simulează e-factura fără trimitere la ANAF
        console.log('🧪 MOCK MODE: Simulez e-factura pentru:', {
          facturaId,
          clientCUI: safeClientData.cui,
          totalFactura: safeFormat(total),
          liniiFactura: liniiFactura.length
        });

        const mockXmlId = `MOCK_XML_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Simulează salvare în BigQuery FacturiEFACTURA
        await saveMockEfacturaRecord({
          xmlId: mockXmlId,
          facturaId,
          proiectId,
          clientInfo: safeClientData,
          liniiFactura,
          total: safeFormat(total),
          subtotal: safeFormat(subtotal),
          totalTva: safeFormat(totalTva)
        });

        xmlResult = {
          success: true,
          xmlId: mockXmlId,
          status: 'mock_generated',
          mockMode: true,
          message: '🧪 XML generat în mode test - NU trimis la ANAF'
        };

        console.log('✅ Mock e-factura completă:', mockXmlId);

      } else {
        // 🚀 PRODUCȚIE - Cod real pentru ANAF
        console.log('🚀 PRODUCȚIE: Generez XML real pentru ANAF...');
        
        try {
          const xmlResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/actions/invoices/generate-xml`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              facturaId: facturaId,
              forceRegenerate: false 
            })
          });

          xmlResult = await xmlResponse.json();
          
          if (xmlResult.success) {
            console.log('✅ XML real generat pentru ANAF:', xmlResult.xmlId);
          } else {
            console.error('❌ Eroare la generarea XML ANAF:', xmlResult.error);
          }
        } catch (xmlError) {
          console.error('❌ Eroare la apelarea API-ului XML:', xmlError);
          xmlResult = {
            success: false,
            error: 'Eroare la generarea XML pentru ANAF',
            details: xmlError instanceof Error ? xmlError.message : 'Eroare necunoscută'
          };
        }
      }
    }

    // ✅ SALVARE în BigQuery FacturiGenerate - păstrată și extinsă
    try {
      const dataset = bigquery.dataset('PanouControlUnitar');
      const table = dataset.table('FacturiGenerate');

      const facturaData = [{
        id: facturaId,
        proiect_id: proiectId,
        serie: 'INV',
        numar: safeInvoiceData.numarFactura,
        data_factura: new Date().toISOString().split('T')[0],
        data_scadenta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        client_id: null,
        client_nume: safeClientData.nume,
        client_cui: safeClientData.cui,
        subtotal: Number(subtotal.toFixed(2)),
        total_tva: Number(totalTva.toFixed(2)),
        total: Number(total.toFixed(2)),
        valoare_platita: 0,
        status: 'generata',
        efactura_enabled: sendToAnaf,
        efactura_status: sendToAnaf ? (MOCK_EFACTURA_MODE ? 'mock_test' : 'pending') : null,
        efactura_mock_mode: MOCK_EFACTURA_MODE && sendToAnaf, // ✅ NOU: Flag pentru mock
        anaf_upload_id: xmlResult?.xmlId || null,
        date_complete_json: JSON.stringify({
          liniiFactura,
          observatii,
          clientInfo: safeClientData,
          proiectInfo: {
            id: proiectId,
            denumire: safeInvoiceData.denumireProiect
          },
          mockMode: MOCK_EFACTURA_MODE && sendToAnaf
        }),
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString()
      }];

      await table.insert(facturaData);
      console.log('✅ Metadata factură salvată în BigQuery FacturiGenerate');

    } catch (bgError) {
      console.error('❌ Eroare la salvarea în BigQuery FacturiGenerate:', bgError);
    }

    // ✅ RESPONSE complet cu informații Mock/Producție
    const response = {
      success: true,
      message: sendToAnaf ? 
        (MOCK_EFACTURA_MODE ? 
          '🧪 Factură pregătită pentru PDF + e-factura TEST (Mock Mode)' : 
          '🚀 Factură pregătită pentru PDF + e-factura ANAF') : 
        '📄 Factură pregătită pentru generare PDF',
      fileName: fileName,
      htmlContent: htmlTemplate,
      invoiceData: {
        facturaId: facturaId,
        numarFactura: safeInvoiceData.numarFactura,
        total: total,
        client: safeClientData.nume
      },
      efactura: sendToAnaf ? {
        enabled: true,
        mockMode: MOCK_EFACTURA_MODE,
        xmlId: xmlResult?.xmlId || null,
        xmlStatus: xmlResult?.status || 'error',
        xmlGenerated: xmlResult?.success || false,
        xmlError: xmlResult?.error || null,
        message: xmlResult?.message || null
      } : {
        enabled: false,
        mockMode: false
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Eroare generală la generarea facturii:', error);
    return NextResponse.json({
      error: 'Eroare la generarea facturii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// ✅ FUNCȚIE MOCK pentru salvare test e-factura
async function saveMockEfacturaRecord(data: any) {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('FacturiEFACTURA');

    const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <!-- MOCK XML pentru testare e-factura -->
  <ID>${data.xmlId}</ID>
  <IssueDate>${new Date().toISOString().split('T')[0]}</IssueDate>
  <InvoiceTypeCode>380</InvoiceTypeCode>
  <Note>🧪 MOCK XML - generat pentru testare, NU trimis la ANAF</Note>
  <TaxInclusiveAmount currencyID="RON">${data.total}</TaxInclusiveAmount>
  <TaxExclusiveAmount currencyID="RON">${data.subtotal}</TaxExclusiveAmount>
  <AccountingSupplierParty>
    <Party>
      <PartyIdentification>
        <ID schemeID="RO">RO35639210</ID>
      </PartyIdentification>
      <PartyName>
        <Name>UNITAR PROIECT TDA SRL</Name>
      </PartyName>
    </Party>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <Party>
      <PartyIdentification>
        <ID schemeID="RO">${data.clientInfo.cui}</ID>
      </PartyIdentification>
      <PartyName>
        <Name>${data.clientInfo.nume}</Name>
      </PartyName>
    </Party>
  </AccountingCustomerParty>
</Invoice>`;

    const record = [{
      id: crypto.randomUUID(),
      factura_id: data.facturaId,
      xml_id: data.xmlId,
      proiect_id: data.proiectId,
      client_cui: data.clientInfo.cui,
      client_denumire: data.clientInfo.nume,
      subtotal_factura: parseFloat(data.subtotal),
      tva_factura: parseFloat(data.totalTva),
      total_factura: parseFloat(data.total),
      status_anaf: 'MOCK_TEST',
      xml_content: mockXmlContent,
      data_creare: new Date().toISOString(),
      data_trimitere_anaf: null, // NULL pentru mock
      data_raspuns_anaf: null,
      response_anaf: JSON.stringify({ 
        mock: true, 
        test_mode: true, 
        message: 'XML generat în mod test - nu a fost trimis la ANAF',
        xml_id: data.xmlId,
        timestamp: new Date().toISOString()
      }),
      upload_index_anaf: null,
      mesaje_anaf: JSON.stringify([{
        tip: 'INFO',
        mesaj: '🧪 Factură generată în Mock Mode pentru testare',
        data: new Date().toISOString()
      }])
    }];

    await table.insert(record);
    console.log('✅ Mock e-factura record salvat în FacturiEFACTURA:', data.xmlId);

  } catch (error) {
    console.error('❌ Eroare la salvarea mock e-factura record:', error);
    throw error;
  }
}
