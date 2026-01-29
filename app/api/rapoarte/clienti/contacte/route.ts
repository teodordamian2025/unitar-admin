// ==================================================================
// CALEA: /app/api/rapoarte/clienti/contacte/route.ts
// DATA: 29.01.2026
// DESCRIERE: API pentru gestionarea contactelor clienților
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const TABLE_CONTACTE = `\`${PROJECT_ID}.${DATASET}.ClientContacte_v2\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// GET - Lista contacte pentru un client
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    if (!clientId) {
      return NextResponse.json({
        error: 'client_id este obligatoriu'
      }, { status: 400 });
    }

    const query = `
      SELECT * FROM ${TABLE_CONTACTE}
      WHERE client_id = @clientId AND activ = TRUE
      ORDER BY nume ASC
    `;

    const [rows] = await bigquery.query({
      query,
      params: { clientId },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea contactelor:', error);
    return NextResponse.json({
      error: 'Eroare la încărcarea contactelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Adaugă contact nou
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, prenume, nume, email, telefon, rol, comentariu, primeste_notificari } = body;

    // Validări
    if (!client_id) {
      return NextResponse.json({ error: 'client_id este obligatoriu' }, { status: 400 });
    }
    if (!nume?.trim()) {
      return NextResponse.json({ error: 'Numele contactului este obligatoriu' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email-ul contactului este obligatoriu' }, { status: 400 });
    }

    // Validare format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Format email invalid' }, { status: 400 });
    }

    // Verifică dacă email-ul există deja pentru acest client
    const checkQuery = `
      SELECT id FROM ${TABLE_CONTACTE}
      WHERE client_id = @clientId AND email = @email AND activ = TRUE
      LIMIT 1
    `;
    const [existing] = await bigquery.query({
      query: checkQuery,
      params: { clientId: client_id, email: email.trim() },
      location: 'EU',
    });

    if (existing.length > 0) {
      return NextResponse.json({
        error: 'Un contact cu acest email există deja pentru acest client'
      }, { status: 409 });
    }

    // Generează ID unic
    const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // ✅ Folosim INSERT cu valori inline pentru a evita problema cu null și tipuri
    // BigQuery nu acceptă parametri null fără tipuri explicite
    const escapeString = (val: string | null | undefined): string => {
      if (val === null || val === undefined || val === '') return 'NULL';
      // Escape single quotes și newlines pentru BigQuery string literals
      return `'${val.replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
    };

    const insertQuery = `
      INSERT INTO ${TABLE_CONTACTE}
      (id, client_id, prenume, nume, email, telefon, rol, comentariu, activ, primeste_notificari, data_creare, data_actualizare)
      VALUES
      (${escapeString(contactId)}, ${escapeString(client_id)}, ${escapeString(prenume?.trim())}, ${escapeString(nume.trim())}, ${escapeString(email.trim())}, ${escapeString(telefon?.trim())}, ${escapeString(rol?.trim())}, ${escapeString(comentariu?.trim())}, TRUE, ${primeste_notificari !== false}, TIMESTAMP('${now}'), TIMESTAMP('${now}'))
    `;

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Contact adăugat cu succes',
      contactId
    });

  } catch (error) {
    console.error('Eroare la adăugarea contactului:', error);
    return NextResponse.json({
      error: 'Eroare la adăugarea contactului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizează contact
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, prenume, nume, email, telefon, rol, comentariu, primeste_notificari } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID contact necesar' }, { status: 400 });
    }

    // ✅ Helper pentru escape string și null
    const escapeValue = (val: string | null | undefined): string => {
      if (val === null || val === undefined || val === '') return 'NULL';
      // Escape single quotes și newlines pentru BigQuery string literals
      return `'${val.replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
    };

    // Construire update dinamic cu valori inline
    const updateFields: string[] = [];

    if (prenume !== undefined) {
      updateFields.push(`prenume = ${escapeValue(prenume?.trim())}`);
    }
    if (nume !== undefined) {
      updateFields.push(`nume = ${escapeValue(nume?.trim())}`);
    }
    if (email !== undefined) {
      // Validare email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Format email invalid' }, { status: 400 });
      }
      updateFields.push(`email = ${escapeValue(email?.trim())}`);
    }
    if (telefon !== undefined) {
      updateFields.push(`telefon = ${escapeValue(telefon?.trim())}`);
    }
    if (rol !== undefined) {
      updateFields.push(`rol = ${escapeValue(rol?.trim())}`);
    }
    if (comentariu !== undefined) {
      updateFields.push(`comentariu = ${escapeValue(comentariu?.trim())}`);
    }
    if (primeste_notificari !== undefined) {
      updateFields.push(`primeste_notificari = ${primeste_notificari ? 'TRUE' : 'FALSE'}`);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'Nu există câmpuri de actualizat' }, { status: 400 });
    }

    const now = new Date().toISOString();
    updateFields.push(`data_actualizare = TIMESTAMP('${now}')`);

    const escapedId = id.replace(/'/g, "''");
    const updateQuery = `
      UPDATE ${TABLE_CONTACTE}
      SET ${updateFields.join(', ')}
      WHERE id = '${escapedId}' AND activ = TRUE
    `;

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Contact actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea contactului:', error);
    return NextResponse.json({
      error: 'Eroare la actualizarea contactului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Șterge contact (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID contact necesar' }, { status: 400 });
    }

    const deleteQuery = `
      UPDATE ${TABLE_CONTACTE}
      SET activ = FALSE, data_actualizare = @dataActualizare
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: {
        id,
        dataActualizare: new Date().toISOString()
      },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Contact șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea contactului:', error);
    return NextResponse.json({
      error: 'Eroare la ștergerea contactului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
