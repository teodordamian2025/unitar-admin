// ==================================================================
// CALEA: app/api/actions/contracts/generate/route.ts  
// DATA: 05.09.2025 22:30 (ora României)
// VERSIUNEA FINALĂ: Eliminat debugging + Fix spațiere text + Funcționalități păstrate
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { getNextContractNumber } from '../../../setari/contracte/route';
import { findBestTemplate } from '../../../../../lib/templates-helpers';

const PROJECT_ID = 'hale-mode-464009-i6';
const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'contracte', 'templates');

// Cursuri valutare pentru conversii
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

// Helper corect pentru conversie valori BigQuery
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
  
  if (typeof value === 'object' && value !== null && 'c' in value && Array.isArray(value.c)) {
    try {
      const stringValue = value.toString();
      const numericValue = parseFloat(stringValue);
      if (!isNaN(numericValue)) {
        return numericValue;
      }
    } catch (error) {
      return 0;
    }
  }
  
  if (typeof value === 'bigint') {
    return Number(value);
  }
  
  return String(value);
};

// Conversie sigură pentru numere
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

// Helper pentru conversie BigQuery NUMERIC
const convertBigQueryNumeric = (value: any): number => {
  return extractNumericValue(value);
};

// Helper pentru formatarea datelor pentru BigQuery
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

// Helper pentru formatarea datelor pentru afișare
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

// Helper pentru sanitizarea string-urilor
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

// Calculare durată în zile
function calculateDurationInDays(startDate?: string | { value: string }, endDate?: string | { value: string }): string {
  if (!startDate || !endDate) return 'TBD';
  
  try {
    const startValue = typeof startDate === 'string' ? startDate : startDate.value;
    const endValue = typeof endDate === 'string' ? endDate : endDate.value;
    
    const start = new Date(startValue);
    const end = new Date(endValue);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'TBD';
    }
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays.toString();
  } catch {
    return 'TBD';
  }
}

