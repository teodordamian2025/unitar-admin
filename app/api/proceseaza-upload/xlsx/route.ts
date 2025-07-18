import { NextRequest, NextResponse } from 'next/server';
import { ExcelJS } from 'exceljs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Nu a fost găsit fișierul' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Fișierul trebuie să fie .xlsx' }, { status: 400 });
    }

    // Conversie sigură pentru ExcelJS
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const buffer = Buffer.from(uint8Array);

    // Crearea și încărcarea workbook-ului
    const workbook = new ExcelJS.Workbook();
    
    try {
      await workbook.xlsx.load(buffer);
    } catch (loadError) {
      console.error('Eroare la încărcarea fișierului Excel:', loadError);
      return NextResponse.json({ 
        error: 'Fișierul Excel nu poate fi procesat sau este corupt' 
      }, { status: 400 });
    }

    // Extragerea conținutului
    const extractedData: any[] = [];
    
    workbook.eachSheet((worksheet, sheetId) => {
      const sheetData = {
        sheetName: worksheet.name,
        sheetId: sheetId,
        data: [] as any[]
      };

      worksheet.eachRow((row, rowNumber) => {
        const rowData: any[] = [];
        row.eachCell((cell, colNumber) => {
          rowData.push({
            column: colNumber,
            value: cell.value,
            type: cell.type
          });
        });
        
        if (rowData.length > 0) {
          sheetData.data.push({
            row: rowNumber,
            cells: rowData
          });
        }
      });

      extractedData.push(sheetData);
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      sheets: extractedData.length,
      extractedData: extractedData
    });

  } catch (error) {
    console.error('Eroare la procesarea fișierului Excel:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea fișierului Excel' 
    }, { status: 500 });
  }
}

