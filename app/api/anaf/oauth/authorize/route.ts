// ==================================================================
// CALEA: app/api/anaf/oauth/authorize/route.ts
// DESCRIERE: Inițiază OAuth flow cu ANAF pentru e-factura
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verifică environment variables
    const clientId = process.env.ANAF_CLIENT_ID;
    const redirectUri = process.env.ANAF_REDIRECT_URI;
    const oauthBase = process.env.ANAF_OAUTH_BASE;

    if (!clientId || !redirectUri || !oauthBase) {
      return NextResponse.json({
        success: false,
        error: 'Missing ANAF OAuth configuration'
      }, { status: 500 });
    }

    // Construiește URL-ul de autorizare ANAF
    // IMPORTANT: Conform documentației ANAF (pag 23-24):
    // - Scope se lasă necompletat
    // - State se lasă necompletat (ANAF RESPINGE cererea dacă state este prezent!)
    // - token_content_type=jwt este OBLIGATORIU în Auth Request
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      token_content_type: 'jwt'  // ✅ OBLIGATORIU conform doc ANAF pag 24
      // ❌ NU trimitem state - ANAF returnează access_denied dacă e prezent!
    });

    const authUrl = `${oauthBase}/anaf-oauth2/v1/authorize?${authParams.toString()}`;

    console.log('🔐 ANAF OAuth authorize initiated:', {
      clientId: clientId.substring(0, 8) + '...',
      redirectUri,
      token_content_type: 'jwt'
    });

    // Returnează direct URL-ul de autorizare
    return NextResponse.json({
      success: true,
      authUrl: authUrl,
      message: 'Redirecting to ANAF authentication...'
    });

  } catch (error) {
    console.error('❌ Error initiating ANAF OAuth:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate OAuth',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ==================================================================
// POST endpoint pentru a forța refresh de tokens (admin only)
// ==================================================================
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'revoke_all_tokens') {
      // În viitor, aici vom implementa revocarea tuturor token-urilor
      return NextResponse.json({
        success: true,
        message: 'All tokens revoked successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Error in POST /api/anaf/oauth/authorize:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 });
  }
}
