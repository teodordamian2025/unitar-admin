// ==================================================================
// CALEA: app/api/actions/contracts/generate/route.ts  
// DATA: 05.09.2025 21:45 (ora României)
// FIX COMPLET: Convertor reparat + calculul sumei + template processing
// PĂSTRATE: Toate funcționalitățile + logica de calcule + numerotare contracte
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

// FIX PRINCIPAL 1: Helper corect pentru conversie valori BigQuery (inspirat din test)
const extractSimpleValue = (value: any): any => {
  if (value === null || value === undefined) return null;
  
  // Pentru obiectele BigQuery cu .value
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return extractSimpleValue(value.value);
  }
  
  // Pentru string-uri - PĂSTREAZĂ ca string dacă nu e pure numeric
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    
    // FIX CRITIC: Nu converti la număr dacă string-ul conține caractere non-numerice
    if (/^-?\d+\.?\d*$/.test(trimmed)) {
      const numericValue = parseFloat(trimmed);
      if (!isNaN(numericValue)) {
        console.log(`[FIX] Pure numeric string converted: "${trimmed}" → ${numericValue}`);
        return numericValue;
      }
    }
    
    // Returnează string-ul original pentru ID-uri, nume etc.
    console.log(`[FIX] String preserved: "${trimmed}"`);
    return trimmed;
  }
  
  // Pentru numere și boolean-uri
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  
  // Pentru date - întoarce string-ul direct
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  // Pentru obiectele Big din BigQuery (cei cu proprietatea 'c')
  if (typeof value === 'object' && value !== null && 'c' in value && Array.isArray(value.c)) {
    console.log(`[FIX] BigQuery Big object detected:`, value);
    
    try {
      const stringValue = value.toString();
      console.log(`[FIX] Big object toString(): "${stringValue}"`);
      
      const numericValue = parseFloat(stringValue);
      if (!isNaN(numericValue)) {
        console.log(`[FIX] Big object converted to: ${numericValue}`);
        return numericValue;
      }
    } catch (error) {
      console.error(`[FIX] Error converting Big object:`, error);
      return 0;
    }
  }
  
  // Pentru BigInt
  if (typeof value === 'bigint') {
    const result = Number(value);
    console.log(`[FIX] BigInt converted: ${value} → ${result}`);
    return result;
  }
  
  // Pentru alte tipuri, încearcă să convertești la string
  return String(value);
};

