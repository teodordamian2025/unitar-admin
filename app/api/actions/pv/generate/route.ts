// ==================================================================
// CALEA: app/api/actions/pv/generate/route.ts
// DATA: 07.09.2025 23:45 (ora României)
// MODIFICAT: Eliminare calcule financiare din generarea PV - CORECTAT sintaxa
// PĂSTRATE: Toate funcționalitățile contract/anexe + logica de business
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import path from 'path';
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

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_CONTRACTE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_CLIENTI = `\`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_ANEXE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.AnexeContract${tableSuffix}\``;
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;
const TABLE_PROCES_VERBALE = `\`${PROJECT_ID}.${DATASET}.ProcesVerbale${tableSuffix}\``;

console.log(`🔧 PV Generate API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Contracte${tableSuffix}, Proiecte${tableSuffix}, Clienti${tableSuffix}, Subproiecte${tableSuffix}, AnexeContract${tableSuffix}, EtapeContract${tableSuffix}, ProcesVerbale${tableSuffix}`);

const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'contracte', 'templates');

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// TOATE HELPER-urile PĂSTRATE identic din original
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

// ✅ FIX CRITICAL: Apel DIRECT la getNextContractNumber (fără fetch, fără UPDATE duplicat)
// DATA: 04.10.2025 23:15 (ora României)
// SCOP: Rezolvare problemă numerotare PV "sare din 2 în 2" - eliminat fetch către API
async function getNextPVNumber(proiectId?: string): Promise<any> {
  try {
    console.log(`🔢 [PV-NUMEROTARE] Generez număr PV pentru proiect: ${proiectId || 'N/A'}`);

    // ✅ APEL DIRECT la funcția exportată - elimină UPDATE duplicat
    const contractData = await getNextContractNumber('pv', proiectId);

    console.log(`✅ [PV-NUMEROTARE] Număr PV generat:`, {
      numar_pv: contractData.numar_contract,
      numar_secvential: contractData.numar_secvential,
      serie: contractData.serie
    });

    return {
      numar_pv: contractData.numar_contract,
      numar_secvential: contractData.numar_secvential,
      serie: contractData.serie,
      setari: contractData.setari
    };

  } catch (error) {
    console.error('❌ [PV-NUMEROTARE] Eroare la obținerea numărului PV:', error);

    // Fallback cu număr random dacă BigQuery eșuează
    const currentYear = new Date().getFullYear();
    const fallbackNumber = Math.floor(Math.random() * 1000) + 100;

    console.warn(`⚠️ [PV-NUMEROTARE] Folosesc număr fallback: PV-${fallbackNumber}-${currentYear}`);

    return {
      numar_pv: `PV-${fallbackNumber}-${currentYear}`,
      numar_secvential: fallbackNumber,
      serie: 'PV',
      setari: { tip_document: 'pv' }
    };
  }
}

