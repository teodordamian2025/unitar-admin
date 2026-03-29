// app/api/auth/gmail/callback/route.ts
// OAuth Flow Gmail - Step 2: Callback
// Primește authorization code, exchange pentru tokens, salvează în BigQuery

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const DATASET = 'PanouControlUnitar';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const stateReceived = req.nextUrl.searchParams.get('state');

    if (!code) {
      return redirectWithError('Nu s-a primit authorization code');
    }

    // CSRF verification
    const stateSent = req.cookies.get('gmail_oauth_state')?.value;
    if (!stateReceived || !stateSent || stateReceived !== stateSent) {
      return redirectWithError('State parameter invalid - posibil atac CSRF');
    }

    // Decode state pentru a obține email-ul
    let email = '';
    try {
      const stateData = JSON.parse(Buffer.from(stateReceived, 'base64url').toString());
      email = stateData.email || '';
    } catch {
      return redirectWithError('State parameter corupt');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    // Exchange code pentru tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return redirectWithError('Nu s-a primit refresh token. Revocă accesul la https://myaccount.google.com/permissions și încearcă din nou.');
    }

    // Encriptează refresh token
    const encryptedRefresh = encryptToken(tokens.refresh_token);

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const id = `GMAIL_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Dezactivează token-urile vechi pentru acest email
    await bigquery.query({
      query: `UPDATE \`${DATASET}.GmailTokens_v2\` SET is_active = FALSE, actualizat_la = CURRENT_TIMESTAMP() WHERE user_email = @email AND is_active = TRUE`,
      params: { email },
    });

    // Salvează noul token
    await bigquery.dataset(DATASET).table('GmailTokens_v2').insert([{
      id,
      user_email: email,
      refresh_token: encryptedRefresh,
      access_token: tokens.access_token || '',
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      scope: (tokens.scope || 'gmail.readonly gmail.send'),
      is_active: true,
      creat_la: now,
      actualizat_la: now,
      data_creare: BigQuery.date(today),
    }]);

    console.log(`✅ [Gmail OAuth] Token saved for ${email}`);

    // Redirect la pagina admin cu success
    const successUrl = new URL('/admin/setari/email-connect', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    successUrl.searchParams.set('success', email);

    const response = NextResponse.redirect(successUrl);
    response.cookies.delete('gmail_oauth_state');
    return response;

  } catch (error: any) {
    console.error('❌ [Gmail OAuth] Callback error:', error);
    return redirectWithError(error.message || 'Eroare necunoscută');
  }
}

function redirectWithError(error: string): NextResponse {
  const errorUrl = new URL('/admin/setari/email-connect', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  errorUrl.searchParams.set('error', error);
  const response = NextResponse.redirect(errorUrl);
  response.cookies.delete('gmail_oauth_state');
  return response;
}

function encryptToken(token: string): string {
  const key = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY invalid (trebuie 64 caractere hex)');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
