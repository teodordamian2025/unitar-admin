// ==================================================================
// CALEA: app/api/rapoarte/cheltuieli/route.ts
// DATA: 24.08.2025 22:18 (ora României)
// FIX: data_curs_valutar cu literale SQL ca la Proiecte
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
const table = 'ProiecteCheltuieli';

// ADĂUGAT: Helper functions ca la Proiecte
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '') {
    return 'NULL';
  }
  
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
    
    // Construire query cu filtre - PĂSTRAT identic
    let query = `
      SELECT 
        pc.*,
        p.Denumire as proiect_denumire,
        p.Client as proiect_client,
        sp.Denumire as subproiect_denumire
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` pc
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte\` p
        ON pc.proiect_id = p.ID_Proiect
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Subproiecte\` sp
        ON pc.subproiect_id = sp.ID_Subproiect
      WHERE pc.activ = true
    `;
    
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre existente - PĂSTRATE
    const proiectId = searchParams.get('proiectId');
    if (proiectId) {
      conditions.push('pc.proiect_id = @proiectId');
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    const subproiectId = searchParams.get('subproiectId');
    if (subproiectId) {
      conditions.push('pc.subproiect_id = @subproiectId');
      params.subproiectId = subproiectId;
      types.subproiectId = 'STRING';
    }

    const tipCheltuiala = searchParams.get('tip');
    if (tipCheltuiala) {
      conditions.push('pc.tip_cheltuiala = @tipCheltuiala');
      params.tipCheltuiala = tipCheltuiala;
      types.tipCheltuiala = 'STRING';
    }

    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(pc.furnizor_nume) LIKE LOWER(@search) OR 
        LOWER(pc.descriere) LIKE LOWER(@search) OR
        LOWER(pc.furnizor_cui) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    const statusPredare = searchParams.get('status_predare');
    if (statusPredare) {
      conditions.push('pc.status_predare = @statusPredare');
      params.statusPredare = statusPredare;
      types.statusPredare = 'STRING';
    }

    const statusFacturare = searchParams.get('status_facturare');
    if (statusFacturare) {
      conditions.push('pc.status_facturare = @statusFacturare');
      params.statusFacturare = statusFacturare;
      types.statusFacturare = 'STRING';
    }

    const statusAchitare = searchParams.get('status_achitare');
    if (statusAchitare) {
      conditions.push('pc.status_achitare = @statusAchitare');
      params.statusAchitare = statusAchitare;
      types.statusAchitare = 'STRING';
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY pc.data_creare DESC';

    console.log('Executing cheltuieli query:', query);

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
    console.error('Eroare la încărcarea cheltuielilor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea cheltuielilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST cheltuiala request body:', body);
    
    const { 
      id,
      proiect_id, 
      subproiect_id,
      tip_cheltuiala,
      furnizor_nume,
      furnizor_cui,
      furnizor_contact,
      descriere,
      valoare,
      moneda = 'RON',
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      status_predare = 'Nepredat',
      status_contract = 'Nu e cazul',
      status_facturare = 'Nefacturat',
      status_achitare = 'Neachitat',
      nr_factura_furnizor,
      data_factura_furnizor,
      nr_contract_furnizor,
      data_contract_furnizor,
      observatii
    } = body;

    // Validări
    if (!id || !proiect_id || !tip_cheltuiala || !furnizor_nume || !descriere || !valoare) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile id, proiect_id, tip_cheltuiala, furnizor_nume, descriere și valoare sunt obligatorii' 
      }, { status: 400 });
    }

    // FIX PRINCIPAL: Debug date primite
    console.log('=== DEBUG CHELTUIELI: Date primite ===');
    console.log('data_curs_valutar primit:', data_curs_valutar);
    console.log('data_factura_furnizor primit:', data_factura_furnizor);
    console.log('data_contract_furnizor primit:', data_contract_furnizor);

    // Calculează valoarea în RON dacă nu este deja calculată
    let finalValoareRon = valoare_ron;
    if (moneda !== 'RON' && !valoare_ron && curs_valutar) {
      finalValoareRon = parseFloat(valoare) * parseFloat(curs_valutar);
    } else if (moneda === 'RON') {
      finalValoareRon = parseFloat(valoare);
    }

    // FIX PRINCIPAL: Formatare DATE literale ca la Proiecte
    const dataCursFormatted = formatDateLiteral(data_curs_valutar);
    const dataFacturaFormatted = formatDateLiteral(data_factura_furnizor);
    const dataContractFormatted = formatDateLiteral(data_contract_furnizor);

    console.log('=== DEBUG CHELTUIELI: Date formatate pentru BigQuery ===');
    console.log('data_curs_valutar formatată:', dataCursFormatted);
    console.log('data_factura_furnizor formatată:', dataFacturaFormatted);
    console.log('data_contract_furnizor formatată:', dataContractFormatted);

    // FIX PRINCIPAL: Query cu DATE literale în loc de parameters
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, proiect_id, subproiect_id, tip_cheltuiala, furnizor_nume, furnizor_cui, furnizor_contact,
       descriere, valoare, moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare,
       nr_factura_furnizor, data_factura_furnizor, nr_contract_furnizor, data_contract_furnizor,
       observatii, data_creare, data_actualizare, activ)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(proiect_id)}',
        ${subproiect_id ? `'${escapeString(subproiect_id)}'` : 'NULL'},
        '${escapeString(tip_cheltuiala)}',
        '${escapeString(furnizor_nume)}',
        ${furnizor_cui ? `'${escapeString(furnizor_cui)}'` : 'NULL'},
        ${furnizor_contact ? `'${escapeString(furnizor_contact)}'` : 'NULL'},
        '${escapeString(descriere)}',
        ${parseFloat(valoare)},
        '${escapeString(moneda)}',
        ${curs_valutar ? parseFloat(curs_valutar) : 'NULL'},
        ${dataCursFormatted},
        ${finalValoareRon ? parseFloat(finalValoareRon.toString()) : 'NULL'},
        '${escapeString(status_predare)}',
        '${escapeString(status_contract)}',
        '${escapeString(status_facturare)}',
        '${escapeString(status_achitare)}',
        ${nr_factura_furnizor ? `'${escapeString(nr_factura_furnizor)}'` : 'NULL'},
        ${dataFacturaFormatted},
        ${nr_contract_furnizor ? `'${escapeString(nr_contract_furnizor)}'` : 'NULL'},
        ${dataContractFormatted},
        ${observatii ? `'${escapeString(observatii)}'` : 'NULL'},
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        true
      )
    `;

    console.log('=== DEBUG CHELTUIELI: Query INSERT final ===');
    console.log(insertQuery);

    // Executare query fără parameters pentru DATE fields
    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`✅ Cheltuiala ${id} adăugată cu succes pentru proiectul ${proiect_id} cu data_curs_valutar: ${dataCursFormatted}`);

    return NextResponse.json({
      success: true,
      message: 'Cheltuială adăugată cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la adăugarea cheltuielii ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea cheltuielii',
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
        error: 'ID cheltuială necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log('=== DEBUG PUT CHELTUIELI: Date primite pentru actualizare ===');
    console.log('ID:', id);
    console.log('Update data:', updateData);

    // FIX: Construire query UPDATE cu DATE literale
    const updateFields: string[] = [];

    const allowedFields = [
      'tip_cheltuiala', 'furnizor_nume', 'furnizor_cui', 'furnizor_contact',
      'descriere', 'valoare', 'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'status_predare', 'status_contract', 'status_facturare', 'status_achitare',
      'nr_factura_furnizor', 'data_factura_furnizor', 'nr_contract_furnizor', 'data_contract_furnizor',
      'observatii'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        // FIX: Tratament special pentru câmpurile DATE
        if (['data_curs_valutar', 'data_factura_furnizor', 'data_contract_furnizor'].includes(key)) {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else if (typeof value === 'string') {
          updateFields.push(`${key} = '${escapeString(value)}'`);
        } else if (typeof value === 'number') {
          updateFields.push(`${key} = ${value}`);
        } else if (key === 'valoare' || key === 'curs_valutar' || key === 'valoare_ron') {
          updateFields.push(`${key} = ${parseFloat(value as string)}`);
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

    // Adaugă data_actualizare
    updateFields.push('data_actualizare = CURRENT_TIMESTAMP()');

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE id = '${escapeString(id)}'
    `;

    console.log('=== DEBUG PUT CHELTUIELI: Query UPDATE cu DATE literale ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT CHELTUIELI: Update executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Cheltuială actualizată cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la actualizarea cheltuielii ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea cheltuielii',
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
        error: 'ID cheltuială necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete - marchează ca inactiv
    const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`✅ Cheltuială ${id} ștearsă (soft delete)`);

    return NextResponse.json({
      success: true,
      message: 'Cheltuială ștearsă cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea cheltuielii:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea cheltuielii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
