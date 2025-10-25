// ==================================================================
// CALEA: app/api/analytics/live-pins/route.ts
// DATA: 02.10.2025 (ora României) - FIXED: Adăugat logs debugging detaliate
// DESCRIERE: API pentru afișarea pin-urilor active în Live Analytics
// FUNCȚIONALITATE: GET pentru items pin-ate cu detalii utilizatori + logs debugging
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

// Force dynamic rendering for this route (uses headers)
export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_PLANIFICATOR_PERSONAL = `\`${PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\``;
const TABLE_UTILIZATORI = `\`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_SARCINI = `\`${PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\``;

console.log(`🔧 Live Pins API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: PlanificatorPersonal${tableSuffix}, Utilizatori${tableSuffix}, Proiecte${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const DATASET_ID = DATASET;

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

        -- ✅ ADĂUGAT: Pin timestamp tracking
        p.pin_timestamp_start,
        p.pin_timestamp_stop,
        p.pin_total_seconds,

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
        s.proiect_id as sarcina_proiect_original_id,

        -- Pentru sarcini de subproiect: proiect_id = ID_Subproiect
        CASE
          WHEN s.tip_proiect = 'subproiect' THEN s.proiect_id
          ELSE NULL
        END as sarcina_subproiect_id,

        -- Date pentru sarcini de subproiect: găsește subproiectul și proiectul părinte
        s_sp.Denumire as sarcina_subproiect_nume,
        s_sp_pr.ID_Proiect as sarcina_proiect_parinte_id,
        s_sp_pr.Denumire as sarcina_proiect_parinte_nume,

        -- Date pentru sarcini de proiect direct
        s_pr_direct.ID_Proiect as sarcina_proiect_direct_id,
        s_pr_direct.Denumire as sarcina_proiect_direct_nume,

        -- ✅ MODIFICAT: Calculare în secunde pentru silent tracking
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), COALESCE(p.pin_timestamp_start, p.data_actualizare), SECOND) as elapsed_seconds,
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), p.data_actualizare, MINUTE) as minute_de_la_pin

      FROM ${TABLE_PLANIFICATOR_PERSONAL} p
      LEFT JOIN ${TABLE_UTILIZATORI} u
        ON p.utilizator_uid = u.uid

      -- JOIN pentru proiecte directe
      LEFT JOIN ${TABLE_PROIECTE} pr
        ON p.tip_item = 'proiect' AND p.item_id = pr.ID_Proiect

      -- JOIN pentru subproiecte
      LEFT JOIN ${TABLE_SUBPROIECTE} sp
        ON p.tip_item = 'subproiect' AND p.item_id = sp.ID_Subproiect
      LEFT JOIN ${TABLE_PROIECTE} sp_pr
        ON sp.ID_Proiect = sp_pr.ID_Proiect

      -- JOIN pentru sarcini
      LEFT JOIN ${TABLE_SARCINI} s
        ON p.tip_item = 'sarcina' AND p.item_id = s.id

      -- JOIN pentru sarcini de subproiect: găsește subproiectul și proiectul părinte
      LEFT JOIN ${TABLE_SUBPROIECTE} s_sp
        ON s.tip_proiect = 'subproiect' AND s.proiect_id = s_sp.ID_Subproiect
      LEFT JOIN ${TABLE_PROIECTE} s_sp_pr
        ON s_sp.ID_Proiect = s_sp_pr.ID_Proiect

      -- JOIN pentru sarcini de proiect direct
      LEFT JOIN ${TABLE_PROIECTE} s_pr_direct
        ON s.tip_proiect = 'proiect' AND s.proiect_id = s_pr_direct.ID_Proiect

      WHERE p.is_pinned = TRUE
        AND p.activ = TRUE
      ORDER BY p.data_actualizare DESC
      LIMIT 20
    `;

    const [rows] = await bigquery.query({
      query: livePinsQuery,
      params: {}
    });

    console.log(`🔍 [Live Pins API] - Query Results: ${rows.length} raw rows found`);

    // Log detaliat pentru fiecare rând raw
    if (rows.length > 0) {
      rows.forEach((row: any, index: number) => {
        console.log(`  [${index + 1}] ${row.tip_item} - ${row.item_id} (user: ${row.utilizator_uid}, pinned: ${row.is_pinned}, active: ${row.activ})`);
      });
    } else {
      console.warn(`⚠️ [Live Pins API] - No pinned items found in BigQuery`);
    }

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
        // Proiect simplu: proiect_id + denumire proiect
        display_name = `${row.proiect_id || row.item_id} - ${row.proiect_denumire || 'Proiect fără nume'}`;
        context_proiect = `📁 Proiect ${row.proiect_id || row.item_id}`;
      } else if (row.tip_item === 'subproiect') {
        // Proiect cu subproiect: proiect_id + denumire subproiect
        display_name = `${row.subproiect_proiect_id || 'ProiectID'} - ${row.subproiect_denumire || 'Subproiect fără nume'}`;
        context_proiect = `📁 ${row.subproiect_proiect_id || 'ProiectID'} > ${row.subproiect_denumire || 'Subproiect'}`;
      } else if (row.tip_item === 'sarcina') {
        // Sarcină: verifică dacă e de subproiect sau proiect direct
        if (row.sarcina_tip_proiect === 'subproiect' && row.sarcina_proiect_parinte_id) {
          // Proiect cu subproiect+sarcina: proiect_id + titlu subproiect + descriere sarcina
          display_name = `${row.sarcina_proiect_parinte_id} - ${row.sarcina_subproiect_nume || 'Subproiect'} - ${row.sarcina_titlu || 'Sarcină'}`;
          context_proiect = `📁 ${row.sarcina_proiect_parinte_id} > ${row.sarcina_subproiect_nume}`;
        } else {
          // Sarcină de proiect direct: folosește datele din JOIN-ul nou adăugat
          if (row.sarcina_tip_proiect === 'proiect' && row.sarcina_proiect_direct_id) {
            // Avem date complete din JOIN pentru proiect direct
            display_name = `${row.sarcina_proiect_direct_id} - ${row.sarcina_titlu || 'Sarcină'}${row.sarcina_descriere ? ' - ' + row.sarcina_descriere : ''}`;
            context_proiect = `📁 Sarcină din proiect ${row.sarcina_proiect_direct_id}`;
          } else {
            // Fallback dacă nu găsim informații complete
            const fallbackId = row.sarcina_proiect_original_id || row.item_id || 'Sarcină';
            display_name = `${fallbackId} - ${row.sarcina_titlu || 'Sarcină fără titlu'}`;
            context_proiect = `📁 Sarcină (${row.sarcina_tip_proiect || 'necunoscut'})`;
          }
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

      // ✅ ADĂUGAT: Formatare ora start pentru UI (timezone România)
      const pin_timestamp_start = row.pin_timestamp_start?.value || null;
      let ora_start_text = 'N/A';
      if (pin_timestamp_start) {
        const startDate = new Date(pin_timestamp_start);
        ora_start_text = startDate.toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Bucharest' // ✅ FIX: Timezone România explicit
        });
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

        // ✅ TIMING SILENT TRACKING
        data_pin: row.data_actualizare,
        minute_de_la_pin: minute,
        timp_pin_text,
        pin_timestamp_start: pin_timestamp_start,
        ora_start_text: ora_start_text,
        elapsed_seconds: row.elapsed_seconds || 0,

        // Context proiect dinamic
        context_proiect,

        // Informații specifice tip
        detalii_specifice: { test: true }
      };
    });

    console.log(`✅ [Live Pins API] - Processed: ${livePins.length} pins returned to frontend`);

    // Log detaliat pentru pin-uri procesate
    if (livePins.length > 0) {
      livePins.forEach((pin: any, index: number) => {
        console.log(`  [${index + 1}] ${pin.display_name} (user: ${pin.user_display}, pinned: ${pin.timp_pin_text})`);
      });
    }

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