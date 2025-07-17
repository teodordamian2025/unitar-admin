import { NextRequest } from 'next/server';
import PDFDocument from 'pdfkit';

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const doc = new PDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {});

  doc.fontSize(14).text(`Document generat pe baza promptului:`, { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(prompt);
  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="document.pdf"',
    },
  });
}
