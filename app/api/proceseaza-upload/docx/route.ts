import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'Nu a fost găsit fișierul' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Fișierul trebuie să fie .docx' }, { status: 400 });
    }

    // Conversie pentru docx-parser
    const arrayBuffer = await file.arrayBuffer();
    
    let extractedText = '';
    let documentStructure: any = {};
    
    try {
      // Încercăm să folosim docx-parser
      const parseDocx = require('docx-parser');
      
      const result = await parseDocx.parseDocx(arrayBuffer);
      extractedText = result || '';
      
      // Dacă docx-parser nu funcționează, folosim o metodă simplă
      if (!extractedText.trim()) {
        // Convertim buffer-ul într-un text simplu (limitată funcționalitate)
        const uint8Array = new Uint8Array(arrayBuffer);
        const decoder = new TextDecoder('utf-8');
        const rawText = decoder.decode(uint8Array);
        
        // Extragerea rudimentară de text din XML
        const textMatches = rawText.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
        if (textMatches) {
          extractedText = textMatches
            .map(match => match.replace(/<w:t[^>]*>(.*?)<\/w:t>/, '$1'))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
      
    } catch (parseError) {
      console.error('Eroare la parsarea Word:', parseError);
      
      // Fallback: extragere text rudimentară
      try {
        const uint8Array = new Uint8Array(arrayBuffer);
        const decoder = new TextDecoder('utf-8');
        const rawText = decoder.decode(uint8Array);
        
        // Extragere text din XML folosind regex
        const textMatches = rawText.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
        if (textMatches) {
          extractedText = textMatches
            .map(match => match.replace(/<w:t[^>]*>(.*?)<\/w:t>/, '$1'))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      } catch (fallbackError) {
        console.error('Eroare la extragerea text fallback:', fallbackError);
        return NextResponse.json({ 
          error: 'Fișierul Word nu poate fi procesat' 
        }, { status: 400 });
      }
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ 
        error: 'Fișierul Word pare să fie gol sau nu conține text extractabil' 
      }, { status: 400 });
    }

    // Procesarea conținutului pentru analiză
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
    const paragraphs = extractedText.split(/\n|\r\n|\r/).filter(p => p.trim().length > 0);
    const characterCount = extractedText.length;

    documentStructure = {
      wordCount,
      characterCount,
      paragraphCount: paragraphs.length,
      estimatedReadingTime: Math.ceil(wordCount / 200) // minute
    };

    // 🔴 Interpretarea cu AI
    let aiReply = 'Fișierul Word a fost procesat cu succes.';
    
    if (prompt && extractedText.trim()) {
      try {
        const aiPrompt = `Analizează următorul document Word și răspunde la întrebarea utilizatorului:

Nume fișier: ${file.name}
Statistici document:
- Număr cuvinte: ${wordCount}
- Număr paragrafe: ${paragraphs.length}
- Număr caractere: ${characterCount}

Conținut document:
${extractedText}

Întrebarea utilizatorului: ${prompt}

Te rog să răspunzi în română și să fii cât mai precis posibil, referindu-te la conținutul specific din document.`;

        const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/queryOpenAI`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: aiPrompt })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiReply = aiData.reply || aiReply;
        } else {
          console.error('Eroare la apelarea OpenAI:', aiResponse.status);
        }
      } catch (aiError) {
        console.error('Eroare la interpretarea AI:', aiError);
      }
    }
    
    return NextResponse.json({
      success: true,
      reply: aiReply, // 🔴 CÂMPUL PE CARE ÎL AȘTEAPTĂ CHATBOT-UL
      fileName: file.name,
      fileSize: file.size,
      extractedText: extractedText,
      documentStructure: documentStructure,
      summary: {
        wordCount,
        characterCount,
        paragraphCount: paragraphs.length,
        estimatedReadingTime: Math.ceil(wordCount / 200),
        preview: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '')
      }
    });

  } catch (error) {
    console.error('Eroare la procesarea fișierului Word:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea fișierului Word',
      reply: 'Eroare la procesarea fișierului Word. Te rog să încerci din nou.',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

