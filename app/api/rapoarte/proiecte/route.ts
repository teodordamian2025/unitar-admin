// ==================================================================
// CALEA: app/api/rapoarte/proiecte/route.ts
// DATA: 15.09.2025 12:35 (ora României)
// MODIFICAT: Îmbunătățit filtrarea datelor pentru intervale cuprinse
// PĂSTRATE: Toate funcționalitățile existente (filtrare, paginare, POST, PUT, DELETE)
// PARTEA 1/3: Imports, helpers și începutul funcției GET
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

const dataset = 'PanouControlUnitar';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6'; // PROJECT ID CORECT

// Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';
const table = `Proiecte${tableSuffix}`;
const tableClienti = `Clienti${tableSuffix}`;

console.log(`🔧 BigQuery Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: ${table}, ${tableClienti}`);

// Helper function pentru validare și escape SQL (PĂSTRAT)
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper function pentru formatare DATE pentru BigQuery (PĂSTRAT)
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '') {
    return 'NULL';
  }
  
  // Verifică că este în format YYYY-MM-DD
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  
  console.warn('Data nu este în format ISO YYYY-MM-DD:', dateString);
  return 'NULL';
};

// FIX PRINCIPAL: Helper pentru conversie BigQuery NUMERIC îmbunătățit (ca în versiunea [id])
const convertBigQueryNumeric = (value: any): number => {
  // Console log pentru debugging valorilor primite (doar pentru valorile non-zero)
  if (value !== null && value !== undefined && value !== 0) {
    console.log(`convertBigQueryNumeric - input:`, {
      value,
      type: typeof value,
      isObject: typeof value === 'object',
      hasValue: value?.hasOwnProperty?.('value'),
      stringified: JSON.stringify(value)
    });
  }

  if (value === null || value === undefined) return 0;
  
  // Cazul 1: Obiect BigQuery cu proprietatea 'value'
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const extractedValue = value.value;
    console.log(`BigQuery object detected - extracted value:`, extractedValue, `type:`, typeof extractedValue);
    
    // Recursiv pentru cazuri anidite
    if (typeof extractedValue === 'object' && extractedValue !== null) {
      return convertBigQueryNumeric(extractedValue);
    }
    
    const numericValue = parseFloat(String(extractedValue)) || 0;
    console.log(`Converted to numeric:`, numericValue);
    return numericValue;
  }
  
  // Cazul 2: String cu valoare numerică
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return 0;
    
    const parsed = parseFloat(trimmed);
    const result = isNaN(parsed) ? 0 : parsed;
    if (result !== 0) {
      console.log(`String converted:`, value, `->`, result);
    }
    return result;
  }
  
  // Cazul 3: Număr direct
  if (typeof value === 'number') {
    const result = isNaN(value) || !isFinite(value) ? 0 : value;
    if (result !== 0 && result !== value) {
      console.log(`Number processed:`, value, `->`, result);
    }
    return result;
  }
  
  // Cazul 4: BigInt (posibil pentru NUMERIC mari)
  if (typeof value === 'bigint') {
    const result = Number(value);
    console.log(`BigInt converted:`, value, `->`, result);
    return result;
  }
  
  // Cazul 5: Alte tipuri - încearcă conversie
  try {
    const stringValue = String(value);
    const parsed = parseFloat(stringValue);
    const result = isNaN(parsed) ? 0 : parsed;
    if (result !== 0) {
      console.log(`Other type converted:`, value, `(${typeof value}) ->`, result);
    }
    return result;
  } catch (error) {
    console.warn(`Cannot convert value:`, value, error);
    return 0;
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const client = searchParams.get('client');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log('📋 PROIECTE API PARAMS:', { search, status, client, page, limit });

    // FIX CRITICAL: Query cu JOIN pentru datele clientului (ca în contracte)
    let baseQuery = `
      SELECT
        p.*,
        c.id as client_id,
        c.nume as client_nume,
        c.cui as client_cui,
        c.nr_reg_com as client_reg_com,
        c.adresa as client_adresa,
        c.judet as client_judet,
        c.oras as client_oras,
        c.telefon as client_telefon,
        c.email as client_email,
        c.banca as client_banca,
        c.iban as client_iban
      FROM \`${PROJECT_ID}.${dataset}.${table}\` p
      LEFT JOIN \`${PROJECT_ID}.${dataset}.${tableClienti}\` c
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
    `;

    const conditions: string[] = [];
    const params: any = {};
    const types: any = {};

    // Filtre - PĂSTRATE identic cu funcționalitate extinsă
    if (search) {
      conditions.push(`(
        LOWER(p.ID_Proiect) LIKE LOWER(@search) OR 
        LOWER(p.Denumire) LIKE LOWER(@search) OR 
        LOWER(p.Client) LIKE LOWER(@search) OR
        LOWER(COALESCE(p.Adresa, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(c.nume, '')) LIKE LOWER(@search) OR
        LOWER(COALESCE(c.cui, '')) LIKE LOWER(@search)
      )`);
      params.search = `%${search}%`;
      types.search = 'STRING';
    }

    if (status) {
      conditions.push('p.Status = @status');
      params.status = status;
      types.status = 'STRING';
    }

    // MODIFICAT: Filtrul client folosește LIKE pentru căutare parțială
    if (client) {
      conditions.push(`(
        LOWER(p.Client) LIKE LOWER(@client) OR
        LOWER(COALESCE(c.nume, '')) LIKE LOWER(@client)
      )`);
      params.client = `%${client}%`;
      types.client = 'STRING';
    }

    // ÎMBUNĂTĂȚIT: Filtrare pe baza datelor pentru intervale cuprinse
    const dataStartFrom = searchParams.get('data_start_start');
    const dataStartTo = searchParams.get('data_start_end');
    
    console.log('📅 DATE FILTER PARAMS:', { dataStartFrom, dataStartTo });
    
    if (dataStartFrom) {
      // Găsește proiectele care au Data_Start >= data specificată
      conditions.push('p.Data_Start >= @dataStartFrom');
      params.dataStartFrom = dataStartFrom;
      types.dataStartFrom = 'DATE';
      console.log('📅 Aplicat filtru Data_Start >= ', dataStartFrom);
    }
    
    if (dataStartTo) {
      // Găsește proiectele care au Data_Start <= data specificată
      conditions.push('p.Data_Start <= @dataStartTo');
      params.dataStartTo = dataStartTo;
      types.dataStartTo = 'DATE';
      console.log('📅 Aplicat filtru Data_Start <= ', dataStartTo);
    }

    // Filtrare pe baza valorii RON pentru acuratețe - PĂSTRATE
    const valoareMin = searchParams.get('valoare_min');
    if (valoareMin && !isNaN(Number(valoareMin))) {
      conditions.push('CAST(COALESCE(p.valoare_ron, p.Valoare_Estimata, 0) AS FLOAT64) >= @valoareMin');
      params.valoareMin = Number(valoareMin);
      types.valoareMin = 'NUMERIC';
    }

    const valoareMax = searchParams.get('valoare_max');
    if (valoareMax && !isNaN(Number(valoareMax))) {
      conditions.push('CAST(COALESCE(p.valoare_ron, p.Valoare_Estimata, 0) AS FLOAT64) <= @valoareMax');
      params.valoareMax = Number(valoareMax);
      types.valoareMax = 'NUMERIC';
    }

    // Filtrare pe baza monedei - PĂSTRATE
    const moneda = searchParams.get('moneda');
    if (moneda) {
      conditions.push('COALESCE(p.moneda, "RON") = @moneda');
      params.moneda = moneda;
      types.moneda = 'STRING';
    }

    // Filtrare pe baza status-urilor multiple - PĂSTRATE
    const statusPredare = searchParams.get('status_predare');
    if (statusPredare) {
      conditions.push('COALESCE(p.status_predare, "Nepredat") = @statusPredare');
      params.statusPredare = statusPredare;
      types.statusPredare = 'STRING';
    }

    const statusContract = searchParams.get('status_contract');
    if (statusContract) {
      conditions.push('COALESCE(p.status_contract, "Nu e cazul") = @statusContract');
      params.statusContract = statusContract;
      types.statusContract = 'STRING';
    }

    const statusFacturare = searchParams.get('status_facturare');
    if (statusFacturare) {
      conditions.push('COALESCE(p.status_facturare, "Nefacturat") = @statusFacturare');
      params.statusFacturare = statusFacturare;
      types.statusFacturare = 'STRING';
    }

    const statusAchitare = searchParams.get('status_achitare');
    if (statusAchitare) {
      conditions.push('COALESCE(p.status_achitare, "Neachitat") = @statusAchitare');
      params.statusAchitare = statusAchitare;
      types.statusAchitare = 'STRING';
    }
    // Adaugă condiții la query
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Sortare și paginare
    baseQuery += ` 
      ORDER BY p.Data_Start DESC 
      LIMIT @limit OFFSET @offset
    `;

    params.limit = limit;
    params.offset = offset;
    types.limit = 'INT64';
    types.offset = 'INT64';

    console.log('📋 QUERY PARAMS:', params);

    // Execută query-ul principal
    const [rows] = await bigquery.query({
      query: baseQuery,
      params: params,
      types: types,
      location: 'EU',
    });

    console.log(`✅ PROIECTE LOADED: ${rows.length} results`);

    // DEBUG pentru primul rând să vedem datele clientului
    if (rows.length > 0) {
      console.log('🔍 FIRST PROJECT CLIENT DATA:', {
        ID_Proiect: rows[0].ID_Proiect,
        Client: rows[0].Client,
        client_id: rows[0].client_id,
        client_nume: rows[0].client_nume,
        client_cui: rows[0].client_cui,
        client_adresa: rows[0].client_adresa,
        has_client_join: !!rows[0].client_id ? 'YES' : 'NO'
      });

      // FIX PRINCIPAL: DEBUG pentru valorile NUMERIC din primul proiect
      console.log('🔍 RAW BigQuery values pentru primul proiect:');
      console.log('Valoare_Estimata RAW:', rows[0].Valoare_Estimata);
      console.log('valoare_ron RAW:', rows[0].valoare_ron);
      console.log('curs_valutar RAW:', rows[0].curs_valutar);
    }

    // Query pentru total count (pentru paginare)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM \`${PROJECT_ID}.${dataset}.${table}\` p
      LEFT JOIN \`${PROJECT_ID}.${dataset}.${tableClienti}\` c
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
    `;

    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countParams = { ...params };
    const countTypes = { ...types };
    delete countParams.limit;
    delete countParams.offset;
    delete countTypes.limit;
    delete countTypes.offset;

    const [countRows] = await bigquery.query({
      query: countQuery,
      params: countParams,
      types: countTypes,
      location: 'EU',
    });

    const total = convertBigQueryNumeric(countRows[0]?.total) || 0;

    // FIX PRINCIPAL: Procesează rezultatele cu funcția îmbunătățită pentru consistency
    const processedData = rows.map((row: any) => {
      const valoare_estimata_converted = convertBigQueryNumeric(row.Valoare_Estimata);
      const valoare_ron_converted = convertBigQueryNumeric(row.valoare_ron);
      const curs_valutar_converted = convertBigQueryNumeric(row.curs_valutar);

      // Log conversiile pentru debugging
      if (row.ID_Proiect && (valoare_estimata_converted > 0 || valoare_ron_converted > 0)) {
        console.log(`✅ CONVERTED VALUES pentru ${row.ID_Proiect}:`, {
          Valoare_Estimata: valoare_estimata_converted,
          valoare_ron: valoare_ron_converted,
          curs_valutar: curs_valutar_converted
        });
      }

      return {
        ...row,
        Valoare_Estimata: valoare_estimata_converted,
        valoare_ron: valoare_ron_converted,
        curs_valutar: curs_valutar_converted
      };
    });

    console.log('💰 Procesare completă cu conversii NUMERIC îmbunătățite aplicată');

    return NextResponse.json({
      success: true,
      data: processedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ EROARE LA ÎNCĂRCAREA PROIECTELOR:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea proiectelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PĂSTRAT: Funcțiile POST, PUT, DELETE neschimbate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('POST request body primit:', body);
    
    const { 
      ID_Proiect, 
      Denumire, 
      Client, 
      Adresa,
      Descriere,
      Data_Start, 
      Data_Final, 
      Status = 'Activ', 
      Valoare_Estimata,
      // Câmpuri multi-valută
      moneda = 'RON',
      curs_valutar,
      data_curs_valutar,
      valoare_ron,
      // Status-uri multiple
      status_predare = 'Nepredat',
      status_contract = 'Nu e cazul',
      status_facturare = 'Nefacturat',
      status_achitare = 'Neachitat',
      Responsabil,
      Observatii
    } = body;

    // Validări
    if (!ID_Proiect || !Denumire || !Client) {
      return NextResponse.json({ 
        success: false,
        error: 'Câmpurile ID_Proiect, Denumire și Client sunt obligatorii' 
      }, { status: 400 });
    }

    // FIX PRINCIPAL: Construire query cu DATE literale în loc de parameters
    console.log('=== DEBUG BACKEND: Date primite ===');
    console.log('Data_Start primit:', Data_Start);
    console.log('Data_Final primit:', Data_Final);
    console.log('data_curs_valutar primit:', data_curs_valutar);

    // Formatare DATE literale pentru BigQuery
    const dataStartFormatted = formatDateLiteral(Data_Start);
    const dataFinalFormatted = formatDateLiteral(Data_Final);
    const dataCursFormatted = formatDateLiteral(data_curs_valutar);

    console.log('=== DEBUG BACKEND: Date formatate pentru BigQuery ===');
    console.log('Data_Start formatată:', dataStartFormatted);
    console.log('Data_Final formatată:', dataFinalFormatted);
    console.log('data_curs_valutar formatată:', dataCursFormatted);

    // FIX PRINCIPAL: Query cu DATE literale pentru a evita probleme cu parameters
    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.${dataset}.${table}\`
      (ID_Proiect, Denumire, Client, Adresa, Descriere, Data_Start, Data_Final, 
       Status, Valoare_Estimata, moneda, curs_valutar, data_curs_valutar, valoare_ron,
       status_predare, status_contract, status_facturare, status_achitare,
       Responsabil, Observatii)
      VALUES (
        '${escapeString(ID_Proiect)}',
        '${escapeString(Denumire)}',
        '${escapeString(Client)}',
        ${Adresa ? `'${escapeString(Adresa)}'` : 'NULL'},
        ${Descriere ? `'${escapeString(Descriere)}'` : 'NULL'},
        ${dataStartFormatted},
        ${dataFinalFormatted},
        '${escapeString(Status)}',
        ${Valoare_Estimata || 'NULL'},
        '${escapeString(moneda)}',
        ${curs_valutar || 'NULL'},
        ${dataCursFormatted},
        ${valoare_ron || 'NULL'},
        '${escapeString(status_predare)}',
        '${escapeString(status_contract)}',
        '${escapeString(status_facturare)}',
        '${escapeString(status_achitare)}',
        ${Responsabil ? `'${escapeString(Responsabil)}'` : 'NULL'},
        ${Observatii ? `'${escapeString(Observatii)}'` : 'NULL'}
      )
    `;

    console.log('=== DEBUG BACKEND: Query INSERT final ===');
    console.log(insertQuery);

    // Executare query fără parameters pentru DATE fields
    await bigquery.query({
      query: insertQuery,
      location: 'EU',
    });

    console.log('=== DEBUG BACKEND: Insert executat cu succes ===');

    // ✅ HOOK NOTIFICĂRI: Trimite notificare responsabil la atribuire proiect
    // FIX: Găsește UID-ul responsabilului din tabela Utilizatori_v2
    if (Responsabil) {
      try {
        const tableUtilizatori = `Utilizatori${tableSuffix}`;

        // Caută UID-ul responsabilului după nume în tabela Utilizatori_v2
        // Caută în ambele ordini: "Nume Prenume" SAU "Prenume Nume"
        const responsabiliQuery = `
          SELECT uid, nume, prenume, email
          FROM \`${PROJECT_ID}.${dataset}.${tableUtilizatori}\`
          WHERE CONCAT(nume, ' ', prenume) = @responsabil
            OR CONCAT(prenume, ' ', nume) = @responsabil
            OR nume = @responsabil
            OR prenume = @responsabil
          LIMIT 1
        `;

        const [responsabiliRows] = await bigquery.query({
          query: responsabiliQuery,
          params: { responsabil: Responsabil },
          location: 'EU',
        });

        // Dacă găsim responsabilul, trimitem notificarea
        if (responsabiliRows.length > 0) {
          const responsabilUser = responsabiliRows[0];

          const notifyResponse = await fetch(`${request.url.split('/api/')[0]}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tip_notificare: 'proiect_atribuit',
              user_id: responsabilUser.uid, // ✅ FIXED: Trimitem UID-ul, nu numele
              context: {
                proiect_id: ID_Proiect,
                proiect_denumire: Denumire,
                proiect_client: Client,
                proiect_descriere: Descriere || '',
                proiect_deadline: Data_Final || '',
                user_name: `${responsabilUser.nume} ${responsabilUser.prenume}`,
                data_atribuire: new Date().toISOString().split('T')[0],
                termen_realizare: Data_Final || 'Neespecificat',
                link_detalii: `${request.url.split('/api/')[0]}/admin/rapoarte/proiecte?search=${encodeURIComponent(ID_Proiect)}`
              }
            })
          });

          const notifyResult = await notifyResponse.json();
          console.log('✅ Notificare proiect trimisă către UID:', responsabilUser.uid, notifyResult);
        } else {
          console.warn(`⚠️ Nu s-a găsit utilizator cu numele "${Responsabil}" în Utilizatori_v2`);
        }
      } catch (notifyError) {
        console.error('⚠️ Eroare la trimitere notificare (non-blocking):', notifyError);
        // Nu blocăm crearea proiectului dacă notificarea eșuează
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Proiect adăugat cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la adăugarea proiectului ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la adăugarea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID proiect necesar pentru actualizare' 
      }, { status: 400 });
    }

    console.log('=== DEBUG PUT: Date primite pentru actualizare ===');
    console.log('ID:', id);
    console.log('Update data:', updateData);

    // Construire query UPDATE dinamic cu DATE literale
    const updateFields: string[] = [];

    if (status) {
      updateFields.push(`Status = '${escapeString(status)}'`);
    }

    // Procesare câmpuri de actualizat cu tratament special pentru DATE
    const allowedFields = [
      'Denumire', 'Client', 'Adresa', 'Descriere', 'Data_Start', 'Data_Final', 
      'Valoare_Estimata', 'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'status_predare', 'status_contract', 'status_facturare', 'status_achitare',
      'Responsabil', 'Observatii'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedFields.includes(key)) {
        // FIX: Tratament special pentru câmpurile DATE
        if (['Data_Start', 'Data_Final', 'data_curs_valutar'].includes(key)) {
          const formattedDate = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${formattedDate}`);
        } else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else if (typeof value === 'string') {
          updateFields.push(`${key} = '${escapeString(value)}'`);
        } else if (typeof value === 'number') {
          updateFields.push(`${key} = ${value}`);
        } else {
          updateFields.push(`${key} = '${escapeString(value.toString())}'`);
        }
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.${table}\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    console.log('=== DEBUG PUT: Query UPDATE cu DATE literale ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT: Update executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect actualizat cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la actualizarea proiectului ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea proiectului',
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
        success: false,
        error: 'ID proiect necesar pentru ștergere' 
      }, { status: 400 });
    }

    const deleteQuery = `
      DELETE FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    console.log('=== DEBUG DELETE: Query ștergere ===');
    console.log(deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log('=== DEBUG DELETE: Ștergere executată cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect șters cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la ștergerea proiectului ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
