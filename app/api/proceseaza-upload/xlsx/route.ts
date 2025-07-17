// app/api/proceseaza-upload/xlsx/route.ts
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string;

    if (!file || !file.name.endsWith('.xlsx')) {
      return new Response(JSON.stringify({ reply: 'Te rog încarcă un fișier Excel (.xlsx).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];

    let content = '';
    sheet.eachRow((row, rowNumber) => {
      const values = row.values
        .filter(v => typeof v !== 'object') // eliminăm referințe la celule
        .join(' | ');
      content += `Rândul ${rowNumber}: ${values}\n`;
    });

    const combinedPrompt = `Am extras următorul conținut dintr-un fișier Excel:\n${content}\n\nÎntrebarea utilizatorului este:\n${prompt}`;

    const apiUrl = process.env.NEXT_PUBLIC_API_AI_URL || 'http://localhost:3000';
    const aiResponse = await fetch(`${apiUrl}/api/queryOpenAI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: combinedPrompt })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Eroare AI XLSX:', errorText);
      return new Response(JSON.stringify({ reply: 'Eroare la interogarea AI.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { reply } = await aiResponse.json();

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Eroare procesare XLSX:', err);
    return new Response(JSON.stringify({ reply: 'Eroare la procesarea fișierului Excel.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

