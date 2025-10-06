// ==================================================================
// CALEA: app/api/anaf/oauth/token/route.ts
// DESCRIERE: Management tokens ANAF - verificare, refresh, revocare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';
export const dynamic = 'force-dynamic';

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

const ANAF_OAUTH_TABLE = `\`${PROJECT_ID}.${DATASET}.AnafOAuthTokens${tableSuffix}\``;
const ANAF_TOKENS_TABLE = `\`${PROJECT_ID}.${DATASET}.AnafTokens${tableSuffix}\``;

console.log(`🔧 [ANAF OAuth Token] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// Funcție pentru decriptarea token-urilor
function decryptToken(encryptedToken: string): string {
  const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {  // ← Ai schimbat deja
    throw new Error('Invalid encryption key');
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

// Funcție pentru criptarea token-urilor
function encryptToken(token: string): string {
  const key = process.env.ANAF_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('Invalid encryption key');
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

// ==================================================================
// GET: Verifică statusul token-ului curent
// ==================================================================
export async function GET(request: NextRequest) {
  try {
    const tokenInfo = await getCurrentToken();
    
    if (!tokenInfo.success) {
      return NextResponse.json({
        success: false,
        hasValidToken: false,
        error: tokenInfo.error
      });
    }

    const token = tokenInfo.data;
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    const isExpired = now >= expiresAt;
    const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));

    return NextResponse.json({
      success: true,
      hasValidToken: !isExpired,
      tokenInfo: {
        id: token.id,
        expires_at: token.expires_at,
        expires_in_minutes: expiresInMinutes,
        is_expired: isExpired,
        scope: token.scope,
        data_creare: token.data_creare
      }
    });

  } catch (error) {
    console.error('❌ Error checking token status:', error);
    return NextResponse.json({
      success: false,
      hasValidToken: false,
      error: 'Failed to check token status'
    }, { status: 500 });
  }
}

// ==================================================================
// POST: Refresh token sau revocă tokens
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'refresh':
        return await handleRefreshToken();
      
      case 'revoke':
        return await handleRevokeToken();
      
      case 'test_connection':
        return await handleTestConnection();
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in token management:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 });
  }
}

// ==================================================================
// Funcții helper
// ==================================================================

async function getCurrentToken() {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const query = `
      SELECT *
      FROM ${ANAF_TOKENS_TABLE}
      WHERE client_id = @client_id
        AND is_active = true
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { client_id: process.env.ANAF_CLIENT_ID },
      location: 'EU'
    });

    if (rows.length === 0) {
      return {
        success: false,
        error: 'No active token found'
      };
    }

    return {
      success: true,
      data: rows[0]
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}

async function handleRefreshToken() {
  try {
    const tokenInfo = await getCurrentToken();
    
    if (!tokenInfo.success) {
      return NextResponse.json({
        success: false,
        error: 'No token to refresh'
      }, { status: 400 });
    }

    const currentToken = tokenInfo.data;
    
    if (!currentToken.refresh_token) {
      return NextResponse.json({
        success: false,
        error: 'No refresh token available'
      }, { status: 400 });
    }

    // Decriptează refresh token-ul
    const refreshToken = decryptToken(currentToken.refresh_token);

    // Apelează ANAF pentru refresh
    const refreshResponse = await refreshTokenFromANAF(refreshToken);
    
    if (!refreshResponse.success) {
      return NextResponse.json({
        success: false,
        error: refreshResponse.error
      }, { status: 400 });
    }

    // Salvează noul token
    const saveResult = await saveNewRefreshedToken(refreshResponse.data);
    
    if (!saveResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to save refreshed token'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      tokenId: saveResult.tokenId
    });

  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh token'
    }, { status: 500 });
  }
}

async function handleRevokeToken() {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const query = `
      UPDATE ${ANAF_TOKENS_TABLE}
      SET is_active = false, data_actualizare = CURRENT_TIMESTAMP()
      WHERE client_id = @client_id AND is_active = true
    `;

    await bigquery.query({
      query,
      params: { client_id: process.env.ANAF_CLIENT_ID },
      location: 'EU'
    });

    return NextResponse.json({
      success: true,
      message: 'All tokens revoked successfully'
    });

  } catch (error) {
    console.error('❌ Error revoking tokens:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to revoke tokens'
    }, { status: 500 });
  }
}

async function handleTestConnection() {
  try {
    const tokenInfo = await getCurrentToken();
    
    if (!tokenInfo.success) {
      return NextResponse.json({
        success: false,
        isConnected: false,
        error: 'No active token'
      });
    }

    const token = tokenInfo.data;
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    
    if (now >= expiresAt) {
      return NextResponse.json({
        success: false,
        isConnected: false,
        error: 'Token expired'
      });
    }

    // TODO: În viitor, vom testa conexiunea efectivă cu API-ul ANAF
    // Pentru moment, verificăm doar dacă avem token valid
    
    return NextResponse.json({
      success: true,
      isConnected: true,
      message: 'Connection to ANAF is active',
      expiresInMinutes: Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60))
    });

  } catch (error) {
    console.error('❌ Error testing connection:', error);
    return NextResponse.json({
      success: false,
      isConnected: false,
      error: 'Failed to test connection'
    });
  }
}

async function refreshTokenFromANAF(refreshToken: string) {
  try {
    const clientId = process.env.ANAF_CLIENT_ID;
    const clientSecret = process.env.ANAF_CLIENT_SECRET;
    const oauthBase = process.env.ANAF_OAUTH_BASE;

    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken
    });

    const response = await fetch(`${oauthBase}/anaf-oauth2/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: `Refresh failed: ${response.status} ${response.statusText}`
      };
    }

    const tokenData = JSON.parse(responseText);

    return {
      success: true,
      data: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Uneori ANAF nu returnează nou refresh_token
        expires_in: tokenData.expires_in || 3600,
        scope: tokenData.scope
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

async function saveNewRefreshedToken(tokenData: any) {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table('AnafTokens');

    // Calculează expirarea
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Criptează token-urile
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token ? 
      encryptToken(tokenData.refresh_token) : null;

    const tokenRecord = [{
      id: crypto.randomUUID(),
      client_id: process.env.ANAF_CLIENT_ID,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: expiresAt.toISOString(),
      certificate_serial: null,
      scope: tokenData.scope || 'RO e-Factura',
      is_active: true,
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString()
    }];

    // Dezactivează token-urile vechi
    await table.query({
      query: `
        UPDATE ${ANAF_TOKENS_TABLE}
        SET is_active = false, data_actualizare = CURRENT_TIMESTAMP()
        WHERE client_id = @client_id AND is_active = true
      `,
      params: { client_id: process.env.ANAF_CLIENT_ID },
      location: 'EU'
    });

    // Inserează noul token
    await table.insert(tokenRecord);

    return {
      success: true,
      tokenId: tokenRecord[0].id
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}
