import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

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

    // Conversie pentru procesare
    const arrayBuffer = await file.arrayBuffer();
    
    let extractedText = '';
    
    try {
      // Folosim JSZip pentru a extrage conținutul DOCX
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(arrayBuffer);
      
      // Extragem document.xml din arhiva ZIP
      const documentXml = zipContent.files['word/document.xml'];
      if (!documentXml) {
        throw new Error('Nu s-a găsit document.xml în fișierul DOCX');
      }
      
      const xmlContent = await documentXml.async('text');
      
      // Extragere text din XML folosind regex
      const textMatches = xmlContent.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
      if (textMatches && textMatches.length > 0) {
        extractedText = textMatches
          .map(match => {
            const textMatch = match.match(/<w:t[^>]*>(.*?)<\/w:t>/);
            return textMatch ? textMatch[1] : '';
          })
          .filter(text => text.trim().length > 0)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // Curățăm textul de caractere XML speciale
      extractedText = extractedText
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      
    } catch (parseError) {
      console.error('Eroare la parsarea Word:', parseError);
      return NextResponse.json({ 
        error: 'Fișierul Word nu poate fi procesat',
        reply: 'Nu am putut citi conținutul fișierului Word. Te rog să încerci din nou sau să verifici dacă fișierul este valid.'
      }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ 
        error: 'Fișierul Word pare să fie gol sau nu conține text extractabil',
        reply: 'Fișierul Word pare să fie gol sau nu conține text extractabil.'
      }, { status: 400 });
    }

    // Procesarea conținutului pentru analiză
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
    const sentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const characterCount = extractedText.length;

    const documentStructure = {
      wordCount,
      characterCount,
      sentenceCount: sentences.length,
      estimatedReadingTime: Math.ceil(wordCount / 200) // minute
    };

    // 🔴 Interpretarea cu AI
    let aiReply = `Fișierul Word "${file.name}" a fost procesat cu succes. Conține ${wordCount} cuvinte și ${sentences.length} propoziții.`;
    
    if (prompt && extractedText.trim()) {
      try {
        const aiPrompt = `Analizează următorul document Word și răspunde la întrebarea utilizatorului:

Nume fișier: ${file.name}
Statistici document:
- Număr cuvinte: ${wordCount}
- Număr propoziții: ${sentences.length}
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
          aiReply = `Am procesat documentul cu ${wordCount} cuvinte, dar nu am putut conecta la AI pentru interpretare. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
        }
      } catch (aiError) {
        console.error('Eroare la interpretarea AI:', aiError);
        aiReply = `Am procesat documentul cu ${wordCount} cuvinte. Conținutul începe cu: "${extractedText.substring(0, 100)}..."`;
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
        sentenceCount: sentences.length,
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

