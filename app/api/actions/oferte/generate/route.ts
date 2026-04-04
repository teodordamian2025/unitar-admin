// ==================================================================
// CALEA: app/api/actions/oferte/generate/route.ts
// DATA: 04.04.2026
// DESCRIERE: Generare document DOCX oferta din template
// PATTERN: Adaptat din contracts/generate/route.ts - JSZip + placeholder replacement
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;

const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'oferte', 'templates');
const GENERATED_DIR = path.join(process.cwd(), 'uploads', 'oferte', 'generated');

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Template mapping: tip_oferta -> filename
const TEMPLATE_MAP: Record<string, string> = {
  'consolidari': 'Oferta_Consolidari.docx',
  'constructii_noi': 'Oferta_Constructii_Noi.docx',
  'expertiza_monument': 'Oferta_Expertiza_Monument.docx',
  'expertiza_tehnica': 'Oferta_Expertiza_Tehnica.docx',
  'statie_electrica': 'Oferta_Statie_Electrica_Model.docx',
};

// Escapare XML - identic cu contracts
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeDataForXml(data: any): any {
  if (typeof data === 'string') return escapeXml(data);
  if (Array.isArray(data)) return data.map(item => escapeDataForXml(item));
  if (data && typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = escapeDataForXml(value);
    }
    return result;
  }
  return data;
}

const escapeString = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
};

const escapeValue = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${escapeString(String(val))}'`;
};

/**
 * Normalizeaza XML runs split de Word.
 * Word poate sparge {{placeholder}} in mai multe <w:r> elements:
 *   <w:r><w:t>{{</w:t></w:r><w:r><w:t>client</w:t></w:r><w:r><w:t>.nume}}</w:t></w:r>
 * Aceasta functie le unifica inapoi intr-un singur <w:r>.
 */
function normalizeXmlRuns(xml: string): string {
  // Pattern: gaseste secvente de <w:r> care contin parti din {{ ... }}
  // Strategia: gasim toate textele <w:t>, le concatenam, apoi facem replace-urile
  // Abordare simplificata: concatenam textul din runs adiacente si refacem XML-ul

  // Pasul 1: Extragem textul vizibil si facem replace pe el
  // Pasul 2: Pentru placeholder-uri simple (text scurt), cautam in text concatenat

  // Abordare practica: reconstruim <w:t> tags unind cele care contin {{ sau }}
  let result = xml;

  // Gasim pattern-uri de tip: </w:t></w:r><w:r>...<w:t> care sparg placeholder-uri
  // Simplificat: stergem tag-urile intermediare intre {{ si }}
  const brokenPlaceholderRegex = /(\{\{[^}]*?)(<\/w:t><\/w:r>(?:<w:r>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t[^>]*>)+)([^{]*?\}\})/g;

  let iterations = 0;
  while (brokenPlaceholderRegex.test(result) && iterations < 50) {
    result = result.replace(brokenPlaceholderRegex, (match, before, middle, after) => {
      // Extragem doar textul din tag-urile intermediare
      const middleText = middle.replace(/<[^>]+>/g, '');
      return before + middleText + after;
    });
    iterations++;
  }

  return result;
}

/**
 * Proceseaza placeholder-urile specifice ofertelor in XML-ul DOCX.
 *
 * Template-urile folosesc:
 * - ____/____ pentru numar inregistrare (data format DD/MM)
 * - ___________ EUR + TVA (si variante) pentru pret
 * - Denumire (standalone) pentru numele beneficiarului
 * - [Se completeaza...] pentru sectiuni descriptive
 * - ___ zile lucratoare pentru termen
 * - Adresa pentru adresa proiect
 */
