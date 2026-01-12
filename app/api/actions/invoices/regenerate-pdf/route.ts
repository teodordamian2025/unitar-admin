// ==================================================================
// CALEA: app/api/actions/invoices/regenerate-pdf/route.ts
// DATA: 17.08.2025 12:00
// FIX FINAL: ID Proiect + Formatare date BigQuery + Nota cursuri BNR
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_SETARI_BANCA = `\`${PROJECT_ID}.${DATASET}.SetariBanca${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;

console.log(`🔧 Regenerate PDF API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: SetariBanca${tableSuffix}, FacturiGenerate${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Încărcare conturi bancare
async function loadContariBancare() {
  try {
    const query = `
      SELECT nume_banca, iban, cont_principal, observatii 
      FROM ${TABLE_SETARI_BANCA}
      ORDER BY cont_principal DESC, nume_banca ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows && rows.length > 0) {
      console.log(`Incarcat ${rows.length} conturi bancare din BigQuery`);
      return rows.map((row: any) => ({
        nume_banca: row.nume_banca,
        iban: row.iban,
        cont_principal: row.cont_principal,
        observatii: row.observatii
      }));
    } else {
      console.log('Nu s-au gasit conturi bancare in BigQuery - folosesc fallback');
      return null;
    }
  } catch (error) {
    console.log('Eroare la incarcarea conturilor bancare din BigQuery:', error);
    return null;
  }
}

// Fallback conturi
const FALLBACK_CONTURI = [
  {
    nume_banca: 'ING Bank',
    iban: 'RO82INGB0000999905667533',
    cont_principal: true,
    observatii: 'Cont principal pentru incasari'
  },
  {
    nume_banca: 'Trezorerie',
    iban: 'RO29TREZ7035069XXX018857',
    cont_principal: false,
    observatii: 'Trezoreria sectorului 3 Bucuresti'
  }
];

// Template HTML conturi bancare
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

// FIX: Formatare date din BigQuery - identic cu FacturaHibridModal
function formatDateFromBigQuery(dateValue: any): string {
  if (!dateValue) {
    return new Date().toLocaleDateString('ro-RO');
  }
  
  try {
    // DATE din BigQuery vine ca string simplu: "2025-07-25"
    // TIMESTAMP din BigQuery vine ca string: "2025-07-31 05:22:45.101000 UTC"
    
    let actualDate: string;
    
    // BigQuery poate returna ca obiect cu .value sau direct ca string
    if (typeof dateValue === 'object' && dateValue.value) {
      actualDate = dateValue.value;
    } else if (typeof dateValue === 'string') {
      actualDate = dateValue;
    } else {
      return new Date().toLocaleDateString('ro-RO');
    }
    
    // Curăță timezone-ul din TIMESTAMP dacă există
    const cleanedDate = actualDate.replace(' UTC', '').replace('.101000', '');
    
    // Parsează și formatează
    const parsedDate = new Date(cleanedDate);
    
    if (isNaN(parsedDate.getTime())) {
      console.warn('Data invalidă din BigQuery:', dateValue);
      return new Date().toLocaleDateString('ro-RO');
    }
    
    return parsedDate.toLocaleDateString('ro-RO');
  } catch (error) {
    console.warn('Eroare la formatarea datei din BigQuery:', dateValue, error);
    return new Date().toLocaleDateString('ro-RO');
  }
}

// FIX: Formatare datetime pentru footer
function formatDateTimeFromBigQuery(dateValue: any): string {
  if (!dateValue) {
    return 'N/A';
  }
  
  try {
    let actualDate: string;
    
    if (typeof dateValue === 'object' && dateValue.value) {
      actualDate = dateValue.value;
    } else if (typeof dateValue === 'string') {
      actualDate = dateValue;
    } else {
      return 'N/A';
    }
    
    const cleanedDate = actualDate.replace(' UTC', '').replace('.101000', '');
    const parsedDate = new Date(cleanedDate);
    
    if (isNaN(parsedDate.getTime())) {
      return 'N/A';
    }
    
    return parsedDate.toLocaleString('ro-RO');
  } catch (error) {
    console.warn('Eroare la formatarea datetime din BigQuery:', dateValue, error);
    return 'N/A';
  }
}

// Curățare caractere non-ASCII
function cleanNonAscii(text: string): string {
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
    .replace(/[^\x00-\x7F]/g, '');
}

// ✅ NOU: Funcție pentru sanitizarea numelui clientului pentru filename PDF
// Curăță caracterele invalide pentru filename și limitează la 40 caractere
function sanitizeClientNameForFilename(clientName: string): string {
  if (!clientName) return '';

  // Înlocuiește diacriticele
  let sanitized = clientName
    .replace(/ă/g, 'a')
    .replace(/Ă/g, 'A')
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/ș/g, 's')
    .replace(/Ș/g, 'S')
    .replace(/ț/g, 't')
    .replace(/Ț/g, 'T');

  // Elimină caracterele invalide pentru filename (păstrează litere, cifre, spații, punct, liniuță)
  sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '');

  // Elimină alte caractere non-ASCII
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');

  // Înlocuiește spații multiple cu un singur spațiu
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Limitează la 40 caractere (cu spații)
  if (sanitized.length > 40) {
    sanitized = sanitized.substring(0, 40).trim();
  }

  return sanitized;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { facturaId, serie, numar } = body;

    console.log('Regenerez PDF pentru factura:', { facturaId, serie, numar });

    if (!facturaId) {
      return NextResponse.json({ error: 'facturaId este obligatoriu' }, { status: 400 });
    }

    // Încarcă datele facturii din BigQuery
    const facturaQuery = `
      SELECT * FROM ${TABLE_FACTURI_GENERATE}
      WHERE id = @facturaId
    `;

    const [facturaRows] = await bigquery.query({
      query: facturaQuery,
      params: { facturaId },
      types: { facturaId: 'STRING' },
      location: 'EU',
    });

    if (facturaRows.length === 0) {
      return NextResponse.json({ error: 'Factura nu a fost gasita' }, { status: 404 });
    }

    const facturaData = facturaRows[0];

    // Construiește numărul complet (serie + numar)
    const numarComplet = facturaData.serie
      ? `${facturaData.serie}-${facturaData.numar}`
      : (facturaData.numar || numar);
    
    // Parsează datele complete din JSON
    let dateComplete: any = {};
    try {
      if (facturaData.date_complete_json) {
        dateComplete = JSON.parse(facturaData.date_complete_json);
        console.log('Date complete parsate:', {
          hasClientInfo: !!dateComplete.clientInfo,
          hasLiniiFactura: !!dateComplete.liniiFactura,
          hasCursuriUtilizate: !!dateComplete.cursuriUtilizate,
          cursuriKeys: dateComplete.cursuriUtilizate ? Object.keys(dateComplete.cursuriUtilizate) : []
        });
      }
    } catch (error) {
      console.log('Nu s-au putut parsa datele complete JSON:', error);
    }

    // Încarcă conturi bancare
    const contariBancare = await loadContariBancare();
    const contariFinale = contariBancare || dateComplete.contariBancare || FALLBACK_CONTURI;

    // Reconstituie datele pentru template
    const clientInfo = dateComplete.clientInfo || {
      nume: facturaData.client_nume || 'Client necunoscut',
      cui: facturaData.client_cui || 'CUI necunoscut',
      nr_reg_com: 'N/A',
      adresa: 'Adresa necunoscuta',
      telefon: 'N/A',
      email: 'N/A',
      tip_client: 'persoana_juridica'
    };

    // Detectează dacă clientul este persoană fizică
    const isPersoanaFizica = clientInfo.tip_client === 'persoana_fizica';

    const liniiFactura = dateComplete.liniiFactura || [{
      denumire: 'Servicii facturate',
      cantitate: 1,
      pretUnitar: facturaData.subtotal || 0,
      cotaTva: facturaData.total_tva > 0 ? 21 : 0,
      tip: 'proiect'
    }];

    // FIX: Folosește proiect_id din BigQuery în loc de denumire
    const proiectInfo = dateComplete.proiectInfo || {
      id: facturaData.proiect_id || 'NECUNOSCUT',
      ID_Proiect: facturaData.proiect_id || 'NECUNOSCUT',
      denumire: `Proiect #${facturaData.proiect_id || 'NECUNOSCUT'}`
    };

    // Calcule totale
    const subtotal = facturaData.subtotal || 0;
    const totalTva = facturaData.total_tva || 0;
    const total = facturaData.total || 0;

    const safeFormat = (num: number) => (Number(num) || 0).toFixed(2);

    // FIX: Generează nota cursuri BNR - debug complet
    let notaCursValutar = '';
    if (dateComplete.cursuriUtilizate && Object.keys(dateComplete.cursuriUtilizate).length > 0) {
      const monede = Object.keys(dateComplete.cursuriUtilizate);
      console.log('Generez nota cursuri pentru monede:', monede);
      
      const cursuriFormatate = monede.map(m => {
        const cursInfo = dateComplete.cursuriUtilizate[m];
        console.log(`Procesez moneda ${m}:`, cursInfo);
        
        let cursFormatat: string;
        if (cursInfo.precizie_originala) {
          cursFormatat = cursInfo.precizie_originala;
        } else {
          const curs = typeof cursInfo.curs === 'number' ? cursInfo.curs : 
                       (typeof cursInfo.curs === 'string' ? parseFloat(cursInfo.curs) : 1);
          cursFormatat = curs.toFixed(4);
        }
        
        let dataFormatata: string;
        if (typeof cursInfo.data === 'string') {
          dataFormatata = cursInfo.data;
        } else if (cursInfo.data && typeof cursInfo.data === 'object' && cursInfo.data.value) {
          dataFormatata = cursInfo.data.value;
        } else {
          dataFormatata = new Date().toISOString().split('T')[0];
        }
        
        return `1 ${m} = ${cursFormatat} RON (${dataFormatata})`;
      });
      
      notaCursValutar = `Curs valutar BNR: ${cursuriFormatate.join(', ')}`;
      console.log('Nota cursuri generata:', notaCursValutar);
    } else {
      console.log('Nu exista cursuri utilizate in dateComplete.cursuriUtilizate');
    }

    // FIX: Template HTML cu toate corecturile
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Factura ${cleanNonAscii(numarComplet)}</title>
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
            PDF REGENERAT din baza de date - ${new Date().toLocaleDateString('ro-RO')} ${new Date().toLocaleTimeString('ro-RO')}
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
                <div class="info-line"><strong>${cleanNonAscii(clientInfo.nume)}</strong></div>
                <div class="info-line">${isPersoanaFizica ? 'CNP' : 'CUI'}: ${cleanNonAscii(clientInfo.cui)}</div>
                ${!isPersoanaFizica && clientInfo.nr_reg_com ? `<div class="info-line">Nr. Reg. Com.: ${cleanNonAscii(clientInfo.nr_reg_com)}</div>` : ''}
                <div class="info-line">Adresa: ${cleanNonAscii(clientInfo.adresa)}</div>
                <div class="info-line">Telefon: ${cleanNonAscii(clientInfo.telefon)}</div>
                <div class="info-line">Email: ${cleanNonAscii(clientInfo.email)}</div>
            </div>
        </div>

        <div class="invoice-details">
            <div class="invoice-number">Factura nr: ${cleanNonAscii(numarComplet)}</div>
            <div class="invoice-meta">
                <div><strong>Data:</strong> ${formatDateFromBigQuery(facturaData.data_factura)}</div>
                <div><strong>Proiect:</strong> ${cleanNonAscii(proiectInfo.id || proiectInfo.ID_Proiect || facturaData.proiect_id || 'NECUNOSCUT')}</div>
                <div><strong>Regenerat:</strong> ${new Date().toLocaleDateString('ro-RO')}</div>
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
                        <th style="width: 70px;" class="text-center">TVA 21%</th>
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
                      
                      let descriereCompleta = cleanNonAscii(linie.denumire || 'N/A');
                      
                      if (linie.monedaOriginala && linie.monedaOriginala !== 'RON' && linie.valoareOriginala) {
                        const cursInfo = linie.cursValutar ? ` x ${Number(linie.cursValutar).toFixed(4)}` : '';
                        descriereCompleta += ` <small style="color: #666;">(${linie.valoareOriginala} ${linie.monedaOriginala}${cursInfo})</small>`;
                      }
                      
                      return `
                    <tr>
                        <td class="text-center" style="font-size: 8px;">${index + 1}</td>
                        <td style="font-size: 8px; padding: 2px;">
                            ${descriereCompleta}
                            ${linie.tip === 'subproiect' ? ' <small style="color: #3498db;">[SUB]</small>' : ''}
                            ${linie.tip === 'etapa_contract' ? ' <small style="color: #3498db;">[CONTRACT]</small>' : ''}
                            ${linie.tip === 'etapa_anexa' ? ' <small style="color: #e67e22;">[ANEXA]</small>' : ''}
                            ${linie.descriere ? `<br><span style="font-size: 7px; color: #555; font-style: italic;">${cleanNonAscii(linie.descriere)}</span>` : ''}
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

        ${notaCursValutar && notaCursValutar.trim() ? `
        <div class="currency-note">
            <div class="currency-note-content">
                <strong>${cleanNonAscii(notaCursValutar)}</strong>
            </div>
        </div>
        ` : ''}

        ${dateComplete.observatii ? `
        <div style="margin-top: 10px; padding: 8px; background: #f0f8ff; border: 1px solid #cce7ff; border-radius: 3px;">
            <div style="font-size: 9px; color: #0c5460;">
                <strong>Observatii:</strong><br/>
                ${cleanNonAscii(dateComplete.observatii || '').replace(/\n/g, '<br/>')}
            </div>
        </div>
        ` : ''}

        <div class="payment-info">
            <h4>Conditii de plata</h4>
            <div class="info-line">Termen de plata: ${dateComplete.setariFacturare?.termen_plata_standard || 30} zile</div>
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
                Original: ${formatDateTimeFromBigQuery(facturaData.data_creare)}<br>
                Regenerat: ${new Date().toLocaleString('ro-RO')}
            </div>
            <div>
                Aceasta factura a fost regenerata din baza de date si este identica cu originalul.<br>
                Pentru intrebari contactati: contact@unitarproiect.eu | 0765486044
            </div>
        </div>
    </body>
    </html>`;

    // ✅ MODIFICAT: Filename cu data și numele clientului (sanitizat, max 40 caractere)
    // Format: factura-UPA-1056-2026-01-09-SIX DESIGN AND INNOVATIONSS.R.L..pdf
    const dateOnly = new Date().toISOString().split('T')[0];
    const clientNameForFilename = sanitizeClientNameForFilename(clientInfo.nume);
    const generatedFileName = clientNameForFilename
      ? `factura-${cleanNonAscii(numarComplet)}-${dateOnly}-${clientNameForFilename}.pdf`
      : `factura-${cleanNonAscii(numarComplet)}-${dateOnly}.pdf`;

    // Return HTML pentru regenerare în browser
    return NextResponse.json({
      success: true,
      htmlContent: htmlTemplate,
      fileName: generatedFileName,
      message: 'Template HTML generat pentru regenerare PDF',
      facturaData: {
        id: facturaData.id,
        serie: facturaData.serie,
        numar: cleanNonAscii(facturaData.numar || numar),
        numarComplet: cleanNonAscii(numarComplet),
        client: cleanNonAscii(clientInfo.nume),
        total: total,
        contariCount: contariFinale.length,
        hasNotaCursuri: !!notaCursValutar
      }
    });

  } catch (error) {
    console.error('Eroare la regenerarea PDF:', error);
    return NextResponse.json({
      error: 'Eroare la regenerarea PDF',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
