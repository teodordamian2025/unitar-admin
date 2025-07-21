// ==================================================================
// CALEA: app/api/actions/invoices/download/[id]/route.ts
// DESCRIERE: Download PDF factură
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;
    
    // Calea către PDF
    const filePath = path.join(process.cwd(), 'uploads', 'facturi', `${invoiceId}.pdf`);
    
    // Verifică dacă fișierul există
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: 'Factura nu a fost găsită' },
        { status: 404 }
      );
    }
    
    // Citește fișierul
    const fileBuffer = await fs.readFile(filePath);
    
    // Returnează PDF-ul
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura_${invoiceId}.pdf"`,
        'Content-Length': fileBuffer.length.toString()
      }
    });
    
  } catch (error) {
    console.error('Eroare download factură:', error);
    return NextResponse.json(
      { error: 'Eroare la descărcarea facturii' },
      { status: 500 }
    );
  }
}
