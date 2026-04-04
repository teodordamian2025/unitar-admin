// ==================================================================
// CALEA: app/api/actions/oferte/generate/route.ts
// DATA: 04.04.2026
// DESCRIERE: Generare document DOCX oferta din template
// PATTERN: Adaptat din contracts/generate/route.ts - JSZip + placeholder replacement
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;

const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'oferte', 'templates');

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
 * Gestioneaza inlocuirile pe text inline (in interiorul <w:t> tags),
 * nu doar standalone tags.
 */
function processOfertaPlaceholders(xml: string, data: any): string {
  let processed = normalizeXmlRuns(xml);

  // Data oferta in format DD.MM.YYYY
  const dataOferta = data.data_oferta || new Date().toLocaleDateString('ro-RO');
  const day = dataOferta.includes('-') ? dataOferta.split('-')[2] : dataOferta.split('.')[0];
  const month = dataOferta.includes('-') ? dataOferta.split('-')[1] : dataOferta.split('.')[1];
  const year = dataOferta.includes('-') ? dataOferta.split('-')[0] : dataOferta.split('.')[2];

  // Parse detalii_tehnice JSON
  let detalii: any = {};
  if (data.detalii_tehnice) {
    try { detalii = JSON.parse(data.detalii_tehnice); } catch { /* ignore */ }
  }

  // 1. Numar inregistrare: ____/____ sau ....../.............
  processed = processed.replace(/[_.]{3,}\s*\/\s*[_.]{3,}/g, `${data.numar_oferta || '____'}/${day || '__'}.${month || '__'}.${year || '____'}`);

  // 2. Pret: ___________ EUR + TVA si variante
  const valoareStr = data.valoare ? data.valoare.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '____';
  const monedaStr = data.moneda || 'EUR';
  processed = processed.replace(/[_.]{3,}\]?\s*(EUR|RON|USD)\s*\+\s*TVA/gi, `${valoareStr} ${monedaStr} + TVA`);
  processed = processed.replace(/[_.]{3,}\s*(EUR|RON|USD)/gi, `${valoareStr} ${monedaStr}`);

  // 3. Termen executie: ___ zile lucratoare
  const termenStr = data.termen_executie || '30';
  processed = processed.replace(/[_.]{3,}\s*zile\s*lucr[aă]toare/gi, `${termenStr} zile lucratoare`);

  // 4. Titlu - Tipul cladirii si Adresa/Localitate
  // Pattern: "Construcție nouă: Tipul clădirii — Adresă/Localitate"
  // sau "Consolidare Tipul clădirii — Adresă/Localitate"
  const tipCladire = detalii.tip_cladire ? escapeXml(detalii.tip_cladire) : 'Tipul cl\u0103dirii';
  const adresaProiect = data.proiect_adresa ? escapeXml(data.proiect_adresa) : 'Adres\u0103/Localitate';
  // Replace "Tipul clădirii — Adresă/Localitate" in various contexts
  processed = processed.replace(
    /Tipul cl[aă]dirii\s*[—–-]\s*Adres[aă]\/Localitate/g,
    `${tipCladire} \u2014 ${adresaProiect}`
  );

  // 5. Faza si Beneficiar - inlocuire in text inline
  // Pattern: "Faza: DTAC / PT+DE / DTAC+PT+DE  |  Beneficiar: Denumire"
  // sau "Faza: DALI / PT+DE / DALI+PT+DE" pe linie separata + "Beneficiar: Denumire" pe alta
  const fazaText = detalii.faza_proiectare || '';
  const clientNume = data.client_nume ? escapeXml(data.client_nume) : '';

  // Constructii noi pattern - faza + beneficiar pe aceeasi linie
  if (fazaText && clientNume) {
    processed = processed.replace(
      /Faza:\s*DTAC\s*\/\s*PT\+DE\s*\/\s*DTAC\+PT\+DE\s*\|\s*Beneficiar:\s*Denumire/g,
      `Faza: ${escapeXml(fazaText)}  |  Beneficiar: ${clientNume}`
    );
  } else if (fazaText) {
    processed = processed.replace(
      /Faza:\s*DTAC\s*\/\s*PT\+DE\s*\/\s*DTAC\+PT\+DE/g,
      `Faza: ${escapeXml(fazaText)}`
    );
  }

  // Consolidari pattern - "Faza: DALI" standalone
  if (fazaText) {
    processed = processed.replace(
      /Faza:\s*DALI\s*\/\s*PT\+DE\s*\/\s*DALI\+PT\+DE/g,
      `Faza: ${escapeXml(fazaText)}`
    );
    // Also handle already-filled "Faza: DALI" standalone (consolidari template)
    processed = processed.replace(
      /(<w:t[^>]*>)Faza:\s*DALI(<\/w:t>)/g,
      `$1Faza: ${escapeXml(fazaText)}$2`
    );
  }

  // Statie electrica pattern
  if (fazaText) {
    processed = processed.replace(
      /Faza:\s*DTAC,\s*PT,\s*DE/g,
      `Faza: ${escapeXml(fazaText)}`
    );
  }

  // Beneficiar: Denumire - replace in any context (within longer text or standalone)
  if (clientNume) {
    // Within longer text (e.g., "... Beneficiar: Denumire")
    processed = processed.replace(
      /Beneficiar:\s*Denumire/g,
      `Beneficiar: ${clientNume}`
    );
    // Standalone "Denumire" in w:t tag (for templates like statie_electrica)
    processed = processed.replace(
      /(<w:t[^>]*>)Denumire(<\/w:t>)/g,
      `$1${clientNume}$2`
    );
    // "Denumire monument" pattern for expertiza_monument
    processed = processed.replace(
      /Denumire monument/g,
      clientNume
    );
  }

  // 6. Adresa standalone in w:t (for templates that have it standalone)
  if (data.proiect_adresa) {
    processed = processed.replace(
      /(<w:t[^>]*>)Adresa(<\/w:t>)/g,
      `$1${escapeXml(data.proiect_adresa)}$2`
    );
  }

  // 7. Scop expertiza (expertiza_tehnica)
  if (detalii.scop_expertiza) {
    processed = processed.replace(
      /evaluare seismic[aă]\s*\/\s*pre-interven[tț]ie\s*\/\s*litigiu\s*\/\s*v[aâ]nzare-cump[aă]rare/gi,
      escapeXml(detalii.scop_expertiza)
    );
  }

  // 8. Cod LMI (expertiza monument) - replace "cod" standalone
  if (detalii.cod_lmi) {
    processed = processed.replace(
      /(<w:t[^>]*>)cod(<\/w:t>)/gi,
      `$1${escapeXml(detalii.cod_lmi)}$2`
    );
  }

  // 9. Categorie monument A / B
  if (detalii.categorie_monument) {
    processed = processed.replace(
      /Categorie:\s*A\s*\/\s*B/g,
      `Categorie: ${escapeXml(detalii.categorie_monument)}`
    );
  }

  // 10. Sectiunea 1.1 - Descriere lucrare
  // Constructii noi: "Se completează cu tipul clădirii, regimul de înălțime..."
  if (data.proiect_descriere) {
    // Constructii noi description placeholder
    processed = processed.replace(
      /Se completează cu tipul clădirii, regimul de înălțime, materialul structurii, suprafața construită aproximativă și orice specificații tehnice relevante primite de la beneficiar sau arhitect\./g,
      escapeXml(data.proiect_descriere)
    );
  }

  // Expertiza/other templates: [Se completează cu: ...]
  if (data.proiect_descriere) {
    processed = processed.replace(
      /\[Se completeaz[aă][^\]]*\]/gi,
      escapeXml(data.proiect_descriere)
    );
  }

  // 11. Structura propusa (constructii noi)
  if (detalii.structura_propusa) {
    processed = processed.replace(
      /Ex:\s*Structur[aă] din beton armat cu cadre \/ pere[tț]i structurali, funda[tț]ii pe radier general \/ funda[tț]ii izolate pe pilo[tț]i, regim S\+P\+4E, Sc ≈ 500 mp\/nivel\./g,
      escapeXml(detalii.structura_propusa)
    );
  }

  // 12. Tip interventie (consolidari) - replace placeholder
  if (detalii.tip_interventie) {
    // Replace "[Se completeaza cu tipul interventiei]" bracket pattern
    processed = processed.replace(
      /\[Se completeaz[aă] cu tipul interven[tț]iei\]/gi,
      escapeXml(detalii.tip_interventie)
    );
    // Replace "Consolidare" in title line (standalone in w:t after xml:space="preserve")
    processed = processed.replace(
      /(<w:t[^>]*>)\s*Consolidare\s*(<\/w:t>)/g,
      (match, before, after) => {
        return `${before} ${escapeXml(detalii.tip_interventie)} ${after}`;
      }
    );
  }

  // 12b. Consolidari description placeholders
  // First instance: main description (uses proiect_descriere)
  // Second instance: under "Tipul interventiei" (uses tip_interventie or proiect_descriere)
  {
    const descText = data.proiect_descriere ? escapeXml(data.proiect_descriere) : '';
    const tipIntText = detalii.tip_interventie ? escapeXml(detalii.tip_interventie) : descText;

    if (descText) {
      // Replace first occurrence only
      processed = processed.replace(
        /Se completeaza cu descrierea cladirii existente[^.]*\./i,
        descText
      );
    }

    // Replace remaining "Se completeaza cu descrierea interventiei propuse."
    // After tip_interventie bracket was already replaced, this is the remaining one
    if (tipIntText) {
      processed = processed.replace(
        /Se completeaza cu descrierea interventiei propuse\./i,
        tipIntText
      );
    }
    // If there's still a second instance, replace it too
    if (descText) {
      processed = processed.replace(
        /Se completeaza cu descrierea interventiei propuse\./i,
        descText
      );
    }
  }

  // 13. Grafic de plata - replace percentages sequentially
  const t1 = detalii.grafic_plata_t1 ?? 40;
  const t2 = detalii.grafic_plata_t2 ?? 40;
  const t3 = detalii.grafic_plata_t3 ?? 20;

  // Find "Grafic de plat" position and replace percentages after it
  const graficIdx = processed.indexOf('Grafic de plat');
  if (graficIdx >= 0) {
    const beforeGrafic = processed.substring(0, graficIdx);
    let afterGrafic = processed.substring(graficIdx);

    // Replace the first 40% with T1
    afterGrafic = afterGrafic.replace(
      /(<w:t[^>]*>)40%(<\/w:t>)/,
      `$1${t1}%$2`
    );
    // Replace the second 40% with T2
    afterGrafic = afterGrafic.replace(
      /(<w:t[^>]*>)40%(<\/w:t>)/,
      `$1${t2}%$2`
    );
    // Replace 20% with T3
    afterGrafic = afterGrafic.replace(
      /(<w:t[^>]*>)20%(<\/w:t>)/,
      `$1${t3}%$2`
    );

    processed = beforeGrafic + afterGrafic;
  }

  // 14. Proiect rezistenta - actualizare faza in tabelul oferta financiara
  if (fazaText) {
    // Constructii noi: "DTAC / PT+DE pentru construcție nouă"
    processed = processed.replace(
      /DTAC\s*\/\s*PT\+DE\s*pentru construc[tț]ie nou[aă]/g,
      `${escapeXml(fazaText)} pentru construc\u021Bie nou\u0103`
    );
    // Consolidari: "consolidare DALI / PT+DE / DALI+PT+DE" (full pattern)
    processed = processed.replace(
      /consolidare\s+DALI\s*\/\s*PT\+DE\s*\/\s*DALI\+PT\+DE/gi,
      `consolidare ${escapeXml(fazaText)}`
    );
    // Fallback: "consolidare DALI" standalone
    processed = processed.replace(
      /consolidare\s+DALI(?!\s*\/)/gi,
      `consolidare ${escapeXml(fazaText)}`
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
      detalii_tehnice: oferta.detalii_tehnice || '',
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

    // IMPORTANT: Nu escapam detalii_tehnice (JSON string) - se parseaza intern
    // Escapam restul datelor pentru XML
    const { detalii_tehnice: rawDetalii, ...restData } = templateData;
    const escapedData = escapeDataForXml(restData);
    // Adaugam detalii_tehnice neescapat pentru JSON.parse in processOfertaPlaceholders
    escapedData.detalii_tehnice = rawDetalii;
    const processedXml = processOfertaPlaceholders(documentXml, escapedData);

    zip.file('word/document.xml', processedXml);

    const generatedBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 5. Update oferta cu sablon_folosit in BigQuery
    const fileName = `${oferta.numar_oferta || 'oferta'}.docx`.replace(/[/\\?%*:|"<>]/g, '_');
    const now = new Date().toISOString();
    await bigquery.query({
      query: `
        UPDATE ${TABLE_OFERTE}
        SET sablon_folosit = ${escapeValue(templateFile)},
            data_actualizare = TIMESTAMP('${now}')
        WHERE id = '${escapeString(oferta_id)}' AND activ = true
      `,
      location: 'EU',
    });

    console.log(`[OFERTA-GENERATE] Document generat: ${fileName}`);

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
