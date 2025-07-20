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

const dataset = 'PanouControlUnitar';
const table = 'Clienti';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Construire query cu filtre
    let query = `SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
    const conditions: string[] = ['activ = true']; // Doar clienții activi
    const params: any = {};

    // Filtre
    const search = searchParams.get('search');
    if (search) {
      conditions.push(`(
        LOWER(nume) LIKE LOWER(@search) OR 
        LOWER(cui) LIKE LOWER(@search) OR 
        LOWER(cnp) LIKE LOWER(@search) OR
        LOWER(email) LIKE LOWER(@search) OR
        LOWER(telefon) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
    }

    const tipClient = searchParams.get('tip_client');
    if (tipClient) {
      conditions.push('tip_client = @tipClient');
      params.tipClient = tipClient;
    }

    const sincronizat = searchParams.get('sincronizat');
    if (sincronizat !== null) {
      if (sincronizat === 'true') {
        conditions.push('sincronizat_factureaza = true');
      } else if (sincronizat === 'false') {
        conditions.push('(sincronizat_factureaza = false OR sincronizat_factureaza IS NULL)');
      }
    }

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare
    query += ' ORDER BY data_creare DESC';

    console.log('Executing clienti query:', query);
    console.log('With params:', params);

    const [rows] = await bigquery.query({
      query: query,
      params: params,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Eroare la încărcarea clienților:', error);
    return NextResponse.json({ 
      error: 'Eroare la încărcarea clienților',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nume,
      tip_client = 'persoana_juridica',
      cui,
      nr_reg_com,
      adresa,
      judet,
      oras,
      cod_postal,
      telefon,
      email,
      banca,
      iban,
      cnp,
      ci_serie,
      ci_numar,
      ci_eliberata_de,
      ci_eliberata_la,
      observatii
    } = body;

    // Validări
    if (!nume?.trim()) {
      return NextResponse.json({ 
        error: 'Numele clientului este obligatoriu' 
      }, { status: 400 });
    }

    if (tip_client === 'persoana_juridica' && !cui?.trim()) {
      return NextResponse.json({ 
        error: 'CUI-ul este obligatoriu pentru persoanele juridice' 
      }, { status: 400 });
    }

    if (tip_client === 'persoana_fizica' && !cnp?.trim()) {
      return NextResponse.json({ 
        error: 'CNP-ul este obligatoriu pentru persoanele fizice' 
      }, { status: 400 });
    }

    // Verifică dacă clientul există deja
    const checkQuery = `
      SELECT id FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      WHERE activ = true AND (
        nume = @nume 
        ${cui ? 'OR cui = @cui' : ''}
        ${cnp ? 'OR cnp = @cnp' : ''}
      )
      LIMIT 1
    `;

    const checkParams: any = { nume: nume.trim() };
    if (cui) checkParams.cui = cui.trim();
    if (cnp) checkParams.cnp = cnp.trim();

    const [existingRows] = await bigquery.query({
      query: checkQuery,
      params: checkParams,
      location: 'EU',
    });

    if (existingRows.length > 0) {
      return NextResponse.json({ 
        error: 'Un client cu aceste date există deja' 
      }, { status: 409 });
    }

    // Generează ID unic
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      (id, nume, tip_client, cui, nr_reg_com, adresa, judet, oras, cod_postal, tara,
       telefon, email, banca, iban, cnp, ci_serie, ci_numar, ci_eliberata_de, ci_eliberata_la,
       data_creare, data_actualizare, activ, sincronizat_factureaza, observatii)
      VALUES (@id, @nume, @tip_client, @cui, @nr_reg_com, @adresa, @judet, @oras, @cod_postal, @tara,
              @telefon, @email, @banca, @iban, @cnp, @ci_serie, @ci_numar, @ci_eliberata_de, @ci_eliberata_la,
              @data_creare, @data_actualizare, @activ, @sincronizat_factureaza, @observatii)
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: clientId,
        nume: nume.trim(),
        tip_client,
        cui: cui?.trim() || null,
        nr_reg_com: nr_reg_com?.trim() || null,
        adresa: adresa?.trim() || null,
        judet: judet?.trim() || null,
        oras: oras?.trim() || null,
        cod_postal: cod_postal?.trim() || null,
        tara: 'România',
        telefon: telefon?.trim() || null,
        email: email?.trim() || null,
        banca: banca?.trim() || null,
        iban: iban?.trim() || null,
        cnp: cnp?.trim() || null,
        ci_serie: ci_serie?.trim() || null,
        ci_numar: ci_numar?.trim() || null,
        ci_eliberata_de: ci_eliberata_de?.trim() || null,
        ci_eliberata_la: ci_eliberata_la || null,
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString(),
        activ: true,
        sincronizat_factureaza: false, // Implicit nu este sincronizat
        observatii: observatii?.trim() || null
      },
      location: 'EU',
      types: {
        id: 'STRING',
        nume: 'STRING',
        tip_client: 'STRING',
        cui: 'STRING',
        nr_reg_com: 'STRING',
        adresa: 'STRING',
        judet: 'STRING',
        oras: 'STRING',
        cod_postal: 'STRING',
        tara: 'STRING',
        telefon: 'STRING',
        email: 'STRING',
        banca: 'STRING',
        iban: 'STRING',
        cnp: 'STRING',
        ci_serie: 'STRING',
        ci_numar: 'STRING',
        ci_eliberata_de: 'STRING',
        ci_eliberata_la: 'DATE',
        data_creare: 'TIMESTAMP',
        data_actualizare: 'TIMESTAMP',
        activ: 'BOOLEAN',
        sincronizat_factureaza: 'BOOLEAN',
        observatii: 'STRING'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Client adăugat cu succes',
      clientId: clientId
    });

  } catch (error) {
    console.error('Eroare la adăugarea clientului:', error);
    return NextResponse.json({ 
      error: 'Eroare la adăugarea clientului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ 
        error: 'ID client necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id };

    // Câmpuri actualizabile
    const allowedFields = [
      'nume', 'tip_client', 'cui', 'nr_reg_com', 'adresa', 'judet', 'oras', 
      'cod_postal', 'telefon', 'email', 'banca', 'iban', 'cnp', 'ci_serie', 
      'ci_numar', 'ci_eliberata_de', 'ci_eliberata_la', 'observatii'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        error: 'Nu există câmpuri valide de actualizat' 
      }, { status: 400 });
    }

    // Adaugă data_actualizare
    updateFields.push('data_actualizare = @data_actualizare');
    params.data_actualizare = new Date().toISOString();

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE id = @id AND activ = true
    `;

    await bigquery.query({
      query: updateQuery,
      params: params,
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Client actualizat cu succes'
    });

  } catch (error) {
    console.error('Eroare la actualizarea clientului:', error);
    return NextResponse.json({ 
      error: 'Eroare la actualizarea clientului',
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
        error: 'ID client necesar pentru ștergere' 
      }, { status: 400 });
    }

    // Soft delete - marchează ca inactiv
    const deleteQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\`
      SET activ = false, data_actualizare = @data_actualizare
      WHERE id = @id
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { 
        id,
        data_actualizare: new Date().toISOString()
      },
      location: 'EU',
    });

    return NextResponse.json({
      success: true,
      message: 'Client șters cu succes'
    });

  } catch (error) {
    console.error('Eroare la ștergerea clientului:', error);
    return NextResponse.json({ 
      error: 'Eroare la ștergerea clientului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
