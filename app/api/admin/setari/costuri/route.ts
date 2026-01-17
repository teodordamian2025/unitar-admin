// ==================================================================
// CALEA: app/api/admin/setari/costuri/route.ts
// DATA: 17.01.2026 (ora României)
// DESCRIERE: API pentru setări cost/oră și cost/zi de om
// FUNCȚIONALITĂȚI: GET (citire setări), PUT (actualizare setări)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const TABLE_SETARI_COSTURI = `\`${PROJECT_ID}.${DATASET}.SetariCosturi${tableSuffix}\``;

console.log(`🔧 Setări Costuri API - Tables Mode: ${useV2Tables ? 'V2' : 'V1'}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Helper function pentru escape SQL
const escapeString = (value: string): string => {
  if (!value) return '';
  return value.replace(/'/g, "''");
};

// GET - Citire setări cost
export async function GET(request: NextRequest) {
  try {
    // Verifică dacă tabelul există, dacă nu, încearcă să-l creeze
    let query = `
      SELECT
        id,
        cost_ora,
        cost_zi,
        ore_pe_zi,
        moneda,
        descriere,
        activ,
        data_creare,
        data_actualizare
      FROM ${TABLE_SETARI_COSTURI}
      WHERE activ = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    try {
      const [rows] = await bigquery.query({
        query,
        location: 'EU',
      });

      if (rows.length === 0) {
        // Returnează setări default dacă tabelul e gol
        return NextResponse.json({
          success: true,
          data: {
            id: 'default_cost_settings',
            cost_ora: 40,
            cost_zi: 320,
            ore_pe_zi: 8,
            moneda: 'EUR',
            descriere: 'Setări cost de om implicite',
            activ: true,
            is_default: true
          }
        });
      }

      return NextResponse.json({
        success: true,
        data: rows[0]
      });

    } catch (tableError: any) {
      // Dacă tabelul nu există, returnează setări default
      if (tableError.message && tableError.message.includes('Not found')) {
        console.log('⚠️ Tabelul SetariCosturi_v2 nu există, returnez setări default');
        return NextResponse.json({
          success: true,
          data: {
            id: 'default_cost_settings',
            cost_ora: 40,
            cost_zi: 320,
            ore_pe_zi: 8,
            moneda: 'EUR',
            descriere: 'Setări cost de om implicite (tabel necreat)',
            activ: true,
            is_default: true
          }
        });
      }
      throw tableError;
    }

  } catch (error) {
    console.error('Eroare la citirea setărilor de cost:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la citirea setărilor de cost',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// PUT - Actualizare setări cost
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('PUT setări costuri request:', body);

    const {
      cost_ora,
      cost_zi,
      ore_pe_zi = 8,
      moneda = 'EUR',
      descriere
    } = body;

    // Validări
    if (cost_ora === undefined && cost_zi === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Trebuie specificat cel puțin cost_ora sau cost_zi'
      }, { status: 400 });
    }

    // Calculează valori dacă una lipsește
    let finalCostOra = cost_ora;
    let finalCostZi = cost_zi;
    const finalOrePeZi = ore_pe_zi || 8;

    if (finalCostOra && !finalCostZi) {
      finalCostZi = finalCostOra * finalOrePeZi;
    } else if (finalCostZi && !finalCostOra) {
      finalCostOra = finalCostZi / finalOrePeZi;
    }

    // Validări numerice
    if (finalCostOra <= 0 || finalCostZi <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Costurile trebuie să fie mai mari ca 0'
      }, { status: 400 });
    }

    if (finalOrePeZi < 1 || finalOrePeZi > 24) {
      return NextResponse.json({
        success: false,
        error: 'Orele pe zi trebuie să fie între 1 și 24'
      }, { status: 400 });
    }

    // Verifică dacă tabelul există
    try {
      const checkQuery = `SELECT COUNT(*) as cnt FROM ${TABLE_SETARI_COSTURI} WHERE activ = TRUE`;
      const [checkRows] = await bigquery.query({ query: checkQuery, location: 'EU' });
      const hasExisting = checkRows[0]?.cnt > 0;

      if (hasExisting) {
        // Update înregistrarea existentă activă
        const updateQuery = `
          UPDATE ${TABLE_SETARI_COSTURI}
          SET
            cost_ora = ${parseFloat(finalCostOra)},
            cost_zi = ${parseFloat(finalCostZi)},
            ore_pe_zi = ${parseInt(finalOrePeZi)},
            moneda = '${escapeString(moneda)}',
            descriere = ${descriere ? `'${escapeString(descriere)}'` : 'NULL'},
            data_actualizare = CURRENT_TIMESTAMP()
          WHERE activ = TRUE
        `;

        await bigquery.query({ query: updateQuery, location: 'EU' });
        console.log('✅ Setări cost actualizate cu succes');
      } else {
        // Insert înregistrare nouă
        const insertQuery = `
          INSERT INTO ${TABLE_SETARI_COSTURI}
          (id, cost_ora, cost_zi, ore_pe_zi, moneda, descriere, activ, data_creare)
          VALUES (
            'cost_settings_${Date.now()}',
            ${parseFloat(finalCostOra)},
            ${parseFloat(finalCostZi)},
            ${parseInt(finalOrePeZi)},
            '${escapeString(moneda)}',
            ${descriere ? `'${escapeString(descriere)}'` : 'NULL'},
            TRUE,
            CURRENT_TIMESTAMP()
          )
        `;

        await bigquery.query({ query: insertQuery, location: 'EU' });
        console.log('✅ Setări cost inserate cu succes');
      }

      return NextResponse.json({
        success: true,
        message: 'Setări cost actualizate cu succes',
        data: {
          cost_ora: finalCostOra,
          cost_zi: finalCostZi,
          ore_pe_zi: finalOrePeZi,
          moneda
        }
      });

    } catch (tableError: any) {
      // Dacă tabelul nu există, încearcă să-l creeze
      if (tableError.message && tableError.message.includes('Not found')) {
        console.log('⚠️ Tabelul nu există, îl creez...');

        const createTableQuery = `
          CREATE TABLE ${TABLE_SETARI_COSTURI} (
            id STRING NOT NULL,
            cost_ora NUMERIC(10, 2) NOT NULL,
            cost_zi NUMERIC(10, 2) NOT NULL,
            ore_pe_zi INT64 NOT NULL,
            moneda STRING NOT NULL,
            descriere STRING,
            activ BOOL NOT NULL,
            data_creare TIMESTAMP NOT NULL,
            data_actualizare TIMESTAMP
          )
        `;

        await bigquery.query({ query: createTableQuery, location: 'EU' });

        // Insert prima înregistrare
        const insertQuery = `
          INSERT INTO ${TABLE_SETARI_COSTURI}
          (id, cost_ora, cost_zi, ore_pe_zi, moneda, descriere, activ, data_creare)
          VALUES (
            'default_cost_settings',
            ${parseFloat(finalCostOra)},
            ${parseFloat(finalCostZi)},
            ${parseInt(finalOrePeZi)},
            '${escapeString(moneda)}',
            ${descriere ? `'${escapeString(descriere)}'` : `'Setări cost de om'`},
            TRUE,
            CURRENT_TIMESTAMP()
          )
        `;

        await bigquery.query({ query: insertQuery, location: 'EU' });

        return NextResponse.json({
          success: true,
          message: 'Tabel creat și setări salvate cu succes',
          data: {
            cost_ora: finalCostOra,
            cost_zi: finalCostZi,
            ore_pe_zi: finalOrePeZi,
            moneda
          }
        });
      }
      throw tableError;
    }

  } catch (error) {
    console.error('Eroare la actualizarea setărilor de cost:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la actualizarea setărilor de cost',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
