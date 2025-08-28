// ==================================================================
// CALEA: app/api/setari/contracte/templates/route.ts
// DATA: 28.08.2025 16:45 (ora României)
// DESCRIERE: API complet pentru gestionarea template-urilor de contracte
// PĂSTRATE: Pattern-uri din sistemul existent + funcționalități noi
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, readdir, unlink, stat, rename } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'contracte', 'templates');

// Helper pentru logging consistent cu pattern-ul existent
const logSuccess = (message: string) => {
  console.log(`✅ ${message}`);
};

const logError = (message: string, error?: any) => {
  console.error(`❌ ${message}`, error);
};

const logInfo = (message: string) => {
  console.log(`ℹ️ ${message}`);
};

// Asigură existența directorului
async function ensureTemplatesDir() {
  try {
    if (!existsSync(TEMPLATES_DIR)) {
      mkdirSync(TEMPLATES_DIR, { recursive: true });
      logSuccess(`Director template-uri creat: ${TEMPLATES_DIR}`);
      
      // Creează template default la prima rulare
      await createDefaultTemplate();
    }
  } catch (error) {
    logError('Eroare la crearea directorului template-uri:', error);
    throw error;
  }
}

// Creează template-ul default dacă nu există
async function createDefaultTemplate() {
  const defaultTemplatePath = path.join(TEMPLATES_DIR, 'contract-default-template.txt');
  
  if (!existsSync(defaultTemplatePath)) {
    const defaultTemplate = `**CONTRACT DE SERVICII**

**NR. {{contract.numar}} din {{contract.data}}**

**CAP.I. PĂRȚI CONTRACTANTE**

1. Între {{client.nume}}, persoană juridică română, cu sediul în {{client.adresa}}, înmatriculată la Oficiul Registrului Comerțului sub nr. {{client.nr_reg_com}}, C.U.I. {{client.cui}}, reprezentată prin {{client.reprezentant}} denumită în continuare **BENEFICIAR**

Și

2. **S.C. UNITAR PROIECT TDA S.R.L.** cu sediul social în {{firma.adresa}}, având CIF {{firma.cui}} și nr. de înregistrare la Registrul Comerțului {{firma.nr_reg_com}}, având contul IBAN: {{firma.cont_ing}}, deschis la banca ING, și cont Trezorerie IBAN: {{firma.cont_trezorerie}}, e-mail: {{firma.email}}, reprezentată legal de Damian Teodor, în calitate de Administrator, numită în continuare **PRESTATOR**.

**CAP. II. OBIECTUL CONTRACTULUI**

Obiectul contractului îl reprezintă: Realizare {{proiect.denumire}}

{{#proiect.descriere}}
Descriere detaliată: {{proiect.descriere}}
{{/proiect.descriere}}

{{#proiect.adresa}}
Adresa execuție: {{proiect.adresa}}
{{/proiect.adresa}}

**CAP. III. DURATA CONTRACTULUI:**

1. Contractul se încheie pe o perioadă determinată:
- Data început: {{proiect.data_start}}
- Data finalizare: {{proiect.data_final}}

**CAP. IV. PREȚUL DE EXECUTARE AL LUCRĂRII**

1. Prețul pe care Beneficiarul îl datorează prestatorului pentru serviciile sale este de **{{proiect.valoare}} {{proiect.moneda}}** la care se aplică suplimentar TVA.

**Valoarea totală contract: {{suma_totala_ron}} RON + TVA**

{{#observatii}}
**OBSERVAȚII SUPLIMENTARE:**
{{observatii}}
{{/observatii}}

---

**SEMNAT ÎN DATA: {{contract.data}}**

| BENEFICIAR | PRESTATOR |
|------------|-----------|
| **{{client.nume}}** | **S.C. UNITAR PROIECT TDA S.R.L.** |
| {{client.reprezentant}} | **DAMIAN TEODOR** |
| ................................. | ................................. |
`;

    await writeFile(defaultTemplatePath, defaultTemplate, 'utf8');
    logSuccess('Template default creat: contract-default-template.txt');
  }
}

