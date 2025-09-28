// ==================================================================
// CALEA: app/api/analytics/live-pins/route.ts
// DATA: 28.09.2025 15:30 (ora României)
// DESCRIERE: API pentru afișarea pin-urilor active în Live Analytics
// FUNCȚIONALITATE: GET pentru items pin-ate cu detalii utilizatori
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const DATASET_ID = 'PanouControlUnitar';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Verifică autentificarea - API pentru admin
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    // Query cu JOIN-uri multiple pentru afișare corectă items
    const livePinsQuery = `
      SELECT
        p.id as planificator_id,
        p.utilizator_uid,
        p.tip_item,
        p.item_id,
        p.comentariu_personal,
        p.data_actualizare,
        p.is_pinned,
        p.activ,
        -- Date utilizator din tabelul Utilizatori
        u.nume,
        u.prenume,
        u.email,
        u.rol,

        -- Date proiecte
        pr.Denumire as proiect_denumire,
        pr.ID_Proiect as proiect_id,

        -- Date subproiecte cu proiectul părinte
        sp.Denumire as subproiect_denumire,
        sp.ID_Subproiect as subproiect_id,
        sp_pr.ID_Proiect as subproiect_proiect_id,
        sp_pr.Denumire as subproiect_proiect_denumire,

        -- Date sarcini cu context proiect/subproiect
        s.titlu as sarcina_titlu,
        s.tip_proiect as sarcina_tip_proiect,
        -- Pentru sarcini de subproiect: proiect_id = ID_Subproiect
        CASE
          WHEN s.tip_proiect = 'subproiect' THEN s.proiect_id
          ELSE NULL
        END as sarcina_subproiect_id,

        -- Date pentru sarcini de subproiect: găsește subproiectul și proiectul părinte
        s_sp.Denumire as sarcina_subproiect_nume,
        s_sp_pr.ID_Proiect as sarcina_proiect_parinte_id,
        s_sp_pr.Denumire as sarcina_proiect_parinte_nume,

        -- Calculare timp de la pin
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), p.data_actualizare, MINUTE) as minute_de_la_pin

      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` p
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Utilizatori\` u
        ON p.utilizator_uid = u.uid

      -- JOIN pentru proiecte directe
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` pr
        ON p.tip_item = 'proiect' AND p.item_id = pr.ID_Proiect

      -- JOIN pentru subproiecte
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Subproiecte\` sp
        ON p.tip_item = 'subproiect' AND p.item_id = sp.ID_Subproiect
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` sp_pr
        ON sp.ID_Proiect = sp_pr.ID_Proiect

      -- JOIN pentru sarcini
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Sarcini\` s
        ON p.tip_item = 'sarcina' AND p.item_id = s.id

      -- JOIN pentru sarcini de subproiect: găsește subproiectul și proiectul părinte
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Subproiecte\` s_sp
        ON s.tip_proiect = 'subproiect' AND s.proiect_id = s_sp.ID_Subproiect
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.Proiecte\` s_sp_pr
        ON s_sp.ID_Proiect = s_sp_pr.ID_Proiect

      WHERE p.is_pinned = TRUE
        AND p.activ = TRUE
      ORDER BY p.data_actualizare DESC
      LIMIT 20
    `;

    const [rows] = await bigquery.query({
      query: livePinsQuery,
      params: {}
    });

    // Procesare rezultate simplificată pentru testare
    const livePins = rows.map((row: any) => {
      // Procesarea comentariului (elimină marker-ul [REALIZAT])
      const comentariuComplet = row.comentariu_personal || '';
      const realizatMarker = '[REALIZAT]';
      const comentariu_curat = comentariuComplet.replace(realizatMarker, '').trim();

      // Construire display name inteligent bazat pe tip item
      let display_name = '';
      let context_proiect = '';

      if (row.tip_item === 'proiect') {
        // Proiect: ID_Proiect + Denumire
        display_name = `${row.proiect_id} - ${row.proiect_denumire || 'Proiect fără nume'}`;
        context_proiect = `Proiect ${row.proiect_id}`;
      } else if (row.tip_item === 'subproiect') {
        // Subproiect: ID_Proiect părinte + Denumire subproiect
        display_name = `${row.subproiect_proiect_id} - ${row.subproiect_denumire || 'Subproiect fără nume'}`;
        context_proiect = `Subproiect din ${row.subproiect_proiect_id}`;
      } else if (row.tip_item === 'sarcina') {
        // Sarcină: verifică dacă e de subproiect sau proiect direct
        if (row.sarcina_tip_proiect === 'subproiect' && row.sarcina_proiect_parinte_id) {
          // Sarcină de subproiect: Proiect părinte + Denumire subproiect + Titlu sarcină
          display_name = `${row.sarcina_proiect_parinte_id} - ${row.sarcina_subproiect_nume || 'Subproiect'} - ${row.sarcina_titlu || 'Sarcină'}`;
          context_proiect = `📁 ${row.sarcina_proiect_parinte_id} > ${row.sarcina_subproiect_nume}`;
        } else {
          // Sarcină de proiect direct
          display_name = `${row.sarcina_titlu || 'Sarcină fără titlu'}`;
          context_proiect = `Sarcină din proiect direct`;
        }
      } else {
        // Fallback pentru tipuri necunoscute
        display_name = `${row.tip_item} - ${row.item_id}`;
        context_proiect = `${row.tip_item} ${row.item_id}`;
      }

      // Formatare timp de la pin
      const minute = row.minute_de_la_pin || 0;
      let timp_pin_text = '';
      if (minute < 1) {
        timp_pin_text = 'Activat acum';
      } else if (minute < 60) {
        timp_pin_text = `Activat acum ${minute} ${minute === 1 ? 'minut' : 'minute'}`;
      } else {
        const ore = Math.floor(minute / 60);
        const minute_ramase = minute % 60;
        if (minute_ramase === 0) {
          timp_pin_text = `Activat acum ${ore} ${ore === 1 ? 'oră' : 'ore'}`;
        } else {
          timp_pin_text = `Activat acum ${ore}h ${minute_ramase}m`;
        }
      }

      return {
        id: row.planificator_id,
        tip_item: row.tip_item,
        item_id: row.item_id,
        display_name,
        comentariu_personal: comentariu_curat,
        deadline: null,
        zile_pana_deadline: 999,
        urgenta: 'scazuta',
        urgenta_color: '#10b981',

        // Date utilizator din BigQuery
        utilizator_uid: row.utilizator_uid,
        user_display: row.nume && row.prenume
          ? `${row.prenume} ${row.nume}`
          : (row.email ? row.email.split('@')[0] : 'Utilizator Necunoscut'),
        user_email: row.email || 'unknown@domain.com',
        user_rol: row.rol || 'user',

        // Timing
        data_pin: row.data_actualizare,
        minute_de_la_pin: minute,
        timp_pin_text,

        // Context proiect dinamic
        context_proiect,

        // Informații specifice tip
        detalii_specifice: { test: true }
      };
    });

    return NextResponse.json({
      pins: livePins,
      total_pins: livePins.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error loading live pins:', error);
    return NextResponse.json(
      { error: 'Failed to load live pins' },
      { status: 500 }
    );
  }
}