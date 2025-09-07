// ==================================================================
// CALEA: app/api/actions/pv/generate/route.ts
// DATA: 07.09.2025 20:30 (ora României)
// DESCRIERE: API pentru generarea Proceselor Verbale de Predare-Primire
// PĂSTRATE: Toate pattern-urile din contracte + logica template processing
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import path from 'path';

const PROJECT_ID = 'hale-mode-464009-i6';
const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'contracte', 'templates');

// Cursuri valutare pentru conversii - PĂSTRAT din contracte
const CURSURI_VALUTAR: { [key: string]: number } = {
  'EUR': 5.0683,
  'USD': 4.3688,
  'GBP': 5.8777,
  'RON': 1
};

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// TOATE HELPER-urile PĂSTRATE din contracte pentru consistență
const extractSimpleValue = (value: any): any => {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return extractSimpleValue(value.value);
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    
    if (/^-?\d+\.?\d*$/.test(trimmed)) {
      const numericValue = parseFloat(trimmed);
      if (!isNaN(numericValue)) {
        return numericValue;
      }
    }
    
    return trimmed;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  return String(value);
};

const extractNumericValue = (value: any): number => {
  const simple = extractSimpleValue(value);
  if (simple === null || simple === undefined) return 0;
  
  if (typeof simple === 'number') return simple;
  
  if (typeof simple === 'string') {
    const parsed = parseFloat(simple);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
};

const formatDateForBigQuery = (dateString?: string): string | null => {
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

const formatDate = (date?: string | { value: string }): string => {
  if (!date) return '';
  
  try {
    const dateValue = typeof date === 'string' ? date : date.value;
    const cleanDate = dateValue.toString().replace(/\s+UTC\s*$/, '').trim();
    return new Date(cleanDate).toLocaleDateString('ro-RO');
  } catch {
    return '';
  }
};

const sanitizeStringForBigQuery = (value: any): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  
  return String(value).trim() || null;
};

// Funcție pentru obținerea următorului număr PV din SetariContracte
async function getNextPVNumber(proiectId?: string): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/setari/contracte/next-number?tipDocument=pv&proiectId=${proiectId || ''}`);
    const result = await response.json();
    
    if (result.success) {
      return {
        numar_pv: result.contract_preview,
        numar_secvential: result.numar_secvential,
        serie: result.serie,
        setari: result
      };
    } else {
      // Fallback dacă nu găsește setări
      const currentYear = new Date().getFullYear();
      const fallbackNumber = Math.floor(Math.random() * 1000) + 100;
      return {
        numar_pv: `PV-${fallbackNumber}-${currentYear}`,
        numar_secvential: fallbackNumber,
        serie: 'PV',
        setari: { tip_document: 'pv' }
      };
    }
  } catch (error) {
    console.error('Eroare la obținerea numărului PV:', error);
    const currentYear = new Date().getFullYear();
    const fallbackNumber = Math.floor(Math.random() * 1000) + 100;
    return {
      numar_pv: `PV-${fallbackNumber}-${currentYear}`,
      numar_secvential: fallbackNumber,
      serie: 'PV',
      setari: { tip_document: 'pv' }
    };
  }
}

// Funcție pentru încărcarea datelor proiect (PĂSTRATĂ din contracte)
async function loadProiectDataForPV(proiectId: string) {
  try {
    const proiectQuery = `
      SELECT * FROM \`${PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @proiectId
      LIMIT 1
    `;
    
    const [proiectRows] = await bigquery.query({
      query: proiectQuery,
      params: { proiectId },
      location: 'EU',
    });
    
    if (proiectRows.length === 0) {
      throw new Error(`Proiectul ${proiectId} nu a fost găsit`);
    }
    
    const proiectRaw = proiectRows[0];
    
    // Încarcă date client (ca în contracte)
    let clientData: any = null;
    if (proiectRaw.Client) {
      const clientQuery = `
        SELECT * FROM \`${PROJECT_ID}.PanouControlUnitar.Clienti\`
        WHERE TRIM(LOWER(nume)) = TRIM(LOWER(@clientNume))
        AND activ = true
        LIMIT 1
      `;
      
      const [clientRows] = await bigquery.query({
        query: clientQuery,
        params: { clientNume: proiectRaw.Client },
        location: 'EU',
      });
      
      if (clientRows.length > 0) {
        clientData = clientRows[0];
      }
    }
    
    // Încarcă subproiecte
    const subproiecteQuery = `
      SELECT * FROM \`${PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      WHERE ID_Proiect = @proiectId
      AND activ = true
      ORDER BY Denumire ASC
    `;
    
    const [subproiecteRows] = await bigquery.query({
      query: subproiecteQuery,
      params: { proiectId },
      location: 'EU',
    });
    
    const proiectProcessed = {
      ID_Proiect: extractSimpleValue(proiectRaw.ID_Proiect),
      Denumire: extractSimpleValue(proiectRaw.Denumire),
      Client: extractSimpleValue(proiectRaw.Client),
      Status: extractSimpleValue(proiectRaw.Status),
      Valoare_Estimata: extractNumericValue(proiectRaw.Valoare_Estimata),
      Data_Start: extractSimpleValue(proiectRaw.Data_Start),
      Data_Final: extractSimpleValue(proiectRaw.Data_Final),
      Adresa: extractSimpleValue(proiectRaw.Adresa),
      Responsabil: extractSimpleValue(proiectRaw.Responsabil),
      moneda: extractSimpleValue(proiectRaw.moneda) || 'RON',
      curs_valutar: extractNumericValue(proiectRaw.curs_valutar),
      valoare_ron: extractNumericValue(proiectRaw.valoare_ron),
      
      client_id: clientData ? extractSimpleValue(clientData.id) : null,
      client_nume: clientData ? extractSimpleValue(clientData.nume) : extractSimpleValue(proiectRaw.Client),
      client_cui: clientData ? extractSimpleValue(clientData.cui) : null,
      client_reg_com: clientData ? extractSimpleValue(clientData.nr_reg_com) : null,
      client_adresa: clientData ? extractSimpleValue(clientData.adresa) : null,
      client_telefon: clientData ? extractSimpleValue(clientData.telefon) : null,
      client_email: clientData ? extractSimpleValue(clientData.email) : null,
      client_reprezentant: clientData ? extractSimpleValue(clientData.reprezentant) : 'Administrator'
    };
    
    const subproiecteProcessed = subproiecteRows.map((sub: any) => ({
      ID_Subproiect: extractSimpleValue(sub.ID_Subproiect),
      Denumire: extractSimpleValue(sub.Denumire),
      Valoare_Estimata: extractNumericValue(sub.Valoare_Estimata),
      Status: extractSimpleValue(sub.Status),
      status_predare: extractSimpleValue(sub.status_predare) || 'Nepredat',
      moneda: extractSimpleValue(sub.moneda) || 'RON',
      curs_valutar: extractNumericValue(sub.curs_valutar),
      valoare_ron: extractNumericValue(sub.valoare_ron),
      Data_Final: extractSimpleValue(sub.Data_Final),
      Responsabil: extractSimpleValue(sub.Responsabil)
    }));
    
    return {
      proiect: proiectProcessed,
      subproiecte: subproiecteProcessed
    };
    
  } catch (error) {
    console.error('Eroare la extragerea datelor pentru PV:', error);
    throw error;
  }
}

