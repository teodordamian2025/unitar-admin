// pages/api/chat.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { messages } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
    });

    const reply = response.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (error: any) {
    console.error('Eroare OpenAI:', error);
    res.status(500).json({ error: 'Eroare la procesarea cererii.' });
  }
}
