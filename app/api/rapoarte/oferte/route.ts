// ==================================================================
// CALEA: app/api/rapoarte/oferte/route.ts
// DATA: 04.04.2026
// DESCRIERE: CRUD API pentru oferte comerciale
// PATTERN: Identic cu contracte/route.ts - BigQuery + filtrare + paginare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_OFERTE = `\`${PROJECT_ID}.${DATASET}.Oferte${tableSuffix}\``;
const TABLE_ISTORIC = `\`${PROJECT_ID}.${DATASET}.OferteIstoricStatus${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const escapeString = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
};

const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === 'undefined' || dateString === '') {
    return 'NULL';
  }
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return `DATE('${date.toISOString().split('T')[0]}')`;
    }
  } catch { /* ignore */ }
  return 'NULL';
};

const escapeValue = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${escapeString(String(val))}'`;
};

const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return parseFloat(value.value);
  }
  if (typeof value === 'string') return parseFloat(value);
  return parseFloat(value);
};

// ============================================
// GET - Lista oferte cu filtre + KPI
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const tip_oferta = searchParams.get('tip_oferta') || '';
    const client = searchParams.get('client') || '';
    const data_start = searchParams.get('data_start') || '';
    const data_end = searchParams.get('data_end') || '';
    const valoare_min = searchParams.get('valoare_min') || '';
    const valoare_max = searchParams.get('valoare_max') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '50');
    const id = searchParams.get('id') || '';

    // Dacă se cere o ofertă specifică
    if (id) {
      const [rows] = await bigquery.query({
        query: `SELECT * FROM ${TABLE_OFERTE} WHERE id = @id AND activ = true`,
        params: { id },
        location: 'EU',
      });
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Oferta nu a fost gasita' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: rows[0] });
    }

    // Construim WHERE clause
    const conditions = ['o.activ = true'];

    if (search) {
      conditions.push(`(
        LOWER(o.numar_oferta) LIKE LOWER('%${escapeString(search)}%')
        OR LOWER(o.client_nume) LIKE LOWER('%${escapeString(search)}%')
        OR LOWER(o.proiect_denumire) LIKE LOWER('%${escapeString(search)}%')
        OR LOWER(o.client_email) LIKE LOWER('%${escapeString(search)}%')
      )`);
    }

    if (status) {
      conditions.push(`o.status = '${escapeString(status)}'`);
    }

    if (tip_oferta) {
      conditions.push(`o.tip_oferta = '${escapeString(tip_oferta)}'`);
    }

    if (client) {
      conditions.push(`LOWER(o.client_nume) LIKE LOWER('%${escapeString(client)}%')`);
    }

    if (data_start) {
      conditions.push(`o.data_oferta >= ${formatDateLiteral(data_start)}`);
    }

    if (data_end) {
      conditions.push(`o.data_oferta <= ${formatDateLiteral(data_end)}`);
    }

    if (valoare_min) {
      conditions.push(`o.valoare >= ${parseFloat(valoare_min)}`);
    }

    if (valoare_max) {
      conditions.push(`o.valoare <= ${parseFloat(valoare_max)}`);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * per_page;

    // Query principal cu paginare
    const dataQuery = `
      SELECT o.*,
        p.Denumire as proiect_legat_denumire,
        p.Status as proiect_legat_status
      FROM ${TABLE_OFERTE} o
      LEFT JOIN ${TABLE_PROIECTE} p ON o.proiect_id_legat = p.ID_Proiect AND p.Status != 'Sters'
      WHERE ${whereClause}
      ORDER BY o.data_creare DESC
      LIMIT ${per_page}
      OFFSET ${offset}
    `;

    // Query KPI
    const kpiQuery = `
      SELECT
        COUNT(*) as total,
        COUNTIF(status = 'Acceptata') as acceptate,
        COUNTIF(status = 'Refuzata') as refuzate,
        COUNTIF(status IN ('Draft', 'Trimisa', 'Negociere')) as in_asteptare,
        COUNTIF(status = 'Trimisa') as trimise,
        COUNTIF(status = 'Expirata') as expirate,
        AVG(CASE WHEN valoare > 0 THEN valoare ELSE NULL END) as valoare_medie,
        SUM(CASE WHEN status = 'Acceptata' THEN valoare_ron ELSE 0 END) as valoare_totala_acceptate,
        SUM(CASE WHEN status IN ('Draft', 'Trimisa', 'Negociere') THEN valoare_ron ELSE 0 END) as valoare_pipeline
      FROM ${TABLE_OFERTE} o
      WHERE ${whereClause}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_OFERTE} o
      WHERE ${whereClause}
    `;

    const [dataRows, kpiRows, countRows] = await Promise.all([
      bigquery.query({ query: dataQuery, location: 'EU' }),
      bigquery.query({ query: kpiQuery, location: 'EU' }),
      bigquery.query({ query: countQuery, location: 'EU' }),
    ]);

    const total = convertBigQueryNumeric(countRows[0]?.[0]?.total) || 0;
    const kpi = kpiRows[0]?.[0] || {};

    return NextResponse.json({
      success: true,
      data: dataRows[0] || [],
      pagination: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
      kpi: {
        total: convertBigQueryNumeric(kpi.total),
        acceptate: convertBigQueryNumeric(kpi.acceptate),
        refuzate: convertBigQueryNumeric(kpi.refuzate),
        in_asteptare: convertBigQueryNumeric(kpi.in_asteptare),
        trimise: convertBigQueryNumeric(kpi.trimise),
        expirate: convertBigQueryNumeric(kpi.expirate),
        valoare_medie: convertBigQueryNumeric(kpi.valoare_medie),
        valoare_totala_acceptate: convertBigQueryNumeric(kpi.valoare_totala_acceptate),
        valoare_pipeline: convertBigQueryNumeric(kpi.valoare_pipeline),
        rata_conversie: convertBigQueryNumeric(kpi.total) > 0
          ? Math.round((convertBigQueryNumeric(kpi.acceptate) / (convertBigQueryNumeric(kpi.total) - convertBigQueryNumeric(kpiRows[0]?.[0]?.in_asteptare || 0) || 1)) * 100)
          : 0,
      }
    });

  } catch (error) {
    console.error('Eroare GET oferte:', error);
    return NextResponse.json({
      error: 'Eroare la incarcarea ofertelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

// ============================================
// POST - Creare oferta noua
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      client_id, client_nume, client_email, client_telefon, client_cui, client_adresa,
      tip_oferta, proiect_denumire, proiect_descriere, proiect_adresa,
      valoare, moneda, curs_valutar, valoare_ron,
      data_expirare, observatii, note_interne, termen_executie,
      creat_de, creat_de_nume
    } = body;

    if (!client_nume?.trim()) {
      return NextResponse.json({ error: 'Numele clientului este obligatoriu' }, { status: 400 });
    }
    if (!proiect_denumire?.trim()) {
      return NextResponse.json({ error: 'Denumirea proiectului/ofertei este obligatorie' }, { status: 400 });
    }
    if (!valoare || valoare <= 0) {
      return NextResponse.json({ error: 'Valoarea ofertei este obligatorie' }, { status: 400 });
    }

    // Generare numar oferta automat
    const year = new Date().getFullYear();
    const [maxRows] = await bigquery.query({
      query: `
        SELECT MAX(CAST(REGEXP_EXTRACT(numar_oferta, r'OF-\\d{4}-(\\d+)') AS INT64)) as max_num
        FROM ${TABLE_OFERTE}
        WHERE serie_oferta = 'OF'
          AND EXTRACT(YEAR FROM data_creare) = ${year}
      `,
      location: 'EU',
    });

    const maxNum = convertBigQueryNumeric(maxRows[0]?.max_num) || 0;
    const nextNum = maxNum + 1;
    const numar_oferta = `OF-${year}-${String(nextNum).padStart(4, '0')}`;

    const id = `oferta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const dataOferta = now.split('T')[0];

    // Calculare data expirare default (30 zile)
    let dataExpirareCalc = data_expirare || '';
    if (!dataExpirareCalc) {
      const exp = new Date();
      exp.setDate(exp.getDate() + 30);
      dataExpirareCalc = exp.toISOString().split('T')[0];
    }

    const insertQuery = `
      INSERT INTO ${TABLE_OFERTE}
      (id, numar_oferta, serie_oferta, tip_oferta, client_id, client_nume, client_email, client_telefon, client_cui, client_adresa,
       proiect_denumire, proiect_descriere, proiect_adresa, valoare, moneda, curs_valutar, valoare_ron,
       status, data_oferta, data_expirare, observatii, note_interne, termen_executie,
       creat_de, creat_de_nume, data_creare, data_actualizare, activ)
      VALUES
      (${escapeValue(id)}, ${escapeValue(numar_oferta)}, 'OF', ${escapeValue(tip_oferta || null)},
       ${escapeValue(client_id || null)}, ${escapeValue(client_nume.trim())}, ${escapeValue(client_email || null)},
       ${escapeValue(client_telefon || null)}, ${escapeValue(client_cui || null)}, ${escapeValue(client_adresa || null)},
       ${escapeValue(proiect_denumire.trim())}, ${escapeValue(proiect_descriere || null)}, ${escapeValue(proiect_adresa || null)},
       ${valoare || 0}, ${escapeValue(moneda || 'EUR')}, ${curs_valutar || 'NULL'}, ${valoare_ron || 'NULL'},
       'Draft', ${formatDateLiteral(dataOferta)}, ${formatDateLiteral(dataExpirareCalc)},
       ${escapeValue(observatii || null)}, ${escapeValue(note_interne || null)}, ${escapeValue(termen_executie || null)},
       ${escapeValue(creat_de || null)}, ${escapeValue(creat_de_nume || null)},
       TIMESTAMP('${now}'), TIMESTAMP('${now}'), true)
    `;

    await bigquery.query({ query: insertQuery, location: 'EU' });

    // Salvare in istoric status
    const istoricId = `ist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const istoricQuery = `
      INSERT INTO ${TABLE_ISTORIC}
      (id, oferta_id, status_vechi, status_nou, schimbat_de, schimbat_de_nume, observatii, data_schimbare)
      VALUES
      (${escapeValue(istoricId)}, ${escapeValue(id)}, NULL, 'Draft',
       ${escapeValue(creat_de || null)}, ${escapeValue(creat_de_nume || null)},
       'Oferta creata', TIMESTAMP('${now}'))
    `;

    await bigquery.query({ query: istoricQuery, location: 'EU' });

    return NextResponse.json({
      success: true,
      data: {
        id,
        numar_oferta,
        status: 'Draft',
        data_oferta: dataOferta,
        data_expirare: dataExpirareCalc,
      },
      message: `Oferta ${numar_oferta} creata cu succes`
    });

  } catch (error) {
    console.error('Eroare POST oferta:', error);
    return NextResponse.json({
      error: 'Eroare la crearea ofertei',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

// ============================================
// PUT - Actualizare oferta
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID-ul ofertei este obligatoriu' }, { status: 400 });
    }

    const updates: string[] = [];
    const now = new Date().toISOString();

    const fieldMap: Record<string, string> = {
      client_id: 'client_id',
      client_nume: 'client_nume',
      client_email: 'client_email',
      client_telefon: 'client_telefon',
      client_cui: 'client_cui',
      client_adresa: 'client_adresa',
      tip_oferta: 'tip_oferta',
      proiect_denumire: 'proiect_denumire',
      proiect_descriere: 'proiect_descriere',
      proiect_adresa: 'proiect_adresa',
      observatii: 'observatii',
      note_interne: 'note_interne',
      termen_executie: 'termen_executie',
      sablon_folosit: 'sablon_folosit',
      path_fisier: 'path_fisier',
      proiect_id_legat: 'proiect_id_legat',
      motiv_refuz: 'motiv_refuz',
    };

    for (const [bodyKey, dbColumn] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        updates.push(`${dbColumn} = ${escapeValue(body[bodyKey])}`);
      }
    }

    // Campuri numerice
    if (body.valoare !== undefined) {
      updates.push(`valoare = ${body.valoare || 0}`);
    }
    if (body.curs_valutar !== undefined) {
      updates.push(`curs_valutar = ${body.curs_valutar || 'NULL'}`);
    }
    if (body.valoare_ron !== undefined) {
      updates.push(`valoare_ron = ${body.valoare_ron || 'NULL'}`);
    }

    // Campuri string cu valori speciale
    if (body.moneda !== undefined) {
      updates.push(`moneda = ${escapeValue(body.moneda)}`);
    }

    // Campuri DATE
    if (body.data_expirare !== undefined) {
      updates.push(`data_expirare = ${formatDateLiteral(body.data_expirare)}`);
    }
    if (body.data_oferta !== undefined) {
      updates.push(`data_oferta = ${formatDateLiteral(body.data_oferta)}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nu exista campuri de actualizat' }, { status: 400 });
    }

    updates.push(`data_actualizare = TIMESTAMP('${now}')`);

    const updateQuery = `
      UPDATE ${TABLE_OFERTE}
      SET ${updates.join(', ')}
      WHERE id = '${escapeString(id)}' AND activ = true
    `;

    await bigquery.query({ query: updateQuery, location: 'EU' });

    return NextResponse.json({
      success: true,
      message: 'Oferta actualizata cu succes'
    });

  } catch (error) {
    console.error('Eroare PUT oferta:', error);
    return NextResponse.json({
      error: 'Eroare la actualizarea ofertei',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}

// ============================================
// DELETE - Stergere soft oferta
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID-ul ofertei este obligatoriu' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const deleteQuery = `
      UPDATE ${TABLE_OFERTE}
      SET activ = false, data_actualizare = TIMESTAMP('${now}')
      WHERE id = '${escapeString(id)}' AND activ = true
    `;

    await bigquery.query({ query: deleteQuery, location: 'EU' });

    return NextResponse.json({
      success: true,
      message: 'Oferta stearsa cu succes'
    });

  } catch (error) {
    console.error('Eroare DELETE oferta:', error);
    return NextResponse.json({
      error: 'Eroare la stergerea ofertei',
      details: error instanceof Error ? error.message : 'Eroare necunoscuta'
    }, { status: 500 });
  }
}
