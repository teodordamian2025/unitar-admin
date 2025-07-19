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

    // Prompt optimizat pentru răspunsuri scurte
    const aiPrompt = `Ești un asistent AI pentru firma Unitar Proiect. Răspunde SCURT și DIRECT.

Dataset BigQuery: ${dataset}
Tabele disponibile: ${Object.keys(schemaData.schema).join(', ')}

Cererea utilizatorului: ${trimmed}

REGULI IMPORTANTE:
1. Dacă trebuie să faci SELECT - execută direct și prezintă rezultatele SCURT
2. Dacă trebuie INSERT/UPDATE/DELETE - generează query-ul și cere confirmarea
3. Răspunsurile să fie de maxim 2-3 propoziții
4. Pentru rezultate, spune: "Am găsit X rezultate:" apoi listează-le simplu
5. Nu explica ce faci, doar execută și prezintă rezultatul
6. Folosește format: \`project.dataset.table\`

Răspunde în română, scurt și la obiect.`;

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
        // Execută direct SELECT și formatează rezultatul scurt
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
              // Formatare rezultate scurte
              let shortReply = `Am găsit ${queryData.data.length} rezultate:\n\n`;
              
              queryData.data.forEach((row: any, index: number) => {
                shortReply += `**${index + 1}.** `;
                
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
                    displayData.push(`${field}: ${value}`);
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
    }

    return NextResponse.json({
      success: true,
      reply: reply,
      hasDatabase: true
    });

  } catch (error) {
    console.error('Eroare AI-Database:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea cererii cu baza de date',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

