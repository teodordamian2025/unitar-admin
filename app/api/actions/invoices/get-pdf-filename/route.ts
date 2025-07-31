// ==================================================================
// 1. CALEA: app/api/actions/invoices/get-pdf-filename/route.ts
// DESCRIERE: Găsește numele real al fișierului PDF
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facturaId = searchParams.get('facturaId');
    const numar = searchParams.get('numar');
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'facturi');
    
    try {
      const files = await fs.readdir(uploadsDir);
      
      // Caută fișierul care conține ID-ul sau numărul facturii
      const foundFile = files.find(file => 
        file.includes(facturaId) || 
        file.includes(numar) ||
        file.endsWith('.pdf')
      );
      
      if (foundFile) {
        return NextResponse.json({
          success: true,
          fileName: foundFile
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Fișierul PDF nu a fost găsit'
        }, { status: 404 });
      }
    } catch (dirError) {
      return NextResponse.json({
        success: false,
        error: 'Directorul uploads/facturi nu există'
      }, { status: 404 });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Eroare la căutarea fișierului'
    }, { status: 500 });
  }
}
