// ==================================================================
// CALEA: lib/oferte-docx-generator.ts
// DESCRIERE: Helper partajat pentru generare DOCX oferta din template
// PATTERN: Extras din app/api/actions/oferte/generate/route.ts pentru reutilizare
// ==================================================================

import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'uploads', 'oferte', 'templates');
const MASTER_PORTFOLIO_FILE = path.join(process.cwd(), 'Oferta-portofoliu.docx');

export const OFERTE_TEMPLATE_MAP: Record<string, string> = {
  'consolidari': 'Oferta_Consolidari.docx',
  'constructii_noi': 'Oferta_Constructii_Noi.docx',
  'expertiza_monument': 'Oferta_Expertiza_Monument.docx',
  'expertiza_tehnica': 'Oferta_Expertiza_Tehnica.docx',
  'statie_electrica': 'Oferta_Statie_Electrica_Model.docx',
};

const PORTFOLIO_INJECT_TYPES: ReadonlySet<string> = new Set([
  'constructii_noi',
  'consolidari',
  'expertiza_tehnica',
  'expertiza_monument',
  'statie_electrica',
]);

let cachedMasterPortfolioBlock: string | null | undefined;

function findContainingParagraphStart(xml: string, text: string): number {
  const idx = xml.indexOf(text);
  if (idx < 0) return -1;
  const re = /<w:p(?:\s|>)/g;
  let lastStart = -1;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m.index >= idx) break;
    lastStart = m.index;
  }
  return lastStart;
}

function findContainingParagraphEnd(xml: string, text: string): number {
  const idx = xml.indexOf(text);
  if (idx < 0) return -1;
  const close = xml.indexOf('</w:p>', idx);
  if (close < 0) return -1;
  return close + '</w:p>'.length;
}

async function loadMasterPortfolioBlock(): Promise<string | null> {
  if (cachedMasterPortfolioBlock !== undefined) return cachedMasterPortfolioBlock;

  if (!existsSync(MASTER_PORTFOLIO_FILE)) {
    console.warn(`[oferte-docx] Master portofoliu lipsa: ${MASTER_PORTFOLIO_FILE} — folosesc portofoliile din template`);
    cachedMasterPortfolioBlock = null;
    return null;
  }

  try {
    const buf = await readFile(MASTER_PORTFOLIO_FILE);
    const zip = new JSZip();
    await zip.loadAsync(buf);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) {
      cachedMasterPortfolioBlock = null;
      return null;
    }

    const FIRST_HEADER = 'Din portofoliul nostru construcții noi:';
    const LAST_ITEM = 'Mănăstirea Cașin (Parcul Domenii) — expertiză structurală';

    const startIdx = findContainingParagraphStart(xml, FIRST_HEADER);
    const endIdx = findContainingParagraphEnd(xml, LAST_ITEM);

    if (startIdx < 0 || endIdx < 0 || startIdx >= endIdx) {
      console.warn('[oferte-docx] Marcaje portofoliu master inexistente — folosesc fallback template');
      cachedMasterPortfolioBlock = null;
      return null;
    }

    let block = xml.substring(startIdx, endIdx);
    block = block
      .replace(/\s+w:rsidR="[^"]*"/g, '')
      .replace(/\s+w:rsidRDefault="[^"]*"/g, '')
      .replace(/\s+w:rsidRPr="[^"]*"/g, '')
      .replace(/\s+w:rsidP="[^"]*"/g, '')
      .replace(/\s+w:rsidTr="[^"]*"/g, '')
      .replace(/\s+w14:paraId="[^"]*"/g, '')
      .replace(/\s+w14:textId="[^"]*"/g, '');

    // Remap toate referintele numId la "2" — singurul numId garantat in toate
    // template-urile. Master-ul foloseste numId 2/3/4/5 (cate o lista per
    // sectiune), dar template-urile nu au toate aceste id-uri definite in
    // numbering.xml, ceea ce face Word sa refuze deschiderea fisierului.
    block = block.replace(/(<w:numId\s+w:val=")\d+(")/g, '$12$2');

    cachedMasterPortfolioBlock = block;
    console.log(`[oferte-docx] Portofoliu master incarcat (${block.length} chars)`);
    return block;
  } catch (err) {
    console.error('[oferte-docx] Eroare la incarcarea portofoliului master:', err);
    cachedMasterPortfolioBlock = null;
    return null;
  }
}

