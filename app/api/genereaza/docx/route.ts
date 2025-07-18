import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt necesar' }, { status: 400 });
    }

    // Interpretarea AI pentru conținut
    let aiContent = '';
    let fileName = 'document_generat';
    
    try {
      const aiPrompt = `Creează un document Word profesional bazat pe următoarea cerere:

Cererea utilizatorului: ${prompt}

Te rog să creezi un document structurat cu:
1. Titlu principal
2. Secțiuni cu subtitluri
3. Conținut detaliat și relevant
4. Informații practice și utile

Răspunde cu textul complet al documentului, bine structurat și formatat pentru a fi folosit într-un document Word profesional.`;

      const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/queryOpenAI`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiPrompt })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiContent = aiData.reply || 'Document generat automat';
        
        // Extragem un nume de fișier din conținut
        const firstLine = aiContent.split('\n')[0];
        if (firstLine && firstLine.length > 0 && firstLine.length < 50) {
          fileName = firstLine.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').toLowerCase();
        }
      }
    } catch (aiError) {
      console.error('Eroare la interpretarea AI:', aiError);
      aiContent = `Document generat automat

Cererea dumneavoastră: ${prompt}

Acest document a fost creat pe baza cererii de mai sus. Conținutul poate fi personalizat conform nevoilor specifice ale proiectului.

Data generării: ${new Date().toLocaleDateString('ro-RO')}`;
    }

    // Crearea documentului Word XML
    const wordXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
          <w:szCs w:val="32"/>
        </w:rPr>
        <w:t>Document Generat</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="right"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:i/>
        </w:rPr>
        <w:t>Data: ${new Date().toLocaleDateString('ro-RO')}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t></w:t>
      </w:r>
    </w:p>
    ${aiContent.split('\n').map(line => {
      if (line.trim().length === 0) {
        return `<w:p><w:r><w:t></w:t></w:r></w:p>`;
      }
      
      // Verifică dacă este titlu (prima linie sau linie scurtă cu majuscule)
      const isTitle = line.trim().length < 50 && line.trim() === line.trim().toUpperCase() && line.trim().length > 0;
      
      if (isTitle) {
        return `<w:p>
          <w:pPr>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="24"/>
              <w:szCs w:val="24"/>
            </w:rPr>
            <w:t>${line.trim()}</w:t>
          </w:r>
        </w:p>`;
      } else {
        return `<w:p>
          <w:r>
            <w:t>${line.trim()}</w:t>
          </w:r>
        </w:p>`;
      }
    }).join('')}
  </w:body>
</w:document>`;

    // Crearea unui ZIP cu structura DOCX
    const zip = new JSZip();
    
    // Adăugarea fișierelor necesare pentru DOCX
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
    
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
    
    zip.file('word/document.xml', wordXml);
    
    // Generarea buffer-ului
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}.docx"`,
        'X-Filename': `${fileName}.docx`
      }
    });

  } catch (error) {
    console.error('Eroare la generarea Word:', error);
    return NextResponse.json({ 
      error: 'Eroare la generarea fișierului Word',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

