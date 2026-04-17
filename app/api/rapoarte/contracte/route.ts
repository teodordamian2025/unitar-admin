// ==================================================================
// CALEA: app/api/rapoarte/contracte/route.ts
// DATA: 15.01.2025 15:30 (ora României)
// MODIFICAT: Adăugat JOIN cu EtapeFacturi și FacturiGenerate pentru status facturare
// ADĂUGAT: Încărcare anexe și calculare status agregat de facturare/încasare
// PĂSTRATE: Toate funcționalitățile existente + filtrare după status facturare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_CONTRACTE = `\`${PROJECT_ID}.${DATASET}.Contracte${tableSuffix}\``;
const TABLE_CLIENTI = `\`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\``;
const TABLE_ETAPE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.EtapeContract${tableSuffix}\``;
const TABLE_SUBPROIECTE = `\`${PROJECT_ID}.${DATASET}.Subproiecte${tableSuffix}\``;
const TABLE_ETAPE_FACTURI = `\`${PROJECT_ID}.${DATASET}.EtapeFacturi${tableSuffix}\``;
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_ANEXE_CONTRACT = `\`${PROJECT_ID}.${DATASET}.AnexeContract${tableSuffix}\``;
// NOU 02.02.2026: Adăugat pentru calculul status_predare
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

