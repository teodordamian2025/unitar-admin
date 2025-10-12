// ==================================================================
// CALEA: app/api/anaf/oauth/callback/route.ts
// DESCRIERE: Primește codul OAuth de la ANAF și schimbă în access_token
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

console.log(`🔧 [ANAF OAuth Callback] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('🔄 ANAF OAuth callback received:', {
      hasCode: !!code,
      hasState: !!state,
      error,
      errorDescription
    });

    // Verifică dacă ANAF a returnat o eroare
    if (error) {
      console.error('❌ ANAF OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`
      );
    }

    // Verifică parametrii necesari
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?error=missing_parameters`
      );
    }

    // Verifică state pentru security (previne CSRF)
    const storedState = request.cookies.get('anaf_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('❌ Invalid OAuth state:', { stored: storedState, received: state });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?error=invalid_state`
      );
    }

    // Schimbă codul în access_token
    const tokenResponse = await exchangeCodeForToken(code);
    
    if (!tokenResponse.success) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?error=token_exchange_failed&description=${encodeURIComponent(tokenResponse.error || '')}`
      );
    }

    // Salvează token-urile în BigQuery
    const saveResult = await saveTokensToDatabase(tokenResponse.data);
    
    if (!saveResult.success) {
      console.error('❌ Failed to save tokens:', saveResult.error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?error=save_failed`
      );
    }

    console.log('✅ ANAF OAuth completed successfully');

    // Redirecționează către pagina de succes
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?success=true`
    );

    // Șterge state-ul din cookie
    response.cookies.delete('anaf_oauth_state');

    return response;

  } catch (error) {
    console.error('❌ Error in ANAF OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?error=internal_error`
    );
  }
}

// ==================================================================
// Funcție pentru schimbarea codului în token
// ==================================================================
async function exchangeCodeForToken(code: string) {
  try {
    const clientId = process.env.ANAF_CLIENT_ID;
    const clientSecret = process.env.ANAF_CLIENT_SECRET;
    const redirectUri = process.env.ANAF_REDIRECT_URI;
    const oauthBase = process.env.ANAF_OAUTH_BASE;

    if (!clientId || !clientSecret || !redirectUri || !oauthBase) {
      return {
        success: false,
        error: 'Missing OAuth configuration'
      };
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    });

    console.log('🔄 Exchanging code for token...');

    const response = await fetch(`${oauthBase}/anaf-oauth2/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    const responseText = await response.text();
    console.log('📥 ANAF token response:', {
      status: response.status,
      statusText: response.statusText,
      responseLength: responseText.length
    });

    // DEBUG: Log token lengths
    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
      console.log('🔍 DEBUG Token lengths:', {
        access_token_length: tokenData.access_token?.length || 0,
        refresh_token_length: tokenData.refresh_token?.length || 0,
        access_token_preview: tokenData.access_token?.substring(0, 50) + '...',
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in
      });
    } catch (e) {
      console.error('❌ Failed to parse token response:', responseText);
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Token exchange failed: ${response.status} ${response.statusText}`,
        details: responseText
      };
    }

    if (!tokenData) {
      tokenData = JSON.parse(responseText);
    }

    // Verifică dacă avem token-urile necesare
    if (!tokenData.access_token) {
      return {
        success: false,
        error: 'Missing access_token in response',
        details: tokenData
      };
    }

    console.log('✅ Token exchange successful');

    return {
      success: true,
      data: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in || 3600,
        scope: tokenData.scope
      }
    };

  } catch (error) {
    console.error('❌ Error exchanging code for token:', error);
    return {
      success: false,
      error: 'Network or parsing error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ==================================================================
// Funcție pentru salvarea token-urilor în BigQuery
// ==================================================================
async function saveTokensToDatabase(tokenData: any) {
  try {
    const dataset = bigquery.dataset('PanouControlUnitar');
    const table = dataset.table(`AnafTokens${tableSuffix}`);

    // Calculează expirarea
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

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
      certificate_serial: null, // Va fi populat când implementăm certificatul
      scope: tokenData.scope || 'RO e-Factura',
      is_active: true,
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString()
    }];

    // Dezactivează token-urile vechi înainte de a salva unul nou
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

    console.log('✅ Token saved to BigQuery successfully');

    return {
      success: true,
      tokenId: tokenRecord[0].id
    };

  } catch (error) {
    console.error('❌ Error saving token to database:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}
