// ==================================================================
// CALEA: app/api/rapoarte/sarcini/route.ts
// DATA: 24.08.2025 16:45 (ora României)
// MODIFICAT: Corectare data_scadenta cu formatDateLiteral() similar cu TimeTracking
// PĂSTRATE: Toate funcționalitățile existente + validări timp estimat
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

// Helper function pentru escape SQL - PĂSTRAT
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper pentru formatare DATE BigQuery - ADĂUGAT (preluat din TimeTracking)
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '' || dateString.trim() === '') {
    return 'NULL';
  }
  
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString.trim())) {
    return `DATE('${dateString.trim()}')`;
  }
  
  return 'NULL';
};

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
    
    console.log('POST sarcini - data primită:', JSON.stringify(data, null, 2));
    
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

    // Validări pentru timp estimat
    const zileEstimate = parseInt(data.timp_estimat_zile) || 0;
    const oreEstimate = parseFloat(data.timp_estimat_ore) || 0;

    // Validare că zilele sunt numere întregi
    if (!Number.isInteger(zileEstimate) || zileEstimate < 0) {
      return NextResponse.json({ 
        error: 'Zilele estimate trebuie să fie numere întregi pozitive (0, 1, 2, 3...)' 
      }, { status: 400 });
    }

    if (oreEstimate < 0 || oreEstimate >= 8) {
      return NextResponse.json({ 
        error: 'Orele estimate trebuie să fie între 0 și 7.9' 
      }, { status: 400 });
    }

    // Calculează timpul total în ore
    const timpTotalOre = (zileEstimate * 8) + oreEstimate;

    // MODIFICAT: Procesare data_scadenta cu formatDateLiteral() ca TimeTracking
    const dataScadentaLiteral = formatDateLiteral(data.data_scadenta);
    
    console.log('Data scadenta procesată:', {
      original: data.data_scadenta,
      literal: dataScadentaLiteral
    });

    // Inserare sarcină cu timp estimat - MODIFICAT să folosească literal pentru data_scadenta
    const sarcinaId = data.id || `TASK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const insertSarcinaQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
      (id, proiect_id, tip_proiect, titlu, descriere, prioritate, status, data_scadenta, observatii, 
       created_by, data_creare, updated_at, timp_estimat_zile, timp_estimat_ore, timp_estimat_total_ore)
      VALUES (
        '${escapeString(sarcinaId)}',
        '${escapeString(data.proiect_id)}',
        '${escapeString(data.tip_proiect || 'proiect')}',
        '${escapeString(data.titlu)}',
        ${data.descriere ? `'${escapeString(data.descriere)}'` : 'NULL'},
        '${escapeString(data.prioritate)}',
        '${escapeString(data.status)}',
        ${dataScadentaLiteral},
        ${data.observatii ? `'${escapeString(data.observatii)}'` : 'NULL'},
        '${escapeString(data.created_by)}',
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        ${zileEstimate},
        ${oreEstimate},
        ${timpTotalOre}
      )
    `;

    console.log('Insert sarcină query cu data_scadenta literal:', insertSarcinaQuery);

    await bigquery.query({
      query: insertSarcinaQuery,
      location: 'EU',
    });

    // Inserare responsabili - PĂSTRAT identic
    for (const responsabil of data.responsabili) {
      const insertResponsabilQuery = `
        INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\`
        (id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, data_atribuire, atribuit_de)
        VALUES (
          '${escapeString(`RESP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`)}',
          '${escapeString(sarcinaId)}',
          '${escapeString(responsabil.uid)}',
          '${escapeString(responsabil.nume_complet)}',
          '${escapeString(responsabil.rol)}',
          CURRENT_TIMESTAMP(),
          '${escapeString(data.created_by)}'
        )
      `;

      await bigquery.query({
        query: insertResponsabilQuery,
        location: 'EU',
      });
    }

    console.log(`Sarcină ${sarcinaId} creată cu succes cu data_scadenta: ${dataScadentaLiteral}`);

    return NextResponse.json({
      success: true,
      message: 'Sarcină creată cu succes',
      sarcina_id: sarcinaId,
      timp_total_ore: timpTotalOre,
      data_scadenta_salvata: dataScadentaLiteral
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
    
    console.log('PUT sarcini - data primită:', JSON.stringify(data, null, 2));
    
    if (!data.id) {
      return NextResponse.json({ 
        error: 'ID-ul sarcinii este obligatoriu pentru actualizare' 
      }, { status: 400 });
    }

    // Construiește query-ul de actualizare dinamic cu literal pentru data_scadenta
    const updateFields: string[] = [];

    if (data.titlu !== undefined) {
      updateFields.push(`titlu = '${escapeString(data.titlu)}'`);
    }

    if (data.descriere !== undefined) {
      updateFields.push(`descriere = ${data.descriere ? `'${escapeString(data.descriere)}'` : 'NULL'}`);
    }

    if (data.prioritate !== undefined) {
      updateFields.push(`prioritate = '${escapeString(data.prioritate)}'`);
    }

    if (data.status !== undefined) {
      updateFields.push(`status = '${escapeString(data.status)}'`);
      
      // Dacă statusul devine "Finalizată", setează data_finalizare
      if (data.status === 'Finalizată') {
        updateFields.push('data_finalizare = CURRENT_TIMESTAMP()');
      }
    }

    if (data.data_scadenta !== undefined) {
      // MODIFICAT: Folosește formatDateLiteral() pentru data_scadenta în PUT
      const dataScadentaLiteral = formatDateLiteral(data.data_scadenta);
      updateFields.push(`data_scadenta = ${dataScadentaLiteral}`);
      console.log('Update data_scadenta:', {
        original: data.data_scadenta,
        literal: dataScadentaLiteral
      });
    }

    if (data.observatii !== undefined) {
      updateFields.push(`observatii = ${data.observatii ? `'${escapeString(data.observatii)}'` : 'NULL'}`);
    }

    // Actualizare timp estimat
    if (data.timp_estimat_zile !== undefined || data.timp_estimat_ore !== undefined) {
      const zileEstimate = parseInt(data.timp_estimat_zile) || 0;
      const oreEstimate = parseFloat(data.timp_estimat_ore) || 0;

      // Validare că zilele sunt numere întregi
      if (!Number.isInteger(zileEstimate) || zileEstimate < 0) {
        return NextResponse.json({ 
          error: 'Zilele estimate trebuie să fie numere întregi pozitive (0, 1, 2, 3...)' 
        }, { status: 400 });
      }

      if (oreEstimate < 0 || oreEstimate >= 8) {
        return NextResponse.json({ 
          error: 'Orele estimate trebuie să fie între 0 și 7.9' 
        }, { status: 400 });
      }

      const timpTotalOre = (zileEstimate * 8) + oreEstimate;

      updateFields.push(`timp_estimat_zile = ${zileEstimate}`);
      updateFields.push(`timp_estimat_ore = ${oreEstimate}`);
      updateFields.push(`timp_estimat_total_ore = ${timpTotalOre}`);
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
      WHERE id = '${escapeString(data.id)}'
    `;

    console.log('Update sarcină query:', query);

    await bigquery.query({
      query: query,
      location: 'EU',
    });

    // Actualizează responsabilii dacă sunt specificați - PĂSTRAT identic
    if (data.responsabili && Array.isArray(data.responsabili)) {
      // Șterge responsabilii existenți
      const deleteResponsabiliQuery = `
        DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\`
        WHERE sarcina_id = '${escapeString(data.id)}'
      `;

      await bigquery.query({
        query: deleteResponsabiliQuery,
        location: 'EU',
      });

      // Inserează responsabilii noi
      for (const responsabil of data.responsabili) {
        const insertResponsabilQuery = `
          INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.SarciniResponsabili\`
          (id, sarcina_id, responsabil_uid, responsabil_nume, rol_in_sarcina, data_atribuire, atribuit_de)
          VALUES (
            '${escapeString(`RESP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`)}',
            '${escapeString(data.id)}',
            '${escapeString(responsabil.uid)}',
            '${escapeString(responsabil.nume_complet)}',
            '${escapeString(responsabil.rol)}',
            CURRENT_TIMESTAMP(),
            '${escapeString(data.updated_by || 'system')}'
          )
        `;

        await bigquery.query({
          query: insertResponsabilQuery,
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
      WHERE sarcina_id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteResponsabiliQuery,
      location: 'EU',
    });

    // Șterge înregistrările de timp (opțional - în funcție de business logic)
    const deleteTimeTrackingQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.TimeTracking\`
      WHERE sarcina_id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteTimeTrackingQuery,
      location: 'EU',
    });

    // Șterge sarcina
    const deleteSarcinaQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Sarcini\`
      WHERE id = '${escapeString(id)}'
    `;

    await bigquery.query({
      query: deleteSarcinaQuery,
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
