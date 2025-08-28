// ==================================================================
// CALEA: lib/templates-helpers.ts
// DATA: 28.08.2025 23:00 (ora României)
// DESCRIERE: Helper functions pentru template-uri contracte
// ==================================================================

import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'contracte', 'templates');

// Helper pentru logging
const logInfo = (message: string) => {
  console.log(`ℹ️ ${message}`);
};

const logError = (message: string, error?: any) => {
  console.error(`❌ ${message}`, error);
};

// Asigură existența directorului
export async function ensureTemplatesDir() {
  if (!existsSync(TEMPLATES_DIR)) {
    mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

// Funcție pentru citirea conținutului template-ului
export async function getTemplateContent(templateId: string): Promise<string | Buffer> {
  await ensureTemplatesDir();
  
  const files = await readdir(TEMPLATES_DIR);
  const templateFile = files.find(f => 
    f.startsWith(templateId) || f.replace(/\.(docx|txt)$/, '') === templateId
  );
  
  if (!templateFile) {
    throw new Error(`Template-ul ${templateId} nu a fost găsit`);
  }

  const caleCompleta = path.join(TEMPLATES_DIR, templateFile);
  
  // Pentru .txt returnează string, pentru .docx returnează Buffer
  if (templateFile.endsWith('.txt')) {
    return await readFile(caleCompleta, 'utf8');
  } else {
    return await readFile(caleCompleta);
  }
}

// Funcție pentru obținerea căii complete a template-ului  
export function getTemplatePath(templateId: string): string {
  return path.join(TEMPLATES_DIR, `${templateId}.docx`);
}

// Funcție pentru găsirea celui mai potrivit template pentru un tip de document
export async function findBestTemplate(tipDocument: string): Promise<string | null> {
  try {
    await ensureTemplatesDir();
    const files = await readdir(TEMPLATES_DIR);
    
    // Prioritatea căutării:
    // 1. Template specific pentru tipul de document (ex: contract-*)
    // 2. Template default pentru tipul de document (ex: contract-default-*)
    // 3. Orice template pentru tipul de document
    // 4. Template-ul default general
    // 5. Primul template disponibil
    
    const priorities = [
      files.filter(f => f.startsWith(`${tipDocument}-`) && !f.includes('default')),
      files.filter(f => f.startsWith(`${tipDocument}-default`)),
      files.filter(f => f.includes(tipDocument)),
      files.filter(f => f.includes('default')),
      files.filter(f => f.endsWith('.docx') || f.endsWith('.txt'))
    ];
    
    for (const group of priorities) {
      if (group.length > 0) {
        const selectedFile = group[0];
        const fullPath = path.join(TEMPLATES_DIR, selectedFile);
        logInfo(`Template selectat pentru ${tipDocument}: ${selectedFile}`);
        return fullPath;
      }
    }
    
    return null;
  } catch (error) {
    logError('Eroare la căutarea template-ului:', error);
    return null;
  }
}
