// ==================================================================
// TEST API: Verifică decriptarea token-ului ANAF
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

function decryptToken(encryptedToken: string): { success: boolean; token?: string; error?: string } {
  try {
    const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;

    if (!key) {
      return { success: false, error: 'ANAF_TOKEN_ENCRYPTION_KEY not found in environment' };
    }

    if (key.length !== 64) {
      return { success: false, error: `Invalid key length: ${key.length} (expected 64)` };
    }

    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      return { success: false, error: 'Invalid encrypted token format - missing IV separator' };
    }

    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return { success: true, token: decrypted };
  } catch (error) {
    return {
      success: false,
      error: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verifică cheia de criptare
    const keyCheck = {
      exists: !!process.env.ANAF_TOKEN_ENCRYPTION_KEY,
      length: process.env.ANAF_TOKEN_ENCRYPTION_KEY?.length || 0,
      preview: process.env.ANAF_TOKEN_ENCRYPTION_KEY?.substring(0, 16) + '...' || 'N/A'
    };

    // 2. Caută token activ în BigQuery
    const query = `
      SELECT
        id,
        client_id,
        access_token,
        expires_at,
        is_active,
        data_creare
      FROM \`${PROJECT_ID}.${DATASET}.AnafTokens_v2\`
      WHERE is_active = true
        AND client_id = @client_id
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { client_id: process.env.ANAF_CLIENT_ID },
      location: 'EU'
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active token found in BigQuery',
        keyCheck
      });
    }

    const token = rows[0];
    const encryptedToken = token.access_token;

    // 3. Testează decriptarea
    const decryptResult = decryptToken(encryptedToken);

    // 4. Verifică format token decriptat (ar trebui să fie JWT-like sau string lung)
    const tokenAnalysis = decryptResult.success ? {
      length: decryptResult.token?.length || 0,
      preview: decryptResult.token?.substring(0, 20) + '...' || 'N/A',
      looksValid: (decryptResult.token?.length || 0) > 50 // Token-urile OAuth sunt lungi
    } : null;

    return NextResponse.json({
      success: decryptResult.success,
      keyCheck,
      tokenInfo: {
        id: token.id,
        client_id: token.client_id,
        expires_at: token.expires_at?.value || token.expires_at,
        data_creare: token.data_creare?.value || token.data_creare,
        encrypted_preview: encryptedToken.substring(0, 50) + '...'
      },
      decryptionResult: {
        success: decryptResult.success,
        error: decryptResult.error,
        tokenAnalysis
      }
    });

  } catch (error) {
    console.error('❌ Error in decrypt-token test:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
