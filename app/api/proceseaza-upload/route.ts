import { NextRequest } from 'next/server';
import pdfParse from 'pdf-parse';

export const runtime = 'nodejs'; // Important pentru Vercel — nu folosi 'edge'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string;

    if (!file || !file.name.endsWith('.pdf')) {
      return new Response(JSON.stringify({ reply: 'Te rog încarcă un fișier PDF valid.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Transformă fișierul în buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // DEBUG: log dimensiune fișier
    console.log(`PDF uploadat: ${file.name}, dimensiune: ${buffer.length} bytes`);

    // Extrage textul din PDF
    const data = await pdfParse(buffer);
    const extractedText = data.text?.trim();

    if (!extractedText || extractedText.length < 10) {
      return new Response(JSON.stringify({
        reply: 'Nu am putut extrage text suficient din PDF.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Combină promptul cu textul extras
    const mesajComplet = `${prompt.trim()}\n\n---\nConținut extras din PDF:\n${extractedText.slice(0, 2000)}`;

    // Trimite promptul + textul către asistentul AI local
    const aiRes = await fetch(`${process.env.NEXT_PUBLIC_API_AI_URL || 'http://localhost:3000'}/api/queryOpenAI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: mesajComplet }),
    });

    const aiData = await aiRes.json();

    if (!aiRes.ok) {
      console.error('Eroare de la AI:', aiData);
      return new Response(JSON.stringify({
        reply: 'Eroare de la asistentul AI.',
        details: aiData,
      }), {
        status: aiRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      reply: aiData.reply || 'Nu am primit un răspuns.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Eroare la procesarea PDF:', err);
    return new Response(JSON.stringify({
      reply: `A apărut o eroare la procesarea fișierului PDF: ${err.message || 'necunoscută'}`,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

