// ==================================================================
// CALEA: app/api/actions/contracts/generate/route.ts
// DATA: 14.01.2025 10:45 (ora României)
// MODIFICAT: Adăugat suport pentru numărul contract editabil (customContractNumber)
// PĂSTRATE: Toate funcționalitățile existente + logica EtapeContract integrală
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
// MODIFICAT: Funcția pentru numerotare - acceptă acum parametru pentru număr custom
import { getNextContractNumber } from '@/app/api/setari/contracte/route';
// NOU: Helper pentru inserarea ștampilei în documentele DOCX
import {
  loadStampilaImage,
  generateImageRelationshipXml,
  generateContentTypesWithImage,
  hasStampilaPlaceholder,
  replaceStampilaPlaceholderWithMarker,
  replaceStampilaMarkerWithDrawing
} from '@/lib/docx-image-helper';

const PROJECT_ID = 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'contracte', 'templates');

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_CONTRACTE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_CLIENTI = `\`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;
const TABLE_ANEXE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.AnexeContract${tableSuffix}\``;

console.log(`🔧 Contract Generate API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Contracte${tableSuffix}, Proiecte${tableSuffix}, Clienti${tableSuffix}, Subproiecte${tableSuffix}, EtapeContract${tableSuffix}, AnexeContract${tableSuffix}`);

// Cursuri valutare pentru conversii - PĂSTRAT identic
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

// NOUĂ FUNCȚIE: Validează numărul contract custom
async function validateCustomContractNumber(numarCustom: string, contractIdExistent?: string): Promise<{valid: boolean, error?: string}> {
  try {
    console.log(`[CONTRACT-VALIDATE] Validez numărul custom: ${numarCustom}`);
    
    // Verifică unicitatea în BigQuery
    let duplicateQuery = `
      SELECT ID_Contract, numar_contract
      FROM ${TABLE_CONTRACTE}
      WHERE numar_contract = @numarCustom
    `;

    const params: any = { numarCustom: numarCustom.trim() };
    const types: any = { numarCustom: 'STRING' };

    // Exclude contractul curent dacă e editare
    if (contractIdExistent) {
      duplicateQuery += ' AND ID_Contract != @contractIdExistent';
      params.contractIdExistent = contractIdExistent;
      types.contractIdExistent = 'STRING';
    }

    const [duplicateRows] = await bigquery.query({
      query: duplicateQuery,
      params,
      types,
      location: 'EU',
    });

    if (duplicateRows.length > 0) {
      const existingContract = duplicateRows[0];
      return {
        valid: false,
        error: `Numărul ${numarCustom} există deja pentru contractul ${existingContract.ID_Contract}`
      };
    }

    console.log(`[CONTRACT-VALIDATE] ✅ Numărul ${numarCustom} este valid și unic`);
    return { valid: true };

  } catch (error) {
    console.error('[CONTRACT-VALIDATE] Eroare la validarea numărului custom:', error);
    return {
      valid: false,
      error: 'Eroare la verificarea numărului în sistem'
    };
  }
}

// TOATE HELPER-urile PĂSTRATE identic
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

