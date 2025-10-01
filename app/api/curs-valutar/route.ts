// ==================================================================
// CALEA: app/api/curs-valutar/route.ts
// DATA: 18.08.2025 17:00 (ora României)
// EXTINDERE COMPLETĂ: Adăugat PUT endpoint pentru sync zilnic la 05:00
// PĂSTRATE: Toate funcționalitățile existente GET/POST/DELETE
// NOU: PUT pentru completarea zilelor lipsă + sync automat
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

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// Inițializare BigQuery
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const CURS_TABLE = `\`${PROJECT_ID}.${DATASET}.CursuriValutare${tableSuffix}\``;

console.log(`🔧 [Curs Valutar] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// Helper pentru validări sigure
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

// Helper pentru formatare sigură cu precizie originală
const formatWithOriginalPrecision = (value: any, originalPrecision?: string): string => {
  if (originalPrecision && originalPrecision !== 'undefined' && originalPrecision !== 'null') {
    return originalPrecision;
  }
  
  const num = ensureNumber(value);
  return num.toString();
};

// Cache îmbunătățit cu precizie originală
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

// ===================================================================
// GET ENDPOINT - PĂSTRAT IDENTIC
// ===================================================================
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

// ===================================================================
// NOU: PUT ENDPOINT PENTRU SYNC ZILNIC LA 05:00
// ===================================================================
export async function PUT(request: NextRequest) {
  try {
    console.log('🕐 [05:00 SYNC] Începe sincronizarea zilnică a cursurilor...');
    
    const body = await request.json().catch(() => ({}));
    const { 
      dataSpecifica, 
      forceResync = false, 
      curataZileLipsa = true 
    } = body;

    // Determină data pentru care să sincronizeze
    const targetDate = dataSpecifica || new Date().toISOString().split('T')[0];
    
    console.log(`📅 Target date pentru sync: ${targetDate}`);

    const rezultate = {
      success: true,
      dataSync: targetDate,
      cursurAdaugate: 0,
      cursurActualizate: 0,
      zileLipsaCompletate: 0,
      cursuriEroare: [] as string[],
      detalii: [] as string[]
    };

    const monede = ['EUR', 'USD', 'GBP'];

    // PASUL 1: Sincronizează cursul pentru data specificată
    console.log(`🔄 PASUL 1: Sincronizare curs pentru ${targetDate}`);
    
    for (const moneda of monede) {
      try {
        const rezultatSync = await sincronizeazaCursPentruZi(moneda, targetDate, forceResync);
        
        if (rezultatSync.adaugat) {
          rezultate.cursurAdaugate++;
          rezultate.detalii.push(`✅ ${moneda}: ${rezultatSync.curs} (${rezultatSync.sursa})`);
        } else if (rezultatSync.actualizat) {
          rezultate.cursurActualizate++;
          rezultate.detalii.push(`🔄 ${moneda}: ${rezultatSync.curs} (actualizat)`);
        } else {
          rezultate.detalii.push(`ℹ️ ${moneda}: există deja (${rezultatSync.curs})`);
        }

      } catch (error) {
        console.error(`❌ Eroare sync ${moneda} pentru ${targetDate}:`, error);
        rezultate.cursuriEroare.push(`${moneda}: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      }
    }

    // PASUL 2: Completează zilele lipsă din trecut (dacă e activat)
    if (curataZileLipsa) {
      console.log(`🧹 PASUL 2: Completare zile lipsă din trecut...`);
      
      const zileLipsa = await gasestZileLipsaDinTrecut(targetDate);
      console.log(`📋 Găsite ${zileLipsa.length} zile lipsă în trecut`);

      for (const ziLipsa of zileLipsa) {
        try {
          const rezultatLipsa = await completeazaZiLipsa(ziLipsa);
          rezultate.zileLipsaCompletate += rezultatLipsa.cursurAdaugate;
          rezultate.detalii.push(`📅 ${ziLipsa}: completat cu ${rezultatLipsa.cursurAdaugate} cursuri`);
          
        } catch (error) {
          console.error(`❌ Eroare completare zi lipsă ${ziLipsa}:`, error);
          rezultate.cursuriEroare.push(`Zi ${ziLipsa}: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
        }
      }
    }

    // PASUL 3: Curăță cache-ul pentru date proaspete
    cursCache = {};
    console.log('🧹 Cache curs valutar șters după sync');

    // PASUL 4: Curăță eventualele teste rămase
    await curataTeste();

    console.log(`✅ [05:00 SYNC] Finalizat cu succes:`, rezultate);

    return NextResponse.json(rezultate);

  } catch (error) {
    console.error('❌ Eroare la sincronizarea zilnică:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Eroare la sincronizarea zilnică a cursurilor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// ===================================================================
// FUNCȚII HELPER PENTRU PUT ENDPOINT
// ===================================================================

// Sincronizează cursul pentru o zi și o monedă specifică
async function sincronizeazaCursPentruZi(
  moneda: string, 
  data: string, 
  forceResync: boolean = false
): Promise<{ adaugat: boolean; actualizat: boolean; curs: number; sursa: string }> {
  
  // Verifică dacă cursul există deja
  const cursExistent = await getCursFromBigQuery(moneda, data);
  
  if (cursExistent && !forceResync) {
    return {
      adaugat: false,
      actualizat: false,
      curs: cursExistent.curs,
      sursa: 'existent'
    };
  }

  // Determină ziua bancară anterioară pentru a obține cursul corect
  const ziuaBancaraAnterioara = await gasestUltimaZiBancara(data);
  console.log(`🏦 Pentru ${data}, ultima zi bancară: ${ziuaBancaraAnterioara}`);

  // Încearcă să obțină cursul din ziua bancară anterioară
  let cursDeAplicat: CursValutar | null = null;

  // 1. Încearcă din BigQuery pentru ziua bancară anterioară
  if (ziuaBancaraAnterioara !== data) {
    cursDeAplicat = await getCursFromBigQuery(moneda, ziuaBancaraAnterioara);
    if (cursDeAplicat) {
      console.log(`📊 Folosesc cursul din BigQuery (${ziuaBancaraAnterioara}) pentru ${data}`);
    }
  }

  // 2. Încearcă BNR live pentru ziua bancară anterioară
  if (!cursDeAplicat) {
    cursDeAplicat = await getCursBNRLive(moneda, ziuaBancaraAnterioara);
    if (cursDeAplicat) {
      console.log(`📡 Obținut curs BNR live pentru ${ziuaBancaraAnterioara}, aplicat pentru ${data}`);
    }
  }

  // 3. Fallback - cel mai apropiat curs
  if (!cursDeAplicat) {
    cursDeAplicat = await getClosestCursFromBigQuery(moneda, data);
    if (cursDeAplicat) {
      console.log(`🔍 Folosesc cel mai apropiat curs: ${cursDeAplicat.data} pentru ${data}`);
    }
  }

  if (!cursDeAplicat) {
    throw new Error(`Nu s-a putut găsi niciun curs pentru ${moneda} în jurul datei ${data}`);
  }

  // Creează recordul pentru inserare/actualizare
  const cursNou: CursValutar = {
    moneda,
    curs: cursDeAplicat.curs,
    data,
    precizie_originala: cursDeAplicat.precizie_originala
  };

  // Determină sursa și observațiile
  const esteWeekend = esteZiDeWeekend(data);
  const esteSarbatoare = await esteZiDeSarbatoare(data);
  
  let sursa = 'BNR_SYNC_DAILY';
  let observatii = `Sync zilnic 05:00 - curs preluat din ${ziuaBancaraAnterioara}`;
  
  if (esteWeekend) {
    sursa = 'BNR_WEEKEND_DUPLICATE';
    observatii = `Weekend - curs duplicat din ultima zi bancară (${ziuaBancaraAnterioara})`;
  } else if (esteSarbatoare) {
    sursa = 'BNR_HOLIDAY_DUPLICATE';
    observatii = `Sărbătoare - curs duplicat din ultima zi bancară (${ziuaBancaraAnterioara})`;
  }

  if (cursExistent && forceResync) {
    // Actualizează
    await actualizeazaCursInBigQuery(cursNou, sursa, observatii);
    return {
      adaugat: false,
      actualizat: true,
      curs: cursNou.curs,
      sursa: 'actualizat'
    };
  } else {
    // Inserează
    await salvezCursInBigQueryCuDetalii(cursNou, sursa, observatii);
    return {
      adaugat: true,
      actualizat: false,
      curs: cursNou.curs,
      sursa
    };
  }
}

// Găsește zilele lipsă din trecut
async function gasestZileLipsaDinTrecut(panaLaData: string): Promise<string[]> {
  try {
    const query = `
      WITH date_consecutives AS (
        SELECT DATE_ADD('2025-01-01', INTERVAL n DAY) as data_consecutiva
        FROM UNNEST(GENERATE_ARRAY(0, DATE_DIFF('${panaLaData}', '2025-01-01', DAY))) as n
      ),
      date_existente AS (
        SELECT DISTINCT data
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
        WHERE data BETWEEN '2025-01-01' AND '${panaLaData}'
          AND moneda IN ('EUR', 'USD', 'GBP')
      ),
      zile_cu_toate_monedele AS (
        SELECT data
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
        WHERE data BETWEEN '2025-01-01' AND '${panaLaData}'
          AND moneda IN ('EUR', 'USD', 'GBP')
        GROUP BY data
        HAVING COUNT(DISTINCT moneda) = 3
      )
      SELECT dc.data_consecutiva
      FROM date_consecutives dc
      LEFT JOIN zile_cu_toate_monedele ztm ON dc.data_consecutiva = ztm.data
      WHERE ztm.data IS NULL
      ORDER BY dc.data_consecutiva
    `;

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    return rows.map(row => row.data_consecutiva);

  } catch (error) {
    console.error('❌ Eroare găsire zile lipsă:', error);
    return [];
  }
}

// Completează o zi lipsă cu cursurile necesare
async function completeazaZiLipsa(data: string): Promise<{ cursurAdaugate: number }> {
  const monede = ['EUR', 'USD', 'GBP'];
  let cursurAdaugate = 0;

  for (const moneda of monede) {
    try {
      // Verifică dacă moneda există pentru această zi
      const cursExistent = await getCursFromBigQuery(moneda, data);
      if (cursExistent) {
        continue; // Skip dacă există deja
      }

      // Sincronizează moneda pentru această zi
      const rezultat = await sincronizeazaCursPentruZi(moneda, data, false);
      if (rezultat.adaugat) {
        cursurAdaugate++;
      }

    } catch (error) {
      console.warn(`⚠️ Nu s-a putut completa ${moneda} pentru ${data}:`, error);
    }
  }

  return { cursurAdaugate };
}

// Găsește ultima zi bancară anterioară unei date
async function gasestUltimaZiBancara(data: string): Promise<string> {
  const targetDate = new Date(data);
  
  // Începe cu ziua anterioară
  for (let i = 1; i <= 10; i++) { // Maxim 10 zile în urmă (acoperă sărbători lungi)
    const candidatDate = new Date(targetDate);
    candidatDate.setDate(candidatDate.getDate() - i);
    
    const candidatString = candidatDate.toISOString().split('T')[0];
    
    // Verifică dacă nu e weekend
    if (!esteZiDeWeekend(candidatString)) {
      // Verifică dacă nu e sărbătoare
      const esteSarbatoare = await esteZiDeSarbatoare(candidatString);
      if (!esteSarbatoare) {
        return candidatString;
      }
    }
  }
  
  // Fallback - returnează ziua anterioară
  const fallbackDate = new Date(targetDate);
  fallbackDate.setDate(fallbackDate.getDate() - 1);
  return fallbackDate.toISOString().split('T')[0];
}

// Verifică dacă o zi este weekend
function esteZiDeWeekend(data: string): boolean {
  const dayOfWeek = new Date(data).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = duminică, 6 = sâmbătă
}

// Verifică dacă o zi este sărbătoare (simplificat - poate fi extins)
async function esteZiDeSarbatoare(data: string): Promise<boolean> {
  // Sărbători fixe românești pentru 2025
  const sarbatoriFix = [
    '2025-01-01', // Anul Nou
    '2025-01-02', // Anul Nou
    '2025-01-06', // Boboteaza
    '2025-05-01', // Ziua Muncii
    '2025-12-01', // Ziua Națională
    '2025-12-25', // Crăciun
    '2025-12-26', // Crăciun
  ];

  // Sărbători mobile pentru 2025 (calculate pentru 2025)
  const sarbatoriMobile = [
    '2025-04-20', // Duminica Ortodoxă
    '2025-04-21', // Lunea Ortodoxă  
    '2025-06-08', // Rusaliile
    '2025-06-09', // Lunea Rusaliilor
    '2025-08-15', // Adormirea Maicii Domnului
  ];

  return sarbatoriFix.includes(data) || sarbatoriMobile.includes(data);
}

// Salvează curs în BigQuery cu detalii complete
async function salvezCursInBigQueryCuDetalii(
  curs: CursValutar, 
  sursa: string, 
  observatii: string
): Promise<void> {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('CursuriValutare');

    const record = [{
      data: curs.data,
      moneda: curs.moneda,
      curs: curs.curs,
      sursa: sursa,
      precizie_originala: ensureNumber(curs.precizie_originala || curs.curs),
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString(),
      observatii: observatii,
      validat: true,
      multiplicator: 1
    }];

    await table.insert(record);
    console.log(`✅ Salvat în BigQuery: ${curs.moneda} = ${curs.curs} (${curs.data}) - ${sursa}`);

  } catch (error) {
    console.error(`❌ Eroare salvare în BigQuery:`, error);
    throw error;
  }
}

// Actualizează curs existent în BigQuery
async function actualizeazaCursInBigQuery(
  curs: CursValutar, 
  sursa: string, 
  observatii: string
): Promise<void> {
  try {
    const query = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
      SET 
        curs = @curs,
        sursa = @sursa,
        precizie_originala = @precizie_originala,
        data_actualizare = CURRENT_TIMESTAMP(),
        observatii = @observatii
      WHERE data = @data AND moneda = @moneda
    `;

    await bigquery.query({
      query: query,
      params: {
        curs: curs.curs,
        sursa: sursa,
        precizie_originala: ensureNumber(curs.precizie_originala || curs.curs),
        observatii: observatii,
        data: curs.data,
        moneda: curs.moneda
      },
      location: 'EU',
    });

    console.log(`🔄 Actualizat în BigQuery: ${curs.moneda} = ${curs.curs} (${curs.data})`);

  } catch (error) {
    console.error(`❌ Eroare actualizare în BigQuery:`, error);
    throw error;
  }
}

// Curăță testele rămase
async function curataTeste(): Promise<void> {
  try {
    const query = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.CursuriValutare\`
      WHERE moneda = 'TEST' OR sursa LIKE '%TEST%'
    `;

    await bigquery.query({
      query: query,
      location: 'EU',
    });

    console.log('Operațiune curățare teste executată cu succes');

  } catch (error) {
    console.warn('Nu s-au putut curăța testele:', error);
  }
}

// ===================================================================
// FUNCȚII EXISTENTE - PĂSTRATE IDENTIC
// ===================================================================

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

    const [rows] = await bigquery.query({
      query: query,
      location: 'EU',
    });

    if (rows && rows.length > 0) {
      const row = rows[0];
      const cursValue = ensureNumber(row.curs, 1);
      
      return {
        moneda: row.moneda,
        curs: cursValue,
        data: row.data,
        precizie_originala: row.precizie_originala?.toString() || cursValue.toString()
      };
    }

    return null;

  } catch (error) {
    console.error(`💥 EROARE BigQuery ${moneda} (${data}):`, error);
    return null;
  }
}

