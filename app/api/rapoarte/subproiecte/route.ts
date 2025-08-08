// ==================================================================
// CALEA: app/api/rapoarte/subproiecte/route.ts  
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
const table = 'Subproiecte';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ✅ Query extins cu câmpurile noi
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

    console.log(`Found ${rows.length} subproiecte`);

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
      Valoare_Estimata,
      // ✅ NOUĂ: Câmpuri multi-valută și status-uri
      moneda = 'RON',
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      status_predare = 'Nepredat',
      status_contract = 'Nu e cazul',
      status_facturare = 'Nefacturat',
      status_achitare = 'Neachitat'
    } = body;

    // Validări
    if (!ID_Subproiect || !ID_Proiect || !Denumire) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile ID_Subproiect, ID_Proiect și Denumire sunt obligatorii' 
      }, { status: 400 });
    }

    // ✅ Query complet cu toate câmpurile noi
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (ID_Subproiect, ID_Proiect, Denumire, Responsabil, Data_Start, Data_Final, 
       Status, Valoare_Estimata, activ, data_creare,
       moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare)
      VALUES (@ID_Subproiect, @ID_Proiect, @Denumire, @Responsabil, @Data_Start, 
              @Data_Final, @Status, @Valoare_Estimata, @activ, @data_creare,
              @moneda, @curs_valutar, @data_curs_valutar, @valoare_ron,
              @status_predare, @status_contract, @status_facturare, @status_achitare)
    `;

    // ✅ Params cu toate câmpurile
    const params = {
      ID_Subproiect: ID_Subproiect,
      ID_Proiect: ID_Proiect,
      Denumire: Denumire,
      Responsabil: Responsabil || null,
      Data_Start: Data_Start || null,
      Data_Final: Data_Final || null,
      Status: Status,
      Valoare_Estimata: Valoare_Estimata || null,
      activ: true,
      data_creare: new Date().toISOString(),
      // Câmpuri multi-valută
      moneda: moneda,
      curs_valutar: curs_valutar || null,
      data_curs_valutar: data_curs_valutar || null,
      valoare_ron: valoare_ron || null,
      // Status-uri multiple
      status_predare: status_predare,
      status_contract: status_contract,
      status_facturare: status_facturare,
      status_achitare: status_achitare
    };

    // ✅ Types pentru toate câmpurile
    const types = {
      ID_Subproiect: 'STRING',
      ID_Proiect: 'STRING',
      Denumire: 'STRING',
      Responsabil: 'STRING',
      Data_Start: 'DATE',
      Data_Final: 'DATE',
      Status: 'STRING',
      Valoare_Estimata: 'NUMERIC',
      activ: 'BOOL',
      data_creare: 'TIMESTAMP',
      moneda: 'STRING',
      curs_valutar: 'NUMERIC',
      data_curs_valutar: 'DATE',
      valoare_ron: 'NUMERIC',
      status_predare: 'STRING',
      status_contract: 'STRING',
      status_facturare: 'STRING',
      status_achitare: 'STRING'
    };

    console.log('Insert subproiect params:', params);

    await bigquery.query({
      query: insertQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`✅ Subproiect ${ID_Subproiect} adăugat cu succes pentru proiectul ${ID_Proiect}`);

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

    // ✅ ACTUALIZAT: Mapping extins pentru toate câmpurile
    const fieldTypes: { [key: string]: string } = {
      'Denumire': 'STRING',
      'Responsabil': 'STRING',
      'Data_Start': 'DATE',
      'Data_Final': 'DATE',
      'Status': 'STRING',
      'Valoare_Estimata': 'NUMERIC',
      'moneda': 'STRING',
      'curs_valutar': 'NUMERIC',
      'data_curs_valutar': 'DATE',
      'valoare_ron': 'NUMERIC',
      'status_predare': 'STRING',
      'status_contract': 'STRING',
      'status_facturare': 'STRING',
      'status_achitare': 'STRING'
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

    // Adăugat data_actualizare la UPDATE
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

    // Soft delete cu câmpul activ
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

    console.log(`✅ Subproiect ${id} șters (soft delete)`);

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