// Conversie sigură pentru numere (folosește extractSimpleValue)
const extractNumericValue = (value: any): number => {
  const simple = extractSimpleValue(value);
  if (simple === null || simple === undefined) return 0;
  
  // Dacă e deja număr, returnează-l
  if (typeof simple === 'number') return simple;
  
  // Dacă e string, încearcă conversie
  if (typeof simple === 'string') {
    const parsed = parseFloat(simple);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
};

// Helper pentru conversie BigQuery NUMERIC (folosește noul convertor)
const convertBigQueryNumeric = (value: any): number => {
  return extractNumericValue(value);
};

// Helper pentru formatarea datelor pentru BigQuery (păstrat)
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

// Helper pentru formatarea datelor pentru afișare (îmbunătățit)
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

// Helper pentru sanitizarea string-urilor (păstrat)
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

// Calculare durată în zile (îmbunătățit)
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

// FIX PRINCIPAL 2: Procesarea placeholder-urilor reparată și funcțională
function processPlaceholders(text: string, data: any): string {
  let processed = text;
  
  console.log('🔄 TEMPLATE PROCESSING - Datele de intrare:', {
    has_client_data: !!data.client,
    client_nume: data.client?.nume,
    client_cui: data.client?.cui,
    contract_numar: data.contract?.numar,
    proiect_denumire: data.proiect?.denumire,
    termene_count: data.termene_personalizate?.length || 0,
    suma_originala: data.suma_totala_originala,
    suma_ron: data.suma_totala_ron
  });
  
  
  // PROCESARE {{termene_personalizate}} ÎNAINTE DE TOATE CELELALTE
	console.log('🔥 PROCESARE TERMENE ÎNAINTE DE SIMPLE REPLACEMENTS');
	let termeneText = '';
	if (data.termene_personalizate && Array.isArray(data.termene_personalizate) && data.termene_personalizate.length > 0) {
	  termeneText = data.termene_personalizate.map((termen, index) => {
	    const etapaString = `**Etapa ${index + 1}**: ${(termen.procent_calculat || 0).toFixed(1)}% (${(termen.valoare || 0).toFixed(2)} ${termen.moneda || 'RON'} = ${(termen.valoare_ron || 0).toFixed(2)} RON) - ${termen.denumire || 'Fără denumire'} (termen: ${termen.termen_zile || 30} zile)`;
	    return etapaString;
	  }).join('\n\n');
	} else {
	  termeneText = `**Etapa 1**: 100.0% (${data.suma_totala_originala || '0.00'} ${data.moneda_originala || 'RON'} = ${data.suma_totala_ron || '0.00'} RON) - La predarea proiectului (termen: 60 zile)`;
	}

	processed = processed.replace('{{termene_personalizate}}', termeneText);
	console.log('🔥 TERMENE ÎNLOCUITE ÎNAINTE:', termeneText.substring(0, 100) + '...');
  
  
  // 1. ÎNLOCUIRI SIMPLE DIRECTE - acestea funcționează sigur
  const simpleReplacements: { [key: string]: string } = {
    // Contract info
    '{{contract.numar}}': data.contract?.numar || 'Contract-NR-TBD',
    '{{contract.data}}': data.contract?.data || new Date().toLocaleDateString('ro-RO'),
    
    // Client info - cu fallback la date minime
    '{{client.nume}}': data.client?.nume || data.client?.denumire || 'CLIENT NECUNOSCUT',
    '{{client.cui}}': data.client?.cui || 'CUI NECUNOSCUT',
    '{{client.nr_reg_com}}': data.client?.nr_reg_com || 'NR REG COM NECUNOSCUT',
    '{{client.adresa}}': data.client?.adresa || 'ADRESA NECUNOSCUTA',
    '{{client.telefon}}': data.client?.telefon || '',
    '{{client.email}}': data.client?.email || '',
    '{{client.reprezentant}}': data.client?.reprezentant || 'Administrator',
    
    // Proiect info - valorile corecte
    '{{proiect.denumire}}': data.proiect?.denumire || 'PROIECT NECUNOSCUT',
    '{{proiect.data_start}}': data.proiect?.data_start || 'TBD',
    '{{proiect.data_final}}': data.proiect?.data_final || 'TBD',
    '{{proiect.durata_zile}}': data.proiect?.durata_zile || 'TBD',
    '{{proiect.responsabil}}': data.proiect?.responsabil || '',
    
    // Firma info - UNITAR
    '{{firma.nume}}': 'UNITAR PROIECT TDA SRL',
    '{{firma.cui}}': 'RO35639210',
    '{{firma.nr_reg_com}}': 'J2016002024405',
    '{{firma.adresa}}': 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
    '{{firma.telefon}}': '0765486044',
    '{{firma.email}}': 'contact@unitarproiect.eu',
    '{{firma.cont_ing}}': 'RO82INGB0000999905667533',
    '{{firma.cont_trezorerie}}': 'RO29TREZ7035069XXX018857',
    
    // Sume monetare - direct din calculul corect
    '{{suma_totala_originala}}': data.suma_totala_originala || '0.00',
    '{{moneda_originala}}': data.moneda_originala || 'RON',
    '{{suma_totala_ron}}': data.suma_totala_ron || '0.00'
  };
  
  // Aplică înlocuirile simple
  for (const [placeholder, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    const beforeCount = (processed.match(regex) || []).length;
    processed = processed.replace(regex, value);
    
    if (beforeCount > 0) {
      console.log(`🔄 REPLACED: ${placeholder} → "${value}" (${beforeCount} occurrences)`);
    }
  }
  
  // 2. PROCESARE COMPLEXĂ - generare string-uri pentru secțiuni
  
  // Descriere proiect
  if (data.proiect?.descriere && data.proiect.descriere.trim()) {
    processed = processed.replace('{{proiect.descriere}}', `Descriere detaliată: ${data.proiect.descriere}`);
  } else {
    processed = processed.replace('{{proiect.descriere}}', '');
  }
  
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
    
  // DEBUGGING SPECIFIC pentru placeholder
  console.log('🔍 DEBUGGING PLACEHOLDER {{termene_personalizate}}');
  console.log('📄 Verificare template conține placeholder:', processed.includes('{{termene_personalizate}}'));
  console.log('📊 Lungime template înainte de înlocuire:', processed.length);
  
  const beforeReplace = processed;
  processed = processed.replace('{{termene_personalizate}}', termeneText);
  
  const wasReplaced = beforeReplace !== processed;
  console.log('🔄 Înlocuire efectuată:', wasReplaced);
  console.log('📊 Lungime template după înlocuire:', processed.length);
  console.log('📝 Diferența de lungime:', processed.length - beforeReplace.length);
  
  if (wasReplaced) {
    console.log('✅ PLACEHOLDER {{termene_personalizate}} ÎNLOCUIT CU SUCCES');
  } else {
    console.log('❌ PLACEHOLDER {{termene_personalizate}} NU S-A ÎNLOCUIT!');
    console.log('🔍 Verificare posibile cauze:');
    
    // Caută variații ale placeholder-ului
    const variations = [
      '{{termene_personalizate}}',
      '{{ termene_personalizate }}',
      '{{termene_personalizate }}',
      '{{ termene_personalizate}}',
      '{{termene personalizate}}',
      '{{termene_personalizate}}'
    ];
    
    variations.forEach(variation => {
      const found = processed.includes(variation);
      console.log(`🔍 Variația "${variation}": ${found ? 'GĂSITĂ' : 'Nu există'}`);
    });
    
    // Caută în jurul zonei unde ar trebui să fie
    const searchArea = processed.substring(processed.indexOf('Plățile vor fi realizate') - 50, processed.indexOf('Plățile vor fi realizate') + 200);
    console.log('📄 Zona din jurul "Plățile vor fi realizate":', searchArea);
  }
  
  // 4. CLAUZE CONDIȚIONALE
  
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
  
  console.log('✅ TEMPLATE PROCESSING COMPLET - toate secțiunile procesate');
  
  return processed;
}

// FIX CRITIC 3: Procesarea placeholder-urilor fragmentate în XML DOCX - REPARATĂ
function processPlaceholdersInXml(xml: string, data: any): string {
  console.log('🔧 PROCESARE XML DOCX - început');
  
  // 1. DEFRAGMENTARE PLACEHOLDER-URI îmbunătățită
  let defragmentedXml = xml;
  
  // Regex pentru găsirea și defragmentarea placeholder-urilor fragmentate pe 2-5 tag-uri
  for (let pass = 0; pass < 3; pass++) {
    console.log(`[XML] Defragmentation pass ${pass + 1}`);
    
    // Pattern pentru găsirea secvențelor de tag-uri <w:t> consecutive
    const consecutiveTagsPattern = /(<w:t[^>]*>)(.*?)(<\/w:t>)(\s*<w:[^>]*>)*(\s*<w:t[^>]*>)(.*?)(<\/w:t>)/g;
    
    defragmentedXml = defragmentedXml.replace(consecutiveTagsPattern, (match, openTag1, content1, closeTag1, middlePart, openTag2, content2, closeTag2) => {
      const combinedContent = content1 + content2;
      
      // Verifică dacă conținutul combinat formează un placeholder valid sau parțial
      if (combinedContent.includes('{{') || combinedContent.includes('}}') || 
          (content1.includes('{') && content2.includes('}'))) {
        console.log(`[XML] Defragmented: "${content1}" + "${content2}" → "${combinedContent}"`);
        return `${openTag1}${combinedContent}${closeTag2}`;
      }
      
      return match; // Returnează originalul dacă nu e placeholder
    });
  }
  
  // 2. PATTERN PENTRU PLACEHOLDER-URI COMPLETE ȘI PARȚIALE
  const placeholderPatterns = [
    // Placeholder-uri complete: {{ceva.altceva}}
    /\{\{([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z0-9_]*)\}\}/g,
    // Placeholder-uri parțiale: {{ceva (fără închidere)
    /\{\{([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z0-9_]*)/g,
    // Închideri parțiale: altceva}}
    /([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z0-9_]*)\}\}/g
  ];
  
  // 3. PROCESARE NORMALĂ cu placeholder-uri defragmentate
  const processedXml = defragmentedXml.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (match, content) => {
    // Verifică dacă conținutul conține placeholder-uri
    let processedContent = content;
    
    // Aplică toate pattern-urile de placeholder-uri
    placeholderPatterns.forEach(pattern => {
      if (pattern.test(processedContent)) {
        console.log(`[XML] Processing placeholder pattern in: "${processedContent}"`);
        
        // Aplică procesarea placeholder-urilor
        const tempProcessed = processPlaceholders(processedContent, data);
        
        // Doar dacă s-a schimbat ceva, înlocuiește
        if (tempProcessed !== processedContent) {
          console.log(`[XML] Placeholder processed: "${processedContent}" → "${tempProcessed}"`);
          processedContent = tempProcessed;
        }
      }
    });
    
    // Returnează tag-ul cu conținutul procesat
    return match.replace(content, processedContent);
  });
  
  console.log('✅ PROCESARE XML DOCX - terminată cu succes');
  
  return processedXml;
}

// FIX PRINCIPAL 4: EXTRAGERE PROIECT SIMPLIFICATĂ cu convertorul reparat
async function loadProiectDataSimple(proiectId: string) {
  console.log(`📥 EXTRAGERE SIMPLĂ pentru proiect: ${proiectId}`);
  
  try {
    // 1. Query direct pentru proiect - fără JOIN-uri complicate
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
    console.log('📊 DATE PROIECT RAW:', {
      ID_Proiect: proiectRaw.ID_Proiect,
      Denumire: proiectRaw.Denumire,
      Client: proiectRaw.Client,
      Valoare_Estimata: proiectRaw.Valoare_Estimata
    });
    
    // 2. Query separat pentru client - mai sigur
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
        console.log('👤 CLIENT GĂSIT:', clientData.nume, clientData.cui);
      } else {
        console.log('⚠️ Client nu găsit în BD, folosesc doar numele din proiect');
      }
    }
    
    // 3. Query pentru subproiecte
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
    
    console.log(`📂 SUBPROIECTE GĂSITE: ${subproiecteRows.length}`);
    
    // 4. PROCESARE CU CONVERTORUL REPARAT
    const proiectProcessed = {
      ID_Proiect: extractSimpleValue(proiectRaw.ID_Proiect),
      Denumire: extractSimpleValue(proiectRaw.Denumire),
      Client: extractSimpleValue(proiectRaw.Client),
      Status: extractSimpleValue(proiectRaw.Status),
      Valoare_Estimata: extractNumericValue(proiectRaw.Valoare_Estimata),
      Data_Start: extractSimpleValue(proiectRaw.Data_Start),
      Data_Final: extractSimpleValue(proiectRaw.Data_Final),
      Adresa: extractSimpleValue(proiectRaw.Adresa),
      Descriere: extractSimpleValue(proiectRaw.Descriere),
      Responsabil: extractSimpleValue(proiectRaw.Responsabil),
      moneda: extractSimpleValue(proiectRaw.moneda) || 'RON',
      curs_valutar: extractNumericValue(proiectRaw.curs_valutar),
      valoare_ron: extractNumericValue(proiectRaw.valoare_ron),
      
      // Date client - fie din BD, fie generate
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
    
    console.log('✅ EXTRAGERE COMPLETĂ cu succes:', {
      proiect: proiectProcessed.Denumire,
      client_gasit: !!clientData,
      subproiecte: subproiecteProcessed.length,
      valoare_proiect: proiectProcessed.Valoare_Estimata,
      moneda: proiectProcessed.moneda
    });
    
    return {
      proiect: proiectProcessed,
      subproiecte: subproiecteProcessed
    };
    
  } catch (error) {
    console.error('❌ EROARE la extragerea simplificată:', error);
    throw error;
  }
}