// Procesarea placeholder-urilor pentru PV (adaptat din contracte)
function processPVPlaceholders(text: string, data: any): string {
  let processed = text;
  
  // ÎNLOCUIRI SIMPLE DIRECTE
  const simpleReplacements: { [key: string]: string } = {
    // PV info
    '{{pv.numar}}': data.pv?.numar || 'PV-NR-TBD',
    '{{pv.data}}': data.pv?.data || new Date().toLocaleDateString('ro-RO'),
    '{{pv.numar_exemplare}}': data.pv?.numar_exemplare || '3',
    
    // Client info
    '{{client.nume}}': data.client?.nume || data.client?.denumire || 'CLIENT NECUNOSCUT',
    '{{client.cui}}': data.client?.cui || 'CUI NECUNOSCUT',
    '{{client.nr_reg_com}}': data.client?.nr_reg_com || 'NR REG COM NECUNOSCUT',
    '{{client.adresa}}': data.client?.adresa || 'ADRESA NECUNOSCUTA',
    '{{client.telefon}}': data.client?.telefon || '',
    '{{client.email}}': data.client?.email || '',
    '{{client.reprezentant}}': data.client?.reprezentant || 'Administrator',
    
    // Proiect info
    '{{proiect.denumire}}': data.proiect?.denumire || 'PROIECT NECUNOSCUT',
    '{{proiect.data_start}}': data.proiect?.data_start || 'TBD',
    '{{proiect.data_final}}': data.proiect?.data_final || 'TBD',
    '{{proiect.responsabil}}': data.proiect?.responsabil || '',
    
    // Firma info (identic cu contractele)
    '{{firma.nume}}': 'UNITAR PROIECT TDA SRL',
    '{{firma.cui}}': 'RO35639210',
    '{{firma.nr_reg_com}}': 'J2016002024405',
    '{{firma.adresa}}': 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
    '{{firma.telefon}}': '0765486044',
    '{{firma.email}}': 'contact@unitarproiect.eu',
    '{{firma.cont_ing}}': 'RO82INGB0000999905667533',
    '{{firma.cont_trezorerie}}': 'RO29TREZ7035069XXX018857'
  };
  
  // Aplică înlocuirile simple
  for (const [placeholder, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processed = processed.replace(regex, value);
  }
  
  // PROCESARE COMPLEXĂ pentru secțiuni condiționale
  
  // Adresa execuție
  if (data.proiect?.adresa && data.proiect.adresa.trim()) {
    processed = processed.replace('{{proiect.adresa}}', `din ${data.proiect.adresa}`);
  } else {
    processed = processed.replace('{{proiect.adresa}}', '');
  }
  
  // Lista subproiecte predate - format specific pentru PV
  let subproiecteText = '';
  if (data.subproiecte_predate && Array.isArray(data.subproiecte_predate) && data.subproiecte_predate.length > 0) {
    subproiecteText = `faza `;
    subproiecteText += data.subproiecte_predate.map((sub: any) => sub.denumire).join(', ');
  } else {
    subproiecteText = 'faza finală';
  }
  processed = processed.replace('{{subproiecte_lista}}', subproiecteText);
  
  // Observații
  let observatiiClause = '';
  if (data.observatii && data.observatii.trim()) {
    observatiiClause = `\n**OBSERVAȚII SUPLIMENTARE:**\n\n${data.observatii}\n`;
  }
  processed = processed.replace('{{observatii_clause}}', observatiiClause);
  
  return processed;
}

// Conversie TXT la DOCX (PĂSTRATĂ din contracte)
function convertTextToWordXml(text: string): string {
  const paragraphs = text.split('\n').map(line => {
    if (line.trim() === '') {
      return '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
    }
    // Detectează și procesează markerele de centrare
  const shouldCenter = line.includes('[CENTER]');
  const cleanLine = line.replace(/\[CENTER\]|\[\/CENTER\]/g, '');
  const alignment = shouldCenter ? '<w:jc w:val="center"/>' : '';
  
  // Folosește cleanLine în loc de line pentru restul procesării
  if (cleanLine.trim() === '') {
    return '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
  }
    
    if (cleanLine.includes('**')) {
      let processedLine = cleanLine;
      
      processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, (match, content) => {
        return `<w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${content}</w:t></w:r>`;
      });
      
      const boldPattern = /<w:r><w:rPr><w:b\/><w:sz w:val="24"\/><\/w:rPr><w:t xml:space="preserve">.*?<\/w:t><\/w:r>/g;
      const parts = processedLine.split(boldPattern);
      const boldMatches = processedLine.match(boldPattern) || [];
      
      let result = '';
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].trim() || parts[i].includes(' ')) {
          result += `<w:r><w:t xml:space="preserve">${parts[i]}</w:t></w:r>`;
        }
        if (boldMatches[i]) {
          result += boldMatches[i];
        }
      }
      
      return `<w:p><w:pPr>${alignment}<w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr>${result}</w:p>`;
    }
    
    return `<w:p><w:pPr>${alignment}<w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
  </w:body>
</w:document>`;
}

