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
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buffer);

    const extractedText = data.text?.trim().slice(0, 2000) || 'Niciun text detectat.';

    return new Response(JSON.stringify({
      reply: `Am extras următorul text din PDF:\n\n${extractedText}`,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Eroare la citirea PDF:', err);
    return new Response(JSON.stringify({ reply: 'Eroare la citirea PDF-ului.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