// FIX PRINCIPAL 5: PREGĂTIRE DATE PENTRU TEMPLATE cu calculul sumei reparat
function prepareSimpleTemplateData(
  proiect: any, 
  subproiecte: any[], 
  contractData: any,
  termene: any[],
  observatii?: string
) {
  console.log('🛠️ PREGĂTIRE DATE TEMPLATE - versiunea reparată');
  
  // FIX CRITIC: Calculare sume CORECTE din termene
  let sumaOriginalaCalculata = 0;
  let sumaRONCalculata = 0;
  let monedaContract = proiect.moneda || 'RON'; // MONEDA CONTRACTULUI = MONEDA PROIECTULUI
  
  if (termene.length > 0) {
    console.log('📋 Calculez suma din toți termenii contractului...');
    
    // Calculez totalul în RON din toți termenii
    sumaRONCalculata = termene.reduce((sum, t) => sum + (t.valoare_ron || 0), 0);
    
    // FIX PRINCIPAL: Convertesc totalul RON la moneda proiectului
    if (monedaContract === 'RON') {
      sumaOriginalaCalculata = sumaRONCalculata;
    } else {
      // Pentru proiecte în valută străină, convertesc totalul la acea valută
      const cursProiect = proiect.curs_valutar || CURSURI_VALUTAR[monedaContract] || 1;
      sumaOriginalaCalculata = sumaRONCalculata / cursProiect;
      
      console.log(`🔄 Conversie totală: ${sumaRONCalculata} RON / ${cursProiect} = ${sumaOriginalaCalculata.toFixed(2)} ${monedaContract}`);
    }
    
    console.log('📊 Calculul CORECT din termeni:', {
      termeni_count: termene.length,
      suma_ron_din_termeni: sumaRONCalculata,
      moneda_contract: monedaContract,
      suma_in_moneda_contract: sumaOriginalaCalculata
    });
    
  } else {
    // Fallback: dacă nu sunt termeni setați, folosește valoarea proiectului
    console.log('⚠️ Nu sunt termeni setați, folosesc valoarea proiectului ca fallback');
    
    sumaOriginalaCalculata = proiect.Valoare_Estimata || 0;
    sumaRONCalculata = proiect.valoare_ron || sumaOriginalaCalculata;
    monedaContract = proiect.moneda || 'RON';
    
    console.log(`📋 Fallback - suma: ${sumaOriginalaCalculata} ${monedaContract} = ${sumaRONCalculata} RON`);
  }
  
  const dataContract = new Date().toLocaleDateString('ro-RO');
  const durataZile = calculateDurationInDays(proiect.Data_Start, proiect.Data_Final);
  
  // Structura finală pentru template
  const templateData = {
    // Contract
    contract: {
      numar: contractData.numar_contract,
      data: dataContract
    },
    
    // Client - fie din BD, fie generat
    client: {
      nume: proiect.client_nume || 'Client necunoscut',
      cui: proiect.client_cui || 'CUI necunoscut',
      nr_reg_com: proiect.client_reg_com || 'Nr. reg. com. necunoscut',
      adresa: proiect.client_adresa || 'Adresa necunoscuta',
      telefon: proiect.client_telefon || '',
      email: proiect.client_email || '',
      reprezentant: 'Administrator'
    },
    
    // Proiect
    proiect: {
      denumire: proiect.Denumire,
      descriere: proiect.Descriere || '',
      adresa: proiect.Adresa || '',
      data_start: formatDate(proiect.Data_Start),
      data_final: formatDate(proiect.Data_Final),
      durata_zile: durataZile,
      responsabil: proiect.Responsabil || ''
    },
    
    // Firma UNITAR
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
    
    // Subproiecte
    subproiecte: subproiecte.map(sub => ({
      denumire: sub.Denumire,
      valoare: sub.Valoare_Estimata || 0,
      valoare_originala: sub.Valoare_Estimata || 0,
      moneda: sub.moneda || 'RON',
      status: sub.Status
    })),
    
    // Termene
    termene_personalizate: termene,
    
    // FIX PRINCIPAL: Sume finale CORECTE
    suma_totala_originala: sumaOriginalaCalculata.toFixed(2),
    suma_totala_ron: sumaRONCalculata.toFixed(2),
    moneda_originala: monedaContract,
    
    // Observații
    observatii: observatii || '',
    data_generare: new Date().toISOString()
  };
  
  console.log('✅ DATE TEMPLATE PREGĂTITE CORECT:', {
    client: templateData.client.nume,
    suma_originala: templateData.suma_totala_originala,
    moneda: templateData.moneda_originala,
    suma_ron: templateData.suma_totala_ron,
    termene_count: termene.length
  });
  
  return templateData;
}

