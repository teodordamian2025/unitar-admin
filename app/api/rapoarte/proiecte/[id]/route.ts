// ==================================================================
// CALEA: app/api/rapoarte/proiecte/[id]/route.ts
// DATA: 02.09.2025 23:15 (ora României)
// FIX CRITIC: Îmbunătățire convertBigQueryNumeric pentru valorile NUMERIC din BigQuery
// PĂSTRATE: Toate funcționalitățile existente + JOIN cu Clienti
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const dataset = 'PanouControlUnitar';
const table = `Proiecte${tableSuffix}`;
const tableClienti = `Clienti${tableSuffix}`;

console.log(`🔧 Proiecte [ID] API - Tables Mode: ${useV2Tables ? 'V2 (Optimized)' : 'V1 (Standard)'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// FIX PRINCIPAL: Helper pentru conversie BigQuery NUMERIC îmbunătățit
const convertBigQueryNumeric = (value: any): number => {
  // Console log pentru debugging valorilor primite
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
    
    // Recursiv pentru cazuri aninate
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
    console.log(`String converted:`, value, `->`, result);
    return result;
  }
  
  // Cazul 3: Număr direct
  if (typeof value === 'number') {
    const result = isNaN(value) || !isFinite(value) ? 0 : value;
    console.log(`Number processed:`, value, `->`, result);
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
    console.log(`Other type converted:`, value, `(${typeof value}) ->`, result);
    return result;
  } catch (error) {
    console.warn(`Cannot convert value:`, value, error);
    return 0;
  }
};

// Helper function pentru validare și escape SQL (PĂSTRAT)
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper function pentru formatare DATE pentru BigQuery (PĂSTRAT)
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === '') {
    return 'NULL';
  }
  
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  
  console.warn('Data nu este în format ISO YYYY-MM-DD:', dateString);
  return 'NULL';
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proiectId = params.id;

    console.log('🔍 GET PROIECT BY ID:', proiectId);

    // Query cu JOIN pentru client_id și date complete (PĂSTRAT)
    const proiectQuery = `
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
      FROM \`${PROJECT_ID}.${dataset}.Proiecte\` p
      LEFT JOIN \`${PROJECT_ID}.${dataset}.Clienti\` c
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
      WHERE p.ID_Proiect = @proiectId
    `;

    // Query pentru subproiecte asociate (PĂSTRAT)
    const subproiecteQuery = `
      SELECT * FROM \`${PROJECT_ID}.${dataset}.Subproiecte\`
      WHERE ID_Proiect = @proiectId
      AND (activ IS NULL OR activ = true)
      ORDER BY Denumire ASC
    `;

    // Query pentru sesiuni de lucru (PĂSTRAT)
    const sesiuniQuery = `
      SELECT * FROM \`${PROJECT_ID}.${dataset}.SesiuniLucru\`
      WHERE proiect_id = @proiectId
      ORDER BY data_start DESC
      LIMIT 10
    `;

    // Execută toate query-urile în paralel
    const [
      [proiectRows],
      [subproiecteRows],
      [sesiuniRows]
    ] = await Promise.all([
      bigquery.query({
        query: proiectQuery,
        params: { proiectId },
        types: { proiectId: 'STRING' },
        location: 'EU',
      }),
      bigquery.query({
        query: subproiecteQuery,
        params: { proiectId },
        types: { proiectId: 'STRING' },
        location: 'EU',
      }),
      bigquery.query({
        query: sesiuniQuery,
        params: { proiectId },
        types: { proiectId: 'STRING' },
        location: 'EU',
      })
    ]);

    if (proiectRows.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Proiectul nu a fost găsit' 
      }, { status: 404 });
    }

    const proiect = proiectRows[0];

    // DEBUG pentru valorile NUMERIC înainte de conversie
    console.log('🔍 RAW BigQuery values pentru:', proiectId);
    console.log('Valoare_Estimata RAW:', proiect.Valoare_Estimata);
    console.log('valoare_ron RAW:', proiect.valoare_ron);
    console.log('curs_valutar RAW:', proiect.curs_valutar);

    // DEBUG pentru a vedea datele clientului (PĂSTRAT)
    console.log('🔍 PROIECT CLIENT DATA:', {
      ID_Proiect: proiect.ID_Proiect,
      Client: proiect.Client,
      client_id: proiect.client_id,
      client_nume: proiect.client_nume,
      client_cui: proiect.client_cui,
      client_adresa: proiect.client_adresa,
      has_client_join: !!proiect.client_id ? 'YES' : 'NO'
    });

    // FIX PRINCIPAL: Procesează datele cu funcția îmbunătățită
    const valoare_estimata_converted = convertBigQueryNumeric(proiect.Valoare_Estimata);
    const valoare_ron_converted = convertBigQueryNumeric(proiect.valoare_ron);
    const curs_valutar_converted = convertBigQueryNumeric(proiect.curs_valutar);

    console.log('✅ CONVERTED VALUES:', {
      Valoare_Estimata: valoare_estimata_converted,
      valoare_ron: valoare_ron_converted,
      curs_valutar: curs_valutar_converted
    });

    const processedProiect = {
      ...proiect,
      Valoare_Estimata: valoare_estimata_converted,
      valoare_ron: valoare_ron_converted,
      curs_valutar: curs_valutar_converted
    };

    const processedSubproiecte = subproiecteRows.map((sub: any) => {
      const subValoare = convertBigQueryNumeric(sub.Valoare_Estimata);
      const subValoareRon = convertBigQueryNumeric(sub.valoare_ron);
      const subCurs = convertBigQueryNumeric(sub.curs_valutar);
      
      console.log(`Subproiect ${sub.ID_Subproiect || sub.Denumire} converted:`, {
        Valoare_Estimata: subValoare,
        valoare_ron: subValoareRon,
        curs_valutar: subCurs
      });

      return {
        ...sub,
        Valoare_Estimata: subValoare,
        valoare_ron: subValoareRon,
        curs_valutar: subCurs
      };
    });

    // Calculează statistici din sesiuni (PĂSTRAT)
    const totalOre = sesiuniRows.reduce((sum: number, sesiune: any) => {
      return sum + (Number(sesiune.ore_lucrate) || 0);
    }, 0);

    console.log(`✅ PROIECT LOADED: ${proiect.ID_Proiect} cu ${subproiecteRows.length} subproiecte și ${sesiuniRows.length} sesiuni`);
    console.log(`💰 Valoare finală returnată: ${valoare_estimata_converted} ${proiect.moneda || 'RON'}`);

    return NextResponse.json({
      success: true,
      proiect: processedProiect,
      subproiecte: processedSubproiecte,
      sesiuni_recente: sesiuniRows,
      statistici: {
        total_ore_lucrate: totalOre,
        numar_sesiuni: sesiuniRows.length,
        numar_subproiecte: subproiecteRows.length,
        ultima_activitate: sesiuniRows[0]?.data_start || null
      }
    });

  } catch (error) {
    console.error('❌ EROARE LA ÎNCĂRCAREA DETALIILOR PROIECTULUI:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea detaliilor proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proiectId = params.id;
    const updateData = await request.json();

    console.log('=== DEBUG PUT BY ID: Date primite pentru actualizare ===');
    console.log('Proiect ID:', proiectId);
    console.log('Update data:', updateData);

    // Construire query UPDATE dinamic cu DATE literale (PĂSTRAT)
    const updateFields: string[] = [];

    // Lista câmpurilor permise pentru actualizare (PĂSTRAT + EXTINS)
    const allowedFields = [
      'Denumire', 'Client', 'Status', 'Data_Start', 
      'Data_Final', 'Valoare_Estimata', 'Adresa', 
      'Descriere', 'Responsabil', 'Observatii',
      'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
      'status_predare', 'status_contract', 'status_facturare', 'status_achitare'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        // Tratament special pentru câmpurile DATE (PĂSTRAT)
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
        error: 'Nu există câmpuri valide pentru actualizare' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${dataset}.Proiecte\`
      SET ${updateFields.join(', ')}
      WHERE ID_Proiect = '${escapeString(proiectId)}'
    `;

    console.log('=== DEBUG PUT BY ID: Query UPDATE cu DATE literale ===');
    console.log(updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT BY ID: Update executat cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect actualizat cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la actualizarea proiectului BY ID ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proiectId = params.id;

    if (!proiectId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID proiect necesar pentru ștergere' 
      }, { status: 400 });
    }

    console.log('=== DEBUG DELETE BY ID: Ștergere proiect ===');
    console.log('Proiect ID:', proiectId);

    const deleteQuery = `
      DELETE FROM \`${PROJECT_ID}.${dataset}.Proiecte\`
      WHERE ID_Proiect = '${escapeString(proiectId)}'
    `;

    console.log('=== DEBUG DELETE BY ID: Query ștergere ===');
    console.log(deleteQuery);

    await bigquery.query({
      query: deleteQuery,
      location: 'EU',
    });

    console.log('=== DEBUG DELETE BY ID: Ștergere executată cu succes ===');

    return NextResponse.json({
      success: true,
      message: 'Proiect șters cu succes'
    });

  } catch (error) {
    console.error('=== EROARE BACKEND la ștergerea proiectului BY ID ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la ștergerea proiectului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
