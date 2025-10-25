// ==================================================================
// CALEA: app/api/iapp/config/route.ts
// DESCRIERE: CRUD configurare iapp.ro (GET + PUT)
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// Funcții criptare (nu returnăm valorile criptate către client!)
function decryptValue(encryptedValue: string): string {
  const key = process.env.IAPP_ENCRYPTION_KEY || process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }

  const parts = encryptedValue.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = Buffer.from(parts[1], 'hex');
  const keyBuffer = Buffer.from(key, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
}

function encryptValue(value: string): string {
  const key = process.env.IAPP_ENCRYPTION_KEY || process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// ==================================================================
// GET: Citește configurare (fără credențiale sensibile)
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    const query = `
      SELECT id, email_responsabil, activ, tip_facturare,
             auto_transmite_efactura, serie_default, moneda_default,
             footer_intocmit_name, data_creare, data_actualizare,
             sursa_facturi_primite
      FROM \`${PROJECT_ID}.${DATASET}.IappConfig_v2\`
      WHERE activ = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      // Returnează setări default dacă nu există configurare
      return NextResponse.json({
        success: true,
        config: {
          tip_facturare: 'iapp',
          auto_transmite_efactura: true,
          serie_default: 'SERIE_TEST',
          moneda_default: 'RON',
          footer_intocmit_name: 'Administrator UNITAR',
          email_responsabil: 'contact@unitarproiect.eu',
          sursa_facturi_primite: 'iapp' // Default: iapp.ro pentru facturi primite
        },
        isDefault: true
      });
    }

    const config = rows[0];

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        tip_facturare: config.tip_facturare,
        auto_transmite_efactura: config.auto_transmite_efactura,
        serie_default: config.serie_default,
        moneda_default: config.moneda_default,
        footer_intocmit_name: config.footer_intocmit_name,
        email_responsabil: config.email_responsabil,
        sursa_facturi_primite: config.sursa_facturi_primite || 'iapp', // Fallback pentru backwards compatibility
        activ: config.activ,
        data_creare: config.data_creare,
        data_actualizare: config.data_actualizare
      },
      isDefault: false
    });

  } catch (error) {
    console.error('❌ [iapp.ro] Error fetching config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// PUT: Actualizează configurare (doar câmpuri non-sensibile)
// ==================================================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tip_facturare,
      auto_transmite_efactura,
      serie_default,
      moneda_default,
      footer_intocmit_name,
      email_responsabil,
      sursa_facturi_primite
    } = body;

    // Validare
    if (!['iapp', 'anaf_direct'].includes(tip_facturare)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid tip_facturare. Must be "iapp" or "anaf_direct"'
      }, { status: 400 });
    }

    // Validare sursa_facturi_primite (opțional)
    if (sursa_facturi_primite && !['iapp', 'anaf'].includes(sursa_facturi_primite)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid sursa_facturi_primite. Must be "iapp" or "anaf"'
      }, { status: 400 });
    }

    // Verifică dacă există configurare (citește toate datele, inclusiv criptate)
    const checkQuery = `
      SELECT * FROM \`${PROJECT_ID}.${DATASET}.IappConfig_v2\`
      WHERE activ = TRUE
      LIMIT 1
    `;

    const [existingRows] = await bigquery.query({ query: checkQuery, location: 'EU' });

    if (existingRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Configuration not found. Please run seed script first.'
      }, { status: 404 });
    }

    const oldConfig = existingRows[0];

    // ✅ FIX: BigQuery streaming buffer issue - folosim DELETE + INSERT în loc de UPDATE
    // Streaming buffer se golește după ~90s, UPDATE/DELETE nu funcționează în acest interval

    // 1. DELETE configurarea veche (setează activ = FALSE)
    const deactivateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.IappConfig_v2\`
      SET activ = FALSE,
          data_actualizare = CURRENT_TIMESTAMP()
      WHERE id = @config_id
    `;

    try {
      await bigquery.query({
        query: deactivateQuery,
        params: { config_id: oldConfig.id },
        location: 'EU'
      });
    } catch (updateError: any) {
      // Dacă UPDATE fail din cauza streaming buffer, continuăm cu INSERT direct
      console.log('⚠️ [iapp.ro] UPDATE failed (streaming buffer), proceeding with INSERT');
    }

    // 2. INSERT configurare nouă cu valorile actualizate (păstrăm credențialele criptate)
    const newConfigRecord = [{
      id: crypto.randomUUID(),
      cod_firma: oldConfig.cod_firma, // Păstrăm credențialele criptate existente
      parola_api: oldConfig.parola_api, // Păstrăm credențialele criptate existente
      email_responsabil: email_responsabil || oldConfig.email_responsabil,
      activ: true,
      tip_facturare: tip_facturare,
      auto_transmite_efactura: auto_transmite_efactura !== undefined ? auto_transmite_efactura : oldConfig.auto_transmite_efactura,
      serie_default: serie_default || oldConfig.serie_default,
      moneda_default: moneda_default || oldConfig.moneda_default,
      footer_intocmit_name: footer_intocmit_name || oldConfig.footer_intocmit_name,
      sursa_facturi_primite: sursa_facturi_primite || oldConfig.sursa_facturi_primite || 'iapp', // Default: iapp.ro
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString(),
      creat_de: oldConfig.creat_de || 'system',
      actualizat_de: 'admin_ui'
    }];

    await bigquery.dataset(DATASET).table('IappConfig_v2').insert(newConfigRecord);

    console.log(`✅ [iapp.ro] Config updated (DELETE+INSERT): tip_facturare=${tip_facturare}, new_id=${newConfigRecord[0].id}`);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      config: {
        tip_facturare,
        auto_transmite_efactura,
        serie_default,
        moneda_default,
        footer_intocmit_name,
        email_responsabil,
        sursa_facturi_primite: sursa_facturi_primite || 'iapp'
      }
    });

  } catch (error) {
    console.error('❌ [iapp.ro] Error updating config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
