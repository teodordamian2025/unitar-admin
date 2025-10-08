// ==================================================================
// CALEA: app/api/test-contract-data/route.ts
// DATA: 05.09.2025 21:15 (ora României)
// DESCRIERE: Script de test pentru extragerea și debugarea datelor contract
// SCOP: Identificare problema convertorului BigQuery și testare template processing
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { writeFile } from 'fs/promises';
import path from 'path';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const CONTRACTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;

console.log(`🔧 [Test Contract Data] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// CONVERTOR INSPIRAT DIN CHATBOT - care funcționează corect
function convertBigQueryValueImproved(value: any): any {
  if (value === null || value === undefined) return null;
  
  console.log(`[TEST] Processing value:`, {
    value,
    type: typeof value,
    isObject: typeof value === 'object',
    hasValue: value?.hasOwnProperty?.('value'),
    stringified: JSON.stringify(value)
  });
  
  // Pentru obiectele BigQuery cu proprietatea 'value'
  if (typeof value === 'object' && value !== null && 'value' in value) {
    console.log(`[TEST] BigQuery object detected - extracted value:`, value.value);
    return convertBigQueryValueImproved(value.value);
  }
  
  // Pentru obiectele Big din BigQuery (cei cu proprietatea 'c')
  if (typeof value === 'object' && value !== null && 'c' in value && Array.isArray(value.c)) {
    console.log(`[TEST] BigQuery Big object detected:`, value);
    
    // Convertește obiectul Big la string și apoi la număr
    try {
      const stringValue = value.toString();
      console.log(`[TEST] Big object toString():`, stringValue);
      
      const numericValue = parseFloat(stringValue);
      console.log(`[TEST] Big object converted to:`, numericValue);
      
      return isNaN(numericValue) ? 0 : numericValue;
    } catch (error) {
      console.error(`[TEST] Error converting Big object:`, error);
      return 0;
    }
  }
  
  // Pentru string-uri
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    
    // Încearcă conversie numerică
    const numericValue = parseFloat(trimmed);
    if (!isNaN(numericValue)) {
      console.log(`[TEST] String converted to number:`, trimmed, '→', numericValue);
      return numericValue;
    }
    
    return trimmed;
  }
  
  // Pentru numere
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? 0 : value;
  }
  
  // Pentru BigInt
  if (typeof value === 'bigint') {
    const result = Number(value);
    console.log(`[TEST] BigInt converted:`, value, '→', result);
    return result;
  }
  
  // Pentru alte tipuri
  return value;
}

// Funcție pentru formatarea datelor BigQuery
function formatBigQueryDate(dateValue: any): string | null {
  if (!dateValue) return null;
  
  try {
    let dateString = dateValue;
    
    if (typeof dateValue === 'object' && dateValue !== null && 'value' in dateValue) {
      dateString = dateValue.value;
    }
    
    if (!dateString) return null;
    
    const cleanDateString = dateString.toString().replace(/\s+UTC\s*$/, '').trim();
    console.log(`[TEST] Date processing:`, dateValue, '→', cleanDateString);
    
    const parsedDate = new Date(cleanDateString);
    
    if (isNaN(parsedDate.getTime())) {
      console.warn(`[TEST] Invalid date:`, cleanDateString);
      return null;
    }
    
    return parsedDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
  } catch (error) {
    console.error('[TEST] Date parsing error:', dateValue, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id') || '2025-09-01a-Proiect Islanda';
    
    console.log(`[TEST] Starting data extraction for project: ${proiectId}`);
    
    const testResults: any = {
      timestamp: new Date().toISOString(),
      proiect_id: proiectId,
      raw_data: {},
      converted_data: {},
      processing_steps: [],
      errors: []
    };
    
    // PASUL 1: Extragere proiect RAW
    console.log(`[TEST] STEP 1: Extracting project data...`);
    testResults.processing_steps.push('STEP 1: Extracting project data');
    
    try {
      const proiectQuery = `
        SELECT * FROM \`${PROJECT_ID}.${DATASET}.Proiecte\`
        WHERE ID_Proiect = @proiectId
        LIMIT 1
      `;
      
      const [proiectRows] = await bigquery.query({
        query: proiectQuery,
        params: { proiectId },
        location: 'EU',
      });
      
      if (proiectRows.length === 0) {
        throw new Error(`Project ${proiectId} not found`);
      }
      
      const proiectRaw = proiectRows[0];
      testResults.raw_data.proiect = proiectRaw;
      
      console.log(`[TEST] Raw project data extracted:`, {
        ID_Proiect: proiectRaw.ID_Proiect,
        Denumire: proiectRaw.Denumire,
        Valoare_Estimata_type: typeof proiectRaw.Valoare_Estimata,
        Valoare_Estimata_raw: proiectRaw.Valoare_Estimata
      });
      
    } catch (error) {
      testResults.errors.push(`Project extraction error: ${error}`);
      console.error('[TEST] Project extraction failed:', error);
    }
    
    // PASUL 2: Extragere client
    console.log(`[TEST] STEP 2: Extracting client data...`);
    testResults.processing_steps.push('STEP 2: Extracting client data');
    
    try {
      if (testResults.raw_data.proiect?.Client) {
        const clientQuery = `
          SELECT * FROM \`${PROJECT_ID}.${DATASET}.Clienti\`
          WHERE TRIM(LOWER(nume)) = TRIM(LOWER(@clientNume))
          AND activ = true
          LIMIT 1
        `;
        
        const [clientRows] = await bigquery.query({
          query: clientQuery,
          params: { clientNume: testResults.raw_data.proiect.Client },
          location: 'EU',
        });
        
        if (clientRows.length > 0) {
          testResults.raw_data.client = clientRows[0];
          console.log(`[TEST] Client found:`, clientRows[0].nume, clientRows[0].cui);
        } else {
          console.log(`[TEST] Client not found in database`);
          testResults.raw_data.client = null;
        }
      }
    } catch (error) {
      testResults.errors.push(`Client extraction error: ${error}`);
      console.error('[TEST] Client extraction failed:', error);
    }
    
    // PASUL 3: Extragere subproiecte
    console.log(`[TEST] STEP 3: Extracting subprojects...`);
    testResults.processing_steps.push('STEP 3: Extracting subprojects');
    
    try {
      const subproiecteQuery = `
        SELECT * FROM \`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\`
        WHERE ID_Proiect = @proiectId
        AND activ = true
        ORDER BY Denumire ASC
      `;
      
      const [subproiecteRows] = await bigquery.query({
        query: subproiecteQuery,
        params: { proiectId },
        location: 'EU',
      });
      
      testResults.raw_data.subproiecte = subproiecteRows;
      console.log(`[TEST] Subprojects found: ${subproiecteRows.length}`);
      
    } catch (error) {
      testResults.errors.push(`Subprojects extraction error: ${error}`);
      console.error('[TEST] Subprojects extraction failed:', error);
    }
    
    // PASUL 4: Aplicare convertor îmbunătățit
    console.log(`[TEST] STEP 4: Applying improved converter...`);
    testResults.processing_steps.push('STEP 4: Applying improved converter');
    
    if (testResults.raw_data.proiect) {
      const proiectRaw = testResults.raw_data.proiect;
      
      testResults.converted_data.proiect = {
        ID_Proiect: convertBigQueryValueImproved(proiectRaw.ID_Proiect),
        Denumire: convertBigQueryValueImproved(proiectRaw.Denumire),
        Client: convertBigQueryValueImproved(proiectRaw.Client),
        Status: convertBigQueryValueImproved(proiectRaw.Status),
        Valoare_Estimata: convertBigQueryValueImproved(proiectRaw.Valoare_Estimata),
        Data_Start: formatBigQueryDate(proiectRaw.Data_Start),
        Data_Final: formatBigQueryDate(proiectRaw.Data_Final),
        Adresa: convertBigQueryValueImproved(proiectRaw.Adresa),
        Descriere: convertBigQueryValueImproved(proiectRaw.Descriere),
        Responsabil: convertBigQueryValueImproved(proiectRaw.Responsabil),
        moneda: convertBigQueryValueImproved(proiectRaw.moneda) || 'RON',
        curs_valutar: convertBigQueryValueImproved(proiectRaw.curs_valutar),
        valoare_ron: convertBigQueryValueImproved(proiectRaw.valoare_ron)
      };
      
      console.log(`[TEST] Project converted:`, testResults.converted_data.proiect);
    }
    
    if (testResults.raw_data.client) {
      const clientRaw = testResults.raw_data.client;
      
      testResults.converted_data.client = {
        id: convertBigQueryValueImproved(clientRaw.id),
        nume: convertBigQueryValueImproved(clientRaw.nume),
        cui: convertBigQueryValueImproved(clientRaw.cui),
        nr_reg_com: convertBigQueryValueImproved(clientRaw.nr_reg_com),
        adresa: convertBigQueryValueImproved(clientRaw.adresa),
        telefon: convertBigQueryValueImproved(clientRaw.telefon),
        email: convertBigQueryValueImproved(clientRaw.email)
      };
      
      console.log(`[TEST] Client converted:`, testResults.converted_data.client);
    }
    
    if (testResults.raw_data.subproiecte) {
      testResults.converted_data.subproiecte = testResults.raw_data.subproiecte.map((sub: any) => ({
        ID_Subproiect: convertBigQueryValueImproved(sub.ID_Subproiect),
        Denumire: convertBigQueryValueImproved(sub.Denumire),
        Valoare_Estimata: convertBigQueryValueImproved(sub.Valoare_Estimata),
        Status: convertBigQueryValueImproved(sub.Status),
        moneda: convertBigQueryValueImproved(sub.moneda) || 'RON',
        curs_valutar: convertBigQueryValueImproved(sub.curs_valutar),
        valoare_ron: convertBigQueryValueImproved(sub.valoare_ron),
        Data_Final: formatBigQueryDate(sub.Data_Final)
      }));
      
      console.log(`[TEST] Subprojects converted: ${testResults.converted_data.subproiecte.length}`);
    }
    
    // PASUL 5: Testare template processing
    console.log(`[TEST] STEP 5: Testing template processing...`);
    testResults.processing_steps.push('STEP 5: Testing template processing');
    
    try {
      const mockContractData = {
        numar_contract: 'CONTR-1028-2025',
        data: '04.09.2025'
      };
      
      const templateData = {
        contract: mockContractData,
        client: testResults.converted_data.client || {
          nume: testResults.converted_data.proiect?.Client || 'CLIENT NECUNOSCUT',
          cui: 'CUI NECUNOSCUT',
          nr_reg_com: 'NR REG COM NECUNOSCUT',
          adresa: 'ADRESA NECUNOSCUTA',
          reprezentant: 'Administrator'
        },
        proiect: {
          denumire: testResults.converted_data.proiect?.Denumire || 'PROIECT NECUNOSCUT',
          descriere: testResults.converted_data.proiect?.Descriere || '',
          adresa: testResults.converted_data.proiect?.Adresa || '',
          data_start: testResults.converted_data.proiect?.Data_Start || 'TBD',
          data_final: testResults.converted_data.proiect?.Data_Final || 'TBD',
          responsabil: testResults.converted_data.proiect?.Responsabil || ''
        },
        suma_totala_originala: (testResults.converted_data.proiect?.Valoare_Estimata || 0).toFixed(2),
        moneda_originala: testResults.converted_data.proiect?.moneda || 'RON',
        suma_totala_ron: (testResults.converted_data.proiect?.valoare_ron || testResults.converted_data.proiect?.Valoare_Estimata || 0).toFixed(2)
      };
      
      testResults.converted_data.template_data = templateData;
      
      // Test simplu de placeholder replacement
      const testTemplate = `Contract: {{contract.numar_contract}}
Client: {{client.nume}} ({{client.cui}})
Proiect: {{proiect.denumire}}
Suma: {{suma_totala_originala}} {{moneda_originala}} = {{suma_totala_ron}} RON`;
      
      let processedTemplate = testTemplate;
      
      // Înlocuire manuală pentru test
      const replacements = {
        '{{contract.numar_contract}}': templateData.contract.numar_contract,
        '{{client.nume}}': templateData.client.nume,
        '{{client.cui}}': templateData.client.cui,
        '{{proiect.denumire}}': templateData.proiect.denumire,
        '{{suma_totala_originala}}': templateData.suma_totala_originala,
        '{{moneda_originala}}': templateData.moneda_originala,
        '{{suma_totala_ron}}': templateData.suma_totala_ron
      };
      
      for (const [placeholder, value] of Object.entries(replacements)) {
        processedTemplate = processedTemplate.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      }
      
      testResults.converted_data.template_test = {
        original: testTemplate,
        processed: processedTemplate,
        replacements_applied: Object.keys(replacements).length
      };
      
      console.log(`[TEST] Template processing test completed`);
      
    } catch (error) {
      testResults.errors.push(`Template processing error: ${error}`);
      console.error('[TEST] Template processing failed:', error);
    }
    
    // PASUL 6: Salvare rezultate în fișier
    console.log(`[TEST] STEP 6: Saving results to file...`);
    testResults.processing_steps.push('STEP 6: Saving results to file');
    
    try {
      const outputContent = `
================================================================
CONTRACT DATA EXTRACTION TEST RESULTS
================================================================
Timestamp: ${testResults.timestamp}
Project ID: ${testResults.proiect_id}

PROCESSING STEPS:
${testResults.processing_steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

ERRORS FOUND:
${testResults.errors.length > 0 ? testResults.errors.map((err, i) => `${i + 1}. ${err}`).join('\n') : 'None'}

================================================================
RAW DATA FROM BIGQUERY
================================================================

PROJECT RAW:
${JSON.stringify(testResults.raw_data.proiect, null, 2)}

CLIENT RAW:
${JSON.stringify(testResults.raw_data.client, null, 2)}

SUBPROJECTS RAW:
${JSON.stringify(testResults.raw_data.subproiecte, null, 2)}

================================================================
CONVERTED DATA (AFTER PROCESSING)
================================================================

PROJECT CONVERTED:
${JSON.stringify(testResults.converted_data.proiect, null, 2)}

CLIENT CONVERTED:
${JSON.stringify(testResults.converted_data.client, null, 2)}

SUBPROJECTS CONVERTED:
${JSON.stringify(testResults.converted_data.subproiecte, null, 2)}

TEMPLATE DATA PREPARED:
${JSON.stringify(testResults.converted_data.template_data, null, 2)}

================================================================
TEMPLATE PROCESSING TEST
================================================================

ORIGINAL TEMPLATE:
${testResults.converted_data.template_test?.original || 'N/A'}

PROCESSED TEMPLATE:
${testResults.converted_data.template_test?.processed || 'N/A'}

REPLACEMENTS APPLIED: ${testResults.converted_data.template_test?.replacements_applied || 0}

================================================================
COMPARISON WITH EXPECTED VALUES
================================================================

Expected Contract Values (from logs):
- Contract Number: CONTR-1028-2025
- Project Value: 9968.83 EUR
- RON Value: 50525.00 RON
- Client: MAS-ART DESIGN SRL

Extracted Values:
- Project Value: ${testResults.converted_data.proiect?.Valoare_Estimata || 'NOT FOUND'}
- RON Value: ${testResults.converted_data.proiect?.valoare_ron || 'NOT FOUND'}
- Currency: ${testResults.converted_data.proiect?.moneda || 'NOT FOUND'}
- Client: ${testResults.converted_data.client?.nume || 'NOT FOUND'}

================================================================
ANALYSIS AND RECOMMENDATIONS
================================================================

1. BigQuery Object Conversion:
   - Raw Valoare_Estimata type: ${typeof testResults.raw_data.proiect?.Valoare_Estimata}
   - Converted Valoare_Estimata: ${testResults.converted_data.proiect?.Valoare_Estimata}
   - Conversion successful: ${testResults.converted_data.proiect?.Valoare_Estimata ? 'YES' : 'NO'}

2. Client Data Availability:
   - Client found in database: ${testResults.raw_data.client ? 'YES' : 'NO'}
   - Client name matches: ${testResults.converted_data.client?.nume === 'MAS-ART DESIGN SRL' ? 'YES' : 'NO'}

3. Template Processing:
   - Placeholders replaced: ${testResults.converted_data.template_test?.replacements_applied || 0}
   - Processing successful: ${testResults.converted_data.template_test?.processed ? 'YES' : 'NO'}

================================================================
END OF TEST RESULTS
================================================================
      `;
      
      const outputPath = path.join(process.cwd(), 'uploads', 'temp', `contract-test-${Date.now()}.txt`);
      await writeFile(outputPath, outputContent, 'utf8');
      
      testResults.output_file = outputPath;
      console.log(`[TEST] Results saved to: ${outputPath}`);
      
    } catch (error) {
      testResults.errors.push(`File saving error: ${error}`);
      console.error('[TEST] File saving failed:', error);
    }
    
    // Returnare rezultate
    return NextResponse.json({
      success: true,
      message: 'Contract data extraction test completed',
      results: testResults,
      summary: {
        project_found: !!testResults.raw_data.proiect,
        client_found: !!testResults.raw_data.client,
        subprojects_count: testResults.raw_data.subproiecte?.length || 0,
        errors_count: testResults.errors.length,
        conversion_successful: !!testResults.converted_data.proiect?.Valoare_Estimata,
        template_test_successful: !!testResults.converted_data.template_test?.processed
      }
    });
    
  } catch (error) {
    console.error('[TEST] Main test execution failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Test execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
