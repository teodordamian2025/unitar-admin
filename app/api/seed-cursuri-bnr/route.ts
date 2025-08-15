// ==================================================================
// CALEA: app/api/seed-cursuri-bnr/route.ts
// DATA: 15.08.2025 14:35 (ora României)
// DESCRIERE: API pentru popularea tabelului CursuriValutare din XML BNR istoric
// PĂSTRATE: Toate funcționalitățile existente, API nou pentru seed data
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Inițializare BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

interface CursEntry {
  data: string;
  moneda: string;
  curs: number;
  sursa: string;
  precizie_originala: string;
  multiplicator?: number;
}

// ✅ FUNCȚIE pentru parsing XML BNR 2025
async function parseXMLBNR2025(): Promise<CursEntry[]> {
  try {
    console.log('📡 Descărcare XML BNR 2025...');
    
    const response = await fetch('https://www.bnr.ro/files/xml/years/nbrfxrates2025.xml', {
      headers: {
        'User-Agent': 'UNITAR-PROIECT-SEED-CLIENT/1.0',
        'Accept': 'application/xml, text/xml',
      },
      signal: AbortSignal.timeout(30000) // 30 secunde timeout
    });

    if (!response.ok) {
      throw new Error(`BNR XML API returned ${response.status}`);
    }

    const xmlText = await response.text();
    console.log(`📄 XML descărcat: ${xmlText.length} caractere`);

    // Parse manual XML pentru extragerea cursurilor
    const cursuri: CursEntry[] = [];
    
    // Regex pentru extragerea date-urilor
    const dateRegex = /<Cube date="([^"]+)"[^>]*>/g;
    const dateMatches = [...xmlText.matchAll(dateRegex)];
    
    console.log(`📅 Găsite ${dateMatches.length} date în XML`);

    // Pentru fiecare dată, extrage cursurile
    dateMatches.forEach(dateMatch => {
      const data = dateMatch[1]; // Format: YYYY-MM-DD
      const dateIndex = xmlText.indexOf(dateMatch[0]);
      
      // Găsește sfârșitul blocului pentru această dată
      const nextDateIndex = xmlText.indexOf('<Cube date=', dateIndex + 1);
      const endIndex = nextDateIndex !== -1 ? nextDateIndex : xmlText.length;
      
      const dateBlock = xmlText.substring(dateIndex, endIndex);
      
      // Extrage cursurile pentru această dată
      const rateRegex = /<Cube currency="([^"]+)" rate="([^"]+)"(?: multiplier="([^"]+)")?/g;
      const rateMatches = [...dateBlock.matchAll(rateRegex)];
      
      rateMatches.forEach(rateMatch => {
        const moneda = rateMatch[1];
        const cursString = rateMatch[2];
        const multiplicatorString = rateMatch[3];
        
        // Filtrează doar monedele de care avem nevoie
        if (['EUR', 'USD', 'GBP'].includes(moneda)) {
          const cursValue = parseFloat(cursString);
          const multiplicator = multiplicatorString ? parseFloat(multiplicatorString) : 1;
          const cursCalculat = cursValue / multiplicator;
          
          cursuri.push({
            data: data,
            moneda: moneda,
            curs: cursCalculat,
            sursa: 'XML_ISTORIC',
            precizie_originala: cursString,
            multiplicator: multiplicator
          });
        }
      });
    });

    console.log(`✅ Extrase ${cursuri.length} cursuri din XML`);
    
    // Sortează după dată pentru debugging
    cursuri.sort((a, b) => a.data.localeCompare(b.data));
    
    // Log primele și ultimele cursuri pentru verificare
    if (cursuri.length > 0) {
      console.log('📊 Primul curs:', cursuri[0]);
      console.log('📊 Ultimul curs:', cursuri[cursuri.length - 1]);
      
      // Statistici pe monede
      const monede = [...new Set(cursuri.map(c => c.moneda))];
      console.log(`💱 Monede găsite: ${monede.join(', ')}`);
      monede.forEach(moneda => {
        const count = cursuri.filter(c => c.moneda === moneda).length;
        console.log(`  ${moneda}: ${count} cursuri`);
      });
    }

    return cursuri;

  } catch (error) {
    console.error('❌ Eroare la parsarea XML BNR:', error);
    throw error;
  }
}

// ✅ FUNCȚIE pentru adăugarea cursurilor estimate pentru zilele lipsă
function generateEstimatedRates(cursuri: CursEntry[]): CursEntry[] {
  const estimatedRates: CursEntry[] = [];
  
  // Cursuri estimate pentru perioada de dinainte de primul curs BNR din 2025
  const startDate = new Date('2025-01-01');
  const firstDataDate = cursuri.length > 0 ? new Date(cursuri[0].data) : new Date('2025-01-02');
  
  // Cursuri estimate conservatoare pentru început de an
  const estimatedCursuri = {
    'EUR': 4.9750,  // Estimare stabilă pentru EUR
    'USD': 4.5200,  // Estimare stabilă pentru USD  
    'GBP': 5.7800   // Estimare stabilă pentru GBP
  };

  // Generează cursuri estimate pentru zilele lipsă de la începutul anului
  for (let date = new Date(startDate); date < firstDataDate; date.setDate(date.getDate() + 1)) {
    const dateString = date.toISOString().split('T')[0];
    
    Object.entries(estimatedCursuri).forEach(([moneda, curs]) => {
      estimatedRates.push({
        data: dateString,
        moneda: moneda,
        curs: curs,
        sursa: 'ESTIMATE',
        precizie_originala: curs.toFixed(4)
      });
    });
  }

  console.log(`📈 Generate ${estimatedRates.length} cursuri estimate pentru perioada ${startDate.toISOString().split('T')[0]} - ${firstDataDate.toISOString().split('T')[0]}`);
  
  return estimatedRates;
}