// Procesarea placeholder-urilor - VERSIUNEA FINALĂ CURĂȚATĂ
function processPlaceholders(text: string, data: any): string {
  let processed = text;
  
  // PROCESARE TERMENE PERSONALIZATE ÎNAINTE DE TOATE CELELALTE
  let termeneText = '';
  if (data.termene_personalizate && Array.isArray(data.termene_personalizate) && data.termene_personalizate.length > 0) {
    termeneText = data.termene_personalizate.map((termen: any, index: number) => {
      const etapaString = `**Etapa ${index + 1}**: ${(termen.procent_calculat || 0).toFixed(1)}% (${(termen.valoare || 0).toFixed(2)} ${termen.moneda || 'RON'}) - ${termen.denumire || 'Fără denumire'} (termen: ${termen.termen_zile || 30} zile)`;
      return etapaString;
    }).join('\n\n');
  } else {
    termeneText = `**Etapa 1**: 100.0% (${data.suma_totala_originala || '0.00'} ${data.moneda_originala || 'RON'}) - La predarea proiectului (termen: 60 zile)`;
  }

  processed = processed.replace('{{termene_personalizate}}', termeneText);
  
  // ÎNLOCUIRI SIMPLE DIRECTE
  const simpleReplacements: { [key: string]: string } = {
    // Contract info
    '{{contract.numar}}': data.contract?.numar || 'Contract-NR-TBD',
    '{{contract.data}}': data.contract?.data || new Date().toLocaleDateString('ro-RO'),
    
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
    '{{proiect.durata_zile}}': data.proiect?.durata_zile || 'TBD',
    '{{proiect.responsabil}}': data.proiect?.responsabil || '',
    
    // Firma info
    '{{firma.nume}}': 'UNITAR PROIECT TDA SRL',
    '{{firma.cui}}': 'RO35639210',
    '{{firma.nr_reg_com}}': 'J2016002024405',
    '{{firma.adresa}}': 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
    '{{firma.telefon}}': '0765486044',
    '{{firma.email}}': 'contact@unitarproiect.eu',
    '{{firma.cont_ing}}': 'RO82INGB0000999905667533',
    '{{firma.cont_trezorerie}}': 'RO29TREZ7035069XXX018857',
    
    // Sume monetare
    '{{suma_totala_originala}}': data.suma_totala_originala || '0.00',
    '{{moneda_originala}}': data.moneda_originala || 'RON',
    '{{suma_totala_ron}}': data.suma_totala_ron || '0.00'
  };
  
  // Aplică înlocuirile simple
  for (const [placeholder, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processed = processed.replace(regex, value);
  }
  
  // PROCESARE COMPLEXĂ pentru secțiuni condiționale
  
  // Adresa execuție
  if (data.proiect?.adresa && data.proiect.adresa.trim()) {
    processed = processed.replace('{{proiect.adresa}}', `Adresa execuție: ${data.proiect.adresa}`);
  } else {
    processed = processed.replace('{{proiect.adresa}}', '');
  }
  
  // Subproiecte - lista generată direct
  let subproiecteText = '';
  if (data.subproiecte && Array.isArray(data.subproiecte) && data.subproiecte.length > 0) {
    subproiecteText = `\n**Componente proiect:**\n`;
    subproiecteText += data.subproiecte.map((sub: any) => {
      const valoare = sub.valoare_originala || sub.valoare || 0;
      const moneda = sub.moneda || 'RON';
      return `- ${sub.denumire}: ${valoare.toFixed(2)} ${moneda}`;
    }).join('\n');
    subproiecteText += '\n';
  }
  processed = processed.replace('{{subproiecte_lista}}', subproiecteText);
  
  // Clauză valută pentru contracte în valută străină
  const valutaClause = data.moneda_originala !== 'RON' ? ', plătiți în lei la cursul BNR din ziua facturării' : '';
  processed = processed.replace('{{valuta_clause}}', valutaClause);
  
  // CLAUZE CONDIȚIONALE
  
  // Responsabil proiect
  let responsabilClause = '';
  if (data.proiect?.responsabil && data.proiect.responsabil.trim()) {
    responsabilClause = `E). Responsabilul proiect din partea PRESTATOR: ${data.proiect.responsabil}`;
  }
  processed = processed.replace('{{responsabil_clause}}', responsabilClause);
  
  // Contact client
  let contactClause = '';
  if (data.client?.telefon && data.client.telefon.trim()) {
    contactClause = `C). Persoană de contact: ${data.client.nume} (Tel: ${data.client.telefon}`;
    if (data.client?.email && data.client.email.trim()) {
      contactClause += `, Email: ${data.client.email}`;
    }
    contactClause += ')';
  }
  processed = processed.replace('{{contact_clause}}', contactClause);
  
  // Observații
  let observatiiClause = '';
  if (data.observatii && data.observatii.trim()) {
    observatiiClause = `\n**OBSERVAȚII SUPLIMENTARE:**\n\n${data.observatii}\n`;
  }
  processed = processed.replace('{{observatii_clause}}', observatiiClause);
  
  return processed;
}

// Conversie TXT la DOCX cu spațiere corectă - VERSIUNEA REPARATĂ
function convertTextToWordXml(text: string): string {
  const paragraphs = text.split('\n').map(line => {
    // Linii goale - spațiere normală
    if (line.trim() === '') {
      return '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
    }
    
    // Procesare pentru linii cu formatare **bold**
    if (line.includes('**')) {
      let processedLine = line;
      
      // Înlocuire **text** cu formatare bold XML, PĂSTRÂND SPAȚIILE
      processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, (match, content) => {
        return `<w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${content}</w:t></w:r>`;
      });
      
      // Procesare text normal între bold-uri, PĂSTRÂND SPAȚIILE
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
      
      return `<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr>${result}</w:p>`;
    }
    
    // Pentru linii normale - PĂSTRÂND SPAȚIILE
    return `<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
  </w:body>
</w:document>`;
}

// Restul funcțiilor rămân la fel...
async function loadProiectDataSimple(proiectId: string) {
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
      client_judet: clientData ? extractSimpleValue(clientData.judet) : null,
      client_oras: clientData ? extractSimpleValue(clientData.oras) : null
    };
    
    const subproiecteProcessed = subproiecteRows.map((sub: any) => ({
      ID_Subproiect: extractSimpleValue(sub.ID_Subproiect),
      Denumire: extractSimpleValue(sub.Denumire),
      Valoare_Estimata: extractNumericValue(sub.Valoare_Estimata),
      Status: extractSimpleValue(sub.Status),
      moneda: extractSimpleValue(sub.moneda) || 'RON',
      curs_valutar: extractNumericValue(sub.curs_valutar),
      valoare_ron: extractNumericValue(sub.valoare_ron),
      Data_Final: extractSimpleValue(sub.Data_Final)
    }));
    
    return {
      proiect: proiectProcessed,
      subproiecte: subproiecteProcessed
    };
    
  } catch (error) {
    console.error('Eroare la extragerea simplificată:', error);
    throw error;
  }
}

