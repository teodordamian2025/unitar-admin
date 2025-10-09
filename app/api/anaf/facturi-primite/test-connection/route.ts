// =====================================================
// API TEST: Verificare conexiune ANAF pentru facturi primite
// URL: GET /api/anaf/facturi-primite/test-connection
// Data: 09.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';
const ANAF_TOKENS_TABLE = `${PROJECT_ID}.${DATASET}.AnafTokens_v2`;

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

/**
 * GET /api/anaf/facturi-primite/test-connection?zile=7
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const zile = parseInt(searchParams.get('zile') || '7');

    console.log(`🔍 [TEST] Verificare conexiune ANAF pentru ultimele ${zile} zile...`);

    // Step 1: Verificare token ANAF
    console.log('1️⃣ Verificare token ANAF...');
    const tokenResult = await getAnafAccessToken();

    if (!tokenResult.success) {
      return NextResponse.json({
        success: false,
        step: 'token_verification',
        error: tokenResult.error,
        details: 'Token ANAF invalid sau expirat. Reautorizează aplicația din /admin/anaf/setup',
      });
    }

    console.log('✅ Token ANAF valid');

    // Step 2: Verificare configurație CUI
    const cui = process.env.UNITAR_CUI;
    if (!cui) {
      return NextResponse.json({
        success: false,
        step: 'cui_verification',
        error: 'UNITAR_CUI lipsește din .env',
      });
    }

    console.log(`✅ CUI configurat: ${cui}`);

    // Step 3: Test request la ANAF API
    console.log('3️⃣ Test request la ANAF listaMesajeFactura...');
    const anafApiBase = process.env.ANAF_API_BASE || 'https://api.anaf.ro/prod/FCTEL/rest';
    const url = `${anafApiBase}/listaMesajeFactura?zile=${zile}&cif=${cui}`;

    console.log(`📡 Request URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Accept': 'application/json',
      },
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        step: 'anaf_api_request',
        status: response.status,
        error: response.statusText,
        details: errorText,
        url: url.replace(tokenResult.token!, '[TOKEN_HIDDEN]'),
      });
    }

    // Step 4: Parse răspuns
    const data = await response.json();
    console.log('📦 Răspuns ANAF:', JSON.stringify(data, null, 2));

    const mesaje = data.mesaje || data.lista_mesaje || [];

    // Step 5: Verificare în DB pentru duplicate
    let existingCount = 0;
    if (mesaje.length > 0) {
      const idsDescarcare = mesaje.map((m: any) => m.id_descarcare);
      const query = `
        SELECT COUNT(*) as count
        FROM \`${PROJECT_ID}.${DATASET}.FacturiPrimiteANAF_v2\`
        WHERE id_descarcare IN UNNEST(@ids)
      `;
      const [rows] = await bigquery.query({ query, params: { ids: idsDescarcare } });
      existingCount = rows[0]?.count || 0;
    }

    return NextResponse.json({
      success: true,
      message: 'Conexiune ANAF funcțională',
      details: {
        token_status: 'valid',
        cui_configurat: cui,
        api_endpoint: anafApiBase,
        zile_verificate: zile,
        total_facturi_anaf: mesaje.length,
        facturi_deja_in_db: existingCount,
        facturi_noi_disponibile: mesaje.length - existingCount,
        sample_mesaje: mesaje.slice(0, 3).map((m: any) => ({
          id: m.id,
          id_descarcare: m.id_descarcare,
          detalii: m.detalii,
          tip: m.tip,
          data_creare: m.data_creare,
        })),
      },
      raw_response: {
        keys: Object.keys(data),
        mesaje_count: mesaje.length,
      },
    });

  } catch (error: any) {
    console.error('❌ Eroare test conexiune:', error);
    return NextResponse.json({
      success: false,
      step: 'general_error',
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

// === HELPER FUNCTIONS ===

async function getAnafAccessToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const query = `
      SELECT access_token, expires_at, data_creare
      FROM \`${ANAF_TOKENS_TABLE}\`
      WHERE is_active = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query });

    if (rows.length === 0) {
      return {
        success: false,
        error: 'Nu există token ANAF activ în baza de date. Autorizează aplicația din /admin/anaf/setup'
      };
    }

    const token = rows[0];

    // Verifică expirare (BigQuery returnează DATE ca {value: "..."})
    const expiresAtValue = token.expires_at?.value || token.expires_at;
    const expiresAt = new Date(expiresAtValue);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (now >= expiresAt) {
      return {
        success: false,
        error: `Token ANAF expirat la ${expiresAt.toISOString()}. Reautorizează aplicația.`
      };
    }

    console.log(`✅ Token valid - expiră în ${daysRemaining} zile (${expiresAt.toISOString()})`);

    // Decriptează token
    const decryptedToken = decryptToken(token.access_token);

    return { success: true, token: decryptedToken };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function decryptToken(encryptedToken: string): string {
  const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key in .env');
  }

  const parts = encryptedToken.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
