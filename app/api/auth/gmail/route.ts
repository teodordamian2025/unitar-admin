// app/api/auth/gmail/route.ts
// OAuth Flow Gmail - Step 1: Authorization
// Redirect user la Google consent screen pentru Gmail access
// GET /api/auth/gmail?email=office@unitarproiect.eu

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email') || '';

    // Validare email permis
    const allowedEmails = ['office@unitarproiect.eu', 'contact@unitarproiect.eu'];
    if (!allowedEmails.includes(email)) {
      return NextResponse.json(
        { success: false, error: `Email nepermis. Permise: ${allowedEmails.join(', ')}` },
        { status: 400 }
      );
    }

    const state = JSON.stringify({
      csrf: crypto.randomUUID(),
      email,
    });

    const stateEncoded = Buffer.from(state).toString('base64url');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
      ],
      prompt: 'consent',
      state: stateEncoded,
      login_hint: email,
    });

    const response = NextResponse.redirect(authUrl);

    response.cookies.set('gmail_oauth_state', stateEncoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/api/auth/gmail',
    });

    return response;

  } catch (error: any) {
    console.error('❌ [Gmail OAuth] Authorization error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
