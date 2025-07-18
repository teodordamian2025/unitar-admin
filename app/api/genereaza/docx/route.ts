import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt necesar' }, { status: 400 });
    }

    // Interpretarea AI pentru structura Word
    let aiStructure = '';
    try {
      const aiPrompt = `Analizează următoarea cerere și creează o structură detaliată pentru un document Word:

Cererea utilizatorului: ${prompt}

Te rog să răspunzi cu o structură JSON care să conțină:
1. Un nume pentru document (fără extensie)
2. Titlul principal
3. Secțiuni cu subtitluri și conținut
4. Tabele dacă sunt necesare

Exemplu de răspuns:
{
  "fileName": "raport_proiect",
  "title": "Raport de Proiect",
  "sections": [
    {
      "heading": "Introducere",
      "content": "Acest document prezintă..."
    },
    {
      "heading": "Detalii Tehnice",
      "content": "Aspectele tehnice includ...",
      "table": {
        "headers": ["Element", "Descriere", "Status"],
        "rows": [
          ["Fundație", "Beton armat", "Finalizat"],
          ["Structură", "Cadre metalice", "În progres"]
        ]
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
      const cleanJson = aiStructure.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      structure = JSON.parse(cleanJson);
    } catch (parseError) {
      console.log('Folosesc structura default, AI nu a returnat JSON valid');
      structure = {
        fileName: "document_generat",
        title: "Document Generat",
        sections: [
          {
            heading: "Introducere",
            content: "Acest document a fost generat automat pe baza cererii dumneavoastră."
          },
          {
            heading: "Detalii",
            content: "Conținutul documentului poate fi personalizat conform nevoilor specifice ale proiectului.",
            table: {
              headers: ["Element", "Descriere", "Status"],
              rows: [
                ["Punct 1", "Descriere detaliată", "Activ"],
                ["Punct 2", "Informații suplimentare", "Planificat"],
                ["Punct 3", "Alte specificații", "În progres"]
              ]
            }
          }
        ]
      };
    }

    // Import dinamic pentru docx
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableCell, TableRow, WidthType } = await import('docx');

    // Crearea documentului Word
    const children: any[] = [];

    // Adăugarea titlului principal
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: structure.title || "Document",
            bold: true,
            size: 32, // 16pt
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 400,
        },
      })
    );

    // Adăugarea datei
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Data: ${new Date().toLocaleDateString('ro-RO')}`,
            italics: true,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          after: 600,
        },
      })
    );

    // Adăugarea secțiunilor
    structure.sections.forEach((section: any) => {
      // Subtitlul secțiunii
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.heading,
              bold: true,
              size: 24, // 12pt
            }),
          ],
          spacing: {
            before: 400,
            after: 200,
          },
        })
      );

      // Conținutul secțiunii
      if (section.content) {
        const contentParagraphs = section.content.split('\n').filter((p: string) => p.trim());
        contentParagraphs.forEach((paragraph: string) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: paragraph.trim(),
                }),
              ],
              spacing: {
                after: 200,
              },
            })
          );
        });
      }

      // Tabelul dacă există
      if (section.table && section.table.headers && section.table.rows) {
        const tableRows: any[] = [];

        // Rândul cu anteturi
        const headerCells = section.table.headers.map((header: string) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: header,
                    bold: true,
                    color: "FFFFFF",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: {
              fill: "366092",
            },
          })
        );
        tableRows.push(new TableRow({ children: headerCells }));

        // Rândurile cu date
        section.table.rows.forEach((row: string[]) => {
          const dataCells = row.map((cell: string) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
            })
          );
          tableRows.push(new TableRow({ children: dataCells }));
        });

        // Adăugarea tabelului
        children.push(
          new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
          })
        );

        // Spațiu după tabel
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "" })],
            spacing: {
              after: 300,
            },
          })
        );
      }
    });

    // Crearea documentului
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    // Generarea buffer-ului
    const buffer = await Packer.toBuffer(doc);
    
    // Determinarea numelui fișierului
    const fileName = `${structure.fileName || 'document_generat'}.docx`;
    
    // Returnarea fișierului
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Filename': fileName
      }
    });

  } catch (error) {
    console.error('Eroare la generarea Word:', error);
    return NextResponse.json({ 
      error: 'Eroare la generarea fișierului Word',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

