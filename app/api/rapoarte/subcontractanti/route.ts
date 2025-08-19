// ==================================================================
// CALEA: app/api/rapoarte/subcontractanti/route.ts
// DATA: 19.08.2025 21:30 (ora României)
// DESCRIERE: API CRUD pentru subcontractanți - structură identică cu Clienti
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
const table = 'Subcontractanti';

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper function pentru formatare DATE pentru BigQuery
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
    
    // Query pentru subcontractanți activi
    let query = `SELECT 
      id,
      nume, 
      tip_client,
      cui,
      nr_reg_com,
      adresa,
      judet,
      oras,
      cod_postal,
      tara,
      telefon,
      email,
      banca,
      iban,
      cnp,
      ci_serie,
      ci_numar,
      ci_eliberata_de,
      ci_eliberata_la,
      data_creare,
      data_actualizare,
      activ,
      observatii,
      id_factureaza,
      data_ultima_sincronizare
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
    WHERE (activ IS NULL OR activ = true)`;
    
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre pentru căutare
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(nume) LIKE LOWER(@search) OR 
        LOWER(COALESCE(cui, '')) LIKE LOWER(@search) OR 
        LOWER(COALESCE(cnp, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(email, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(telefon, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    const tipClient = searchParams.get('tip_client');
    if (tipClient) {
      conditions.push('tip_client = @tipClient');
      params.tipClient = tipClient;
      types.tipClient = 'STRING';
    }

    const cui = searchParams.get('cui');
    if (cui) {
      conditions.push('cui = @cui');
      params.cui = cui;
      types.cui = 'STRING';
    }

    const judet = searchParams.get('judet');
    if (judet) {
      conditions.push('judet = @judet');
      params.judet = judet;
      types.judet = 'STRING';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Sortare alfabetică
    query += ' ORDER BY nume ASC';

    // Limită rezultate pentru performanță
    const limit = searchParams.get('limit');
    if (limit && !isNaN(Number(limit))) {
      query += ` LIMIT ${Number(limit)}`;
    } else {
      query += ' LIMIT 100'; // Limită default
    }

    console.log('Executing subcontractanti query:', query);
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
    console.error('Eroare la încărcarea subcontractanților:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea subcontractanților',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST subcontractant request body:', body);
    
    const { 
      id,
      nume, 
      tip_client = 'Juridic',
      cui,
      nr_reg_com,
      adresa,
      judet,
      oras,
      cod_postal,
      tara = 'Romania',
      telefon,
      email,
      banca,
      iban,
      cnp,
      ci_serie,
      ci_numar,
      ci_eliberata_de,
      ci_eliberata_la,
      activ = true,
      observatii,
      id_factureaza,
      data_ultima_sincronizare
    } = body;

    // Validări
    if (!id || !nume) {
      return NextResponse.json({ 
        success: false,
        error: 'ID și numele subcontractantului sunt obligatorii' 
      }, { status: 400 });
    }

    if (tip_client.includes('Juridic') && !cui) {
      return NextResponse.json({ 
        success: false,
        error: 'CUI-ul este obligatoriu pentru persoane juridice' 
      }, { status: 400 });
    }

    if (tip_client === 'Fizic' && !cnp) {
      return NextResponse.json({ 
        success: false,
        error: 'CNP-ul este obligatoriu pentru persoane fizice' 
      }, { status: 400 });
    }

    // Verifică dacă subcontractantul există deja
    const checkQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE id = @id OR (cui IS NOT NULL AND cui = @cui)
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: { id, cui: cui || '' },
      types: { id: 'STRING', cui: 'STRING' },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Subcontractantul există deja în sistem' 
      }, { status: 409 });
    }

    // Formatare date pentru BigQuery
    const dataEliberateLiteral = formatDateLiteral(ci_eliberata_la);
    const dataUltimaSincronizareLiteral = data_ultima_sincronizare ? 
      `TIMESTAMP('${data_ultima_sincronizare}')` : 'NULL';

    // Query INSERT cu escape pentru securitate
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, nume, tip_client, cui, nr_reg_com, adresa, judet, oras, cod_postal, tara,
       telefon, email, banca, iban, cnp, ci_serie, ci_numar, ci_eliberata_de, ci_eliberata_la,
       data_creare, data_actualizare, activ, observatii, id_factureaza, data_ultima_sincronizare)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(nume)}',
        '${escapeString(tip_client)}',
        ${cui ? `'${escapeString(cui)}'` : 'NULL'},
        ${nr_reg_com ? `'${escapeString(nr_reg_com)}'` : 'NULL'},
        ${adresa ? `'${escapeString(adresa)}'` : 'NULL'},
        ${judet ? `'${escapeString(judet)}'` : 'NULL'},
        ${oras ? `'${escapeString(oras)}'` : 'NULL'},
        ${cod_postal ? `'${escapeString(cod_postal)}'` : 'NULL'},
        '${escapeString(tara)}',
        ${telefon ? `'${escapeString(telefon)}'` : 'NULL'},
        ${email ? `'${escapeString(email)}'` : 'NULL'},
        ${banca ? `'${escapeString(banca)}'` : 'NULL'},
        ${iban ? `'${escapeString(iban)}'` : 'NULL'},
        ${cnp ? `'${escapeString(cnp)}'` : 'NULL'},
        ${ci_serie ? `'${escapeString(ci_serie)}'` : 'NULL'},
        ${ci_numar ? `'${escapeString(ci_numar)}'` : 'NULL'},
        ${ci_eliberata_de ? `'${escapeString(ci_eliberata_de)}'` : 'NULL'},
        ${dataEliberateLiteral},
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        ${activ},
        ${observatii ? `'${escapeString(observatii)}'` : 'NULL'},
        ${id_factureaza ? `'${escapeString(id_factureaza)}'` : 'NULL'},
        ${dataUltimaSincronizareLiteral}
      )
    `;

    console.log('Insert subcontractant query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Subcontractant ${id} adăugat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Subcontractant adăugat cu succes',
      data: { id, nume, cui, tip_client }
    });

  } catch (error) {
    console.error('Eroare la adăugarea subcontractantului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea subcontractantului',
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
        error: 'ID subcontractant necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log('Update subcontractant:', id, updateData);

    // Construire query UPDATE dinamic cu tratament special pentru DATE
    const updateFields: string[] = [];
    const allowedFields = [
      'nume', 'tip_client', 'cui', 'nr_reg_com', 'adresa', 'judet', 'oras', 'cod_postal', 'tara',
      'telefon', 'email', 'banca', 'iban', 'cnp', 'ci_serie', 'ci_numar', 'ci_eliberata_de', 
      'ci_eliberata_la', 'activ', 'observatii', 'id_factureaza', 'data_ultima_sincronizare'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        // Tratament special pentru câmpurile DATE
        if (key === 'ci_eliberata_la') {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
        } else if (key === 'data_ultima_sincronizare' && value) {
          updateFields.push(`${key} = TIMESTAMP('${value}')`);
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else if (typeof value === 'boolean') {
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

    // Adaugă timestamp actualizare
    updateFields.push('data_actualizare = CURRENT_TIMESTAMP()');

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE id = '${escapeString(id)}'
    `;

    console.log('Update subcontractant query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log(`Subcontractant ${id} actualizat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Subcontractant actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea subcontractantului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea subcontractantului',
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
        error: 'ID subcontractant necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete - setează activ = false
    const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = '${escapeString(id)}'
    `;

    console.log('Soft delete subcontractant query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Subcontractant ${id} dezactivat (soft delete)`);

    return NextResponse.json({
      success: true,
      message: 'Subcontractant dezactivat cu succes'
    });

  } catch (error) {
    console.error('Eroare la dezactivarea subcontractantului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la dezactivarea subcontractantului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