// Calculare suma contract cu valorile estimate (păstrat din logica existentă, dar folosește convertorul reparat)
function calculeazaSumaContractCuValoriEstimate(proiect: any, subproiecte: any[], termenePersonalizate: any[]) {
  console.log('💰 CALCUL SUMA CONTRACT - versiunea finală corectă (multi-valută):', {
    proiect_id: proiect.ID_Proiect,
    proiect_valoare: proiect.Valoare_Estimata,
    proiect_moneda: proiect.moneda,
    subproiecte_count: subproiecte.length,
    termene_count: termenePersonalizate.length
  });

  let sumaOriginala = 0;
  let monedaOriginala = 'RON';
  let sumaFinalaRON = 0;
  const cursuriUtilizate: { [moneda: string]: number } = {};
  
  // Moneda contractului = moneda proiectului pentru consecvență
  monedaOriginala = proiect.moneda || 'RON';
  console.log(`🏷️ Moneda contractului: ${monedaOriginala}`);

  if (termenePersonalizate.length > 0) {
    console.log('📋 Calculez suma din TOȚI termenii contractului...');
    
    // Calculez totalul în RON din toți termenii
    let totalRONDinTermeni = 0;
    const detaliiTermeni: any[] = [];
    
    termenePersonalizate.forEach((termen, index) => {
      const valoareOriginala = termen.valoare || 0;
      const valoareRON = termen.valoare_ron || valoareOriginala;
      const monedaTermen = termen.moneda || 'RON';
      
      totalRONDinTermeni += valoareRON;
      
      detaliiTermeni.push({
        index: index + 1,
        denumire: termen.denumire,
        valoare: valoareOriginala,
        moneda: monedaTermen,
        valoare_ron: valoareRON,
        este_subproiect: termen.este_subproiect || false
      });
      
      // Stochează cursul pentru această monedă
      if (monedaTermen !== 'RON') {
        cursuriUtilizate[monedaTermen] = termen.curs_valutar || CURSURI_VALUTAR[monedaTermen] || 1;
      }
    });
    
    console.log('📊 Detalii termeni procesați:', detaliiTermeni);
    
    // FIX PRINCIPAL: Convertesc totalul RON la moneda proiectului
    if (monedaOriginala === 'RON') {
      sumaOriginala = totalRONDinTermeni;
      sumaFinalaRON = totalRONDinTermeni;
    } else {
      // Pentru proiecte în valută străină, convertesc totalul la acea valută
      const cursProiect = cursuriUtilizate[monedaOriginala] || 
                         proiect.curs_valutar || 
                         CURSURI_VALUTAR[monedaOriginala] || 1;
      
      sumaOriginala = totalRONDinTermeni / cursProiect;
      sumaFinalaRON = totalRONDinTermeni;
      
      // Adaugă cursul proiectului la cursurile utilizate
      cursuriUtilizate[monedaOriginala] = cursProiect;
      
      console.log(`🔄 Conversie totală: ${totalRONDinTermeni} RON / ${cursProiect} = ${sumaOriginala.toFixed(2)} ${monedaOriginala}`);
    }
    
    console.log('✅ REZULTAT CALCUL FINAL CORECT:', {
      total_ron_din_termeni: totalRONDinTermeni,
      suma_originala_in_moneda_proiect: sumaOriginala,
      moneda_originala: monedaOriginala,
      suma_finala_ron: sumaFinalaRON,
      cursuri_utilizate: cursuriUtilizate,
      numar_termeni_procesati: termenePersonalizate.length
    });
    
  } else {
    // Fallback: dacă nu sunt termeni setați, folosește valoarea proiectului
    console.log('⚠️ Nu sunt termeni setați, folosesc valoarea proiectului ca fallback');
    
    sumaOriginala = proiect.Valoare_Estimata || 0;
    sumaFinalaRON = proiect.valoare_ron || sumaOriginala;
    monedaOriginala = proiect.moneda || 'RON';
    
    if (proiect.moneda && proiect.moneda !== 'RON') {
      cursuriUtilizate[proiect.moneda] = proiect.curs_valutar || CURSURI_VALUTAR[proiect.moneda] || 1;
    }
    
    console.log(`📋 Fallback - suma: ${sumaOriginala} ${monedaOriginala} = ${sumaFinalaRON} RON`);
  }

  // Verificare finală cu proiectul
  const valoareProiectRON = proiect.valoare_ron || 0;
  const diferentaFataDeProiect = Math.abs(sumaFinalaRON - valoareProiectRON);
  const procentDiferenta = valoareProiectRON > 0 ? (diferentaFataDeProiect / valoareProiectRON) * 100 : 0;
  
  console.log('🔍 VERIFICARE FINALĂ:', {
    suma_calculata_ron: sumaFinalaRON,
    valoare_proiect_ron: valoareProiectRON,
    diferenta_absoluta: diferentaFataDeProiect,
    procent_diferenta: procentDiferenta.toFixed(2) + '%',
    in_limita_3_procent: procentDiferenta <= 3
  });

  return { 
    sumaFinala: sumaFinalaRON, 
    monedaFinala: monedaOriginala,
    cursuriUtilizate,
    sumaOriginala: Math.round(sumaOriginala * 100) / 100, // Rotunjire pentru afișare
    monedaOriginala
  };
}

