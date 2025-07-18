import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt necesar' }, { status: 400 });
    }

    // Interpretarea AI pentru conținutul TXT
    let aiContent = '';
    let fileName = 'document_generat';
    
    try {
      const aiPrompt = `Creează un document text simplu și structurat bazat pe următoarea cerere:

Cererea utilizatorului: ${prompt}

Te rog să creezi un document text care să conțină:
1. Un titlu clar
2. Conținut bine structurat cu paragrafe
3. Informații relevante și detaliate
4. Formatare text simplu (fără HTML sau markup)

Răspunde cu textul complet al documentului, formatat pentru a fi citit într-un fișier text simplu (.txt).`;

      const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/queryOpenAI`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiPrompt })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiContent = aiData.reply || 'Document generat automat';
        
        // Extragem un nume de fișier din prima linie
        const firstLine = aiContent.split('\n')[0];
        if (firstLine && firstLine.length > 0 && firstLine.length < 50) {
          fileName = firstLine
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .toLowerCase();
        }
      }
    } catch (aiError) {
      console.error('Eroare la interpretarea AI:', aiError);
      aiContent = `DOCUMENT GENERAT AUTOMAT
========================

Cererea dumneavoastră: ${prompt}

Acest document a fost creat pe baza cererii de mai sus. 
Conținutul poate fi personalizat conform nevoilor specifice ale proiectului.

Data generării: ${new Date().toLocaleDateString('ro-RO')}
Ora generării: ${new Date().toLocaleTimeString('ro-RO')}

Pentru mai multe informații, vă rugăm să contactați echipa noastră.`;
    }

    // Adăugăm un header cu informații despre document
    const documentHeader = `DOCUMENT GENERAT AUTOMAT
========================
Data: ${new Date().toLocaleDateString('ro-RO')}
Ora: ${new Date().toLocaleTimeString('ro-RO')}
Generat de: Unitar Proiect AI Assistant

========================

`;

    const finalContent = documentHeader + aiContent;

    // Crearea buffer-ului text
    const buffer = Buffer.from(finalContent, 'utf-8');
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}.txt"`,
        'X-Filename': `${fileName}.txt`
      }
    });

  } catch (error) {
    console.error('Eroare la generarea TXT:', error);
    return NextResponse.json({ 
      error: 'Eroare la generarea fișierului TXT',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