// GET - Lista template-urilor disponibile
export async function GET(request: NextRequest) {
  try {
    await ensureTemplatesDir();

    const files = await readdir(TEMPLATES_DIR);
    const templateFiles = files.filter(file => 
      file.endsWith('.docx') || file.endsWith('.txt')
    );

    const templates = await Promise.all(
      templateFiles.map(async (fileName) => {
        const filePath = path.join(TEMPLATES_DIR, fileName);
        const stats = await stat(filePath);
        
        // Determină tipul documentului din numele fișierului
        let tipDocument = 'contract';
        if (fileName.includes('pv')) {
          tipDocument = 'pv';
        } else if (fileName.includes('anexa')) {
          tipDocument = 'anexa';
        }
        
        return {
          id: fileName.replace(/\.(docx|txt)$/, ''),
          nume: fileName,
          extensie: path.extname(fileName),
          marime: stats.size,
          data_modificare: stats.mtime.toISOString(),
          tip_document: tipDocument,
          path_relativ: `uploads/contracte/templates/${fileName}`,
          path_complet: filePath
        };
      })
    );

    // Sortează template-urile: default-uri primul, apoi alfabetic
    templates.sort((a, b) => {
      if (a.nume.includes('default') && !b.nume.includes('default')) return -1;
      if (!a.nume.includes('default') && b.nume.includes('default')) return 1;
      return a.nume.localeCompare(b.nume);
    });

    logInfo(`Încărcate ${templates.length} template-uri din ${TEMPLATES_DIR}`);

    return NextResponse.json({
      success: true,
      templates,
      total: templates.length,
      templates_dir: TEMPLATES_DIR,
      message: `${templates.length} template-uri disponibile`
    });

  } catch (error) {
    logError('Eroare la încărcarea template-urilor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea template-urilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Upload template nou
export async function POST(request: NextRequest) {
  try {
    await ensureTemplatesDir();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tipDocument = formData.get('tipDocument') as string || 'contract';
    const numeTemplate = formData.get('numeTemplate') as string;

    if (!file) {
      return NextResponse.json({ 
        success: false,
        error: 'Fișier template obligatoriu' 
      }, { status: 400 });
    }

    // Validări fișier
    const extensiePermise = ['.docx', '.txt'];
    const extensieFisier = path.extname(file.name);
    
    if (!extensiePermise.includes(extensieFisier)) {
      return NextResponse.json({ 
        success: false,
        error: 'Doar fișiere .docx și .txt sunt permise' 
      }, { status: 400 });
    }

    // Limitare dimensiune (10MB pentru DOCX, 1MB pentru TXT)
    const maxSize = extensieFisier === '.docx' ? 10 * 1024 * 1024 : 1 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ 
        success: false,
        error: `Fișierul nu poate depăși ${maxSize / (1024 * 1024)}MB` 
      }, { status: 400 });
    }

    // Generează numele fișierului salvat
    const timestamp = Date.now();
    const numeClean = numeTemplate 
      ? numeTemplate.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase()
      : file.name.replace(extensieFisier, '').replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase();
    
    const numeFisier = `${tipDocument}-${numeClean}-${timestamp}${extensieFisier}`;
    const caleCompleta = path.join(TEMPLATES_DIR, numeFisier);

    // Verifică dacă numele fișierului există deja
    if (existsSync(caleCompleta)) {
      return NextResponse.json({ 
        success: false,
        error: 'Un fișier cu acest nume există deja' 
      }, { status: 400 });
    }

    // Salvare fișier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(caleCompleta, buffer);

    logSuccess(`Template salvat: ${numeFisier} (${(file.size / 1024).toFixed(1)} KB)`);

    const template = {
      id: numeFisier.replace(extensieFisier, ''),
      nume: numeFisier,
      extensie: extensieFisier,
      marime: file.size,
      tip_document: tipDocument,
      path_relativ: `uploads/contracte/templates/${numeFisier}`,
      data_creare: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Template încărcat cu succes',
      template
    });

  } catch (error) {
    logError('Eroare la upload template:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la salvarea template-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizare template existent
export async function PUT(request: NextRequest) {
  try {
    await ensureTemplatesDir();

    const { 
      templateId, 
      continut, 
      numeNou 
    } = await request.json();

    if (!templateId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID template obligatoriu' 
      }, { status: 400 });
    }

    // Caută fișierul existent
    const files = await readdir(TEMPLATES_DIR);
    const existingFile = files.find(f => f.startsWith(templateId) || f.replace(/\.(docx|txt)$/, '') === templateId);
    
    if (!existingFile) {
      return NextResponse.json({ 
        success: false,
        error: 'Template-ul nu a fost găsit' 
      }, { status: 404 });
    }

    const caleExistenta = path.join(TEMPLATES_DIR, existingFile);

    // Actualizare conținut (doar pentru .txt) 
    if (continut && existingFile.endsWith('.txt')) {
      await writeFile(caleExistenta, continut, 'utf8');
      logSuccess(`Conținut template actualizat: ${existingFile}`);
    }

    // Redenumire fișier
    if (numeNou && numeNou !== existingFile) {
      const extensie = path.extname(existingFile);
      const numeNouClean = numeNou.replace(/[^a-zA-Z0-9\-_.]/g, '-');
      const numeNouComplet = numeNouClean.endsWith(extensie) ? numeNouClean : `${numeNouClean}${extensie}`;
      const caleNoua = path.join(TEMPLATES_DIR, numeNouComplet);
      
      // Verifică dacă noul nume există deja
      if (existsSync(caleNoua)) {
        return NextResponse.json({ 
          success: false,
          error: 'Un fișier cu noul nume există deja' 
        }, { status: 400 });
      }
      
      await rename(caleExistenta, caleNoua);
      logSuccess(`Template redenumit: ${existingFile} → ${numeNouComplet}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Template actualizat cu succes'
    });

  } catch (error) {
    logError('Eroare la actualizarea template-ului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea template-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Ștergere template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID template obligatoriu' 
      }, { status: 400 });
    }

    await ensureTemplatesDir();

    // Caută și șterge fișierul
    const files = await readdir(TEMPLATES_DIR);
    const fileToDelete = files.find(f => 
      f.startsWith(templateId) || f.replace(/\.(docx|txt)$/, '') === templateId
    );
    
    if (!fileToDelete) {
      return NextResponse.json({ 
        success: false,
        error: 'Template-ul nu a fost găsit' 
      }, { status: 404 });
    }

    // Protejează template-urile default
    if (fileToDelete.includes('default')) {
      return NextResponse.json({ 
        success: false,
        error: 'Template-urile default nu pot fi șterse. Pot fi doar actualizate.' 
      }, { status: 400 });
    }

    const caleCompleta = path.join(TEMPLATES_DIR, fileToDelete);
    await unlink(caleCompleta);

    logSuccess(`Template șters: ${fileToDelete}`);

    return NextResponse.json({
      success: true,
      message: 'Template șters cu succes'
    });

  } catch (error) {
    logError('Eroare la ștergerea template-ului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea template-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