// PĂSTRAT identic - Căutare contract și anexe pentru subproiectele selectate
async function findContractAndAnexeForSubproiecte(proiectId: string, subproiecteIds: string[]) {
  try {
    console.log('[PV-CONTRACT] Căutare contract/anexe pentru:', { proiectId, subproiecteIds });

    let contractData: any = null;
    let anexeData: any[] = [];

    // 1. CĂUTARE CONTRACT PRINCIPAL
    const contractQuery = `
      SELECT numar_contract, Data_Semnare, Status, ID_Contract, continut_json
      FROM ${TABLE_CONTRACTE}
      WHERE proiect_id = @proiectId 
        AND Status != 'Anulat'
      ORDER BY data_creare DESC 
      LIMIT 1
    `;

    const [contractRows] = await bigquery.query({
      query: contractQuery,
      params: { proiectId },
      location: 'EU',
    });

    if (contractRows.length > 0) {
      const contract = contractRows[0];
      
      console.log('[PV-CONTRACT] Date contract raw din BigQuery:', {
        numar_contract: contract.numar_contract,
        Data_Semnare_raw: contract.Data_Semnare,
        Data_Semnare_type: typeof contract.Data_Semnare,
        Status: contract.Status,
        has_continut_json: !!contract.continut_json
      });
      
      // Determină data contractului cu fallback la continut_json
      let dataContract = formatDate(contract.Data_Semnare);
      
      if (!dataContract || dataContract === '') {
        // Încearcă să extragi data din continut_json
        try {
          if (contract.continut_json) {
            const continutJson = typeof contract.continut_json === 'string' 
              ? JSON.parse(contract.continut_json) 
              : contract.continut_json;
            
            if (continutJson?.placeholderData?.contract?.data) {
              dataContract = continutJson.placeholderData.contract.data;
              console.log('[PV-CONTRACT] Data extrasă din continut_json:', dataContract);
            } else if (continutJson?.contract?.data) {
              dataContract = continutJson.contract.data;
              console.log('[PV-CONTRACT] Data extrasă din continut_json (format alternativ):', dataContract);
            }
          }
        } catch (jsonError) {
          console.error('[PV-CONTRACT] Eroare parsare continut_json:', jsonError);
        }
        
        // Ultimul fallback - data curentă
        if (!dataContract || dataContract === '') {
          dataContract = new Date().toLocaleDateString('ro-RO');
          console.log('[PV-CONTRACT] Folosesc data curentă ca ultimul fallback:', dataContract);
        }
      }
      
      contractData = {
        numar_contract: contract.numar_contract,
        data_semnare: dataContract,
        status: contract.Status,
        id_contract: contract.ID_Contract
      };
      
      console.log('[PV-CONTRACT] Contract principal găsit:', {
        numar: contractData.numar_contract,
        data_formatata: contractData.data_semnare,
        status: contractData.status
      });
    } else {
      console.log('[PV-CONTRACT] Nu s-a găsit contract pentru proiectul:', proiectId);
    }

    // 2. CĂUTARE ANEXE pentru subproiectele selectate (doar dacă sunt subproiecte)
    if (subproiecteIds.length > 0) {
      const subproiecteList = subproiecteIds.map(id => `'${id}'`).join(',');
      
      const anexeQuery = `
        SELECT DISTINCT 
          anexa_numar, 
          contract_id, 
          subproiect_id,
          data_start,
          data_final
        FROM ${TABLE_ANEXE_CONTRACT}
        WHERE subproiect_id IN (${subproiecteList})
          AND activ = true
        ORDER BY anexa_numar DESC
      `;

      const [anexeRows] = await bigquery.query({
        query: anexeQuery,
        location: 'EU',
      });

      if (anexeRows.length > 0) {
        // Grupează anexele după numărul anexei (prioritizează cel mai mare)
        const anexeMap = new Map();
        
        anexeRows.forEach((anexa: any) => {
          const anexaNum = anexa.anexa_numar;
          if (!anexeMap.has(anexaNum) || anexeMap.get(anexaNum).anexa_numar < anexaNum) {
            anexeMap.set(anexaNum, {
              anexa_numar: anexaNum,
              contract_id: anexa.contract_id,
              data_start: formatDate(anexa.data_start),
              data_final: formatDate(anexa.data_final),
              subproiecte_ids: []
            });
          }
          anexeMap.get(anexaNum).subproiecte_ids.push(anexa.subproiect_id);
        });

        anexeData = Array.from(anexeMap.values());
        
        console.log('[PV-CONTRACT] Anexe găsite:', anexeData.map(a => `Anexa ${a.anexa_numar}`));
      }
    }

    // 3. VERIFICARE ce subproiecte sunt în contract vs anexe
    let subproiecteInContract: string[] = [];
    let subproiecteInAnexe: string[] = [];

    if (subproiecteIds.length > 0 && contractData) {
      // Verifică ce subproiecte sunt în EtapeContract (contractul principal)
      const etapeContractQuery = `
        SELECT DISTINCT subproiect_id
        FROM ${TABLE_ETAPE_CONTRACT}
        WHERE contract_id = '${contractData.id_contract}'
          AND subproiect_id IS NOT NULL
          AND activ = true
      `;

      const [etapeContractRows] = await bigquery.query({
        query: etapeContractQuery,
        location: 'EU',
      });

      subproiecteInContract = etapeContractRows
        .map((row: any) => row.subproiect_id)
        .filter((id: string) => subproiecteIds.includes(id));

      // Subproiectele în anexe sunt cele găsite mai sus
      anexeData.forEach(anexa => {
        anexa.subproiecte_ids.forEach((id: string) => {
          if (subproiecteIds.includes(id) && subproiecteInAnexe.indexOf(id) === -1) {
            subproiecteInAnexe.push(id);
          }
        });
      });
    }

    return {
      contract: contractData,
      anexe: anexeData,
      subproiecte_in_contract: subproiecteInContract,
      subproiecte_in_anexe: subproiecteInAnexe,
      has_mix: subproiecteInContract.length > 0 && subproiecteInAnexe.length > 0
    };

  } catch (error) {
    console.error('[PV-CONTRACT] Eroare la căutarea contract/anexe:', error);
    return {
      contract: null,
      anexe: [],
      subproiecte_in_contract: [],
      subproiecte_in_anexe: [],
      has_mix: false
    };
  }
}