// Funcții pentru template processing (păstrate și îmbunătățite)
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

// Template fallback cu structura reparată
async function createFallbackTemplate(data: any): Promise<string> {
  const templateContent = `**CONTRACT DE SERVICII**

**NR. {{contract.numar}} din {{contract.data}}**

**CAP.I. PĂRȚI CONTRACTANTE**

1. Între {{client.nume}}, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}} denumită în continuare **BENEFICIAR**

Și

2. **S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social în {{firma.adresa}}, având CIF {{firma.cui}} și nr. de înregistrare la Registrul Comerțului {{firma.nr_reg_com}}, având contul IBAN: {{firma.cont_ing}}, deschis la banca ING, și cont Trezorerie IBAN: {{firma.cont_trezorerie}}, e-mail: {{firma.email}}, reprezentată legal de Damian Teodor, în calitate de Administrator, numită în continuare **PRESTATOR**.

**CAP. II. OBIECTUL CONTRACTULUI**

Obiectul contractului îl reprezintă:

Realizare {{proiect.denumire}}

{{proiect.descriere}}

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

| BENEFICIAR | PRESTATOR |
|------------|-----------|
| **{{client.nume}}** | **S.C. UNITAR PROIECT TDA S.R.L.** |
| {{client.reprezentant}} | **DAMIAN TEODOR** |
| ................................. | ................................. |
`;

  return processPlaceholders(templateContent, data);
}