function injectMasterPortfolio(templateXml: string, masterBlock: string): string {
  const portfolioStart = findContainingParagraphStart(templateXml, 'Din portofoliul');
  const cuStimStart = findContainingParagraphStart(templateXml, 'Cu stim');

  if (portfolioStart < 0 || cuStimStart < 0 || portfolioStart >= cuStimStart) {
    console.warn('[oferte-docx] Marcaje portofoliu lipsa in template — pastreaza portofoliul existent');
    return templateXml;
  }

  // "Cu stim" se afla intr-un tabel (semnatura/contact) in toate template-urile,
  // deci taierea la cuStimStart ar rupe deschiderea <w:tbl><w:tr><w:tc>. Daca
  // gasim un <w:tbl> intre portofoliu si "Cu stim", taiem la inceputul lui ca sa
  // pastram tabelul intact. Altfel folosim cuStimStart ca fallback.
  const nextTblPlain = templateXml.indexOf('<w:tbl>', portfolioStart);
  const nextTblWithAttr = templateXml.indexOf('<w:tbl ', portfolioStart);
  const candidates = [nextTblPlain, nextTblWithAttr].filter(i => i >= 0 && i < cuStimStart);
  const cutEnd = candidates.length > 0 ? Math.min(...candidates) : cuStimStart;

  return templateXml.substring(0, portfolioStart) + masterBlock + templateXml.substring(cutEnd);
}

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

function normalizeXmlRuns(xml: string): string {
  let result = xml;
  const brokenPlaceholderRegex = /(\{\{[^}]*?)(<\/w:t><\/w:r>(?:<w:r>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t[^>]*>)+)([^{]*?\}\})/g;
  let iterations = 0;
  while (brokenPlaceholderRegex.test(result) && iterations < 50) {
    result = result.replace(brokenPlaceholderRegex, (match, before, middle, after) => {
      const middleText = middle.replace(/<[^>]+>/g, '');
      return before + middleText + after;
    });
    iterations++;
  }
  return result;
}

