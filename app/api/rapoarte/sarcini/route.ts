// ==================================================================
// CALEA: app/api/rapoarte/sarcini/route.ts
// DATA: 21.08.2025 02:05 (ora României)
// MODIFICAT: Adăugat timp estimat (zile + ore) cu conversie automată
// PĂSTRATE: Toate funcționalitățile existente
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proiect_id = searchParams.get('proiect_id');
    const tip_proiect = searchParams.get('tip_proiect');
    const status = searchParams.get('status');
    const responsabil_uid = searchParams.get('responsabil_uid');

    // Query principal pentru sarcini cu responsabili și timp lucrat
    let query = `
      SELECT 
        s.id,
        s.proiect_id,
        s.tip_proiect,
        s.titlu,
        s.descriere,
        s.prioritate,
        s.status,
        s.data_creare,
        s.data_scadenta,
        s.data_finalizare,
        s.observatii,
        s.created_by,
        s.updated_at,
        s.timp_estimat_zile,
        s.timp_estimat_ore,
        s.timp_estimat_total_ore,
        COALESCE(SUM(t.ore_lucrate), 0) as total_ore_lucrate
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\` s
      LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.TimeTracking\` t 
        ON s.id = t.sarcina_id
      WHERE 1=1
    `;

    const params: any = {};

    // Filtrare după proiect
    if (proiect_id) {
      query += ` AND s.proiect_id = @proiect_id`;
      params.proiect_id = proiect_id;
    }

    // Filtrare după tip proiect
    if (tip_proiect) {
      query += ` AND s.tip_proiect = @tip_proiect`;
      params.tip_proiect = tip_proiect;
    }

    // Filtrare după status
    if (status) {
      query += ` AND s.status = @status`;
      params.status = status;
    }

    query += `
      GROUP BY s.id, s.proiect_id, s.tip_proiect, s.titlu, s.descriere, s.prioritate, 
               s.status, s.data_creare, s.data_scadenta, s.data_finalizare, s.observatii, 
               s.created_by, s.updated_at, s.timp_estimat_zile, s.timp_estimat_ore, s.timp_estimat_total_ore
      ORDER BY s.data_creare DESC
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      location: 'EU',
    });

    // Query separat pentru responsabili
    const responsabiliQuery = `
      SELECT 
        sr.sarcina_id,
        sr.responsabil_uid,
        sr.responsabil_nume,
        sr.rol_in_sarcina,
        sr.data_atribuire,
        sr.atribuit_de
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\` sr
      ${rows.length > 0 ? `WHERE sr.sarcina_id IN (${rows.map(r => `'${r.id}'`).join(',')})` : 'WHERE 1=0'}
      ORDER BY sr.data_atribuire ASC
    `;

    const [responsabiliRows] = await bigquery.query({
      query: responsabiliQuery,
      location: 'EU',
    });

    // Grupare responsabili pe sarcini
    const responsabiliMap = new Map();
    responsabiliRows.forEach(resp => {
      if (!responsabiliMap.has(resp.sarcina_id)) {
        responsabiliMap.set(resp.sarcina_id, []);
      }
      responsabiliMap.get(resp.sarcina_id).push({
        responsabil_uid: resp.responsabil_uid,
        responsabil_nume: resp.responsabil_nume,
        rol_in_sarcina: resp.rol_in_sarcina,
        data_atribuire: resp.data_atribuire,
        atribuit_de: resp.atribuit_de
      });
    });

    // Combină datele
    const sarciniComplete = rows.map(sarcina => ({
      ...sarcina,
      responsabili: responsabiliMap.get(sarcina.id) || []
    }));

    // Filtrare după responsabil dacă este specificat
    let sarciniFinale = sarciniComplete;
    if (responsabil_uid) {
      sarciniFinale = sarciniComplete.filter(sarcina => 
        sarcina.responsabili.some(r => r.responsabil_uid === responsabil_uid)
      );
    }

    return NextResponse.json({
      success: true,
      data: sarciniFinale
    });

  } catch (error) {
    console.error('Eroare la extragerea sarcinilor:', error);
    return NextResponse.json({ 
      error: 'Eroare la extragerea sarcinilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validări de bază
    if (!data.proiect_id || !data.titlu || !data.prioritate || !data.status) {
      return NextResponse.json({ 
        error: 'Câmpurile proiect_id, titlu, prioritate și status sunt obligatorii' 
      }, { status: 400 });
    }

    if (!data.responsabili || data.responsabili.length === 0) {
      return NextResponse.json({ 
        error: 'Cel puțin un responsabil este obligatoriu' 
      }, { status: 400 });
    }

    // ADĂUGAT: Validări pentru timp estimat
    const zileEstimate = parseInt(data.timp_estimat_zile) || 0;
    const oreEstimate = parseFloat(data.timp_estimat_ore) || 0;

    if (zileEstimate < 0) {
      return NextResponse.json({ 
        error: 'Zilele estimate nu pot fi negative' 
      }, { status: 400 });
    }

    if (oreEstimate < 0 || oreEstimate >= 8) {
      return NextResponse.json({ 
        error: 'Orele estimate trebuie să fie între 0 și 7.9' 
      }, { status: 400 });
    }

    // ADĂUGAT: Calculează timpul total în ore
    const timpTotalOre = (zileEstimate * 8) + oreEstimate;

    // Inserare sarcină cu timp estimat
    const sarcinaId = data.id || `TASK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
	const insertSarcinaQuery = `
	  INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
	  (id, proiect_id, tip_proiect, titlu, descriere, prioritate, status, data_scadenta, observatii, 
	   created_by, data_creare, updated_at, timp_estimat_zile, timp_estimat_ore, timp_estimat_total_ore)
	  VALUES (@id, @proiect_id, @tip_proiect, @titlu, @descriere, @prioritate, @status, @data_scadenta, @observatii, 
		  @created_by, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), @timp_estimat_zile, @timp_estimat_ore, @timp_estimat_total_ore)
	`;

	await bigquery.query({
	  query: insertSarcinaQuery,
	  params: {
	    id: sarcinaId,
	    proiect_id: data.proiect_id,
	    tip_proiect: data.tip_proiect || 'proiect',
	    titlu: data.titlu,
	    descriere: data.descriere || null,
	    prioritate: data.prioritate,
	    status: data.status,
	    data_scadenta: data.data_scadenta || null,
	    observatii: data.observatii || null,
	    created_by: data.created_by,
	    timp_estimat_zile: zileEstimate,
	    timp_estimat_ore: oreEstimate,
	    timp_estimat_total_ore: timpTotalOre
	  },
	  types: {
	    descriere: data.descriere ? 'STRING' : 'STRING',
	    data_scadenta: data.data_scadenta ? 'DATE' : 'DATE',
	    observatii: data.observatii ? 'STRING' : 'STRING'
	  },
	  location: 'EU',
	});

    // Inserare responsabili
    for (const responsabil of data.responsabili) {
      const insertResponsabilQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\`
        (id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, data_atribuire, atribuit_de)
        VALUES (@id, @sarcina_id, @responsabil_uid, @responsabil_nume, @rol_in_sarcina, CURRENT_TIMESTAMP(), @atribuit_de)
      `;

      await bigquery.query({
        query: insertResponsabilQuery,
        params: {
          id: `RESP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          sarcina_id: sarcinaId,
          responsabil_uid: responsabil.uid,
          responsabil_nume: responsabil.nume_complet,
          rol_in_sarcina: responsabil.rol,
          atribuit_de: data.created_by
        },
        location: 'EU',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Sarcină creată cu succes',
      sarcina_id: sarcinaId,
      timp_total_ore: timpTotalOre
    });

  } catch (error) {
    console.error('Eroare la crearea sarcinii:', error);
    return NextResponse.json({ 
      error: 'Eroare la crearea sarcinii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ 
        error: 'ID-ul sarcinii este obligatoriu pentru actualizare' 
      }, { status: 400 });
    }

// Construiește query-ul de actualizare dinamic
    const updateFields: string[] = [];
    const params: any = { id: data.id };

    if (data.titlu !== undefined) {
      updateFields.push('titlu = @titlu');
      params.titlu = data.titlu;
    }

    if (data.descriere !== undefined) {
      updateFields.push('descriere = @descriere');
      params.descriere = data.descriere;
    }

    if (data.prioritate !== undefined) {
      updateFields.push('prioritate = @prioritate');
      params.prioritate = data.prioritate;
    }

    if (data.status !== undefined) {
      updateFields.push('status = @status');
      params.status = data.status;
      
      // Dacă statusul devine "Finalizată", setează data_finalizare
      if (data.status === 'Finalizată') {
        updateFields.push('data_finalizare = CURRENT_TIMESTAMP()');
      }
    }

    if (data.data_scadenta !== undefined) {
      updateFields.push('data_scadenta = @data_scadenta');
      params.data_scadenta = data.data_scadenta;
    }

    if (data.observatii !== undefined) {
      updateFields.push('observatii = @observatii');
      params.observatii = data.observatii;
    }

    // ADĂUGAT: Actualizare timp estimat
    if (data.timp_estimat_zile !== undefined || data.timp_estimat_ore !== undefined) {
      const zileEstimate = parseInt(data.timp_estimat_zile) || 0;
      const oreEstimate = parseFloat(data.timp_estimat_ore) || 0;

      if (zileEstimate < 0 || oreEstimate < 0 || oreEstimate >= 8) {
        return NextResponse.json({ 
          error: 'Timp estimat invalid: zile >= 0, ore între 0-7.9' 
        }, { status: 400 });
      }

      const timpTotalOre = (zileEstimate * 8) + oreEstimate;

      updateFields.push('timp_estimat_zile = @timp_estimat_zile');
      updateFields.push('timp_estimat_ore = @timp_estimat_ore');
      updateFields.push('timp_estimat_total_ore = @timp_estimat_total_ore');
      
      params.timp_estimat_zile = zileEstimate;
      params.timp_estimat_ore = oreEstimate;
      params.timp_estimat_total_ore = timpTotalOre;
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        error: 'Nu există câmpuri pentru actualizare' 
      }, { status: 400 });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP()');

    const query = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
      SET ${updateFields.join(', ')}
      WHERE id = @id
    `;

    await bigquery.query({
      query: query,
      params: params,
      location: 'EU',
    });

    // Actualizează responsabilii dacă sunt specificați
    if (data.responsabili && Array.isArray(data.responsabili)) {
      // Șterge responsabilii existenți
      const deleteResponsabiliQuery = `
        DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\`
        WHERE sarcina_id = @sarcina_id
      `;

      await bigquery.query({
        query: deleteResponsabiliQuery,
        params: { sarcina_id: data.id },
        location: 'EU',
      });

      // Inserează responsabilii noi
      for (const responsabil of data.responsabili) {
        const insertResponsabilQuery = `
          INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\`
          (id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, data_atribuire, atribuit_de)
          VALUES (@id, @sarcina_id, @responsabil_uid, @responsabil_nume, @rol_in_sarcina, CURRENT_TIMESTAMP(), @atribuit_de)
        `;

        await bigquery.query({
          query: insertResponsabilQuery,
          params: {
            id: `RESP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            sarcina_id: data.id,
            responsabil_uid: responsabil.uid,
            responsabil_nume: responsabil.nume_complet,
            rol_in_sarcina: responsabil.rol,
            atribuit_de: data.updated_by || 'system'
          },
          location: 'EU',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sarcină actualizată cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea sarcinii:', error);
    return NextResponse.json({ 
      error: 'Eroare la actualizarea sarcinii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: 'ID-ul sarcinii este obligatoriu pentru ștergere' 
      }, { status: 400 });
    }

    // Șterge responsabilii sarcinii
    const deleteResponsabiliQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\`
      WHERE sarcina_id = @sarcina_id
    `;

    await bigquery.query({
      query: deleteResponsabiliQuery,
      params: { sarcina_id: id },
      location: 'EU',
    });

    // Șterge înregistrările de timp (opțional - în funcție de business logic)
    const deleteTimeTrackingQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.TimeTracking\`
      WHERE sarcina_id = @sarcina_id
    `;

    await bigquery.query({
      query: deleteTimeTrackingQuery,
      params: { sarcina_id: id },
      location: 'EU',
    });

    // Șterge sarcina
    const deleteSarcinaQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteSarcinaQuery,
      params: { id },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Sarcină ștearsă cu succes (împreună cu responsabilii și time tracking-ul asociat)'
    });

  } catch (error) {
    console.error('Eroare la ștergerea sarcinii:', error);
    return NextResponse.json({ 
      error: 'Eroare la ștergerea sarcinii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
