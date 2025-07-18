import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, context = 'general', dataset = 'PanouControlUnitar' } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt necesar' }, { status: 400 });
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

    // Creează prompt-ul detaliat pentru AI
    const schemaDescription = Object.entries(schemaData.schema).map(([tableName, tableInfo]: [string, any]) => {
      const columns = Object.entries(tableInfo.columns).map(([colName, colInfo]: [string, any]) => 
        `  - ${colName}: ${colInfo.type} (${colInfo.mode}) - ${colInfo.description}`
      ).join('\n');
      
      return `**${tableName}** (${tableInfo.rowCount} rânduri)
${tableInfo.description}
Coloane:
${columns}`;
    }).join('\n\n');

    const aiPrompt = `Ești un asistent AI pentru administrarea firmei de inginerie structurală Unitar Proiect. 
Ai acces la o bază de date BigQuery cu următoarele tabele REALE:

Dataset: ${dataset}
Proiect: ${process.env.GOOGLE_CLOUD_PROJECT_ID}

${schemaDescription}

Contextul conversației: ${context}

Cererea utilizatorului: ${prompt}

INSTRUCȚIUNI IMPORTANTE:
1. Folosește numele exacte ale tabelelor și coloanelor din schema de mai sus
2. Toate query-urile SQL trebuie să folosească sintaxa BigQuery
3. Folosește format complet pentru tabele: \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.NUME_TABELA\`
4. Pentru INSERT, UPDATE, DELETE - întreabă întotdeauna confirmarea
5. Pentru SELECT - execută direct

Te rog să răspunzi și să îmi spui dacă trebuie să:
1. Interoghez baza de date (SELECT)
2. Adaug date noi (INSERT)
3. Actualizez date existente (UPDATE)
4. Șterg date (DELETE)
5. Sau doar să răspund la întrebare

Dacă trebuie să interacționez cu baza de date, te rog să îmi dai query-ul SQL exact între \`\`\`sql și \`\`\`.

Răspunde în română și fii foarte precis.`;

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
      
      // Verifică tipul de operațiune
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
            reply += `\n\n**Rezultatul interogării:**\n`;
            if (queryData.data.length === 0) {
              reply += `Nu s-au găsit rezultate.`;
            } else {
              reply += `Găsite ${queryData.data.length} rezultate:\n\n`;
              queryData.data.forEach((row: any, index: number) => {
                reply += `${index + 1}. ${JSON.stringify(row, null, 2)}\n`;
              });
            }
          } else {
            reply += `\n\n**Eroare la executarea interogării:** ${queryData.error}`;
          }
        } catch (queryError) {
          reply += `\n\n**Eroare la executarea interogării:** ${queryError}`;
        }
      } else {
        // Pentru operațiunile care modifică datele, cere confirmarea
        reply += `\n\n⚠️ **ATENȚIE:** Această operațiune va modifica datele din baza de date!`;
        reply += `\n\nPentru a executa această operațiune, răspunde cu "CONFIRM" și voi executa query-ul.`;
      }
    }

    return NextResponse.json({
      success: true,
      reply: reply,
      hasDatabase: true,
      schema: schemaData.schema,
      sqlQuery: sqlMatch ? sqlMatch[1].trim() : null
    });

  } catch (error) {
    console.error('Eroare AI-Database:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea cererii cu baza de date',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

