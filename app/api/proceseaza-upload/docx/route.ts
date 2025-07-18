import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

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

    // Conversie sigură pentru mammoth
    const arrayBuffer = await file.arrayBuffer();
    
    let extractedText = '';
    let extractedHtml = '';
    
    try {
      // Extragerea textului simplu
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      extractedText = textResult.value;
      
      // Extragerea HTML pentru formatare
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      extractedHtml = htmlResult.value;
      
      // Verificarea mesajelor de avertizare
      if (textResult.messages.length > 0) {
        console.log('Avertizări la procesarea Word:', textResult.messages);
      }
      
    } catch (loadError) {
      console.error('Eroare la încărcarea fișierului Word:', loadError);
      return NextResponse.json({ 
        error: 'Fișierul Word nu poate fi procesat sau este corupt' 
      }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ 
        error: 'Fișierul Word pare să fie gol sau nu conține text extractabil' 
      }, { status: 400 });
    }

    // Procesarea conținutului pentru analiză
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
    const paragraphs = extractedText.split('\n').filter(p => p.trim().length > 0);
    const characterCount = extractedText.length;

    // Identificarea structurii documentului
    const headings = extractedHtml.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || [];
    const tables = extractedHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
    
    const documentStructure = {
      wordCount,
      characterCount,
      paragraphCount: paragraphs.length,
      headingCount: headings.length,
      tableCount: tables.length,
      hasImages: extractedHtml.includes('<img'),
      hasLinks: extractedHtml.includes('<a href')
    };

    // 🔴 PARTEA NOUĂ: Interpretarea cu AI
    let aiReply = 'Fișierul Word a fost procesat cu succes.';
    
    if (prompt && extractedText.trim()) {
      try {
        const aiPrompt = `Analizează următorul document Word și răspunde la întrebarea utilizatorului:

Nume fișier: ${file.name}
Statistici document:
- Număr cuvinte: ${wordCount}
- Număr paragrafe: ${paragraphs.length}
- Număr titluri: ${headings.length}
- Număr tabele: ${tables.length}

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
      extractedHtml: extractedHtml,
      documentStructure: documentStructure,
      summary: {
        wordCount,
        characterCount,
        paragraphCount: paragraphs.length,
        headingCount: headings.length,
        tableCount: tables.length,
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

