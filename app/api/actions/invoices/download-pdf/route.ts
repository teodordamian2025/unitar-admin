2. CALEA: app/api/actions/invoices/download-pdf/route.ts
// DESCRIERE: Download PDF cu numele real de fișier
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    
    if (!fileName) {
      return NextResponse.json({ error: 'fileName este obligatoriu' }, { status: 400 });
    }
    
    const filePath = path.join(process.cwd(), 'uploads', 'facturi', fileName);
    
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'Fișierul nu a fost găsit' }, { status: 404 });
    }
    
    const fileBuffer = await fs.readFile(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString()
      }
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Eroare la descărcarea fișierului' }, { status: 500 });
  }
}
