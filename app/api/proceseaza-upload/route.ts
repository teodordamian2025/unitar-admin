// app/api/proceseaza-upload/route.ts
import { NextRequest } from 'next/server';
import pdfParse from 'pdf-parse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const prompt = (formData.get('prompt') as string) || '';

  if (!file || !file.name.endsWith('.pdf')) {
    return new Response(JSON.stringify({ reply: 'Te rog încarcă un fișier PDF valid.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buffer);

    const extractedText = data.text?.trim().slice(0, 2000) || 'Niciun text detectat.';

    // Trimitem textul extras + promptul utilizatorului către AI local (ex: queryOpenAI)
    const aiPrompt = `${prompt}\n\nText extras din PDF:\n${extractedText}`;

    const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_API_AI_URL || 'http://localhost:3000'}/api/queryOpenAI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: aiPrompt }),
    });

    if (!aiResponse.ok) {
      throw new Error('Eroare la interpretarea textului cu asistentul AI.');
    }

    const aiData = await aiResponse.json();

    return new Response(JSON.stringify({
      reply: aiData.reply || 'Am extras textul dar nu am primit un răspuns de la AI.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Eroare la procesarea PDF:', err);
    return new Response(JSON.stringify({ reply: 'A apărut o eroare la procesarea fișierului PDF.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

