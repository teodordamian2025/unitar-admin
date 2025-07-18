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
    const { uid, email } = await request.json();
    
    if (!uid || !email) {
      return NextResponse.json({ error: 'UID și email necesare' }, { status: 400 });
    }

    // Verifică dacă utilizatorul există în BigQuery
    const query = `
      SELECT rol, permisiuni, activ
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\`
      WHERE uid = @uid
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { uid: uid },
      location: 'EU',
    });

    if (rows.length === 0) {
      // Utilizatorul nu există, creează-l cu rol normal
      const insertQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Utilizatori\`
        (uid, email, rol, permisiuni, activ, data_creare)
        VALUES (@uid, @email, 'normal', JSON '{"proiecte": {"read": true, "write": true}, "timp": {"read": true, "write": true}, "rapoarte": {"read": true}, "financiar": {"read": false, "write": false}}', true, CURRENT_TIMESTAMP())
      `;

      await bigquery.query({
        query: insertQuery,
        params: { uid: uid, email: email },
        location: 'EU',
      });

      return NextResponse.json({
        success: true,
        role: 'normal',
        permissions: {
          proiecte: { read: true, write: true },
          timp: { read: true, write: true },
          rapoarte: { read: true },
          financiar: { read: false, write: false }
        }
      });
    }

    const user = rows[0];
    
    if (!user.activ) {
      return NextResponse.json({ error: 'Contul este dezactivat' }, { status: 403 });
    }

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
      role: user.rol,
      permissions: typeof user.permisiuni === 'string' ? JSON.parse(user.permisiuni) : user.permisiuni
    });

  } catch (error) {
    console.error('Eroare la verificarea rolului:', error);
    return NextResponse.json({ 
      error: 'Eroare la verificarea rolului utilizatorului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

