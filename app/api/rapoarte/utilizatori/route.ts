// ==================================================================
// CALEA: app/api/rapoarte/utilizatori/route.ts
// DATA: 19.08.2025 21:25 (ora României)
// DESCRIERE: API pentru căutare utilizatori activi (responsabili proiecte)
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
const table = 'Utilizatori';

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Query pentru utilizatori activi
    let query = `SELECT 
      uid,
      email, 
      nume, 
      prenume,
      rol,
      activ,
      data_creare,
      data_ultima_conectare
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
    WHERE activ = true`;
    
    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre pentru căutare
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(CONCAT(IFNULL(prenume, ''), ' ', IFNULL(nume, ''))) LIKE LOWER(@search) OR 
        LOWER(IFNULL(email, '')) LIKE LOWER(@search) OR
        LOWER(IFNULL(nume, '')) LIKE LOWER(@search) OR
        LOWER(IFNULL(prenume, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    const rol = searchParams.get('rol');
    if (rol) {
      conditions.push('rol = @rol');
      params.rol = rol;
      types.rol = 'STRING';
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Sortare alfabetică
    query += ' ORDER BY prenume ASC, nume ASC';

    // Limită rezultate pentru performanță
    const limit = searchParams.get('limit');
    if (limit && !isNaN(Number(limit))) {
      query += ` LIMIT ${Number(limit)}`;
    } else {
      query += ' LIMIT 50'; // Limită default
    }

    console.log('Executing utilizatori query:', query);
    console.log('With params:', params);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      types: types,
      location: 'EU',
    });

    // Formatează rezultatele pentru frontend
    const utilizatoriFormatati = rows.map((row: any) => ({
      uid: row.uid,
      email: row.email,
      nume: row.nume,
      prenume: row.prenume,
      nume_complet: `${row.prenume || ''} ${row.nume || ''}`.trim(),
      rol: row.rol,
      activ: row.activ,
      data_creare: row.data_creare,
      data_ultima_conectare: row.data_ultima_conectare
    }));

    return NextResponse.json({
      success: true,
      data: utilizatoriFormatati,
      count: utilizatoriFormatati.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea utilizatorilor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea utilizatorilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST utilizator request body:', body);
    
    const { 
      uid,
      email, 
      nume, 
      prenume,
      rol = 'normal',
      permisiuni = {
        proiecte: { read: true, write: true },
        timp: { read: true, write: true },
        rapoarte: { read: true },
        financiar: { read: false, write: false }
      },
      activ = true
    } = body;

    // Validări
    if (!uid || !email) {
      return NextResponse.json({ 
        success: false,
        error: 'UID și email sunt obligatorii' 
      }, { status: 400 });
    }

    // Verifică dacă utilizatorul există deja
    const checkQuery = `
      SELECT uid FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE uid = @uid
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: { uid },
      types: { uid: 'STRING' },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Utilizatorul există deja în sistem' 
      }, { status: 409 });
    }

    // Query INSERT cu escape pentru securitate
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (uid, email, nume, prenume, rol, permisiuni, activ, data_creare)
      VALUES (
        '${escapeString(uid)}',
        '${escapeString(email)}',
        ${nume ? `'${escapeString(nume)}'` : 'NULL'},
        ${prenume ? `'${escapeString(prenume)}'` : 'NULL'},
        '${escapeString(rol)}',
        JSON '${JSON.stringify(permisiuni).replace(/'/g, "\\'")}',
        ${activ},
        CURRENT_TIMESTAMP()
      )
    `;

    console.log('Insert utilizator query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Utilizator ${uid} adăugat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Utilizator adăugat cu succes',
      data: { uid, email, nume, prenume, rol }
    });

  } catch (error) {
    console.error('Eroare la adăugarea utilizatorului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea utilizatorului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, ...updateData } = body;

    if (!uid) {
      return NextResponse.json({ 
        success: false,
        error: 'UID utilizator necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const allowedFields = ['email', 'nume', 'prenume', 'rol', 'permisiuni', 'activ'];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        if (key === 'permisiuni') {
          updateFields.push(`${key} = JSON '${JSON.stringify(value).replace(/'/g, "\\'")}'`);
        } else if (typeof value === 'boolean') {
          updateFields.push(`${key} = ${value}`);
        } else if (value === null) {
          updateFields.push(`${key} = NULL`);
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
    updateFields.push('updated_at = CURRENT_TIMESTAMP()');

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE uid = '${escapeString(uid)}'
    `;

    console.log('Update utilizator query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Utilizator actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea utilizatorului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea utilizatorului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ 
        success: false,
        error: 'UID utilizator necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete - setează activ = false
    const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, updated_at = CURRENT_TIMESTAMP()
      WHERE uid = '${escapeString(uid)}'
    `;

    console.log('Soft delete utilizator query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Utilizator ${uid} dezactivat (soft delete)`);

    return NextResponse.json({
      success: true,
      message: 'Utilizator dezactivat cu succes'
    });

  } catch (error) {
    console.error('Eroare la dezactivarea utilizatorului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la dezactivarea utilizatorului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
