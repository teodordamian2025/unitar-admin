// ==================================================================
// CALEA: app/api/rapoarte/proiecte/route.ts
// MODIFICAT: Suport complet pentru multi-valută și status-uri multiple
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
    
    // ✅ ACTUALIZAT: Query cu câmpuri noi pentru multi-valută
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

    // ✅ ACTUALIZAT: Filtrare pe baza valorii RON pentru acuratețe
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

    // ✅ NOUĂ: Filtrare pe baza monedei
    const moneda = searchParams.get('moneda');
    if (moneda) {
      conditions.push('COALESCE(moneda, "RON") = @moneda');
      params.moneda = moneda;
      types.moneda = 'STRING';
    }

    // ✅ NOUĂ: Filtrare pe baza status-urilor multiple
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

    console.log('Executing query:', query);
    console.log('With params:', params);
    console.log('With types:', types);

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
    console.log('POST request body:', body);
    
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
      // ✅ NOUĂ: Câmpuri multi-valută
      moneda = 'RON',
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      // ✅ NOUĂ: Status-uri multiple
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

    // ✅ ACTUALIZAT: Query cu toate câmpurile noi
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Proiect, Denumire, Client, Adresa, Descriere, Data_Start, Data_Final, 
       Status, Valoare_Estimata, moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare,
       Responsabil, Observatii)
      VALUES (@ID_Proiect, @Denumire, @Client, @Adresa, @Descriere, @Data_Start, 
              @Data_Final, @Status, @Valoare_Estimata, @moneda, @curs_valutar, 
              @data_curs_valutar, @valoare_ron, @status_predare, @status_contract,
              @status_facturare, @status_achitare, @Responsabil, @Observatii)
    `;

    // ✅ ACTUALIZAT: Params cu toate câmpurile noi
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
      moneda: moneda,
      curs_valutar: curs_valutar || null,
      data_curs_valutar: data_curs_valutar || null,
      valoare_ron: valoare_ron || null,
      status_predare: status_predare,
      status_contract: status_contract,
      status_facturare: status_facturare,
      status_achitare: status_achitare,
      Responsabil: Responsabil || null,
      Observatii: Observatii || null
    };

    // ✅ ACTUALIZAT: Types pentru toate câmpurile noi
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
      moneda: 'STRING',
      curs_valutar: 'NUMERIC',
      data_curs_valutar: 'DATE',
      valoare_ron: 'NUMERIC',
      status_predare: 'STRING',
      status_contract: 'STRING',
      status_facturare: 'STRING',
      status_achitare: 'STRING',
      Responsabil: 'STRING',
      Observatii: 'STRING'
    };

    console.log('Insert params:', params);
    console.log('Insert types:', types);

    await bigquery.query({
      query: insertQuery,
      params: params,
      types: types,
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
    const types: any = { id: 'STRING' };

    if (status) {
      updateFields.push('Status = @status');
      params.status = status;
      types.status = 'STRING';
    }

    // ✅ ACTUALIZAT: Include toate câmpurile noi în actualizare
    const allowedFields = [
      'Denumire', 'Client', 'Adresa', 'Descriere', 'Data_Start', 'Data_Final', 
      'Valoare_Estimata', 'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'status_predare', 'status_contract', 'status_facturare', 'status_achitare',
      'Responsabil', 'Observatii'
    ];
    
    // ✅ ACTUALIZAT: Mapping pentru types cu câmpuri noi
    const fieldTypes: { [key: string]: string } = {
      'Denumire': 'STRING',
      'Client': 'STRING',
      'Adresa': 'STRING',
      'Descriere': 'STRING',
      'Data_Start': 'DATE',
      'Data_Final': 'DATE',
      'Valoare_Estimata': 'NUMERIC',
      'moneda': 'STRING',
      'curs_valutar': 'NUMERIC',
      'data_curs_valutar': 'DATE',
      'valoare_ron': 'NUMERIC',
      'status_predare': 'STRING',
      'status_contract': 'STRING',
      'status_facturare': 'STRING',
      'status_achitare': 'STRING',
      'Responsabil': 'STRING',
      'Observatii': 'STRING'
    };

    // Adaugă alte câmpuri de actualizat
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
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

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = @id
    `;

    console.log('Update query:', updateQuery);
    console.log('Update params:', params);
    console.log('Update types:', types);

    await bigquery.query({
      query: updateQuery,
      params: params,
      types: types,
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
      types: { id: 'STRING' },
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
