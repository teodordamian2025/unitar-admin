// ==================================================================
// CALEA: app/api/rapoarte/cheltuieli/route.ts
// DESCRIERE: API pentru managementul cheltuielilor proiectelor (subcontractanți, materiale, etc.)
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Construire query cu filtre
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

    // Filtre
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

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Sortare
    query += ' ORDER BY pc.data_creare DESC';

    console.log('Executing cheltuieli query:', query);
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

    // Calculează valoarea în RON dacă nu este deja calculată
    let finalValoareRon = valoare_ron;
    if (moneda !== 'RON' && !valoare_ron && curs_valutar) {
      finalValoareRon = parseFloat(valoare) * parseFloat(curs_valutar);
    } else if (moneda === 'RON') {
      finalValoareRon = parseFloat(valoare);
    }

    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, proiect_id, subproiect_id, tip_cheltuiala, furnizor_nume, furnizor_cui, furnizor_contact,
       descriere, valoare, moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare,
       nr_factura_furnizor, data_factura_furnizor, nr_contract_furnizor, data_contract_furnizor,
       observatii, data_creare, data_actualizare, activ)
      VALUES 
      (@id, @proiect_id, @subproiect_id, @tip_cheltuiala, @furnizor_nume, @furnizor_cui, @furnizor_contact,
       @descriere, @valoare, @moneda, @curs_valutar, @data_curs_valutar, @valoare_ron,
       @status_predare, @status_contract, @status_facturare, @status_achitare,
       @nr_factura_furnizor, @data_factura_furnizor, @nr_contract_furnizor, @data_contract_furnizor,
       @observatii, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), true)
    `;

    const params = {
      id: id,
      proiect_id: proiect_id,
      subproiect_id: subproiect_id || null,
      tip_cheltuiala: tip_cheltuiala,
      furnizor_nume: furnizor_nume,
      furnizor_cui: furnizor_cui || null,
      furnizor_contact: furnizor_contact || null,
      descriere: descriere,
      valoare: parseFloat(valoare),
      moneda: moneda,
      curs_valutar: curs_valutar ? parseFloat(curs_valutar) : null,
      data_curs_valutar: data_curs_valutar || null,
      valoare_ron: finalValoareRon ? parseFloat(finalValoareRon.toString()) : null,
      status_predare: status_predare,
      status_contract: status_contract,
      status_facturare: status_facturare,
      status_achitare: status_achitare,
      nr_factura_furnizor: nr_factura_furnizor || null,
      data_factura_furnizor: data_factura_furnizor || null,
      nr_contract_furnizor: nr_contract_furnizor || null,
      data_contract_furnizor: data_contract_furnizor || null,
      observatii: observatii || null
    };

    const types = {
      id: 'STRING',
      proiect_id: 'STRING',
      subproiect_id: 'STRING',
      tip_cheltuiala: 'STRING',
      furnizor_nume: 'STRING',
      furnizor_cui: 'STRING',
      furnizor_contact: 'STRING',
      descriere: 'STRING',
      valoare: 'NUMERIC',
      moneda: 'STRING',
      curs_valutar: 'NUMERIC',
      data_curs_valutar: 'DATE',
      valoare_ron: 'NUMERIC',
      status_predare: 'STRING',
      status_contract: 'STRING',
      status_facturare: 'STRING',
      status_achitare: 'STRING',
      nr_factura_furnizor: 'STRING',
      data_factura_furnizor: 'DATE',
      nr_contract_furnizor: 'STRING',
      data_contract_furnizor: 'DATE',
      observatii: 'STRING'
    };

    console.log('Insert cheltuiala params:', params);

    await bigquery.query({
      query: insertQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Cheltuială adăugată cu succes'
    });

  } catch (error) {
    console.error('Eroare la adăugarea cheltuielii:', error);
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

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id };
    const types: any = { id: 'STRING' };

    // Câmpuri actualizabile
    const allowedFields = [
      'tip_cheltuiala', 'furnizor_nume', 'furnizor_cui', 'furnizor_contact',
      'descriere', 'valoare', 'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'status_predare', 'status_contract', 'status_facturare', 'status_achitare',
      'nr_factura_furnizor', 'data_factura_furnizor', 'nr_contract_furnizor', 'data_contract_furnizor',
      'observatii'
    ];

    const fieldTypes: { [key: string]: string } = {
      'tip_cheltuiala': 'STRING',
      'furnizor_nume': 'STRING',
      'furnizor_cui': 'STRING',
      'furnizor_contact': 'STRING',
      'descriere': 'STRING',
      'valoare': 'NUMERIC',
      'moneda': 'STRING',
      'curs_valutar': 'NUMERIC',
      'data_curs_valutar': 'DATE',
      'valoare_ron': 'NUMERIC',
      'status_predare': 'STRING',
      'status_contract': 'STRING',
      'status_facturare': 'STRING',
      'status_achitare': 'STRING',
      'nr_factura_furnizor': 'STRING',
      'data_factura_furnizor': 'DATE',
      'nr_contract_furnizor': 'STRING',
      'data_contract_furnizor': 'DATE',
      'observatii': 'STRING'
    };

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        updateFields.push(`${key} = @${key}`);
        
        if (fieldTypes[key] === 'NUMERIC' && value !== null) {
          params[key] = parseFloat(value as string);
        } else {
          params[key] = value || null;
        }
        
        types[key] = fieldTypes[key];
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
      WHERE id = @id
    `;

    console.log('Update cheltuiala query:', updateQuery);
    console.log('Update cheltuiala params:', params);

    await bigquery.query({
      query: updateQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Cheltuială actualizată cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea cheltuielii:', error);
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
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { id },
      types: { id: 'STRING' },
      location: 'EU',
    });

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
