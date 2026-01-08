// ==================================================================
// CALEA: app/api/rapoarte/proiecte-responsabili/route.ts
// DATA: 24.08.2025 21:20 (ora României)
// DESCRIERE: API pentru gestionarea responsabililor la proiecte principale
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const dataset = 'PanouControlUnitar';
const table = `ProiecteResponsabili${tableSuffix}`;

console.log(`🔧 ProiecteResponsabili API - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiectId = searchParams.get('proiect_id');
    
    if (!proiectId) {
      return NextResponse.json({ 
        success: false,
        error: 'proiect_id este necesar' 
      }, { status: 400 });
    }

    const query = `
      SELECT 
        pr.*,
        u.email,
        u.prenume,
        u.nume,
        u.rol as rol_sistem
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\` pr
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Utilizatori${tableSuffix}\` u
        ON pr.responsabil_uid = u.uid
      WHERE pr.proiect_id = @proiectId
      ORDER BY 
        CASE pr.rol_in_proiect 
          WHEN 'Principal' THEN 1 
          WHEN 'Normal' THEN 2 
          WHEN 'Observator' THEN 3 
          ELSE 4 
        END,
        pr.data_atribuire ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { proiectId },
      types: { proiectId: 'STRING' },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea responsabililor proiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea responsabililor proiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST responsabil proiect request:', body);
    
    const { 
      id,
      proiect_id,
      responsabil_uid,
      responsabil_nume,
      rol_in_proiect = 'Normal',
      data_atribuire,
      atribuit_de
    } = body;

    // Validări
    if (!id || !proiect_id || !responsabil_uid || !responsabil_nume) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile id, proiect_id, responsabil_uid și responsabil_nume sunt obligatorii' 
      }, { status: 400 });
    }

    // Verifică dacă responsabilul este deja atribuit la acest proiect
    const checkQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE proiect_id = @proiectId AND responsabil_uid = @responsabilUid
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: { 
        proiectId: proiect_id,
        responsabilUid: responsabil_uid
      },
      types: { 
        proiectId: 'STRING',
        responsabilUid: 'STRING'
      },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Responsabilul este deja atribuit la acest proiect' 
      }, { status: 409 });
    }

    // Insert nou responsabil
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, proiect_id, responsabil_uid, responsabil_nume, rol_in_proiect, data_atribuire, atribuit_de)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(proiect_id)}',
        '${escapeString(responsabil_uid)}',
        '${escapeString(responsabil_nume)}',
        '${escapeString(rol_in_proiect)}',
        ${data_atribuire ? `TIMESTAMP('${data_atribuire}')` : 'CURRENT_TIMESTAMP()'},
        ${atribuit_de ? `'${escapeString(atribuit_de)}'` : 'NULL'}
      )
    `;

    console.log('Insert responsabil proiect query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Responsabil ${responsabil_nume} adăugat la proiectul ${proiect_id}`);

    // ✅ HOOK NOTIFICĂRI: Trimite notificare către responsabilul adăugat
    // FIX 08.01.2026: Notificare pentru responsabili normali, nu doar principal
    try {
      // Obține detalii proiect
      const proiectQuery = `
        SELECT Denumire, Client, Data_Final, Descriere
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.Proiecte${tableSuffix}\`
        WHERE ID_Proiect = @proiectId
      `;

      const [proiectRows] = await bigquery.query({
        query: proiectQuery,
        params: { proiectId: proiect_id },
        types: { proiectId: 'STRING' },
        location: 'EU',
      });

      if (proiectRows.length > 0) {
        const proiect = proiectRows[0];
        const dataFinal = proiect.Data_Final?.value || proiect.Data_Final;

        // Trimite notificare
        const baseUrl = request.url.split('/api/')[0];
        await fetch(`${baseUrl}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tip_notificare: 'proiect_atribuit',
            user_id: responsabil_uid,
            context: {
              proiect_id: proiect_id,
              proiect_denumire: proiect.Denumire,
              proiect_client: proiect.Client,
              proiect_descriere: proiect.Descriere || '',
              proiect_deadline: dataFinal || '',
              user_name: responsabil_nume,
              user_prenume: responsabil_nume.split(' ')[0], // Prima parte a numelui
              data_atribuire: new Date().toISOString().split('T')[0],
              termen_realizare: dataFinal || 'Nespecificat',
              rol_in_proiect: rol_in_proiect,
              link_detalii: `${baseUrl}/admin/rapoarte/proiecte?search=${encodeURIComponent(proiect_id)}`
            }
          })
        });

        console.log(`✅ Notificare trimisă către responsabil ${responsabil_nume} (${responsabil_uid}) pentru proiect ${proiect_id}`);
      }
    } catch (notifyError) {
      console.error('⚠️ Eroare la trimitere notificare (non-blocking):', notifyError);
      // Nu blocăm adăugarea responsabilului dacă notificarea eșuează
    }

    return NextResponse.json({
      success: true,
      message: 'Responsabil adăugat cu succes la proiect',
      data: { id, proiect_id, responsabil_uid, responsabil_nume, rol_in_proiect }
    });

  } catch (error) {
    console.error('Eroare la adăugarea responsabilului la proiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea responsabilului la proiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const proiectId = searchParams.get('proiect_id');
    const responsabilUid = searchParams.get('responsabil_uid');

    if (!id && !(proiectId && responsabilUid)) {
      return NextResponse.json({ 
        success: false,
        error: 'Necesar id sau combinația proiect_id + responsabil_uid' 
      }, { status: 400 });
    }

    let deleteQuery: string;
    
    if (id) {
      deleteQuery = `
        DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        WHERE id = '${escapeString(id)}'
      `;
    } else {
      deleteQuery = `
        DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
        WHERE proiect_id = '${escapeString(proiectId!)}' 
          AND responsabil_uid = '${escapeString(responsabilUid!)}'
      `;
    }

    console.log('Delete responsabil proiect query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Responsabil eliminat din proiect: ${id || `${proiectId}-${responsabilUid}`}`);

    return NextResponse.json({
      success: true,
      message: 'Responsabil eliminat cu succes din proiect'
    });

  } catch (error) {
    console.error('Eroare la eliminarea responsabilului din proiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la eliminarea responsabilului din proiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
