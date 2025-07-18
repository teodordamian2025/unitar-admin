import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

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

    // Extragerea conținutului pentru AI
    const extractedContent: string[] = [];
    const sheetDetails: any[] = [];
    
    workbook.eachSheet((worksheet, sheetId) => {
      const sheetData = {
        sheetName: worksheet.name,
        sheetId: sheetId,
        rowCount: worksheet.rowCount,
        columnCount: worksheet.columnCount,
        data: [] as any[]
      };

      // Extragere pentru AI - text simplu
      let sheetText = `Sheet: ${worksheet.name}\n`;
      
      worksheet.eachRow((row, rowNumber) => {
        const rowData: any[] = [];
        const cellValues: string[] = [];
        
        row.eachCell((cell, colNumber) => {
          let cellValue = '';
          
          // Convertește valorile în text pentru AI
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && cell.value.text) {
              cellValue = cell.value.text;
            } else if (typeof cell.value === 'object' && cell.value.result) {
              cellValue = String(cell.value.result);
            } else {
              cellValue = String(cell.value);
            }
          }
          
          rowData.push({
            column: colNumber,
            value: cell.value,
            displayValue: cellValue,
            type: cell.type
          });
          
          if (cellValue.trim()) {
            cellValues.push(cellValue.trim());
          }
        });
        
        if (rowData.length > 0) {
          sheetData.data.push({
            row: rowNumber,
            cells: rowData
          });
        }
        
        if (cellValues.length > 0) {
          sheetText += `Row ${rowNumber}: ${cellValues.join(' | ')}\n`;
        }
      });

      sheetDetails.push(sheetData);
      extractedContent.push(sheetText);
    });

    // Combinarea conținutului pentru AI
    const aiContent = extractedContent.join('\n\n');
    
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      sheets: sheetDetails.length,
      extractedData: sheetDetails,
      aiContent: aiContent, // Conținut formatat pentru AI
      summary: {
        totalSheets: sheetDetails.length,
        totalRows: sheetDetails.reduce((sum, sheet) => sum + sheet.rowCount, 0),
        sheetNames: sheetDetails.map(sheet => sheet.sheetName)
      }
    });

  } catch (error) {
    console.error('Eroare la procesarea fișierului Excel:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea fișierului Excel',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