async function getClosestCursFromBigQuery(moneda: string, data: string): Promise<CursValutar | null> {
  try {
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
        AND ABS(DATE_DIFF(@data, data, DAY)) <= 7
      ORDER BY diferenta_zile ASC, data DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { data: data, moneda: moneda },
      types: { data: 'DATE', moneda: 'STRING' },
      location: 'EU',
    });

    if (rows && rows.length > 0) {
      const row = rows[0];
      const cursValue = ensureNumber(row.curs, 1);
      
      return {
        moneda: row.moneda,
        curs: cursValue,
        data: row.data,
        precizie_originala: row.precizie_originala?.toString() || cursValue.toString()
      };
    }

    return null;

  } catch (error) {
    console.error(`❌ Eroare căutare curs apropiat pentru ${moneda} (${data}):`, error);
    return null;
  }
}

async function saveCursInBigQuery(curs: CursValutar): Promise<void> {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('CursuriValutare');

    const record = [{
      data: curs.data,
      moneda: curs.moneda,
      curs: curs.curs,
      sursa: 'BNR_LIVE',
      precizie_originala: ensureNumber(curs.precizie_originala || curs.curs),
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString(),
      observatii: 'Adăugat automat din BNR API live',
      validat: true,
      multiplicator: 1
    }];

    await table.insert(record);
    console.log(`✅ Curs salvat în BigQuery: ${curs.moneda} = ${formatWithOriginalPrecision(curs.curs, curs.precizie_originala)}`);

  } catch (error) {
    console.error(`❌ Eroare salvare curs în BigQuery:`, error);
  }
}