function processOfertaPlaceholders(xml: string, data: any): string {
  let processed = normalizeXmlRuns(xml);

  const dataOferta = data.data_oferta || new Date().toLocaleDateString('ro-RO');
  const day = dataOferta.includes('-') ? dataOferta.split('-')[2] : dataOferta.split('.')[0];
  const month = dataOferta.includes('-') ? dataOferta.split('-')[1] : dataOferta.split('.')[1];
  const year = dataOferta.includes('-') ? dataOferta.split('-')[0] : dataOferta.split('.')[2];

  let detalii: any = {};
  if (data.detalii_tehnice) {
    try { detalii = JSON.parse(data.detalii_tehnice); } catch { /* ignore */ }
  }

  processed = processed.replace(/[_.]{3,}\s*\/\s*[_.]{3,}/g, `${data.numar_oferta || '____'}/${day || '__'}.${month || '__'}.${year || '____'}`);

  const valoareStr = data.valoare ? data.valoare.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '____';
  const monedaStr = data.moneda || 'EUR';

  const servicii: Array<{denumire: string; pret: number}> = detalii.servicii || [];
  if (servicii.length > 1) {
    const serviciiLines = servicii.map((s: any, i: number) =>
      `${i + 1}. ${escapeXml(s.denumire)} – ${s.pret.toLocaleString('ro-RO')} ${monedaStr} + TVA`
    ).join('</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">');
    const totalStr = `TOTAL: ${valoareStr} ${monedaStr} + TVA`;
    const serviciiBlock = serviciiLines + '</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + totalStr;

    processed = processed.replace(
      /[_.]{3,}\]?\s*(EUR|RON|USD)\s*\+\s*TVA/i,
      serviciiBlock
    );
    processed = processed.replace(/[_.]{3,}\s*(EUR|RON|USD)/gi, `${valoareStr} ${monedaStr}`);
  } else {
    processed = processed.replace(/[_.]{3,}\]?\s*(EUR|RON|USD)\s*\+\s*TVA/gi, `${valoareStr} ${monedaStr} + TVA`);
    processed = processed.replace(/[_.]{3,}\s*(EUR|RON|USD)/gi, `${valoareStr} ${monedaStr}`);
  }

  const termenStr = data.termen_executie || '30';
  processed = processed.replace(/[_.]{3,}\s*zile\s*lucr[aă]toare/gi, `${termenStr} zile lucratoare`);

  const tipCladire = detalii.tip_cladire ? escapeXml(detalii.tip_cladire) : 'Tipul clădirii';
  const adresaProiect = data.proiect_adresa ? escapeXml(data.proiect_adresa) : 'Adresă/Localitate';
  processed = processed.replace(
    /Tipul cl[aă]dirii\s*[—–-]\s*Adres[aă]\/Localitate/g,
    `${tipCladire} — ${adresaProiect}`
  );

  const fazaText = detalii.faza_proiectare || '';
  const clientNume = data.client_nume ? escapeXml(data.client_nume) : '';

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

  if (fazaText) {
    processed = processed.replace(
      /Faza:\s*DALI\s*\/\s*PT\+DE\s*\/\s*DALI\+PT\+DE/g,
      `Faza: ${escapeXml(fazaText)}`
    );
    processed = processed.replace(
      /(<w:t[^>]*>)Faza:\s*DALI(<\/w:t>)/g,
      `$1Faza: ${escapeXml(fazaText)}$2`
    );
  }

  if (fazaText) {
    processed = processed.replace(
      /Faza:\s*DTAC,\s*PT,\s*DE/g,
      `Faza: ${escapeXml(fazaText)}`
    );
  }

  if (clientNume) {
    processed = processed.replace(
      /Beneficiar:\s*Denumire/g,
      `Beneficiar: ${clientNume}`
    );
    processed = processed.replace(
      /(<w:t[^>]*>)Denumire(<\/w:t>)/g,
      `$1${clientNume}$2`
    );
    processed = processed.replace(
      /Denumire monument/g,
      clientNume
    );
  }

  if (data.proiect_adresa) {
    processed = processed.replace(
      /(<w:t[^>]*>)Adresa(<\/w:t>)/g,
      `$1${escapeXml(data.proiect_adresa)}$2`
    );
  }

  if (detalii.scop_expertiza) {
    processed = processed.replace(
      /evaluare seismic[aă]\s*\/\s*pre-interven[tț]ie\s*\/\s*litigiu\s*\/\s*v[aâ]nzare-cump[aă]rare/gi,
      escapeXml(detalii.scop_expertiza)
    );
  }

  if (detalii.cod_lmi) {
    processed = processed.replace(
      /(<w:t[^>]*>)cod(<\/w:t>)/gi,
      `$1${escapeXml(detalii.cod_lmi)}$2`
    );
  }

  if (detalii.categorie_monument) {
    processed = processed.replace(
      /Categorie:\s*A\s*\/\s*B/g,
      `Categorie: ${escapeXml(detalii.categorie_monument)}`
    );
  }

  if (data.proiect_descriere) {
    processed = processed.replace(
      /Se completează cu tipul clădirii, regimul de înălțime, materialul structurii, suprafața construită aproximativă și orice specificații tehnice relevante primite de la beneficiar sau arhitect\./g,
      escapeXml(data.proiect_descriere)
    );
  }

  if (data.proiect_descriere) {
    processed = processed.replace(
      /\[Se completeaz[aă][^\]]*\]/gi,
      escapeXml(data.proiect_descriere)
    );
  }

  if (detalii.structura_propusa) {
    processed = processed.replace(
      /Ex:\s*Structur[aă] din beton armat cu cadre \/ pere[tț]i structurali, funda[tț]ii pe radier general \/ funda[tț]ii izolate pe pilo[tț]i, regim S\+P\+4E, Sc ≈ 500 mp\/nivel\./g,
      escapeXml(detalii.structura_propusa)
    );
  }

  if (detalii.tip_interventie) {
    processed = processed.replace(
      /\[Se completeaz[aă] cu tipul interven[tț]iei\]/gi,
      escapeXml(detalii.tip_interventie)
    );
    processed = processed.replace(
      /(<w:t[^>]*>)\s*Consolidare\s*(<\/w:t>)/g,
      (match, before, after) => {
        return `${before} ${escapeXml(detalii.tip_interventie)} ${after}`;
      }
    );
  }

  {
    const descText = data.proiect_descriere ? escapeXml(data.proiect_descriere) : '';
    const tipIntText = detalii.tip_interventie ? escapeXml(detalii.tip_interventie) : descText;

    if (descText) {
      processed = processed.replace(
        /Se completeaza cu descrierea cladirii existente[^.]*\./i,
        descText
      );
    }

    if (tipIntText) {
      processed = processed.replace(
        /Se completeaza cu descrierea interventiei propuse\./i,
        tipIntText
      );
    }
    if (descText) {
      processed = processed.replace(
        /Se completeaza cu descrierea interventiei propuse\./i,
        descText
      );
    }
  }

  const t1 = detalii.grafic_plata_t1 ?? 40;
  const t2 = detalii.grafic_plata_t2 ?? 40;
  const t3 = detalii.grafic_plata_t3 ?? 20;

  const graficIdx = processed.indexOf('Grafic de plat');
  if (graficIdx >= 0) {
    const beforeGrafic = processed.substring(0, graficIdx);
    let afterGrafic = processed.substring(graficIdx);

    afterGrafic = afterGrafic.replace(
      /(<w:t[^>]*>)40%(<\/w:t>)/,
      `$1${t1}%$2`
    );
    afterGrafic = afterGrafic.replace(
      /(<w:t[^>]*>)40%(<\/w:t>)/,
      `$1${t2}%$2`
    );
    afterGrafic = afterGrafic.replace(
      /(<w:t[^>]*>)20%(<\/w:t>)/,
      `$1${t3}%$2`
    );

    processed = beforeGrafic + afterGrafic;
  }

  if (fazaText) {
    processed = processed.replace(
      /DTAC\s*\/\s*PT\+DE\s*pentru construc[tț]ie nou[aă]/g,
      `${escapeXml(fazaText)} pentru construcție nouă`
    );
    processed = processed.replace(
      /consolidare\s+DALI\s*\/\s*PT\+DE\s*\/\s*DALI\+PT\+DE/gi,
      `consolidare ${escapeXml(fazaText)}`
    );
    processed = processed.replace(
      /consolidare\s+DALI(?!\s*\/)/gi,
      `consolidare ${escapeXml(fazaText)}`
    );
  }

  return processed;
}

