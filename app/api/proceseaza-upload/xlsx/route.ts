import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const prompt = formData.get('prompt') as string;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bufferData: Buffer = Buffer.from(new Uint8Array(arrayBuffer as ArrayBuffer));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bufferData); // Funcționează pe Vercel

    const sheet = workbook.worksheets[0];
    let content = '';

    sheet.eachRow((row) => {
      content += row.values.join(' ') + '\n';
    });

    const interpretare = `Interpretarea AI a conținutului:\n${prompt}\n\nConținut detectat:\n${content}`;
    return NextResponse.json({ success: true, content: interpretare });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

