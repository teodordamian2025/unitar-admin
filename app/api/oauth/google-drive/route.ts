// =====================================================
// OAuth Flow Google Drive - Step 1: Authorization
// Redirect user la Google consent screen
// URL: GET /api/oauth/google-drive
// Data: 08.10.2025
// Update: 28.10.2025 - Added CSRF protection with state parameter
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    // Generate random state token pentru CSRF protection
    const state = crypto.randomUUID();

    console.log('🔐 [OAuth] Generating authorization URL with state:', state.substring(0, 8) + '...');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive/callback`
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // IMPORTANT: pentru refresh token
      scope: ['https://www.googleapis.com/auth/drive'],
      prompt: 'consent', // Forțează consent screen pentru refresh token nou
      state: state, // CSRF protection
    });

    console.log('✅ [OAuth] Redirecting to Google OAuth consent screen...');

    // Redirect cu salvare state în cookie HttpOnly
    const response = NextResponse.redirect(authUrl);

    // Salvăm state în cookie securizat (expires în 10 minute)
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true, // Nu poate fi accesat din JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only în production
      sameSite: 'lax', // CSRF protection
      maxAge: 600, // 10 minute TTL
      path: '/api/oauth/google-drive', // Limitat la callback path
    });

    return response;

  } catch (error: any) {
    console.error('❌ [OAuth] Authorization error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