function prepareSimpleTemplateData(
  proiect: any, 
  subproiecte: any[], 
  contractData: any,
  termene: any[],
  observatii?: string
) {
  let sumaOriginalaCalculata = 0;
  let sumaRONCalculata = 0;
  let monedaContract = proiect.moneda || 'RON';
  
  if (termene.length > 0) {
    sumaRONCalculata = termene.reduce((sum, t) => sum + (t.valoare_ron || 0), 0);
    
    if (monedaContract === 'RON') {
      sumaOriginalaCalculata = sumaRONCalculata;
    } else {
      const cursProiect = proiect.curs_valutar || CURSURI_VALUTAR[monedaContract] || 1;
      sumaOriginalaCalculata = sumaRONCalculata / cursProiect;
    }
  } else {
    sumaOriginalaCalculata = proiect.Valoare_Estimata || 0;
    sumaRONCalculata = proiect.valoare_ron || sumaOriginalaCalculata;
    monedaContract = proiect.moneda || 'RON';
  }
  
  const dataContract = new Date().toLocaleDateString('ro-RO');
  const durataZile = calculateDurationInDays(proiect.Data_Start, proiect.Data_Final);
  
  const templateData = {
    contract: {
      numar: contractData.numar_contract,
      data: dataContract
    },
    
    client: {
      nume: proiect.client_nume || 'Client necunoscut',
      cui: proiect.client_cui || 'CUI necunoscut',
      nr_reg_com: proiect.client_reg_com || 'Nr. reg. com. necunoscut',
      adresa: proiect.client_adresa || 'Adresa necunoscuta',
      telefon: proiect.client_telefon || '',
      email: proiect.client_email || '',
      reprezentant: 'Administrator'
    },
    
    proiect: {
      denumire: proiect.Denumire,
      adresa: proiect.Adresa || '',
      data_start: formatDate(proiect.Data_Start),
      data_final: formatDate(proiect.Data_Final),
      durata_zile: durataZile,
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
    
    subproiecte: subproiecte.map(sub => ({
      denumire: sub.Denumire,
      valoare: sub.Valoare_Estimata || 0,
      valoare_originala: sub.Valoare_Estimata || 0,
      moneda: sub.moneda || 'RON',
      status: sub.Status
    })),
    
    termene_personalizate: termene,
    
    suma_totala_originala: sumaOriginalaCalculata.toFixed(2),
    moneda_originala: monedaContract,
    
    observatii: observatii || '',
    data_generare: new Date().toISOString()
  };
  
  return templateData;
}

function calculeazaSumaContractCuValoriEstimate(proiect: any, subproiecte: any[], termenePersonalizate: any[]) {
  let sumaOriginala = 0;
  let monedaOriginala = 'RON';
  let sumaFinalaRON = 0;
  const cursuriUtilizate: { [moneda: string]: number } = {};
  
  monedaOriginala = proiect.moneda || 'RON';

  if (termenePersonalizate.length > 0) {
    let totalRONDinTermeni = 0;
    
    termenePersonalizate.forEach((termen) => {
      const valoareOriginala = termen.valoare || 0;
      const valoareRON = termen.valoare_ron || valoareOriginala;
      const monedaTermen = termen.moneda || 'RON';
      
      totalRONDinTermeni += valoareRON;
      
      if (monedaTermen !== 'RON') {
        cursuriUtilizate[monedaTermen] = termen.curs_valutar || CURSURI_VALUTAR[monedaTermen] || 1;
      }
    });
    
    if (monedaOriginala === 'RON') {
      sumaOriginala = totalRONDinTermeni;
      sumaFinalaRON = totalRONDinTermeni;
    } else {
      const cursProiect = cursuriUtilizate[monedaOriginala] || 
                         proiect.curs_valutar || 
                         CURSURI_VALUTAR[monedaOriginala] || 1;
      
      sumaOriginala = totalRONDinTermeni / cursProiect;
      sumaFinalaRON = totalRONDinTermeni;
      
      cursuriUtilizate[monedaOriginala] = cursProiect;
    }
  } else {
    sumaOriginala = proiect.Valoare_Estimata || 0;
    sumaFinalaRON = proiect.valoare_ron || sumaOriginala;
    monedaOriginala = proiect.moneda || 'RON';
    
    if (proiect.moneda && proiect.moneda !== 'RON') {
      cursuriUtilizate[proiect.moneda] = proiect.curs_valutar || CURSURI_VALUTAR[proiect.moneda] || 1;
    }
  }

  return { 
    sumaFinala: sumaFinalaRON, 
    monedaFinala: monedaOriginala,
    cursuriUtilizate,
    sumaOriginala: Math.round(sumaOriginala * 100) / 100,
    monedaOriginala
  };
}

async function processDocxTemplate(templatePath: string, data: any): Promise<Buffer> {
  try {
    const templateBuffer = await readFile(templatePath);
    const zip = new JSZip();
    
    await zip.loadAsync(templateBuffer);
    
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('document.xml nu a fost gasit in template DOCX');
    }
    
    const processedXml = processPlaceholders(documentXml, data);
    
    zip.file('word/document.xml', processedXml);
    
    return await zip.generateAsync({ type: 'nodebuffer' });
    
  } catch (error) {
    console.error('Eroare la procesarea template-ului DOCX:', error);
    throw error;
  }
}

