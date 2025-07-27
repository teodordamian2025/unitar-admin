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

    // ✅ ELIMINAT: Filtrul sincronizat_factureaza nu mai este necesar

    // Adaugă condiții la query
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare - ordinea alfabetică în loc de data_creare (care poate fi problematică)
    query += ' ORDER BY nume ASC';

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
      tip_client = 'Juridic',
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

    if ((tip_client === 'Juridic' || tip_client === 'Juridic_TVA' || tip_client === 'persoana_juridica') && !cui?.trim()) {
      return NextResponse.json({ 
        error: 'CUI-ul este obligatoriu pentru persoanele juridice' 
      }, { status: 400 });
    }

    if ((tip_client === 'Fizic' || tip_client === 'persoana_fizica') && !cnp?.trim()) {
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
    const clientId = body.id || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // ✅ ELIMINAT: sincronizat_factureaza din datele de inserare
    const insertData = {
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
      data_creare: body.data_creare || new Date().toISOString(),
      data_actualizare: body.data_actualizare || new Date().toISOString(),
      activ: body.activ !== undefined ? body.activ : true,
      observatii: observatii?.trim() || null
    };

    // Construiește query-ul
    const insertQuery = generateInsertQuery('PanouControlUnitar', 'Clienti', insertData);
    
    console.log('Executing insert query:', insertQuery);

    await bigquery.query({
      query: insertQuery,
      location: 'EU',
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

// Funcție helper pentru generarea query-urilor INSERT
function generateInsertQuery(dataset: string, table: string, data: any): string {
  const fullTableName = `\`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}\``;
  
  const columns = Object.keys(data);
  const values = columns.map(col => {
    const value = data[col];
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return `'${value}'`;
  }).join(', ');
  
  return `INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES (${values})`;
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

    console.log('Executing update query:', updateQuery);
    console.log('With params:', params);

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

    console.log('Executing delete query:', deleteQuery);

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