async function convertTextToDocx(processedText: string): Promise<Buffer> {
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
  
  const wordXml = convertTextToWordXml(processedText);
  zip.file('word/document.xml', wordXml);
  
  return await zip.generateAsync({ type: 'nodebuffer' });
}

// Procesare template DOCX pentru PV
async function processPVDocxTemplate(templatePath: string, data: any): Promise<Buffer> {
  try {
    const templateBuffer = await readFile(templatePath);
    const zip = new JSZip();
    
    await zip.loadAsync(templateBuffer);
    
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('document.xml nu a fost gasit in template DOCX PV');
    }
    
    const processedXml = processPVPlaceholders(documentXml, data);
    
    zip.file('word/document.xml', processedXml);
    
    return await zip.generateAsync({ type: 'nodebuffer' });
    
  } catch (error) {
    console.error('Eroare la procesarea template-ului DOCX PV:', error);
    throw error;
  }
}

// Procesare template TXT pentru PV
async function processPVTextTemplate(templatePath: string, data: any): Promise<string> {
  try {
    const templateContent = await readFile(templatePath, 'utf8');
    return processPVPlaceholders(templateContent, data);
  } catch (error) {
    console.error('Eroare la procesarea template-ului TXT PV:', error);
    throw error;
  }
}

// Template fallback pentru PV
async function createPVFallbackTemplate(data: any): Promise<string> {
  const templateContent = `**PROCES VERBAL DE PREDARE PRIMIRE DIN DATA {{pv.data}} LA CONTRACTUL NR. {{contract.numar}} din {{contract.data}}**

Încheiat azi {{pv.data}} între:

**S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social în {{firma.adresa}}, având CIF {{firma.cui}} și nr. de înregistrare la Registrul Comerțului {{firma.nr_reg_com}}, având contul IBAN: {{firma.cont_ing}}, deschis la banca ING, și cont Trezorerie IBAN: {{firma.cont_trezorerie}}, e-mail: {{firma.email}}, reprezentată legal de Damian Teodor, în calitate de Administrator, numită în continuare **PRESTATOR**.

Și

**{{client.nume}}**, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}}, denumită în continuare **BENEFICIAR**

Prin prezenta se confirmă că am predat / am primit în .....număr..... exemplare din **{{proiect.denumire}}** {{proiect.adresa}} {{subproiecte_lista}}.

{{observatii_clause}}

---

**SEMNAT ÎN DATA: {{pv.data}}**

**BENEFICIAR:**

**{{client.nume}}**
{{client.reprezentant}}

.................................


**PRESTATOR:**

**S.C. UNITAR PROIECT TDA S.R.L.**
**DAMIAN TEODOR**
Administrator

.................................`;

  return processPVPlaceholders(templateContent, data);
}

