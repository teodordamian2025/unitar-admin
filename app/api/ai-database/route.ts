// app/api/ai-database/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Stocare temporară pentru query-urile pending
const pendingQueries = new Map<string, { query: string, timestamp: number }>();

export async function POST(request: NextRequest) {
  try {
    const { prompt, context = 'general', dataset = 'PanouControlUnitar', sessionId } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt necesar' }, { status: 400 });
    }

    const trimmed = prompt.trim();
    const sessionKey = sessionId || 'default';

    // Verifică dacă este o confirmare
    if (trimmed.toUpperCase() === 'CONFIRM') {
      const pendingQuery = pendingQueries.get(sessionKey);
      
      if (pendingQuery) {
        if (Date.now() - pendingQuery.timestamp > 300000) {
          pendingQueries.delete(sessionKey);
          return NextResponse.json({
            success: true,
            reply: 'Sesiunea a expirat. Te rog să reintroduci cererea.'
          });
        }

        try {
          const queryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bigquery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'query', 
              query: pendingQuery.query 
            })
          });

          const queryData = await queryResponse.json();
          pendingQueries.delete(sessionKey);
          
          if (queryData.success) {
            return NextResponse.json({
              success: true,
              reply: `✅ **Operațiunea executată cu succes!** Datele au fost modificate în baza de date.`
            });
          } else {
            return NextResponse.json({
              success: true,
              reply: `❌ **Eroare:** ${queryData.error}`
            });
          }
        } catch (executeError) {
          return NextResponse.json({
            success: true,
            reply: `❌ **Eroare:** ${executeError}`
          });
        }
      } else {
        return NextResponse.json({
          success: true,
          reply: 'Nu am găsit nicio operațiune pentru confirmare. Te rog să reintroduci cererea.'
        });
      }
    }

    // Obține schema reală din BigQuery
    const schemaResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bigquery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'schema', dataset: dataset })
    });

    const schemaData = await schemaResponse.json();
    
    if (!schemaData.success) {
      throw new Error('Nu s-a putut obține schema bazei de date');
    }

    // Analiză directă a cererii pentru a decide dacă să execute query direct
    const lower = trimmed.toLowerCase();
    let directQuery = '';
    
    // Detectează cereri simple care necesită query direct
    if (lower.includes('lista') && lower.includes('proiecte')) {
      directQuery = `SELECT ID_Proiect, Denumire, Client, Status, Valoare_Estimata FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\``;
    } else if (lower.includes('câte proiecte') || lower.includes('numar proiecte')) {
      directQuery = `SELECT COUNT(*) as total_proiecte FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\``;
    } else if (lower.includes('lista') && lower.includes('client')) {
      directQuery = `
        WITH LatestVersions AS (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY id ORDER BY data_actualizare DESC, data_creare DESC) as rn
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Clienti_v2\`
          WHERE activ = TRUE
        )
        SELECT * EXCEPT(rn) FROM LatestVersions WHERE rn = 1
      `;
    } else if (lower.includes('câți clienți') || lower.includes('numar client')) {
      directQuery = `
        WITH LatestVersions AS (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY id ORDER BY data_actualizare DESC, data_creare DESC) as rn
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Clienti_v2\`
          WHERE activ = TRUE
        )
        SELECT COUNT(*) as total_clienti FROM LatestVersions WHERE rn = 1
      `;
    } else if (lower.includes('lista') && lower.includes('contract')) {
      directQuery = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Contracte\``;
    } else if (lower.includes('tranzacții') || lower.includes('tranzactii')) {
      directQuery = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.BancaTranzactii\` LIMIT 10`;
    }

    // Dacă am identificat un query direct, execută-l
    if (directQuery) {
      try {
        const queryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bigquery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'query', 
            query: directQuery 
          })
        });

        const queryData = await queryResponse.json();
        
        if (queryData.success) {
          if (queryData.data.length === 0) {
            return NextResponse.json({
              success: true,
              reply: `Am făcut interogarea - nu s-au găsit rezultate.`
            });
          } else {
            // Formatare rezultate scurte
            let shortReply = `Am găsit ${queryData.data.length} rezultate:\n\n`;
            
            queryData.data.forEach((row: any, index: number) => {
              shortReply += `**${index + 1}.** `;
              
              // Pentru COUNT queries
              if (row.total_proiecte !== undefined) {
                shortReply = `Numărul total de proiecte: ${row.total_proiecte}`;
                return;
              }
              if (row.total_clienti !== undefined) {
                shortReply = `Numărul total de clienți: ${row.total_clienti}`;
                return;
              }
              
              // Extrage doar câmpurile importante
              const importantFields = ['ID_Proiect', 'Denumire', 'Client', 'Status', 'Valoare_Estimata', 'nume', 'email', 'Suma', 'Data'];
              const displayData: string[] = [];
              
              importantFields.forEach(field => {
                if (row[field] !== undefined && row[field] !== null) {
                  let value = row[field];
                  if (typeof value === 'object' && value.value) {
                    value = value.value;
                  }
                  displayData.push(`${field}: ${value}`);
                }
              });
              
              if (displayData.length === 0) {
                // Dacă nu găsește câmpuri importante, ia primele 3
                const allFields = Object.keys(row).slice(0, 3);
                allFields.forEach(field => {
                  let value = row[field];
                  if (typeof value === 'object' && value.value) {
                    value = value.value;
                  }
                  if (value !== null && value !== undefined) {
                    displayData.push(`${field}: ${value}`);
                  }
                });
              }
              
              shortReply += displayData.join(', ') + '\n';
            });
            
            return NextResponse.json({
              success: true,
              reply: shortReply
            });
          }
        } else {
          return NextResponse.json({
            success: true,
            reply: `❌ Eroare la interogare: ${queryData.error}`
          });
        }
      } catch (queryError) {
        return NextResponse.json({
          success: true,
          reply: `❌ Eroare la interogare: ${queryError}`
        });
      }
    }

    // Dacă nu am query direct, folosesc AI pentru a genera unul
    const schemaDescription = Object.entries(schemaData.schema).map(([tableName, tableInfo]: [string, any]) => {
      const columns = Object.entries(tableInfo.columns).map(([colName, colInfo]: [string, any]) => 
        `${colName} (${colInfo.type})`
      ).join(', ');
      
      return `**${tableName}**: ${columns}`;
    }).join('\n');

    const aiPrompt = `Ești un asistent AI pentru firma Unitar Proiect. TREBUIE să generezi un query SQL exact pentru BigQuery.

Dataset BigQuery: ${dataset}
Proiect: ${process.env.GOOGLE_CLOUD_PROJECT_ID}

Schema tabelelor:
${schemaDescription}

Cererea utilizatorului: ${trimmed}

INSTRUCȚIUNI OBLIGATORII:
1. Generează ÎNTOTDEAUNA un query SQL valid între \`\`\`sql și \`\`\`
2. Folosește format complet: \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.NUME_TABELA\`
3. Pentru SELECT - execut direct
4. Pentru INSERT/UPDATE/DELETE - cer confirmarea
5. Nu da răspunsuri false, doar query-uri reale

Răspunde DOAR cu query-ul SQL în format:
\`\`\`sql
SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\`
\`\`\``;

    // Trimite către OpenAI
    const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/queryOpenAI`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: aiPrompt })
    });

    if (!aiResponse.ok) {
      throw new Error('Eroare la comunicarea cu AI');
    }

    const aiData = await aiResponse.json();
    let reply = aiData.reply || 'Nu am putut procesa cererea';

    // Verifică dacă AI-ul a sugerat o operațiune pe baza de date
    const sqlMatch = reply.match(/```sql\s*\n([\s\S]*?)\n\s*```/);
    
    if (sqlMatch) {
      const sqlQuery = sqlMatch[1].trim();
      const isSelect = sqlQuery.toUpperCase().startsWith('SELECT');
      
      if (isSelect) {
        // Execută direct SELECT
        try {
          const queryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bigquery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'query', 
              query: sqlQuery 
            })
          });

          const queryData = await queryResponse.json();
          
          if (queryData.success) {
            if (queryData.data.length === 0) {
              return NextResponse.json({
                success: true,
                reply: `Am făcut interogarea - nu s-au găsit rezultate.`
              });
            } else {
              // Formatare rezultate scurte (același cod ca mai sus)
              let shortReply = `Am găsit ${queryData.data.length} rezultate:\n\n`;
              
              queryData.data.forEach((row: any, index: number) => {
                shortReply += `**${index + 1}.** `;
                
                const importantFields = ['ID_Proiect', 'Denumire', 'Client', 'Status', 'Valoare_Estimata', 'nume', 'email', 'Suma', 'Data'];
                const displayData: string[] = [];
                
                importantFields.forEach(field => {
                  if (row[field] !== undefined && row[field] !== null) {
                    let value = row[field];
                    if (typeof value === 'object' && value.value) {
                      value = value.value;
                    }
                    displayData.push(`${field}: ${value}`);
                  }
                });
                
                if (displayData.length === 0) {
                  const allFields = Object.keys(row).slice(0, 3);
                  allFields.forEach(field => {
                    let value = row[field];
                    if (typeof value === 'object' && value.value) {
                      value = value.value;
                    }
                    if (value !== null && value !== undefined) {
                      displayData.push(`${field}: ${value}`);
                    }
                  });
                }
                
                shortReply += displayData.join(', ') + '\n';
              });
              
              return NextResponse.json({
                success: true,
                reply: shortReply
              });
            }
          } else {
            return NextResponse.json({
              success: true,
              reply: `❌ Eroare la interogare: ${queryData.error}`
            });
          }
        } catch (queryError) {
          return NextResponse.json({
            success: true,
            reply: `❌ Eroare la interogare: ${queryError}`
          });
        }
      } else {
        // Pentru INSERT/UPDATE/DELETE
        pendingQueries.set(sessionKey, {
          query: sqlQuery,
          timestamp: Date.now()
        });
        
        return NextResponse.json({
          success: true,
          reply: `⚠️ Această operațiune va modifica baza de date. Răspunde cu "CONFIRM" pentru a continua.`
        });
      }
    } else {
      // Dacă AI nu a generat un query valid
      return NextResponse.json({
        success: true,
        reply: `Nu am putut genera un query pentru cererea ta. Te rog să fii mai specific (ex: "lista cu toate proiectele", "câte contracte am").`
      });
    }

  } catch (error) {
    console.error('Eroare AI-Database:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea cererii cu baza de date',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

