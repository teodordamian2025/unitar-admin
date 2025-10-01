// ==================================================================
// CALEA: app/api/rapoarte/comentarii/route.ts
// DATA: 20.08.2025 00:50 (ora României)
// DESCRIERE: API CRUD pentru comentarii proiect ca istoric/log
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabelă cu suffix dinamic
const TABLE_COMENTARII = `\`${PROJECT_ID}.${DATASET}.ProiectComentarii${tableSuffix}\``;

console.log(`🔧 Comentarii API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: ProiectComentarii${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = 'PanouControlUnitar';
const table = `ProiectComentarii${tableSuffix}`;

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id');
    const tipProiect = searchParams.get('tip_proiect');
    const tipComentariu = searchParams.get('tip_comentariu');

    // Query pentru comentarii ordonate cronologic
    let query = `
      SELECT 
        id,
        proiect_id,
        tip_proiect,
        autor_uid,
        autor_nume,
        comentariu,
        data_comentariu,
        tip_comentariu
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE 1=1
    `;

    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    if (proiectId) {
      conditions.push('proiect_id = @proiectId');
      params.proiectId = proiectId;
      types.proiectId = 'STRING';
    }

    if (tipProiect) {
      conditions.push('tip_proiect = @tipProiect');
      params.tipProiect = tipProiect;
      types.tipProiect = 'STRING';
    }

    if (tipComentariu) {
      conditions.push('tip_comentariu = @tipComentariu');
      params.tipComentariu = tipComentariu;
      types.tipComentariu = 'STRING';
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Sortare cronologică descrescător (cele mai noi primul)
    query += ' ORDER BY data_comentariu DESC';

    // Limitare pentru performanță
    const limit = searchParams.get('limit');
    if (limit && !isNaN(Number(limit))) {
      query += ` LIMIT ${Number(limit)}`;
    } else {
      query += ' LIMIT 100';
    }

    console.log('Executing comentarii query:', query);
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
    console.error('Eroare la încărcarea comentariilor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea comentariilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST comentariu request body:', body);
    
    const { 
      id,
      proiect_id,
      tip_proiect = 'proiect',
      autor_uid,
      autor_nume,
      comentariu,
      tip_comentariu = 'General'
    } = body;

    // Validări
    if (!id || !proiect_id || !autor_uid || !autor_nume || !comentariu) {
      return NextResponse.json({ 
        success: false,
        error: 'ID, proiect_id, autor_uid, autor_nume și comentariu sunt obligatorii' 
      }, { status: 400 });
    }

    if (comentariu.trim().length < 3) {
      return NextResponse.json({ 
        success: false,
        error: 'Comentariul trebuie să aibă minim 3 caractere' 
      }, { status: 400 });
    }

    // Insert comentariu
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, proiect_id, tip_proiect, autor_uid, autor_nume, comentariu, 
       data_comentariu, tip_comentariu)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(proiect_id)}',
        '${escapeString(tip_proiect)}',
        '${escapeString(autor_uid)}',
        '${escapeString(autor_nume)}',
        '${escapeString(comentariu)}',
        CURRENT_TIMESTAMP(),
        '${escapeString(tip_comentariu)}'
      )
    `;

    console.log('Insert comentariu query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Comentariu ${id} adăugat cu succes pentru proiectul ${proiect_id}`);

    return NextResponse.json({
      success: true,
      message: 'Comentariu adăugat cu succes',
      data: { id, proiect_id, tip_comentariu }
    });

  } catch (error) {
    console.error('Eroare la adăugarea comentariului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea comentariului',
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
        error: 'ID comentariu necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log('Update comentariu:', id, updateData);

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const allowedFields = ['comentariu', 'tip_comentariu'];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        if (value === null || value === '') {
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

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE id = '${escapeString(id)}'
    `;

    console.log('Update comentariu query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log(`Comentariu ${id} actualizat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Comentariu actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea comentariului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea comentariului',
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
        error: 'ID comentariu necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete nu este necesar pentru comentarii - le ștergem definitiv
    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE id = '${escapeString(id)}'
    `;

    console.log('Delete comentariu query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Comentariu ${id} șters cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Comentariu șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea comentariului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea comentariului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
