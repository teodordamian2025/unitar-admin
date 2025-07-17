import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body?.message || typeof body.message !== 'string') {
      return NextResponse.json({ error: 'Mesaj invalid trimis.' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Lipsește cheia OPENAI_API_KEY' }, { status: 500 });
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Ești un asistent AI care răspunde utilizatorilor dintr-o aplicație de administrare.',
          },
          {
            role: 'user',
            content: body.message,
          },
        ],
        temperature: 0.7,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error('Eroare de la OpenAI:', data);
      return NextResponse.json({ error: 'Eroare OpenAI', details: data }, { status: openaiRes.status });
    }

    const reply = data.choices?.[0]?.message?.content || 'Niciun răspuns generat.';
    return NextResponse.json({ reply });

  } catch (err: any) {
    console.error('Eroare internă în queryOpenAI:', err);
    return NextResponse.json({ error: 'Eroare internă server.' }, { status: 500 });
  }
}
