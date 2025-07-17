import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { buffer } from 'node:stream/consumers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const prompt = formData.get('prompt') as string;

  if (!file || !file.name.endsWith('.xlsx')) {
    return new Response(JSON.stringify({ reply: 'Te rog încarcă un fișier Excel (.xlsx).' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const bufferData: Buffer = await buffer(file.stream());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bufferData);

    const sheet = workbook.worksheets[0];
    let content = '';

    sheet.eachRow((row) => {
      const rowValues = row.values
        .filter(v => v !== null && v !== undefined && typeof v !== 'object')
        .join(' | ');
      content += rowValues + '\n';
    });

    const combinedPrompt = `Am extras următorul conținut dintr-un fișier Excel:\n\n${content}\n\nÎntrebarea utilizatorului este:\n${prompt}`;

    const apiUrl = process.env.NEXT_PUBLIC_API_AI_URL || 'http://localhost:3000';
    const aiRes = await fetch(`${apiUrl}/api/queryOpenAI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: combinedPrompt }),
    });

    const data = await aiRes.json();

    return new Response(JSON.stringify({ reply: data.reply || 'Fără răspuns.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Eroare la procesarea fișierului .xlsx:', err);
    return new Response(JSON.stringify({ reply: `A apărut o eroare: ${err.message || err}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