// Preparare date template pentru PV
function preparePVTemplateData(
  proiect: any, 
  subproiectePredate: any[],
  pvData: any,
  observatii?: string
) {
  const dataPV = new Date().toLocaleDateString('ro-RO');
  
  const templateData = {
    pv: {
	  numar: pvData.numar_pv,
	  data: dataPV,
	  numar_exemplare: '3'
	},
    
    contract: {
      numar: 'Se va completa manual', // PV poate fi independent de contract
      data: dataPV
    },
    
    client: {
      nume: proiect.client_nume || 'Client necunoscut',
      cui: proiect.client_cui || 'CUI necunoscut',
      nr_reg_com: proiect.client_reg_com || 'Nr. reg. com. necunoscut',
      adresa: proiect.client_adresa || 'Adresa necunoscuta',
      telefon: proiect.client_telefon || '',
      email: proiect.client_email || '',
      reprezentant: proiect.client_reprezentant || 'Administrator'
    },
    
    proiect: {
      denumire: proiect.Denumire,
      adresa: proiect.Adresa || '',
      data_start: formatDate(proiect.Data_Start),
      data_final: formatDate(proiect.Data_Final),
      responsabil: proiect.Responsabil || ''
    },
    
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
    
    subproiecte_predate: subproiectePredate.map(sub => ({
      id: sub.ID_Subproiect,
      denumire: sub.Denumire,
      valoare: sub.Valoare_Estimata || 0,
      moneda: sub.moneda || 'RON',
      status: sub.Status
    })),
    
    observatii: observatii || '',
    data_generare: new Date().toISOString()
  };
  
  return templateData;
}

