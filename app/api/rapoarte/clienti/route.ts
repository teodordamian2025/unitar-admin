import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabelă cu suffix dinamic
const TABLE_CLIENTI = `\`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\``;

console.log(`🔧 Clienti API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: Clienti${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ✅ Deduplicare: ia ultima versiune per client (pentru versioning append-only)
    let query = `
      WITH LatestVersions AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY id ORDER BY data_actualizare DESC, data_creare DESC) as rn
        FROM ${TABLE_CLIENTI}
        WHERE activ = true
      )
      SELECT * EXCEPT(rn) FROM LatestVersions WHERE rn = 1
    `;

    const conditions: string[] = [];
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

    // Adaugă filtre după deduplicare (în WHERE exterior)
    if (conditions.length > 0) {
      // Înlocuim SELECT * cu WHERE final
      query = `
        WITH LatestVersions AS (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY id ORDER BY data_actualizare DESC, data_creare DESC) as rn
          FROM ${TABLE_CLIENTI}
          WHERE activ = true
        )
        SELECT * EXCEPT(rn) FROM LatestVersions
        WHERE rn = 1 AND ${conditions.join(' AND ')}
      `;
    }

    // Sortare - ordinea alfabetică
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
      SELECT id FROM ${TABLE_CLIENTI}
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
    const insertQuery = generateInsertQuery(DATASET, `Clienti${tableSuffix}`, insertData);
    
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
  const fullTableName = `\`${PROJECT_ID}.${dataset}.${table}\``;
  
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
  // Declarăm variabilele la nivel de funcție pentru a fi accesibile în catch
  let clientId: string = '';
  let clientUpdateData: any = {};

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    // Salvăm pentru fallback
    clientId = id;
    clientUpdateData = updateData;

    if (!id) {
      return NextResponse.json({
        error: 'ID client necesar pentru actualizare'
      }, { status: 400 });
    }

    // Construire query UPDATE dinamic
    const updateFields: string[] = [];
    const params: any = { id };
    const types: any = { id: 'STRING' };

    // Câmpuri actualizabile
    const allowedFields = [
      'nume', 'tip_client', 'cui', 'nr_reg_com', 'adresa', 'judet', 'oras',
      'cod_postal', 'telefon', 'email', 'banca', 'iban', 'cnp', 'ci_serie',
      'ci_numar', 'ci_eliberata_de', 'ci_eliberata_la', 'observatii'
    ];

    // ✅ Câmpuri de tip DATE care trebuie convertite la null dacă sunt string gol
    const dateFields = ['ci_eliberata_la'];

    Object.entries(updateData).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = @${key}`);

        // ✅ Convertește string gol la null pentru câmpurile DATE
        if (dateFields.includes(key) && value === '') {
          params[key] = null;
          types[key] = 'DATE'; // ✅ BigQuery necesită tip explicit pentru null
        } else {
          params[key] = value;
          // ✅ Setează tipul pentru toate parametrii
          if (dateFields.includes(key)) {
            types[key] = 'DATE';
          } else {
            types[key] = 'STRING';
          }
        }
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
    types.data_actualizare = 'TIMESTAMP';

    const updateQuery = `
      UPDATE ${TABLE_CLIENTI}
      SET ${updateFields.join(', ')}
      WHERE id = @id AND activ = true
    `;

    console.log('Executing update query:', updateQuery);
    console.log('With params:', params);

    // ✅ Retry logic pentru streaming buffer conflict
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        await bigquery.query({
          query: updateQuery,
          params: params,
          types: types,
          location: 'EU',
        });

        // Success - ieși din loop
        return NextResponse.json({
          success: true,
          message: 'Client actualizat cu succes'
        });

      } catch (err: any) {
        lastError = err;

        // Check dacă e eroare de streaming buffer
        const isStreamingBufferError = err.message?.includes('streaming buffer') ||
                                       err.code === 400 && err.errors?.[0]?.reason === 'invalidQuery';

        if (isStreamingBufferError && retryCount < maxRetries - 1) {
          retryCount++;
          const waitTime = retryCount * 2000; // 2s, 4s, 6s
          console.log(`⏳ Streaming buffer conflict - Retry ${retryCount}/${maxRetries} după ${waitTime}ms`);

          // Așteaptă înainte de retry
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Dacă nu e streaming buffer error sau am epuizat retry-urile, aruncă eroarea
        throw err;
      }
    }

    // Dacă am ajuns aici, toate retry-urile au eșuat
    throw lastError;

  } catch (error: any) {
    console.error('Eroare la actualizarea clientului:', error);

    // ✅ FALLBACK: Dacă UPDATE eșuează din cauza streaming buffer, facem INSERT (append-only versioning)
    const isStreamingBufferError = error?.message?.includes('streaming buffer') ||
                                   (error?.code === 400 && error?.errors?.[0]?.reason === 'invalidQuery');

    if (isStreamingBufferError) {
      try {
        console.log('🔄 Streaming buffer conflict persists - Fallback la INSERT (append-only versioning)');

        // Citim datele existente pentru client
        const selectQuery = `
          WITH LatestVersion AS (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY id ORDER BY data_actualizare DESC, data_creare DESC) as rn
            FROM ${TABLE_CLIENTI}
            WHERE id = @id AND activ = true
          )
          SELECT * EXCEPT(rn) FROM LatestVersion WHERE rn = 1 LIMIT 1
        `;

        const [existingRows] = await bigquery.query({
          query: selectQuery,
          params: { id: clientId },
          location: 'EU',
        });

        if (existingRows.length === 0) {
          return NextResponse.json({
            error: 'Client nu a fost găsit pentru actualizare'
          }, { status: 404 });
        }

        const existingClient = existingRows[0];

        // Construim datele pentru INSERT (merge existing + updates)
        const insertData: any = {
          ...existingClient,
          ...clientUpdateData,
          id: clientId, // păstrăm același ID (versioning)
          data_actualizare: new Date().toISOString(), // timestamp nou
          activ: true
        };

        // Handle date fields (remove {value: "..."} objects)
        if (insertData.data_creare?.value) {
          insertData.data_creare = insertData.data_creare.value;
        }
        if (insertData.ci_eliberata_la?.value) {
          insertData.ci_eliberata_la = insertData.ci_eliberata_la.value;
        }

        // Remove row metadata
        delete insertData.rn;

        // Generează INSERT query
        const insertQuery = generateInsertQuery(DATASET, `Clienti${tableSuffix}`, insertData);

        console.log('🔄 Executing fallback INSERT:', insertQuery);

        await bigquery.query({
          query: insertQuery,
          location: 'EU',
        });

        console.log('✅ Client actualizat cu succes prin INSERT (streaming buffer workaround)');

        return NextResponse.json({
          success: true,
          message: 'Client actualizat cu succes',
          fallback_used: true // flag pentru debugging
        });

      } catch (insertError) {
        console.error('Eroare la fallback INSERT:', insertError);
        return NextResponse.json({
          error: 'Eroare la actualizarea clientului (fallback INSERT)',
          details: insertError instanceof Error ? insertError.message : 'Eroare necunoscută'
        }, { status: 500 });
      }
    }

    // Altă eroare non-streaming-buffer
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
      UPDATE ${TABLE_CLIENTI}
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