// PĂSTRAT identic - Funcție pentru încărcarea datelor proiect cu contract/anexe
async function loadProiectDataForPV(proiectId: string, subproiecteIds: string[] = []) {
  try {
    // PĂSTRAT: Încărcarea proiectului
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
    
    // PĂSTRAT: Încarcă date client
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
    
    // PĂSTRAT: Încarcă subproiecte
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

    // PĂSTRAT: Căutare contract și anexe
    const contractInfo = await findContractAndAnexeForSubproiecte(proiectId, subproiecteIds);
    
    // MODIFICAT: Eliminare câmpuri financiare din procesare
    const proiectProcessed = {
      ID_Proiect: extractSimpleValue(proiectRaw.ID_Proiect),
      Denumire: extractSimpleValue(proiectRaw.Denumire),
      Client: extractSimpleValue(proiectRaw.Client),
      Status: extractSimpleValue(proiectRaw.Status),
      Data_Start: extractSimpleValue(proiectRaw.Data_Start),
      Data_Final: extractSimpleValue(proiectRaw.Data_Final),
      Adresa: extractSimpleValue(proiectRaw.Adresa),
      Responsabil: extractSimpleValue(proiectRaw.Responsabil),
      
      client_id: clientData ? extractSimpleValue(clientData.id) : null,
      client_nume: clientData ? extractSimpleValue(clientData.nume) : extractSimpleValue(proiectRaw.Client),
      client_cui: clientData ? extractSimpleValue(clientData.cui) : null,
      client_reg_com: clientData ? extractSimpleValue(clientData.nr_reg_com) : null,
      client_adresa: clientData ? extractSimpleValue(clientData.adresa) : null,
      client_telefon: clientData ? extractSimpleValue(clientData.telefon) : null,
      client_email: clientData ? extractSimpleValue(clientData.email) : null,
      client_reprezentant: clientData ? extractSimpleValue(clientData.reprezentant) : 'Administrator'
    };
    
    // MODIFICAT: Eliminare câmpuri financiare din subproiecte
    const subproiecteProcessed = subproiecteRows.map((sub: any) => ({
      ID_Subproiect: extractSimpleValue(sub.ID_Subproiect),
      Denumire: extractSimpleValue(sub.Denumire),
      Status: extractSimpleValue(sub.Status),
      status_predare: extractSimpleValue(sub.status_predare) || 'Nepredat',
      Data_Final: extractSimpleValue(sub.Data_Final),
      Responsabil: extractSimpleValue(sub.Responsabil)
    }));
    
    return {
      proiect: proiectProcessed,
      subproiecte: subproiecteProcessed,
      contractInfo: contractInfo
    };
    
  } catch (error) {
    console.error('Eroare la extragerea datelor pentru PV:', error);
    throw error;
  }
}

// PĂSTRAT identic - Determină textul pentru contract/anexă în template
function determineContractText(contractInfo: any, subproiecteIds: string[]): string {
  const { contract, anexe, subproiecte_in_contract, subproiecte_in_anexe, has_mix } = contractInfo;

  console.log('[PV-CONTRACT] Determinare text pentru template:', {
    hasContract: !!contract,
    anexeCount: anexe.length,
    subproiecteInContract: subproiecte_in_contract.length,
    subproiecteInAnexe: subproiecte_in_anexe.length,
    hasMix: has_mix
  });

  // Cazul 1: Nu există contract
  if (!contract) {
    return 'LA CONTRACTUL [LIPSĂ CONTRACT - Proiectul nu are încă contract]';
  }

  // Cazul 2: Mix de subproiecte (unele în contract, altele în anexe)
  if (has_mix && anexe.length > 0) {
    const anexaNumar = Math.max(...anexe.map(a => a.anexa_numar));
    return `LA CONTRACTUL NR. ${contract.numar_contract} din ${contract.data_semnare} ȘI ANEXA NR. ${anexaNumar}`;
  }

  // Cazul 3: Doar anexe (subproiectele sunt doar în anexe)
  if (anexe.length > 0 && subproiecte_in_contract.length === 0 && subproiecte_in_anexe.length > 0) {
    const anexaNumar = Math.max(...anexe.map(a => a.anexa_numar));
    const anexaData = anexe.find(a => a.anexa_numar === anexaNumar);
    const dataAnexa = anexaData?.data_start || contract.data_semnare;
    return `LA CONTRACTUL NR. ${contract.numar_contract} - ANEXA NR. ${anexaNumar} din ${dataAnexa}`;
  }

  // Cazul 4: Doar contract (clasic)
  return `LA CONTRACTUL NR. ${contract.numar_contract} din ${contract.data_semnare}`;
}

