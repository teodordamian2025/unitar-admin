import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt necesar' }, { status: 400 });
    }

    // Interpretarea AI pentru structura Excel
    let aiStructure = '';
    try {
      const aiPrompt = `Analizează următoarea cerere și creează o structură detaliată pentru un fișier Excel:

Cererea utilizatorului: ${prompt}

Te rog să răspunzi cu o structură JSON care să conțină:
1. Un nume pentru fișier (fără extensie)
2. Sheet-uri multiple dacă este necesar
3. Pentru fiecare sheet: nume, anteturi de coloane, și exemple de date
4. Formatare sugerată (culori, lățimi coloane, etc.)

Exemplu de răspuns:
{
  "fileName": "raport_lunar",
  "sheets": [
    {
      "name": "Date principale",
      "headers": ["Nume", "Data", "Valoare", "Status"],
      "data": [
        ["Exemplu 1", "2025-01-01", 1000, "Activ"],
        ["Exemplu 2", "2025-01-02", 1500, "Inactiv"]
      ],
      "formatting": {
        "headerStyle": { "bold": true, "bgColor": "366092", "fontColor": "FFFFFF" },
        "columnWidths": [20, 15, 12, 15]
      }
    }
  ]
}

Răspunde DOAR cu JSON-ul, fără text suplimentar.`;

      const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/queryOpenAI`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiPrompt })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiStructure = aiData.reply || '';
      }
    } catch (aiError) {
      console.error('Eroare la interpretarea AI:', aiError);
    }

    // Parsarea structurii AI sau crearea unei structuri default
    let structure: any;
    try {
      // Încearcă să parseze JSON-ul de la AI
      const cleanJson = aiStructure.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      structure = JSON.parse(cleanJson);
    } catch (parseError) {
      console.log('Folosesc structura default, AI nu a returnat JSON valid');
      // Structură default bazată pe prompt
      structure = {
        fileName: "document_generat",
        sheets: [
          {
            name: "Date principale",
            headers: ["Descriere", "Valoare", "Data", "Observații"],
            data: [
              ["Element 1", "100", new Date().toISOString().split('T')[0], "Generat automat"],
              ["Element 2", "200", new Date().toISOString().split('T')[0], "Generat automat"],
              ["Element 3", "300", new Date().toISOString().split('T')[0], "Generat automat"]
            ],
            formatting: {
              headerStyle: { bold: true, bgColor: "366092", fontColor: "FFFFFF" },
              columnWidths: [25, 15, 15, 30]
            }
          }
        ]
      };
    }

    // Crearea workbook-ului
    const workbook = new ExcelJS.Workbook();
    
    // Setarea proprietăților workbook-ului
    workbook.creator = 'Unitar Proiect';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.lastPrinted = new Date();

    // Adăugarea sheet-urilor
    structure.sheets.forEach((sheetConfig: any, index: number) => {
      const worksheet = workbook.addWorksheet(sheetConfig.name || `Sheet ${index + 1}`);
      
      // Adăugarea anteturilor
      if (sheetConfig.headers && sheetConfig.headers.length > 0) {
        const headerRow = worksheet.addRow(sheetConfig.headers);
        
        // Stilizarea anteturilor
        if (sheetConfig.formatting?.headerStyle) {
          const headerStyle = sheetConfig.formatting.headerStyle;
          headerRow.eachCell((cell) => {
            cell.font = { 
              bold: headerStyle.bold || false,
              color: { argb: headerStyle.fontColor || '000000' }
            };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: headerStyle.bgColor || 'FFFFFF' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      }
      
      // Adăugarea datelor
      if (sheetConfig.data && sheetConfig.data.length > 0) {
        sheetConfig.data.forEach((rowData: any[]) => {
          const dataRow = worksheet.addRow(rowData);
          
          // Stilizarea datelor
          dataRow.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          });
        });
      }
      
      // Setarea lățimilor coloanelor
      if (sheetConfig.formatting?.columnWidths) {
        sheetConfig.formatting.columnWidths.forEach((width: number, colIndex: number) => {
          const column = worksheet.getColumn(colIndex + 1);
          column.width = width;
        });
      } else {
        // Lățimi default
        worksheet.columns.forEach((column) => {
          column.width = 20;
        });
      }
      
      // Auto-fit pentru înălțimea rândurilor
      worksheet.eachRow((row) => {
        row.height = 20;
      });
    });

    // Generarea buffer-ului
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Determinarea numelui fișierului
    const fileName = `${structure.fileName || 'document_generat'}.xlsx`;
    
    // Returnarea fișierului
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Filename': fileName
      }
    });

  } catch (error) {
    console.error('Eroare la generarea Excel:', error);
    return NextResponse.json({ 
      error: 'Eroare la generarea fișierului Excel',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

