// ==================================================================
// CALEA: app/api/rapoarte/oferte/status/route.ts
// DATA: 04.04.2026
// DESCRIERE: API pentru schimbarea statusului ofertelor cu istoric
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;
const TABLE_ISTORIC = `\`${PROJECT_ID}.${DATASET}.OferteIstoricStatus${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const STATUSURI_VALIDE = ['Draft', 'Trimisa', 'Acceptata', 'Refuzata', 'Expirata', 'Negociere', 'Anulata'];

const escapeString = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
};

const escapeValue = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${escapeString(String(val))}'`;
};

// GET - Istoric status pentru o oferta
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oferta_id = searchParams.get('oferta_id');

    if (!oferta_id) {
      return NextResponse.json({ error: 'oferta_id este obligatoriu' }, { status: 400 });
    }

    const [rows] = await bigquery.query({
      query: `
        SELECT * FROM ${TABLE_ISTORIC}
        WHERE oferta_id = @oferta_id
        ORDER BY data_schimbare DESC
      `,
      params: { oferta_id },
      location: 'EU',
    });

    return NextResponse.json({ success: true, data: rows });

  } catch (error) {
    console.error('Eroare GET istoric status:', error);
    return NextResponse.json({
      error: 'Eroare la incarcarea istoricului',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

// PUT - Schimbare status oferta
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { oferta_id, status_nou, observatii, schimbat_de, schimbat_de_nume, motiv_refuz } = body;

    if (!oferta_id) {
      return NextResponse.json({ error: 'oferta_id este obligatoriu' }, { status: 400 });
    }
    if (!status_nou || !STATUSURI_VALIDE.includes(status_nou)) {
      return NextResponse.json({ error: `Status invalid. Statusuri valide: ${STATUSURI_VALIDE.join(', ')}` }, { status: 400 });
    }

    // Obtine statusul curent
    const [currentRows] = await bigquery.query({
      query: `SELECT status FROM ${TABLE_OFERTE} WHERE id = @id AND activ = true`,
      params: { id: oferta_id },
      location: 'EU',
    });

    if (currentRows.length === 0) {
      return NextResponse.json({ error: 'Oferta nu a fost gasita' }, { status: 404 });
    }

    const statusVechi = currentRows[0].status;
    const now = new Date().toISOString();

    // Update oferta cu noul status + campuri conditionale
    const updates = [`status = '${escapeString(status_nou)}'`, `data_actualizare = TIMESTAMP('${now}')`];

    if (status_nou === 'Trimisa') {
      updates.push(`data_trimitere = TIMESTAMP('${now}')`);
    }
    if (status_nou === 'Acceptata' || status_nou === 'Refuzata') {
      updates.push(`data_raspuns = TIMESTAMP('${now}')`);
    }
    if (status_nou === 'Refuzata' && motiv_refuz) {
      updates.push(`motiv_refuz = ${escapeValue(motiv_refuz)}`);
    }

    await bigquery.query({
      query: `UPDATE ${TABLE_OFERTE} SET ${updates.join(', ')} WHERE id = '${escapeString(oferta_id)}' AND activ = true`,
      location: 'EU',
    });

    // Salvare in istoric
    const istoricId = `ist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await bigquery.query({
      query: `
        INSERT INTO ${TABLE_ISTORIC}
        (id, oferta_id, status_vechi, status_nou, schimbat_de, schimbat_de_nume, observatii, data_schimbare)
        VALUES
        (${escapeValue(istoricId)}, ${escapeValue(oferta_id)}, ${escapeValue(statusVechi)}, ${escapeValue(status_nou)},
         ${escapeValue(schimbat_de || null)}, ${escapeValue(schimbat_de_nume || null)},
         ${escapeValue(observatii || null)}, TIMESTAMP('${now}'))
      `,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: `Status schimbat de la ${statusVechi} la ${status_nou}`,
      data: { status_vechi: statusVechi, status_nou }
    });

  } catch (error) {
    console.error('Eroare PUT status oferta:', error);
    return NextResponse.json({
      error: 'Eroare la schimbarea statusului',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
