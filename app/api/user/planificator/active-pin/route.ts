// ==================================================================
// CALEA: app/api/user/planificator/active-pin/route.ts
// DATA: 25.10.2025 (ora României)
// DESCRIERE: API pentru verificare pin activ - ZERO POLLING (fetch doar la mount)
// FUNCȚIONALITATE: Returnează pin-ul activ al utilizatorului pentru afișare în sidebar
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

console.log(`🔧 [Active Pin] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    console.log(`📌 [Active Pin Check] - Fetching for userId=${userId}`);

    // Query pentru găsirea pin-ului activ al utilizatorului
    const query = `
      SELECT
        p.id,
        p.utilizator_uid,
        p.tip_item,
        p.item_id,
        p.comentariu_personal,
        p.is_pinned,
        p.pin_timestamp_start,
        p.pin_timestamp_stop,
        p.pin_total_seconds,
        p.data_adaugare,

        -- Display name bazat pe tip_item
        CASE
          WHEN p.tip_item = 'proiect' THEN proj.Denumire
          WHEN p.tip_item = 'subproiect' THEN sub.Denumire
          WHEN p.tip_item = 'sarcina' THEN sarc.titlu
          ELSE 'Unknown'
        END AS display_name,

        -- Context proiect
        CASE
          WHEN p.tip_item = 'proiect' THEN proj.Denumire
          WHEN p.tip_item = 'subproiect' THEN (
            SELECT Denumire FROM \`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\`
            WHERE ID_Proiect = sub.ID_Proiect
          )
          WHEN p.tip_item = 'sarcina' THEN (
            SELECT Denumire FROM \`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\`
            WHERE ID_Proiect = sarc.proiect_id
          )
          ELSE NULL
        END AS context_proiect,

        -- Deadline (din sarcină sau subproiect)
        CASE
          WHEN p.tip_item = 'sarcina' THEN sarc.data_scadenta
          WHEN p.tip_item = 'subproiect' THEN sub.Data_Final
          ELSE NULL
        END AS deadline

      FROM \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\` p

      -- LEFT JOIN pentru a obține detalii bazat pe tip_item
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\` proj
        ON p.tip_item = 'proiect' AND p.item_id = proj.ID_Proiect

      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\` sub
        ON p.tip_item = 'subproiect' AND p.item_id = sub.ID_Subproiect

      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\` sarc
        ON p.tip_item = 'sarcina' AND p.item_id = sarc.id

      WHERE p.utilizator_uid = @userId
        AND p.is_pinned = TRUE
        AND p.activ = TRUE
        AND p.pin_timestamp_start IS NOT NULL
        AND p.pin_timestamp_stop IS NULL

      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { userId }
    });

    if (rows.length === 0) {
      console.log(`📌 [Active Pin Check] - No active pin for userId=${userId}`);
      return NextResponse.json({
        success: true,
        pin: null
      });
    }

    const pin = rows[0];

    // Calculează elapsed time în secunde
    const now = new Date();
    const startTime = new Date(pin.pin_timestamp_start.value);
    const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    // Format response
    const responsePin = {
      id: pin.id,
      utilizator_uid: pin.utilizator_uid,
      tip_item: pin.tip_item,
      item_id: pin.item_id,
      display_name: pin.display_name,
      comentariu_personal: pin.comentariu_personal || '',
      pin_timestamp_start: pin.pin_timestamp_start.value,
      elapsed_seconds: elapsedSeconds,
      context_proiect: pin.context_proiect,
      deadline: pin.deadline?.value || null
    };

    console.log(`✅ [Active Pin Check] - Found active pin: ${pin.id}, elapsed: ${elapsedSeconds}s`);

    return NextResponse.json({
      success: true,
      pin: responsePin
    });

  } catch (error) {
    console.error('Error fetching active pin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active pin' },
      { status: 500 }
    );
  }
}