async function processTextTemplate(templatePath: string, data: any): Promise<string> {
  try {
    const templateContent = await readFile(templatePath, 'utf8');
    return processPlaceholders(templateContent, data);
  } catch (error) {
    console.error('Eroare la procesarea template-ului TXT:', error);
    throw error;
  }
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

async function createFallbackTemplate(data: any): Promise<string> {
  const templateContent = `**CONTRACT DE SERVICII**

**NR. {{contract.numar}} din {{contract.data}}**

**CAP.I. PĂRȚI CONTRACTANTE**

1. Între {{client.nume}}, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}} denumită în continuare **BENEFICIAR**

și

2. **S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social în {{firma.adresa}}, având CIF {{firma.cui}} și nr. de înregistrare la Registrul Comerțului {{firma.nr_reg_com}}, având contul IBAN: {{firma.cont_ing}}, deschis la banca ING, și cont Trezorerie IBAN: {{firma.cont_trezorerie}}, e-mail: {{firma.email}}, reprezentată legal de Damian Teodor, în calitate de Administrator, numită în continuare **PRESTATOR**.

**CAP. II. OBIECTUL CONTRACTULUI**

Obiectul contractului îl reprezintă:

Realizare {{proiect.denumire}}

{{proiect.adresa}}

{{subproiecte_lista}}

**CAP.III. DURATA CONTRACTULUI:**

1. Contractul se încheie pe o perioadă determinată, cu următoarele termene:
- Data început: {{proiect.data_start}}
- Data finalizare: {{proiect.data_final}}  
- Durata estimată: {{proiect.durata_zile}} zile

**CAP. IV. PREȚUL DE EXECUTARE AL LUCRĂRII**

1. Prețul pe care Beneficiarul îl datorează prestatorului pentru serviciile sale este de **{{suma_totala_originala}} {{moneda_originala}}** la care se aplică suplimentar TVA{{valuta_clause}}.

**Valoarea totală contract: {{suma_totala_ron}} RON + TVA**

Plățile vor fi realizate în modul următor:

{{termene_personalizate}}

{{responsabil_clause}}

{{contact_clause}}

{{observatii_clause}}

---

**SEMNAT ÎN DATA: {{contract.data}}**

**BENEFICIAR:**

**{{client.nume}}**
{{client.reprezentant}}

.................................


**PRESTATOR:**

**S.C. UNITAR PROIECT TDA S.R.L.**
**DAMIAN TEODOR**
Administrator

.................................
`;

  return processPlaceholders(templateContent, data);
}

async function salveazaContractCuDateCorecte(contractInfo: any): Promise<string> {
  const contractId = contractInfo.isEdit && contractInfo.contractExistentId 
    ? contractInfo.contractExistentId 
    : `CONTR_${contractInfo.proiectId}_${Date.now()}`;
  
  try {
    const dataStart = contractInfo.proiect.Data_Start;
    const dataFinal = contractInfo.proiect.Data_Final;
    
    const dataSemnare = formatDateForBigQuery(new Date().toISOString().split('T')[0]);
    const dataExpirare = formatDateForBigQuery(
      typeof dataFinal === 'object' && dataFinal.value ? dataFinal.value : 
      typeof dataFinal === 'string' ? dataFinal : null
    );

    const cursValutarPrincipal = contractInfo.monedaOriginala !== 'RON' ? 
      (contractInfo.cursuriUtilizate[contractInfo.monedaOriginala] || CURSURI_VALUTAR[contractInfo.monedaOriginala] || null) : 
      null;
    
    const dataCursValutar = cursValutarPrincipal ? 
      formatDateForBigQuery(new Date().toISOString().split('T')[0]) : 
      null;

    if (contractInfo.isEdit && contractInfo.contractExistentId) {
      const updateQuery = `
        UPDATE \`${PROJECT_ID}.PanouControlUnitar.Contracte\`
        SET 
          Valoare = @valoare,
          Moneda = @moneda,
          curs_valutar = @cursValutar,
          data_curs_valutar = @dataCurs,
          valoare_ron = @valoareRon,
          etape = PARSE_JSON(@etape),
          articole_suplimentare = PARSE_JSON(@articoleSuplimentare),
          data_actualizare = CURRENT_TIMESTAMP(),
          continut_json = PARSE_JSON(@continutJson),
          Observatii = @observatii,
          versiune = versiune + 1
        WHERE ID_Contract = @contractId
      `;

      const parametriiUpdate = {
        contractId: contractInfo.contractExistentId,
        valoare: contractInfo.sumaOriginala,
        moneda: contractInfo.monedaOriginala,
        cursValutar: cursValutarPrincipal,
        dataCurs: dataCursValutar,
        valoareRon: contractInfo.sumaFinala,
        etape: JSON.stringify(contractInfo.termenePersonalizate || []),
        articoleSuplimentare: JSON.stringify([]),
        continutJson: JSON.stringify(contractInfo.placeholderData),
        observatii: sanitizeStringForBigQuery(contractInfo.observatii)
      };

      const tipuriUpdate = {
        contractId: 'STRING',
        valoare: 'NUMERIC',
        moneda: 'STRING',
        cursValutar: 'NUMERIC',
        dataCurs: 'DATE',
        valoareRon: 'NUMERIC',
        etape: 'STRING',
        articoleSuplimentare: 'STRING',
        continutJson: 'STRING',
        observatii: 'STRING'
      };

      await bigquery.query({
        query: updateQuery,
        params: parametriiUpdate,
        types: tipuriUpdate,
        location: 'EU',
      });
      
    } else {
      const insertQuery = `
        INSERT INTO \`${PROJECT_ID}.PanouControlUnitar.Contracte\`
        (ID_Contract, numar_contract, serie_contract, tip_document, proiect_id, 
         client_id, client_nume, Denumire_Contract, Data_Semnare, Data_Expirare,
         Status, Valoare, Moneda, curs_valutar, data_curs_valutar, valoare_ron,
         etape, articole_suplimentare, data_creare, data_actualizare, 
         continut_json, Observatii, versiune)
        VALUES 
        (@contractId, @numarContract, @serieContract, @tipDocument, @proiectId,
         @clientId, @clientNume, @denumireContract, @dataSemnare, @dataExpirare,
         @status, @valoare, @moneda, @cursValutar, @dataCurs, @valoareRon,
         PARSE_JSON(@etape), PARSE_JSON(@articoleSuplimentare), 
         CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 
         PARSE_JSON(@continutJson), @observatii, @versiune)
      `;

      const parametriiInsert = {
        contractId,
        numarContract: contractInfo.contractData.numar_contract,
        serieContract: sanitizeStringForBigQuery(contractInfo.contractData.serie),
        tipDocument: contractInfo.tipDocument,
        proiectId: contractInfo.proiectId,
        clientId: sanitizeStringForBigQuery(contractInfo.proiect.client_id),
        clientNume: contractInfo.placeholderData.client.nume,
        denumireContract: `Contract ${contractInfo.placeholderData.proiect.denumire}`,
        dataSemnare: dataSemnare,
        dataExpirare: dataExpirare,
        status: 'Generat',
        valoare: contractInfo.sumaOriginala,
        moneda: contractInfo.monedaOriginala,
        cursValutar: cursValutarPrincipal,
        dataCurs: dataCursValutar,
        valoareRon: contractInfo.sumaFinala,
        etape: JSON.stringify(contractInfo.termenePersonalizate || []),
        articoleSuplimentare: JSON.stringify([]),
        continutJson: JSON.stringify(contractInfo.placeholderData),
        observatii: sanitizeStringForBigQuery(contractInfo.observatii),
        versiune: 1
      };

      const tipuriInsert = {
        contractId: 'STRING',
        numarContract: 'STRING',
        serieContract: 'STRING',
        tipDocument: 'STRING',
        proiectId: 'STRING',
        clientId: 'STRING',
        clientNume: 'STRING',
        denumireContract: 'STRING',
        dataSemnare: 'DATE',
        dataExpirare: 'DATE',
        status: 'STRING',
        valoare: 'NUMERIC',
        moneda: 'STRING',
        cursValutar: 'NUMERIC',
        dataCurs: 'DATE',
        valoareRon: 'NUMERIC',
        etape: 'STRING',
        articoleSuplimentare: 'STRING',
        continutJson: 'STRING',
        observatii: 'STRING',
        versiune: 'INT64'
      };

      await bigquery.query({
        query: insertQuery,
        params: parametriiInsert,
        types: tipuriInsert,
        location: 'EU',
      });
    }

    return contractId;
    
  } catch (error) {
    console.error('Eroare la salvarea contractului în BigQuery:', error);
    throw error;
  }
}

// FUNCȚIA PRINCIPALĂ POST - VERSIUNEA FINALĂ CURĂȚATĂ
export async function POST(request: NextRequest) {
  try {
    const {
      proiectId,
      tipDocument = 'contract',
      sablonId,
      termenePersonalizate = [],
      observatii,
      isEdit = false,
      contractExistentId = null,
      contractPreview,
      contractPrefix
    } = await request.json();

    if (!proiectId) {
      return NextResponse.json({ 
        error: 'ID proiect necesar' 
      }, { status: 400 });
    }

    const { proiect, subproiecte } = await loadProiectDataSimple(proiectId);

    const { sumaFinala, monedaFinala, cursuriUtilizate, sumaOriginala, monedaOriginala } = 
      calculeazaSumaContractCuValoriEstimate(proiect, subproiecte, termenePersonalizate);

    let contractData;
    if (isEdit && contractExistentId) {
      if (contractPreview) {
        contractData = {
          numar_contract: contractPreview,
          serie: contractPrefix || 'CONTR',
          setari: { tip_document: tipDocument }
        };
      } else {
        const existingQuery = `
          SELECT numar_contract, serie_contract 
          FROM \`${PROJECT_ID}.PanouControlUnitar.Contracte\`
          WHERE ID_Contract = @contractId
        `;
        
        const [existingRows] = await bigquery.query({
          query: existingQuery,
          params: { contractId: contractExistentId },
          location: 'EU',
        });
        
        if (existingRows.length > 0) {
          contractData = {
            numar_contract: existingRows[0].numar_contract,
            serie: existingRows[0].serie_contract,
            setari: { tip_document: tipDocument }
          };
        } else {
          contractData = await getNextContractNumber(tipDocument, proiectId);
        }
      }
    } else {
      if (contractPreview) {
        contractData = {
          numar_contract: contractPreview,
          serie: contractPrefix || 'CONTR', 
          setari: { tip_document: tipDocument }
        };
      } else {
        contractData = await getNextContractNumber(tipDocument, proiectId);
      }
    }

    const placeholderData = prepareSimpleTemplateData(
      proiect, 
      subproiecte, 
      contractData,
      termenePersonalizate,
      observatii
    );

    let docxBuffer: Buffer;
    let templateUsed = 'fallback';

    try {
      const templatePath = await findBestTemplate(tipDocument);
      
      if (templatePath) {
        templateUsed = path.basename(templatePath);
        
        const { access } = await import('fs/promises');
        await access(templatePath);
        
        if (templatePath.endsWith('.docx')) {
          docxBuffer = await processDocxTemplate(templatePath, placeholderData);
        } else if (templatePath.endsWith('.txt')) {
          const processedText = await processTextTemplate(templatePath, placeholderData);
          docxBuffer = await convertTextToDocx(processedText);
        } else {
          throw new Error(`Tip template nepermis: ${path.extname(templatePath)}`);
        }
      } else {
        const fallbackTemplate = await createFallbackTemplate(placeholderData);
        docxBuffer = await convertTextToDocx(fallbackTemplate);
        templateUsed = 'fallback-no-template-found';
      }
    } catch (templateError) {
      const fallbackTemplate = await createFallbackTemplate(placeholderData);
      docxBuffer = await convertTextToDocx(fallbackTemplate);
      templateUsed = `fallback-error`;
    }

    const contractId = await salveazaContractCuDateCorecte({
      proiectId,
      tipDocument,
      contractData,
      placeholderData,
      sumaOriginala: sumaNumericaPentruBD,
      monedaOriginala: monedaFinala === 'MULTIPLE' ? 'MULTIPLE' : monedaOriginala,
      sumaFinala,
      cursuriUtilizate,
      observatii,
      termenePersonalizate,
      templateUsed,
      isEdit,
      contractExistentId,
      proiect
    });

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${contractData.numar_contract}.docx"`,
        'X-Contract-Id': contractId,
        'X-Contract-Number': contractData.numar_contract,
        'X-Template-Used': templateUsed,
        'X-Action': isEdit ? 'updated' : 'generated'
      }
    });

  } catch (error) {
    console.error('Eroare la generarea/actualizarea contractului:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
