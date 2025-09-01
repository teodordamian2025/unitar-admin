// ==================================================================
// CALEA: app/api/actions/contracts/generate/route.ts
// DATA: 01.09.2025 20:00 (ora României)
// FIX PRINCIPAL: Suport pentru noua structură de termeni cu valorile valutare + preview personalizat
// PĂSTRATE: Toate funcționalitățile existente + JOIN corect cu Clienti
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

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper pentru conversie BigQuery NUMERIC (PĂSTRAT)
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const numericValue = parseFloat(String(value.value)) || 0;
    return numericValue;
  }
  
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  return 0;
};

// Helper pentru formatarea datelor pentru BigQuery (PĂSTRAT)
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

// Helper pentru formatarea datelor pentru afișare (PĂSTRAT)
const formatDate = (date?: string | { value: string }): string => {
  if (!date) return '';
  const dateValue = typeof date === 'string' ? date : date.value;
  try {
    return new Date(dateValue).toLocaleDateString('ro-RO');
  } catch {
    return '';
  }
};

// Helper pentru sanitizarea string-urilor (PĂSTRAT)
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

// Calculare durată în zile (PĂSTRAT)
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

// OPTIMIZAT: Procesarea placeholder-urilor cu suport pentru noua structură de termeni
function processPlaceholders(text: string, data: any): string {
  let processed = text;
  
  console.log('🔄 TEMPLATE PROCESSING DEBUG:', {
    has_client_data: !!data.client,
    client_nume: data.client?.nume,
    client_cui: data.client?.cui,
    client_adresa: data.client?.adresa,
    contract_numar: data.contract?.numar,
    proiect_denumire: data.proiect?.denumire,
    suma_originala: data.suma_totala_originala,
    moneda_originala: data.moneda_originala
  });
  
  // Înlocuiri simple cu valorile estimate consistente (PĂSTRAT)
  const simpleReplacements: { [key: string]: string } = {
    // Contract info
    '{{contract.numar}}': data.contract?.numar || 'Contract-NR-TBD',
    '{{contract.data}}': data.contract?.data || new Date().toLocaleDateString('ro-RO'),
    
    // Client info cu fallback-uri multiple
    '{{client.nume}}': data.client?.nume || data.client?.denumire || 'CLIENT NECUNOSCUT',
    '{{client.cui}}': data.client?.cui || 'CUI NECUNOSCUT',
    '{{client.nr_reg_com}}': data.client?.nr_reg_com || 'NR REG COM NECUNOSCUT',
    '{{client.adresa}}': data.client?.adresa || 'ADRESA NECUNOSCUTA',
    '{{client.telefon}}': data.client?.telefon || '',
    '{{client.email}}': data.client?.email || '',
    '{{client.reprezentant}}': data.client?.reprezentant || 'Administrator',
    
    // Proiect info cu valorile estimate originale CONSISTENTE
    '{{proiect.denumire}}': data.proiect?.denumire || 'PROIECT NECUNOSCUT',
    '{{proiect.descriere}}': data.proiect?.descriere || '',
    '{{proiect.adresa}}': data.proiect?.adresa || '',
    '{{proiect.valoare}}': data.suma_totala_originala || data.proiect?.valoare_originala?.toFixed(2) || '0.00',
    '{{proiect.moneda}}': data.moneda_originala || data.proiect?.moneda || 'RON',
    '{{proiect.data_start}}': data.proiect?.data_start || 'TBD',
    '{{proiect.data_final}}': data.proiect?.data_final || 'TBD',
    '{{proiect.responsabil}}': data.proiect?.responsabil || '',
    '{{proiect.durata_zile}}': data.proiect?.durata_zile || 'TBD',
    
    // Firma info (PĂSTRAT)
    '{{firma.nume}}': data.firma?.nume || 'UNITAR PROIECT TDA SRL',
    '{{firma.cui}}': data.firma?.cui || 'RO35639210',
    '{{firma.nr_reg_com}}': data.firma?.nr_reg_com || 'J2016002024405',
    '{{firma.adresa}}': data.firma?.adresa || 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
    '{{firma.telefon}}': data.firma?.telefon || '0765486044',
    '{{firma.email}}': data.firma?.email || 'contact@unitarproiect.eu',
    '{{firma.cont_ing}}': data.firma?.cont_ing || 'RO82INGB0000999905667533',
    '{{firma.cont_trezorerie}}': data.firma?.cont_trezorerie || 'RO29TREZ7035069XXX018857',
    
    // OPTIMIZAT: Suma totală cu valorile estimate consistente
    '{{suma_totala_ron}}': data.suma_totala_ron || '0.00',
    '{{suma_totala_originala}}': data.suma_totala_originala || '0.00',
    '{{moneda_originala}}': data.moneda_originala || 'RON',
    '{{observatii}}': data.observatii || ''
  };
  
  // Aplică înlocuirile simple
  for (const [placeholder, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    const beforeCount = (processed.match(regex) || []).length;
    processed = processed.replace(regex, value);
    
    if (beforeCount > 0) {
      console.log(`🔄 REPLACED: ${placeholder} -> "${value}" (${beforeCount} occurrences)`);
    }
  }
  
  // Procesează liste complexe
  processed = processListPlaceholders(processed, data);
  
  // Procesează secțiuni condiționale
  processed = processConditionalSections(processed, data);
  
  return processed;
}

// OPTIMIZAT: Procesează placeholder-uri pentru liste cu noua structură de termeni
function processListPlaceholders(text: string, data: any): string {
  let processed = text;
  
  console.log('📋 LIST PROCESSING DEBUG:', {
    subproiecte_count: data.subproiecte?.length || 0,
    articole_count: data.articole_suplimentare?.length || 0,
    termene_count: data.termene_personalizate?.length || 0
  });
  
  // Procesează subproiecte cu valorile estimate originale (PĂSTRAT)
  if (data.subproiecte && Array.isArray(data.subproiecte) && data.subproiecte.length > 0) {
    const subproiecteList = data.subproiecte.map((sub: any, index: number) => {
      const valoare = sub.valoare_originala || sub.valoare || 0;
      const moneda = sub.moneda || 'RON';
      return `- ${sub.denumire}: ${valoare.toFixed(2)} ${moneda}`;
    }).join('\n');
    
    console.log('🔄 Subproiecte list generated:', subproiecteList);
    
    processed = processed.replace(/{{#subproiecte}}[\s\S]*?{{\/subproiecte}}/g, 
      `**Componente proiect:**\n${subproiecteList}`);
    processed = processed.replace(/{{#subproiecte\.lista}}[\s\S]*?{{\/subproiecte\.lista}}/g, subproiecteList);
  } else {
    processed = processed.replace(/{{#subproiecte}}[\s\S]*?{{\/subproiecte}}/g, '');
  }
  
  // Procesează articole suplimentare cu monedele originale (PĂSTRAT)
  if (data.articole_suplimentare && Array.isArray(data.articole_suplimentare) && data.articole_suplimentare.length > 0) {
    const articoleList = data.articole_suplimentare.map((art: any, index: number) => 
      `- ${art.descriere}: ${art.valoare?.toFixed(2) || '0.00'} ${art.moneda || 'RON'}`
    ).join('\n');
    
    console.log('🛒 Articole list generated:', articoleList);
    
    processed = processed.replace(/{{#articole_suplimentare}}[\s\S]*?{{\/articole_suplimentare}}/g, 
      `**Servicii suplimentare:**\n${articoleList}`);
    processed = processed.replace(/{{#articole_suplimentare\.lista}}[\s\S]*?{{\/articole_suplimentare\.lista}}/g, articoleList);
  } else {
    processed = processed.replace(/{{#articole_suplimentare}}[\s\S]*?{{\/articole_suplimentare}}/g, '');
  }
  
  // OPTIMIZAT: Procesează termene personalizate cu noua structură (valorile valutare)
  if (data.termene_personalizate && Array.isArray(data.termene_personalizate) && data.termene_personalizate.length > 0) {
    const termeneList = data.termene_personalizate.map((termen: any, index: number) => {
      // FIX PRINCIPAL: Folosește valorile din structura nouă (valoare + moneda) în loc de procent_plata
      const valoareTermen = termen.valoare || 0;
      const valoareRON = termen.valoare_ron || 0;
      const monedaTermen = termen.moneda || 'RON';
      
      // Calculează procentul din suma totală pentru afișare
      const sumaTotal = parseFloat(data.suma_totala_ron) || 0;
      const procentCalculat = sumaTotal > 0 ? Math.round((valoareRON / sumaTotal) * 100) : 0;
      
      return `**Etapa ${index + 1}**: ${procentCalculat}% (${valoareTermen.toFixed(2)} ${monedaTermen}) - ${termen.denumire} (termen: ${termen.termen_zile} zile)`;
    }).join('\n');
    
    console.log('💰 Termene list generated cu noua structură:', termeneList);
    
    processed = processed.replace(/{{#termene_personalizate}}[\s\S]*?{{\/termene_personalizate}}/g, termeneList);
    processed = processed.replace(/{{#termene_personalizate\.lista}}[\s\S]*?{{\/termene_personalizate\.lista}}/g, termeneList);
  } else {
    // Template default cu valorile estimate (PĂSTRAT)
    const valoareBaza = parseFloat(data.suma_totala_originala) || data.proiect?.valoare_originala || 0;
    const monedaBaza = data.moneda_originala || 'RON';
    const defaultTermene = `**Etapa 1**: 100% (${valoareBaza.toFixed(2)} ${monedaBaza}) - La predarea proiectului (termen: 60 zile)`;
    
    console.log('💰 Default termene generated:', defaultTermene);
    
    processed = processed.replace(/{{#termene_personalizate}}[\s\S]*?{{\/termene_personalizate}}/g, defaultTermene);
    processed = processed.replace(/{{#termene_personalizate\.lista}}[\s\S]*?{{\/termene_personalizate\.lista}}/g, defaultTermene);
  }
  
  return processed;
}

// Funcția pentru secțiuni condiționale (PĂSTRATĂ)
function processConditionalSections(text: string, data: any): string {
  let processed = text;
  
  const conditionalSections = [
    { tag: 'proiect.descriere', value: data.proiect?.descriere },
    { tag: 'proiect.adresa', value: data.proiect?.adresa },
    { tag: 'proiect.responsabil', value: data.proiect?.responsabil },
    { tag: 'client.telefon', value: data.client?.telefon },
    { tag: 'observatii', value: data.observatii }
  ];
  
  conditionalSections.forEach(section => {
    const regex = new RegExp(`{{#${section.tag}}}([\\s\\S]*?){{/${section.tag}}}`, 'g');
    if (section.value && section.value.trim()) {
      processed = processed.replace(regex, '$1');
    } else {
      processed = processed.replace(regex, '');
    }
  });
  
  return processed;
}

// Funcții pentru template processing (PĂSTRATE)
async function processDocxTemplate(templatePath: string, data: any): Promise<Buffer> {
  try {
    const templateBuffer = await readFile(templatePath);
    const zip = new JSZip();
    
    await zip.loadAsync(templateBuffer);
    
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('document.xml nu a fost gasit in template DOCX');
    }
    
    const processedXml = processPlaceholdersInXml(documentXml, data);
    
    zip.file('word/document.xml', processedXml);
    
    return await zip.generateAsync({ type: 'nodebuffer' });
    
  } catch (error) {
    console.error('Eroare la procesarea template-ului DOCX:', error);
    throw error;
  }
}

function processPlaceholdersInXml(xml: string, data: any): string {
  const textContent = xml.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (match, content) => {
    const processed = processPlaceholders(content, data);
    return match.replace(content, processed);
  });
  
  return textContent;
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

function convertTextToWordXml(text: string): string {
  const paragraphs = text.split('\n').map(line => {
    if (line.trim() === '') {
      return '<w:p/>';
    }
    
    if (line.includes('**') && line.includes('**')) {
      const boldText = line.replace(/\*\*(.*?)\*\*/g, '<w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>$1</w:t></w:r>');
      return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${boldText}</w:p>`;
    }
    
    const cleanText = line.replace(/\*\*(.*?)\*\*/g, '<w:r><w:rPr><w:b/></w:rPr><w:t>$1</w:t></w:r>');
    return `<w:p><w:r><w:t>${cleanText}</w:t></w:r></w:p>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
  </w:body>
</w:document>`;
}

// OPTIMIZAT: Calculează suma cu noua structură de termeni (valorile valutare)
function calculeazaSumaContractCuValoriEstimate(proiect: any, subproiecte: any[], articoleSuplimentare: any[], termenePersonalizate: any[]) {
  let sumaOriginala = 0;
  let monedaOriginala = proiect.moneda || 'RON';
  let sumaFinalaRON = 0;
  const cursuriUtilizate: { [moneda: string]: number } = {};

  console.log('💰 CALCUL SUMA CONTRACT cu noua structură:', {
    proiect_valoare: proiect.Valoare_Estimata,
    proiect_moneda: proiect.moneda,
    subproiecte_count: subproiecte.length,
    articole_count: articoleSuplimentare.length,
    termene_count: termenePersonalizate.length
  });

  // FIX PRINCIPAL: Pentru proiecte cu subproiecte convertite în termeni, calculează din termeni
  if (termenePersonalizate.length > 0 && termenePersonalizate.some((t: any) => t.este_subproiect)) {
    console.log('Calculez suma din termeni (subproiecte convertite)...');
    
    termenePersonalizate.forEach(termen => {
      const valoareOriginala = termen.valoare || 0;
      const valoareRON = termen.valoare_ron || valoareOriginala;
      const monedaTermen = termen.moneda || 'RON';
      
      sumaOriginala += valoareOriginala;
      sumaFinalaRON += valoareRON;
      
      console.log(`Termen ${termen.denumire}: ${valoareOriginala} ${monedaTermen} = ${valoareRON} RON`);
      
      if (monedaTermen && monedaTermen !== 'RON') {
        cursuriUtilizate[monedaTermen] = termen.curs_valutar || 1;
        // Setează moneda originală la prima monedă non-RON găsită
        if (monedaOriginala === 'RON') {
          monedaOriginala = monedaTermen;
        }
      }
    });
    
    console.log(`Proiect cu ${termenePersonalizate.length} termeni - suma originală: ${sumaOriginala} ${monedaOriginala}, suma RON: ${sumaFinalaRON}`);
  } 
  // Fallback: calculează din subproiecte dacă nu există termeni
  else if (subproiecte.length > 0) {
    console.log('Calculez suma din subproiecte (fallback)...');
    
    subproiecte.forEach(sub => {
      const valoareOriginala = convertBigQueryNumeric(sub.Valoare_Estimata) || 0;
      const valoareRON = convertBigQueryNumeric(sub.valoare_ron) || valoareOriginala;
      const monedaSub = sub.moneda || 'RON';
      
      sumaOriginala += valoareOriginala;
      sumaFinalaRON += valoareRON;
      
      console.log(`Subproiect ${sub.Denumire}: ${valoareOriginala} ${monedaSub} = ${valoareRON} RON`);
      
      if (monedaSub && monedaSub !== 'RON') {
        cursuriUtilizate[monedaSub] = convertBigQueryNumeric(sub.curs_valutar) || 1;
        if (monedaOriginala === 'RON') {
          monedaOriginala = monedaSub;
        }
      }
    });
  } else {
    // Pentru proiecte fără subproiecte
    sumaOriginala = convertBigQueryNumeric(proiect.Valoare_Estimata) || 0;
    sumaFinalaRON = convertBigQueryNumeric(proiect.valoare_ron) || sumaOriginala;
    monedaOriginala = proiect.moneda || 'RON';
    
    if (proiect.moneda && proiect.moneda !== 'RON') {
      cursuriUtilizate[proiect.moneda] = convertBigQueryNumeric(proiect.curs_valutar) || 1;
    }
    
    console.log(`Proiect fără subproiecte - suma originală: ${sumaOriginala} ${monedaOriginala} = ${sumaFinalaRON} RON`);
  }

  // Adaugă articolele suplimentare (PĂSTRAT)
  articoleSuplimentare.forEach(articol => {
    const valoareArticol = convertBigQueryNumeric(articol.valoare);
    let valoareRON = valoareArticol;
    
    if (articol.moneda && articol.moneda !== 'RON') {
      const cursArticol = cursuriUtilizate[articol.moneda] || 
                          (articol.moneda === 'EUR' ? 5.0683 : 
                           articol.moneda === 'USD' ? 4.3688 : 
                           articol.moneda === 'GBP' ? 5.8777 : 1);
      
      valoareRON = valoareArticol * cursArticol;
      cursuriUtilizate[articol.moneda] = cursArticol;
    }
    
    if (articol.moneda === monedaOriginala) {
      sumaOriginala += valoareArticol;
    }
    
    sumaFinalaRON += valoareRON;
  });

  console.log('💰 SUMA FINALĂ CALCULATĂ:', {
    sumaOriginala,
    monedaOriginala, 
    sumaFinalaRON,
    cursuriUtilizate
  });

  return { 
    sumaFinala: sumaFinalaRON, 
    monedaFinala: 'RON', 
    cursuriUtilizate,
    sumaOriginala,
    monedaOriginala
  };
}

// OPTIMIZAT: Pregătește datele cu noua structură de termeni
function prepareazaPlaceholderDataCuValoriEstimate(
  proiect: any, 
  subproiecte: any[], 
  sumaOriginala: number,
  monedaOriginala: string,
  contractData: any,
  termene: any[],
  articole: any[],
  observatii?: string
) {
  const dataContract = new Date().toLocaleDateString('ro-RO');
  const durataZile = calculateDurationInDays(proiect.Data_Start, proiect.Data_Final);
  
  const cursProiect = convertBigQueryNumeric(proiect.curs_valutar) || 1;
  const sumaRON = monedaOriginala !== 'RON' ? (sumaOriginala * cursProiect).toFixed(2) : sumaOriginala.toFixed(2);
  
  // Debug logging pentru client data (PĂSTRAT)
  console.log('🔍 CLIENT DATA DEBUG:', {
    proiect_client_original: proiect.Client,
    proiect_client_id: proiect.client_id,
    proiect_client_nume: proiect.client_nume,
    proiect_client_cui: proiect.client_cui,
    proiect_client_adresa: proiect.client_adresa,
    toate_keys: Object.keys(proiect).filter(k => k.includes('client'))
  });
  
  return {
    // Date contract
    contract: {
      numar: contractData.numar_contract,
      data: dataContract,
      tip: contractData.setari?.tip_document || 'contract'
    },
    
    // Date client complete din JOIN BigQuery (PĂSTRAT)
    client: {
      nume: proiect.client_nume || proiect.Client || 'Client necunoscut',
      denumire: proiect.client_nume || proiect.Client || 'Client necunoscut',
      cui: proiect.client_cui || 'CUI necunoscut',
      nr_reg_com: proiect.client_reg_com || 'Nr. reg. com. necunoscut',
      adresa: proiect.client_adresa || 'Adresa necunoscuta',
      judet: proiect.client_judet || '',
      oras: proiect.client_oras || '',
      telefon: proiect.client_telefon || '',
      email: proiect.client_email || '',
      reprezentant: 'Administrator',
      id: proiect.client_id || null
    },
    
    // Date proiect cu valorile estimate originale și durata calculată (PĂSTRAT)
    proiect: {
      id: proiect.ID_Proiect,
      denumire: proiect.Denumire,
      descriere: proiect.Descriere || '',
      adresa: proiect.Adresa || '',
      valoare: sumaOriginala,
      valoare_originala: sumaOriginala,
      moneda: monedaOriginala,
      data_start: formatDate(proiect.Data_Start),
      data_final: formatDate(proiect.Data_Final),
      durata_zile: durataZile,
      responsabil: proiect.Responsabil || ''
    },
    
    // Date firma UNITAR (PĂSTRAT)
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
    
    // OPTIMIZAT: Subproiecte cu valorile estimate originale
    subproiecte: subproiecte.map(sub => ({
      denumire: sub.Denumire,
      valoare: convertBigQueryNumeric(sub.Valoare_Estimata) || 0,
      valoare_originala: convertBigQueryNumeric(sub.Valoare_Estimata) || 0,
      moneda: sub.moneda || 'RON',
      status: sub.Status
    })),
    
    articole_suplimentare: articole,
    
    // FIX PRINCIPAL: Termene cu noua structură (valorile valutare)
    termene_personalizate: termene,
    
    // Observații și metadate cu valorile estimate și RON
    observatii: observatii || '',
    data_generare: new Date().toISOString(),
    suma_totala_originala: sumaOriginala.toFixed(2),
    suma_totala_ron: sumaRON,
    moneda_originala: monedaOriginala
  };
}

async function createFallbackTemplate(data: any): Promise<string> {
  return `**CONTRACT DE SERVICII**

**NR. ${data.contract?.numar} din ${data.contract?.data}**

**CAP.I. PARTI CONTRACTANTE**

1. Intre ${data.client?.nume}, persoana juridica romana, cu sediul in ${data.client?.adresa}, inmatriculata la Oficiul Registrului Comertului sub nr. ${data.client?.nr_reg_com}, C.U.I. ${data.client?.cui}, reprezentata prin ${data.client?.reprezentant} denumita in continuare **BENEFICIAR**

Si

2. **S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social in ${data.firma?.adresa}, avand CIF ${data.firma?.cui} si nr. de inregistrare la Registrul Comertului ${data.firma?.nr_reg_com}, avand contul IBAN: ${data.firma?.cont_ing}, deschis la banca ING, si cont Trezorerie IBAN: ${data.firma?.cont_trezorerie}, e-mail: ${data.firma?.email}, reprezentata legal de Damian Teodor, in calitate de Administrator, numita in continuare **PRESTATOR**.

**CAP. II. OBIECTUL CONTRACTULUI**

Obiectul contractului il reprezinta:

Realizare ${data.proiect?.denumire}

${data.proiect?.descriere ? `Descriere detaliata: ${data.proiect.descriere}` : ''}
${data.proiect?.adresa ? `Adresa executie: ${data.proiect.adresa}` : ''}

${data.subproiecte && data.subproiecte.length > 0 ? `
**Componente proiect:**
${data.subproiecte.map((sub: any) => `- ${sub.denumire}: ${sub.valoare_originala?.toFixed(2)} ${sub.moneda}`).join('\n')}
` : ''}

${data.articole_suplimentare && data.articole_suplimentare.length > 0 ? `
**Servicii suplimentare:**
${data.articole_suplimentare.map((art: any) => `- ${art.descriere}: ${art.valoare} ${art.moneda}`).join('\n')}
` : ''}

**CAP.III. DURATA CONTRACTULUI:**

1. Contractul se incheie pe o perioada determinata, cu urmatoarele termene:
- Data inceput: ${data.proiect?.data_start}
- Data finalizare: ${data.proiect?.data_final}
- Durata estimata: ${data.proiect?.durata_zile} zile

**CAP. IV. PRETUL DE EXECUTARE AL LUCRARII**

1. Pretul pe care Beneficiarul il datoreaza prestatorului pentru serviciile sale este de **${data.suma_totala_originala} ${data.moneda_originala}** la care se aplica suplimentar TVA${data.moneda_originala !== 'RON' ? ', platiti in lei la cursul BNR din ziua facturarii' : ''}.

**Valoarea totala contract: ${data.suma_totala_originala} ${data.moneda_originala}${data.moneda_originala !== 'RON' ? ` (${data.suma_totala_ron} RON)` : ''}**

Platile vor fi realizate in modul urmator:

${data.termene_personalizate && data.termene_personalizate.length > 0 ? 
  data.termene_personalizate.map((termen: any, index: number) => {
    // FIX PRINCIPAL: Folosește valorile din noua structură
    const valoareTermen = termen.valoare || 0;
    const monedaTermen = termen.moneda || 'RON';
    const valoareRON = termen.valoare_ron || valoareTermen;
    
    // Calculează procentul
    const sumaTotal = parseFloat(data.suma_totala_ron) || 0;
    const procentCalculat = sumaTotal > 0 ? Math.round((valoareRON / sumaTotal) * 100) : 0;
    
    return `**Etapa ${index + 1}**: ${procentCalculat}% (${valoareTermen.toFixed(2)} ${monedaTermen}) - ${termen.denumire} (termen: ${termen.termen_zile} zile)`;
  }).join('\n') : 
  `**Etapa 1**: 100% (${data.suma_totala_originala} ${data.moneda_originala || 'RON'}) - La predarea proiectului (termen: 60 zile)`
}

**SEMNAT IN DATA: ${data.contract?.data}**

| BENEFICIAR | PRESTATOR |
|------------|-----------|
| **${data.client?.nume}** | **S.C. UNITAR PROIECT TDA S.R.L.** |
| ${data.client?.reprezentant} | **DAMIAN TEODOR** |
| ................................. | ................................. |
`;
}

// Funcția pentru salvarea contractului (OPTIMIZATĂ pentru noua structură)
async function salveazaContractCuDateCorecte(contractInfo: any): Promise<string> {
  const contractId = contractInfo.isEdit && contractInfo.contractExistentId 
    ? contractInfo.contractExistentId 
    : `CONTR_${contractInfo.proiectId}_${Date.now()}`;
  
  try {
    console.log('Salvare contract cu date corecte și noua structură:', {
      contractId,
      isEdit: contractInfo.isEdit,
      client_id: contractInfo.proiect.client_id,
      client_nume: contractInfo.placeholderData.client.nume,
      valoare_originala: contractInfo.sumaOriginala,
      moneda_originala: contractInfo.monedaOriginala,
      termene_count: contractInfo.termenePersonalizate?.length || 0
    });

    const dataStart = contractInfo.proiect.Data_Start;
    const dataFinal = contractInfo.proiect.Data_Final;
    
    const dataSemnare = formatDateForBigQuery(new Date().toISOString().split('T')[0]);
    const dataExpirare = formatDateForBigQuery(
      typeof dataFinal === 'object' && dataFinal.value ? dataFinal.value : 
      typeof dataFinal === 'string' ? dataFinal : null
    );

    if (contractInfo.isEdit && contractInfo.contractExistentId) {
      // UPDATE pentru contractul existent cu noua structură
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
        cursValutar: contractInfo.monedaOriginala !== 'RON' ? 
          (contractInfo.cursuriUtilizate[contractInfo.monedaOriginala] || null) : null,
        dataCurs: contractInfo.monedaOriginala !== 'RON' ? 
          formatDateForBigQuery(new Date().toISOString().split('T')[0]) : null,
        valoareRon: contractInfo.sumaFinala,
        etape: JSON.stringify(contractInfo.termenePersonalizate || []),
        articoleSuplimentare: JSON.stringify(contractInfo.articoleSuplimentare || []),
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

      console.log(`Contract actualizat în BigQuery: ${contractInfo.contractExistentId}`);
      
    } else {
      // INSERT pentru contract nou cu noua structură
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
        cursValutar: contractInfo.monedaOriginala !== 'RON' ? 
          (contractInfo.cursuriUtilizate[contractInfo.monedaOriginala] || null) : null,
        dataCurs: contractInfo.monedaOriginala !== 'RON' ? 
          formatDateForBigQuery(new Date().toISOString().split('T')[0]) : null,
        valoareRon: contractInfo.sumaFinala,
        etape: JSON.stringify(contractInfo.termenePersonalizate || []),
        articoleSuplimentare: JSON.stringify(contractInfo.articoleSuplimentare || []),
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

      console.log(`Contract nou salvat în BigQuery: ${contractId}`);
    }

    return contractId;
    
  } catch (error) {
    console.error('Eroare la salvarea contractului în BigQuery:', error);
    console.error('Detalii parametri:', {
      contractId,
      proiectId: contractInfo.proiectId,
      isEdit: contractInfo.isEdit,
      error: error instanceof Error ? error.message : 'Eroare necunoscuta'
    });
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      proiectId,
      tipDocument = 'contract',
      sablonId,
      termenePersonalizate = [],
      articoleSuplimentare = [],
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

    console.log(`${isEdit ? 'Actualizare' : 'Generare'} contract pentru proiect: ${proiectId}`);
    console.log('Contract preview primit:', contractPreview);
    console.log('FIX PRINCIPAL: Termene cu noua structură:', termenePersonalizate.length);

    // Query cu JOIN corect pentru client_id și date complete (PĂSTRAT)
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
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
      WHERE p.ID_Proiect = @proiectId
    `;

    const [projectRows] = await bigquery.query({
      query: projectQuery,
      params: { proiectId },
      location: 'EU',
    });

    if (projectRows.length === 0) {
      return NextResponse.json({ 
        error: 'Proiectul nu a fost gasit' 
      }, { status: 404 });
    }

    const proiect = projectRows[0];
    console.log('Proiect încărcat cu client_id:', {
      proiect_id: proiect.ID_Proiect,
      client_nume: proiect.client_nume || proiect.Client,
      client_id: proiect.client_id,
      has_client_data: !!proiect.client_cui
    });

    // Preia subproiectele (PĂSTRAT)
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

    // OPTIMIZAT: Calculează suma cu noua structură de termeni
    const { sumaFinala, monedaFinala, cursuriUtilizate, sumaOriginala, monedaOriginala } = 
      calculeazaSumaContractCuValoriEstimate(proiect, subproiecteRows, articoleSuplimentare, termenePersonalizate);

    // OPTIMIZAT: Generează numărul contractului cu suport pentru preview personalizat
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

    // OPTIMIZAT: Pregătește datele cu noua structură de termeni
    const placeholderData = prepareazaPlaceholderDataCuValoriEstimate(
      proiect, 
      subproiecteRows, 
      sumaOriginala,
      monedaOriginala,
      contractData,
      termenePersonalizate,
      articoleSuplimentare,
      observatii
    );

    // Găsește și procesează template-ul (PĂSTRAT)
    let docxBuffer: Buffer;
    let templateUsed = 'fallback';

    try {
      const templatePath = await findBestTemplate(tipDocument);
      
      if (templatePath) {
        console.log(`Template gasit: ${templatePath}`);
        templateUsed = path.basename(templatePath);
        
        if (templatePath.endsWith('.docx')) {
          docxBuffer = await processDocxTemplate(templatePath, placeholderData);
        } else if (templatePath.endsWith('.txt')) {
          const processedText = await processTextTemplate(templatePath, placeholderData);
          docxBuffer = await convertTextToDocx(processedText);
        } else {
          throw new Error('Tip template nepermis');
        }
      } else {
        console.log('Niciun template gasit, folosesc fallback');
        const fallbackTemplate = await createFallbackTemplate(placeholderData);
        docxBuffer = await convertTextToDocx(fallbackTemplate);
      }
    } catch (templateError) {
      console.error('Eroare la procesarea template-ului:', templateError);
      console.log('Folosesc template fallback');
      
      const fallbackTemplate = await createFallbackTemplate(placeholderData);
      docxBuffer = await convertTextToDocx(fallbackTemplate);
      templateUsed = 'fallback-error';
    }

    // Salvează în BigQuery cu toate datele corecte (OPTIMIZAT)
    const contractId = await salveazaContractCuDateCorecte({
      proiectId,
      tipDocument,
      contractData,
      placeholderData,
      sumaOriginala,
      monedaOriginala,
      sumaFinala,
      cursuriUtilizate,
      observatii,
      termenePersonalizate,
      articoleSuplimentare,
      templateUsed,
      isEdit,
      contractExistentId,
      proiect
    });

    console.log(`Contract ${isEdit ? 'actualizat' : 'generat'} cu succes: ${contractData.numar_contract}`);

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
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
