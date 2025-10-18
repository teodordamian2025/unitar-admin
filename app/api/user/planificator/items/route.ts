// ==================================================================
// CALEA: app/api/user/planificator/items/route.ts
// DATA: 18.10.2025 (ora României) - FIXED: BigQuery v2 tables suffix
// DESCRIERE: API planificator pentru utilizatori normali cu restricții financiare
// FUNCȚIONALITATE: CRUD items planificator cu filtrare per utilizator și fără date financiare
// FIX: Adăugat ${tableSuffix} la toate tabelele (Proiecte, Subproiecte, Sarcini)
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

console.log(`🔧 [Items] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Decodează token-ul Firebase și obține UID-ul real al utilizatorului
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    // Query identic cu admin dar restricționat la utilizatorul curent
    const query = `
      SELECT
        p.id,
        p.utilizator_uid,
        p.tip_item,
        p.item_id,
        p.ordine_pozitie,
        p.comentariu_personal,
        p.is_pinned,
        p.data_actualizare,
        -- Date proiecte (fără informații financiare)
        pr.Denumire as proiect_denumire,
        pr.Data_Start as proiect_data_start,
        pr.Data_Final as proiect_data_final,
        pr.Status as proiect_status,
        pr.Responsabil as proiect_responsabil,
        -- Date subproiecte (fără informații financiare)
        sp.Denumire as subproiect_denumire,
        sp.Data_Start as subproiect_data_start,
        sp.Data_Final as subproiect_data_final,
        sp.Status as subproiect_status,
        sp.Responsabil as subproiect_responsabil,
        pr2.ID_Proiect as subproiect_proiect_id,
        pr2.Denumire as subproiect_proiect_nume,
        -- Date sarcini (fără informații financiare/rate)
        s.titlu as sarcina_titlu,
        s.descriere as sarcina_descriere,
        s.prioritate as sarcina_prioritate,
        s.status as sarcina_status,
        s.data_scadenta as sarcina_data_scadenta,
        s.progres_procent as sarcina_progres,
        s.tip_proiect as sarcina_tip_proiect,
        s.proiect_id as sarcina_proiect_id,
        -- Pentru sarcini de proiect direct
        pr3.ID_Proiect as sarcina_proiect_direct_id,
        pr3.Denumire as sarcina_proiect_nume,
        -- Pentru sarcini de subproiect
        s_sp.Denumire as sarcina_subproiect_nume,
        s_sp_pr.ID_Proiect as sarcina_proiect_parinte_id,
        s_sp_pr.Denumire as sarcina_proiect_parinte_nume,
        -- Calculare urgență pentru sortare automată
        CASE
          WHEN p.tip_item = 'sarcina' AND s.data_scadenta IS NOT NULL THEN
            DATE_DIFF(s.data_scadenta, CURRENT_DATE(), DAY)
          WHEN p.tip_item = 'subproiect' AND sp.Data_Final IS NOT NULL THEN
            DATE_DIFF(sp.Data_Final, CURRENT_DATE(), DAY)
          WHEN p.tip_item = 'proiect' AND pr.Data_Final IS NOT NULL THEN
            DATE_DIFF(pr.Data_Final, CURRENT_DATE(), DAY)
          ELSE 999
        END as zile_pana_scadenta

      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\` p

      -- Join proiecte direct
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\` pr
        ON p.tip_item = 'proiect' AND p.item_id = pr.ID_Proiect

      -- Join subproiecte
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\` sp
        ON p.tip_item = 'subproiect' AND p.item_id = sp.ID_Subproiect
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\` pr2
        ON sp.ID_Proiect = pr2.ID_Proiect

      -- Join sarcini
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Sarcini${tableSuffix}\` s
        ON p.tip_item = 'sarcina' AND p.item_id = s.id

      -- Join pentru sarcini de proiect direct
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\` pr3
        ON s.tip_proiect = 'proiect' AND s.proiect_id = pr3.ID_Proiect

      -- Join pentru sarcini de subproiect: găsește subproiectul și proiectul părinte
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\` s_sp
        ON s.tip_proiect = 'subproiect' AND s.proiect_id = s_sp.ID_Subproiect
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\` s_sp_pr
        ON s_sp.ID_Proiect = s_sp_pr.ID_Proiect

      WHERE p.utilizator_uid = @userId AND p.activ = TRUE
      ORDER BY p.ordine_pozitie ASC
    `;

    const options = {
      query,
      params: { userId },
    };

    const [rows] = await bigquery.query(options);

    // Transformare rezultate pentru frontend - identică cu admin dar fără date financiare
    const items = rows.map((row: any) => {
      let display_name = '';
      let data_scadenta = null;
      let comentariu_original = '';

      if (row.tip_item === 'proiect') {
        display_name = `📁 ${row.item_id} - ${row.proiect_denumire}`;
        data_scadenta = row.proiect_data_final?.value || row.proiect_data_final;
      } else if (row.tip_item === 'subproiect') {
        // Subproiect: ID_Proiect părinte + Denumire subproiect (ca la analytics/live)
        display_name = `📂 ${row.subproiect_proiect_id} - ${row.subproiect_denumire}`;
        data_scadenta = row.subproiect_data_final?.value || row.subproiect_data_final;
      } else if (row.tip_item === 'sarcina') {
        // Logic uniformă pentru sarcini ca la analytics/live (IDENTIC cu Admin Live)
        if (row.sarcina_tip_proiect === 'subproiect' && row.sarcina_proiect_parinte_id) {
          // Sarcină de subproiect: Proiect părinte + Denumire subproiect + Titlu sarcină
          display_name = `✅ ${row.sarcina_proiect_parinte_id} - ${row.sarcina_subproiect_nume} - ${row.sarcina_titlu}`;
        } else if (row.sarcina_proiect_nume) {
          // Sarcină de proiect direct: proiect_id - titlu_sarcina (FĂRĂ descriere, ca la Admin Live)
          // Folosește s.proiect_id din query (returnat prin JOIN cu Proiecte pr3 la linia 110-111)
          const proiectId = row.sarcina_proiect_id || row.item_id;
          display_name = `✅ ${proiectId} - ${row.sarcina_titlu}`;
        } else {
          // Fallback pentru cazuri fără proiect asociat
          display_name = `✅ ${row.sarcina_titlu} (Proiect necunoscut)`;
        }
        data_scadenta = row.sarcina_data_scadenta?.value || row.sarcina_data_scadenta;
        comentariu_original = row.sarcina_descriere;
      }

      // Calculare urgență
      const zile = row.zile_pana_scadenta || 999;
      let urgenta = 'scazuta';
      if (zile <= 0) urgenta = 'critica';
      else if (zile <= 3) urgenta = 'ridicata';
      else if (zile <= 7) urgenta = 'medie';

      // Detectare marker realizat în comentariu
      const comentariuComplet = row.comentariu_personal || '';
      const realizatMarker = '[REALIZAT]';
      const is_realizat = comentariuComplet.includes(realizatMarker);
      const comentariu_curat = comentariuComplet.replace(realizatMarker, '').trim();

      return {
        id: row.id,
        utilizator_uid: row.utilizator_uid,
        tip_item: row.tip_item,
        item_id: row.item_id,
        ordine_pozitie: row.ordine_pozitie,
        comentariu_personal: comentariu_curat,
        is_pinned: row.is_pinned,
        is_realizat,
        display_name,
        data_scadenta,
        zile_pana_scadenta: zile,
        urgenta,
        comentariu_original
      };
    });

    return NextResponse.json({ items });

  } catch (error) {
    console.error('Error loading user planificator items:', error);
    return NextResponse.json(
      { error: 'Failed to load planificator items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Decodează token-ul Firebase și obține UID-ul real al utilizatorului
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const body = await request.json();
    const { tip_item, item_id, ordine_pozitie } = body;

    // Validare input
    if (!tip_item || !item_id || ordine_pozitie === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: tip_item, item_id, ordine_pozitie' },
        { status: 400 }
      );
    }

    if (!['proiect', 'subproiect', 'sarcina'].includes(tip_item)) {
      return NextResponse.json(
        { error: 'Invalid tip_item. Must be: proiect, subproiect, sarcina' },
        { status: 400 }
      );
    }

    // Verifică dacă item-ul nu este deja în planificator pentru acest utilizator
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      WHERE utilizator_uid = @userId
        AND tip_item = @tip_item
        AND item_id = @item_id
        AND activ = TRUE
    `;

    const [checkRows] = await bigquery.query({
      query: checkQuery,
      params: { userId, tip_item, item_id }
    });

    if (checkRows[0].count > 0) {
      return NextResponse.json(
        { error: 'Item already exists in planificator' },
        { status: 409 }
      );
    }

    // Generare ID unic
    const itemId = `user_planner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert în BigQuery - doar pentru utilizatorul curent
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.PlanificatorPersonal${tableSuffix}\`
      (id, utilizator_uid, tip_item, item_id, ordine_pozitie, is_pinned, activ, data_adaugare, data_actualizare)
      VALUES (@id, @userId, @tip_item, @item_id, @ordine_pozitie, FALSE, TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: itemId,
        userId,
        tip_item,
        item_id,
        ordine_pozitie
      }
    });

    return NextResponse.json({
      success: true,
      id: itemId,
      message: 'Item added to planificator successfully'
    });

  } catch (error) {
    console.error('Error adding item to user planificator:', error);
    return NextResponse.json(
      { error: 'Failed to add item to planificator' },
      { status: 500 }
    );
  }
}