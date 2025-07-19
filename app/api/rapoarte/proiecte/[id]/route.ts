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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proiectId = params.id;

    // Query pentru detalii proiect
    const proiectQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\`
      WHERE ID_Proiect = @proiectId
    `;

    // Query pentru subproiecte asociate
    const subproiecteQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Subproiecte\`
      WHERE proiect_id = @proiectId
    `;

    // Query pentru sesiuni de lucru
    const sesiuniQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.SesiuniLucru\`
      WHERE proiect_id = @proiectId
      ORDER BY data_start DESC
      LIMIT 10
    `;

    // Execută toate query-urile în paralel
    const [
      [proiectRows],
      [subproiecteRows],
      [sesiuniRows]
    ] = await Promise.all([
      bigquery.query({
        query: proiectQuery,
        params: { proiectId },
        location: 'EU',
      }),
      bigquery.query({
        query: subproiecteQuery,
        params: { proiectId },
        location: 'EU',
      }),
      bigquery.query({
        query: sesiuniQuery,
        params: { proiectId },
        location: 'EU',
      })
    ]);

    if (proiectRows.length === 0) {
      return NextResponse.json({ 
        error: 'Proiectul nu a fost găsit' 
      }, { status: 404 });
    }

    const proiect = proiectRows[0];

    // Calculează statistici din sesiuni
    const totalOre = sesiuniRows.reduce((sum: number, sesiune: any) => {
      return sum + (Number(sesiune.ore_lucrate) || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      proiect: proiect,
      subproiecte: subproiecteRows,
      sesiuni_recente: sesiuniRows,
      statistici: {
        total_ore_lucrate: totalOre,
        numar_sesiuni: sesiuniRows.length,
        ultima_activitate: sesiuniRows[0]?.data_start || null
      }
    });

  } catch (error) {
    console.error('Eroare la încărcarea detaliilor proiectului:', error);
    return NextResponse.json({ 
      error: 'Eroare la încărcarea detaliilor proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proiectId = params.id;
    const updateData = await request.json();

    // Construire query UPDATE dinamic
    const updateFields: string[] = []; // Tipizare explicită
    const queryParams: any = { proiectId };

    // Lista câmpurilor permise pentru actualizare
    const allowedFields = [
      'Denumire', 'Client', 'Status', 'Data_Start', 
      'Data_Final', 'Valoare_Estimata'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        queryParams[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        error: 'Nu există câmpuri valide pentru actualizare' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = @proiectId
    `;

    await bigquery.query({
      query: updateQuery,
      params: queryParams,
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

