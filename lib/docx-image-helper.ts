// ==================================================================
// CALEA: lib/docx-image-helper.ts
// DATA: 03.02.2026
// SCOP: Helper pentru inserarea imaginilor în documente DOCX
// ==================================================================

import { readFile } from 'fs/promises';
import path from 'path';

const ASSETS_DIR = path.join(process.cwd(), 'uploads', 'assets');

/**
 * Încarcă imaginea ștampilei UNITAR din folderul assets
 */
export async function loadStampilaImage(): Promise<Buffer | null> {
  try {
    const stampilaPath = path.join(ASSETS_DIR, 'stampila-unitar.png');
    const imageBuffer = await readFile(stampilaPath);
    console.log('[DOCX-IMAGE] Ștampilă încărcată cu succes:', stampilaPath);
    return imageBuffer;
  } catch (error) {
    console.error('[DOCX-IMAGE] Eroare la încărcarea ștampilei:', error);
    return null;
  }
}

/**
 * Generează XML-ul pentru relația imaginii în DOCX
 * Folosit în word/_rels/document.xml.rels
 */
export function generateImageRelationshipXml(relationshipId: string = 'rId2'): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/stampila.png"/>
</Relationships>`;
}

/**
 * Generează Content Types XML cu suport pentru PNG
 */
export function generateContentTypesWithImage(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

/**
 * Generează XML-ul pentru inserarea imaginii în document
 * Dimensiuni: ~4cm lățime, păstrând proporțiile
 * EMU (English Metric Units): 1 inch = 914400 EMU, 1 cm = 360000 EMU
 *
 * @param relationshipId - ID-ul relației (default: rId2)
 * @param widthCm - Lățimea imaginii în cm (default: 4)
 * @param heightCm - Înălțimea imaginii în cm (default: 4)
 */
export function generateImageDrawingXml(
  relationshipId: string = 'rId2',
  widthCm: number = 4,
  heightCm: number = 4
): string {
  // Conversie cm la EMU
  const widthEmu = Math.round(widthCm * 360000);
  const heightEmu = Math.round(heightCm * 360000);

  return `<w:p>
  <w:pPr>
    <w:spacing w:after="120" w:line="240" w:lineRule="auto"/>
  </w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="1" name="Stampila" descr="Stampila UNITAR PROIECT"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="1" name="stampila.png"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${relationshipId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                <a:stretch>
                  <a:fillRect/>
                </a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                  <a:avLst/>
                </a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;
}

/**
 * Verifică dacă textul conține placeholder-ul pentru ștampilă
 */
export function hasStampilaPlaceholder(text: string): boolean {
  return text.includes('{{stampila_prestator}}');
}

/**
 * Înlocuiește placeholder-ul cu un marker temporar pentru procesare ulterioară
 * (folosit în convertTextToWordXml)
 */
export function replaceStampilaPlaceholderWithMarker(text: string): string {
  return text.replace(/\{\{stampila_prestator\}\}/g, '___STAMPILA_PLACEHOLDER___');
}

/**
 * Înlocuiește marker-ul temporar cu XML-ul imaginii în documentul final
 */
export function replaceStampilaMarkerWithDrawing(xml: string, relationshipId: string = 'rId2'): string {
  const imageXml = generateImageDrawingXml(relationshipId);
  // Înlocuiește paragraful care conține marker-ul cu XML-ul imaginii
  // Folosim [\s\S] în loc de . cu flag 's' pentru compatibilitate ES2017
  const markerPattern = /<w:p[^>]*>[\s\S]*?___STAMPILA_PLACEHOLDER___[\s\S]*?<\/w:p>/g;
  return xml.replace(markerPattern, imageXml);
}

export default {
  loadStampilaImage,
  generateImageRelationshipXml,
  generateContentTypesWithImage,
  generateImageDrawingXml,
  hasStampilaPlaceholder,
  replaceStampilaPlaceholderWithMarker,
  replaceStampilaMarkerWithDrawing
};
