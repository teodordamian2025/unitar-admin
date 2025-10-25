// ==================================================================
// CALEA: app/api/user/planificator/items/[id]/pin/route.ts
// DATA: 25.10.2025 (ora României) - ENHANCED: Silent time tracking pentru pin-uri
// DESCRIERE: API pentru pin/unpin items planificator cu timestamp tracking
// FUNCȚIONALITATE: Toggle pin status + silent time tracking (start/stop timestamps + TimeTracking insert)
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

console.log(`🔧 [Pin] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { is_pinned } = body;

    if (typeof is_pinned !== 'boolean') {
      return NextResponse.json({ error: 'is_pinned must be boolean' }, { status: 400 });
    }

    console.log(`📌 [User Pin API] - Request: userId=${userId}, itemId=${id}, is_pinned=${is_pinned}`);

    // Verifică că item-ul există și aparține utilizatorului curent
    const checkQuery = `
      SELECT
        p.id,
        p.utilizator_uid,
        p.tip_item,
        p.item_id,
        p.pin_timestamp_start,

        -- Display name bazat pe tip_item
        CASE
          WHEN p.tip_item = 'proiect' THEN proj.Denumire
          WHEN p.tip_item = 'subproiect' THEN sub.Denumire
          WHEN p.tip_item = 'sarcina' THEN sarc.titlu
          ELSE 'Unknown'
        END AS display_name,

        -- Proiect ID pentru TimeTracking
        CASE
          WHEN p.tip_item = 'proiect' THEN p.item_id
          WHEN p.tip_item = 'subproiect' THEN sub.ID_Proiect
          WHEN p.tip_item = 'sarcina' THEN sarc.proiect_id
          ELSE NULL
        END AS proiect_id,

        -- Subproiect ID pentru TimeTracking
        CASE
          WHEN p.tip_item = 'subproiect' THEN p.item_id
          WHEN p.tip_item = 'sarcina' THEN sarc.subproiect_id
          ELSE NULL
        END AS subproiect_id

      FROM \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\` p

      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\` proj
        ON p.tip_item = 'proiect' AND p.item_id = proj.ID_Proiect

      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\` sub
        ON p.tip_item = 'subproiect' AND p.item_id = sub.ID_Subproiect

      LEFT JOIN \`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\` sarc
        ON p.tip_item = 'sarcina' AND p.item_id = sarc.id

      WHERE p.id = @id AND p.activ = TRUE
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { id }
    });

    if (checkRows.length === 0) {
      console.warn(`⚠️ [User Pin API] - Item not found: ${id}`);
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const item = checkRows[0];

    if (item.utilizator_uid !== userId) {
      console.warn(`⚠️ [User Pin API] - Unauthorized: userId=${userId}, owner=${item.utilizator_uid}`);
      return NextResponse.json({ error: 'Unauthorized to modify this item' }, { status: 403 });
    }

    // ✅ LOGICA NOUĂ: PIN (timestamp_start + verificări 8h)
    if (is_pinned) {
      // Verifică limita de 8 ore pe zi ÎNAINTE de a permite pin-ul
      const today = new Date().toISOString().split('T')[0];
      const todayTimeQuery = `
        SELECT COALESCE(SUM(ore_lucrate), 0) as total_ore
        FROM \`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\`
        WHERE utilizator_uid = @userId
          AND data_lucru = @today
      `;

      const [todayTimeRows] = await bigquery.query({
        query: todayTimeQuery,
        params: { userId, today }
      });

      const totalOreToday = todayTimeRows[0]?.total_ore || 0;

      if (totalOreToday >= 8) {
        console.warn(`⚠️ [User Pin API] - 8h limit reached for userId=${userId}, total_ore=${totalOreToday}`);
        return NextResponse.json({
          error: 'Ai atins limita de 8 ore pe zi! Nu poți pin-a item-ul.',
          total_ore_today: totalOreToday
        }, { status: 400 });
      }

      // Verifică dacă mai are alt pin activ (unpinAll logic)
      const unpinAllQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
        SET
          is_pinned = FALSE,
          pin_timestamp_stop = CURRENT_TIMESTAMP(),
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE utilizator_uid = @userId
          AND is_pinned = TRUE
          AND activ = TRUE
          AND id != @id
          AND pin_timestamp_start IS NOT NULL
          AND pin_timestamp_stop IS NULL
      `;

      await bigquery.query({
        query: unpinAllQuery,
        params: { userId, id }
      });

      console.log(`🔧 [User Pin API] - Unpinned other items for user ${userId}`);

      // Update pin pentru item-ul curent cu timestamp_start
      const now = new Date().toISOString();
      const pinQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
        SET
          is_pinned = TRUE,
          pin_timestamp_start = @timestamp_start,
          pin_timestamp_stop = NULL,
          pin_total_seconds = NULL,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id AND utilizator_uid = @userId
      `;

      await bigquery.query({
        query: pinQuery,
        params: { id, userId, timestamp_start: now }
      });

      console.log(`✅ [User Pin API] - Pin activated: itemId=${id}, timestamp=${now}`);

      return NextResponse.json({
        success: true,
        is_pinned: true,
        timestamp_start: now,
        message: 'Pin activat! Timpul începe să fie monitorizat silențios.',
        total_ore_today: totalOreToday
      });

    } else {
      // ✅ LOGICA NOUĂ: UNPIN (timestamp_stop + calcul durată + insert TimeTracking)

      if (!item.pin_timestamp_start) {
        return NextResponse.json({
          error: 'Pin-ul nu are timestamp de start valid!'
        }, { status: 400 });
      }

      // Calculează durata
      const now = new Date();
      const startTime = new Date(item.pin_timestamp_start.value);
      const durationMs = now.getTime() - startTime.getTime();
      const durationSeconds = Math.floor(durationMs / 1000);
      const durationHours = durationSeconds / 3600;
      const durationMinutes = Math.round(durationSeconds / 60);

      console.log(`⏱️ [User Pin API] - Unpin duration: ${durationSeconds}s (${durationMinutes} min)`);

      // Update pin cu timestamp_stop
      const unpinQuery = `
        UPDATE \`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
        SET
          is_pinned = FALSE,
          pin_timestamp_stop = @timestamp_stop,
          pin_total_seconds = @duration_seconds,
          data_actualizare = CURRENT_TIMESTAMP()
        WHERE id = @id AND utilizator_uid = @userId
      `;

      await bigquery.query({
        query: unpinQuery,
        params: {
          id,
          userId,
          timestamp_stop: now.toISOString(),
          duration_seconds: durationSeconds
        }
      });

      // ✅ CREEAZĂ ÎNREGISTRARE ÎN TimeTracking_v2 (doar dacă > 1 minut)
      if (durationMinutes >= 1) {
        const today = new Date().toISOString().split('T')[0];

        // Obține numele utilizatorului
        const userQuery = `
          SELECT nume, prenume
          FROM \`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\`
          WHERE uid = @userId
          LIMIT 1
        `;
        const [userRows] = await bigquery.query({
          query: userQuery,
          params: { userId }
        });

        const userName = userRows.length > 0
          ? `${userRows[0].prenume || ''} ${userRows[0].nume || ''}`.trim() || 'Unknown'
          : 'Unknown';

        const timeTrackingQuery = `
          INSERT INTO \`${PROJECT_ID}.${DATASET}.TimeTracking${tableSuffix}\` (
            id,
            utilizator_uid,
            utilizator_nume,
            data_lucru,
            ore_lucrate,
            descriere_lucru,
            tip_inregistrare,
            planificator_item_id,
            proiect_id,
            subproiect_id,
            sarcina_id,
            created_at
          ) VALUES (
            GENERATE_UUID(),
            @userId,
            @userName,
            @today,
            @duration_hours,
            @descriere,
            'pin_silent',
            @itemId,
            @proiect_id,
            @subproiect_id,
            @sarcina_id,
            CURRENT_TIMESTAMP()
          )
        `;

        await bigquery.query({
          query: timeTrackingQuery,
          params: {
            userId,
            userName,
            today,
            duration_hours: durationHours,
            descriere: `📌 Pin silențios: ${item.display_name}`,
            itemId: id,
            proiect_id: item.proiect_id || null,
            subproiect_id: item.subproiect_id || null,
            sarcina_id: item.tip_item === 'sarcina' ? item.item_id : null
          }
        });

        console.log(`✅ [User Pin API] - TimeTracking saved: ${durationHours.toFixed(2)}h`);
      } else {
        console.log(`⚠️ [User Pin API] - Duration too short (${durationMinutes} min), skipping TimeTracking`);
      }

      return NextResponse.json({
        success: true,
        is_pinned: false,
        duration_minutes: durationMinutes,
        duration_hours: durationHours.toFixed(2),
        message: `Pin eliminat! Timp total: ${durationMinutes} minute`
      });
    }

  } catch (error) {
    console.error('Error updating pin status:', error);
    return NextResponse.json(
      { error: 'Failed to update pin status' },
      { status: 500 }
    );
  }
}