// Salvare PV în BigQuery
async function salveazaPVInBigQuery(pvInfo: any): Promise<string> {
  try {
    const pvId = `PV_${pvInfo.proiectId}_${Date.now()}`;
    
    const dataPredare = `DATE('${new Date().toISOString().split('T')[0]}')`;
    
    // Calculează valoarea totală a subproiectelor predate
    let valoareTotala = 0;
    let valoareRON = 0;
    let monedaPrincipala = 'RON';
    
    if (pvInfo.subproiectePredate && pvInfo.subproiectePredate.length > 0) {
      valoareTotala = pvInfo.subproiectePredate.reduce((sum: number, sub: any) => 
        sum + (sub.Valoare_Estimata || 0), 0);
      valoareRON = pvInfo.subproiectePredate.reduce((sum: number, sub: any) => 
        sum + (sub.valoare_ron || sub.Valoare_Estimata || 0), 0);
      
      // Determină moneda principală
      const monede = pvInfo.subproiectePredate.map((sub: any) => sub.moneda || 'RON');
      const monedeCounts = monede.reduce((acc: any, moneda: string) => {
        acc[moneda] = (acc[moneda] || 0) + 1;
        return acc;
      }, {});
      
      monedaPrincipala = Object.entries(monedeCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0][0] as string;
    } else {
      // Pentru proiecte fără subproiecte
      valoareTotala = pvInfo.proiect.Valoare_Estimata || 0;
      valoareRON = pvInfo.proiect.valoare_ron || valoareTotala;
      monedaPrincipala = pvInfo.proiect.moneda || 'RON';
    }

    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.PanouControlUnitar.ProcesVerbale\`
      (ID_PV, numar_pv, serie_pv, tip_document, proiect_id, subproiecte_ids, 
       client_id, client_nume, denumire_pv, data_predare, status_predare, 
       valoare_totala, moneda, valoare_ron, observatii, 
       activ, versiune, data_creare, data_actualizare, creat_de)
      VALUES (
        '${pvId}',
        '${pvInfo.pvData.numar_pv}',
        '${pvInfo.pvData.serie}',
        'pv',
        '${pvInfo.proiectId}',
        ${pvInfo.subproiecteIds.length > 0 ? `PARSE_JSON('${JSON.stringify(pvInfo.subproiecteIds)}')` : 'NULL'},
        ${pvInfo.proiect.client_id ? `'${pvInfo.proiect.client_id}'` : 'NULL'},
        '${(pvInfo.proiect.client_nume || 'Client necunoscut').replace(/'/g, "''")}',
        '${pvInfo.denumirePV.replace(/'/g, "''")}',
        ${dataPredare},
        'Predat',
        ${valoareTotala},
        '${monedaPrincipala}',
        ${valoareRON},
        ${pvInfo.observatii ? `'${pvInfo.observatii.replace(/'/g, "''")}'` : 'NULL'},
        true,
        1,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        'System'
      )
    `;

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`✅ PV ${pvId} salvat în BigQuery cu numărul ${pvInfo.pvData.numar_pv}`);
    return pvId;
    
  } catch (error) {
    console.error('Eroare la salvarea PV în BigQuery:', error);
    throw error;
  }
}

// Actualizare status predare pentru subproiecte/proiect
async function actualizeazaStatusPredare(proiectId: string, subproiecteIds: string[]) {
  try {
    const queryPromises: Promise<any>[] = [];

    if (subproiecteIds.length > 0) {
      // Actualizează status_predare pentru subproiectele selectate
      subproiecteIds.forEach(subId => {
        const updateSubQuery = `
          UPDATE \`${PROJECT_ID}.PanouControlUnitar.Subproiecte\`
          SET status_predare = 'Predat', data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Subproiect = '${subId}'
        `;
        queryPromises.push(bigquery.query({ query: updateSubQuery, location: 'EU' }));
      });
    } else {
      // Pentru proiecte fără subproiecte, actualizează proiectul principal
      const updateProiectQuery = `
        UPDATE \`${PROJECT_ID}.PanouControlUnitar.Proiecte\`
        SET status_predare = 'Predat'
        WHERE ID_Proiect = '${proiectId}'
      `;
      queryPromises.push(bigquery.query({ query: updateProiectQuery, location: 'EU' }));
    }

    // Execută toate actualizările
    await Promise.all(queryPromises);
    
    console.log(`✅ Status predare actualizat pentru proiectul ${proiectId}`);
    
  } catch (error) {
    console.error('Eroare la actualizarea status predare:', error);
    throw error;
  }
}

