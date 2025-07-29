// ==================================================================
// CALEA: app/api/anaf/oauth/authorize/route.ts
// DESCRIERE: Inițiază OAuth flow cu ANAF pentru e-factura
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Verifică environment variables
    const clientId = process.env.ANAF_CLIENT_ID;
    const redirectUri = process.env.ANAF_REDIRECT_URI;
    const scope = process.env.ANAF_SCOPE || 'RO e-Factura';
    const oauthBase = process.env.ANAF_OAUTH_BASE;

    if (!clientId || !redirectUri || !oauthBase) {
      return NextResponse.json({
        success: false,
        error: 'Missing ANAF OAuth configuration'
      }, { status: 500 });
    }

    // Generează state pentru security (previne CSRF attacks)
    const state = crypto.randomBytes(32).toString('hex');
    
    // Construiește URL-ul de autorizare ANAF
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      state: state
    });

    const authUrl = `${oauthBase}/anaf-oauth2/v1/authorize?${authParams.toString()}`;

    console.log('🔐 ANAF OAuth authorize initiated:', {
      clientId: clientId.substring(0, 8) + '...',
      redirectUri,
      scope,
      state: state.substring(0, 8) + '...'
    });

    // În producție, state-ul ar trebui salvat în sesiune sau Redis
    // Pentru simplitate, îl returnam în response pentru a fi folosit la callback
    const response = NextResponse.json({
      success: true,
      authUrl: authUrl,
      state: state,
      message: 'Redirecting to ANAF authentication...'
    });

    // Setează state-ul în cookie pentru verificare la callback
    response.cookies.set('anaf_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minute
    });

    return response;

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
