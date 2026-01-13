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

// NOTA: Folosim parameterized queries în loc de escapeString pentru securitate și
// gestionarea corectă a caracterelor speciale (newline, tab, etc.)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // FIX 13.01.2026: Decode proiect_id pentru a preveni probleme cu URL-encoding
    const rawProiectId = searchParams.get('proiect_id');
    const proiectId = rawProiectId ? decodeURIComponent(rawProiectId) : null;
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
      proiect_id: rawProiectId,
      tip_proiect = 'proiect',
      autor_uid,
      autor_nume,
      comentariu,
      tip_comentariu = 'General'
    } = body;

    // FIX 13.01.2026: Decode proiect_id pentru a preveni probleme cu URL-encoding
    const proiect_id = rawProiectId ? decodeURIComponent(rawProiectId) : rawProiectId;

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

    // Insert comentariu cu parameterized query (evită probleme cu newline și caractere speciale)
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, proiect_id, tip_proiect, autor_uid, autor_nume, comentariu,
       data_comentariu, tip_comentariu)
      VALUES (
        @id,
        @proiect_id,
        @tip_proiect,
        @autor_uid,
        @autor_nume,
        @comentariu,
        CURRENT_TIMESTAMP(),
        @tip_comentariu
      )
    `;

    console.log('Insert comentariu - using parameterized query for id:', id);

    await bigquery.query({
      query: insertQuery,
      params: {
        id,
        proiect_id,
        tip_proiect,
        autor_uid,
        autor_nume,
        comentariu,
        tip_comentariu
      },
      location: 'EU',
    });

    console.log(`Comentariu ${id} adăugat cu succes pentru proiectul ${proiect_id}`);

    // ✅ HOOK NOTIFICĂRI: Trimite notificare către TOȚI responsabilii proiectului
    // FIX 08.01.2026: Include și responsabilii din ProiecteResponsabili_v2/SubproiecteResponsabili_v2
    // și trimite EMAIL, nu doar notificare în clopotel
    try {
      const isSubproiect = tip_proiect === 'subproiect';
      const tableProiecte = isSubproiect ? `Subproiecte${tableSuffix}` : `Proiecte${tableSuffix}`;
      const tableResponsabili = isSubproiect ? `SubproiecteResponsabili${tableSuffix}` : `ProiecteResponsabili${tableSuffix}`;
      const idColumn = isSubproiect ? 'ID_Subproiect' : 'ID_Proiect';
      const idColumnResponsabili = isSubproiect ? 'subproiect_id' : 'proiect_id';
      const tableUtilizatori = `Utilizatori${tableSuffix}`;

      // 1. Obține denumirea proiectului
      const proiectQuery = `
        SELECT Denumire, Responsabil
        FROM \`${PROJECT_ID}.${DATASET}.${tableProiecte}\`
        WHERE ${idColumn} = @proiect_id
        LIMIT 1
      `;

      const [proiectRows] = await bigquery.query({
        query: proiectQuery,
        params: { proiect_id },
        location: 'EU',
      });

      if (proiectRows.length === 0) {
        console.warn(`⚠️ Proiect/Subproiect ${proiect_id} nu a fost găsit`);
      } else {
        const proiectData = proiectRows[0];
        const proiectDenumire = proiectData.Denumire;
        const responsabilPrincipalNume = proiectData.Responsabil;

        // 2. Obține TOȚI responsabilii: din tabelul principal + din tabelul responsabili
        // Query cu UNION pentru a combina:
        // - Responsabilul principal din Proiecte/Subproiecte (rezolvat prin nume)
        // - Responsabilii din ProiecteResponsabili/SubproiecteResponsabili (deja au UID)
        const allResponsabiliQuery = `
          WITH responsabil_principal AS (
            SELECT
              u.uid as responsabil_uid,
              u.nume,
              u.prenume,
              u.email,
              u.rol
            FROM \`${PROJECT_ID}.${DATASET}.${tableUtilizatori}\` u
            WHERE (
              CONCAT(u.nume, ' ', u.prenume) = @responsabil_principal
              OR CONCAT(u.prenume, ' ', u.nume) = @responsabil_principal
              OR u.nume = @responsabil_principal
            )
            AND @responsabil_principal IS NOT NULL
          ),
          responsabili_tabel AS (
            SELECT
              r.responsabil_uid,
              u.nume,
              u.prenume,
              u.email,
              u.rol
            FROM \`${PROJECT_ID}.${DATASET}.${tableResponsabili}\` r
            INNER JOIN \`${PROJECT_ID}.${DATASET}.${tableUtilizatori}\` u
              ON r.responsabil_uid = u.uid
            WHERE r.${idColumnResponsabili} = @proiect_id
          )
          SELECT DISTINCT responsabil_uid, nume, prenume, email, rol
          FROM responsabil_principal
          UNION DISTINCT
          SELECT DISTINCT responsabil_uid, nume, prenume, email, rol
          FROM responsabili_tabel
        `;

        const [allResponsabili] = await bigquery.query({
          query: allResponsabiliQuery,
          params: {
            proiect_id,
            responsabil_principal: responsabilPrincipalNume || null,
          },
          location: 'EU',
        });

        console.log(`📧 Găsiți ${allResponsabili.length} responsabili pentru notificare comentariu`);

        // 3. Trimite notificare către fiecare responsabil (excluzând autorul)
        const baseUrl = request.url.split('/api/')[0];
        let notificariTrimise = 0;

        for (const responsabil of allResponsabili) {
          // Skip dacă responsabilul este autorul comentariului
          if (responsabil.responsabil_uid === autor_uid) {
            console.log(`⏭️ Skip notificare - ${responsabil.nume} ${responsabil.prenume} este autorul comentariului`);
            continue;
          }

          // Determină link-ul corect în funcție de rolul utilizatorului
          const isAdmin = responsabil.rol === 'admin';
          const linkDetalii = isAdmin
            ? `${baseUrl}/admin/rapoarte/proiecte?search=${encodeURIComponent(proiect_id)}`
            : `${baseUrl}/projects?search=${encodeURIComponent(proiect_id)}`;

          try {
            const notifyResponse = await fetch(`${baseUrl}/api/notifications/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tip_notificare: 'comentariu_nou',
                user_id: responsabil.responsabil_uid,
                force_email: true, // ✅ Forțează trimiterea email-ului
                context: {
                  proiect_id: proiect_id,
                  proiect_denumire: proiectDenumire,
                  sarcina_titlu: proiectDenumire,
                  comentator_name: autor_nume,
                  comentariu_text: comentariu.length > 200 ? comentariu.substring(0, 200) + '...' : comentariu,
                  tip_comentariu: tip_comentariu,
                  tip_proiect: tip_proiect,
                  user_name: `${responsabil.nume} ${responsabil.prenume}`,
                  user_prenume: responsabil.prenume,
                  link_detalii: linkDetalii
                }
              })
            });

            const notifyResult = await notifyResponse.json();
            if (notifyResult.success) {
              notificariTrimise++;
              console.log(`✅ Notificare comentariu trimisă către ${responsabil.nume} ${responsabil.prenume} (${responsabil.responsabil_uid})`);
            } else {
              console.warn(`⚠️ Eroare notificare pentru ${responsabil.responsabil_uid}:`, notifyResult);
            }
          } catch (singleNotifyError) {
            console.error(`⚠️ Eroare la trimitere notificare către ${responsabil.responsabil_uid}:`, singleNotifyError);
          }
        }

        console.log(`📬 Total notificări comentariu trimise: ${notificariTrimise}/${allResponsabili.length - (allResponsabili.some((r: any) => r.responsabil_uid === autor_uid) ? 1 : 0)}`);
      }
    } catch (notifyError) {
      console.error('⚠️ Eroare la trimitere notificări comentariu (non-blocking):', notifyError);
      // Nu blocăm adăugarea comentariului dacă notificarea eșuează
    }

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

    // Construire query UPDATE cu parameterized query
    const updateFields: string[] = [];
    const params: Record<string, any> = { id };
    const allowedFields = ['comentariu', 'tip_comentariu'];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else {
          updateFields.push(`${key} = @${key}`);
          params[key] = value.toString();
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
      WHERE id = @id
    `;

    console.log('Update comentariu - using parameterized query for id:', id);

    await bigquery.query({
      query: updateQuery,
      params,
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
      WHERE id = @id
    `;

    console.log('Delete comentariu - using parameterized query for id:', id);

    await bigquery.query({
      query: deleteQuery,
      params: { id },
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
