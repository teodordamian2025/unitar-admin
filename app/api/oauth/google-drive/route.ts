// =====================================================
// OAuth Flow Google Drive - Step 1: Authorization
// Redirect user la Google consent screen
// URL: GET /api/oauth/google-drive
// Data: 08.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive/callback`
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // IMPORTANT: pentru refresh token
      scope: ['https://www.googleapis.com/auth/drive'],
      prompt: 'consent', // Forțează consent screen pentru refresh token nou
    });

    console.log('🔐 Redirecting to Google OAuth consent screen...');

    return NextResponse.redirect(authUrl);

  } catch (error: any) {
    console.error('❌ OAuth authorization error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
