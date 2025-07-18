import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'Nu a fost găsit fișierul' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.txt')) {
      return NextResponse.json({ error: 'Fișierul trebuie să fie .txt' }, { status: 400 });
    }

    let extractedText = '';
    
    try {
      // Citirea conținutului fișierului TXT
      const arrayBuffer = await file.arrayBuffer();
      
      // Încercăm să detectăm encoding-ul
      let decodedText = '';
      
      try {
        // Încercăm cu UTF-8 mai întâi
        const decoder = new TextDecoder('utf-8', { fatal: true });
        decodedText = decoder.decode(arrayBuffer);
      } catch (utf8Error) {
        // Dacă UTF-8 nu funcționează, încercăm cu Windows-1252
        try {
          const decoder = new TextDecoder('windows-1252');
          decodedText = decoder.decode(arrayBuffer);
        } catch (windowsError) {
          // Ultimul resort - ISO-8859-1
          const decoder = new TextDecoder('iso-8859-1');
          decodedText = decoder.decode(arrayBuffer);
        }
      }
      
      extractedText = decodedText.trim();
      
      // Curățăm textul de caractere de control nedorite
      extractedText = extractedText
        .replace(/\r\n/g, '\n')  // Normalizăm line endings
        .replace(/\r/g, '\n')    // Înlocuim CR cu LF
        .replace(/\0/g, '')      // Eliminăm null bytes
        .trim();
      
    } catch (parseError) {
      console.error('Eroare la citirea fișierului TXT:', parseError);
      return NextResponse.json({ 
        error: 'Fișierul TXT nu poate fi citit',
        reply: 'Nu am putut citi conținutul fișierului TXT. Te rog să verifici dacă fișierul este valid.'
      }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ 
        error: 'Fișierul TXT este gol',
        reply: 'Fișierul TXT pare să fie gol sau nu conține text.'
      }, { status: 400 });
    }

    // Analizăm conținutul
    const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
    const characterCount = extractedText.length;
    const characterCountNoSpaces = extractedText.replace(/\s/g, '').length;
    const paragraphs = extractedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const documentStructure = {
      lineCount: lines.length,
      wordCount,
      characterCount,
      characterCountNoSpaces,
      paragraphCount: paragraphs.length,
      estimatedReadingTime: Math.ceil(wordCount / 200), // minute
      averageWordsPerLine: Math.round(wordCount / lines.length),
      averageCharactersPerWord: Math.round(characterCountNoSpaces / wordCount)
    };

    // 🔴 Interpretarea cu AI
    let aiReply = `Fișierul TXT "${file.name}" a fost procesat cu succes. Conține ${wordCount} cuvinte, ${lines.length} linii și ${paragraphs.length} paragrafe.`;
    
    if (prompt && extractedText.trim()) {
      try {
        const aiPrompt = `Analizează următorul document text și răspunde la întrebarea utilizatorului:

Nume fișier: ${file.name}
Statistici document:
- Număr linii: ${lines.length}
- Număr cuvinte: ${wordCount}
- Număr caractere: ${characterCount}
- Număr paragrafe: ${paragraphs.length}
- Timp estimat de citire: ${Math.ceil(wordCount / 200)} minute

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
          aiReply = `Am procesat documentul cu ${wordCount} cuvinte și ${lines.length} linii, dar nu am putut conecta la AI pentru interpretare. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
        }
      } catch (aiError) {
        console.error('Eroare la interpretarea AI:', aiError);
        aiReply = `Am procesat documentul cu ${wordCount} cuvinte și ${lines.length} linii. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
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
        lineCount: lines.length,
        wordCount,
        characterCount,
        paragraphCount: paragraphs.length,
        estimatedReadingTime: Math.ceil(wordCount / 200),
        encoding: 'UTF-8/Windows-1252/ISO-8859-1 (auto-detectat)',
        preview: extractedText.substring(0, 300) + (extractedText.length > 300 ? '...' : '')
      }
    });

  } catch (error) {
    console.error('Eroare la procesarea fișierului TXT:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea fișierului TXT',
      reply: 'Eroare la procesarea fișierului TXT. Te rog să încerci din nou.',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

