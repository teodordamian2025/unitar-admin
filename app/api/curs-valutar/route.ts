// ==================================================================
// CALEA: app/api/curs-valutar/route.ts
// DESCRIERE: API pentru integrarea cu BNR pentru cursul valutar
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';

interface CursValutar {
  moneda: string;
  curs: number;
  data: string;
}

interface BNRRate {
  code: string;
  multiplier: number;
  value: number;
}

// Cache pentru cursuri (evită apeluri multiple în aceeași zi)
let cursCache: { [key: string]: { curs: number; data: string; timestamp: number } } = {};
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 ore în milisecunde

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moneda = searchParams.get('moneda') || 'EUR';
    const data = searchParams.get('data') || new Date().toISOString().split('T')[0];

    // Verifică cache-ul mai întâi
    const cacheKey = `${moneda}_${data}`;
    const cachedData = cursCache[cacheKey];
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      console.log(`📊 Returning cached rate for ${moneda}:`, cachedData.curs);
      return NextResponse.json({
        success: true,
        curs: cachedData.curs,
        moneda: moneda,
        data: cachedData.data,
        source: 'cache'
      });
    }

    // Apelează API-ul BNR
    const cursValutar = await getCursBNR(moneda, data);
    
    if (cursValutar) {
      // Salvează în cache
      cursCache[cacheKey] = {
        curs: cursValutar.curs,
        data: cursValutar.data,
        timestamp: Date.now()
      };

      return NextResponse.json({
        success: true,
        curs: cursValutar.curs,
        moneda: cursValutar.moneda,
        data: cursValutar.data,
        source: 'bnr'
      });
    } else {
      throw new Error('Nu s-a putut obține cursul BNR');
    }

  } catch (error) {
    console.error('Eroare la obținerea cursului valutar:', error);
    
    // Fallback la cursuri aproximative dacă BNR nu răspunde
    const fallbackRates: { [key: string]: number } = {
      'EUR': 4.97,
      'USD': 4.52,
      'GBP': 5.72,
      'CHF': 5.15
    };

    if (fallbackRates[moneda]) {
      return NextResponse.json({
        success: true,
        curs: fallbackRates[moneda],
        moneda: moneda,
        data: new Date().toISOString().split('T')[0],
        source: 'fallback',
        warning: 'Curs aproximativ - BNR indisponibil'
      });
    }

    return NextResponse.json({ 
      success: false,
      error: 'Eroare la obținerea cursului valutar',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

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

    // Dacă ambele monede sunt RON, nu e nevoie de conversie
    if (monedaSursa === 'RON' && monedaDestinatie === 'RON') {
      return NextResponse.json({
        success: true,
        valoareOriginala: valoare,
        valoareConvertita: valoare,
        curs: 1,
        monedaSursa,
        monedaDestinatie,
        data: data || new Date().toISOString().split('T')[0]
      });
    }

    let curs = 1;
    let valoareConvertita = valoare;

    if (monedaSursa === 'RON') {
      // Convertește din RON în altă monedă
      const cursDestinatie = await getCursBNR(monedaDestinatie, data);
      if (cursDestinatie) {
        curs = 1 / cursDestinatie.curs;
        valoareConvertita = valoare / cursDestinatie.curs;
      }
    } else if (monedaDestinatie === 'RON') {
      // Convertește din altă monedă în RON
      const cursSursa = await getCursBNR(monedaSursa, data);
      if (cursSursa) {
        curs = cursSursa.curs;
        valoareConvertita = valoare * cursSursa.curs;
      }
    } else {
      // Convertește între două monede străine prin RON
      const cursSursa = await getCursBNR(monedaSursa, data);
      const cursDestinatie = await getCursBNR(monedaDestinatie, data);
      
      if (cursSursa && cursDestinatie) {
        const valoareRON = valoare * cursSursa.curs;
        valoareConvertita = valoareRON / cursDestinatie.curs;
        curs = cursSursa.curs / cursDestinatie.curs;
      }
    }

    return NextResponse.json({
      success: true,
      valoareOriginala: valoare,
      valoareConvertita: Number(valoareConvertita.toFixed(2)),
      curs: Number(curs.toFixed(4)),
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

// Funcție helper pentru apelarea API-ului BNR
async function getCursBNR(moneda: string, data?: string): Promise<CursValutar | null> {
  try {
    // Data în format YYYY-MM-DD
    const targetDate = data || new Date().toISOString().split('T')[0];
    
    // API BNR oficial - format XML
    const bnrUrl = `https://www.bnr.ro/nbrfxrates.xml`;
    
    console.log(`📡 Calling BNR API for ${moneda} on ${targetDate}`);
    
    const response = await fetch(bnrUrl, {
      headers: {
        'User-Agent': 'UNITAR-PROIECT/1.0',
        'Accept': 'application/xml, text/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`BNR API returned ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML simplu pentru a extrage cursul
    const cursMatch = xmlText.match(new RegExp(`<Rate currency="${moneda}"[^>]*>([^<]+)<\/Rate>`, 'i'));
    const multiplierMatch = xmlText.match(new RegExp(`<Rate currency="${moneda}"[^>]*multiplier="([^"]+)"`, 'i'));
    const dateMatch = xmlText.match(/<DataSet[^>]*date="([^"]+)"/);
    
    if (cursMatch) {
      const cursValue = parseFloat(cursMatch[1]);
      const multiplier = multiplierMatch ? parseFloat(multiplierMatch[1]) : 1;
      const bnrDate = dateMatch ? dateMatch[1] : targetDate;
      
      const finalRate = cursValue / multiplier;
      
      console.log(`✅ BNR rate found: ${moneda} = ${finalRate} RON (date: ${bnrDate})`);
      
      return {
        moneda,
        curs: finalRate,
        data: bnrDate
      };
    } else {
      console.warn(`⚠️ Currency ${moneda} not found in BNR data`);
      return null;
    }

  } catch (error) {
    console.error(`❌ Error fetching BNR rate for ${moneda}:`, error);
    
    // Fallback la API-uri alternative (opțional)
    return await getFallbackRate(moneda, data);
  }
}

// Funcție fallback pentru API-uri alternative
async function getFallbackRate(moneda: string, data?: string): Promise<CursValutar | null> {
  try {
    // API alternativ gratuit - ExchangeRate-API
    const fallbackUrl = `https://api.exchangerate-api.com/v4/latest/RON`;
    
    console.log(`🔄 Trying fallback API for ${moneda}`);
    
    const response = await fetch(fallbackUrl);
    const data_api = await response.json();
    
    if (data_api.rates && data_api.rates[moneda]) {
      const rate = 1 / data_api.rates[moneda]; // Inversăm pentru a avea RON ca bază
      
      console.log(`✅ Fallback rate found: ${moneda} = ${rate} RON`);
      
      return {
        moneda,
        curs: rate,
        data: data || new Date().toISOString().split('T')[0]
      };
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Fallback API also failed for ${moneda}:`, error);
    return null;
  }
}

// Endpoint pentru curățarea cache-ului (util pentru development)
export async function DELETE() {
  cursCache = {};
  return NextResponse.json({
    success: true,
    message: 'Cache curs valutar șters cu succes'
  });
}
