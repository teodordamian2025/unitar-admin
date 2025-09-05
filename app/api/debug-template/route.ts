// ==================================================================
// CALEA: app/api/debug-template/route.ts
// DATA: 05.09.2025 22:30 (ora României)
// DESCRIERE: Script pentru debugging încărcarea template-urilor
// SCOP: Identificare cauza pentru care se folosește fallback în loc de template real
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir, access } from 'fs/promises';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'contracte', 'templates');

// Funcția findBestTemplate copiată pentru debugging
async function debugFindBestTemplate(tipDocument: string = 'contract') {
  console.log('[DEBUG] Starting template search...');
  console.log('[DEBUG] Templates dir:', TEMPLATES_DIR);
  console.log('[DEBUG] Tip document:', tipDocument);
  
  const debugInfo: {
    templates_dir: string;
    tip_document: string;
    dir_exists: boolean;
    dir_contents: string[];
    template_files: string[];
    selected_template: any;
    errors: string[];
  } = {
    templates_dir: TEMPLATES_DIR,
    tip_document: tipDocument,
    dir_exists: false,
    dir_contents: [],
    template_files: [],
    selected_template: null,
    errors: []
  };
  
  try {
    // Verifică dacă directorul există
    await access(TEMPLATES_DIR);
    debugInfo.dir_exists = true;
    console.log('[DEBUG] Templates directory exists');
    
    // Listează conținutul directorului
    const files = await readdir(TEMPLATES_DIR);
    debugInfo.dir_contents = files;
    console.log('[DEBUG] Directory contents:', files);
    
    // Filtrează doar template-urile
    const templateFiles = files.filter(file => 
      file.endsWith('.txt') || file.endsWith('.docx')
    );
    debugInfo.template_files = templateFiles;
    console.log('[DEBUG] Template files found:', templateFiles);
    
    if (templateFiles.length === 0) {
      debugInfo.errors.push('No template files found in directory');
      return debugInfo;
    }
    
    // Caută template-ul specific pentru tipul de document
    const specificPattern = new RegExp(`${tipDocument}.*\\.(txt|docx)$`, 'i');
    let selectedTemplate = templateFiles.find(file => specificPattern.test(file));
    
    if (selectedTemplate) {
      console.log('[DEBUG] Specific template found:', selectedTemplate);
    } else {
      // Caută template-ul default
      const defaultPattern = /default.*\.(txt|docx)$/i;
      selectedTemplate = templateFiles.find(file => defaultPattern.test(file));
      
      if (selectedTemplate) {
        console.log('[DEBUG] Default template found:', selectedTemplate);
      } else {
        // Ia primul template disponibil
        selectedTemplate = templateFiles[0];
        console.log('[DEBUG] Using first available template:', selectedTemplate);
      }
    }
    
    if (selectedTemplate) {
      const templatePath = path.join(TEMPLATES_DIR, selectedTemplate);
      debugInfo.selected_template = {
        filename: selectedTemplate,
        path: templatePath,
        exists: false,
        content_preview: '',
        size: 0
      };
      
      try {
        // Verifică dacă fișierul template există și poate fi citit
        await access(templatePath);
        debugInfo.selected_template.exists = true;
        
        // Citește preview-ul conținutului
        const content = await readFile(templatePath, 'utf8');
        debugInfo.selected_template.size = content.length;
        debugInfo.selected_template.content_preview = content.substring(0, 500) + '...';
        
        console.log('[DEBUG] Template content loaded successfully');
        console.log('[DEBUG] Content size:', content.length);
        console.log('[DEBUG] Content preview:', content.substring(0, 200));
        
      } catch (readError) {
        debugInfo.errors.push(`Cannot read template file: ${readError}`);
        console.error('[DEBUG] Error reading template:', readError);
      }
    }
    
  } catch (dirError) {
    debugInfo.errors.push(`Directory access error: ${dirError}`);
    console.error('[DEBUG] Directory error:', dirError);
  }
  
  return debugInfo;
}

