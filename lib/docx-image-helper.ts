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
 * Dimensiuni: 4.9cm lățime x 3.57cm înălțime (conform specificații)
 * EMU (English Metric Units): 1 inch = 914400 EMU, 1 cm = 360000 EMU
 * Twips: 1 cm = 567 twips (pentru spacing)
 *
 * IMPORTANT: Folosește wp:anchor cu wrapNone pentru "In Front of Text"
 * Aceasta permite imaginii să plutească deasupra textului și să fie mutată liber
 *
 * @param relationshipId - ID-ul relației (default: rId2)
 * @param widthCm - Lățimea imaginii în cm (default: 4.9)
 * @param heightCm - Înălțimea imaginii în cm (default: 3.57)
 * @param offsetXCm - Offset orizontal de la marginea stângă în cm (default: 0)
 * @param offsetYCm - Offset vertical de la poziția curentă în cm (default: -1.5 pentru a se suprapune cu semnătura)
 */
export function generateImageDrawingXml(
  relationshipId: string = 'rId2',
  widthCm: number = 4.9,
  heightCm: number = 3.57,
  offsetXCm: number = 0,
  offsetYCm: number = -1.5
): string {
  // Conversie cm la EMU (1 cm = 360000 EMU)
  const widthEmu = Math.round(widthCm * 360000);
  const heightEmu = Math.round(heightCm * 360000);
  const offsetXEmu = Math.round(offsetXCm * 360000);
  const offsetYEmu = Math.round(offsetYCm * 360000);

  // wp:anchor permite "floating" image cu wrapNone = "In Front of Text"
  // behindDoc="0" = imaginea este în fața textului (nu în spate)
  // relativeHeight="251658240" = z-index mare pentru a fi deasupra
  // simplePos="0" = folosește pozitionare relativă, nu absolută
  // allowOverlap="1" = permite suprapunere cu alte elemente
  return `<w:p>
  <w:r>
    <w:drawing>
      <wp:anchor distT="0" distB="0" distL="114300" distR="114300"
                 simplePos="0" relativeHeight="251658240" behindDoc="0"
                 locked="0" layoutInCell="1" allowOverlap="1"
                 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:simplePos x="0" y="0"/>
        <wp:positionH relativeFrom="column">
          <wp:posOffset>${offsetXEmu}</wp:posOffset>
        </wp:positionH>
        <wp:positionV relativeFrom="paragraph">
          <wp:posOffset>${offsetYEmu}</wp:posOffset>
        </wp:positionV>
        <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:wrapNone/>
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
      </wp:anchor>
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
  // Înlocuiește DOAR paragraful care conține marker-ul cu XML-ul imaginii
  // Folosim negative lookahead (?!<\/w:p>) pentru a nu traversa granițele paragrafelor
  // Astfel, regex-ul matchuiește doar de la <w:p> la </w:p> fără să treacă peste alte paragrafe
  const markerPattern = /<w:p[^>]*>(?:(?!<\/w:p>)[\s\S])*___STAMPILA_PLACEHOLDER___(?:(?!<\/w:p>)[\s\S])*<\/w:p>/g;
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