// MODIFICAT: Procesarea placeholder-urilor pentru contract cu corectare procente
function processPlaceholders(text: string, data: any): string {
  let processed = text;
  
  // PROCESARE TERMENE PERSONALIZATE ÎNAINTE DE TOATE CELELALTE - CORECTARE PROCENTE
  let termeneText = '';
  if (data.termene_personalizate && Array.isArray(data.termene_personalizate) && data.termene_personalizate.length > 0) {
    // CORECTARE: Calculează suma totală pentru procente corecte
    const sumaTotala = data.termene_personalizate.reduce((sum: number, termen: any) => sum + (termen.valoare_ron || termen.valoare || 0), 0);
    
    termeneText = data.termene_personalizate.map((termen: any, index: number) => {
      const valoareRON = termen.valoare_ron || termen.valoare || 0;
      // CORECTARE: Calculează procentul corect din suma totală
      const procentCorect = sumaTotala > 0 ? ((valoareRON / sumaTotala) * 100) : 0;
      
      const etapaString = `**Etapa ${index + 1}**: ${procentCorect.toFixed(1)}% (${(termen.valoare || 0).toFixed(2)} ${termen.moneda || 'RON'}) - ${termen.denumire || 'Fără denumire'} (termen: ${termen.termen_zile || 30} zile)`;
      return etapaString;
    }).join('\n\n');
  } else {
    termeneText = `**Etapa 1**: 100.0% (${data.suma_totala_originala || '0.00'} ${data.moneda_originala || 'RON'}) - La predarea proiectului (termen: 60 zile)`;
  }

  processed = processed.replace('{{termene_personalizate}}', termeneText);
  
  // ÎNLOCUIRI SIMPLE DIRECTE - PĂSTRATE identic
  const simpleReplacements: { [key: string]: string } = {
    // Contract info
    '{{contract.numar}}': data.contract?.numar || 'Contract-NR-TBD',
    '{{contract.data}}': data.contract?.data || new Date().toLocaleDateString('ro-RO'),
    
    // Client info
    '{{client.nume}}': data.client?.nume || data.client?.denumire || 'CLIENT NECUNOSCUT',
    '{{client.cui}}': data.client?.cui || 'CUI NECUNOSCUT',
    '{{client.nr_reg_com}}': data.client?.nr_reg_com || 'NR REG COM NECUNOSCUT',
    '{{client.adresa}}': data.client?.adresa || 'ADRESA NECUNOSCUTA',
    '{{client.telefon}}': (typeof data.client?.telefon === 'string' ? data.client.telefon : '') || '',
    '{{client.email}}': (typeof data.client?.email === 'string' ? data.client.email : '') || '',
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
    '{{moneda_originala}}': data.moneda_originala || 'RON'
  };
  
  // Aplică înlocuirile simple
  for (const [placeholder, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processed = processed.replace(regex, value);
  }
  
  // PROCESARE COMPLEXĂ pentru secțiuni condiționale - PĂSTRATE identic
  
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
  
  // CLAUZE CONDIȚIONALE - PĂSTRATE identic
  
  // Responsabil proiect
  let responsabilClause = '';
  if (data.proiect?.responsabil && data.proiect.responsabil.trim()) {
    responsabilClause = `E). Responsabilul proiect din partea PRESTATOR: ${data.proiect.responsabil}`;
  }
  processed = processed.replace('{{responsabil_clause}}', responsabilClause);
  
  // Contact client
  let contactClause = '';
  const clientTelefon = typeof data.client?.telefon === 'string' ? data.client.telefon.trim() : '';
  const clientEmail = typeof data.client?.email === 'string' ? data.client.email.trim() : '';

  if (clientTelefon) {
    contactClause = `C). Persoană de contact: ${data.client.nume} (Tel: ${clientTelefon}`;
    if (clientEmail) {
      contactClause += `, Email: ${clientEmail}`;
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

  // Descriere lucrări anexă
  let descriereClause = '';
  if (data.anexa_descriere_lucrari && data.anexa_descriere_lucrari.trim()) {
    descriereClause = data.anexa_descriere_lucrari.trim();
  }
  processed = processed.replace('{{anexa.descriere_lucrari}}', descriereClause);
  
  console.log('[DEBUG] Înlocuire descriere anexă:', {
    input: data.anexa_descriere_lucrari,
    output: descriereClause,
    found_placeholder: processed.includes('{{anexa.descriere_lucrari}}')
  });
  
  return processed;
}

// NOUĂ FUNCȚIE: Procesarea placeholder-urilor pentru anexă - PĂSTRATĂ identic
function processAnexaPlaceholders(text: string, data: any): string {
  let processed = text;
  
  // PROCESARE TERMENE ANEXĂ - CORECTARE PROCENTE
  let termeneText = '';
  if (data.anexa_etape && Array.isArray(data.anexa_etape) && data.anexa_etape.length > 0) {
    // CORECTARE: Calculează suma totală pentru procente corecte
    const sumaTotala = data.anexa_etape.reduce((sum: number, termen: any) => sum + (termen.valoare_ron || termen.valoare || 0), 0);
    
    termeneText = data.anexa_etape.map((termen: any, index: number) => {
      const valoareRON = termen.valoare_ron || termen.valoare || 0;
      // CORECTARE: Calculează procentul corect din suma totală
      const procentCorect = sumaTotala > 0 ? ((valoareRON / sumaTotala) * 100) : 0;
      
      const etapaString = `**Etapa ${index + 1}**: ${procentCorect.toFixed(1)}% (${(termen.valoare || 0).toFixed(2)} ${termen.moneda || 'RON'}) - ${termen.denumire || 'Fără denumire'} (termen: ${termen.termen_zile || 30} zile)`;
      return etapaString;
    }).join('\n\n');
  } else {
    termeneText = `**Etapa 1**: 100.0% (${data.suma_anexa_originala || '0.00'} ${data.moneda_anexa_originala || 'RON'}) - Serviciu suplimentar (termen: 30 zile)`;
  }

  processed = processed.replace('{{termene_personalizate}}', termeneText);
  
  // ÎNLOCUIRI SPECIFICE ANEXĂ - PĂSTRATE identic
  const anexaReplacements: { [key: string]: string } = {
    // Numere specifice anexă
    '{{anexa.numar}}': data.anexa?.numar || '1',
    '{{anexa.data}}': data.anexa?.data || new Date().toLocaleDateString('ro-RO'),
    
    // Contract părinte
    '{{contract.numar}}': data.contract?.numar || 'Contract-NR-TBD',
    '{{contract.data}}': data.contract?.data || new Date().toLocaleDateString('ro-RO'),
    
    // Date anexă specifice
    '{{anexa.data_start}}': data.anexa?.data_start || 'TBD',
    '{{anexa.data_final}}': data.anexa?.data_final || 'TBD',
    '{{anexa.durata_zile}}': data.anexa?.durata_zile || 'TBD',
    
    // Sume anexă
    '{{suma_totala_originala}}': data.suma_anexa_originala || '0.00',
    '{{moneda_originala}}': data.moneda_anexa_originala || 'RON',
    
    // Client info - păstrează din contract
    '{{client.nume}}': data.client?.nume || data.client?.denumire || 'CLIENT NECUNOSCUT',
    '{{client.cui}}': data.client?.cui || 'CUI NECUNOSCUT',
    '{{client.nr_reg_com}}': data.client?.nr_reg_com || 'NR REG COM NECUNOSCUT',
    '{{client.adresa}}': data.client?.adresa || 'ADRESA NECUNOSCUTA',
    '{{client.telefon}}': (typeof data.client?.telefon === 'string' ? data.client.telefon : '') || '',
    '{{client.email}}': (typeof data.client?.email === 'string' ? data.client.email : '') || '',
    '{{client.reprezentant}}': data.client?.reprezentant || 'Administrator',
    
    // Proiect info - păstrează din contract  
    '{{proiect.denumire}}': data.proiect?.denumire || 'PROIECT NECUNOSCUT',
    '{{proiect.data_start}}': data.anexa?.data_start || data.proiect?.data_start || 'TBD',
    '{{proiect.data_final}}': data.anexa?.data_final || data.proiect?.data_final || 'TBD',
    '{{proiect.durata_zile}}': data.anexa?.durata_zile || data.proiect?.durata_zile || 'TBD',
    '{{proiect.responsabil}}': data.proiect?.responsabil || '',
    
    // Firma info - identic cu contractul
    '{{firma.nume}}': 'UNITAR PROIECT TDA SRL',
    '{{firma.cui}}': 'RO35639210',
    '{{firma.nr_reg_com}}': 'J2016002024405',
    '{{firma.adresa}}': 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
    '{{firma.telefon}}': '0765486044',
    '{{firma.email}}': 'contact@unitarproiect.eu',
    '{{firma.cont_ing}}': 'RO82INGB0000999905667533',
    '{{firma.cont_trezorerie}}': 'RO29TREZ7035069XXX018857',
    '{{anexa.descriere_lucrari}}': data.anexa_descriere_lucrari || '',
  };
  
  // Aplică înlocuirile anexă
  for (const [placeholder, value] of Object.entries(anexaReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processed = processed.replace(regex, value);
  }
  
  // PROCESARE COMPLEXĂ pentru anexă - PĂSTRATĂ identic
  
  // Adresa execuție anexă
  if (data.proiect?.adresa && data.proiect.adresa.trim()) {
    processed = processed.replace('{{proiect.adresa}}', `Adresa execuție: ${data.proiect.adresa}`);
  } else {
    processed = processed.replace('{{proiect.adresa}}', '');
  }
  
  // Clauză valută pentru anexă
  const valutaClause = data.moneda_anexa_originala !== 'RON' ? ', plătiți în lei la cursul BNR din ziua facturării' : '';
  processed = processed.replace('{{valuta_clause}}', valutaClause);
  
  // Observații anexă
  let observatiiClause = '';
  if (data.anexa_observatii && data.anexa_observatii.trim()) {
    observatiiClause = `\n**OBSERVAȚII ANEXĂ:**\n\n${data.anexa_observatii}\n`;
  }
  processed = processed.replace('{{observatii_clause}}', observatiiClause);
  
  return processed;
}

// MODIFICAT 03.02.2026 - Conversie TXT la DOCX cu suport pentru ștampilă
function convertTextToWordXml(text: string): string {
  // Înlocuiește placeholder-ul ștampilei cu marker temporar
  const textWithMarker = replaceStampilaPlaceholderWithMarker(text);

  const paragraphs = textWithMarker.split('\n').map(line => {
    // Linii goale - spațiere normală
    if (line.trim() === '') {
      return '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
    }

    // Linia cu marker-ul ștampilei - returnează marker-ul pentru înlocuire ulterioară
    if (line.includes('___STAMPILA_PLACEHOLDER___')) {
      // Păstrăm marker-ul într-un paragraf pentru a fi înlocuit ulterior cu XML-ul imaginii
      return `<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:t>___STAMPILA_PLACEHOLDER___</w:t></w:r></w:p>`;
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

// PĂSTRATE identic - Funcții template DOCX și TXT
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

// NOUĂ FUNCȚIE: Procesare template DOCX pentru anexă
async function processAnexaDocxTemplate(templatePath: string, data: any): Promise<Buffer> {
  try {
    const templateBuffer = await readFile(templatePath);
    const zip = new JSZip();
    
    await zip.loadAsync(templateBuffer);
    
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('document.xml nu a fost gasit in template DOCX anexă');
    }
    
    const processedXml = processAnexaPlaceholders(documentXml, data);
    
    zip.file('word/document.xml', processedXml);
    
    return await zip.generateAsync({ type: 'nodebuffer' });
    
  } catch (error) {
    console.error('Eroare la procesarea template-ului DOCX anexă:', error);
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

// NOUĂ FUNCȚIE: Procesare template TXT pentru anexă
async function processAnexaTextTemplate(templatePath: string, data: any): Promise<string> {
  try {
    const templateContent = await readFile(templatePath, 'utf8');
    return processAnexaPlaceholders(templateContent, data);
  } catch (error) {
    console.error('Eroare la procesarea template-ului TXT anexă:', error);
    throw error;
  }
}

// MODIFICAT 03.02.2026 - Suport pentru inserarea ștampilei în DOCX
async function convertTextToDocx(processedText: string): Promise<Buffer> {
  const zip = new JSZip();
  const includeStampila = hasStampilaPlaceholder(processedText);

  console.log('[DOCX-CONVERT] Include ștampilă:', includeStampila);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // Content Types - cu sau fără suport PNG
  if (includeStampila) {
    zip.file('[Content_Types].xml', generateContentTypesWithImage());
  } else {
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  }

  // Document relationships - cu sau fără referință la imagine
  if (includeStampila) {
    zip.file('word/_rels/document.xml.rels', generateImageRelationshipXml('rId2'));

    // Încarcă și adaugă imaginea ștampilei
    const stampilaBuffer = await loadStampilaImage();
    if (stampilaBuffer) {
      zip.file('word/media/stampila.png', stampilaBuffer);
      console.log('[DOCX-CONVERT] Ștampilă adăugată în word/media/stampila.png');
    } else {
      console.warn('[DOCX-CONVERT] Nu s-a putut încărca ștampila, documentul va fi generat fără ea');
    }
  } else {
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
  }

  // Generează XML-ul documentului
  let wordXml = convertTextToWordXml(processedText);

  // Înlocuiește marker-ul ștampilei cu XML-ul imaginii (dacă e necesar)
  if (includeStampila) {
    wordXml = replaceStampilaMarkerWithDrawing(wordXml, 'rId2');
    console.log('[DOCX-CONVERT] Marker ștampilă înlocuit cu XML imagine');
  }

  zip.file('word/document.xml', wordXml);

  return await zip.generateAsync({ type: 'nodebuffer' });
}

// PĂSTRAT identic - Extragere proiect
async function loadProiectDataSimple(proiectId: string) {
  try {
    const proiectQuery = `
      SELECT * FROM ${TABLE_PROIECTE}
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
        SELECT * FROM ${TABLE_CLIENTI}
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
      SELECT * FROM ${TABLE_SUBPROIECTE}
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

// PĂSTRAT identic - Funcția de calcul multi-valută
function calculeazaSumaContractCuValoriEstimate(proiect: any, subproiecte: any[], termenePersonalizate: any[]) {
  if (termenePersonalizate.length > 0) {
    const valuteBuckets: { [moneda: string]: number } = {};
    
    termenePersonalizate.forEach((termen) => {
      const monedaTermen = termen.moneda || 'RON';
      const valoareOriginala = termen.valoare || 0;
      
      if (!valuteBuckets[monedaTermen]) {
        valuteBuckets[monedaTermen] = 0;
      }
      valuteBuckets[monedaTermen] += valoareOriginala;
    });
    
    let sumaFinalaRON = 0;
    const cursuriUtilizate: { [moneda: string]: number } = {};
    
    Object.entries(valuteBuckets).forEach(([moneda, suma]) => {
      if (moneda === 'RON') {
        sumaFinalaRON += suma;
      } else {
        const curs = CURSURI_VALUTAR[moneda] || 1;
        sumaFinalaRON += suma * curs;
        cursuriUtilizate[moneda] = curs;
      }
    });
    
    let sumaOriginalaString: string;
    let monedaOriginalaString: string;
    
    if (Object.keys(valuteBuckets).length === 1) {
      const [moneda, suma] = Object.entries(valuteBuckets)[0];
      sumaOriginalaString = suma.toFixed(2);
      monedaOriginalaString = moneda;
    } else {
      const enumerareValute = Object.entries(valuteBuckets)
        .map(([moneda, suma]) => `${suma.toFixed(2)} ${moneda}`)
        .join(' + ');
      
      sumaOriginalaString = enumerareValute;
      monedaOriginalaString = '';
    }
    
    return { 
	  sumaFinala: sumaFinalaRON, 
	  monedaFinala: Object.keys(valuteBuckets).length === 1 ? Object.keys(valuteBuckets)[0] : 'MULTIPLE',
	  cursuriUtilizate,
	  sumaOriginala: sumaOriginalaString,
	  monedaOriginala: monedaOriginalaString,
	  // ADAUGĂ acestea pentru compatibilitate BigQuery:
	  sumaOriginalaNumeric: Object.keys(valuteBuckets).length === 1 ? Object.values(valuteBuckets)[0] : sumaFinalaRON,
	  monedaOriginalaForDB: Object.keys(valuteBuckets).length === 1 ? Object.keys(valuteBuckets)[0] : 'RON'
	};
    
  } else {
    const sumaOriginala = proiect.Valoare_Estimata || 0;
    const sumaFinalaRON = proiect.valoare_ron || sumaOriginala;
    const monedaOriginala = proiect.moneda || 'RON';
    const cursuriUtilizate: { [moneda: string]: number } = {};
    
    if (proiect.moneda && proiect.moneda !== 'RON') {
      cursuriUtilizate[proiect.moneda] = proiect.curs_valutar || CURSURI_VALUTAR[proiect.moneda] || 1;
    }
    
    return { 
      sumaFinala: sumaFinalaRON, 
      monedaFinala: monedaOriginala,
      cursuriUtilizate,
      sumaOriginala: sumaOriginala.toFixed(2),
      monedaOriginala
    };
  }
}

// NOUĂ FUNCȚIE: Calculează suma anexei
function calculeazaSumaAnexaCuValoriEstimate(anexaEtape: any[]) {
  if (anexaEtape.length === 0) {
    return { 
      sumaFinala: 0, 
      monedaFinala: 'RON',
      cursuriUtilizate: {},
      sumaOriginala: '0.00',
      monedaOriginala: 'RON'
    };
  }

  const valuteBuckets: { [moneda: string]: number } = {};
  
  anexaEtape.forEach((termen) => {
    const monedaTermen = termen.moneda || 'RON';
    const valoareOriginala = termen.valoare || 0;
    
    if (!valuteBuckets[monedaTermen]) {
      valuteBuckets[monedaTermen] = 0;
    }
    valuteBuckets[monedaTermen] += valoareOriginala;
  });
  
  let sumaFinalaRON = 0;
  const cursuriUtilizate: { [moneda: string]: number } = {};
  
  Object.entries(valuteBuckets).forEach(([moneda, suma]) => {
    if (moneda === 'RON') {
      sumaFinalaRON += suma;
    } else {
      const curs = CURSURI_VALUTAR[moneda] || 1;
      sumaFinalaRON += suma * curs;
      cursuriUtilizate[moneda] = curs;
    }
  });
  
  let sumaOriginalaString: string;
  let monedaOriginalaString: string;
  
  if (Object.keys(valuteBuckets).length === 1) {
    const [moneda, suma] = Object.entries(valuteBuckets)[0];
    sumaOriginalaString = suma.toFixed(2);
    monedaOriginalaString = moneda;
  } else {
    const enumerareValute = Object.entries(valuteBuckets)
      .map(([moneda, suma]) => `${suma.toFixed(2)} ${moneda}`)
      .join(' + ');
    
    sumaOriginalaString = enumerareValute;
    monedaOriginalaString = '';
  }
  
  return { 
    sumaFinala: sumaFinalaRON, 
    monedaFinala: Object.keys(valuteBuckets).length === 1 ? Object.keys(valuteBuckets)[0] : 'MULTIPLE',
    cursuriUtilizate,
    sumaOriginala: sumaOriginalaString,
    monedaOriginala: monedaOriginalaString
  };
}

// MODIFICAT: Preparare date template - adăugat parametru customDataContract
function prepareSimpleTemplateData(
  proiect: any,
  subproiecte: any[],
  contractData: any,
  termene: any[],
  observatii?: string,
  customDataContract?: string | null
) {
  const { sumaOriginala, monedaOriginala } = calculeazaSumaContractCuValoriEstimate(proiect, subproiecte, termene);

  // NOU: Folosește data custom dacă e furnizată, altfel data de azi
  const dataContract = customDataContract
    ? new Date(customDataContract).toLocaleDateString('ro-RO')
    : new Date().toLocaleDateString('ro-RO');
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
    suma_totala_originala: sumaOriginala,
    moneda_originala: monedaOriginala,
    observatii: observatii || '',
    data_generare: new Date().toISOString()
  };
  
  return templateData;
}

// MODIFICATĂ FUNCȚIE: Preparare date template pentru anexă - adăugat parametru customDataContract
function prepareAnexaTemplateData(
  proiect: any,
  subproiecte: any[],
  contractData: any,
  anexaEtape: any[],
  anexaNumar: number,
  anexaDataStart: string,
  anexaDataFinal: string,
  anexaObservatii?: string,
  anexaDescrierelucrari?: string,
  customDataContract?: string | null
) {
  const { sumaOriginala, monedaOriginala } = calculeazaSumaAnexaCuValoriEstimate(anexaEtape);

  // NOU: Folosește data custom dacă e furnizată, altfel data de azi
  const dataContract = customDataContract
    ? new Date(customDataContract).toLocaleDateString('ro-RO')
    : new Date().toLocaleDateString('ro-RO');
  const durataZile = calculateDurationInDays(anexaDataStart, anexaDataFinal);
  
  const templateData = {
    contract: {
      numar: contractData.numar_contract,
      data: dataContract
    },
    
    anexa: {
      numar: anexaNumar.toString(),
      data: dataContract,
      data_start: formatDate(anexaDataStart),
      data_final: formatDate(anexaDataFinal),
      durata_zile: durataZile
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
      data_start: formatDate(anexaDataStart),
      data_final: formatDate(anexaDataFinal),
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
    
    anexa_etape: anexaEtape,
    suma_anexa_originala: sumaOriginala,
    moneda_anexa_originala: monedaOriginala,
    anexa_observatii: anexaObservatii || '',
    anexa_descriere_lucrari: anexaDescrierelucrari || '',
    data_generare: new Date().toISOString()
  };
  
  return templateData;
}

// NOUĂ FUNCȚIE: Obține următorul număr anexă pentru un contract
async function getNextAnexaNumber(contractId: string): Promise<number> {
  try {
    const query = `
      SELECT MAX(anexa_numar) as max_anexa
      FROM ${TABLE_ANEXE_CONTRACT}
      WHERE contract_id = @contractId
    `;
    const [results] = await bigquery.query({
      query,
      params: { contractId },
      types: { contractId: 'STRING' },
      location: 'EU'
    });
    
    const maxAnexaNumar = results.length > 0 && results[0].max_anexa ? 
      extractNumericValue(results[0].max_anexa) : 0;
    
    return maxAnexaNumar + 1;
  } catch (error) {
    console.error('Eroare la obținerea numărului anexă:', error);
    return 1;
  }
}

// PĂSTRAT din original - Template fallback complet
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

{{stampila_prestator}}
`;

  return processPlaceholders(templateContent, data);
}

// NOUĂ FUNCȚIE: Template fallback pentru anexă
async function createAnexaFallbackTemplate(data: any): Promise<string> {
  const templateContent = `**ANEXA NR. {{anexa.numar}} DIN {{anexa.data}} LA CONTRACTUL NR. {{contract.numar}} din {{contract.data}}**

**CAP.I. PĂRȚI CONTRACTANTE**

1. Între **{{client.nume}}**, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}}, denumită în continuare **BENEFICIAR**

și

2. **S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social în {{firma.adresa}}, având CIF {{firma.cui}} și nr. de înregistrare la Registrul Comerțului {{firma.nr_reg_com}}, având contul IBAN: {{firma.cont_ing}}, deschis la banca ING, și cont Trezorerie IBAN: {{firma.cont_trezorerie}}, e-mail: {{firma.email}}, reprezentată legal de Damian Teodor, în calitate de Administrator, numită în continuare **PRESTATOR**.

**CAP. II. OBIECTUL ANEXEI**

Obiectul anexei îl reprezintă:

**{{proiect.denumire}}**

{{proiect.adresa}}

Servicii suplimentare și modificări la contractul de bază.

**CAP.III. DURATA CONTRACTULUI:**

1. Contractul se încheie pe o perioadă determinată, cu următoarele termene:
- Data început: {{proiect.data_start}}
- Data finalizare: {{proiect.data_final}}
- Durata estimată: {{proiect.durata_zile}} zile

**CAP. IV. PREȚUL DE EXECUTARE AL LUCRĂRII**

1. Prețul pe care Beneficiarul îl datorează prestatorului pentru serviciile sale este de **{{suma_totala_originala}} {{moneda_originala}}** la care se aplică suplimentar TVA{{valuta_clause}}.

2. Plățile vor fi realizate în modul următor:

{{termene_personalizate}}

Se vor respecta toate mai departe toate prevederile din **Contract**.

3. Prezenta anexă a fost încheiat, în 2 exemplare, câte una pentru fiecare parte.

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

{{stampila_prestator}}
`;

  return processAnexaPlaceholders(templateContent, data);
}

// MODIFICATĂ: Salvare contract cu logică inteligentă de merge pentru EtapeContract + AnexeContract
async function salveazaContractCuEtapeContract(contractInfo: any): Promise<string> {
  const contractId = contractInfo.isEdit && contractInfo.contractExistentId 
    ? contractInfo.contractExistentId 
    : `CONTR_${contractInfo.proiectId}_${Date.now()}`;
  
  try {
    const dataStart = contractInfo.proiect.Data_Start;
    const dataFinal = contractInfo.proiect.Data_Final;
    
    const dataSemnare = formatDateForBigQuery(new Date().toISOString().split('T')[0]);
    const dataExpirare = formatDateForBigQuery(
      dataFinal && typeof dataFinal === 'object' && dataFinal.value ? dataFinal.value :
      typeof dataFinal === 'string' ? dataFinal : null
    );

    const cursValutarPrincipal = contractInfo.monedaOriginala !== 'RON' ? 
      (contractInfo.cursuriUtilizate[contractInfo.monedaOriginala] || CURSURI_VALUTAR[contractInfo.monedaOriginala] || null) : 
      null;
    
    const dataCursValutar = cursValutarPrincipal ? 
      formatDateForBigQuery(new Date().toISOString().split('T')[0]) : 
      null;
      
      // Calculează valoarea pentru DB înainte de UPDATE/INSERT
	// CORECTARE: Folosește sumaOriginalaNumeric pentru a păstra valoarea în moneda originală
	// Aceasta este fie suma în moneda originală (dacă toate etapele au aceeași monedă),
	// fie suma convertită în RON (dacă sunt monede mixte)
	let valoarePentruDB = contractInfo.sumaOriginalaNumeric || contractInfo.sumaFinala;

    // 1. SALVAREA/ACTUALIZAREA CONTRACTULUI
    if (contractInfo.isEdit && contractInfo.contractExistentId) {
	  const updateQuery = `
	    UPDATE ${TABLE_CONTRACTE}
	    SET
	      client_id = @clientId,
	      client_nume = @clientNume,
	      Denumire_Contract = @denumireContract,
	      Valoare = CAST(@valoare AS NUMERIC),
	      Moneda = @moneda,
	      curs_valutar = @cursValutar,
	      data_curs_valutar = @dataCurs,
	      valoare_ron = CAST(@valoareRon AS NUMERIC),
	      articole_suplimentare = PARSE_JSON(@articoleSuplimentare),
	      data_actualizare = CURRENT_TIMESTAMP(),
	      continut_json = PARSE_JSON(@continutJson),
	      Observatii = @observatii,
	      versiune = versiune + 1,
	      Status = 'Activ',
	      data_contract = @dataContractCustom
	    WHERE ID_Contract = @contractId
	  `;

	  const parametriiUpdate = {
	    contractId: contractInfo.contractExistentId,
	    clientId: sanitizeStringForBigQuery(contractInfo.proiect.client_id),
	    clientNume: contractInfo.placeholderData.client.nume,
	    denumireContract: `Contract ${contractInfo.placeholderData.proiect.denumire}`,
	    valoare: valoarePentruDB.toString(),
	    moneda: contractInfo.monedaOriginalaForDB || 'RON',
	    cursValutar: cursValutarPrincipal,
	    dataCurs: dataCursValutar,
	    valoareRon: contractInfo.sumaFinala.toString(),
	    articoleSuplimentare: JSON.stringify([]),
	    continutJson: JSON.stringify({
	      snapshot_original: {
		subproiecte_originale: contractInfo.subproiecte || [],
		data_snapshot: new Date().toISOString()
	      },
	      placeholderData: contractInfo.placeholderData
	    }),
	    observatii: sanitizeStringForBigQuery(contractInfo.observatii),
	    dataContractCustom: contractInfo.dataContract || null // NOU: Data contract custom
	  };

	  console.log(`[CONTRACT-UPDATE] Actualizare contract ${contractInfo.contractExistentId} cu Status = 'Activ' (reactivare după ștergere)`);

	  await bigquery.query({
	    query: updateQuery,
	    params: parametriiUpdate,
	    types: {
	      contractId: 'STRING',
	      clientId: 'STRING',
	      clientNume: 'STRING',
	      denumireContract: 'STRING',
	      valoare: 'STRING',
	      moneda: 'STRING',
	      cursValutar: 'NUMERIC',
	      dataCurs: 'DATE',
	      valoareRon: 'STRING',
	      articoleSuplimentare: 'STRING',
	      continutJson: 'STRING',
	      observatii: 'STRING',
	      dataContractCustom: 'DATE' // NOU: Tip pentru data contract
	    },
	    location: 'EU',
	  });

	  console.log(`✅ [CONTRACT-UPDATE] Contract ${contractInfo.contractExistentId} actualizat cu succes - Status schimbat la 'Activ'`);

    } else {
      const insertQuery = `
        INSERT INTO ${TABLE_CONTRACTE}
        (ID_Contract, numar_contract, serie_contract, tip_document, proiect_id,
         client_id, client_nume, Denumire_Contract, Data_Semnare, Data_Expirare,
         Status, Valoare, Moneda, curs_valutar, data_curs_valutar, valoare_ron,
         articole_suplimentare, data_creare, data_actualizare,
         continut_json, Observatii, versiune, data_contract)
        VALUES
        (@contractId, @numarContract, @serieContract, @tipDocument, @proiectId,
         @clientId, @clientNume, @denumireContract, @dataSemnare, @dataExpirare,
         @status, CAST(@valoare AS NUMERIC), @moneda, @cursValutar, @dataCurs, CAST(@valoareRon AS NUMERIC),
         PARSE_JSON(@articoleSuplimentare),
         CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(),
         PARSE_JSON(@continutJson), @observatii, @versiune, @dataContractCustom)
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
        valoare: valoarePentruDB.toString(),
        moneda: contractInfo.monedaOriginalaForDB || 'RON',
        cursValutar: cursValutarPrincipal,
        dataCurs: dataCursValutar,
        valoareRon: contractInfo.sumaFinala,
        articoleSuplimentare: JSON.stringify([]),
        continutJson: JSON.stringify({
          snapshot_original: {
            subproiecte_originale: contractInfo.subproiecte || [],
            data_snapshot: new Date().toISOString()
          },
          placeholderData: contractInfo.placeholderData
        }),
        observatii: sanitizeStringForBigQuery(contractInfo.observatii),
        versiune: 1,
        dataContractCustom: contractInfo.dataContract || null // NOU: Data contract custom
      };

      await bigquery.query({
	  query: insertQuery,
	  params: parametriiInsert,
	  types: {
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
	    valoare: 'STRING',
	    moneda: 'STRING',
	    cursValutar: 'NUMERIC',
	    dataCurs: 'DATE',
	    valoareRon: 'NUMERIC',
	    articoleSuplimentare: 'STRING',
	    continutJson: 'STRING',
	    observatii: 'STRING',
	    versiune: 'INT64',
	    dataContractCustom: 'DATE' // NOU: Tip pentru data contract
	  },
	  location: 'EU',
	});
    }

    // 2. LOGICĂ INTELIGENTĂ DE MERGE PENTRU ETAPECONTRACT cu proiect_id
    if (contractInfo.termenePersonalizate && contractInfo.termenePersonalizate.length > 0) {
      console.log(`[CONTRACT-GENERATE] Începe merge inteligent pentru ${contractInfo.termenePersonalizate.length} etape în contractul ${contractId}`);
      
      // 2.1 Încarcă etapele existente din EtapeContract
      const etapeExistenteQuery = `
        SELECT ID_Etapa, subproiect_id, etapa_index, denumire, 
               status_facturare, status_incasare, factura_id, 
               data_facturare, data_incasare, data_scadenta
        FROM ${TABLE_ETAPE_CONTRACT}
        WHERE contract_id = '${contractId}' AND activ = true
        ORDER BY etapa_index ASC
      `;

      const [etapeExistente] = await bigquery.query({
        query: etapeExistenteQuery,
        location: 'EU',
      });

      console.log(`[CONTRACT-GENERATE] Găsite ${etapeExistente.length} etape existente în EtapeContract`);

      // 2.2 Construiește map-uri pentru matching
      const etapeExistenteMap = new Map();
      const etapeExistenteManuale: any[] = [];

      etapeExistente.forEach((etapa: any) => {
        if (etapa.subproiect_id) {
          etapeExistenteMap.set(etapa.subproiect_id, etapa);
        } else {
          etapeExistenteManuale.push(etapa);
        }
      });

      // 2.3 Procesează fiecare etapă nouă
      const etapeProcessate = new Set();
      const queryPromises: Promise<any>[] = [];

      contractInfo.termenePersonalizate.forEach((termen: any, index: number) => {
        const etapaIndex = index + 1;
        const cursValutarEtapa = termen.moneda !== 'RON' ? (CURSURI_VALUTAR[termen.moneda] || 1) : null;
        const dataCursEtapa = termen.moneda !== 'RON' ? new Date().toISOString().split('T')[0] : null;

        if (termen.subproiect_id) {
          // ETAPĂ DIN SUBPROIECT - matching prin subproiect_id
          const etapaExistenta = etapeExistenteMap.get(termen.subproiect_id);
          
          if (etapaExistenta) {
            // UPDATE etapă existentă - păstrează datele business
            console.log(`[CONTRACT-GENERATE] UPDATE etapă existentă: ${etapaExistenta.ID_Etapa} pentru subproiect ${termen.subproiect_id}`);
            
            const updateEtapaQuery = `
              UPDATE ${TABLE_ETAPE_CONTRACT}
              SET 
                etapa_index = ${etapaIndex},
                denumire = '${termen.denumire.replace(/'/g, "''")}',
                valoare = ${termen.valoare},
                moneda = '${termen.moneda}',
                valoare_ron = ${termen.valoare_ron},
                termen_zile = ${termen.termen_zile},
                curs_valutar = ${cursValutarEtapa || 'NULL'},
                data_curs_valutar = ${dataCursEtapa ? `DATE('${dataCursEtapa}')` : 'NULL'},
                procent_din_total = ${termen.procent_calculat || 0},
                proiect_id = '${contractInfo.proiectId}',
                data_actualizare = CURRENT_TIMESTAMP()
              WHERE ID_Etapa = '${etapaExistenta.ID_Etapa}'
            `;
            
            queryPromises.push(bigquery.query({ query: updateEtapaQuery, location: 'EU' }));
            etapeProcessate.add(etapaExistenta.ID_Etapa);
            
          } else {
            // INSERT etapă nouă din subproiect
            const etapaId = `ETAPA_${contractId}_${etapaIndex}_${Date.now()}`;
            console.log(`[CONTRACT-GENERATE] INSERT etapă nouă din subproiect: ${etapaId}`);
            
            const insertEtapaQuery = `
              INSERT INTO ${TABLE_ETAPE_CONTRACT}
              (ID_Etapa, contract_id, proiect_id, etapa_index, denumire, valoare, moneda, 
               valoare_ron, termen_zile, subproiect_id, status_facturare, status_incasare,
               curs_valutar, data_curs_valutar, procent_din_total, 
               activ, data_creare)
              VALUES (
                '${etapaId}',
                '${contractId}',
                '${contractInfo.proiectId}',
                ${etapaIndex},
                '${termen.denumire.replace(/'/g, "''")}',
                ${termen.valoare},
                '${termen.moneda}',
                ${termen.valoare_ron},
                ${termen.termen_zile},
                '${termen.subproiect_id}',
                'Nefacturat',
                'NeÎncasat',
                ${cursValutarEtapa || 'NULL'},
                ${dataCursEtapa ? `DATE('${dataCursEtapa}')` : 'NULL'},
                ${termen.procent_calculat || 0},
                true,
                CURRENT_TIMESTAMP()
              )
            `;
            
            queryPromises.push(bigquery.query({ query: insertEtapaQuery, location: 'EU' }));
          }
          
        } else {
          // ETAPĂ MANUALĂ - matching prin poziție sau denumire
          let etapaExistentaManuala: any = null;
          
          // Încearcă să găsească prin denumire
          etapaExistentaManuala = etapeExistenteManuale.find(e => 
            e.denumire && e.denumire.trim() === termen.denumire.trim()
          );
          
          // Dacă nu găsește prin denumire, încearcă prin poziție relativă
          if (!etapaExistentaManuala && etapeExistenteManuale.length > 0) {
            const pozitieRelativa = index - contractInfo.termenePersonalizate.filter((t: any, i: number) => 
              i < index && t.subproiect_id
            ).length;
            
            if (pozitieRelativa >= 0 && pozitieRelativa < etapeExistenteManuale.length) {
              etapaExistentaManuala = etapeExistenteManuale[pozitieRelativa];
            }
          }
          
          if (etapaExistentaManuala) {
          // UPDATE etapă manuală existentă - păstrează datele business
            console.log(`[CONTRACT-GENERATE] UPDATE etapă manuală existentă: ${etapaExistentaManuala.ID_Etapa}`);
            
            const updateEtapaManualaQuery = `
              UPDATE ${TABLE_ETAPE_CONTRACT}
              SET 
                etapa_index = ${etapaIndex},
                denumire = '${termen.denumire.replace(/'/g, "''")}',
                valoare = ${termen.valoare},
                moneda = '${termen.moneda}',
                valoare_ron = ${termen.valoare_ron},
                termen_zile = ${termen.termen_zile},
                curs_valutar = ${cursValutarEtapa || 'NULL'},
                data_curs_valutar = ${dataCursEtapa ? `DATE('${dataCursEtapa}')` : 'NULL'},
                procent_din_total = ${termen.procent_calculat || 0},
                proiect_id = '${contractInfo.proiectId}',
                data_actualizare = CURRENT_TIMESTAMP()
              WHERE ID_Etapa = '${etapaExistentaManuala.ID_Etapa}'
            `;
            
            queryPromises.push(bigquery.query({ query: updateEtapaManualaQuery, location: 'EU' }));
            etapeProcessate.add(etapaExistentaManuala.ID_Etapa);
            
          } else {
            // INSERT etapă manuală nouă
            const etapaId = `ETAPA_${contractId}_${etapaIndex}_${Date.now()}`;
            console.log(`[CONTRACT-GENERATE] INSERT etapă manuală nouă: ${etapaId}`);
            
            const insertEtapaManualaQuery = `
              INSERT INTO ${TABLE_ETAPE_CONTRACT}
              (ID_Etapa, contract_id, proiect_id, etapa_index, denumire, valoare, moneda, 
               valoare_ron, termen_zile, subproiect_id, status_facturare, status_incasare,
               curs_valutar, data_curs_valutar, procent_din_total, 
               activ, data_creare)
              VALUES (
                '${etapaId}',
                '${contractId}',
                '${contractInfo.proiectId}',
                ${etapaIndex},
                '${termen.denumire.replace(/'/g, "''")}',
                ${termen.valoare},
                '${termen.moneda}',
                ${termen.valoare_ron},
                ${termen.termen_zile},
                NULL,
                'Nefacturat',
                'NeÎncasat',
                ${cursValutarEtapa || 'NULL'},
                ${dataCursEtapa ? `DATE('${dataCursEtapa}')` : 'NULL'},
                ${termen.procent_calculat || 0},
                true,
                CURRENT_TIMESTAMP()
              )
            `;
            
            queryPromises.push(bigquery.query({ query: insertEtapaManualaQuery, location: 'EU' }));
          }
        }
      });

      // 2.4 Gestionează etapele care nu mai există în noua versiune
      const etapeDeEliminat = etapeExistente.filter((etapa: any) => 
        !etapeProcessate.has(etapa.ID_Etapa)
      );

      etapeDeEliminat.forEach((etapa: any) => {
        if (etapa.status_facturare === 'Facturat' || etapa.factura_id) {
          // Dacă etapa e facturată, o păstrează dar o marchează ca inactivă
          console.log(`[CONTRACT-GENERATE] Marchează ca inactivă etapa facturată: ${etapa.ID_Etapa}`);
          
          const deactivateQuery = `
            UPDATE ${TABLE_ETAPE_CONTRACT}
            SET activ = false, data_actualizare = CURRENT_TIMESTAMP()
            WHERE ID_Etapa = '${etapa.ID_Etapa}'
          `;
          
          queryPromises.push(bigquery.query({ query: deactivateQuery, location: 'EU' }));
          
        } else {
          // Dacă etapa nu e facturată, o șterge fizic
          console.log(`[CONTRACT-GENERATE] Șterge fizic etapa nefacturată: ${etapa.ID_Etapa}`);
          
          const deleteQuery = `
            DELETE FROM ${TABLE_ETAPE_CONTRACT}
            WHERE ID_Etapa = '${etapa.ID_Etapa}'
          `;
          
          queryPromises.push(bigquery.query({ query: deleteQuery, location: 'EU' }));
        }
      });

      // 2.5 Execută toate query-urile SECVENȚIAL pentru a evita conflictele de concurrency
      console.log(`[CONTRACT-GENERATE] Execuție secvențială a ${queryPromises.length} query-uri pentru a evita conflictele BigQuery`);
      
      for (let i = 0; i < queryPromises.length; i++) {
        try {
          await queryPromises[i];
          console.log(`[CONTRACT-GENERATE] Query ${i + 1}/${queryPromises.length} executat cu succes`);
        } catch (error) {
          console.error(`[CONTRACT-GENERATE] Eroare la query ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log(`[CONTRACT-GENERATE] ✅ Merge inteligent finalizat pentru contractul ${contractId}:`);
      console.log(`   - ${contractInfo.termenePersonalizate.length} etape procesate`);
      console.log(`   - ${etapeDeEliminat.length} etape eliminate/dezactivate`);
    }

    // 3. NOUĂ LOGICĂ: Salvare anexă dacă există
    if (contractInfo.anexaActiva && contractInfo.anexaEtape && contractInfo.anexaEtape.length > 0) {
      console.log(`[CONTRACT-GENERATE] Începe salvarea anexei pentru contractul ${contractId}`);
      
      // Obține numărul anexei
      const anexaNumar = contractInfo.anexaNumar || await getNextAnexaNumber(contractId);
      
      // Salvează etapele anexei în AnexeContract
      const anexaQueryPromises: Promise<any>[] = [];
      
      contractInfo.anexaEtape.forEach((etapa: any, index: number) => {
        const anexaId = `ANEXA_${contractId}_${anexaNumar}_${index + 1}_${Date.now()}`;
        const cursValutarEtapa = etapa.moneda !== 'RON' ? (CURSURI_VALUTAR[etapa.moneda] || 1) : null;
        const dataCursEtapa = etapa.moneda !== 'RON' ? new Date().toISOString().split('T')[0] : null;
        
        const insertAnexaQuery = `
          INSERT INTO ${TABLE_ANEXE_CONTRACT}
          (ID_Anexa, contract_id, proiect_id, anexa_numar, etapa_index, denumire, 
           valoare, moneda, valoare_ron, termen_zile, subproiect_id, 
           status_facturare, status_incasare, curs_valutar, data_curs_valutar, 
           procent_din_total, data_start, data_final, observatii, 
           activ, data_creare)
          VALUES (
            '${anexaId}',
            '${contractId}',
            '${contractInfo.proiectId}',
            ${anexaNumar},
            ${index + 1},
            '${etapa.denumire.replace(/'/g, "''")}',
            ${etapa.valoare},
            '${etapa.moneda}',
            ${etapa.valoare_ron},
            ${etapa.termen_zile},
            ${etapa.subproiect_id ? `'${etapa.subproiect_id}'` : 'NULL'},
            'Nefacturat',
            'NeÎncasat',
            ${cursValutarEtapa || 'NULL'},
            ${dataCursEtapa ? `DATE('${dataCursEtapa}')` : 'NULL'},
            ${etapa.procent_calculat || 0},
            ${contractInfo.anexaDataStart ? `DATE('${contractInfo.anexaDataStart}')` : 'NULL'},
            ${contractInfo.anexaDataFinal ? `DATE('${contractInfo.anexaDataFinal}')` : 'NULL'},
            ${contractInfo.anexaObservatii ? `'${contractInfo.anexaObservatii.replace(/'/g, "''")}'` : 'NULL'},
            true,
            CURRENT_TIMESTAMP()
          )
        `;
        
        anexaQueryPromises.push(bigquery.query({ query: insertAnexaQuery, location: 'EU' }));
      });
      
      // Execută query-urile anexă secvențial
      console.log(`[CONTRACT-GENERATE] Execuție secvențială anexă: ${anexaQueryPromises.length} query-uri`);
      
      for (let i = 0; i < anexaQueryPromises.length; i++) {
        try {
          await anexaQueryPromises[i];
          console.log(`[CONTRACT-GENERATE] Anexă query ${i + 1}/${anexaQueryPromises.length} executat cu succes`);
        } catch (error) {
          console.error(`[CONTRACT-GENERATE] Eroare la anexă query ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log(`[CONTRACT-GENERATE] ✅ Anexă ${anexaNumar} salvată cu ${contractInfo.anexaEtape.length} etape`);
    }

    return contractId;
    
  } catch (error) {
    console.error('[CONTRACT-GENERATE] Eroare la salvarea contractului în BigQuery:', error);
    throw error;
  }
}

// MODIFICATĂ FUNCȚIE: Generare template și fișier anexă - adăugat parametru customDataContract
async function generateAnexaDocument(
  proiectComplet: any,
  subproiecte: any[],
  contractData: any,
  anexaNumar: number,
  anexaDataStart: string,
  anexaDataFinal: string,
  anexaEtape: any[],
  anexaObservatii: string,
  anexaDescrierelucrari: string,
  customDataContract?: string | null
): Promise<Buffer> {

  // Pregătește datele pentru anexă folosind aceleași surse ca contractul
	const anexaTemplateData = prepareAnexaTemplateData(
	  proiectComplet,
	  subproiecte,
	  contractData,
	  anexaEtape,
	  anexaNumar,
	  anexaDataStart,
	  anexaDataFinal,
	  anexaObservatii,
	  anexaDescrierelucrari,
	  customDataContract // NOU: Pasează data contract custom
	);
  
  let anexaBuffer: Buffer;
  let templateUsed = 'fallback-anexa';

  try {
    // Încearcă să găsească template specific pentru anexă
    const anexaTemplateOptions = [
      path.join(TEMPLATES_DIR, 'anexa-template.docx'),
      path.join(TEMPLATES_DIR, 'anexa-template.txt'),
      path.join(TEMPLATES_DIR, 'anexa-default-template.docx'),
      path.join(TEMPLATES_DIR, 'anexa-default-template.txt')
    ];

    let anexaTemplatePath: string | null = null;
    for (const templateOption of anexaTemplateOptions) {
      try {
        const { access } = await import('fs/promises');
        await access(templateOption);
        anexaTemplatePath = templateOption;
        break;
      } catch {
        continue;
      }
    }
    
    if (anexaTemplatePath) {
      templateUsed = path.basename(anexaTemplatePath);
      
      if (anexaTemplatePath.endsWith('.docx')) {
        anexaBuffer = await processAnexaDocxTemplate(anexaTemplatePath, anexaTemplateData);
      } else if (anexaTemplatePath.endsWith('.txt')) {
        const processedAnexaText = await processAnexaTextTemplate(anexaTemplatePath, anexaTemplateData);
        anexaBuffer = await convertTextToDocx(processedAnexaText);
      } else {
        throw new Error(`Tip template anexă nepermis: ${path.extname(anexaTemplatePath)}`);
      }
    } else {
      // Fallback la template hardcodat pentru anexă
      const fallbackAnexaTemplate = await createAnexaFallbackTemplate(anexaTemplateData);
      anexaBuffer = await convertTextToDocx(fallbackAnexaTemplate);
      templateUsed = 'fallback-no-anexa-template-found';
    }
  } catch (templateError) {
    console.error('[CONTRACT-GENERATE] Eroare template anexă:', templateError);
    // Fallback la template hardcodat pentru anexă
    const fallbackAnexaTemplate = await createAnexaFallbackTemplate(anexaTemplateData);
    anexaBuffer = await convertTextToDocx(fallbackAnexaTemplate);
    templateUsed = `fallback-anexa-error: ${templateError instanceof Error ? templateError.message : 'unknown'}`;
  }

  console.log('[CONTRACT-GENERATE] DOCX anexă generat, template folosit:', templateUsed);
  return anexaBuffer;
}

// NOUĂ FUNCȚIE: Creare ZIP cu contract și anexă
async function createContractAnexaZip(
  contractBuffer: Buffer,
  anexaBuffer: Buffer,
  contractNumber: string,
  anexaNumar: number
): Promise<Buffer> {
  const zip = new JSZip();
  
  zip.file(`${contractNumber}.docx`, contractBuffer);
  zip.file(`${contractNumber}_Anexa_${anexaNumar}.docx`, anexaBuffer);
  
  return await zip.generateAsync({ type: 'nodebuffer' });
}

// MODIFICATĂ: FUNCȚIA POST FINALĂ cu suport complet pentru numărul contract editabil
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
	const {
	  proiectId,
	  tipDocument = 'contract',
	  termenePersonalizate = [],
	  observatii = '',
	  isEdit = false,
	  contractExistentId = null,
	  contractPreview,
	  contractPrefix,

	  // NOUĂ LOGICĂ: Parametru pentru numărul custom
	  customContractNumber = null,

	  // NOU: Data contract (poate fi diferită de data curentă, pentru contracte retroactive)
	  dataContract = null,

	  // Parametri pentru anexă
	  anexaActiva = false,
	  anexaEtape = [],
	  anexaNumar = 1,
	  anexaDataStart = null,
	  anexaDataFinal = null,
	  anexaObservatii = '',
	  anexaDescrierelucrari = ''
	} = body;

    console.log('[CONTRACT-GENERATE] =================================');
    console.log('[CONTRACT-GENERATE] PROCES ÎNCEPUT:', {
      proiectId,
      tipDocument,
      isEdit,
      contractExistentId,
      termene_count: termenePersonalizate.length,
      anexaActiva,
      anexa_etape_count: anexaEtape.length,
      anexaNumar,
      customContractNumber: customContractNumber || 'auto-generated',
      dataContract: dataContract || 'auto (today)'
    });

    // 1. ÎNCĂRCAREA DATELOR PROIECT
    const { proiect, subproiecte } = await loadProiectDataSimple(proiectId);
    
    console.log('[CONTRACT-GENERATE] Date proiect încărcate:', {
      proiect_id: proiect.ID_Proiect,
      client: proiect.Client,
      valoare: proiect.Valoare_Estimata,
      moneda: proiect.moneda,
      subproiecte_count: subproiecte.length
    });

    // 2. MODIFICATĂ: GENERAREA/PĂSTRAREA NUMĂRULUI DE CONTRACT cu suport custom
    let contractData: any;
    
    if (isEdit && contractExistentId && contractPreview) {
      // Pentru editare, folosește numărul din contractPreview (poate fi custom modificat)
      contractData = {
        numar_contract: contractPreview,
        serie: contractPreview.split('-')[0] || 'CON'
      };
      console.log('[CONTRACT-GENERATE] EDITARE - Număr păstrat/modificat:', contractData.numar_contract);
      
      // NOUĂ VALIDARE: Dacă e număr custom, validează-l
      if (customContractNumber && customContractNumber !== contractPreview) {
        console.log('[CONTRACT-GENERATE] DETECTAT NUMĂR CUSTOM ÎN EDITARE:', customContractNumber);
        const validationResult = await validateCustomContractNumber(customContractNumber, contractExistentId);
        if (!validationResult.valid) {
          console.error('[CONTRACT-GENERATE] Eroare validare număr custom:', validationResult.error);
          return NextResponse.json({
            error: `Numărul contract invalid: ${validationResult.error}`,
            details: 'Verifică numărul contractului și încearcă din nou'
          }, { status: 400 });
        }
        contractData.numar_contract = customContractNumber;
        contractData.serie = customContractNumber.split('-')[0] || 'CON';
      }
    } else {
      // Pentru contract nou
      if (customContractNumber) {
        // NOUĂ LOGICĂ: Utilizator a specificat un număr custom
        console.log('[CONTRACT-GENERATE] GENERARE NOUĂ CU NUMĂR CUSTOM:', customContractNumber);
        
        const validationResult = await validateCustomContractNumber(customContractNumber);
        if (!validationResult.valid) {
          console.error('[CONTRACT-GENERATE] Eroare validare număr custom:', validationResult.error);
          return NextResponse.json({
            error: `Numărul contract invalid: ${validationResult.error}`,
            details: 'Verifică numărul contractului și încearcă din nou'
          }, { status: 400 });
        }
        
        contractData = {
          numar_contract: customContractNumber,
          serie: customContractNumber.split('-')[0] || 'CON'
        };
        console.log('[CONTRACT-GENERATE] ✅ Număr custom validat și acceptat:', customContractNumber);
      } else {
        // Generare automatică normală
        contractData = await getNextContractNumber(tipDocument, proiectId);
        console.log('[CONTRACT-GENERATE] GENERARE NOUĂ - Număr generat automat:', contractData.numar_contract);
      }
    }

    // 3. CALCULAREA SUMELOR PENTRU CONTRACT
    const calculContractResult = calculeazaSumaContractCuValoriEstimate(proiect, subproiecte, termenePersonalizate);
    
    console.log('[CONTRACT-GENERATE] Calcule contract finalizate:', {
      suma_finala_ron: calculContractResult.sumaFinala,
      suma_originala: calculContractResult.sumaOriginala,
      moneda_originala: calculContractResult.monedaOriginala,
      cursuri: calculContractResult.cursuriUtilizate,
      custom_number: !!customContractNumber
    });

    // 4. PREGĂTIREA DATELOR TEMPLATE PENTRU CONTRACT
    const placeholderData = prepareSimpleTemplateData(
      proiect,
      subproiecte,
      contractData,
      termenePersonalizate,
      observatii,
      dataContract // NOU: Pasează data contract custom
    );

    console.log('[CONTRACT-GENERATE] Template data contract pregătit pentru:', contractData.numar_contract);

    // 5. GENERAREA DOCUMENTULUI CONTRACT
    let contractBuffer: Buffer;
    let templateUsed = 'fallback';

    try {
      // Caută template-uri disponibile pentru contract
      const templateOptions = [
        path.join(TEMPLATES_DIR, 'contract-template.docx'),
        path.join(TEMPLATES_DIR, 'contract-template.txt'),
        path.join(TEMPLATES_DIR, 'default-template.docx'),
        path.join(TEMPLATES_DIR, 'default-template.txt')
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
          contractBuffer = await processDocxTemplate(templatePath, placeholderData);
        } else if (templatePath.endsWith('.txt')) {
          const processedText = await processTextTemplate(templatePath, placeholderData);
          contractBuffer = await convertTextToDocx(processedText);
        } else {
          throw new Error(`Tip template nepermis: ${path.extname(templatePath)}`);
        }
      } else {
        // Fallback la template hardcodat
        const fallbackTemplate = await createFallbackTemplate(placeholderData);
        contractBuffer = await convertTextToDocx(fallbackTemplate);
        templateUsed = 'fallback-no-template-found';
      }
    } catch (templateError) {
      console.error('[CONTRACT-GENERATE] Eroare template contract:', templateError);
      // Fallback la template hardcodat
      const fallbackTemplate = await createFallbackTemplate(placeholderData);
      contractBuffer = await convertTextToDocx(fallbackTemplate);
      templateUsed = `fallback-error: ${templateError instanceof Error ? templateError.message : 'unknown'}`;
    }

    console.log('[CONTRACT-GENERATE] Contract DOCX generat, template folosit:', templateUsed);

    // 6. GENERAREA ANEXEI (dacă este activă)
    let anexaBuffer: Buffer | null = null;
    let anexaGenerated = false;

    if (anexaActiva && anexaEtape.length > 0 && anexaDataStart && anexaDataFinal) {
      console.log('[CONTRACT-GENERATE] =================================');
      console.log('[CONTRACT-GENERATE] ÎNCEPE GENERAREA ANEXEI:', {
        anexaNumar,
        etape_count: anexaEtape.length,
        data_start: anexaDataStart,
        data_final: anexaDataFinal
      });

      try {
        anexaBuffer = await generateAnexaDocument(
	  proiect,
	  subproiecte,
	  contractData,
	  anexaNumar,
	  anexaDataStart,
	  anexaDataFinal,
	  anexaEtape,
	  anexaObservatii,
	  anexaDescrierelucrari,
	  dataContract // NOU: Pasează data contract custom
	);
        anexaGenerated = true;
        
        console.log('[CONTRACT-GENERATE] ✅ Anexă DOCX generată cu succes');
      } catch (anexaError) {
        console.error('[CONTRACT-GENERATE] ❌ Eroare la generarea anexei:', anexaError);
        // Continuă fără anexă, doar cu contractul
        anexaGenerated = false;
      }
    }

    // 7. SALVAREA ÎN BIGQUERY CU LOGICA INTELIGENTĂ
    const contractInfo = {
	  isEdit,
	  contractExistentId,
	  proiectId,
	  tipDocument,
	  contractData,
	  placeholderData,
	  termenePersonalizate,
	  observatii,
	  proiect,
	  subproiecte,
	  sumaOriginala: calculContractResult.sumaOriginala,
	  monedaOriginala: calculContractResult.monedaOriginala,
	  sumaFinala: calculContractResult.sumaFinala,
	  cursuriUtilizate: calculContractResult.cursuriUtilizate,
	  // Adaugă acestea:
	  sumaOriginalaNumeric: calculContractResult.sumaOriginalaNumeric,
	  monedaOriginalaForDB: calculContractResult.monedaOriginalaForDB,

      // NOU: Data contract custom (pentru contracte cu date din trecut)
      dataContract: dataContract || null,

      // Date anexă pentru salvare
      anexaActiva: anexaGenerated,
      anexaEtape: anexaGenerated ? anexaEtape : [],
      anexaNumar: anexaGenerated ? anexaNumar : null,
      anexaDataStart: anexaGenerated ? anexaDataStart : null,
      anexaDataFinal: anexaGenerated ? anexaDataFinal : null,
      anexaObservatii: anexaGenerated ? anexaObservatii : null
    };

    const contractId = await salveazaContractCuEtapeContract(contractInfo);
    
    console.log('[CONTRACT-GENERATE] ✅ Contract salvat în BigQuery cu ID:', contractId);
    if (anexaGenerated) {
      console.log('[CONTRACT-GENERATE] ✅ Anexă salvată în AnexeContract');
    }

    // 8. PREPARAREA RĂSPUNSULUI FINAL
    let finalBuffer: Buffer;
    let finalFileName: string;
    let contentType: string;

    if (anexaGenerated && anexaBuffer) {
      // Crează ZIP cu contract + anexă
      finalBuffer = await createContractAnexaZip(
        contractBuffer,
        anexaBuffer,
        contractData.numar_contract,
        anexaNumar
      );
      finalFileName = `${contractData.numar_contract}_cu_Anexa_${anexaNumar}.zip`;
      contentType = 'application/zip';
      
      console.log('[CONTRACT-GENERATE] 📦 ZIP creat cu contract + anexă');
    } else {
      // Doar contractul
      finalBuffer = contractBuffer;
      finalFileName = `${contractData.numar_contract}.docx`;
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      console.log('[CONTRACT-GENERATE] 📄 Răspuns doar cu contractul');
    }

    // 9. RĂSPUNSUL FINAL CU HEADERE INFORMATIVE
    const response = new NextResponse(finalBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${finalFileName}"`,
        'Content-Length': finalBuffer.length.toString(),
        
        // Headere informative pentru frontend
        'X-Contract-Number': contractData.numar_contract,
        'X-Contract-ID': contractId,
        'X-Template-Used': templateUsed,
        'X-Anexa-Generated': anexaGenerated.toString(),
        'X-Anexa-Number': anexaGenerated ? anexaNumar.toString() : '0',
        'X-Generation-Type': anexaGenerated ? 'dual' : 'single',
        'X-Is-Edit': isEdit.toString(),
        'X-Custom-Number': (!!customContractNumber).toString(),
        'X-Total-Etape': termenePersonalizate.length.toString(),
        'X-Total-Anexa-Etape': anexaGenerated ? anexaEtape.length.toString() : '0'
      }
    });

    console.log('[CONTRACT-GENERATE] =================================');
    console.log('[CONTRACT-GENERATE] ✅ PROCES FINALIZAT CU SUCCES:', {
      contract_number: contractData.numar_contract,
      contract_id: contractId,
      file_name: finalFileName,
      file_size: `${(finalBuffer.length / 1024).toFixed(2)} KB`,
      anexa_generated: anexaGenerated,
      is_edit: isEdit,
      custom_number: !!customContractNumber,
      template_used: templateUsed
    });
    console.log('[CONTRACT-GENERATE] =================================');

    return response;

  } catch (error) {
    console.error('[CONTRACT-GENERATE] =================================');
    console.error('[CONTRACT-GENERATE] ❌ EROARE FATALĂ:', error);
    console.error('[CONTRACT-GENERATE] =================================');

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
        error: 'Eroare necunoscută la generarea contractului',
        details: 'Contactează administratorul',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// PĂSTRATE toate funcțiile GET, PUT, DELETE identice din original
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const proiectId = url.searchParams.get('proiect_id');
    
    if (!proiectId) {
      return NextResponse.json({ error: 'proiect_id este necesar' }, { status: 400 });
    }

    // Test simplu de conectivitate
    const { proiect, subproiecte } = await loadProiectDataSimple(proiectId);
    
    return NextResponse.json({
      success: true,
      message: 'API funcțional',
      proiect_test: {
        id: proiect.ID_Proiect,
        denumire: proiect.Denumire,
        client: proiect.Client,
        subproiecte_count: subproiecte.length
      }
    });
    
  } catch (error) {
    console.error('Eroare la testarea API-ului:', error);
    return NextResponse.json(
      { error: 'Eroare la testarea API-ului' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({ message: 'PUT nu este implementat încă' }, { status: 501 });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ message: 'DELETE nu este implementat încă' }, { status: 501 });
}
