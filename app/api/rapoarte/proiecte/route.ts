// ==================================================================
// CALEA: app/api/rapoarte/proiecte/route.ts
// DATA: 16.08.2025 15:00 (ora României)
// FIX PRINCIPAL: DATE fields cu literale în loc de parameters pentru BigQuery
// PĂSTRATE: Toate funcționalitățile existente
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

// Helper function pentru validare și escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper function pentru formatare DATE pentru BigQuery
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '') {
    return 'NULL';
  }
  
  // Verifică că este în format YYYY-MM-DD
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  
  console.warn('Data nu este în format ISO YYYY-MM-DD:', dateString);
  return 'NULL';
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Query cu câmpuri noi pentru multi-valută
    let query = `SELECT 
      ID_Proiect, 
      Denumire, 
      Client, 
      Adresa,
      Descriere,
      Data_Start, 
      Data_Final, 
      Status, 
      Valoare_Estimata,
      moneda,
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      status_predare,
      status_contract,
      status_facturare,
      status_achitare,
      Responsabil,
      Observatii
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
    
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre - PĂSTRATE identic
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

    // Filtrare pe baza valorii RON pentru acuratețe
    const valoareMin = searchParams.get('valoare_min');
    if (valoareMin && !isNaN(Number(valoareMin))) {
      conditions.push('CAST(COALESCE(valoare_ron, Valoare_Estimata, 0) AS FLOAT64) >= @valoareMin');
      params.valoareMin = Number(valoareMin);
      types.valoareMin = 'NUMERIC';
    }

    const valoareMax = searchParams.get('valoare_max');
    if (valoareMax && !isNaN(Number(valoareMax))) {
      conditions.push('CAST(COALESCE(valoare_ron, Valoare_Estimata, 0) AS FLOAT64) <= @valoareMax');
      params.valoareMax = Number(valoareMax);
      types.valoareMax = 'NUMERIC';
    }

    // Filtrare pe baza monedei
    const moneda = searchParams.get('moneda');
    if (moneda) {
      conditions.push('COALESCE(moneda, "RON") = @moneda');
      params.moneda = moneda;
      types.moneda = 'STRING';
    }

    // Filtrare pe baza status-urilor multiple
    const statusPredare = searchParams.get('status_predare');
    if (statusPredare) {
      conditions.push('COALESCE(status_predare, "Nepredat") = @statusPredare');
      params.statusPredare = statusPredare;
      types.statusPredare = 'STRING';
    }

    const statusContract = searchParams.get('status_contract');
    if (statusContract) {
      conditions.push('COALESCE(status_contract, "Nu e cazul") = @statusContract');
      params.statusContract = statusContract;
      types.statusContract = 'STRING';
    }

    const statusFacturare = searchParams.get('status_facturare');
    if (statusFacturare) {
      conditions.push('COALESCE(status_facturare, "Nefacturat") = @statusFacturare');
      params.statusFacturare = statusFacturare;
      types.statusFacturare = 'STRING';
    }

    const statusAchitare = searchParams.get('status_achitare');
    if (statusAchitare) {
      conditions.push('COALESCE(status_achitare, "Neachitat") = @statusAchitare');
      params.statusAchitare = statusAchitare;
      types.statusAchitare = 'STRING';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare
    query += ' ORDER BY Data_Start DESC';

    console.log('Executing GET query:', query);
    console.log('With params:', params);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
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
    console.log('POST request body primit:', body);
    
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
      // Câmpuri multi-valută
      moneda = 'RON',
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      // Status-uri multiple
      status_predare = 'Nepredat',
      status_contract = 'Nu e cazul',
      status_facturare = 'Nefacturat',
      status_achitare = 'Neachitat',
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

    // FIX PRINCIPAL: Construire query cu DATE literale în loc de parameters
    console.log('=== DEBUG BACKEND: Date primite ===');
    console.log('Data_Start primit:', Data_Start);
    console.log('Data_Final primit:', Data_Final);
    console.log('data_curs_valutar primit:', data_curs_valutar);

    // Formatare DATE literale pentru BigQuery
    const dataStartFormatted = formatDateLiteral(Data_Start);
    const dataFinalFormatted = formatDateLiteral(Data_Final);
    const dataCursFormatted = formatDateLiteral(data_curs_valutar);

    console.log('=== DEBUG BACKEND: Date formatate pentru BigQuery ===');
    console.log('Data_Start formatată:', dataStartFormatted);
    console.log('Data_Final formatată:', dataFinalFormatted);
    console.log('data_curs_valutar formatată:', dataCursFormatted);

    // FIX PRINCIPAL: Query cu DATE literale pentru a evita probleme cu parameters
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Proiect, Denumire, Client, Adresa, Descriere, Data_Start, Data_Final, 
       Status, Valoare_Estimata, moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare,
       Responsabil, Observatii)
      VALUES (
        '${escapeString(ID_Proiect)}',
        '${escapeString(Denumire)}',
        '${escapeString(Client)}',
        ${Adresa ? `'${escapeString(Adresa)}'` : 'NULL'},
        ${Descriere ? `'${escapeString(Descriere)}'` : 'NULL'},
        ${dataStartFormatted},
        ${dataFinalFormatted},
        '${escapeString(Status)}',
        ${Valoare_Estimata || 'NULL'},
        '${escapeString(moneda)}',
        ${curs_valutar || 'NULL'},
        ${dataCursFormatted},
        ${valoare_ron || 'NULL'},
        '${escapeString(status_predare)}',
        '${escapeString(status_contract)}',
        '${escapeString(status_facturare)}',
        '${escapeString(status_achitare)}',
        ${Responsabil ? `'${escapeString(Responsabil)}'` : 'NULL'},
        ${Observatii ? `'${escapeString(Observatii)}'` : 'NULL'}
      )
    `;

    console.log('=== DEBUG BACKEND: Query INSERT final ===');
    console.log(insertQuery);

    // Executare query fără parameters pentru DATE fields
    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log('=== DEBUG BACKEND: Insert executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect adăugat cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la adăugarea proiectului ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
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

    console.log('=== DEBUG PUT: Date primite pentru actualizare ===');
    console.log('ID:', id);
    console.log('Update data:', updateData);

    // Construire query UPDATE dinamic cu DATE literale
    const updateFields: string[] = [];

    if (status) {
      updateFields.push(`Status = '${escapeString(status)}'`);
    }

    // Procesare câmpuri de actualizat cu tratament special pentru DATE
    const allowedFields = [
      'Denumire', 'Client', 'Adresa', 'Descriere', 'Data_Start', 'Data_Final', 
      'Valoare_Estimata', 'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'status_predare', 'status_contract', 'status_facturare', 'status_achitare',
      'Responsabil', 'Observatii'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        // FIX: Tratament special pentru câmpurile DATE
        if (['Data_Start', 'Data_Final', 'data_curs_valutar'].includes(key)) {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
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

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    console.log('=== DEBUG PUT: Query UPDATE cu DATE literale ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT: Update executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect actualizat cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la actualizarea proiectului ===');
    console.error('Error details:', error);
    
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
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    console.log('=== DEBUG DELETE: Query ștergere ===');
    console.log(deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log('=== DEBUG DELETE: Ștergere executată cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect șters cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la ștergerea proiectului ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
