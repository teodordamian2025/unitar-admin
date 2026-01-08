// ==================================================================
// CALEA: app/api/rapoarte/subproiecte-responsabili/route.ts
// DATA: 24.08.2025 21:30 (ora României)
// DESCRIERE: API pentru gestionarea responsabililor la subproiecte
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// ✅ V2 Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

console.log(`🔧 SubproiecteResponsabili API - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = DATASET;
const table = `SubproiecteResponsabili${tableSuffix}`;
const SUBPROIECTE_RESPONSABILI_TABLE = `\`${PROJECT_ID}.${DATASET}.${table}\``;
const UTILIZATORI_TABLE = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subproiectId = searchParams.get('subproiect_id');
    
    if (!subproiectId) {
      return NextResponse.json({ 
        success: false,
        error: 'subproiect_id este necesar' 
      }, { status: 400 });
    }

    const query = `
      SELECT 
        sr.*,
        u.email,
        u.prenume,
        u.nume,
        u.rol as rol_sistem
      FROM ${SUBPROIECTE_RESPONSABILI_TABLE} sr
      LEFT JOIN ${UTILIZATORI_TABLE} u 
        ON sr.responsabil_uid = u.uid
      WHERE sr.subproiect_id = @subproiectId
      ORDER BY 
        CASE sr.rol_in_subproiect 
          WHEN 'Principal' THEN 1 
          WHEN 'Normal' THEN 2 
          WHEN 'Observator' THEN 3 
          ELSE 4 
        END,
        sr.data_atribuire ASC
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { subproiectId },
      types: { subproiectId: 'STRING' },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea responsabililor subproiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea responsabililor subproiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST responsabil subproiect request:', body);
    
    const { 
      id,
      subproiect_id,
      responsabil_uid,
      responsabil_nume,
      rol_in_subproiect = 'Normal',
      data_atribuire,
      atribuit_de
    } = body;

    // Validări
    if (!id || !subproiect_id || !responsabil_uid || !responsabil_nume) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile id, subproiect_id, responsabil_uid și responsabil_nume sunt obligatorii' 
      }, { status: 400 });
    }

    // Verifică dacă responsabilul este deja atribuit la acest subproiect
    const checkQuery = `
      SELECT id FROM ${SUBPROIECTE_RESPONSABILI_TABLE}
      WHERE subproiect_id = @subproiectId AND responsabil_uid = @responsabilUid
    `;

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: { 
        subproiectId: subproiect_id,
        responsabilUid: responsabil_uid
      },
      types: { 
        subproiectId: 'STRING',
        responsabilUid: 'STRING'
      },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Responsabilul este deja atribuit la acest subproiect' 
      }, { status: 409 });
    }

    // Insert nou responsabil
    const insertQuery = `
      INSERT INTO ${SUBPROIECTE_RESPONSABILI_TABLE}
      (id, subproiect_id, responsabil_uid, responsabil_nume, rol_in_subproiect, data_atribuire, atribuit_de)
      VALUES (
        '${escapeString(id)}',
        '${escapeString(subproiect_id)}',
        '${escapeString(responsabil_uid)}',
        '${escapeString(responsabil_nume)}',
        '${escapeString(rol_in_subproiect)}',
        ${data_atribuire ? `TIMESTAMP('${data_atribuire}')` : 'CURRENT_TIMESTAMP()'},
        ${atribuit_de ? `'${escapeString(atribuit_de)}'` : 'NULL'}
      )
    `;

    console.log('Insert responsabil subproiect query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log(`Responsabil ${responsabil_nume} adăugat la subproiectul ${subproiect_id}`);

    // ✅ HOOK NOTIFICĂRI: Trimite notificare către responsabilul adăugat
    // FIX 08.01.2026: Notificare pentru responsabili normali, nu doar principal
    try {
      // Obține detalii subproiect și proiect părinte
      const SUBPROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
      const PROIECTE_TABLE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

      const detailsQuery = `
        SELECT
          sp.Denumire as subproiect_denumire,
          sp.Data_Final as subproiect_deadline,
          sp.ID_Proiect as proiect_id,
          p.Denumire as proiect_denumire,
          p.Client as proiect_client
        FROM ${SUBPROIECTE_TABLE} sp
        LEFT JOIN ${PROIECTE_TABLE} p ON sp.ID_Proiect = p.ID_Proiect
        WHERE sp.ID_Subproiect = @subproiectId
      `;

      const [detailRows] = await bigquery.query({
        query: detailsQuery,
        params: { subproiectId: subproiect_id },
        types: { subproiectId: 'STRING' },
        location: 'EU',
      });

      if (detailRows.length > 0) {
        const details = detailRows[0];
        const dataFinal = details.subproiect_deadline?.value || details.subproiect_deadline;

        // Trimite notificare
        const baseUrl = request.url.split('/api/')[0];
        await fetch(`${baseUrl}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tip_notificare: 'subproiect_atribuit',
            user_id: responsabil_uid,
            context: {
              subproiect_id: subproiect_id,
              subproiect_denumire: details.subproiect_denumire,
              proiect_id: details.proiect_id,
              proiect_denumire: details.proiect_denumire,
              proiect_client: details.proiect_client,
              proiect_deadline: dataFinal || '',
              user_name: responsabil_nume,
              user_prenume: responsabil_nume.split(' ')[0],
              data_atribuire: new Date().toISOString().split('T')[0],
              termen_realizare: dataFinal || 'Nespecificat',
              rol_in_subproiect: rol_in_subproiect,
              link_detalii: `${baseUrl}/admin/rapoarte/proiecte?search=${encodeURIComponent(details.proiect_id)}`
            }
          })
        });

        console.log(`✅ Notificare trimisă către responsabil ${responsabil_nume} (${responsabil_uid}) pentru subproiect ${subproiect_id}`);
      }
    } catch (notifyError) {
      console.error('⚠️ Eroare la trimitere notificare (non-blocking):', notifyError);
      // Nu blocăm adăugarea responsabilului dacă notificarea eșuează
    }

    return NextResponse.json({
      success: true,
      message: 'Responsabil adăugat cu succes la subproiect',
      data: { id, subproiect_id, responsabil_uid, responsabil_nume, rol_in_subproiect }
    });

  } catch (error) {
    console.error('Eroare la adăugarea responsabilului la subproiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea responsabilului la subproiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const subproiectId = searchParams.get('subproiect_id');
    const responsabilUid = searchParams.get('responsabil_uid');

    if (!id && !(subproiectId && responsabilUid)) {
      return NextResponse.json({ 
        success: false,
        error: 'Necesar id sau combinația subproiect_id + responsabil_uid' 
      }, { status: 400 });
    }

    let deleteQuery: string;
    
    if (id) {
      deleteQuery = `
        DELETE FROM ${SUBPROIECTE_RESPONSABILI_TABLE}
        WHERE id = '${escapeString(id)}'
      `;
    } else {
      deleteQuery = `
        DELETE FROM ${SUBPROIECTE_RESPONSABILI_TABLE}
        WHERE subproiect_id = '${escapeString(subproiectId!)}' 
          AND responsabil_uid = '${escapeString(responsabilUid!)}'
      `;
    }

    console.log('Delete responsabil subproiect query:', deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log(`Responsabil eliminat din subproiect: ${id || `${subproiectId}-${responsabilUid}`}`);

    return NextResponse.json({
      success: true,
      message: 'Responsabil eliminat cu succes din subproiect'
    });

  } catch (error) {
    console.error('Eroare la eliminarea responsabilului din subproiect:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la eliminarea responsabilului din subproiect',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
