// ==================================================================
// CALEA: app/api/actions/contracts/generate/route.ts
// DATA: 26.08.2025 23:00 (ora României)
// CORECȚII: Project ID + Helper functions + Pattern DOCX existent + Z-index + Error handling
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import { getNextContractNumber } from '../../../setari/contracte/route';

const PROJECT_ID = 'hale-mode-464009-i6'; // PROJECT ID CORECT

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper pentru conversie BigQuery NUMERIC (reutilizat din pattern-ul existent)
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'object' && value.value !== undefined) {
    return parseFloat(value.value.toString()) || 0;
  }
  
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  return 0;
};

// Helper pentru formatarea datelor BigQuery
const formatDate = (date?: string | { value: string }): string => {
  if (!date) return '';
  const dateValue = typeof date === 'string' ? date : date.value;
  try {
    return new Date(dateValue).toLocaleDateString('ro-RO');
  } catch {
    return '';
  }
};

// Helper pentru formatarea datelor pentru BigQuery
const formatDateForBigQuery = (dateString: string): string | null => {
  if (!dateString || dateString.trim() === '') {
    return null;
  }
  
  try {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
      const date = new Date(dateString + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        return dateString;
      }
    }
    
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  } catch (error) {
    console.error('Eroare la formatarea datei pentru BigQuery:', dateString, error);
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const {
      proiectId,
      tipDocument = 'contract',
      sablonId,
      termenePersonalizate = [],
      articoleSuplimentare = [],
      observatii
    } = await request.json();

    if (!proiectId) {
      return NextResponse.json({ 
        error: 'ID proiect necesar' 
      }, { status: 400 });
    }

    console.log(`Generare contract pentru proiect: ${proiectId}, tip: ${tipDocument}`);

    // 1. Preia datele proiectului cu JOIN către client (PROJECT ID CORECT)
    const projectQuery = `
      SELECT 
        p.*,
        c.id as client_id,
        c.nume as client_nume,
        c.cui as client_cui,
        c.nr_reg_com as client_reg_com,
        c.adresa as client_adresa,
        c.judet as client_judet,
        c.oras as client_oras,
        c.telefon as client_telefon,
        c.email as client_email
      FROM \`${PROJECT_ID}.PanouControlUnitar.Proiecte\` p
      LEFT JOIN \`${PROJECT_ID}.PanouControlUnitar.Clienti\` c
        ON p.Client = c.nume
      WHERE p.ID_Proiect = @proiectId
    `;

    const [projectRows] = await bigquery.query({
      query: projectQuery,
      params: { proiectId },
      location: 'EU',
    });

    if (projectRows.length === 0) {
      return NextResponse.json({ 
        error: 'Proiectul nu a fost găsit' 
      }, { status: 404 });
    }

    const proiect = projectRows[0];

    // 2. Preia subproiectele (PROJECT ID CORECT)
    const subproiecteQuery = `
      SELECT * FROM \`${PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      WHERE ID_Proiect = @proiectId
      ORDER BY Denumire ASC
    `;

    const [subproiecteRows] = await bigquery.query({
      query: subproiecteQuery,
      params: { proiectId },
      location: 'EU',
    });

    // 3. Calculează suma totală contractului (cu helper functions corecte)
    const { sumaFinala, monedaFinala, cursuriUtilizate } = calculeazaSumaContract(
      proiect, 
      subproiecteRows, 
      articoleSuplimentare
    );

    // 4. Generează numărul contractului
    const contractData = await getNextContractNumber(tipDocument, proiectId);

    // 5. Pregătește datele pentru înlocuire placeholder-uri
    const placeholderData = prepareazaPlaceholderData(
      proiect, 
      subproiecteRows, 
      sumaFinala,
      monedaFinala,
      contractData,
      termenePersonalizate,
      articoleSuplimentare
    );

    // 6. Generează DOCX (folosind pattern-ul existent din /api/genereaza/docx)
    const docxBuffer = await genereazaDOCXContract(placeholderData, sablonId);

    // 7. Salvează în BigQuery (PROJECT ID CORECT)
    const contractId = await salveazaContract({
      proiectId,
      tipDocument,
      contractData,
      placeholderData,
      sumaFinala,
      monedaFinala,
      cursuriUtilizate,
      observatii
    });

    // 8. Returnează rezultatul
    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${contractData.numar_contract}.docx"`,
        'X-Contract-Id': contractId,
        'X-Contract-Number': contractData.numar_contract
      }
    });

  } catch (error) {
    console.error('Eroare la generarea contractului:', error);
    return NextResponse.json({ 
      error: 'Eroare la generarea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// Calculează suma finală a contractului (cu helper functions corecte)
function calculeazaSumaContract(proiect: any, subproiecte: any[], articoleSuplimentare: any[]) {
  let sumaFinala = 0;
  let monedaFinala = 'RON';
  const cursuriUtilizate: { [moneda: string]: number } = {};

  // LOGICA CRITICĂ: Pentru proiecte cu subproiecte, suma = DOAR subproiecte + articole
  if (subproiecte.length > 0) {
    // Suma doar din subproiecte (NU din proiectul principal)
    subproiecte.forEach(sub => {
      const valoare = convertBigQueryNumeric(sub.valoare_ron) || convertBigQueryNumeric(sub.Valoare_Estimata);
      sumaFinala += valoare;
      
      if (sub.moneda && sub.moneda !== 'RON') {
        cursuriUtilizate[sub.moneda] = convertBigQueryNumeric(sub.curs_valutar) || 1;
      }
    });
    
    console.log(`Proiect cu ${subproiecte.length} subproiecte - suma calculată FĂRĂ proiectul principal: ${sumaFinala} RON`);
  } else {
    // Pentru proiecte fără subproiecte, suma = valoarea proiectului
    sumaFinala = convertBigQueryNumeric(proiect.valoare_ron) || convertBigQueryNumeric(proiect.Valoare_Estimata);
    monedaFinala = proiect.moneda || 'RON';
    
    if (proiect.moneda && proiect.moneda !== 'RON') {
      cursuriUtilizate[proiect.moneda] = convertBigQueryNumeric(proiect.curs_valutar) || 1;
    }
    
    console.log(`Proiect fără subproiecte - suma din proiect: ${sumaFinala} ${monedaFinala}`);
  }

  // Adaugă articolele suplimentare
  articoleSuplimentare.forEach(articol => {
    let valoareRON = convertBigQueryNumeric(articol.valoare);
    
    if (articol.moneda && articol.moneda !== 'RON') {
      valoareRON = valoareRON * (cursuriUtilizate[articol.moneda] || 1);
      cursuriUtilizate[articol.moneda] = cursuriUtilizate[articol.moneda] || 1;
    }
    
    sumaFinala += valoareRON;
  });

  return { sumaFinala, monedaFinala, cursuriUtilizate };
}

// Pregătește datele pentru placeholder-uri
function prepareazaPlaceholderData(
  proiect: any, 
  subproiecte: any[], 
  sumaFinala: number,
  monedaFinala: string,
  contractData: any,
  termene: any[],
  articole: any[]
) {
  const dataContract = new Date().toLocaleDateString('ro-RO');
  
  return {
    // Date contract
    contract: {
      numar: contractData.numar_contract,
      data: dataContract,
      tip: contractData.setari?.tip_document || 'contract'
    },
    
    // Date client (cu fallback pentru valori lipsă)
    client: {
      nume: proiect.client_nume || proiect.Client || 'Client necunoscut',
      cui: proiect.client_cui || 'CUI necunoscut',
      nr_reg_com: proiect.client_reg_com || 'Nr. reg. com. necunoscut',
      adresa: proiect.client_adresa || 'Adresa necunoscută',
      judet: proiect.client_judet || '',
      oras: proiect.client_oras || '',
      telefon: proiect.client_telefon || '',
      email: proiect.client_email || '',
      reprezentant: 'Administrator' // Default
    },
    
    // Date proiect (cu conversii BigQuery corecte)
    proiect: {
      id: proiect.ID_Proiect,
      denumire: proiect.Denumire,
      descriere: proiect.Descriere || '',
      adresa: proiect.Adresa || '',
      valoare: sumaFinala,
      moneda: monedaFinala,
      data_start: formatDate(proiect.Data_Start),
      data_final: formatDate(proiect.Data_Final),
      responsabil: proiect.Responsabil || ''
    },
    
    // Date firmă UNITAR (actualizate conform README)
    firma: {
      nume: 'UNITAR PROIECT TDA SRL',
      cui: 'RO35639210',
      nr_reg_com: 'J2016002024405',
      adresa: 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
      telefon: '0765486044',
      email: 'contact@unitarproiect.eu',
      cont_ing: 'RO82INGB0000999905667533',
      cont_trezorerie: 'RO29TREZ7035069XXX018857'
    },
    
    // Subproiecte și articole (cu conversii corecte)
    subproiecte: subproiecte.map(sub => ({
      denumire: sub.Denumire,
      valoare: convertBigQueryNumeric(sub.valoare_ron) || convertBigQueryNumeric(sub.Valoare_Estimata),
      moneda: sub.moneda || 'RON',
      status: sub.Status
    })),
    
    articole_suplimentare: articole,
    termene_personalizate: termene,
    
    // Metadate
    data_generare: new Date().toISOString(),
    suma_totala_ron: sumaFinala.toFixed(2)
  };
}

// Generează DOCX cu template (folosind pattern-ul existent)
async function genereazaDOCXContract(placeholderData: any, sablonId?: string): Promise<Buffer> {
  
  const continutHTML = genereazaContractHTML(placeholderData);
  
  // Convertește HTML în structura DOCX (pattern existent din /api/genereaza/docx)
  const wordXml = convertHTMLToWordXML(continutHTML);
  
  // Creează ZIP-ul DOCX (pattern identic cu cel existent)
  const zip = new JSZip();
  
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
  
  zip.file('word/document.xml', wordXml);
  
  return await zip.generateAsync({ type: 'nodebuffer' });
}

// Generează HTML pentru contract (template profesional)
function genereazaContractHTML(data: any): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <h1 style="text-align: center;">CONTRACT DE SERVICII</h1>
  <p style="text-align: center;"><strong>Nr. ${data.contract.numar} din ${data.contract.data}</strong></p>
  
  <h2>PĂRȚILE CONTRACTANTE:</h2>
  
  <div style="margin: 20px 0;">
    <strong>1. BENEFICIAR:</strong> ${data.client.nume}<br>
    CUI: ${data.client.cui}<br>
    Nr. Reg. Com.: ${data.client.nr_reg_com}<br>
    Adresa: ${data.client.adresa}<br>
    ${data.client.telefon ? `Telefon: ${data.client.telefon}<br>` : ''}
    ${data.client.email ? `Email: ${data.client.email}<br>` : ''}
  </div>
  
  <div style="margin: 20px 0;">
    <strong>2. PRESTATOR:</strong> ${data.firma.nume}<br>
    CUI: ${data.firma.cui}<br>
    Nr. Reg. Com.: ${data.firma.nr_reg_com}<br>
    Adresa: ${data.firma.adresa}<br>
    Telefon: ${data.firma.telefon}<br>
    Email: ${data.firma.email}<br>
    Cont ING: ${data.firma.cont_ing}<br>
    Cont Trezorerie: ${data.firma.cont_trezorerie}
  </div>
  
  <h2>OBIECTUL CONTRACTULUI:</h2>
  <p>Prestarea serviciilor de inginerie structurală pentru proiectul <strong>"${data.proiect.denumire}"</strong>.</p>
  ${data.proiect.descriere ? `<p>Descriere: ${data.proiect.descriere}</p>` : ''}
  ${data.proiect.adresa ? `<p>Adresa execuție: ${data.proiect.adresa}</p>` : ''}
  
  <h2>VALOAREA CONTRACTULUI:</h2>
  <p><strong>${data.suma_totala_ron} RON + TVA</strong></p>
  
  ${data.subproiecte.length > 0 ? `
  <h3>Detaliere pe subproiecte:</h3>
  <ul>
    ${data.subproiecte.map(sub => `
      <li>${sub.denumire}: ${sub.valoare.toFixed(2)} ${sub.moneda}</li>
    `).join('')}
  </ul>
  ` : ''}
  
  ${data.articole_suplimentare.length > 0 ? `
  <h3>Articole suplimentare:</h3>
  <ul>
    ${data.articole_suplimentare.map(art => `
      <li>${art.descriere}: ${art.valoare} ${art.moneda}</li>
    `).join('')}
  </ul>
  ` : ''}
  
  <h2>TERMENE DE EXECUȚIE:</h2>
  <p>Data început: ${data.proiect.data_start || 'Se va stabili'}</p>
  <p>Data finalizare: ${data.proiect.data_final || 'Se va stabili'}</p>
  
  ${data.termene_personalizate.length > 0 ? `
  <h3>Termene personalizate:</h3>
  <ul>
    ${data.termene_personalizate.map(termen => `
      <li>${termen.denumire}: ${termen.termen_zile} zile (${termen.procent_plata}% din valoare)</li>
    `).join('')}
  </ul>
  ` : ''}
  
  <h2>CONDIȚII DE PLATĂ:</h2>
  <p>Plata se va efectua în lei conform cursului BNR din ziua facturării.</p>
  
  <div style="margin-top: 50px; display: flex; justify-content: space-between;">
    <div style="text-align: center;">
      <strong>PRESTATOR</strong><br>
      ${data.firma.nume}<br>
      <br><br>
      _______________________
    </div>
    <div style="text-align: center;">
      <strong>BENEFICIAR</strong><br>
      ${data.client.nume}<br>
      <br><br>
      _______________________
    </div>
  </div>
</div>
  `;
}

// Convertește HTML în XML Word (pattern existent)
function convertHTMLToWordXML(html: string): string {
  const cleanText = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>$1</w:t></w:r></w:p>')
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, '<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>$1</w:t></w:r></w:p>')
    .replace(/<h3[^>]*>(.*?)<\/h3>/g, '<w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>$1</w:t></w:r></w:p>')
    .replace(/<p[^>]*>(.*?)<\/p>/g, '<w:p><w:r><w:t>$1</w:t></w:r></w:p>')
    .replace(/<strong>(.*?)<\/strong>/g, '<w:r><w:rPr><w:b/></w:rPr><w:t>$1</w:t></w:r>')
    .replace(/<br\s*\/?>/g, '</w:t></w:r></w:p><w:p><w:r><w:t>')
    .replace(/<ul[^>]*>/g, '')
    .replace(/<\/ul>/g, '')
    .replace(/<li[^>]*>(.*?)<\/li>/g, '<w:p><w:r><w:t>• $1</w:t></w:r></w:p>')
    .replace(/<div[^>]*>/g, '')
    .replace(/<\/div>/g, '')
    .replace(/<[^>]+>/g, ''); // Remove any remaining HTML tags

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${cleanText}
  </w:body>
</w:document>`;
}

// Salvează contractul în BigQuery (PROJECT ID CORECT)
async function salveazaContract(contractInfo: any): Promise<string> {
  const contractId = `CONTR_${contractInfo.proiectId}_${Date.now()}`;
  
  try {
    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.PanouControlUnitar.Contracte\`
      (ID_Contract, numar_contract, serie_contract, tip_document, proiect_id, client_id, client_nume, 
       Denumire_Contract, Status, Valoare, Moneda, curs_valutar, data_curs_valutar, valoare_ron,
       continut_json, data_creare, data_actualizare, Observatii)
      VALUES 
      (@contractId, @numarContract, @serieContract, @tipDocument, @proiectId, @clientId, @clientNume,
       @denumireContract, @status, @valoare, @moneda, @cursValutar, @dataCurs, @valoareRon,
       @continutJson, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), @observatii)
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        contractId,
        numarContract: contractInfo.contractData.numar_contract,
        serieContract: contractInfo.contractData.serie,
        tipDocument: contractInfo.tipDocument,
        proiectId: contractInfo.proiectId,
        clientId: contractInfo.placeholderData.client.id || null,
        clientNume: contractInfo.placeholderData.client.nume,
        denumireContract: `Contract ${contractInfo.placeholderData.proiect.denumire}`,
        status: 'Generat',
        valoare: contractInfo.sumaFinala,
        moneda: contractInfo.monedaFinala,
        cursValutar: null,
        dataCurs: null,
        valoareRon: contractInfo.sumaFinala,
        continutJson: JSON.stringify(contractInfo.placeholderData),
        observatii: contractInfo.observatii || null
      },
      location: 'EU',
    });

    console.log(`Contract salvat în BigQuery: ${contractId}`);
    return contractId;
    
  } catch (error) {
    console.error('Eroare la salvarea contractului în BigQuery:', error);
    throw error;
  }
}