// MODIFICAT: Procesarea placeholder-urilor pentru PV cu logica dinamică FĂRĂ referințe financiare
function processPVPlaceholders(text: string, data: any): string {
  let processed = text;
  
  // ÎNLOCUIRI SIMPLE DIRECTE - CORECTAT sintaxa
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
    
    // Firma info - PĂSTRAT identic
    '{{firma.nume}}': 'UNITAR PROIECT TDA SRL',
    '{{firma.cui}}': 'RO35639210',
    '{{firma.nr_reg_com}}': 'J2016002024405',
    '{{firma.adresa}}': 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
    '{{firma.telefon}}': '0765486044',
    '{{firma.email}}': 'contact@unitarproiect.eu',
    '{{firma.cont_ing}}': 'RO82INGB0000999905667533',
    '{{firma.cont_trezorerie}}': 'RO29TREZ7035069XXX018857',
    
    // NOU: Placeholder dinamic pentru contract/anexă
    '{{contract_sau_anexa_text}}': data.contract_sau_anexa_text || 'LA CONTRACTUL [NEDETERMINAT]',
    
    // COMPATIBILITATE RETROACTIVĂ: Păstrează placeholder-urile vechi
    '{{contract.numar}}': data.contract?.numar || '[VEZI contract_sau_anexa_text]',
    '{{contract.data}}': data.contract?.data || new Date().toLocaleDateString('ro-RO')
  };
  
  // Aplică înlocuirile simple
  for (const [placeholder, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processed = processed.replace(regex, value);
  }
  
  // PROCESARE COMPLEXĂ pentru secțiuni condiționale - PĂSTRAT din original
  
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

// MODIFICAT 03.02.2026 - Conversie TXT la DOCX cu CORECTAREA [CENTER] markers + suport ștampilă
function convertTextToWordXml(text: string): string {
  // Înlocuiește placeholder-ul ștampilei cu marker temporar
  const textWithMarker = replaceStampilaPlaceholderWithMarker(text);

  const paragraphs = textWithMarker.split('\n').map(line => {
    if (line.trim() === '') {
      return '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
    }

    // Detectează și procesează markerele de centrare
    const shouldCenter = line.includes('[CENTER]');
    const cleanLine = line.replace(/\[CENTER\]|\[\/CENTER\]/g, '');
    const alignment = shouldCenter ? '<w:jc w:val="center"/>' : '';

    if (cleanLine.trim() === '') {
      return '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
    }

    // Linia cu marker-ul ștampilei - returnează marker-ul pentru înlocuire ulterioară
    if (cleanLine.includes('___STAMPILA_PLACEHOLDER___')) {
      return `<w:p><w:pPr>${alignment}<w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:t>___STAMPILA_PLACEHOLDER___</w:t></w:r></w:p>`;
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

    return `<w:p><w:pPr>${alignment}<w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:t xml:space="preserve">${cleanLine}</w:t></w:r></w:p>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
  </w:body>
</w:document>`;
}

// MODIFICAT 03.02.2026 - Suport pentru inserarea ștampilei în DOCX
async function convertTextToDocx(processedText: string): Promise<Buffer> {
  const zip = new JSZip();
  const includeStampila = hasStampilaPlaceholder(processedText);

  console.log('[PV-DOCX-CONVERT] Include ștampilă:', includeStampila);

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
      console.log('[PV-DOCX-CONVERT] Ștampilă adăugată în word/media/stampila.png');
    } else {
      console.warn('[PV-DOCX-CONVERT] Nu s-a putut încărca ștampila, documentul va fi generat fără ea');
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
    console.log('[PV-DOCX-CONVERT] Marker ștampilă înlocuit cu XML imagine');
  }

  zip.file('word/document.xml', wordXml);

  return await zip.generateAsync({ type: 'nodebuffer' });
}

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

async function processPVTextTemplate(templatePath: string, data: any): Promise<string> {
  try {
    const templateContent = await readFile(templatePath, 'utf8');
    return processPVPlaceholders(templateContent, data);
  } catch (error) {
    console.error('Eroare la procesarea template-ului TXT PV:', error);
    throw error;
  }
}

// MODIFICAT: Template fallback cu placeholder dinamic pentru contract FĂRĂ referințe financiare
async function createPVFallbackTemplate(data: any): Promise<string> {
  const templateContent = `[CENTER]**PROCES VERBAL DE PREDARE PRIMIRE DIN DATA {{pv.data}} {{contract_sau_anexa_text}}**[/CENTER]

Încheiat azi {{pv.data}} între:

**S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social în {{firma.adresa}}, având CIF {{firma.cui}} și nr. de înregistrare la Registrul Comerțului {{firma.nr_reg_com}}, având contul IBAN: {{firma.cont_ing}}, deschis la banca ING, și cont Trezorerie IBAN: {{firma.cont_trezorerie}}, e-mail: {{firma.email}}, reprezentată legal de Damian Teodor, în calitate de Administrator, numită în continuare **PRESTATOR**.

Și

**{{client.nume}}**, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}}, denumită în continuare **BENEFICIAR**

Prin prezenta se confirmă că am predat / am primit în {{pv.numar_exemplare}} exemplare din **{{proiect.denumire}}** {{proiect.adresa}} {{subproiecte_lista}}.

{{observatii_clause}}

---

[CENTER]**SEMNAT ÎN DATA: {{pv.data}}**[/CENTER]

[CENTER]**BENEFICIAR:**[/CENTER]

[CENTER]**{{client.nume}}**[/CENTER]
[CENTER]{{client.reprezentant}}[/CENTER]

[CENTER].................................[/CENTER]


[CENTER]**PRESTATOR:**[/CENTER]

[CENTER]**S.C. UNITAR PROIECT TDA S.R.L.**[/CENTER]
[CENTER]**DAMIAN TEODOR**[/CENTER]
[CENTER]Administrator[/CENTER]

[CENTER]{{stampila_prestator}}[/CENTER]`;

  return processPVPlaceholders(templateContent, data);
}

// MODIFICAT: Preparare date template cu informații contract/anexă FĂRĂ valori financiare
function preparePVTemplateData(
  proiect: any, 
  subproiectePredate: any[],
  pvData: any,
  contractInfo: any,
  subproiecteIds: string[],
  observatii?: string
) {
  const dataPV = new Date().toLocaleDateString('ro-RO');
  
  const contractText = determineContractText(contractInfo, subproiecteIds);
  
  const templateData = {
    pv: {
      numar: pvData.numar_pv,
      data: dataPV,
      numar_exemplare: '3'
    },
    
    contract: {
      numar: contractInfo.contract?.numar_contract || '[LIPSĂ CONTRACT]',
      data: contractInfo.contract?.data_semnare || dataPV
    },
    
    contract_sau_anexa_text: contractText,
    
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
      status: sub.Status
    })),
    
    observatii: observatii || '',
    data_generare: new Date().toISOString()
  };
  
  return templateData;
}

