// ==================================================================
// CALEA: app/api/rapoarte/procese-verbale/route.ts
// DATA: 07.09.2025 20:15 (ora României)
// DESCRIERE: API CRUD complet pentru Procese Verbale de Predare-Primire
// PĂSTRATE: Toate pattern-urile din subproiecte + contracte pentru consistență
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const PROJECT_ID = 'hale-mode-464009-i6';
const dataset = 'PanouControlUnitar';
const table = 'ProcesVerbale';

// Helper functions PĂSTRATE din pattern-urile existente
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '') {
    return 'NULL';
  }
  
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  
  console.warn('Data nu este în format ISO YYYY-MM-DD:', dateString);
  return 'NULL';
};

const sanitizeStringForBigQuery = (value: any): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  
  return String(value).trim() || null;
};

// Asigură existența tabelului cu schema completă
async function ensureTableExists() {
  try {
    const [exists] = await bigquery.dataset(dataset).table(table).exists();
    
    if (!exists) {
      console.log(`Creez tabelul ${table}...`);
      
      const schema = [
        { name: 'ID_PV', type: 'STRING', mode: 'REQUIRED' },
        { name: 'numar_pv', type: 'STRING', mode: 'REQUIRED' },
        { name: 'serie_pv', type: 'STRING', mode: 'REQUIRED' },
        { name: 'tip_document', type: 'STRING', mode: 'REQUIRED' },
        { name: 'proiect_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'subproiecte_ids', type: 'JSON', mode: 'NULLABLE' },
        { name: 'client_id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'client_nume', type: 'STRING', mode: 'REQUIRED' },
        { name: 'denumire_pv', type: 'STRING', mode: 'REQUIRED' },
        { name: 'data_predare', type: 'DATE', mode: 'REQUIRED' },
        { name: 'status_predare', type: 'STRING', mode: 'REQUIRED' },
        { name: 'valoare_totala', type: 'NUMERIC(15,2)', mode: 'NULLABLE' },
        { name: 'moneda', type: 'STRING', mode: 'NULLABLE' },
        { name: 'curs_valutar', type: 'NUMERIC(10,4)', mode: 'NULLABLE' },
        { name: 'data_curs_valutar', type: 'DATE', mode: 'NULLABLE' },
        { name: 'valoare_ron', type: 'NUMERIC(15,2)', mode: 'NULLABLE' },
        { name: 'path_fisier', type: 'STRING', mode: 'NULLABLE' },
        { name: 'hash_continut', type: 'STRING', mode: 'NULLABLE' },
        { name: 'observatii', type: 'STRING', mode: 'NULLABLE' },
        { name: 'note_interne', type: 'STRING', mode: 'NULLABLE' },
        { name: 'data_creare', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'data_actualizare', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'creat_de', type: 'STRING', mode: 'NULLABLE' },
        { name: 'actualizat_de', type: 'STRING', mode: 'NULLABLE' },
        { name: 'activ', type: 'BOOLEAN', mode: 'REQUIRED' },
        { name: 'versiune', type: 'INTEGER', mode: 'REQUIRED' }
      ];

      await bigquery.dataset(dataset).createTable(table, { schema });
      console.log(`✅ Tabelul ${table} creat cu succes`);
    }
  } catch (error) {
    console.error(`Eroare la crearea tabelului ${table}:`, error);
    throw error;
  }
}

// GET - Încarcă PV-urile cu filtrare și JOIN cu proiecte
export async function GET(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const { searchParams } = new URL(request.url);
    
    let query = `
      SELECT 
        pv.*,
        p.Denumire as Proiect_Denumire,
        p.Client as Proiect_Client,
        p.Adresa as Proiect_Adresa,
        p.Responsabil as Proiect_Responsabil
      FROM \`${PROJECT_ID}.${dataset}.${table}\` pv
      LEFT JOIN \`${PROJECT_ID}.${dataset}.Proiecte\` p 
        ON pv.proiect_id = p.ID_Proiect
      WHERE pv.activ = true
    `;
    
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre ca în pattern-ul subproiecte
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(pv.numar_pv) LIKE LOWER(@search) OR 
        LOWER(pv.denumire_pv) LIKE LOWER(@search) OR 
        LOWER(pv.client_nume) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Denumire, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    const status = searchParams.get('status_predare');
    if (status) {
      conditions.push('pv.status_predare = @status');
      params.status = status;
      types.status = 'STRING';
    }

    const proiectId = searchParams.get('proiect_id');
    if (proiectId) {
      conditions.push('pv.proiect_id = @proiectId');
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    const clientId = searchParams.get('client_id');
    if (clientId) {
      conditions.push('pv.client_id = @clientId');
      params.clientId = clientId;
      types.clientId = 'STRING';
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY pv.data_predare DESC, pv.data_creare DESC';

    console.log('Executing PV query:', query);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`Found ${rows.length} procese verbale`);

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
      message: `${rows.length} procese verbale încărcate`
    });

  } catch (error) {
    console.error('Eroare la încărcarea proceselor verbale:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea proceselor verbale',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Creează PV nou
export async function POST(request: NextRequest) {
  try {
    await ensureTableExists();
    
    const body = await request.json();
    console.log('POST PV request body:', body);
    
    const { 
      ID_PV,
      numar_pv,
      serie_pv = 'PV',
      tip_document = 'pv',
      proiect_id,
      subproiecte_ids = [],
      client_id,
      client_nume,
      denumire_pv,
      data_predare,
      status_predare = 'Predat',
      valoare_totala,
      moneda = 'RON',
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      observatii,
      note_interne,
      creat_de
    } = body;

    // Validări ca în pattern-ul subproiecte
    if (!ID_PV || !numar_pv || !proiect_id || !client_nume || !denumire_pv || !data_predare) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile ID_PV, numar_pv, proiect_id, client_nume, denumire_pv și data_predare sunt obligatorii' 
      }, { status: 400 });
    }

    console.log('=== DEBUG PV: Date primite ===');
    console.log('data_predare primit:', data_predare);
    console.log('data_curs_valutar primit:', data_curs_valutar);

    // Formatare DATE literale ca în pattern-ul contracte
    const dataPredareFort = formatDateLiteral(data_predare);
    const dataCursFormatted = formatDateLiteral(data_curs_valutar);

    console.log('=== DEBUG PV: Date formatate pentru BigQuery ===');
    console.log('data_predare formatată:', dataPredareFort);
    console.log('data_curs_valutar formatată:', dataCursFormatted);

    // INSERT cu DATE literale în loc de parameters (ca în pattern-ul subproiecte)
    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.${dataset}.${table}\`
      (ID_PV, numar_pv, serie_pv, tip_document, proiect_id, subproiecte_ids, client_id, 
       client_nume, denumire_pv, data_predare, status_predare, valoare_totala, moneda, 
       curs_valutar, data_curs_valutar, valoare_ron, observatii, note_interne,
       activ, versiune, data_creare, data_actualizare, creat_de)
      VALUES (
        '${escapeString(ID_PV)}',
        '${escapeString(numar_pv)}',
        '${escapeString(serie_pv)}',
        '${escapeString(tip_document)}',
        '${escapeString(proiect_id)}',
        ${subproiecte_ids.length > 0 ? `PARSE_JSON('${JSON.stringify(subproiecte_ids).replace(/'/g, "''")}')` : 'NULL'},
        ${client_id ? `'${escapeString(client_id)}'` : 'NULL'},
        '${escapeString(client_nume)}',
        '${escapeString(denumire_pv)}',
        ${dataPredareFort},
        '${escapeString(status_predare)}',
        ${valoare_totala || 'NULL'},
        '${escapeString(moneda)}',
        ${curs_valutar || 'NULL'},
        ${dataCursFormatted},
        ${valoare_ron || 'NULL'},
        ${observatii ? `'${escapeString(observatii)}'` : 'NULL'},
        ${note_interne ? `'${escapeString(note_interne)}'` : 'NULL'},
        true,
        1,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        ${creat_de ? `'${escapeString(creat_de)}'` : 'NULL'}
      )
    `;

    console.log('=== DEBUG PV: Query INSERT final ===');
    console.log(insertQuery);

    // Executare query fără parameters pentru DATE fields
    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`✅ Proces Verbal ${ID_PV} adăugat cu succes pentru proiectul ${proiect_id}`);

    return NextResponse.json({
      success: true,
      message: 'Proces Verbal adăugat cu succes',
      data: { ID_PV, numar_pv, proiect_id }
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la adăugarea PV ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea procesului verbal',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizează PV
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID PV necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log('=== DEBUG PUT PV: Date primite pentru actualizare ===');
    console.log('ID:', id);
    console.log('Update data:', updateData);

    // Construire query UPDATE cu DATE literale (pattern din subproiecte)
    const updateFields: string[] = [];

    const allowedFields = [
      'numar_pv', 'serie_pv', 'denumire_pv', 'data_predare', 'status_predare', 
      'valoare_totala', 'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'observatii', 'note_interne', 'actualizat_de', 'subproiecte_ids'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        // Tratament special pentru câmpurile DATE
        if (['data_predare', 'data_curs_valutar'].includes(key)) {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
        } else if (key === 'subproiecte_ids' && Array.isArray(value)) {
          if (value.length > 0) {
            updateFields.push(`${key} = PARSE_JSON('${JSON.stringify(value).replace(/'/g, "''")}')`);
          } else {
            updateFields.push(`${key} = NULL`);
          }
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else if (typeof value === 'string') {
          updateFields.push(`${key} = '${escapeString(value)}'`);
        } else if (typeof value === 'number') {
          updateFields.push(`${key} = ${value}`);
        } else {
          updateFields.push(`${key} = '${escapeString(value.toString())}'`);
        }
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    // Adaugă versiune și data_actualizare
    updateFields.push('versiune = versiune + 1');
    updateFields.push('data_actualizare = CURRENT_TIMESTAMP()');

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_PV = '${escapeString(id)}'
    `;

    console.log('=== DEBUG PUT PV: Query UPDATE cu DATE literale ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT PV: Update executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proces Verbal actualizat cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la actualizarea PV ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea procesului verbal',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Șterge PV (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID PV necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete cu câmpul activ (pattern din subproiecte)
    const deleteQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = CURRENT_TIMESTAMP(), versiune = versiune + 1
      WHERE ID_PV = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`✅ Proces Verbal ${id} șters (soft delete)`);

    return NextResponse.json({
      success: true,
      message: 'Proces Verbal șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea PV:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea procesului verbal',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