async function getCursBNRLive(moneda: string, data?: string): Promise<CursValutar | null> {
  try {
    const targetDate = data || new Date().toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
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
      signal: AbortSignal.timeout(10000)
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
        precizie_originala: cursStringOriginal
      };
    }

    console.log(`❌ Currency ${moneda} not found in BNR live data`);
    return null;

  } catch (error) {
    console.error(`❌ Error fetching BNR live rate for ${moneda}:`, error);
    return null;
  }
}

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
            precizie_originala: rate.toString()
          };
        }
        return null;
      }
    }
  ];

  for (const api of alternativeAPIs) {
    try {
      const response = await fetch(api.url, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = api.parse(data);
        
        if (result) {
          return {
            moneda,
            curs: result.curs,
            data: new Date().toISOString().split('T')[0],
            precizie_originala: result.precizie_originala
          };
        }
      }
    } catch (error) {
      continue;
    }
  }

  const cursuriEstimate: { [key: string]: number } = {
    'EUR': 4.9755,
    'USD': 4.5234,
    'GBP': 5.7892
  };
  
  if (cursuriEstimate[moneda]) {
    const cursEstimat = cursuriEstimate[moneda];
    
    return {
      moneda,
      curs: cursEstimat,
      data: new Date().toISOString().split('T')[0],
      precizie_originala: cursEstimat.toString()
    };
  }

  return null;
}

