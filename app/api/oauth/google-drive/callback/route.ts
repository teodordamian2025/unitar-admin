// =====================================================
// OAuth Flow Google Drive - Step 2: Callback
// Primește authorization code și salvează refresh token
// URL: GET /api/oauth/google-drive/callback?code=xxx
// Data: 08.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

// Force dynamic rendering for this route (fixes DynamicServerError)
export const dynamic = 'force-dynamic';
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'No authorization code received' },
        { status: 400 }
      );
    }

    console.log('📥 Received authorization code, exchanging for tokens...');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive/callback`
    );

    // Exchange code pentru tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'No refresh token received. Please revoke app access and try again.',
          help: 'https://myaccount.google.com/permissions',
        },
        { status: 400 }
      );
    }

    console.log('✅ Refresh token received, encrypting and saving...');

    // Encriptează refresh token
    const encryptedToken = encryptToken(tokens.refresh_token);

    // Salvează în BigQuery
    await bigquery.query({
      query: `
        INSERT INTO \`PanouControlUnitar.GoogleDriveTokens\` (
          id, user_email, refresh_token, access_token,
          expires_at, data_creare, activ
        ) VALUES (
          GENERATE_UUID(),
          @user_email,
          @refresh_token,
          @access_token,
          TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 3600 SECOND),
          CURRENT_TIMESTAMP(),
          TRUE
        )
      `,
      params: {
        user_email: 'unitarproiect@gmail.com',
        refresh_token: encryptedToken,
        access_token: tokens.access_token || '',
      },
    });

    console.log('✅ Refresh token saved to BigQuery!');

    return NextResponse.json({
      success: true,
      message: '✅ Google Drive OAuth setup complete! Refresh token saved.',
      token_preview: tokens.refresh_token.substring(0, 20) + '...',
      next_step: 'Test: https://admin.unitarproiect.eu/api/test/google-drive',
    });

  } catch (error: any) {
    console.error('❌ OAuth callback error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Encriptează token folosind AES-256-CBC
 * (Refolosim pattern-ul ANAF)
 */
function encryptToken(token: string): string {
  const key = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;

  if (!key || key.length !== 64) {
    throw new Error('Invalid GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY (must be 64 hex chars)');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}
