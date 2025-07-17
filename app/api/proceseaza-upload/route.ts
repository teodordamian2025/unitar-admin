import { NextRequest } from 'next/server';
import pdfParse from 'pdf-parse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const prompt = formData.get('prompt') as string;

  if (!file || !file.name.endsWith('.pdf')) {
    return new Response(JSON.stringify({ reply: 'Te rog încarcă un fișier PDF.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Extrage conținutul PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buffer);
    const extractedText = data.text?.trim().slice(0, 2000) || 'Niciun text detectat în fișierul PDF.';

    // 2. Creează un prompt combinat
    const combinedPrompt = `Am extras următorul text dintr-un PDF:\n\n${extractedText}\n\nÎntrebarea utilizatorului este:\n${prompt}`;

    // 3. Trimite la asistentul AI local
    const apiUrl = process.env.NEXT_PUBLIC_API_AI_URL || 'http://localhost:3000';
    const aiResponse = await fetch(`${apiUrl}/api/queryOpenAI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: combinedPrompt }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error('Eroare răspuns AI:', errorData);
      return new Response(JSON.stringify({ reply: 'A apărut o eroare la interogarea asistentului AI.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { reply } = await aiResponse.json();

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Eroare la procesarea PDF:', err);
    return new Response(JSON.stringify({ reply: `A apărut o eroare la procesarea fișierului PDF: ${err.message || err}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