// Salvarea contractului cu datele corecte (păstrat din logica existentă)
async function salveazaContractCuDateCorecte(contractInfo: any): Promise<string> {
  const contractId = contractInfo.isEdit && contractInfo.contractExistentId 
    ? contractInfo.contractExistentId 
    : `CONTR_${contractInfo.proiectId}_${Date.now()}`;
  
  try {
    console.log('💾 Salvare contract cu valorile CORECTE (fără dublare):', {
      contractId,
      isEdit: contractInfo.isEdit,
      client_id: contractInfo.proiect.client_id,
      client_nume: contractInfo.placeholderData.client.nume,
      valoare_originala_corecta: contractInfo.sumaOriginala,
      moneda_corecta: contractInfo.monedaOriginala,
      suma_ron_corecta: contractInfo.sumaFinala,
      termene_count: contractInfo.termenePersonalizate?.length || 0,
      cursuri_utilizate: Object.keys(contractInfo.cursuriUtilizate || {})
    });

    const dataStart = contractInfo.proiect.Data_Start;
    const dataFinal = contractInfo.proiect.Data_Final;
    
    const dataSemnare = formatDateForBigQuery(new Date().toISOString().split('T')[0]);
    const dataExpirare = formatDateForBigQuery(
      typeof dataFinal === 'object' && dataFinal.value ? dataFinal.value : 
      typeof dataFinal === 'string' ? dataFinal : null
    );

    // FIX PRINCIPAL: Salvez valorile CORECTE în BigQuery
    const cursValutarPrincipal = contractInfo.monedaOriginala !== 'RON' ? 
      (contractInfo.cursuriUtilizate[contractInfo.monedaOriginala] || CURSURI_VALUTAR[contractInfo.monedaOriginala] || null) : 
      null;
    
    const dataCursValutar = cursValutarPrincipal ? 
      formatDateForBigQuery(new Date().toISOString().split('T')[0]) : 
      null;

    console.log('💾 Valorile CORECTE pentru salvare BigQuery:', {
      Valoare_corecta: contractInfo.sumaOriginala,
      Moneda_corecta: contractInfo.monedaOriginala,
      valoare_ron_corecta: contractInfo.sumaFinala,
      curs_principal: cursValutarPrincipal,
      data_curs: dataCursValutar
    });

    if (contractInfo.isEdit && contractInfo.contractExistentId) {
      // UPDATE pentru contractul existent - cu valorile CORECTE
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

      console.log(`✅ Contract actualizat în BigQuery cu valorile CORECTE: ${contractInfo.contractExistentId}`, {
        valoare_salvata: contractInfo.sumaOriginala,
        moneda_salvata: contractInfo.monedaOriginala,
        valoare_ron_salvata: contractInfo.sumaFinala
      });
      
    } else {
      // INSERT pentru contract nou - cu valorile CORECTE
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

      console.log(`✅ Contract nou salvat în BigQuery cu valorile CORECTE: ${contractId}`, {
        valoare_salvata: contractInfo.sumaOriginala,
        moneda_salvata: contractInfo.monedaOriginala,
        valoare_ron_salvata: contractInfo.sumaFinala
      });
    }

    return contractId;
    
  } catch (error) {
    console.error('❌ Eroare la salvarea contractului în BigQuery:', error);
    console.error('Detalii parametri:', {
      contractId,
      proiectId: contractInfo.proiectId,
      isEdit: contractInfo.isEdit,
      error: error instanceof Error ? error.message : 'Eroare necunoscuta'
    });
    throw error;
  }
}

