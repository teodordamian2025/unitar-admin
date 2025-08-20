// ==================================================================
// CALEA: app/api/utilizatori/curent/route.ts
// DATA: 21.08.2025 01:30 (ora României)
// DESCRIERE: API pentru preluarea datelor utilizatorului curent autentificat
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

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();
    
    if (!uid) {
      return NextResponse.json({ 
        error: 'UID utilizator necesar pentru identificare' 
      }, { status: 400 });
    }

    // Extrage datele complete ale utilizatorului din BigQuery
    const query = `
      SELECT 
        uid, 
        email, 
        nume, 
        prenume, 
        rol, 
        permisiuni, 
        activ,
        data_creare,
        data_ultima_conectare
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\`
      WHERE uid = @uid AND activ = true
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { uid: uid },
      location: 'EU',
    });

    if (rows.length === 0) {
      return NextResponse.json({ 
        error: 'Utilizatorul nu a fost găsit sau este inactiv' 
      }, { status: 404 });
    }

    const user = rows[0];
    
    // Construiește numele complet din prenume + nume
    const nume_complet = user.prenume && user.nume 
      ? `${user.prenume} ${user.nume}`.trim()
      : user.nume || user.prenume || 'Utilizator Necunoscut';

    // Actualizează ultima conectare
    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\`
      SET data_ultima_conectare = CURRENT_TIMESTAMP()
      WHERE uid = @uid
    `;

    await bigquery.query({
      query: updateQuery,
      params: { uid: uid },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: {
        uid: user.uid,
        email: user.email,
        nume: user.nume || '',
        prenume: user.prenume || '',
        nume_complet: nume_complet,
        rol: user.rol,
        permisiuni: typeof user.permisiuni === 'string' 
          ? JSON.parse(user.permisiuni) 
          : user.permisiuni,
        activ: user.activ,
        data_creare: user.data_creare,
        data_ultima_conectare: user.data_ultima_conectare
      }
    });

  } catch (error) {
    console.error('Eroare la preluarea utilizatorului curent:', error);
    return NextResponse.json({ 
      error: 'Eroare la preluarea datelor utilizatorului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Folosește POST cu uid pentru identificarea utilizatorului' 
  }, { status: 405 });
}
