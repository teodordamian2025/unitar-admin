import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Configurare BigQuery cu variabile de mediu
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { action, query, data, table, dataset } = await request.json();

    switch (action) {
      case 'schema':
        // Detectează automat schema din BigQuery
        const datasetName = dataset || 'PanouControlUnitar';
        
        try {
          // Obține toate tabelele din dataset
          const [tables] = await bigquery.dataset(datasetName).getTables();
          
          const schema: Record<string, any> = {};
          
          for (const table of tables) {
            const tableName = table.id;
            
            // Verifică dacă tableName există
            if (!tableName) {
              console.warn('Tabelă fără nume găsită, o omit');
              continue;
            }
            
            // Obține schema pentru fiecare tabelă
            const [metadata] = await table.getMetadata();
            const fields = metadata.schema?.fields || [];
            
            schema[tableName] = {
              description: getTableDescription(tableName),
              columns: {} as Record<string, any>,
              rowCount: metadata.numRows || 0,
              createdAt: metadata.creationTime,
              lastModified: metadata.lastModifiedTime
            };
            
            // Procesează coloanele
            fields.forEach((field: any) => {
              if (field.name) {
                schema[tableName].columns[field.name] = {
                  type: field.type,
                  mode: field.mode || 'NULLABLE',
                  description: getColumnDescription(tableName, field.name)
                };
              }
            });
          }
          
          return NextResponse.json({
            success: true,
            schema: schema,
            datasetName: datasetName,
            tableCount: tables.length
          });
          
        } catch (schemaError) {
          console.error('Eroare la obținerea schemei:', schemaError);
          return NextResponse.json({ 
            error: 'Nu s-a putut obține schema bazei de date',
            details: schemaError instanceof Error ? schemaError.message : 'Eroare necunoscută'
          }, { status: 500 });
        }

      case 'query':
        // Execută o interogare SQL
        if (!query) {
          return NextResponse.json({ error: 'Query necesar' }, { status: 400 });
        }
        
        console.log('Executing query:', query);
        
        const [rows] = await bigquery.query({
          query: query,
          location: 'EU',
        });
        
        return NextResponse.json({
          success: true,
          data: rows,
          rowCount: rows.length
        });

      case 'insert':
        // Inserează date într-o tabelă
        if (!table || !data) {
          return NextResponse.json({ error: 'Tabelă și date necesare' }, { status: 400 });
        }
        
        const datasetForInsert = dataset || 'PanouControlUnitar';
        const insertQuery = generateInsertQuery(datasetForInsert, table, data);
        
        console.log('Executing insert:', insertQuery);
        
        const [insertResult] = await bigquery.query({
          query: insertQuery,
          location: 'EU',
        });
        
        return NextResponse.json({
          success: true,
          message: 'Datele au fost inserate cu succes',
          insertedRows: Array.isArray(data) ? data.length : 1
        });

      case 'sample':
        // Obține un sample de date din tabelă pentru AI
        if (!table) {
          return NextResponse.json({ error: 'Numele tabelei necesar' }, { status: 400 });
        }
        
        const datasetForSample = dataset || 'PanouControlUnitar';
        const sampleQuery = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${datasetForSample}.${table}\` LIMIT 5`;
        
        const [sampleRows] = await bigquery.query({
          query: sampleQuery,
          location: 'EU',
        });
        
        return NextResponse.json({
          success: true,
          data: sampleRows,
          rowCount: sampleRows.length,
          tableName: table
        });

      default:
        return NextResponse.json({ error: 'Acțiune necunoscută' }, { status: 400 });
    }

  } catch (error) {
    console.error('Eroare BigQuery:', error);
    return NextResponse.json({ 
      error: 'Eroare la conectarea cu BigQuery',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// Funcție pentru descrierea tabelelor
function getTableDescription(tableName: string): string {
  const descriptions: Record<string, string> = {
    'BancaTranzactii': 'Tabela cu tranzacțiile bancare ale firmei',
    'Clienti': 'Tabela cu informațiile despre clienții firmei',
    'Contracte': 'Tabela cu contractele încheiate',
    'FacturiEmise': 'Tabela cu facturile emise către clienți',
    'FacturiPrimite': 'Tabela cu facturile primite de la furnizori',
    'Proiecte': 'Tabela cu proiectele firmei',
    'Subproiecte': 'Tabela cu subproiectele asociate proiectelor principale'
  };
  
  return descriptions[tableName] || `Tabela ${tableName}`;
}

// Funcție pentru descrierea coloanelor
function getColumnDescription(tableName: string, columnName: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    'BancaTranzactii': {
      'ID_Transaction': 'ID unic al tranzacției',
      'Data': 'Data tranzacției',
      'Tip': 'Tipul tranzacției (intrare/ieșire)',
      'Explicatii': 'Detalii despre tranzacție',
      'Suma': 'Suma tranzacției',
      'Moneda': 'Moneda tranzacției',
      'IBAN': 'IBAN-ul contului',
      'Nume_Partener': 'Numele partenerului de tranzacție',
      'Tip_Partener': 'Tipul partenerului (client/furnizor)',
      'Proiect': 'Proiectul asociat',
      'Subproiect': 'Subproiectul asociat',
      'Asociere_Contract': 'Contractul asociat',
      'Asociere_Factura': 'Factura asociată'
    }
  };
  
  return descriptions[tableName]?.[columnName] || `Coloana ${columnName}`;
}

// Funcție helper pentru generarea query-urilor INSERT
function generateInsertQuery(dataset: string, table: string, data: any): string {
  const fullTableName = `\`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
  
  if (Array.isArray(data)) {
    // Multiple rows
    const columns = Object.keys(data[0]);
    const values = data.map(row => 
      `(${columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        return `'${value}'`;
      }).join(', ')})`
    ).join(', ');
    
    return `INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES ${values}`;
  } else {
    // Single row
    const columns = Object.keys(data);
    const values = columns.map(col => {
      const value = data[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'number') return value.toString();
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      return `'${value}'`;
    }).join(', ');
    
    return `INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES (${values})`;
  }
}

