// ==================================================================
// CALEA: app/api/rapoarte/subproiecte/route.ts  
// MODIFICAT: Fix activ field + îmbunătățiri afișare subproiecte
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

const dataset = 'PanouControlUnitar';
const table = 'Subproiecte';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ✅ FIX: Query simplificat și verificare câmp activ
    let query = `
      SELECT 
        s.*,
        p.Client,
        p.Denumire as Proiect_Denumire
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` s
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p 
        ON s.ID_Proiect = p.ID_Proiect
      WHERE (s.activ IS NULL OR s.activ = true)
    `;
    
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(s.ID_Subproiect) LIKE LOWER(@search) OR 
        LOWER(s.Denumire) LIKE LOWER(@search) OR 
        LOWER(COALESCE(s.Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Client, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    const status = searchParams.get('status');
    if (status) {
      conditions.push('s.Status = @status');
      params.status = status;
      types.status = 'STRING';
    }

    const proiectId = searchParams.get('proiect_id');
    if (proiectId) {
      conditions.push('s.ID_Proiect = @proiectId');
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Sortare
    query += ' ORDER BY s.ID_Proiect, s.Data_Start DESC';

    console.log('Executing subproiecte query:', query);
    console.log('With params:', params);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`Found ${rows.length} subproiecte`); // ✅ Debug logging

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea subproiectelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea subproiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST subproiect request body:', body);
    
    const { 
      ID_Subproiect, 
      ID_Proiect,
      Denumire, 
      Responsabil,
      Data_Start, 
      Data_Final, 
      Status = 'Activ', 
      Valoare_Estimata 
    } = body;

    // Validări
    if (!ID_Subproiect || !ID_Proiect || !Denumire) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile ID_Subproiect, ID_Proiect și Denumire sunt obligatorii' 
      }, { status: 400 });
    }

    // ✅ FIX: Adăugat câmpul activ = true explicit
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, 
       Status, Valoare_Estimata, activ, data_creare)
      VALUES (@ID_Subproiect, @ID_Proiect, @Denumire, @Responsabil, @Data_Start, 
              @Data_Final, @Status, @Valoare_Estimata, @activ, @data_creare)
    `;

    // ✅ FIX: Params cu activ = true și data_creare
    const params = {
      ID_Subproiect: ID_Subproiect,
      ID_Proiect: ID_Proiect,
      Denumire: Denumire,
      Responsabil: Responsabil || null,
      Data_Start: Data_Start || null,
      Data_Final: Data_Final || null,
      Status: Status,
      Valoare_Estimata: Valoare_Estimata || null,
      activ: true, // ✅ FIX: Explicit true
      data_creare: new Date().toISOString() // ✅ FIX: Timestamp creare
    };

    // ✅ FIX: Types pentru toate câmpurile
    const types = {
      ID_Subproiect: 'STRING',
      ID_Proiect: 'STRING',
      Denumire: 'STRING',
      Responsabil: 'STRING',
      Data_Start: 'DATE',
      Data_Final: 'DATE',
      Status: 'STRING',
      Valoare_Estimata: 'NUMERIC',
      activ: 'BOOLEAN', // ✅ FIX: Type pentru activ
      data_creare: 'TIMESTAMP' // ✅ FIX: Type pentru data_creare
    };

    console.log('Insert subproiect params:', params);

    await bigquery.query({
      query: insertQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`✅ Subproiect ${ID_Subproiect} adăugat cu succes pentru proiectul ${ID_Proiect}`); // ✅ Debug

    return NextResponse.json({
      success: true,
      message: 'Subproiect adăugat cu succes',
      data: { ID_Subproiect, ID_Proiect }
    });

  } catch (error) {
    console.error('Eroare la adăugarea subproiectului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea subproiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID subproiect necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id };
    const types: any = { id: 'STRING' };

    const fieldTypes: { [key: string]: string } = {
      'Denumire': 'STRING',
      'Responsabil': 'STRING',
      'Data_Start': 'DATE',
      'Data_Final': 'DATE',
      'Status': 'STRING',
      'Valoare_Estimata': 'NUMERIC'
    };

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && fieldTypes[key]) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value || null;
        types[key] = fieldTypes[key];
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    // ✅ FIX: Adăugat data_actualizare la UPDATE
    updateFields.push('data_actualizare = @data_actualizare');
    params.data_actualizare = new Date().toISOString();
    types.data_actualizare = 'TIMESTAMP';

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Subproiect = @id
    `;

    console.log('Update subproiect query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Subproiect actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea subproiectului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea subproiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID subproiect necesar pentru ștergere' 
      }, { status: 400 });
    }

    // ✅ FIX: Soft delete cu câmpul activ
    const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = @data_actualizare
      WHERE ID_Subproiect = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { 
        id,
        data_actualizare: new Date().toISOString()
      },
      types: { 
        id: 'STRING',
        data_actualizare: 'TIMESTAMP'
      },
      location: 'EU',
    });

    console.log(`✅ Subproiect ${id} șters (soft delete)`); // ✅ Debug

    return NextResponse.json({
      success: true,
      message: 'Subproiect șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea subproiectului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea subproiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