// Test procesarea placeholder-urilor
function debugPlaceholderProcessing() {
  const testTemplate = `**CONTRACT DE SERVICII**

**NR. {{contract.numar}} din {{contract.data}}**

**CAP.I. PĂRȚI CONTRACTANTE**

1. Între **{{client.nume}}**, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}}, denumită în continuare **BENEFICIAR**

{{termene_personalizate}}`;

  const testData = {
    contract: {
      numar: 'CONTR-1028-2025',
      data: '05.09.2025'
    },
    client: {
      nume: 'MAS-ART DESIGN SRL',
      cui: 'RO28921781',
      nr_reg_com: 'J19/361/2011',
      adresa: 'MUN. MIERCUREA CIUC, STR. CSIBA, NR.120, CAMERA 1',
      reprezentant: 'Administrator'
    },
    termene_personalizate: [
      {
        denumire: '1. DTAC',
        valoare: 1000,
        moneda: 'GBP',
        valoare_ron: 5856.4,
        procent_calculat: 11.59,
        termen_zile: 29
      },
      {
        denumire: 'Asistenta',
        valoare: 5000,
        moneda: 'EUR',
        valoare_ron: 25341.5,
        procent_calculat: 50.16,
        termen_zile: 30
      }
    ]
  };
  
  console.log('[DEBUG] Testing placeholder processing...');
  
  // Simulare procesare simpla
  let processed = testTemplate;
  
  // Înlocuiri simple
  const simpleReplacements = {
    '{{contract.numar}}': testData.contract.numar,
    '{{contract.data}}': testData.contract.data,
    '{{client.nume}}': testData.client.nume,
    '{{client.cui}}': testData.client.cui,
    '{{client.nr_reg_com}}': testData.client.nr_reg_com,
    '{{client.adresa}}': testData.client.adresa,
    '{{client.reprezentant}}': testData.client.reprezentant
  };
  
  for (const [placeholder, value] of Object.entries(simpleReplacements)) {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    processed = processed.replace(regex, value);
  }
  
  // Procesare termene
  let termeneText = '';
  if (testData.termene_personalizate && testData.termene_personalizate.length > 0) {
    termeneText = testData.termene_personalizate.map((termen, index) => {
      return `**Etapa ${index + 1}**: ${termen.procent_calculat.toFixed(1)}% (${termen.valoare.toFixed(2)} ${termen.moneda} = ${termen.valoare_ron.toFixed(2)} RON) - ${termen.denumire} (termen: ${termen.termen_zile} zile)`;
    }).join('\n\n');
  }
  
  processed = processed.replace('{{termene_personalizate}}', termeneText);
  
  return {
    original_template: testTemplate,
    processed_template: processed,
    replacements_made: Object.keys(simpleReplacements).length,
    termene_generated: termeneText
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('[DEBUG] Starting template debugging...');
    
    const debugResults = {
      timestamp: new Date().toISOString(),
      template_loading: {},
      placeholder_processing: {},
      environment: {
        cwd: process.cwd(),
        node_env: process.env.NODE_ENV,
        platform: process.platform
      }
    };
    
    // Test 1: Template loading
    console.log('[DEBUG] Testing template loading...');
    debugResults.template_loading = await debugFindBestTemplate('contract');
    
    // Test 2: Placeholder processing
    console.log('[DEBUG] Testing placeholder processing...');
    debugResults.placeholder_processing = debugPlaceholderProcessing();
    
    // Test 3: Verificare directorie uploads
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const uploadsExists = await access(uploadsDir).then(() => true).catch(() => false);
      
      if (uploadsExists) {
        const uploadsContents = await readdir(uploadsDir);
        debugResults.environment.uploads_dir = {
          exists: true,
          contents: uploadsContents
        };
        
        // Verifică subdirectorul contracte
        const contracteDir = path.join(uploadsDir, 'contracte');
        const contracteExists = await access(contracteDir).then(() => true).catch(() => false);
        
        if (contracteExists) {
          const contracteContents = await readdir(contracteDir);
          debugResults.environment.contracte_dir = {
            exists: true,
            contents: contracteContents
          };
        } else {
          debugResults.environment.contracte_dir = {
            exists: false,
            error: 'Contracte directory not found'
          };
        }
      } else {
        debugResults.environment.uploads_dir = {
          exists: false,
          error: 'Uploads directory not found'
        };
      }
    } catch (envError) {
      debugResults.environment.error = `Environment check failed: ${envError}`;
    }
    
    console.log('[DEBUG] Template debugging completed');
    
    return NextResponse.json({
      success: true,
      message: 'Template debugging completed',
      debug_results: debugResults,
      summary: {
        template_found: !!debugResults.template_loading.selected_template,
        template_readable: !!debugResults.template_loading.selected_template?.exists,
        placeholder_processing_works: !!debugResults.placeholder_processing.processed_template,
        uploads_dir_exists: !!debugResults.environment.uploads_dir?.exists,
        contracte_dir_exists: !!debugResults.environment.contracte_dir?.exists
      }
    });
    
  } catch (error) {
    console.error('[DEBUG] Template debugging failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Template debugging failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