export interface OfertaForDocx {
  numar_oferta?: string;
  data_oferta?: any;
  client_nume?: string;
  client_email?: string;
  client_telefon?: string;
  client_cui?: string;
  client_adresa?: string;
  proiect_denumire?: string;
  proiect_descriere?: string;
  proiect_adresa?: string;
  valoare?: any;
  moneda?: string;
  termen_executie?: string;
  observatii?: string;
  detalii_tehnice?: string;
  tip_oferta?: string;
}

export interface DocxGenerationResult {
  buffer: Buffer;
  templateFile: string;
}

/**
 * Generează DOCX-ul ofertei din template + date.
 * Returnează buffer-ul DOCX și numele template-ului folosit.
 * Aruncă Error dacă tip_oferta este invalid sau template-ul lipsește.
 */
export async function generateOfertaDocx(oferta: OfertaForDocx): Promise<DocxGenerationResult> {
  const tipOferta = oferta.tip_oferta || 'expertiza_tehnica';
  const templateFile = OFERTE_TEMPLATE_MAP[tipOferta];

  if (!templateFile) {
    throw new Error(`Tip oferta necunoscut: ${tipOferta}. Tipuri valide: ${Object.keys(OFERTE_TEMPLATE_MAP).join(', ')}`);
  }

  const templatePath = path.join(TEMPLATES_DIR, templateFile);
  let actualTemplatePath = templatePath;
  if (!existsSync(templatePath)) {
    const rootPath = path.join(process.cwd(), templateFile);
    if (existsSync(rootPath)) {
      actualTemplatePath = rootPath;
    } else {
      throw new Error(`Template-ul ${templateFile} nu a fost gasit in ${templatePath} sau ${rootPath}`);
    }
  }

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

  const templateBuffer = await readFile(actualTemplatePath);
  const zip = new JSZip();
  await zip.loadAsync(templateBuffer);

  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('Template DOCX invalid - document.xml nu a fost gasit');
  }

  const { detalii_tehnice: rawDetalii, ...restData } = templateData;
  const escapedData = escapeDataForXml(restData);
  escapedData.detalii_tehnice = rawDetalii;
  let processedXml = processOfertaPlaceholders(documentXml, escapedData);

  if (PORTFOLIO_INJECT_TYPES.has(tipOferta)) {
    const masterBlock = await loadMasterPortfolioBlock();
    if (masterBlock) {
      processedXml = injectMasterPortfolio(processedXml, masterBlock);
    }
  }

  zip.file('word/document.xml', processedXml);

  const generatedBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  return {
    buffer: generatedBuffer,
    templateFile,
  };
}
