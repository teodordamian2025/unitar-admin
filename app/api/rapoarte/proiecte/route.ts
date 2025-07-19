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
    const conditions: string[] = []; // Tipizare explicită
    const params: any = {};

    // Filtre
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(ID_Proiect) LIKE LOWER(@search) OR 
        LOWER(Denumire) LIKE LOWER(@search) OR 
        LOWER(Client) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
    }

    const status = searchParams.get('status');
    if (status) {
      conditions.push('Status = @status');
      params.status = status;
    }

    const client = searchParams.get('client');
    if (client) {
      conditions.push('Client = @client');
      params.client = client;
    }

    const dataStartFrom = searchParams.get('data_start_start');
    const dataStartTo = searchParams.get('data_start_end');
    if (dataStartFrom) {
      conditions.push('Data_Start >= @dataStartFrom');
      params.dataStartFrom = dataStartFrom;
    }
    if (dataStartTo) {
      conditions.push('Data_Start <= @dataStartTo');
      params.dataStartTo = dataStartTo;
    }

    const valoareMin = searchParams.get('valoare_min');
    if (valoareMin && !isNaN(Number(valoareMin))) {
      conditions.push('CAST(Valoare_Estimata AS FLOAT64) >= @valoareMin');
      params.valoareMin = Number(valoareMin);
    }

    const valoareMax = searchParams.get('valoare_max');
    if (valoareMax && !isNaN(Number(valoareMax))) {
      conditions.push('CAST(Valoare_Estimata AS FLOAT64) <= @valoareMax');
      params.valoareMax = Number(valoareMax);
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare
    query += ' ORDER BY Data_Start DESC';

    console.log('Executing query:', query);
    console.log('With params:', params);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
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
      error: 'Eroare la încărcarea proiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      ID_Proiect, 
      Denumire, 
      Client, 
      Data_Start, 
      Data_Final, 
      Status = 'Activ', 
      Valoare_Estimata 
    } = body;

    // Validări
    if (!ID_Proiect || !Denumire || !Client) {
      return NextResponse.json({ 
        error: 'Câmpurile ID_Proiect, Denumire și Client sunt obligatorii' 
      }, { status: 400 });
    }

    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Proiect, Denumire, Client, Data_Start, Data_Final, Status, Valoare_Estimata)
      VALUES (@ID_Proiect, @Denumire, @Client, @Data_Start, @Data_Final, @Status, @Valoare_Estimata)
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        ID_Proiect,
        Denumire,
        Client,
        Data_Start: Data_Start || null,
        Data_Final: Data_Final || null,
        Status,
        Valoare_Estimata: Valoare_Estimata || null
      },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Proiect adăugat cu succes'
    });

  } catch (error) {
    console.error('Eroare la adăugarea proiectului:', error);
    return NextResponse.json({ 
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
        error: 'ID proiect necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = []; // Tipizare explicită
    const params: any = { id };

    if (status) {
      updateFields.push('Status = @status');
      params.status = status;
    }

    // Adaugă alte câmpuri de actualizat
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = @id
    `;

    await bigquery.query({
      query: updateQuery,
      params: params,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Proiect actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea proiectului:', error);
    return NextResponse.json({ 
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
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Proiect șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea proiectului:', error);
    return NextResponse.json({ 
      error: 'Eroare la ștergerea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

