// ==================================================================
// CALEA: app/api/curs-valutar/route.ts
// DATA: 16.08.2025 13:00 (ora României)
// FIX PRINCIPAL: Eliminare forțare 4 zecimale + validări sigure pentru parseFloat
// PĂSTRATE: Toate funcționalitățile existente + precizie originală cursuri
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

interface CursValutar {
  moneda: string;
  curs: number;
  data: string;
  precizie_originala?: string;
}

interface BNRRate {
  code: string;
  multiplier: number;
  value: number;
}

// Inițializare BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// FIX PRINCIPAL: Funcție helper pentru validări sigure
const ensureNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed) ? parsed : defaultValue;
  }
  
  return defaultValue;
};

// FIX PRINCIPAL: Funcție pentru formatare sigură cu precizie originală
const formatWithOriginalPrecision = (value: any, originalPrecision?: string): string => {
  // Dacă avem precizia originală, o folosim
  if (originalPrecision && originalPrecision !== 'undefined' && originalPrecision !== 'null') {
    return originalPrecision;
  }
  
  // Altfel, formatez cu precizia naturală
  const num = ensureNumber(value);
  return num.toString();
};

// FIX PRINCIPAL: Cache îmbunătățit cu precizie originală
let cursCache: { 
  [key: string]: { 
    curs: number; 
    data: string; 
    timestamp: number;
    precizie_originala: string;
    sursa: string;
  } 
} = {};
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 ore în milisecunde

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const moneda = searchParams.get('moneda') || 'EUR';
  const data = searchParams.get('data') || new Date().toISOString().split('T')[0];

  try {
    // Verifică cache-ul mai întâi cu precizie originală
    const cacheKey = `${moneda}_${data}`;
    const cachedData = cursCache[cacheKey];
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      console.log(`📊 Returning cached rate for ${moneda} (${data}): ${formatWithOriginalPrecision(cachedData.curs, cachedData.precizie_originala)}`);
      return NextResponse.json({
        success: true,
        curs: cachedData.curs,
        moneda: moneda,
        data: cachedData.data,
        source: 'cache',
        precizie_originala: cachedData.precizie_originala,
        sursa_originala: cachedData.sursa
      });
    }

    // Încearcă să găsească cursul în BigQuery mai întâi
    const cursValutar = await getCursFromBigQuery(moneda, data);
    
    if (cursValutar) {
      // Salvează în cache
      cursCache[cacheKey] = {
        curs: cursValutar.curs,
        data: cursValutar.data,
        timestamp: Date.now(),
        precizie_originala: cursValutar.precizie_originala || cursValutar.curs.toString(),
        sursa: 'BigQuery'
      };

      return NextResponse.json({
        success: true,
        curs: cursValutar.curs,
        moneda: cursValutar.moneda,
        data: cursValutar.data,
        source: 'bigquery',
        precizie_originala: cursValutar.precizie_originala
      });
    }

    // FALLBACK 1: Încearcă BNR API live dacă data este foarte recentă
    const cursLive = await getCursBNRLive(moneda, data);
    if (cursLive) {
      // Salvează cursul live în BigQuery pentru viitor
      await saveCursInBigQuery(cursLive);
      
      cursCache[cacheKey] = {
        curs: cursLive.curs,
        data: cursLive.data,
        timestamp: Date.now(),
        precizie_originala: cursLive.precizie_originala || cursLive.curs.toString(),
        sursa: 'BNR_Live'
      };

      return NextResponse.json({
        success: true,
        curs: cursLive.curs,
        moneda: cursLive.moneda,
        data: cursLive.data,
        source: 'bnr_live',
        precizie_originala: cursLive.precizie_originala
      });
    }

    // FALLBACK 2: Găsește cel mai apropiat curs din BigQuery
    const cursApropriat = await getClosestCursFromBigQuery(moneda, data);
    if (cursApropriat) {
      console.log(`📅 Folosesc cursul cel mai apropiat pentru ${moneda}: ${cursApropriat.data} (cerut: ${data})`);
      
      cursCache[cacheKey] = {
        curs: cursApropriat.curs,
        data: cursApropriat.data,
        timestamp: Date.now(),
        precizie_originala: cursApropriat.precizie_originala || cursApropriat.curs.toString(),
        sursa: 'BigQuery_Closest'
      };

      return NextResponse.json({
        success: true,
        curs: cursApropriat.curs,
        moneda: cursApropriat.moneda,
        data: cursApropriat.data,
        source: 'bigquery_closest',
        precizie_originala: cursApropriat.precizie_originala,
        warning: `Curs pentru ${cursApropriat.data} (cel mai apropiat de ${data})`
      });
    }

    // FALLBACK 3: API extern
    const fallbackActual = await getFallbackRateActual(moneda);
    
    if (fallbackActual) {
      return NextResponse.json({
        success: true,
        curs: fallbackActual.curs,
        moneda: moneda,
        data: new Date().toISOString().split('T')[0],
        source: 'fallback_actual',
        warning: 'Curs aproximativ din API alternativ - BigQuery și BNR indisponibile',
        precizie_originala: fallbackActual.precizie_originala
      });
    }

    throw new Error('Nu s-a putut obține cursul din nicio sursă');

  } catch (error) {
    console.error('Eroare la obținerea cursului valutar:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la obținerea cursului valutar',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// FIX PRINCIPAL: getCursFromBigQuery cu validări sigure
async function getCursFromBigQuery(moneda: string, data: string): Promise<CursValutar | null> {
  try {
    console.log(`🔍 BigQuery SEARCH: ${moneda} pentru ${data}`);

    const query = `
      SELECT 
        moneda,
        curs,
        data,
        precizie_originala,
        sursa
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
      WHERE data = '${data}' AND moneda = '${moneda}'
      LIMIT 1
    `;

    console.log(`🔍 Query executat:`, query);

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    console.log(`📊 Rezultat BigQuery:`, {
      rowCount: rows ? rows.length : 0,
      rows: rows
    });

    if (rows && rows.length > 0) {
      const row = rows[0];
      console.log(`✅ ROW GĂSIT:`, row);
      
      // FIX PRINCIPAL: Safe conversion pentru FLOAT cu validări
      const cursValue = ensureNumber(row.curs, 1);
      
      console.log(`💰 Curs procesat: ${formatWithOriginalPrecision(cursValue, row.precizie_originala)}`);
      
      return {
        moneda: row.moneda,
        curs: cursValue,
        data: row.data,
        precizie_originala: row.precizie_originala || cursValue.toString()
      };
    }

    console.log(`❌ NICIUN RÂND găsit pentru ${moneda} (${data})`);
    
    // DEBUG: Verifică ce date există pentru această monedă
    const debugQuery = `
      SELECT data, curs, precizie_originala 
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
      WHERE moneda = '${moneda}'
      ORDER BY data DESC
      LIMIT 5
    `;
    
    console.log(`🔍 DEBUG: Verificare date disponibile pentru ${moneda}:`);
    const [debugRows] = await bigquery.query({ query: debugQuery, location: 'EU' });
    console.log(`📅 Date disponibile:`, debugRows);
    
    return null;

  } catch (error) {
    console.error(`💥 EROARE BigQuery ${moneda} (${data}):`, error);
    return null;
  }
}

// Funcție pentru găsirea celui mai apropiat curs - ACTUALIZATĂ
async function getClosestCursFromBigQuery(moneda: string, data: string): Promise<CursValutar | null> {
  try {
    console.log(`🔍 Căutare curs apropiat în BigQuery: ${moneda} pentru ${data}`);

    const query = `
      SELECT 
        moneda,
        curs,
        data,
        precizie_originala,
        sursa,
        ABS(DATE_DIFF(@data, data, DAY)) as diferenta_zile
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
      WHERE moneda = @moneda 
        AND ABS(DATE_DIFF(@data, data, DAY)) <= 7  -- Maxim 7 zile diferență
      ORDER BY diferenta_zile ASC, data DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: {
        data: data,
        moneda: moneda
      },
      types: {
        data: 'DATE',
        moneda: 'STRING'
      },
      location: 'EU',
    });

    if (rows && rows.length > 0) {
      const row = rows[0];
      const cursValue = ensureNumber(row.curs, 1);
      
      console.log(`✅ Curs apropiat găsit în BigQuery: ${moneda} = ${formatWithOriginalPrecision(cursValue, row.precizie_originala)} (${row.data}, diferență: ${row.diferenta_zile} zile)`);
      
      return {
        moneda: row.moneda,
        curs: cursValue,
        data: row.data,
        precizie_originala: row.precizie_originala || cursValue.toString()
      };
    }

    console.log(`❌ Nu s-a găsit curs apropiat în BigQuery pentru ${moneda} (${data})`);
    return null;

  } catch (error) {
    console.error(`❌ Eroare căutare curs apropiat pentru ${moneda} (${data}):`, error);
    return null;
  }
}

// Funcție pentru salvarea cursului live în BigQuery - ACTUALIZATĂ
async function saveCursInBigQuery(curs: CursValutar): Promise<void> {
  try {
    console.log(`💾 Salvare curs live în BigQuery: ${curs.moneda} = ${formatWithOriginalPrecision(curs.curs, curs.precizie_originala)} (${curs.data})`);

    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('CursuriValutare');

    const record = [{
      data: curs.data,
      moneda: curs.moneda,
      curs: curs.curs,
      sursa: 'BNR_LIVE',
      precizie_originala: curs.precizie_originala || curs.curs.toString(),
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString(),
      observatii: 'Adăugat automat din BNR API live',
      validat: true,
      multiplicator: 1.0
    }];

    await table.insert(record);
    console.log(`✅ Curs salvat în BigQuery: ${curs.moneda} = ${formatWithOriginalPrecision(curs.curs, curs.precizie_originala)}`);

  } catch (error) {
    console.error(`❌ Eroare salvare curs în BigQuery:`, error);
    // Nu aruncă eroarea - este doar o optimizare
  }
}

// FIX PRINCIPAL: Funcție BNR live cu validări sigure și precizie originală
async function getCursBNRLive(moneda: string, data?: string): Promise<CursValutar | null> {
  try {
    const targetDate = data || new Date().toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    // Folosește BNR live doar pentru zilele foarte recente (ultimele 3 zile)
    const daysDiff = Math.abs(new Date(today).getTime() - new Date(targetDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 3) {
      console.log(`📅 Data ${targetDate} este prea veche pentru BNR live (${daysDiff.toFixed(1)} zile)`);
      return null;
    }
    
    console.log(`📡 Încercare BNR API live pentru ${moneda} (${targetDate})`);
    
    const bnrUrl = `https://www.bnr.ro/nbrfxrates.xml`;
    
    const response = await fetch(bnrUrl, {
      headers: {
        'User-Agent': 'UNITAR-PROIECT-BNR-CLIENT/2.0',
        'Accept': 'application/xml, text/xml',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(10000) // 10 secunde timeout
    });

    if (!response.ok) {
      console.log(`❌ BNR API returned ${response.status}`);
      return null;
    }

    const xmlText = await response.text();
    
    const cursMatch = xmlText.match(new RegExp(`<Rate currency="${moneda}"[^>]*>([^<]+)<\/Rate>`, 'i'));
    const multiplierMatch = xmlText.match(new RegExp(`<Rate currency="${moneda}"[^>]*multiplier="([^"]+)"`, 'i'));
    const dateMatch = xmlText.match(/<DataSet[^>]*date="([^"]+)"/);
    
    if (cursMatch) {
      const cursStringOriginal = cursMatch[1].trim();
      const cursValue = ensureNumber(cursStringOriginal, 1);
      const multiplier = multiplierMatch ? ensureNumber(multiplierMatch[1], 1) : 1;
      const bnrDate = dateMatch ? dateMatch[1] : targetDate;
      
      const finalRate = cursValue / multiplier;
      
      console.log(`✅ BNR live rate found: ${moneda} = ${formatWithOriginalPrecision(finalRate, cursStringOriginal)} (${bnrDate})`);
      
      return {
        moneda,
        curs: finalRate,
        data: bnrDate,
        precizie_originala: cursStringOriginal  // FIX: Păstrez precizia originală din XML
      };
    }

    console.log(`❌ Currency ${moneda} not found in BNR live data`);
    return null;

  } catch (error) {
    console.error(`❌ Error fetching BNR live rate for ${moneda}:`, error);
    return null;
  }
}

// Funcție fallback pentru API-uri alternative - ACTUALIZATĂ
async function getFallbackRateActual(moneda: string): Promise<CursValutar | null> {
  const alternativeAPIs = [
    {
      name: 'ExchangeRate-API',
      url: `https://api.exchangerate-api.com/v4/latest/RON`,
      parse: (data: any) => {
        if (data.rates && data.rates[moneda]) {
          const rate = 1 / ensureNumber(data.rates[moneda], 1);
          return {
            curs: rate,
            precizie_originala: rate.toString()  // FIX: Păstrez precizia naturală
          };
        }
        return null;
      }
    },
    {
      name: 'Fixer.io (free tier)',
      url: `https://api.fixer.io/latest?base=RON&symbols=${moneda}`,
      parse: (data: any) => {
        if (data.rates && data.rates[moneda]) {
          const rate = 1 / ensureNumber(data.rates[moneda], 1);
          return {
            curs: rate,
            precizie_originala: rate.toString()  // FIX: Păstrez precizia naturală
          };
        }
        return null;
      }
    }
  ];

  for (const api of alternativeAPIs) {
    try {
      console.log(`🔄 Trying fallback API: ${api.name} for ${moneda}`);
      
      const response = await fetch(api.url, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = api.parse(data);
        
        if (result) {
          console.log(`✅ Fallback rate found from ${api.name}: ${moneda} = ${formatWithOriginalPrecision(result.curs, result.precizie_originala)} RON`);
          
          return {
            moneda,
            curs: result.curs,
            data: new Date().toISOString().split('T')[0],
            precizie_originala: result.precizie_originala
          };
        }
      }
    } catch (error) {
      console.warn(`⚠️ ${api.name} API failed for ${moneda}:`, error);
      continue;
    }
  }

  // ULTIMUL RESORT: Cursuri estimate actuale (actualizate) - FIX: Fără forțare zecimale
  console.log(`🔄 Using last resort estimated rates for ${moneda}`);
  
  const cursuriEstimate: { [key: string]: number } = {
    'EUR': 4.9755,
    'USD': 4.5234,
    'GBP': 5.7892
  };
  
  if (cursuriEstimate[moneda]) {
    const cursEstimat = cursuriEstimate[moneda];
    console.log(`📊 Using estimated rate for ${moneda}: ${formatWithOriginalPrecision(cursEstimat)} RON`);
    
    return {
      moneda,
      curs: cursEstimat,
      data: new Date().toISOString().split('T')[0],
      precizie_originala: cursEstimat.toString()  // FIX: Păstrez precizia naturală
    };
  }

  console.error(`❌ No fallback rate available for ${moneda}`);
  return null;
}

// POST endpoint pentru conversii - ACTUALIZAT cu validări sigure
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { valoare, monedaSursa, monedaDestinatie, data } = body;

    if (!valoare || !monedaSursa || !monedaDestinatie) {
      return NextResponse.json({
        success: false,
        error: 'Parametri obligatorii: valoare, monedaSursa, monedaDestinatie'
      }, { status: 400 });
    }

    // FIX PRINCIPAL: Validare sigură pentru valoare
    const valoareSigura = ensureNumber(valoare, 0);
    if (valoareSigura <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Valoarea trebuie să fie un număr pozitiv'
      }, { status: 400 });
    }

    // Dacă ambele monede sunt RON, nu e nevoie de conversie
    if (monedaSursa === 'RON' && monedaDestinatie === 'RON') {
      return NextResponse.json({
        success: true,
        valoareOriginala: valoareSigura,
        valoareConvertita: valoareSigura,
        curs: 1,
        monedaSursa,
        monedaDestinatie,
        data: data || new Date().toISOString().split('T')[0]
      });
    }

    let curs = 1;
    let valoareConvertita = valoareSigura;

    if (monedaSursa === 'RON') {
      // Convertește din RON în altă monedă - folosește BigQuery
      const cursDestinatie = await getCursFromBigQuery(monedaDestinatie, data) || 
                             await getCursBNRLive(monedaDestinatie, data);
      if (cursDestinatie) {
        curs = 1 / cursDestinatie.curs;
        valoareConvertita = valoareSigura / cursDestinatie.curs;
      }
    } else if (monedaDestinatie === 'RON') {
      // Convertește din altă monedă în RON - folosește BigQuery
      const cursSursa = await getCursFromBigQuery(monedaSursa, data) || 
                        await getCursBNRLive(monedaSursa, data);
      if (cursSursa) {
        curs = cursSursa.curs;
        valoareConvertita = valoareSigura * cursSursa.curs;
      }
    } else {
      // Convertește între două monede străine prin RON - folosește BigQuery
      const cursSursa = await getCursFromBigQuery(monedaSursa, data) || 
                        await getCursBNRLive(monedaSursa, data);
      const cursDestinatie = await getCursFromBigQuery(monedaDestinatie, data) || 
                             await getCursBNRLive(monedaDestinatie, data);
      
      if (cursSursa && cursDestinatie) {
        const valoareRON = valoareSigura * cursSursa.curs;
        valoareConvertita = valoareRON / cursDestinatie.curs;
        curs = cursSursa.curs / cursDestinatie.curs;
      }
    }

    // FIX PRINCIPAL: Validări sigure pentru rezultate
    const valoareConvertitataSigura = ensureNumber(valoareConvertita, 0);
    const cursSigur = ensureNumber(curs, 1);

    return NextResponse.json({
      success: true,
      valoareOriginala: valoareSigura,
      valoareConvertita: Number(valoareConvertitataSigura.toFixed(2)),
      curs: Number(cursSigur.toFixed(6)),
      monedaSursa,
      monedaDestinatie,
      data: data || new Date().toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('Eroare la conversia valutară:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la conversia valutară',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// Endpoint pentru curățarea cache-ului - PĂSTRAT
export async function DELETE() {
  cursCache = {};
  console.log('🧹 Cache curs valutar șters complet');
  return NextResponse.json({
    success: true,
    message: 'Cache curs valutar șters cu succes - vor fi prelucrate cursuri noi din BigQuery'
  });
}
