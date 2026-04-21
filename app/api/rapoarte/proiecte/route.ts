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
// FIX 14.12.2025: Adăugat escape pentru newline și alte caractere speciale
// pentru a evita eroarea "Unclosed string literal" în BigQuery
const escapeString = (value: string): string => {
  return value
    .replace(/\\/g, '\\\\')  // Escape backslash first
    .replace(/'/g, "''")     // Escape single quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t');  // Escape tabs
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

    // FIX CRITICAL: Query cu JOIN pentru datele clientului + contracte + facturi directe
    // MODIFICAT 16.12.2025: Adăugat CTE pentru facturi directe (tip_etapa = 'factura_directa')
    // MODIFICAT 06.01.2026: Adăugat CTE pentru count comentarii per proiect
    // MODIFICAT 08.01.2026: Adăugat CTE pentru toti responsabilii proiect (Principal, Normal, Observator)
    let baseQuery = `
      WITH responsabili_proiect AS (
        SELECT
          pr.proiect_id,
          ARRAY_AGG(
            STRUCT(
              pr.responsabil_uid,
              pr.responsabil_nume,
              pr.rol_in_proiect,
              u.prenume,
              u.nume
            )
            ORDER BY
              CASE pr.rol_in_proiect
                WHEN 'Principal' THEN 1
                WHEN 'Normal' THEN 2
                WHEN 'Observator' THEN 3
                ELSE 4
              END,
              pr.data_atribuire ASC
          ) as responsabili
        FROM \`${PROJECT_ID}.${dataset}.ProiecteResponsabili${tableSuffix}\` pr
        LEFT JOIN \`${PROJECT_ID}.${dataset}.Utilizatori${tableSuffix}\` u
          ON pr.responsabil_uid = u.uid
        GROUP BY pr.proiect_id
      ),
      comentarii_count AS (
        SELECT
          proiect_id,
          COUNT(*) as total_comentarii,
          MAX(data_comentariu) as ultimul_comentariu_data,
          ARRAY_AGG(
            STRUCT(autor_nume, comentariu, data_comentariu)
            ORDER BY data_comentariu DESC
            LIMIT 1
          )[SAFE_OFFSET(0)] as ultim_comentariu
        FROM \`${PROJECT_ID}.${dataset}.ProiectComentarii${tableSuffix}\`
        GROUP BY proiect_id
      ),
      -- NOU 26.01.2026: CTE pentru facturi per contract (etape + anexe)
      facturi_per_contract AS (
        SELECT
          ec.contract_id,
          ec.subproiect_id,
          ARRAY_AGG(
            STRUCT(
              ef.id as etapa_factura_id,
              ef.factura_id,
              CONCAT(fg.serie, '-', fg.numar) as numar_factura,
              fg.serie as factura_serie,
              fg.numar as factura_numar,
              ef.valoare,
              ef.moneda,
              ef.valoare_ron,
              ef.status_incasare,
              ef.data_facturare,
              ef.data_incasare,
              ef.valoare_incasata,
              fg.data_factura,
              fg.data_scadenta,
              fg.total as factura_total,
              ec.etapa_index,
              ec.denumire as etapa_denumire,
              ec.subproiect_id as factura_subproiect_id
            )
            ORDER BY ef.data_facturare DESC
          ) as facturi_etape
        FROM \`${PROJECT_ID}.${dataset}.EtapeContract${tableSuffix}\` ec
        JOIN \`${PROJECT_ID}.${dataset}.EtapeFacturi${tableSuffix}\` ef
          ON ef.etapa_id = ec.ID_Etapa AND ef.activ = true
        JOIN \`${PROJECT_ID}.${dataset}.FacturiGenerate${tableSuffix}\` fg
          ON ef.factura_id = fg.id
        GROUP BY ec.contract_id, ec.subproiect_id
      ),
      -- NOU 26.01.2026: CTE pentru facturi per anexă
      facturi_per_anexa AS (
        SELECT
          an.contract_id,
          an.subproiect_id,
          ARRAY_AGG(
            STRUCT(
              ef.id as etapa_factura_id,
              ef.factura_id,
              CONCAT(fg.serie, '-', fg.numar) as numar_factura,
              fg.serie as factura_serie,
              fg.numar as factura_numar,
              ef.valoare,
              ef.moneda,
              ef.valoare_ron,
              ef.status_incasare,
              ef.data_facturare,
              ef.data_incasare,
              ef.valoare_incasata,
              fg.data_factura,
              fg.data_scadenta,
              fg.total as factura_total,
              an.anexa_numar,
              an.denumire as anexa_denumire,
              an.subproiect_id as factura_subproiect_id
            )
            ORDER BY ef.data_facturare DESC
          ) as facturi_anexe
        FROM \`${PROJECT_ID}.${dataset}.AnexeContract${tableSuffix}\` an
        JOIN \`${PROJECT_ID}.${dataset}.EtapeFacturi${tableSuffix}\` ef
          ON ef.anexa_id = an.ID_Anexa AND ef.activ = true
        JOIN \`${PROJECT_ID}.${dataset}.FacturiGenerate${tableSuffix}\` fg
          ON ef.factura_id = fg.id
        GROUP BY an.contract_id, an.subproiect_id
      ),
      contracte_cu_anexe AS (
        SELECT
          co.proiect_id,
          co.ID_Contract,
          co.serie_contract,
          co.numar_contract,
          co.tip_document,
          co.Data_Semnare,
          ARRAY_AGG(
            IF(an.ID_Anexa IS NOT NULL,
              STRUCT(
                an.ID_Anexa,
                an.anexa_numar,
                an.denumire as anexa_denumire
              ),
              NULL
            )
            IGNORE NULLS
            ORDER BY an.anexa_numar
          ) as anexe
        FROM \`${PROJECT_ID}.${dataset}.Contracte${tableSuffix}\` co
        LEFT JOIN \`${PROJECT_ID}.${dataset}.AnexeContract${tableSuffix}\` an
          ON an.contract_id = co.ID_Contract
        GROUP BY co.proiect_id, co.ID_Contract, co.serie_contract, co.numar_contract, co.tip_document, co.Data_Semnare
      ),
      -- NOU 02.02.2026: CTE pentru facturi direct pe contract (fără etape selectate)
      facturi_contract_direct AS (
        SELECT
          ef.contract_id,
          CAST(NULL AS STRING) as subproiect_id,
          ARRAY_AGG(
            STRUCT(
              ef.id as etapa_factura_id,
              ef.factura_id,
              CONCAT(fg.serie, '-', fg.numar) as numar_factura,
              fg.serie as factura_serie,
              fg.numar as factura_numar,
              ef.valoare,
              ef.moneda,
              ef.valoare_ron,
              ef.status_incasare,
              ef.data_facturare,
              ef.data_incasare,
              ef.valoare_incasata,
              fg.data_factura,
              fg.data_scadenta,
              fg.total as factura_total,
              CAST(NULL AS INT64) as etapa_index,
              CAST('Factură directă pe contract' AS STRING) as etapa_denumire,
              CAST(NULL AS STRING) as factura_subproiect_id
            )
            ORDER BY ef.data_facturare DESC
          ) as facturi_directe_contract
        FROM \`${PROJECT_ID}.${dataset}.EtapeFacturi${tableSuffix}\` ef
        JOIN \`${PROJECT_ID}.${dataset}.FacturiGenerate${tableSuffix}\` fg
          ON ef.factura_id = fg.id
        WHERE ef.tip_etapa = 'contract_direct'
          AND ef.activ = true
          AND ef.contract_id IS NOT NULL
        GROUP BY ef.contract_id
      ),
      -- NOU 26.01.2026: CTE pentru toate facturile unui contract (etape + anexe + directe combinate)
      contracte_cu_facturi AS (
        SELECT
          cca.proiect_id,
          cca.ID_Contract,
          cca.serie_contract,
          cca.numar_contract,
          cca.tip_document,
          cca.Data_Semnare,
          cca.anexe,
          ARRAY(
            SELECT AS STRUCT * FROM UNNEST(fpc.facturi_etape)
            UNION ALL
            SELECT AS STRUCT * FROM UNNEST(fpa.facturi_anexe)
            UNION ALL
            SELECT AS STRUCT * FROM UNNEST(fcd.facturi_directe_contract)
          ) as facturi_contract
        FROM contracte_cu_anexe cca
        LEFT JOIN facturi_per_contract fpc ON fpc.contract_id = cca.ID_Contract
        LEFT JOIN facturi_per_anexa fpa ON fpa.contract_id = cca.ID_Contract
        LEFT JOIN facturi_contract_direct fcd ON fcd.contract_id = cca.ID_Contract
      ),
      proiecte_cu_contracte AS (
        SELECT
          p.ID_Proiect,
          ARRAY_AGG(
            IF(ccf.ID_Contract IS NOT NULL,
              STRUCT(
                ccf.ID_Contract,
                ccf.serie_contract,
                ccf.numar_contract,
                ccf.tip_document,
                ccf.anexe,
                ccf.facturi_contract
              ),
              NULL
            )
            IGNORE NULLS
            ORDER BY ccf.Data_Semnare DESC
          ) as contracte
        FROM \`${PROJECT_ID}.${dataset}.${table}\` p
        LEFT JOIN contracte_cu_facturi ccf
          ON ccf.proiect_id = p.ID_Proiect
        GROUP BY p.ID_Proiect
      ),
      -- NOU: CTE pentru facturi directe (fără contract)
      facturi_directe AS (
        SELECT
          ef.proiect_id,
          ARRAY_AGG(
            STRUCT(
              ef.id as etapa_factura_id,
              ef.factura_id,
              CONCAT(fg.serie, '-', fg.numar) as numar_factura,
              fg.serie as factura_serie,
              fg.numar as factura_numar,
              ef.valoare,
              ef.moneda,
              ef.valoare_ron,
              ef.status_incasare,
              ef.data_facturare,
              ef.data_incasare,
              ef.valoare_incasata,
              fg.data_factura,
              fg.data_scadenta,
              fg.total as factura_total
            )
            ORDER BY ef.data_facturare DESC
          ) as facturi
        FROM \`${PROJECT_ID}.${dataset}.EtapeFacturi${tableSuffix}\` ef
        JOIN \`${PROJECT_ID}.${dataset}.FacturiGenerate${tableSuffix}\` fg
          ON ef.factura_id = fg.id
        WHERE ef.tip_etapa = 'factura_directa'
          AND ef.activ = true
        GROUP BY ef.proiect_id
      ),
      -- ✅ 21.01.2026: CTE pentru ore lucrate per proiect (pentru progres economic)
      time_tracking_stats AS (
        SELECT
          proiect_id,
          SUM(ore_lucrate) as total_worked_hours
        FROM \`${PROJECT_ID}.${dataset}.TimeTracking${tableSuffix}\`
        GROUP BY proiect_id
      ),
      -- ✅ 21.01.2026: CTE pentru cheltuieli per proiect
      cheltuieli_stats AS (
        SELECT
          proiect_id,
          SUM(valoare_ron) as total_cheltuieli_ron
        FROM \`${PROJECT_ID}.${dataset}.ProiecteCheltuieli${tableSuffix}\`
        GROUP BY proiect_id
      ),
      -- ✅ 21.01.2026: CTE pentru setări cost orar
      cost_settings AS (
        SELECT
          COALESCE(cost_ora, 50) as cost_ora
        FROM \`${PROJECT_ID}.${dataset}.SetariCosturi${tableSuffix}\`
        WHERE activ = true
        ORDER BY data_creare DESC
        LIMIT 1
      )
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
        c.iban as client_iban,
        COALESCE(pcc.contracte, []) as contracte,
        COALESCE(fd.facturi, []) as facturi_directe,
        -- Comentarii info
        COALESCE(cc.total_comentarii, 0) as comentarii_count,
        cc.ultimul_comentariu_data,
        cc.ultim_comentariu,
        -- Responsabili proiect (Principal, Normal, Observator)
        COALESCE(rp.responsabili, []) as responsabili_toti,
        -- ✅ 21.01.2026: Progres economic calculat
        ROUND(
          SAFE_DIVIDE(
            COALESCE(tts.total_worked_hours, 0) * 100,
            NULLIF(
              SAFE_DIVIDE(
                COALESCE(p.Valoare_Estimata, 0) - (
                  CASE
                    WHEN p.moneda = 'RON' THEN COALESCE(chs.total_cheltuieli_ron, 0)
                    ELSE COALESCE(chs.total_cheltuieli_ron, 0) / NULLIF(p.curs_valutar, 0)
                  END
                ),
                csett.cost_ora
              ),
              0
            )
          ),
          1
        ) as progres_economic
      FROM \`${PROJECT_ID}.${dataset}.${table}\` p
      LEFT JOIN \`${PROJECT_ID}.${dataset}.${tableClienti}\` c
        ON TRIM(LOWER(p.Client)) = TRIM(LOWER(c.nume))
      LEFT JOIN proiecte_cu_contracte pcc
        ON pcc.ID_Proiect = p.ID_Proiect
      LEFT JOIN facturi_directe fd
        ON fd.proiect_id = p.ID_Proiect
      LEFT JOIN comentarii_count cc
        ON cc.proiect_id = p.ID_Proiect
      LEFT JOIN responsabili_proiect rp
        ON rp.proiect_id = p.ID_Proiect
      LEFT JOIN time_tracking_stats tts
        ON tts.proiect_id = p.ID_Proiect
      LEFT JOIN cheltuieli_stats chs
        ON chs.proiect_id = p.ID_Proiect
      CROSS JOIN cost_settings csett
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
    // FIX: Adăugat sortare secundară după ID_Proiect pentru ordine deterministă
    // ID_Proiect conține timestamp (ex: P2025123) → asigură ordine cronologică chiar dacă Data_Start este NULL sau dublată
    baseQuery += `
      ORDER BY p.Data_Start DESC, p.ID_Proiect DESC
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
        // FIX 13.01.2026: Adăugat câmpul `rol` pentru a genera link corect în funcție de rolul utilizatorului
        const responsabiliQuery = `
          SELECT uid, nume, prenume, email, rol
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
          const baseUrl = request.url.split('/api/')[0];

          // FIX 13.01.2026: Generează link direct la detalii proiect în funcție de rolul utilizatorului
          const userRol = responsabilUser.rol || 'normal';
          const linkDetalii = userRol === 'admin'
            ? `${baseUrl}/admin/rapoarte/proiecte/${encodeURIComponent(ID_Proiect)}`
            : `${baseUrl}/projects/${encodeURIComponent(ID_Proiect)}`;

          const notifyResponse = await fetch(`${baseUrl}/api/notifications/send`, {
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
                user_prenume: responsabilUser.prenume, // ✅ ADDED: Prenume pentru adresare în email
                data_atribuire: new Date().toISOString().split('T')[0],
                termen_realizare: Data_Final || 'Nespecificat',
                link_detalii: linkDetalii // FIX 13.01.2026: Link direct în funcție de rol
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

    // VERIFICARE PRE-UPDATE: Verifică că proiectul există înainte de actualizare
    const checkBeforeQuery = `
      SELECT ID_Proiect, Denumire, Client
      FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    const [checkBeforeRows] = await bigquery.query({
      query: checkBeforeQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT: Verificare pre-update ===');
    console.log('Proiecte găsite înainte de update:', checkBeforeRows.length);
    if (checkBeforeRows.length > 0) {
      console.log('Proiect existent:', checkBeforeRows[0]);
    } else {
      console.log('⚠️ ATENȚIE: Proiectul NU există în baza de date!');
      return NextResponse.json({
        success: false,
        error: `Proiectul cu ID "${id}" nu a fost găsit în baza de date`
      }, { status: 404 });
    }

    // Construire query UPDATE dinamic cu DATE literale
    const updateFields: string[] = [];

    if (status) {
      updateFields.push(`Status = '${escapeString(status)}'`);
    }

    // Procesare câmpuri de actualizat cu tratament special pentru DATE
    const allowedFields = [
      'Denumire', 'Client', 'Adresa', 'Descriere', 'Data_Start', 'Data_Final',
      'Status', 'Valoare_Estimata', 'moneda', 'curs_valutar', 'data_curs_valutar', 'valoare_ron',
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

    const [updateResult] = await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT: Update executat ===');
    console.log('Rezultat update:', updateResult);

    // VERIFICARE POST-UPDATE: Verifică că proiectul încă există după actualizare
    const checkAfterQuery = `
      SELECT ID_Proiect, Denumire, Client
      FROM \`${PROJECT_ID}.${dataset}.${table}\`
      WHERE ID_Proiect = '${escapeString(id)}'
    `;

    const [checkAfterRows] = await bigquery.query({
      query: checkAfterQuery,
      location: 'EU',
    });

    console.log('=== DEBUG PUT: Verificare post-update ===');
    console.log('Proiecte găsite după update:', checkAfterRows.length);
    if (checkAfterRows.length > 0) {
      console.log('Proiect actualizat:', checkAfterRows[0]);
      console.log('✅ Proiect verificat - există în baza de date');
    } else {
      console.log('❌ EROARE CRITICĂ: Proiectul a DISPĂRUT după update!');
      return NextResponse.json({
        success: false,
        error: 'Eroare critică: Proiectul a dispărut după actualizare. Contactați administratorul.'
      }, { status: 500 });
    }

    console.log('=== DEBUG PUT: Update completat cu succes ===');

    // ==================== AI TRIGGERS: Reacții proactive la schimbări status ====================
    // Non-blocking - erori aici nu afectează update-ul
    try {
      const proiectInfo = checkAfterRows[0];
      const newStatus = status || updateData?.Status;
      const newStatusPredare = updateData?.status_predare;
      const newStatusFacturare = updateData?.status_facturare;

      // Construiește baseUrl
      const fwdHost = request.headers.get('x-forwarded-host');
      const fwdProto = request.headers.get('x-forwarded-proto') || 'https';
      const reqHost = request.headers.get('host');
      const triggerBaseUrl = fwdHost
        ? `${fwdProto}://${fwdHost}`
        : reqHost
          ? `${reqHost.includes('localhost') ? 'http' : 'https'}://${reqHost}`
          : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

      // Trigger: Proiect finalizat → sugerează PV + facturare
      if (newStatus && ['Incheiat', 'Finalizat'].includes(newStatus)) {
        const responsabilNume = proiectInfo?.Responsabil || updateData?.Responsabil;
        if (responsabilNume) {
          // Caută UID responsabil
          const [userRows] = await bigquery.query({
            query: `SELECT uid FROM \`${PROJECT_ID}.${dataset.replace('Proiecte_v2', 'Utilizatori_v2').replace(dataset, 'PanouControlUnitar')}.Utilizatori_v2\`
                    WHERE LOWER(CONCAT(IFNULL(prenume,''), ' ', IFNULL(nume,''))) LIKE LOWER(@search)
                       OR LOWER(CONCAT(IFNULL(nume,''), ' ', IFNULL(prenume,''))) LIKE LOWER(@search)
                    LIMIT 1`,
            params: { search: `%${responsabilNume}%` },
          });
          const responsabilUID = userRows?.[0]?.uid;

          if (responsabilUID) {
            // Creează trigger pentru PV
            await fetch(`${triggerBaseUrl}/api/ai/triggers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tip_trigger: 'status_change',
                eveniment: 'proiect_finalizat',
                actiune_sugerata: 'genereaza_pv_si_factura',
                mesaj_utilizator: `🎉 Proiectul "${proiectInfo?.Denumire || id}" a fost marcat ca ${newStatus}. Vrei să generez Procesul Verbal de predare și factura?`,
                user_id: responsabilUID,
                entity_type: 'proiect',
                entity_id: id,
                entity_name: proiectInfo?.Denumire || '',
                prioritate: 8,
                context_json: { client: proiectInfo?.Client, status: newStatus },
                creat_de: 'system',
              }),
            });
            console.log('✅ AI Trigger creat: proiect_finalizat pentru', id);
          }
        }
      }

      // Trigger: Proiect predat dar nefacturat
      if (newStatusPredare === 'Predat' && (!newStatusFacturare || newStatusFacturare === 'Nefacturat')) {
        const responsabilNume = proiectInfo?.Responsabil || updateData?.Responsabil;
        if (responsabilNume) {
          const [userRows] = await bigquery.query({
            query: `SELECT uid FROM \`${PROJECT_ID}.PanouControlUnitar.Utilizatori_v2\`
                    WHERE LOWER(CONCAT(IFNULL(prenume,''), ' ', IFNULL(nume,''))) LIKE LOWER(@search)
                       OR LOWER(CONCAT(IFNULL(nume,''), ' ', IFNULL(prenume,''))) LIKE LOWER(@search)
                    LIMIT 1`,
            params: { search: `%${responsabilNume}%` },
          });
          const responsabilUID = userRows?.[0]?.uid;

          if (responsabilUID) {
            await fetch(`${triggerBaseUrl}/api/ai/triggers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tip_trigger: 'status_change',
                eveniment: 'proiect_predat_nefacturat',
                actiune_sugerata: 'genereaza_factura',
                mesaj_utilizator: `📋 Proiectul "${proiectInfo?.Denumire || id}" a fost predat. Vrei să generez factura?`,
                user_id: responsabilUID,
                entity_type: 'proiect',
                entity_id: id,
                entity_name: proiectInfo?.Denumire || '',
                prioritate: 7,
                context_json: { client: proiectInfo?.Client },
                creat_de: 'system',
              }),
            });
            console.log('✅ AI Trigger creat: proiect_predat_nefacturat pentru', id);
          }
        }
      }
    } catch (triggerError) {
      // Non-blocking - nu afectează update-ul
      console.warn('⚠️ AI Trigger hook error (non-blocking):', triggerError);
    }
    // ==================== END AI TRIGGERS ====================

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