// FUNCȚIA PRINCIPALĂ POST cu toate fix-urile aplicate
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

    console.log(`${isEdit ? 'Actualizare' : 'Generare'} contract pentru proiect: ${proiectId}`);
    console.log('FIX APLICAT: Folosim convertorul reparat și calculul sumei corect');

    // ✅ FOLOSEȘTE EXTRAGEREA SIMPLIFICATĂ cu convertorul reparat
    const { proiect, subproiecte } = await loadProiectDataSimple(proiectId);

    // ✅ CALCULARE SUME cu logica reparată
    const { sumaFinala, monedaFinala, cursuriUtilizate, sumaOriginala, monedaOriginala } = 
      calculeazaSumaContractCuValoriEstimate(proiect, subproiecte, termenePersonalizate);

    // Generare număr contract (păstrat ca înainte)
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

    // ✅ FOLOSEȘTE PREGĂTIREA REPARATĂ A DATELOR
    const placeholderData = prepareSimpleTemplateData(
      proiect, 
      subproiecte, 
      contractData,
      termenePersonalizate,
      observatii
    );

    // ✅ PROCESARE TEMPLATE cu logging detaliat pentru debugging
    let docxBuffer: Buffer;
    let templateUsed = 'fallback';

    console.log('🔍 DEBUT PROCESARE TEMPLATE');
    console.log(`📋 Tip document: ${tipDocument}`);
    console.log(`📊 Placeholder data pregătită: ${Object.keys(placeholderData).length} secțiuni`);

    try {
      console.log('🔎 Încercare găsire template...');
      const templatePath = await findBestTemplate(tipDocument);
      
      console.log(`📁 Rezultat findBestTemplate: ${templatePath || 'NULL'}`);
      
      if (templatePath) {
        console.log(`✅ Template găsit: ${templatePath}`);
        templateUsed = path.basename(templatePath);
        
        // Verifică existența fizică a fișierului
        try {
          const { access } = await import('fs/promises');
          await access(templatePath);
          console.log(`✅ Template accesibil fizic: ${templatePath}`);
        } catch (accessError) {
          console.error(`❌ Template nu poate fi accesat: ${accessError}`);
          throw new Error(`Template inaccesibil: ${accessError}`);
        }
        
        if (templatePath.endsWith('.docx')) {
          console.log('📖 Procesare template DOCX...');
          // ✅ FOLOSEȘTE processDocxTemplate cu XML processing reparat
          docxBuffer = await processDocxTemplate(templatePath, placeholderData);
          console.log('✅ Template DOCX procesat cu succes');
        } else if (templatePath.endsWith('.txt')) {
          console.log('📖 Procesare template TXT...');
          // ✅ FOLOSEȘTE processTextTemplate cu placeholder processing reparat
          const processedText = await processTextTemplate(templatePath, placeholderData);
          console.log(`✅ Template TXT procesat: ${processedText.length} caractere`);
          console.log('🔄 Conversie la DOCX...');
          docxBuffer = await convertTextToDocx(processedText);
          console.log('✅ Conversie DOCX completă');
        } else {
          console.error(`❌ Tip template nepermis: ${templatePath}`);
          throw new Error(`Tip template nepermis: ${path.extname(templatePath)}`);
        }
        
        console.log(`✅ TEMPLATE REAL FOLOSIT: ${templateUsed}`);
        
      } else {
        console.log('⚠️ findBestTemplate a returnat NULL - folosesc fallback');
        const fallbackTemplate = await createFallbackTemplate(placeholderData);
        docxBuffer = await convertTextToDocx(fallbackTemplate);
        templateUsed = 'fallback-no-template-found';
        console.log('✅ Fallback template folosit (nu s-a găsit template real)');
      }
    } catch (templateError) {
      console.error('❌ EROARE LA PROCESAREA TEMPLATE-ULUI:', templateError);
      console.error('📊 Detalii eroare:', {
        message: templateError instanceof Error ? templateError.message : 'Eroare necunoscută',
        stack: templateError instanceof Error ? templateError.stack : 'Nu există stack trace',
        templateUsed: templateUsed
      });
      console.log('🔄 Folosesc template fallback din cauza erorii');
      
      const fallbackTemplate = await createFallbackTemplate(placeholderData);
      docxBuffer = await convertTextToDocx(fallbackTemplate);
      templateUsed = `fallback-error-${templateError instanceof Error ? templateError.message.substring(0, 20) : 'unknown'}`;
      console.log(`✅ Fallback template folosit din cauza erorii: ${templateUsed}`);
    }

    // Salvare în BigQuery (păstrat ca înainte)
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
      templateUsed,
      isEdit,
      contractExistentId,
      proiect
    });

    console.log(`✅ Contract ${isEdit ? 'actualizat' : 'generat'} cu FIXES aplicat: ${contractData.numar_contract}`);

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${contractData.numar_contract}.docx"`,
        'X-Contract-Id': contractId,
        'X-Contract-Number': contractData.numar_contract,
        'X-Template-Used': templateUsed,
        'X-Action': isEdit ? 'updated' : 'generated',
        'X-Fix-Applied': 'complete-converter-and-calculation-fix-v2.0'
      }
    });

  } catch (error) {
    console.error('Eroare la generarea/actualizarea contractului cu FIX aplicat:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