function processOfertaPlaceholders(xml: string, data: any): string {
  let processed = normalizeXmlRuns(xml);

  // Data oferta in format DD.MM.YYYY
  const dataOferta = data.data_oferta || new Date().toLocaleDateString('ro-RO');
  const day = dataOferta.includes('-') ? dataOferta.split('-')[2] : dataOferta.split('.')[0];
  const month = dataOferta.includes('-') ? dataOferta.split('-')[1] : dataOferta.split('.')[1];
  const year = dataOferta.includes('-') ? dataOferta.split('-')[0] : dataOferta.split('.')[2];

  // 1. Numar inregistrare: ____/____ -> numar_oferta/luna
  // Pattern in text extras: variante de underscores cu /
  processed = processed.replace(/_{3,}\s*\/\s*_{3,}/g, `${data.numar_oferta || '____'}/${day || '__'}.${month || '__'}.${year || '____'}`);

  // 2. Pret: ___________ EUR + TVA si variante
  // Cautam patterns cu underscores urmate de EUR/RON/USD + TVA
  const valoareStr = data.valoare ? data.valoare.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '____';
  const monedaStr = data.moneda || 'EUR';

  // Variante de pret cu underscores (diferite lungimi)
  processed = processed.replace(/_{3,}\]?\s*(EUR|RON|USD)\s*\+\s*TVA/gi, `${valoareStr} ${monedaStr} + TVA`);
  processed = processed.replace(/_{3,}\s*(EUR|RON|USD)/gi, `${valoareStr} ${monedaStr}`);
  // Pattern cu doar ____ (fara moneda, pt Statie Electrica care are ____ scurt)
  // Doar inlocuim daca e in context de pret (langa "lei", "euro", etc.)

  // 3. Termen executie: ___ zile lucratoare
  const termenStr = data.termen_executie || '30';
  processed = processed.replace(/_{3,}\s*zile\s*lucr[aă]toare/gi, `${termenStr} zile lucratoare`);

  // 4. Beneficiar "Denumire" - inlocuim standalone Denumire cu numele clientului
  // Cautam "Denumire" care apare ca text standalone (nu parte din alt cuvant)
  // In XML, textul e in <w:t> tags, asa ca cautam pattern-ul
  if (data.client_nume) {
    // Inlocuim "Denumire" standalone (ca beneficiar) - doar prima aparitie dupa "BENEFICIAR" sau "client"
    processed = processed.replace(
      /(<w:t[^>]*>)(Denumire)(<\/w:t>)/gi,
      `$1${escapeXml(data.client_nume)}$3`
    );
  }

  // 5. Adresa proiect
  if (data.proiect_adresa) {
    processed = processed.replace(
      /(<w:t[^>]*>)(Adresa)(<\/w:t>)/g,
      (match, before, text, after) => {
        // Doar inlocuim "Adresa" standalone, nu "Adresa:" sau parte din alte cuvinte
        return `${before}${escapeXml(data.proiect_adresa)}${after}`;
      }
    );
  }

  // 6. Sectiuni [Se completeaza...] - inlocuim cu descrierea proiectului
  if (data.proiect_descriere) {
    processed = processed.replace(
      /\[Se completeaz[aă][^\]]*\]/gi,
      escapeXml(data.proiect_descriere)
    );
  }

  // 7. Cod LMI (pentru expertiza monument)
  if (data.cod_lmi) {
    processed = processed.replace(
      /(<w:t[^>]*>)(cod)(<\/w:t>)/gi,
      `$1${escapeXml(data.cod_lmi)}$3`
    );
  }

  return processed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oferta_id } = body;

    if (!oferta_id) {
      return NextResponse.json({ error: 'oferta_id este obligatoriu' }, { status: 400 });
    }

    // 1. Incarca datele ofertei
    const [ofertaRows] = await bigquery.query({
      query: `SELECT * FROM ${TABLE_OFERTE} WHERE id = @id AND activ = true`,
      params: { id: oferta_id },
      location: 'EU',
    });

    if (ofertaRows.length === 0) {
      return NextResponse.json({ error: 'Oferta nu a fost gasita' }, { status: 404 });
    }

    const oferta = ofertaRows[0];

    // 2. Determina template-ul
    const tipOferta = oferta.tip_oferta || 'expertiza_tehnica';
    const templateFile = TEMPLATE_MAP[tipOferta];

    if (!templateFile) {
      return NextResponse.json({ error: `Tip oferta necunoscut: ${tipOferta}. Tipuri valide: ${Object.keys(TEMPLATE_MAP).join(', ')}` }, { status: 400 });
    }

    const templatePath = path.join(TEMPLATES_DIR, templateFile);

    // Verificam si in root daca nu e in templates dir
    let actualTemplatePath = templatePath;
    if (!existsSync(templatePath)) {
      const rootPath = path.join(process.cwd(), templateFile);
      if (existsSync(rootPath)) {
        actualTemplatePath = rootPath;
      } else {
        return NextResponse.json({
          error: `Template-ul ${templateFile} nu a fost gasit.`,
          details: `Cautat in: ${templatePath} si ${rootPath}`
        }, { status: 404 });
      }
    }

    // 3. Pregatire date pentru placeholder replacement
    const valoare = typeof oferta.valoare === 'object' && oferta.valoare && 'value' in oferta.valoare
      ? parseFloat(oferta.valoare.value)
      : parseFloat(oferta.valoare) || 0;

    const dataOfertaVal = oferta.data_oferta?.value || oferta.data_oferta || new Date().toISOString().split('T')[0];

    const templateData = {
      numar_oferta: oferta.numar_oferta || '',
      data_oferta: dataOfertaVal,
      client_nume: oferta.client_nume || '',
      client_email: oferta.client_email || '',
      client_telefon: oferta.client_telefon || '',
      client_cui: oferta.client_cui || '',
      client_adresa: oferta.client_adresa || '',
      proiect_denumire: oferta.proiect_denumire || '',
      proiect_descriere: oferta.proiect_descriere || '',
      proiect_adresa: oferta.proiect_adresa || '',
      valoare: valoare,
      moneda: oferta.moneda || 'EUR',
      termen_executie: oferta.termen_executie || '30',
      observatii: oferta.observatii || '',
    };

    // 4. Procesare template DOCX cu JSZip
    console.log(`[OFERTA-GENERATE] Procesare template: ${actualTemplatePath}`);
    console.log(`[OFERTA-GENERATE] Date: ${JSON.stringify({ numar: templateData.numar_oferta, client: templateData.client_nume, valoare: templateData.valoare })}`);

    const templateBuffer = await readFile(actualTemplatePath);
    const zip = new JSZip();
    await zip.loadAsync(templateBuffer);

    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      return NextResponse.json({ error: 'Template DOCX invalid - document.xml nu a fost gasit' }, { status: 500 });
    }

    // Escapam datele pentru XML si procesam placeholder-urile
    const escapedData = escapeDataForXml(templateData);
    const processedXml = processOfertaPlaceholders(documentXml, escapedData);

    zip.file('word/document.xml', processedXml);

    const generatedBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 5. Salvare fisier generat
    if (!existsSync(GENERATED_DIR)) {
      await mkdir(GENERATED_DIR, { recursive: true });
    }

    const fileName = `${oferta.numar_oferta || 'oferta'}.docx`.replace(/[/\\?%*:|"<>]/g, '_');
    const filePath = path.join(GENERATED_DIR, fileName);
    await writeFile(filePath, generatedBuffer);

    // 6. Update oferta cu path_fisier si sablon_folosit
    const relativePath = `uploads/oferte/generated/${fileName}`;
    const now = new Date().toISOString();
    await bigquery.query({
      query: `
        UPDATE ${TABLE_OFERTE}
        SET path_fisier = ${escapeValue(relativePath)},
            sablon_folosit = ${escapeValue(templateFile)},
            data_actualizare = TIMESTAMP('${now}')
        WHERE id = '${escapeString(oferta_id)}' AND activ = true
      `,
      location: 'EU',
    });

    console.log(`[OFERTA-GENERATE] Document salvat: ${filePath}`);

    // 7. Return DOCX ca response pentru download
    return new NextResponse(generatedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Oferta-Number': oferta.numar_oferta || '',
        'X-Template-Used': templateFile,
      },
    });

  } catch (error) {
    console.error('[OFERTA-GENERATE] Eroare:', error);
    return NextResponse.json({
      error: 'Eroare la generarea documentului',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