// MODIFICAT: Salvează PV în BigQuery FĂRĂ calcule financiare
async function salveazaPVInBigQuery(pvInfo: any): Promise<string> {
  try {
    const pvId = `PV_${pvInfo.proiectId}_${Date.now()}`;
    
    const dataPredare = `DATE('${new Date().toISOString().split('T')[0]}')`;
    
    const insertQuery = `
      INSERT INTO ${TABLE_PROCES_VERBALE}
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
        NULL,
        NULL,
        NULL,
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

async function actualizeazaStatusPredare(proiectId: string, subproiecteIds: string[]) {
  try {
    const queryPromises: Promise<any>[] = [];

    if (subproiecteIds.length > 0) {
      subproiecteIds.forEach(subId => {
        const updateSubQuery = `
          UPDATE ${TABLE_SUBPROIECTE}
          SET status_predare = 'Predat', data_actualizare = CURRENT_TIMESTAMP()
          WHERE ID_Subproiect = '${subId}'
        `;
        queryPromises.push(bigquery.query({ query: updateSubQuery, location: 'EU' }));
      });
    } else {
      const updateProiectQuery = `
        UPDATE ${TABLE_PROIECTE}
        SET status_predare = 'Predat'
        WHERE ID_Proiect = '${proiectId}'
      `;
      queryPromises.push(bigquery.query({ query: updateProiectQuery, location: 'EU' }));
    }

    await Promise.all(queryPromises);
    
    console.log(`✅ Status predare actualizat pentru proiectul ${proiectId}`);
    
  } catch (error) {
    console.error('Eroare la actualizarea status predare:', error);
    throw error;
  }
}

// PĂSTRAT identic - FUNCȚIA POST PRINCIPALĂ cu integrarea contract/anexe
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

    const { proiect, subproiecte, contractInfo } = await loadProiectDataForPV(proiectId, subproiecteIds);
    
    console.log('[PV-GENERATE] Date proiect încărcate:', {
      proiect_id: proiect.ID_Proiect,
      client: proiect.Client,
      subproiecte_total: subproiecte.length,
      subproiecte_selectate: subproiecteIds.length,
      contract_gasit: !!contractInfo.contract,
      anexe_gasite: contractInfo.anexe.length
    });

    const pvData = await getNextPVNumber(proiectId);
    console.log('[PV-GENERATE] Număr PV generat:', pvData.numar_pv);

    let subproiectePredate: any[] = [];
    if (subproiecteIds.length > 0) {
      subproiectePredate = subproiecte.filter(sub => 
        subproiecteIds.includes(sub.ID_Subproiect)
      );
    }

    const templateData = preparePVTemplateData(
      proiect,
      subproiectePredate,
      pvData,
      contractInfo,
      subproiecteIds,
      observatii
    );

    console.log('[PV-GENERATE] Template data pregătit cu contract/anexă:', {
      pv_numar: pvData.numar_pv,
      contract_text: templateData.contract_sau_anexa_text,
      contract_gasit: !!contractInfo.contract,
      anexe_count: contractInfo.anexe.length
    });

    let pvBuffer: Buffer;
    let templateUsed = 'fallback';

    try {
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
        const fallbackTemplate = await createPVFallbackTemplate(templateData);
        pvBuffer = await convertTextToDocx(fallbackTemplate);
        templateUsed = 'fallback-no-template-found';
      }
    } catch (templateError) {
      console.error('[PV-GENERATE] Eroare template PV:', templateError);
      const fallbackTemplate = await createPVFallbackTemplate(templateData);
      pvBuffer = await convertTextToDocx(fallbackTemplate);
      templateUsed = `fallback-error: ${templateError instanceof Error ? templateError.message : 'unknown'}`;
    }

    console.log('[PV-GENERATE] PV DOCX generat, template folosit:', templateUsed);

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

    await actualizeazaStatusPredare(proiectId, subproiecteIds);
    console.log('[PV-GENERATE] ✅ Status predare actualizat');

    const fileName = `${pvData.numar_pv}.docx`;

    const response = new NextResponse(pvBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pvBuffer.length.toString(),
        
        'X-PV-Number': pvData.numar_pv,
        'X-PV-ID': pvId,
        'X-Template-Used': templateUsed,
        'X-Subproiecte-Count': subproiecteIds.length.toString(),
        'X-Proiect-ID': proiectId,
        'X-Contract-Found': contractInfo.contract ? 'true' : 'false',
        'X-Anexe-Count': contractInfo.anexe.length.toString()
      }
    });

    console.log('[PV-GENERATE] ================================');
    console.log('[PV-GENERATE] ✅ PROCES FINALIZAT CU SUCCES:', {
      pv_number: pvData.numar_pv,
      pv_id: pvId,
      file_name: fileName,
      file_size: `${(pvBuffer.length / 1024).toFixed(2)} KB`,
      subproiecte_predate: subproiecteIds.length,
      template_used: templateUsed,
      contract_found: !!contractInfo.contract,
      anexe_found: contractInfo.anexe.length
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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const proiectId = url.searchParams.get('proiect_id');
    
    if (!proiectId) {
      return NextResponse.json({ error: 'proiect_id este necesar' }, { status: 400 });
    }

    const { proiect, subproiecte, contractInfo } = await loadProiectDataForPV(proiectId);
    
    return NextResponse.json({
      success: true,
      message: 'API PV funcțional cu logica contract/anexe FĂRĂ informații financiare',
      proiect_test: {
        id: proiect.ID_Proiect,
        denumire: proiect.Denumire,
        client: proiect.Client,
        subproiecte_count: subproiecte.length,
        subproiecte_disponibile: subproiecte.filter(sub => sub.status_predare !== 'Predat').length,
        contract_gasit: !!contractInfo.contract,
        contract_numar: contractInfo.contract?.numar_contract || null,
        anexe_count: contractInfo.anexe.length
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