console.log(`🔧 Contracte API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: Contracte${tableSuffix}, Clienti${tableSuffix}, EtapeContract${tableSuffix}, Subproiecte${tableSuffix}, EtapeFacturi${tableSuffix}, FacturiGenerate${tableSuffix}, AnexeContract${tableSuffix}, Proiecte${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper function pentru escape SQL - PĂSTRAT din codul existent
const escapeString = (value: string): string => {
  return value.replace(/'/g, "''");
};

// Helper pentru formatare DATE BigQuery - PĂSTRAT și ÎMBUNĂTĂȚIT din codul existent
const formatDateLiteral = (dateString: string | null): string => {
  if (!dateString || dateString === 'null' || dateString === 'undefined' || dateString === '') {
    return 'NULL';
  }
  
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateRegex.test(dateString)) {
    return `DATE('${dateString}')`;
  }
  
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const isoString = date.toISOString().split('T')[0];
      return `DATE('${isoString}')`;
    }
  } catch (error) {
    console.warn(`Nu s-a putut parsa data: ${dateString}`);
  }
  
  return 'NULL';
};

// Helper pentru actualizare timestamp
const getCurrentTimestamp = (): string => {
  return 'CURRENT_TIMESTAMP()';
};

// Helper pentru conversie BigQuery NUMERIC - PĂSTRAT din codul existent
const convertBigQueryNumeric = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const extractedValue = value.value;
    if (typeof extractedValue === 'object' && extractedValue !== null) {
      return convertBigQueryNumeric(extractedValue);
    }
    const numericValue = parseFloat(String(extractedValue)) || 0;
    return numericValue;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return 0;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? 0 : value;
  }
  
  if (typeof value === 'bigint') {
    return Number(value);
  }
  
  try {
    const stringValue = String(value);
    const parsed = parseFloat(stringValue);
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    return 0;
  }
};

// Helper pentru parsarea datelor BigQuery - PĂSTRAT din codul existent
const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  
  try {
    let dateString = dateValue;
    
    if (typeof dateValue === 'object' && dateValue !== null && 'value' in dateValue) {
      dateString = dateValue.value;
    }
    
    if (!dateString) return null;
    
    const cleanDateString = dateString.toString().replace(/\s+UTC\s*$/, '').trim();
    const parsedDate = new Date(cleanDateString);
    
    if (isNaN(parsedDate.getTime())) {
      return null;
    }
    
    return parsedDate.toISOString();
  } catch (error) {
    console.error('[CONTRACTE] Eroare la parsarea datei:', dateValue, error);
    return null;
  }
};

// Helper pentru parsarea JSON-ului BigQuery - PĂSTRAT din codul existent
const parseJsonField = (jsonString: any): any => {
  if (!jsonString) return null;
  
  try {
    if (typeof jsonString === 'string') {
      return JSON.parse(jsonString);
    }
    return jsonString;
  } catch (error) {
    console.error('[CONTRACTE] Eroare parsare JSON:', error);
    return null;
  }
};

// NOU: Helper pentru calculare status facturare agregat
const calculateFacturareStatus = (factureData: any[]): { status: string, display: string } => {
  if (!factureData || factureData.length === 0) {
    return {
      status: 'Nefacturat',
      display: 'Nefacturat'
    };
  }

  const facturi = factureData.filter(f => f.factura_id && f.activ);
  if (facturi.length === 0) {
    return {
      status: 'Nefacturat', 
      display: 'Nefacturat'
    };
  }

  let totalFacturat = 0;
  let totalIncasat = 0;
  const displayParts: string[] = [];

  facturi.forEach(factura => {
    const valoare = convertBigQueryNumeric(factura.valoare) || 0;
    const valoareIncasata = convertBigQueryNumeric(factura.valoare_incasata) || 0;
    
    totalFacturat += valoare;
    totalIncasat += valoareIncasata;

    // Formatare pentru display cu procesare BigQuery DATE
	const dataFacturare = factura.data_facturare ? 
	  (() => {
	    let dateString = factura.data_facturare;
	    if (typeof dateString === 'object' && dateString !== null && 'value' in dateString) {
	      dateString = dateString.value;
	    }
	    return dateString ? new Date(dateString).toLocaleDateString('ro-RO') : 'N/A';
	  })() : 'N/A';

	const dataIncasare = factura.data_incasare ? 
	  (() => {
	    let dateString = factura.data_incasare;
	    if (typeof dateString === 'object' && dateString !== null && 'value' in dateString) {
	      dateString = dateString.value;
	    }
	    return dateString ? new Date(dateString).toLocaleDateString('ro-RO') : '';
	  })() : '';
  
    let statusIncasare = '';
    if (valoareIncasata === 0) {
      statusIncasare = 'Neincasat';
    } else if (valoareIncasata >= valoare) {
      statusIncasare = `Incasat complet (${dataIncasare})`;
    } else {
      statusIncasare = `Incasat partial ${valoareIncasata}${factura.moneda} (${dataIncasare})`;
    }

    displayParts.push(
      `${factura.serie || 'F'}${factura.numar || 'N/A'}/${dataFacturare} ${valoare}${factura.moneda} → ${statusIncasare}`
    );
  });

  // Determină status general
  let status = '';
  if (totalIncasat === 0) {
    status = 'Facturat';
  } else if (totalIncasat >= totalFacturat) {
    status = 'Incasat complet';
  } else {
    status = 'Incasat partial';
  }

  return {
    status,
    display: displayParts.join('\n')
  };
};

// ============================================================================
// P3 REFACTOR 17.04.2026: Batch loaders pentru eliminarea N+1
// Înlocuiește 4 query-uri per contract (×50 contracte = 200+ queries)
// cu 4-5 query-uri batch pentru întregul set de contracte.
// ============================================================================

// BATCH: Facturi directe pentru mai multe proiecte
const loadFacturiDirecteBatch = async (proiectIds: string[]): Promise<Map<string, any[]>> => {
  const map = new Map<string, any[]>();
  if (proiectIds.length === 0) return map;

  try {
    const query = `
      SELECT
        ef.proiect_id,
        ef.factura_id,
        fg.serie,
        fg.numar,
        ef.valoare,
        ef.moneda,
        ef.data_facturare,
        ef.data_incasare,
        ef.valoare_incasata,
        ef.status_incasare,
        fg.status as status_factura,
        ef.activ
      FROM ${TABLE_ETAPE_FACTURI} ef
      JOIN ${TABLE_FACTURI_GENERATE} fg ON ef.factura_id = fg.id
      WHERE ef.proiect_id IN UNNEST(@proiectIds)
        AND ef.tip_etapa = 'factura_directa'
        AND ef.activ = true
      ORDER BY ef.proiect_id, ef.data_facturare DESC
    `;

    const [rows] = await bigquery.query({
      query,
      params: { proiectIds },
      types: { proiectIds: ['STRING'] },
      location: 'EU',
    });

    rows.forEach((row: any) => {
      const pid = row.proiect_id;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push({
        factura_id: row.factura_id,
        serie: row.serie,
        numar: row.numar,
        valoare: row.valoare,
        moneda: row.moneda,
        data_facturare: row.data_facturare,
        data_incasare: row.data_incasare,
        valoare_incasata: row.valoare_incasata,
        status_incasare: row.status_incasare,
        status_factura: row.status_factura,
        activ: row.activ
      });
    });

    return map;
  } catch (error) {
    console.error('[CONTRACTE] Eroare batch facturi directe:', error);
    return map;
  }
};

// BATCH: Status_predare pentru mai multe contracte
// Logica identică cu calculateStatusPredareContract, dar batch-uită
const loadStatusPredareBatch = async (
  contracts: Array<{ ID_Contract: string; proiect_id: string }>,
  anexePerContract: Map<string, any[]>
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  if (contracts.length === 0) return result;

  try {
    // 1. Colectează toate subproiect_ids din anexele tuturor contractelor
    const allSubproiectIds = new Set<string>();
    anexePerContract.forEach((anexe: any[]) => {
      anexe.forEach(a => {
        if (a.subproiect_id && String(a.subproiect_id).trim()) {
          allSubproiectIds.add(a.subproiect_id);
        }
      });
    });

    // 2. Query pentru statusuri subproiecte (în batch)
    const subprStatusMap = new Map<string, string>();
    if (allSubproiectIds.size > 0) {
      const [rows] = await bigquery.query({
        query: `
          SELECT ID_Subproiect, status_predare
          FROM ${TABLE_SUBPROIECTE}
          WHERE ID_Subproiect IN UNNEST(@ids)
        `,
        params: { ids: Array.from(allSubproiectIds) },
        types: { ids: ['STRING'] },
        location: 'EU'
      });
      rows.forEach((r: any) => subprStatusMap.set(r.ID_Subproiect, r.status_predare || 'Nepredat'));
    }

    // 3. Query pentru statusuri proiecte (fallback când nu există anexe cu subproiecte)
    const uniqueProiectIds = Array.from(new Set(contracts.map(c => c.proiect_id).filter(Boolean)));
    const proiectStatusMap = new Map<string, string>();
    if (uniqueProiectIds.length > 0) {
      const [rows] = await bigquery.query({
        query: `
          SELECT ID_Proiect, status_predare
          FROM ${TABLE_PROIECTE}
          WHERE ID_Proiect IN UNNEST(@ids)
        `,
        params: { ids: uniqueProiectIds },
        types: { ids: ['STRING'] },
        location: 'EU'
      });
      rows.forEach((r: any) => proiectStatusMap.set(r.ID_Proiect, r.status_predare || 'Nepredat'));
    }

    // 4. Calculează per-contract (identic cu logica anterioară)
    for (const c of contracts) {
      const anexe = anexePerContract.get(c.ID_Contract) || [];
      const subproiectIds = anexe
        .filter(a => a.subproiect_id && String(a.subproiect_id).trim())
        .map(a => a.subproiect_id as string);

      if (subproiectIds.length > 0) {
        // TOATE subproiectele trebuie să fie 'Predat' pentru a marca contractul ca 'Predat'
        const toatePredate = subproiectIds.every(id => subprStatusMap.get(id) === 'Predat');
        result.set(c.ID_Contract, toatePredate ? 'Predat' : 'Nepredat');
      } else {
        result.set(c.ID_Contract, proiectStatusMap.get(c.proiect_id) || 'Nepredat');
      }
    }

    return result;
  } catch (error) {
    console.error('[CONTRACTE] Eroare batch status_predare:', error);
    contracts.forEach(c => result.set(c.ID_Contract, 'Nepredat'));
    return result;
  }
};

// BATCH: Etape cu facturi pentru mai multe contracte
// Returnează Map<contract_id, etape[]>
const loadEtapeBatch = async (contractIds: string[]): Promise<Map<string, any[]>> => {
  const result = new Map<string, any[]>();
  if (contractIds.length === 0) return result;

  try {
    const etapeQuery = `
      SELECT
        e.*,
        s.Denumire as subproiect_denumire,
        s.status_predare as subproiect_status_predare,
        ef.factura_id,
        ef.valoare as valoare_facturata,
        ef.moneda as moneda_facturata,
        ef.data_facturare,
        ef.data_incasare,
        ef.valoare_incasata,
        ef.status_incasare as status_incasare_etapa,
        fg.serie,
        fg.numar,
        fg.status as status_factura
      FROM ${TABLE_ETAPE_CONTRACT} e
      LEFT JOIN ${TABLE_SUBPROIECTE} s
        ON e.subproiect_id = s.ID_Subproiect
      LEFT JOIN ${TABLE_ETAPE_FACTURI} ef
        ON e.ID_Etapa = ef.etapa_id AND ef.activ = true
      LEFT JOIN ${TABLE_FACTURI_GENERATE} fg
        ON ef.factura_id = fg.id
      WHERE e.contract_id IN UNNEST(@contractIds)
        AND e.activ = true
      ORDER BY e.contract_id, e.etapa_index ASC
    `;

    const [rows] = await bigquery.query({
      query: etapeQuery,
      params: { contractIds },
      types: { contractIds: ['STRING'] },
      location: 'EU',
    });

    // Grupează pe contract_id → Map<etapa_id, etapa_obj> pentru a combina facturile
    const perContract = new Map<string, Map<string, any>>();

    rows.forEach((row: any) => {
      const cid = row.contract_id;
      if (!perContract.has(cid)) perContract.set(cid, new Map());
      const etapeMap = perContract.get(cid)!;

      const etapaId = row.ID_Etapa;
      if (!etapeMap.has(etapaId)) {
        etapeMap.set(etapaId, {
          ID_Etapa: row.ID_Etapa,
          contract_id: row.contract_id,
          etapa_index: row.etapa_index,
          denumire: row.denumire,
          valoare: convertBigQueryNumeric(row.valoare),
          moneda: row.moneda,
          valoare_ron: convertBigQueryNumeric(row.valoare_ron),
          termen_zile: row.termen_zile,
          subproiect_id: row.subproiect_id,
          subproiect_denumire: row.subproiect_denumire,
          status_predare: row.subproiect_id ? (row.subproiect_status_predare || 'Nepredat') : null,
          status_facturare: row.status_facturare,
          status_incasare: row.status_incasare,
          data_scadenta: parseDate(row.data_scadenta),
          curs_valutar: convertBigQueryNumeric(row.curs_valutar),
          procent_din_total: convertBigQueryNumeric(row.procent_din_total),
          observatii: row.observatii,
          este_din_subproiect: !!row.subproiect_id,
          este_manuala: !row.subproiect_id,
          facturi: []
        });
      }

      if (row.factura_id) {
        etapeMap.get(etapaId).facturi.push({
          factura_id: row.factura_id,
          serie: row.serie,
          numar: row.numar,
          valoare: row.valoare_facturata,
          moneda: row.moneda_facturata,
          data_facturare: row.data_facturare,
          data_incasare: row.data_incasare,
          valoare_incasata: row.valoare_incasata,
          status_incasare: row.status_incasare_etapa,
          status_factura: row.status_factura,
          activ: true
        });
      }
    });

    // Calculează status per etapă și transformă în Map<contract_id, etape[]>
    perContract.forEach((etapeMap: Map<string, any>, cid: string) => {
      const etape = Array.from(etapeMap.values()).map((etapa: any) => {
        const factureStatus = calculateFacturareStatus(etapa.facturi);
        return {
          ...etapa,
          status_facturare_display: factureStatus.display,
          status_facturare_filtru: factureStatus.status
        };
      });
      result.set(cid, etape);
    });

    return result;
  } catch (error) {
    console.error('[CONTRACTE] Eroare batch etape:', error);
    return result;
  }
};

// BATCH: Anexe cu facturi pentru mai multe contracte
// Returnează Map<contract_id, anexe[]>
const loadAnexeBatch = async (contractIds: string[]): Promise<Map<string, any[]>> => {
  const result = new Map<string, any[]>();
  if (contractIds.length === 0) return result;

  try {
    const anexeQuery = `
      SELECT
        a.*,
        s.Denumire as subproiect_denumire,
        s.status_predare as subproiect_status_predare,
        ef.factura_id,
        ef.valoare as valoare_facturata,
        ef.moneda as moneda_facturata,
        ef.data_facturare,
        ef.data_incasare,
        ef.valoare_incasata,
        ef.status_incasare as status_incasare_anexa,
        fg.serie,
        fg.numar,
        fg.status as status_factura
      FROM ${TABLE_ANEXE_CONTRACT} a
      LEFT JOIN ${TABLE_SUBPROIECTE} s
        ON a.subproiect_id = s.ID_Subproiect
      LEFT JOIN ${TABLE_ETAPE_FACTURI} ef
        ON a.ID_Anexa = ef.anexa_id AND ef.activ = true
      LEFT JOIN ${TABLE_FACTURI_GENERATE} fg
        ON ef.factura_id = fg.id
      WHERE a.contract_id IN UNNEST(@contractIds)
        AND a.activ = true
      ORDER BY a.contract_id, a.anexa_numar ASC, a.etapa_index ASC
    `;

    const [rows] = await bigquery.query({
      query: anexeQuery,
      params: { contractIds },
      types: { contractIds: ['STRING'] },
      location: 'EU',
    });

    // Map<contract_id, Map<anexa_key, anexa_obj>> pentru a combina facturile
    const perContract = new Map<string, Map<string, any>>();

    rows.forEach((row: any) => {
      const cid = row.contract_id;
      if (!perContract.has(cid)) perContract.set(cid, new Map());
      const anexeMap = perContract.get(cid)!;

      const anexaKey = `${row.anexa_numar}_${row.ID_Anexa}`;

      if (!anexeMap.has(anexaKey)) {
        anexeMap.set(anexaKey, {
          ID_Anexa: row.ID_Anexa,
          contract_id: row.contract_id,
          proiect_id: row.proiect_id,
          anexa_numar: row.anexa_numar,
          etapa_index: row.etapa_index,
          denumire: row.denumire,
          valoare: convertBigQueryNumeric(row.valoare),
          moneda: row.moneda,
          valoare_ron: convertBigQueryNumeric(row.valoare_ron),
          termen_zile: row.termen_zile,
          subproiect_id: row.subproiect_id,
          subproiect_denumire: row.subproiect_denumire,
          status_predare: row.subproiect_id ? (row.subproiect_status_predare || 'Nepredat') : null,
          status_facturare: row.status_facturare,
          status_incasare: row.status_incasare,
          data_scadenta: parseDate(row.data_scadenta),
          data_start: parseDate(row.data_start),
          data_final: parseDate(row.data_final),
          status: row.status,
          curs_valutar: convertBigQueryNumeric(row.curs_valutar),
          data_curs_valutar: parseDate(row.data_curs_valutar),
          procent_din_total: convertBigQueryNumeric(row.procent_din_total),
          observatii: row.observatii,
          este_din_subproiect: !!row.subproiect_id,
          este_manuala: !row.subproiect_id,
          facturi: []
        });
      }

      if (row.factura_id) {
        anexeMap.get(anexaKey).facturi.push({
          factura_id: row.factura_id,
          serie: row.serie,
          numar: row.numar,
          valoare: row.valoare_facturata,
          moneda: row.moneda_facturata,
          data_facturare: row.data_facturare,
          data_incasare: row.data_incasare,
          valoare_incasata: row.valoare_incasata,
          status_incasare: row.status_incasare_anexa,
          status_factura: row.status_factura,
          activ: true
        });
      }
    });

    perContract.forEach((anexeMap: Map<string, any>, cid: string) => {
      const anexe = Array.from(anexeMap.values()).map((anexa: any) => {
        const factureStatus = calculateFacturareStatus(anexa.facturi);
        return {
          ...anexa,
          status_facturare_display: factureStatus.display,
          status_facturare_filtru: factureStatus.status
        };
      });
      result.set(cid, anexe);
    });

    return result;
  } catch (error) {
    console.error('[CONTRACTE] Eroare batch anexe:', error);
    return result;
  }
};
// GET - Listare și căutare contracte (MODIFICAT pentru includerea etapelor și anexelor cu status facturare)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    console.log('[CONTRACTE] GET contracte cu parametrii:', Object.fromEntries(searchParams.entries()));

    // MODIFICAT: Construirea query-ului cu filtru nou pentru status facturare
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    const types: any = {};

    // Filtru după ID proiect - LIKE în loc de = pentru căutare parțială
    const proiectId = searchParams.get('proiect_id');
    if (proiectId && proiectId.trim()) {
      whereClause += ' AND LOWER(c.proiect_id) LIKE LOWER(@proiectId)';
      params.proiectId = `%${proiectId.trim()}%`;
      types.proiectId = 'STRING';
    }

    // Filtru după status - păstrează = pentru că este exact match
    const status = searchParams.get('status');
    if (status && status.trim()) {
      whereClause += ' AND c.Status = @status';
      params.status = status.trim();
      types.status = 'STRING';
    }

    // Filtru după client - LIKE pentru căutare parțială
    const clientParam = searchParams.get('client') || searchParams.get('client_id');
    if (clientParam && clientParam.trim()) {
      whereClause += ' AND (LOWER(c.client_nume) LIKE LOWER(@clientParam) OR LOWER(COALESCE(cl.nume, "")) LIKE LOWER(@clientParam))';
      params.clientParam = `%${clientParam.trim()}%`;
      types.clientParam = 'STRING';
    }

    // Căutarea generală
    const search = searchParams.get('search');
    if (search && search.trim()) {
      whereClause += ` AND (
        LOWER(c.numar_contract) LIKE LOWER(@search) OR
        LOWER(c.client_nume) LIKE LOWER(@search) OR
        LOWER(c.Denumire_Contract) LIKE LOWER(@search) OR
        LOWER(c.proiect_id) LIKE LOWER(@search) OR
        LOWER(COALESCE(cl.nume, '')) LIKE LOWER(@search)
      )`;
      params.search = `%${search.trim()}%`;
      types.search = 'STRING';
    }

    // NOU: Filtru după status facturare
    const statusFacturare = searchParams.get('status_facturare');
    if (statusFacturare && statusFacturare.trim()) {
      // Acest filtru va fi aplicat după încărcarea datelor, pentru că calculăm status-ul dinamic
      console.log(`[CONTRACTE] Filtru status facturare: ${statusFacturare}`);
    }

    // Filtru după perioada de creare
    const dataCreareStart = searchParams.get('data_creare_start');
    const dataCreareEnd = searchParams.get('data_creare_end');

    if (dataCreareStart && dataCreareStart.trim()) {
      whereClause += ' AND DATE(c.data_creare) >= @dataCreareStart';
      params.dataCreareStart = dataCreareStart.trim();
      types.dataCreareStart = 'DATE';
    }

    if (dataCreareEnd && dataCreareEnd.trim()) {
      whereClause += ' AND DATE(c.data_creare) <= @dataCreareEnd';
      params.dataCreareEnd = dataCreareEnd.trim();
      types.dataCreareEnd = 'DATE';
    }

    // Filtru după valoare minimă
    const valoareMin = searchParams.get('valoare_min');
    if (valoareMin && valoareMin.trim() && !isNaN(Number(valoareMin))) {
      whereClause += ' AND CAST(COALESCE(c.valoare_ron, c.Valoare, 0) AS FLOAT64) >= @valoareMin';
      params.valoareMin = Number(valoareMin.trim());
      types.valoareMin = 'NUMERIC';
    }

    // Filtru după valoare maximă
    const valoareMax = searchParams.get('valoare_max');
    if (valoareMax && valoareMax.trim() && !isNaN(Number(valoareMax))) {
      whereClause += ' AND CAST(COALESCE(c.valoare_ron, c.Valoare, 0) AS FLOAT64) <= @valoareMax';
      params.valoareMax = Number(valoareMax.trim());
      types.valoareMax = 'NUMERIC';
    }

    // Limitare și paginare
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query principal cu JOIN pentru date client complete - PĂSTRAT
    const query = `
      SELECT
        c.*,
        cl.nume as client_nume_complet,
        cl.adresa as client_adresa_completa,
        cl.telefon as client_telefon,
        cl.email as client_email
      FROM ${TABLE_CONTRACTE} c
      LEFT JOIN ${TABLE_CLIENTI} cl
        ON c.client_id = cl.id
      ${whereClause}
      ORDER BY c.data_creare DESC
      LIMIT @limit OFFSET @offset
    `;

    params.limit = limit;
    params.offset = offset;
    types.limit = 'INT64';
    types.offset = 'INT64';

    console.log('[CONTRACTE] Query executat:', query);
    console.log('[CONTRACTE] Parametrii:', params);

    const [rows] = await bigquery.query({
      query,
      params,
      types,
      location: 'EU',
    });

    // P3 REFACTOR 17.04.2026: Batch loading pentru eliminarea N+1
    // Înainte: 4 query-uri × N contracte = 200+ query-uri per request
    // Acum: 4 query-uri batch pentru întreaga pagină
    const contractIds: string[] = rows.map((r: any) => r.ID_Contract);
    const proiectIdsUnique: string[] = Array.from(
      new Set(rows.map((r: any) => r.proiect_id).filter(Boolean))
    );

    console.log(`[CONTRACTE] Batch loading pentru ${contractIds.length} contracte, ${proiectIdsUnique.length} proiecte`);

    const [etapePerContract, anexePerContract, facturiDirectePerProiect] = await Promise.all([
      loadEtapeBatch(contractIds),
      loadAnexeBatch(contractIds),
      loadFacturiDirecteBatch(proiectIdsUnique)
    ]);

    // Status_predare depinde de anexe, deci rulează după ce le-am încărcat
    const statusPredareMap = await loadStatusPredareBatch(
      rows.map((r: any) => ({ ID_Contract: r.ID_Contract, proiect_id: r.proiect_id })),
      anexePerContract
    );

    // Procesarea finală rulează sincron - mai rapid, fără query-uri în loop
    const contracteProcesate = rows.map((contract: any) => {
      const continutJson = parseJsonField(contract.continut_json);

      const etape = etapePerContract.get(contract.ID_Contract) || [];
      const anexe = anexePerContract.get(contract.ID_Contract) || [];
      const facturiDirecte = facturiDirectePerProiect.get(contract.proiect_id) || [];
      const statusPredare = statusPredareMap.get(contract.ID_Contract) || 'Nepredat';

      // Calculează status de facturare general pentru contract
      const toateFacturile = [
        ...etape.flatMap((e: any) => e.facturi || []),
        ...anexe.flatMap((a: any) => a.facturi || []),
        ...facturiDirecte
      ];

      const statusFacturareContract = calculateFacturareStatus(toateFacturile);

      const valoareConvertita = convertBigQueryNumeric(contract.Valoare);
      const valoareRonConvertita = convertBigQueryNumeric(contract.valoare_ron);
      const cursValutarConvertit = convertBigQueryNumeric(contract.curs_valutar);

      return {
        ID_Contract: contract.ID_Contract,
        numar_contract: contract.numar_contract,
        serie_contract: contract.serie_contract,
        tip_document: contract.tip_document,
        proiect_id: contract.proiect_id,
        client_id: contract.client_id,
        client_nume: contract.client_nume,
        client_nume_complet: contract.client_nume_complet,
        client_adresa: contract.client_adresa_completa,
        client_telefon: contract.client_telefon,
        client_email: contract.client_email,
        Denumire_Contract: contract.Denumire_Contract,
        
        // REPARAT: Păstrează datele raw din BigQuery pentru frontend
        Data_Semnare: contract.Data_Semnare?.value || contract.Data_Semnare,
        Data_Expirare: contract.Data_Expirare?.value || contract.Data_Expirare,
        // NOU: Data contract (poate fi diferită de data creare, pentru contracte retroactive)
        data_contract: contract.data_contract?.value || contract.data_contract,
        
        Status: contract.Status,
        Valoare: valoareConvertita,
        Moneda: contract.Moneda,
        curs_valutar: cursValutarConvertit,
        data_curs_valutar: contract.data_curs_valutar?.value || contract.data_curs_valutar,
        valoare_ron: valoareRonConvertita,
        
        // NOU: Etape din EtapeContract cu status facturare
        etape: etape,
        etape_count: etape.length,
        etape_facturate: etape.filter(e => e.status_facturare_filtru !== 'Nefacturat').length,
        etape_incasate: etape.filter(e => e.status_facturare_filtru === 'Incasat complet').length,
        
        // NOU: Anexe din AnexeContract cu status facturare
        anexe: anexe,
        anexe_count: anexe.length,
        anexe_facturate: anexe.filter(a => a.status_facturare_filtru !== 'Nefacturat').length,
        anexe_incasate: anexe.filter(a => a.status_facturare_filtru === 'Incasat complet').length,
        
        // NOU: Status facturare general pentru contract
        status_facturare_display: statusFacturareContract.display,
        status_facturare_filtru: statusFacturareContract.status,

        // NOU 02.02.2026: Status predare (bazat pe subproiecte din anexe sau proiect principal)
        status_predare: statusPredare,

        articole_suplimentare: parseJsonField(contract.articole_suplimentare),
        continut_json: continutJson,
        data_creare: parseDate(contract.data_creare),
        data_actualizare: parseDate(contract.data_actualizare),
        Observatii: contract.Observatii,
        versiune: contract.versiune || 1
      };
    });

    // NOU: Aplicare filtru status facturare după procesare
    let contracteFiltrate = contracteProcesate;
    if (statusFacturare && statusFacturare.trim()) {
      contracteFiltrate = contracteProcesate.filter(contract => {
        return contract.status_facturare_filtru === statusFacturare.trim();
      });
      console.log(`[CONTRACTE] Filtrat după status facturare: ${contracteFiltrate.length}/${contracteProcesate.length}`);
    }

    // Query pentru totalul de contracte (fără filtrul de status facturare)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM ${TABLE_CONTRACTE} c
      LEFT JOIN ${TABLE_CLIENTI} cl
        ON c.client_id = cl.id
      ${whereClause}
    `;

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

    const total = countRows[0]?.total || 0;

    console.log(`[CONTRACTE] Contracte găsite: ${contracteFiltrate.length} din ${total} total`);
    
    // NOU: Log pentru debug etape, anexe și facturi directe
    contracteFiltrate.forEach(c => {
      const totalFacturi = (c.status_facturare_display && c.status_facturare_display !== 'Nefacturat') ? 'cu facturi' : 'fără facturi';
      console.log(`[CONTRACTE] ${c.numar_contract}: ${c.etape_count} etape, ${c.anexe_count} anexe, ${totalFacturi}, status: ${c.status_facturare_filtru}`);
    });

    return NextResponse.json({
      success: true,
      data: contracteFiltrate,
      total: parseInt(total.toString()),
      limit,
      offset,
      has_more: (offset + limit) < total,
      message: proiectId ? 
        `${contracteFiltrate.length} contracte găsite pentru proiectul ${proiectId}` :
        `${contracteFiltrate.length} contracte încărcate cu etape și anexe`,
      // NOU: Statistici pentru debug
      stats: {
        total_etape: contracteFiltrate.reduce((acc, c) => acc + c.etape_count, 0),
        total_anexe: contracteFiltrate.reduce((acc, c) => acc + c.anexe_count, 0),
        contracte_cu_etape: contracteFiltrate.filter(c => c.etape_count > 0).length,
        contracte_cu_anexe: contracteFiltrate.filter(c => c.anexe_count > 0).length
      }
    });

  } catch (error) {
    console.error('[CONTRACTE] Eroare la încărcarea contractelor:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la încărcarea contractelor',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
// PUT - Actualizare contract (PĂSTRAT cu modificări minore)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('PUT contracts request body:', body);
    
    const { ID_Contract, ...updateData } = body;

    if (!ID_Contract) {
      return NextResponse.json({ 
        success: false,
        error: 'ID_Contract necesar pentru actualizare' 
      }, { status: 400 });
    }

    // Logica specială pentru semnarea contractelor - PĂSTRAT
    if (updateData.Status === 'Semnat' && updateData.Data_Semnare) {
      const dataSemnare = updateData.Data_Semnare;
      const dataExpirare = updateData.Data_Expirare;
      
      if (!dataExpirare) {
        return NextResponse.json({ 
          success: false,
          error: 'Data_Expirare este obligatorie când se marchează contractul ca semnat' 
        }, { status: 400 });
      }

      // Validare că data semnării nu este prea în trecut (mai mult de 1 an)
      const dataSemnareDate = new Date(dataSemnare);
      const acumUnAn = new Date();
      acumUnAn.setFullYear(acumUnAn.getFullYear() - 1);
      
      if (dataSemnareDate < acumUnAn) {
        return NextResponse.json({ 
          success: false,
          error: `Data semnării (${dataSemnareDate.toLocaleDateString('ro-RO')}) pare să fie prea în trecut. Verifică dacă este corectă.` 
        }, { status: 400 });
      }

      console.log(`Actualizare contract ${ID_Contract} - Status: Semnat, Data_Semnare: ${dataSemnare}, Data_Expirare: ${dataExpirare}`);
    }

    // Construire query UPDATE - PĂSTRAT
    const updateFields: string[] = [];
    const allowedFields = [
      'Status', 'Data_Semnare', 'Data_Expirare', 'Valoare', 'Moneda', 
      'curs_valutar', 'valoare_ron', 'Observatii', 'note_interne',
      'observatii_semnare'
    ];

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && allowedFields.includes(key)) {
        // Tratare specială pentru câmpurile de tip DATE
        if (key === 'Data_Semnare' || key === 'Data_Expirare') {
          const dataLiteral = formatDateLiteral(value as string);
          updateFields.push(`${key} = ${dataLiteral}`);
        }
        // Tratare pentru câmpurile numerice
        else if (key === 'Valoare' || key === 'curs_valutar' || key === 'valoare_ron') {
          const numericValue = parseFloat(value as string);
          if (!isNaN(numericValue)) {
            updateFields.push(`${key} = ${numericValue}`);
          }
        }
        // Tratare pentru câmpurile text
        else if (value === null || value === '') {
          updateFields.push(`${key} = NULL`);
        } else {
          updateFields.push(`${key} = '${escapeString(value.toString())}'`);
        }
      }
    });

    // Adăugare timestamp actualizare
    updateFields.push(`data_actualizare = ${getCurrentTimestamp()}`);
    
    // Dacă avem observatii_semnare, le adăugăm la Observatii existente
    if (updateData.observatii_semnare && updateData.observatii_semnare.trim()) {
      const observatiiSemnare = escapeString(updateData.observatii_semnare.trim());
      const timestampSemnare = new Date().toLocaleString('ro-RO');
      
      updateFields.push(`Observatii = CASE 
        WHEN Observatii IS NULL OR Observatii = '' 
        THEN 'SEMNAT ${timestampSemnare}: ${observatiiSemnare}'
        ELSE CONCAT(Observatii, '\n\nSEMNAT ${timestampSemnare}: ${observatiiSemnare}')
      END`);
    }

    if (updateFields.length === 1) { // Doar timestamp-ul
      return NextResponse.json({ 
        success: false,
        error: 'Nu există câmpuri de actualizat' 
      }, { status: 400 });
    }

    const updateQuery = `
      UPDATE ${TABLE_CONTRACTE}
      SET ${updateFields.join(', ')}
      WHERE ID_Contract = '${escapeString(ID_Contract)}'
    `;

    console.log('Update contract query:', updateQuery);

    await bigquery.query({
      query: updateQuery,
      location: 'EU',
    });

    console.log(`Contract ${ID_Contract} actualizat cu succes`);

    return NextResponse.json({
      success: true,
      message: 'Contract actualizat cu succes',
      data: { 
        ID_Contract,
        updates_applied: Object.keys(updateData).filter(key => allowedFields.includes(key))
      }
    });

  } catch (error) {
    console.error('Eroare la actualizarea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la actualizarea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Păstrează logica existentă
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proiect_id, tip_document = 'contract', observatii } = body;

    if (!proiect_id) {
      return NextResponse.json({ 
        success: false,
        error: 'ID proiect obligatoriu' 
      }, { status: 400 });
    }

    console.log('[CONTRACTE] POST contract nou pentru proiect:', proiect_id);

    // Verifică dacă există deja un contract pentru acest proiect
    const existingQuery = `
      SELECT ID_Contract, numar_contract, Status
      FROM ${TABLE_CONTRACTE}
      WHERE proiect_id = @proiect_id
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({
      query: existingQuery,
      params: { proiect_id },
      types: { proiect_id: 'STRING' },
      location: 'EU',
    });

    if (existingRows.length > 0) {
      const existingContract = existingRows[0];
      console.log(`[CONTRACTE] Contract existent găsit: ${existingContract.numar_contract}`);
      
      return NextResponse.json({
        success: false,
        error: 'Există deja un contract pentru acest proiect',
        existing_contract: {
          ID_Contract: existingContract.ID_Contract,
          numar_contract: existingContract.numar_contract,
          Status: existingContract.Status
        },
        message: `Contract existent: ${existingContract.numar_contract} (Status: ${existingContract.Status})`
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: 'Pentru crearea contractului, folosește /api/actions/contracts/generate',
      next_action: 'redirect_to_generate'
    });

  } catch (error) {
    console.error('[CONTRACTE] Eroare la crearea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la crearea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// DELETE - Păstrează logica existentă
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('id');

    if (!contractId) {
      return NextResponse.json({ 
        success: false,
        error: 'ID contract obligatoriu' 
      }, { status: 400 });
    }

    console.log('[CONTRACTE] DELETE contract:', contractId);

    // Soft delete prin schimbarea status-ului + dezactivare etape și anexe
    const deleteQuery = `
      UPDATE ${TABLE_CONTRACTE}
      SET
        Status = 'Anulat',
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE ID_Contract = @contractId
    `;

    await bigquery.query({
      query: deleteQuery,
      params: { contractId },
      types: { contractId: 'STRING' },
      location: 'EU',
    });

    // Dezactivează și etapele asociate
    const deleteEtapeQuery = `
      UPDATE ${TABLE_ETAPE_CONTRACT}
      SET
        activ = false,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE contract_id = @contractId
    `;

    await bigquery.query({
      query: deleteEtapeQuery,
      params: { contractId },
      types: { contractId: 'STRING' },
      location: 'EU',
    });

    // NOU: Dezactivează și anexele asociate
    const deleteAnexeQuery = `
      UPDATE ${TABLE_ANEXE_CONTRACT}
      SET
        activ = false,
        data_actualizare = CURRENT_TIMESTAMP()
      WHERE contract_id = @contractId
    `;

    await bigquery.query({
      query: deleteAnexeQuery,
      params: { contractId },
      types: { contractId: 'STRING' },
      location: 'EU',
    });

    console.log(`[CONTRACTE] Contract ${contractId}, etapele și anexele asociate marcate ca anulat/inactiv`);

    return NextResponse.json({
      success: true,
      message: 'Contract anulat cu succes (inclusiv etapele și anexele)'
    });

  } catch (error) {
    console.error('[CONTRACTE] Eroare la anularea contractului:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Eroare la anularea contractului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