// ===================================================================
// POST ENDPOINT - PĂSTRAT IDENTIC
// ===================================================================
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

    const valoareSigura = ensureNumber(valoare, 0);
    if (valoareSigura <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Valoarea trebuie să fie un număr pozitiv'
      }, { status: 400 });
    }

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
      const cursDestinatie = await getCursFromBigQuery(monedaDestinatie, data) || 
                             await getCursBNRLive(monedaDestinatie, data);
      if (cursDestinatie) {
        curs = 1 / cursDestinatie.curs;
        valoareConvertita = valoareSigura / cursDestinatie.curs;
      }
    } else if (monedaDestinatie === 'RON') {
      const cursSursa = await getCursFromBigQuery(monedaSursa, data) || 
                        await getCursBNRLive(monedaSursa, data);
      if (cursSursa) {
        curs = cursSursa.curs;
        valoareConvertita = valoareSigura * cursSursa.curs;
      }
    } else {
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

// ===================================================================
// DELETE ENDPOINT - PĂSTRAT IDENTIC
// ===================================================================
export async function DELETE() {
  cursCache = {};
  console.log('🧹 Cache curs valutar șters complet');
  return NextResponse.json({
    success: true,
    message: 'Cache curs valutar șters cu succes - vor fi prelucrate cursuri noi din BigQuery'
  });
}