// ✅ FUNCȚIE pentru inserarea în BigQuery cu batch processing
async function insertCursuriInBigQuery(cursuri: CursEntry[]): Promise<void> {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('CursuriValutare');

    console.log(`💾 Inserare ${cursuri.length} cursuri în BigQuery...`);

    // Batch processing pentru inserare eficientă
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < cursuri.length; i += batchSize) {
      const batch = cursuri.slice(i, i + batchSize);
      
      // Formatează datele pentru BigQuery
      const formattedBatch = batch.map(curs => ({
        data: curs.data,
        moneda: curs.moneda,
        curs: curs.curs,
        sursa: curs.sursa,
        precizie_originala: curs.precizie_originala,
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString(),
        observatii: `Seed BNR ${curs.sursa}${curs.multiplicator && curs.multiplicator !== 1 ? ` (x${curs.multiplicator})` : ''}`,
        validat: true,
        multiplicator: curs.multiplicator || 1.0
      }));

      await table.insert(formattedBatch);
      inserted += batch.length;
      
      console.log(`📊 Inserate ${inserted}/${cursuri.length} cursuri`);
    }

    console.log(`✅ Toate cursurile au fost inserate cu succes în BigQuery!`);

  } catch (error) {
    console.error('❌ Eroare la inserarea în BigQuery:', error);
    throw error;
  }
}

// ✅ ENDPOINT PRINCIPAL
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeEstimates = searchParams.get('estimates') === 'true';
    const forceRefresh = searchParams.get('force') === 'true';

    console.log('🚀 Începere seed cursuri BNR 2025...');
    console.log(`📅 Include estimates: ${includeEstimates}`);
    console.log(`🔄 Force refresh: ${forceRefresh}`);

    // Verifică dacă tabelul are deja date (doar dacă nu e force refresh)
    if (!forceRefresh) {
      try {
        const [rows] = await bigquery.query({
          query: `SELECT COUNT(*) as total FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\``,
          location: 'EU',
        });

        const existingCount = rows[0]?.total || 0;
        if (existingCount > 0) {
          console.log(`📊 Tabelul are deja ${existingCount} cursuri. Folosește ?force=true pentru refresh complet.`);
          return NextResponse.json({
            success: true,
            message: `Tabelul are deja ${existingCount} cursuri. Folosește ?force=true pentru refresh.`,
            existingCount: existingCount,
            skipped: true
          });
        }
      } catch (checkError) {
        console.log('ℹ️ Nu s-au putut verifica datele existente, continuez cu seed-ul...');
      }
    }

    // Parse XML BNR 2025
    const cursuriXML = await parseXMLBNR2025();
    
    let cursuriFinal = [...cursuriXML];

    // Adaugă cursuri estimate dacă sunt solicitate
    if (includeEstimates) {
      const cursuriEstimate = generateEstimatedRates(cursuriXML);
      cursuriFinal = [...cursuriEstimate, ...cursuriXML];
    }

    // Sortează final după dată
    cursuriFinal.sort((a, b) => a.data.localeCompare(b.data));

    // Statistici finale
    const totalCursuri = cursuriFinal.length;
    const monede = [...new Set(cursuriFinal.map(c => c.moneda))];
    const perioadaStart = cursuriFinal[0]?.data;
    const perioadaEnd = cursuriFinal[cursuriFinal.length - 1]?.data;

    console.log(`📈 Statistici finale:`);
    console.log(`  Total cursuri: ${totalCursuri}`);
    console.log(`  Monede: ${monede.join(', ')}`);
    console.log(`  Perioada: ${perioadaStart} - ${perioadaEnd}`);

    // Inserare în BigQuery
    if (forceRefresh) {
      console.log('🗑️ Ștergere date existente...');
      await bigquery.query({
        query: `DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\` WHERE TRUE`,
        location: 'EU',
      });
    }

    await insertCursuriInBigQuery(cursuriFinal);

    return NextResponse.json({
      success: true,
      message: 'Cursuri BNR 2025 populate cu succes în BigQuery',
      stats: {
        totalCursuri: totalCursuri,
        monede: monede,
        perioadaStart: perioadaStart,
        perioadaEnd: perioadaEnd,
        includeEstimates: includeEstimates,
        forceRefresh: forceRefresh
      }
    });

  } catch (error) {
    console.error('❌ Eroare la seed cursuri BNR:', error);
    return NextResponse.json({
      error: 'Eroare la popularea cursurilor BNR',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// ✅ ENDPOINT pentru verificarea statusului
export async function GET(request: NextRequest) {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT 
          moneda,
          COUNT(*) as total_cursuri,
          MIN(data) as prima_data,
          MAX(data) as ultima_data,
          AVG(curs) as curs_mediu
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
        GROUP BY moneda
        ORDER BY moneda
      `,
      location: 'EU',
    });

    const [totalRows] = await bigquery.query({
      query: `SELECT COUNT(*) as total FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\``,
      location: 'EU',
    });

    const totalCursuri = totalRows[0]?.total || 0;

    return NextResponse.json({
      success: true,
      totalCursuri: totalCursuri,
      statisticiPeMonede: rows,
      status: totalCursuri > 0 ? 'populated' : 'empty'
    });

  } catch (error) {
    console.error('❌ Eroare la verificarea statusului:', error);
    return NextResponse.json({
      error: 'Eroare la verificarea statusului cursurilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
