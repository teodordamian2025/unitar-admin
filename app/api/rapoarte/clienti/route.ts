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
const table = 'Clienti';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    let query = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
    const conditions: string[] = []; // Tipizare explicită
    const params: any = {};

    // Filtre
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(nume) LIKE LOWER(@search) OR 
        LOWER(email) LIKE LOWER(@search) OR 
        LOWER(telefon) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
    }

    const tipClient = searchParams.get('tip_client');
    if (tipClient) {
      conditions.push('tip_client = @tipClient');
      params.tipClient = tipClient;
    }

    const activ = searchParams.get('activ');
    if (activ) {
      conditions.push('activ = @activ');
      params.activ = activ === 'true';
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY data_inregistrare DESC';

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
    console.error('Eroare la încărcarea clienților:', error);
    return NextResponse.json({ 
      error: 'Eroare la încărcarea clienților',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nume, 
      email, 
      telefon, 
      adresa, 
      tip_client = 'Firma',
      activ = true 
    } = body;

    // Validări
    if (!nume || !email) {
      return NextResponse.json({ 
        error: 'Câmpurile nume și email sunt obligatorii' 
      }, { status: 400 });
    }

    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (nume, email, telefon, adresa, tip_client, activ, data_inregistrare)
      VALUES (@nume, @email, @telefon, @adresa, @tip_client, @activ, CURRENT_TIMESTAMP())
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        nume,
        email,
        telefon: telefon || null,
        adresa: adresa || null,
        tip_client,
        activ
      },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Client adăugat cu succes'
    });

  } catch (error) {
    console.error('Eroare la adăugarea clientului:', error);
    return NextResponse.json({ 
      error: 'Eroare la adăugarea clientului',
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
        error: 'ID client necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id };

    // Lista câmpurilor permise pentru actualizare
    const allowedFields = ['nume', 'email', 'telefon', 'adresa', 'tip_client', 'activ'];

    Object.entries(updateData).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        error: 'Nu există câmpuri valide pentru actualizare' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE id = @id
    `;

    await bigquery.query({
      query: updateQuery,
      params: params,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Client actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea clientului:', error);
    return NextResponse.json({ 
      error: 'Eroare la actualizarea clientului',
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
        error: 'ID client necesar pentru ștergere' 
      }, { status: 400 });
    }

    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { id },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Client șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea clientului:', error);
    return NextResponse.json({ 
      error: 'Eroare la ștergerea clientului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

