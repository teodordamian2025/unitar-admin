// ==================================================================
// CALEA: app/api/actions/invoices/generate-hibrid/route.ts
// MODIFICAT: Fix types pentru Edit + caractere PDF + debugging
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

// ✅ NOUĂ FUNCȚIE pentru încărcarea conturilor bancare din BigQuery
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
    console.log('📋 Folosesc conturile hard-codate ca fallback');
    return null;
  }
}

// ✅ FALLBACK conturi bancare hard-codate (ca backup)
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

// ✅ FUNCȚIE pentru generarea HTML-ului conturilor bancare
function generateBankDetailsHTML(conturi: any[]) {
  if (!conturi || conturi.length === 0) {
    conturi = FALLBACK_CONTURI;
  }

  return conturi.map((cont, index) => {
    const formatIBAN = (iban: string) => {
      // Formatează IBAN cu spații la fiecare 4 caractere pentru lizibilitate
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

// ✅ NOU: Funcție helper pentru curățarea caracterelor non-ASCII
function cleanNonAscii(text: string): string {
  // Păstrează doar caractere ASCII și înlocuiește diacriticele românești
  return text
    .replace(/ă/g, 'a')
    .replace(/Ă/g, 'A')
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/ș/g, 's')
    .replace(/Ș/g, 'S')
    .replace(/ț/g, 't')
    .replace(/Ț/g, 'T')
    .replace(/[^\x00-\x7F]/g, ''); // Elimină orice alt caracter non-ASCII
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      proiectId, 
      liniiFactura, 
      observatii, 
      clientInfo,
      numarFactura,
      setariFacturare,
      sendToAnaf = false,
      cursuriUtilizate = {}, // ✅ NOU: Primește cursurile utilizate
      isEdit = false,        // ✅ NOU: Flag pentru edit
      isStorno = false,      // ✅ NOU: Flag pentru storno
      facturaId = null,      // ✅ NOU: ID factură pentru edit
      facturaOriginala = null // ✅ NOU: Număr factură originală pentru storno
    } = body;

    console.log('📋 Date primite pentru factură:', { 
      proiectId, 
      liniiFactura: liniiFactura?.length, 
      observatii: observatii?.length, 
      clientInfo: clientInfo?.nume,
      numarFactura,
      sendToAnaf,
      isEdit,
      isStorno,
      facturaId,
      cursuriUtilizate: Object.keys(cursuriUtilizate).length > 0 ? cursuriUtilizate : 'Niciun curs',
      mockMode: MOCK_EFACTURA_MODE && sendToAnaf
    });

    // ✅ VALIDĂRI EXISTENTE - păstrate identice
    if (!proiectId) {
      return NextResponse.json({ error: 'Lipsește proiectId' }, { status: 400 });
    }

    if (!liniiFactura || !Array.isArray(liniiFactura) || liniiFactura.length === 0) {
      return NextResponse.json({ error: 'Lipsesc liniile facturii' }, { status: 400 });
    }

    // ✅ ÎNCĂRCARE CONTURI BANCARE din BigQuery
    const contariBancare = await loadContariBancare();
    const contariFinale = contariBancare || FALLBACK_CONTURI;
    
    console.log(`🏦 Folosesc ${contariFinale.length} conturi bancare:`, 
      contariFinale.map(c => `${c.nume_banca} (${c.cont_principal ? 'Principal' : 'Secundar'})`).join(', ')
    );

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

    // ✅ NOU: Pentru Edit, folosește facturaId existent
    const currentFacturaId = isEdit && facturaId ? facturaId : crypto.randomUUID();

    // ✅ MODIFICAT: Generează nota despre cursurile valutare cu verificare tip
    let notaCursValutar = '';
    if (Object.keys(cursuriUtilizate).length > 0) {
      const monede = Object.keys(cursuriUtilizate);
      notaCursValutar = `Curs valutar folosit: ${monede.map(m => {
        const cursInfo = cursuriUtilizate[m];
        // Verifică că avem curs și este număr
        const curs = typeof cursInfo.curs === 'number' ? cursInfo.curs : 
                     (typeof cursInfo.curs === 'string' ? parseFloat(cursInfo.curs) : 1);
        return `1 ${m} = ${curs.toFixed(4)} RON (${cursInfo.data})`;
      }).join(', ')}`;
    }

    // ✅ MODIFICAT: Adaugă nota cursului la observații pentru PDF
    const observatiiFinale = observatii + (notaCursValutar ? `\n\n${notaCursValutar}` : '');

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

    // ✅ MODIFICAT: Folosește numărul primit din frontend
    const safeInvoiceData = {
      numarFactura: numarFactura || `INV-${proiectId}-${Date.now()}`,
      denumireProiect: `Proiect #${proiectId}`,
      descriere: descrierePrincipala,
      subtotal: Number(subtotal.toFixed(2)),
      tva: Number(totalTva.toFixed(2)),
      total: Number(total.toFixed(2)),
      termenPlata: setariFacturare?.termen_plata_standard ? `${setariFacturare.termen_plata_standard} zile` : '30 zile'
    };

    // ✅ TEMPLATE HTML - cu coloane optimizate și TVA dinamic + note curs valutar
    const safeFormat = (num: number) => (Number(num) || 0).toFixed(2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `factura-${numarFactura || proiectId}-${timestamp}.pdf`;

    // ✅ MODIFICAT: Curățare note curs pentru PDF
    const notaCursValutarClean = cleanNonAscii(notaCursValutar);

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
                width: 100%;
                overflow: visible;
                padding-right: 10px;
            }
            table {
                width: 98%;
                margin: 0 auto;
                border-collapse: collapse;
                background: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                font-size: 9px;
                table-layout: fixed;
            }
            th {
                background: #34495e;
                color: white;
                padding: 6px 3px;
                text-align: left;
                font-size: 9px;
                font-weight: bold;
                white-space: nowrap;
            }
            td {
                padding: 5px 3px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 9px;
                word-break: break-word;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-section {
                margin-top: 2px;
                margin-left: auto;
                width: 180px;
                padding-right: 5px;
            }
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 2px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 9px;
                gap: 5px;
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
            .currency-note {
                margin-top: 10px;
                padding: 8px;
                background: #e8f5e8;
                border: 1px solid #c3e6c3;
                border-radius: 3px;
            }
            .currency-note-content {
                font-size: 9px;
                color: #2d5016;
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
            .storno-warning {
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
            TESTARE e-FACTURA - Aceasta factura NU a fost trimisa la ANAF (Mock Mode)
        </div>
        ` : ''}
        
        ${isStorno ? `
        <div class="storno-warning">
            FACTURA DE STORNARE - Anuleaza factura ${facturaOriginala || 'originala'}
        </div>
        ` : ''}
        
        <div class="header">
            <h1>FACTURA${isStorno ? ' DE STORNARE' : ''}</h1>
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
                ${isStorno ? '<div><strong>Tip:</strong> STORNARE</div>' : ''}
                ${MOCK_EFACTURA_MODE && sendToAnaf ? '<div><strong>MODE:</strong> TEST e-Factura</div>' : ''}
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 25px;">Nr.</th>
                        <th style="width: 200px;">Descriere</th>
                        <th style="width: 45px;" class="text-center">Cant.</th>
                        <th style="width: 65px;" class="text-right">Pret Unitar</th>
                        <th style="width: 70px;" class="text-center">TVA ${liniiFactura[0]?.cotaTva || 21}%</th>
                        <th style="width: 75px;" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${liniiFactura.map((linie: any, index: number) => {
                      const cantitate = Number(linie.cantitate) || 0;
                      const pretUnitar = Number(linie.pretUnitar) || 0;
                      const cotaTva = Number(linie.cotaTva) || 0;
                      
                      const valoare = cantitate * pretUnitar;
                      const tva = valoare * (cotaTva / 100);
                      const totalLinie = valoare + tva;
                      
                      const safeFixed = (num: number) => (Number(num) || 0).toFixed(2);
                      
                      // ✅ NOU: Adaugă informații despre valoarea originală în valută
                      let descriereCompleta = linie.denumire || 'N/A';
                      if (linie.monedaOriginala && linie.monedaOriginala !== 'RON' && linie.valoareOriginala) {
                        descriereCompleta += ` <small style="color: #666;">(${linie.valoareOriginala} ${linie.monedaOriginala})</small>`;
                      }
                      
                      return `
                    <tr>
                        <td class="text-center" style="font-size: 8px;">${index + 1}</td>
                        <td style="font-size: 8px; padding: 2px;">
                            ${descriereCompleta}
                            ${linie.tip === 'subproiect' ? ' <small style="color: #3498db;">[SUB]</small>' : ''}
                        </td>
                        <td class="text-center" style="font-size: 8px;">${safeFixed(cantitate)}</td>
                        <td class="text-right" style="font-size: 8px;">${safeFixed(pretUnitar)}</td>
                        <td class="text-center" style="font-size: 8px;">${safeFixed(tva)}</td>
                        <td class="text-right" style="font-weight: bold; font-size: 8px;">${safeFixed(totalLinie)}</td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="totals-row">
                    <span style="font-size: 9px;">Subtotal:</span>
                    <span style="font-size: 9px; white-space: nowrap;">${safeFormat(subtotal)} RON</span>
                </div>
                ${totalTva > 0 ? `
                <div class="totals-row">
                    <span style="font-size: 9px;">TVA:</span>
                    <span style="font-size: 9px; white-space: nowrap;">${safeFormat(totalTva)} RON</span>
                </div>
                ` : ''}
                <div class="totals-row final">
                    <span style="font-size: 10px;">TOTAL:</span>
                    <span style="font-size: 10px; white-space: nowrap;">${safeFormat(total)} RON</span>
                </div>
            </div>
        </div>

        ${notaCursValutarClean ? `
        <div class="currency-note">
            <div class="currency-note-content">
                <strong>Note curs valutar:</strong><br/>
                ${notaCursValutarClean}
            </div>
        </div>
        ` : ''}

        ${observatii ? `
        <div style="margin-top: 10px; padding: 8px; background: #f0f8ff; border: 1px solid #cce7ff; border-radius: 3px;">
            <div style="font-size: 9px; color: #0c5460;">
                <strong>Observatii:</strong><br/>
                ${cleanNonAscii(observatii).replace(/\n/g, '<br/>')}
            </div>
        </div>
        ` : ''}

        <div class="payment-info">
            <h4>Conditii de plata</h4>
            <div class="info-line">Termen de plata: ${safeInvoiceData.termenPlata}</div>
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
                <strong>Factura generata automat de sistemul UNITAR PROIECT TDA</strong><br>
                Data generarii: ${new Date().toLocaleString('ro-RO')}
                ${isEdit ? '<br><strong>EDITATA - Versiune actualizata</strong>' : ''}
                ${isStorno ? '<br><strong>STORNARE - Anuleaza factura originala</strong>' : ''}
                ${sendToAnaf ? (MOCK_EFACTURA_MODE ? 
                  '<br><strong>TEST MODE: Simulare e-Factura (NU trimis la ANAF)</strong>' : 
                  '<br><strong>Trimisa automat la ANAF ca e-Factura</strong>') : ''}
            </div>
            <div>
                Aceasta factura a fost generata electronic si nu necesita semnatura fizica.<br>
                Pentru intrebari contactati: contact@unitarproiect.eu | 0765486044
            </div>
        </div>
    </body>
    </html>`;

    // ✅ MANAGEMENT e-FACTURA - Mock Mode sau Producție (PĂSTRAT IDENTIC)
    let xmlResult: any = null;

    if (sendToAnaf) {
      if (MOCK_EFACTURA_MODE) {
        // 🧪 MOCK MODE - Simulează e-factura fără trimitere la ANAF
        console.log('🧪 MOCK MODE: Simulez e-factura pentru:', {
          facturaId: currentFacturaId,
          clientCUI: safeClientData.cui,
          totalFactura: safeFormat(total),
          liniiFactura: liniiFactura.length
        });

        const mockXmlId = `MOCK_XML_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Simulează salvare în BigQuery FacturiEFACTURA
        await saveMockEfacturaRecord({
          xmlId: mockXmlId,
          facturaId: currentFacturaId,
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
              facturaId: currentFacturaId,
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

    // ✅ MODIFICAT: Salvare în BigQuery cu suport pentru Edit și types corecte
    try {
      const dataset = bigquery.dataset('PanouControlUnitar');
      const table = dataset.table('FacturiGenerate');

      if (isEdit && facturaId) {
        // ✅ FIX: Specificare types pentru parametrii care pot fi null
        const updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
          SET 
            subtotal = @subtotal,
            total_tva = @totalTva,
            total = @total,
            date_complete_json = @dateCompleteJson,
            data_actualizare = CURRENT_TIMESTAMP(),
            efactura_enabled = @efacturaEnabled,
            efactura_status = @efacturaStatus,
            anaf_upload_id = @anafUploadId
          WHERE id = @facturaId
        `;

        // ✅ FIX: Parameters cu types specificate explicit
        const params = {
          facturaId: facturaId,
          subtotal: Number(subtotal.toFixed(2)),
          totalTva: Number(totalTva.toFixed(2)),
          total: Number(total.toFixed(2)),
          dateCompleteJson: JSON.stringify({
            liniiFactura,
            observatii: observatiiFinale,
            clientInfo: safeClientData,
            proiectInfo: {
              id: proiectId,
              ID_Proiect: proiectId, // ✅ IMPORTANT: Adaugă și ID_Proiect pentru compatibilitate
              denumire: safeInvoiceData.denumireProiect
            },
            proiectId: proiectId, // ✅ IMPORTANT: Salvează și direct pentru debugging
            contariBancare: contariFinale,
            setariFacturare,
            cursuriUtilizate,
            isEdit: true,
            dataActualizare: new Date().toISOString()
          }),
          efacturaEnabled: sendToAnaf,
          efacturaStatus: sendToAnaf ? (MOCK_EFACTURA_MODE ? 'mock_pending' : 'pending') : null,
          anafUploadId: xmlResult?.xmlId || null
        };

        // ✅ FIX: Types pentru BigQuery - IMPORTANT pentru null values
        const types: any = {
          facturaId: 'STRING',
          subtotal: 'NUMERIC',
          totalTva: 'NUMERIC', 
          total: 'NUMERIC',
          dateCompleteJson: 'STRING',
          efacturaEnabled: 'BOOL'
        };

        // Adaugă types doar pentru câmpurile care pot fi null
        if (params.efacturaStatus === null) {
          types.efacturaStatus = 'STRING';
        }
        if (params.anafUploadId === null) {
          types.anafUploadId = 'STRING';
        }

        await bigquery.query({
          query: updateQuery,
          params: params,
          types: types,
          location: 'EU'
        });

        console.log(`✅ Factură ${numarFactura} actualizată în BigQuery`);
        
      } else {
        // ✅ Creează factură nouă (inclusiv storno)
        const facturaData = [{
          id: currentFacturaId,
          proiect_id: proiectId,
          serie: setariFacturare?.serie_facturi || 'INV',
          numar: numarFactura || safeInvoiceData.numarFactura,
          data_factura: new Date().toISOString().split('T')[0],
          data_scadenta: new Date(Date.now() + (setariFacturare?.termen_plata_standard || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          id_factura_externa: null,
          url_publica: null,
          url_download: null,
          client_id: clientInfo?.id || null,
          client_nume: safeClientData.nume,
          client_cui: safeClientData.cui,
          subtotal: Number(subtotal.toFixed(2)),
          total_tva: Number(totalTva.toFixed(2)),
          total: Number(total.toFixed(2)),
          valoare_platita: 0,
          status: isStorno ? 'storno' : 'generata',
          data_trimitere: null,
          data_plata: null,
          date_complete_json: JSON.stringify({
            liniiFactura,
            observatii: observatiiFinale,
            clientInfo: safeClientData,
            proiectInfo: {
              id: proiectId,
              ID_Proiect: proiectId, // ✅ IMPORTANT: Adaugă și ID_Proiect
              denumire: safeInvoiceData.denumireProiect
            },
            proiectId: proiectId, // ✅ IMPORTANT: Salvează și direct
            contariBancare: contariFinale,
            setariFacturare,
            cursuriUtilizate,
            isStorno,
            facturaOriginala: facturaOriginala || null,
            mockMode: MOCK_EFACTURA_MODE && sendToAnaf
          }),
          data_creare: new Date().toISOString(),
          data_actualizare: new Date().toISOString(),
          efactura_enabled: sendToAnaf,
          efactura_status: sendToAnaf ? (MOCK_EFACTURA_MODE ? 'mock_pending' : 'pending') : null,
          anaf_upload_id: xmlResult?.xmlId || null
        }];

        await table.insert(facturaData);
        console.log(`✅ Factură ${isStorno ? 'de stornare' : 'nouă'} ${numarFactura} salvată în BigQuery`);
      }

      // ✅ NOU: Actualizează numărul curent în setări doar pentru facturi noi (nu edit)
      if (!isEdit && !isStorno && setariFacturare && numarFactura) {
        try {
          const updateSetariResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/setari/facturare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...setariFacturare,
              numar_curent_facturi: (setariFacturare.numar_curent_facturi || 0) + 1
            })
          });
          
          if (updateSetariResponse.ok) {
            console.log('✅ Număr curent actualizat în setări');
          } else {
            console.log('⚠️ Nu s-a putut actualiza numărul curent - response not ok');
          }
        } catch (error) {
          console.error('⚠️ Nu s-a putut actualiza numărul curent:', error);
        }
      }

    } catch (bgError) {
      console.error('❌ Eroare la salvarea în BigQuery FacturiGenerate:', bgError);
      // ✅ DEBUGGING: Afișează detalii eroare pentru types
      if (bgError instanceof Error && bgError.message.includes('Parameter types')) {
        console.error('🔍 Debugging types error:', {
          isEdit,
          facturaId,
          hasXmlResult: !!xmlResult,
          xmlId: xmlResult?.xmlId,
          sendToAnaf
        });
      }
    }

    // ✅ RESPONSE complet cu informații Mock/Producție/Edit/Storno
    const response = {
      success: true,
      message: isEdit ? 
        '✏️ Factură actualizată cu succes' :
        (isStorno ? 
          '↩️ Factură de stornare generată cu succes' :
          (sendToAnaf ? 
            (MOCK_EFACTURA_MODE ? 
              '🧪 Factură pregătită pentru PDF + e-factura TEST (Mock Mode)' : 
              '🚀 Factură pregătită pentru PDF + e-factura ANAF') : 
            '📄 Factură pregătită pentru generare PDF')),
      fileName: fileName,
      htmlContent: htmlTemplate,
      invoiceData: {
        facturaId: currentFacturaId,
        numarFactura: numarFactura || safeInvoiceData.numarFactura,
        total: total,
        client: safeClientData.nume,
        contariBancare: contariFinale.length,
        isEdit,
        isStorno,
        cursuriUtilizate: Object.keys(cursuriUtilizate).length > 0 ? cursuriUtilizate : null
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

// ✅ FUNCȚIE MOCK pentru salvare test e-factura (PĂSTRATĂ IDENTICĂ)
async function saveMockEfacturaRecord(data: any) {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    
    // ✅ FOLOSEȘTE tabelul AnafEFactura existent
    const table = dataset.table('AnafEFactura');

    const mockXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <!-- MOCK XML pentru testare e-factura -->
  <ID>${data.xmlId}</ID>
  <IssueDate>${new Date().toISOString().split('T')[0]}</IssueDate>
  <InvoiceTypeCode>380</InvoiceTypeCode>
  <Note>MOCK XML - generat pentru testare, NU trimis la ANAF</Note>
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

    // ✅ RECORD compatibil cu schema AnafEFactura existentă
    const record = [{
      id: crypto.randomUUID(),
      factura_id: data.facturaId,
      anaf_upload_id: data.xmlId,
      xml_content: mockXmlContent,
      anaf_status: 'MOCK_TEST',
      anaf_response: JSON.stringify({ 
        mock: true, 
        test_mode: true, 
        message: 'XML generat în mod test - nu a fost trimis la ANAF',
        xml_id: data.xmlId,
        timestamp: new Date().toISOString(),
        client_cui: data.clientInfo.cui,
        total_factura: data.total
      }),
      error_message: null,
      error_code: null,
      data_upload: null,
      data_validare: null,
      retry_count: 0,
      max_retries: 3,
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString()
    }];

    await table.insert(record);
    console.log('✅ Mock e-factura record salvat în AnafEFactura:', data.xmlId);

    // ✅ BONUS: Actualizează și FacturiGenerate cu informații mock
    try {
      const updateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
        SET 
          efactura_enabled = true,
          efactura_status = 'mock_generated',
          anaf_upload_id = @xmlId,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @facturaId
      `;

      await bigquery.query({
        query: updateQuery,
        params: { 
          xmlId: data.xmlId,
          facturaId: data.facturaId 
        },
        types: {
          xmlId: 'STRING',
          facturaId: 'STRING'
        },
        location: 'EU'
      });

      console.log('✅ FacturiGenerate actualizat cu info mock pentru factura:', data.facturaId);

    } catch (updateError) {
      console.log('⚠️ Nu s-a putut actualiza FacturiGenerate (nu e critico):', updateError);
    }

  } catch (error) {
    console.error('❌ Eroare la salvarea mock e-factura record:', error);
    console.log('⚠️ Continuă fără salvare mock e-factura - PDF va fi generat normal');
  }
}
