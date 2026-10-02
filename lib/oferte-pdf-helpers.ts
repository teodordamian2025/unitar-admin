// ==================================================================
// CALEA: lib/oferte-pdf-helpers.ts
// DESCRIERE: Helpers partajate pentru PDF-urile ofertelor (simplificat + complet):
//            amplasarea semnaturii/stampilei UNITAR in zona de semnatura.
// ==================================================================

import { loadStampilaImage } from '@/lib/docx-image-helper';

/** Imaginea semnaturii + stampilei (uploads/assets/stampila-unitar.png) ca data URI, sau null daca lipseste. */
export async function getStampilaDataUri(): Promise<string | null> {
  const buffer = await loadStampilaImage();
  if (!buffer) return null;
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

// ------------------------------------------------------------------
// PDF simplificat (HTML generat de noi)
// ------------------------------------------------------------------

export const OFERTA_SIGNATURES_CSS = `
  .signatures { page-break-inside: avoid; }
  .sig-box .sig-space { height: 3.4cm; margin-top: 8px; display: flex; align-items: flex-end; justify-content: center; }
  .sig-box .sig-space img { max-height: 3.4cm; max-width: 100%; width: auto; height: auto; }
  .sig-box .line { margin-top: 2px; }
`;

/**
 * Blocul de semnaturi: Furnizor (cu stampila UNITAR deasupra liniei) + Beneficiar.
 * Ambele casete au aceeasi inaltime rezervata, ca liniile sa ramana aliniate.
 */
export function buildOfertaSignaturesHtml(clientNume: string, stampilaSrc: string | null): string {
  return `
        <div class="signatures">
          <div class="sig-box">
            <strong>Furnizor</strong>
            <div>UNITAR PROIECT TDA SRL</div>
            <div class="sig-space">${stampilaSrc ? `<img src="${stampilaSrc}" alt="Semnatura si stampila UNITAR PROIECT" />` : ''}</div>
            <div class="line">Semnatura si stampila</div>
          </div>
          <div class="sig-box">
            <strong>Beneficiar</strong>
            <div>${clientNume}</div>
            <div class="sig-space"></div>
            <div class="line">Semnatura si stampila</div>
          </div>
        </div>`;
}

// ------------------------------------------------------------------
// PDF complet (DOCX -> HTML cu mammoth -> PDF)
// ------------------------------------------------------------------

export const PDF_COMPLET_EXTRA_CSS = `
  tr { page-break-inside: avoid; }
  img.stampila-semnatura { display: block; width: 4.9cm; height: auto; margin: 4pt 0 0 0; page-break-inside: avoid; }
`;

const STAMPILA_IMG_ALT = /stampil|semnatur/i;

/**
 * In DOCX, semnatura+stampila este o imagine "plutitoare" ancorata langa "Semnătură și ștampilă:".
 * Mammoth o transforma intr-o imagine in flux, uneori in afara casetei de semnatura (ex. consolidari).
 * Mutam imaginea exact sub eticheta "Semnătură și ștampilă:". Daca imaginea lipseste din HTML,
 * folosim imaginea din uploads/assets. Daca eticheta nu exista, HTML-ul ramane neschimbat.
 */
export function placeStampilaInSignatureCell(html: string, fallbackSrc: string | null): string {
  const labelRegex = /<p>[^<]*Semn[^<]*tampil[^<]*<\/p>/;
  if (!labelRegex.test(html)) return html;

  let stampilaSrc = null as string | null;
  const captureAndRemove = (imgTag: string): string => {
    const src = imgTag.match(/\bsrc="([^"]+)"/)?.[1];
    const alt = imgTag.match(/\balt="([^"]*)"/)?.[1] ?? '';
    if (!src || !STAMPILA_IMG_ALT.test(alt)) return imgTag;
    if (!stampilaSrc) stampilaSrc = src;
    return '';
  };

  // Paragraf care contine doar imaginea, apoi orice imagine ramasa
  let cleaned = html.replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, (full, img) => {
    const replaced = captureAndRemove(img);
    return replaced === '' ? '' : full;
  });
  cleaned = cleaned.replace(/<img\b[^>]*>/g, (img) => captureAndRemove(img));

  const src = stampilaSrc || fallbackSrc;
  if (!src) return html;

  return cleaned.replace(labelRegex, (label) =>
    `${label}<img class="stampila-semnatura" src="${src}" alt="Semnatura si stampila UNITAR PROIECT" />`
  );
}
