// app/api/rapoarte/subproiecte/route.ts
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

// GET - Obține toate subproiectele
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const proiectId = searchParams.get('proiect_id');

    let query = `
      SELECT 
        s.ID_Subproiect,
        s.ID_Proiect,
        s.Denumire,
        s.Responsabil,
        s.Status,
        COALESCE(s.Valoare_Estimata, 0) as Valoare_Estimata,
        s.Data_Start,
        s.Data_Final,
        s.Observatii,
        p.Client,
        p.Adresa
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\` s
      JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\` p
      ON s.ID_Proiect = p.ID_Proiect
    `;

    const params: any[] = [];
    const types: string[] = [];
    const conditions: string[] = [];

    if (proiectId) {
      conditions.push('s.ID_Proiect = @proiect_id');
      params.push(proiectId);
      types.push('STRING');
    }

    if (search) {
      conditions.push(`(
        LOWER(s.Denumire) LIKE LOWER(@search) OR 
        LOWER(COALESCE(s.Responsabil, '')) LIKE LOWER(@search) OR
        LOWER(p.Client) LIKE LOWER(@search)
      )`);
      params.push(`%${search}%`);
      types.push('STRING');
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY s.Data_Start DESC`;

    const options = {
      query,
      params,
      types
    };

    console.log('Query subproiecte:', options);

    const [rows] = await bigquery.query(options);
    
    return NextResponse.json({
      success: true,
      subproiecte: rows
    });

  } catch (error) {
    console.error('Eroare la obținerea subproiectelor:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la obținerea subproiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Adaugă subproiect nou
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Date primite pentru subproiect nou:', body);

    // Validări
    if (!body.denumire || !body.client || !body.data_start || !body.data_final) {
      return NextResponse.json({
        success: false,
        error: 'Câmpurile denumire, client, data_start și data_final sunt obligatorii'
      }, { status: 400 });
    }

    if (!body.id_proiect_parinte) {
      return NextResponse.json({
        success: false,
        error: 'ID-ul proiectului părinte este obligatoriu pentru subproiecte'
      }, { status: 400 });
    }

    // Verificăm dacă proiectul părinte există
    const checkParentQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @parent_id
    `;

    const checkOptions = {
      query: checkParentQuery,
      params: { parent_id: body.id_proiect_parinte },
      types: { parent_id: 'STRING' }
    };

    const [checkRows] = await bigquery.query(checkOptions);
    
    if (checkRows[0].count === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proiectul părinte nu a fost găsit'
      }, { status: 404 });
    }

    // Generare ID unic pentru subproiect
    const timestamp = Date.now();
    const clientPrefix = body.client.substring(0, 8).replace(/[^a-zA-Z0-9]/g, '');
    const randomNum = Math.floor(Math.random() * 1000);
    const subproiectId = `SUB_${clientPrefix}_${timestamp}_${randomNum}`;

    // Pregătire date cu handling explicit pentru null values
    const rowData = {
      ID_Subproiect: subproiectId,
      ID_Proiect: body.id_proiect_parinte,
      Denumire: body.denumire,
      Responsabil: body.responsabil || null,
      Status: body.status || 'Planificat',
      Valoare_Estimata: body.valoare_estimata || 0,
      Data_Start: body.data_start,
      Data_Final: body.data_final,
      Observatii: body.observatii || null
    };

    console.log('Date pregătite pentru subproiect în BigQuery:', rowData);

    // INSERT cu types specificate pentru null values
    const query = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Status, Valoare_Estimata, Data_Start, Data_Final, Observatii)
      VALUES (@ID_Subproiect, @ID_Proiect, @Denumire, @Responsabil, @Status, @Valoare_Estimata, @Data_Start, @Data_Final, @Observatii)
    `;

    const options = {
      query,
      params: rowData,
      types: {
        ID_Subproiect: 'STRING',
        ID_Proiect: 'STRING',
        Denumire: 'STRING',
        Responsabil: 'STRING', // Specificăm tipul chiar și pentru null
        Status: 'STRING',
        Valoare_Estimata: 'FLOAT64',
        Data_Start: 'DATE',
        Data_Final: 'DATE',
        Observatii: 'STRING'
      }
    };

    console.log('Opțiuni query BigQuery pentru subproiect:', options);

    const [job] = await bigquery.createQueryJob(options);
    await job.getQueryResults();

    console.log('Subproiect adăugat cu succes în BigQuery');

    return NextResponse.json({
      success: true,
      message: 'Subproiectul a fost adăugat cu succes',
      subproiectId: subproiectId
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

// PUT - Actualizează subproiect
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Date primite pentru actualizare subproiect:', body);

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'ID-ul subproiectului este obligatoriu pentru actualizare'
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

    if (body.responsabil !== undefined) {
      updateFields.push('Responsabil = @responsabil');
      params.responsabil = body.responsabil || null;
      types.responsabil = 'STRING';
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
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      SET ${updateFields.join(', ')}
      WHERE ID_Subproiect = @id
    `;

    const options = {
      query,
      params,
      types
    };

    console.log('Query UPDATE subproiect:', options);

    const [job] = await bigquery.createQueryJob(options);
    await job.getQueryResults();

    return NextResponse.json({
      success: true,
      message: 'Subproiectul a fost actualizat cu succes'
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

// DELETE - Șterge subproiect
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Ștergere subproiect:', body);

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'ID-ul subproiectului este obligatoriu pentru ștergere'
      }, { status: 400 });
    }

    // Verificăm întâi dacă subproiectul există
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      WHERE ID_Subproiect = @id
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
        error: 'Subproiectul nu a fost găsit'
      }, { status: 404 });
    }

    // Ștergem subproiectul
    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Subproiecte\`
      WHERE ID_Subproiect = @id
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
      message: 'Subproiectul a fost șters cu succes'
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
