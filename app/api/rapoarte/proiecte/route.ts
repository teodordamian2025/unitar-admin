// ==================================================================
// CALEA: app/api/rapoarte/proiecte/route.ts
// MODIFICAT: Fix BigQuery types pentru null values + Adresa support
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
const table = 'Proiecte';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Construire query cu filtre
    let query = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(ID_Proiect) LIKE LOWER(@search) OR 
        LOWER(Denumire) LIKE LOWER(@search) OR 
        LOWER(Client) LIKE LOWER(@search) OR
        LOWER(COALESCE(Adresa, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    const status = searchParams.get('status');
    if (status) {
      conditions.push('Status = @status');
      params.status = status;
      types.status = 'STRING';
    }

    const client = searchParams.get('client');
    if (client) {
      conditions.push('Client = @client');
      params.client = client;
      types.client = 'STRING';
    }

    const dataStartFrom = searchParams.get('data_start_start');
    const dataStartTo = searchParams.get('data_start_end');
    if (dataStartFrom) {
      conditions.push('Data_Start >= @dataStartFrom');
      params.dataStartFrom = dataStartFrom;
      types.dataStartFrom = 'DATE';
    }
    if (dataStartTo) {
      conditions.push('Data_Start <= @dataStartTo');
      params.dataStartTo = dataStartTo;
      types.dataStartTo = 'DATE';
    }

    const valoareMin = searchParams.get('valoare_min');
    if (valoareMin && !isNaN(Number(valoareMin))) {
      conditions.push('CAST(COALESCE(Valoare_Estimata, 0) AS FLOAT64) >= @valoareMin');
      params.valoareMin = Number(valoareMin);
              types.valoareMin = 'NUMERIC';
    }

    const valoareMax = searchParams.get('valoare_max');
    if (valoareMax && !isNaN(Number(valoareMax))) {
      conditions.push('CAST(COALESCE(Valoare_Estimata, 0) AS FLOAT64) <= @valoareMax');
      params.valoareMax = Number(valoareMax);
              types.valoareMax = 'NUMERIC';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare
    query += ' ORDER BY Data_Start DESC';

    console.log('Executing query:', query);
    console.log('With params:', params);
    console.log('With types:', types);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types, // ✅ FIX: Adăugat types
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea proiectelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea proiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST request body:', body); // Debug
    
    const { 
      ID_Proiect, 
      Denumire, 
      Client, 
      Adresa,
      Descriere,
      Data_Start, 
      Data_Final, 
      Status = 'Activ', 
      Valoare_Estimata,
      Responsabil,
      Observatii
    } = body;

    // Validări
    if (!ID_Proiect || !Denumire || !Client) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile ID_Proiect, Denumire și Client sunt obligatorii' 
      }, { status: 400 });
    }

    // ✅ FIX: Query cu types specificate pentru toate câmpurile
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Proiect, Denumire, Client, Adresa, Descriere, Data_Start, Data_Final, 
       Status, Valoare_Estimata, Responsabil, Observatii)
      VALUES (@ID_Proiect, @Denumire, @Client, @Adresa, @Descriere, @Data_Start, 
              @Data_Final, @Status, @Valoare_Estimata, @Responsabil, @Observatii)
    `;

    // ✅ FIX: Pregătire params cu null handling explicit
    const params = {
      ID_Proiect: ID_Proiect,
      Denumire: Denumire,
      Client: Client,
      Adresa: Adresa || null,
      Descriere: Descriere || null,
      Data_Start: Data_Start || null,
      Data_Final: Data_Final || null,
      Status: Status,
      Valoare_Estimata: Valoare_Estimata || null,
      Responsabil: Responsabil || null,
      Observatii: Observatii || null
    };

    // ✅ FIX: Types specificate pentru toate parametrii
    const types = {
      ID_Proiect: 'STRING',
      Denumire: 'STRING',
      Client: 'STRING',
      Adresa: 'STRING',
      Descriere: 'STRING',
      Data_Start: 'DATE',
      Data_Final: 'DATE',
      Status: 'STRING',
      Valoare_Estimata: 'NUMERIC',
      Responsabil: 'STRING',
      Observatii: 'STRING'
    };

    console.log('Insert params:', params); // Debug
    console.log('Insert types:', types); // Debug

    await bigquery.query({
      query: insertQuery,
      params: params,
      types: types, // ✅ FIX: Adăugat types
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Proiect adăugat cu succes'
    });

  } catch (error) {
    console.error('Eroare la adăugarea proiectului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID proiect necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id };
    const types: any = { id: 'STRING' }; // ✅ FIX: Adăugat types pentru id

    if (status) {
      updateFields.push('Status = @status');
      params.status = status;
      types.status = 'STRING'; // ✅ FIX: Adăugat type
    }

    // Include Adresa în câmpurile actualizabile
    const allowedFields = ['Denumire', 'Client', 'Adresa', 'Descriere', 'Data_Start', 'Data_Final', 'Valoare_Estimata', 'Responsabil', 'Observatii'];
    
    // ✅ FIX: Mapping pentru types
    const fieldTypes: { [key: string]: string } = {
      'Denumire': 'STRING',
      'Client': 'STRING',
      'Adresa': 'STRING',
      'Descriere': 'STRING',
      'Data_Start': 'DATE',
      'Data_Final': 'DATE',
      'Valoare_Estimata': 'NUMERIC',
      'Responsabil': 'STRING',
      'Observatii': 'STRING'
    };

    // Adaugă alte câmpuri de actualizat
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value || null; // ✅ FIX: Explicit null pentru empty values
        types[key] = fieldTypes[key]; // ✅ FIX: Adăugat type
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = @id
    `;

    console.log('Update query:', updateQuery); // Debug
    console.log('Update params:', params); // Debug
    console.log('Update types:', types); // Debug

    await bigquery.query({
      query: updateQuery,
      params: params,
      types: types, // ✅ FIX: Adăugat types
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Proiect actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea proiectului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea proiectului',
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
        error: 'ID proiect necesar pentru ștergere' 
      }, { status: 400 });
    }

    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE ID_Proiect = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { id },
      types: { id: 'STRING' }, // ✅ FIX: Adăugat types
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Proiect șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea proiectului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