// FUNCȚIA POST PRINCIPALĂ
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      proiectId,
      subproiecteIds = [],
      observatii = '',
      denumirePV
    } = body;

    console.log('[PV-GENERATE] ================================');
    console.log('[PV-GENERATE] PROCES ÎNCEPUT:', {
      proiectId,
      subproiecte_count: subproiecteIds.length,
      denumirePV
    });

    // 1. ÎNCĂRCAREA DATELOR PROIECT
    const { proiect, subproiecte } = await loadProiectDataForPV(proiectId);
    
    console.log('[PV-GENERATE] Date proiect încărcate:', {
      proiect_id: proiect.ID_Proiect,
      client: proiect.Client,
      subproiecte_total: subproiecte.length,
      subproiecte_selectate: subproiecteIds.length
    });

    // 2. GENERAREA NUMĂRULUI PV
    const pvData = await getNextPVNumber(proiectId);
    
    console.log('[PV-GENERATE] Număr PV generat:', pvData.numar_pv);

    // 3. IDENTIFICAREA SUBPROIECTELOR PREDATE
    let subproiectePredate: any[] = [];
    if (subproiecteIds.length > 0) {
      subproiectePredate = subproiecte.filter(sub => 
        subproiecteIds.includes(sub.ID_Subproiect)
      );
    }

    // 4. PREGĂTIREA DATELOR TEMPLATE
    const templateData = preparePVTemplateData(
      proiect,
      subproiectePredate,
      pvData,
      observatii
    );

    console.log('[PV-GENERATE] Template data pregătit pentru:', pvData.numar_pv);

    // 5. GENERAREA DOCUMENTULUI PV
    let pvBuffer: Buffer;
    let templateUsed = 'fallback';

    try {
      // Caută template-uri disponibile pentru PV
      const templateOptions = [
        path.join(TEMPLATES_DIR, 'pv-template.docx'),
        path.join(TEMPLATES_DIR, 'pv-template.txt'),
        path.join(TEMPLATES_DIR, 'proces-verbal-template.docx'),
        path.join(TEMPLATES_DIR, 'proces-verbal-template.txt')
      ];

      let templatePath: string | null = null;
      for (const templateOption of templateOptions) {
        try {
          const { access } = await import('fs/promises');
          await access(templateOption);
          templatePath = templateOption;
          break;
        } catch {
          continue;
        }
      }
      
      if (templatePath) {
        templateUsed = path.basename(templatePath);
        
        if (templatePath.endsWith('.docx')) {
          pvBuffer = await processPVDocxTemplate(templatePath, templateData);
        } else if (templatePath.endsWith('.txt')) {
          const processedText = await processPVTextTemplate(templatePath, templateData);
          pvBuffer = await convertTextToDocx(processedText);
        } else {
          throw new Error(`Tip template nepermis: ${path.extname(templatePath)}`);
        }
      } else {
        // Fallback la template hardcodat
        const fallbackTemplate = await createPVFallbackTemplate(templateData);
        pvBuffer = await convertTextToDocx(fallbackTemplate);
        templateUsed = 'fallback-no-template-found';
      }
    } catch (templateError) {
      console.error('[PV-GENERATE] Eroare template PV:', templateError);
      // Fallback la template hardcodat
      const fallbackTemplate = await createPVFallbackTemplate(templateData);
      pvBuffer = await convertTextToDocx(fallbackTemplate);
      templateUsed = `fallback-error: ${templateError instanceof Error ? templateError.message : 'unknown'}`;
    }

    console.log('[PV-GENERATE] PV DOCX generat, template folosit:', templateUsed);

    // 6. SALVAREA ÎN BIGQUERY
    const pvInfo = {
      proiectId,
      subproiecteIds,
      subproiectePredate,
      proiect,
      pvData,
      denumirePV: denumirePV || `PV Predare ${proiect.Denumire}`,
      observatii
    };

    const pvId = await salveazaPVInBigQuery(pvInfo);
    
    console.log('[PV-GENERATE] ✅ PV salvat în BigQuery cu ID:', pvId);

    // 7. ACTUALIZAREA STATUS PREDARE
    await actualizeazaStatusPredare(proiectId, subproiecteIds);
    
    console.log('[PV-GENERATE] ✅ Status predare actualizat');

    // 8. RĂSPUNSUL FINAL
    const fileName = `${pvData.numar_pv}.docx`;

    const response = new NextResponse(pvBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pvBuffer.length.toString(),
        
        // Headere informative pentru frontend
        'X-PV-Number': pvData.numar_pv,
        'X-PV-ID': pvId,
        'X-Template-Used': templateUsed,
        'X-Subproiecte-Count': subproiecteIds.length.toString(),
        'X-Proiect-ID': proiectId
      }
    });

    console.log('[PV-GENERATE] ================================');
    console.log('[PV-GENERATE] ✅ PROCES FINALIZAT CU SUCCES:', {
      pv_number: pvData.numar_pv,
      pv_id: pvId,
      file_name: fileName,
      file_size: `${(pvBuffer.length / 1024).toFixed(2)} KB`,
      subproiecte_predate: subproiecteIds.length,
      template_used: templateUsed
    });
    console.log('[PV-GENERATE] ================================');

    return response;

  } catch (error) {
    console.error('[PV-GENERATE] ================================');
    console.error('[PV-GENERATE] ❌ EROARE FATALĂ:', error);
    console.error('[PV-GENERATE] ================================');

    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: error.message,
          details: 'Verifică logs pentru detalii complete',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Eroare necunoscută la generarea PV',
        details: 'Contactează administratorul',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET pentru testare
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const proiectId = url.searchParams.get('proiect_id');
    
    if (!proiectId) {
      return NextResponse.json({ error: 'proiect_id este necesar' }, { status: 400 });
    }

    const { proiect, subproiecte } = await loadProiectDataForPV(proiectId);
    
    return NextResponse.json({
      success: true,
      message: 'API PV funcțional',
      proiect_test: {
        id: proiect.ID_Proiect,
        denumire: proiect.Denumire,
        client: proiect.Client,
        subproiecte_count: subproiecte.length,
        subproiecte_disponibile: subproiecte.filter(sub => sub.status_predare !== 'Predat').length
      }
    });
    
  } catch (error) {
    console.error('Eroare la testarea API-ului PV:', error);
    return NextResponse.json(
      { error: 'Eroare la testarea API-ului PV' },
      { status: 500 }
    );
  }
}
