// app/api/rapoarte/proiecte/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Configurare BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: undefined,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = bigquery.dataset('PanouControlUnitar');
const proiecteTable = dataset.table('Proiecte');

// GET - Obține toate proiectele
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = `
      SELECT 
        ID_Proiect,
        Denumire,
        Client,
        Status,
        COALESCE(Valoare_Estimata, 0) as Valoare_Estimata,
        Data_Start,
        Data_Final,
        Responsabil,
        Adresa,
        Observatii
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
    `;

    const params: any[] = [];

    if (search) {
      query += ` WHERE (
        LOWER(Denumire) LIKE LOWER(@search) OR 
        LOWER(Client) LIKE LOWER(@search) OR 
        LOWER(COALESCE(Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(Adresa, '')) LIKE LOWER(@search)
      )`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY Data_Start DESC`;

    const options = {
      query,
      params: search ? [search] : [],
      types: search ? ['STRING'] : []
    };

    const [rows] = await bigquery.query(options);
    
    return NextResponse.json({
      success: true,
      proiecte: rows
    });

  } catch (error) {
    console.error('Eroare la obținerea proiectelor:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea proiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Adaugă proiect nou
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Date primite pentru proiect nou:', body);

    // Validări
    if (!body.denumire || !body.client || !body.data_start || !body.data_final) {
      return NextResponse.json({
        success: false,
        error: 'Câmpurile denumire, client, data_start și data_final sunt obligatorii'
      }, { status: 400 });
    }

    // Generare ID unic pentru proiect
    const timestamp = Date.now();
    const clientPrefix = body.client.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
    const randomNum = Math.floor(Math.random() * 1000);
    const proiectId = `${clientPrefix}_${timestamp}_${randomNum}`;

    // Pregătire date cu handling explicit pentru null values
    const rowData = {
      ID_Proiect: proiectId,
      Denumire: body.denumire,
      Client: body.client,
      Status: body.status || 'Planificat',
      Valoare_Estimata: body.valoare_estimata || 0,
      Data_Start: body.data_start,
      Data_Final: body.data_final,
      Responsabil: body.responsabil || null,
      Adresa: body.adresa || null,
      Observatii: body.observatii || null
    };

    console.log('Date pregătite pentru BigQuery:', rowData);

    // INSERT cu types specificate pentru null values
    const query = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      (ID_Proiect, Denumire, Client, Status, Valoare_Estimata, Data_Start, Data_Final, Responsabil, Adresa, Observatii)
      VALUES (@ID_Proiect, @Denumire, @Client, @Status, @Valoare_Estimata, @Data_Start, @Data_Final, @Responsabil, @Adresa, @Observatii)
    `;

    const options = {
      query,
      params: rowData,
      types: {
        ID_Proiect: 'STRING',
        Denumire: 'STRING',
        Client: 'STRING',
        Status: 'STRING',
        Valoare_Estimata: 'FLOAT64',
        Data_Start: 'DATE',
        Data_Final: 'DATE',
        Responsabil: rowData.Responsabil ? 'STRING' : 'STRING', // Specificăm tipul chiar și pentru null
        Adresa: rowData.Adresa ? 'STRING' : 'STRING',
        Observatii: rowData.Observatii ? 'STRING' : 'STRING'
      }
    };

    console.log('Opțiuni query BigQuery:', options);

    const [job] = await bigquery.createQueryJob(options);
    await job.getQueryResults();

    console.log('Proiect adăugat cu succes în BigQuery');

    return NextResponse.json({
      success: true,
      message: 'Proiectul a fost adăugat cu succes',
      proiectId: proiectId
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

// PUT - Actualizează proiect
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Date primite pentru actualizare proiect:', body);

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'ID-ul proiectului este obligatoriu pentru actualizare'
      }, { status: 400 });
    }

    // Construim query-ul de UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id: body.id };
    const types: any = { id: 'STRING' };

    if (body.denumire !== undefined) {
      updateFields.push('Denumire = @denumire');
      params.denumire = body.denumire;
      types.denumire = 'STRING';
    }

    if (body.client !== undefined) {
      updateFields.push('Client = @client');
      params.client = body.client;
      types.client = 'STRING';
    }

    if (body.status !== undefined) {
      updateFields.push('Status = @status');
      params.status = body.status;
      types.status = 'STRING';
    }

    if (body.valoare_estimata !== undefined) {
      updateFields.push('Valoare_Estimata = @valoare_estimata');
      params.valoare_estimata = body.valoare_estimata || 0;
      types.valoare_estimata = 'FLOAT64';
    }

    if (body.data_start !== undefined) {
      updateFields.push('Data_Start = @data_start');
      params.data_start = body.data_start;
      types.data_start = 'DATE';
    }

    if (body.data_final !== undefined) {
      updateFields.push('Data_Final = @data_final');
      params.data_final = body.data_final;
      types.data_final = 'DATE';
    }

    if (body.responsabil !== undefined) {
      updateFields.push('Responsabil = @responsabil');
      params.responsabil = body.responsabil || null;
      types.responsabil = 'STRING';
    }

    if (body.adresa !== undefined) {
      updateFields.push('Adresa = @adresa');
      params.adresa = body.adresa || null;
      types.adresa = 'STRING';
    }

    if (body.observatii !== undefined) {
      updateFields.push('Observatii = @observatii');
      params.observatii = body.observatii || null;
      types.observatii = 'STRING';
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nu au fost furnizate câmpuri pentru actualizare'
      }, { status: 400 });
    }

    const query = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = @id
    `;

    const options = {
      query,
      params,
      types
    };

    console.log('Query UPDATE:', options);

    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();

    return NextResponse.json({
      success: true,
      message: 'Proiectul a fost actualizat cu succes'
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

// DELETE - Șterge proiect
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Ștergere proiect:', body);

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'ID-ul proiectului este obligatoriu pentru ștergere'
      }, { status: 400 });
    }

    // Verificăm întâi dacă proiectul există
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @id
    `;

    const checkOptions = {
      query: checkQuery,
      params: { id: body.id },
      types: { id: 'STRING' }
    };

    const [checkRows] = await bigquery.query(checkOptions);
    
    if (checkRows[0].count === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proiectul nu a fost găsit'
      }, { status: 404 });
    }

    // Ștergem proiectul
    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @id
    `;

    const deleteOptions = {
      query: deleteQuery,
      params: { id: body.id },
      types: { id: 'STRING' }
    };

    const [job] = await bigquery.createQueryJob(deleteOptions);
    await job.getQueryResults();

    return NextResponse.json({
      success: true,
      message: 'Proiectul a fost șters cu succes'
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
