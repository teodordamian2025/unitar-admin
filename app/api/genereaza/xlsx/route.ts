// app/api/genereaza/xlsx/route.ts
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet 1');

    // Exemplu simplu: extragem numere din prompt și le punem într-o coloană
    const match = prompt?.match(/\d+/g);
    const numbers = match?.map(n => parseInt(n)) || [];

    numbers.forEach((num, i) => {
      sheet.getCell(`A${i + 1}`).value = num;
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=document.xlsx',
        'X-Filename': 'document.xlsx'
      }
    });
  } catch (err: any) {
    console.error('Eroare generare XLSX:', err);
    return new Response(JSON.stringify({ error: 'Eroare la generarea fișierului XLSX.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

