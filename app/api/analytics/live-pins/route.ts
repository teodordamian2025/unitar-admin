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

    // Query simplificat pentru testare pin-uri active
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
        -- Calculare timp de la pin simplificat
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), p.data_actualizare, MINUTE) as minute_de_la_pin
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.PlanificatorPersonal\` p
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

      // Display name simplu pentru test
      const display_name = `${row.tip_item} - ${row.item_id}`;

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

        // Date utilizator
        utilizator_uid: row.utilizator_uid,
        user_display: 'Demo User',
        user_email: 'demo@test.com',
        user_rol: 'user',

        // Timing
        data_pin: row.data_actualizare,
        minute_de_la_pin: minute,
        timp_pin_text,

        // Context proiect
        context_proiect: `Proiect ${row.item_id}`,

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