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
    
    // Construire query cu filtre
    let query = `
      SELECT 
        s.*,
        p.Client,
        p.Denumire as Proiect_Denumire
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` s
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p 
        ON s.ID_Proiect = p.ID_Proiect
      WHERE s.activ = true
    `;
    
    const conditions: string[] = [];
    const params: any = {};

    // Filtre
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(s.ID_Subproiect) LIKE LOWER(@search) OR 
        LOWER(s.Denumire) LIKE LOWER(@search) OR 
        LOWER(s.Responsabil) LIKE LOWER(@search) OR
        LOWER(p.Client) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
    }

    const status = searchParams.get('status');
    if (status) {
      conditions.push('s.Status = @status');
      params.status = status;
    }

    const proiectId = searchParams.get('proiect_id');
    if (proiectId) {
      conditions.push('s.ID_Proiect = @proiectId');
      params.proiectId = proiectId;
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
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea subproiectelor:', error);
    return NextResponse.json({ 
      error: 'Eroare la încărcarea subproiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
        error: 'Câmpurile ID_Subproiect, ID_Proiect și Denumire sunt obligatorii' 
      }, { status: 400 });
    }

    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, 
       Status, Valoare_Estimata, data_creare, data_actualizare, activ)
      VALUES (@ID_Subproiect, @ID_Proiect, @Denumire, @Responsabil, @Data_Start, 
              @Data_Final, @Status, @Valoare_Estimata, @data_creare, @data_actualizare, @activ)
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        ID_Subproiect,
        ID_Proiect,
        Denumire,
        Responsabil: Responsabil || null,
        Data_Start: Data_Start || null,
        Data_Final: Data_Final || null,
        Status,
        Valoare_Estimata: Valoare_Estimata || null,
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString(),
        activ: true
      },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Subproiect adăugat cu succes'
    });

  } catch (error) {
    console.error('Eroare la adăugarea subproiectului:', error);
    return NextResponse.json({ 
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
        error: 'ID subproiect necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id };

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

    // Adaugă data_actualizare
    updateFields.push('data_actualizare = @data_actualizare');
    params.data_actualizare = new Date().toISOString();

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Subproiect = @id
    `;

    await bigquery.query({
      query: updateQuery,
      params: params,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Subproiect actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea subproiectului:', error);
    return NextResponse.json({ 
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
        error: 'ID subproiect necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete
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
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Subproiect șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea subproiectului:', error);
    return NextResponse.json({ 
      error: 'Eroare la ștergerea subproiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
