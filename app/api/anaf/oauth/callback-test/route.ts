// CALEA: app/api/anaf/oauth/callback-test/route.ts
// DESCRIERE: Test simplu pentru a verifica dacă route-urile funcționează

import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('🧪 TEST CALLBACK - Route funcționează!');
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('📥 Test parameters:', { code, state, error });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?test=success&code=${code}&state=${state}`
    );

  } catch (error) {
    console.error('❌ Test callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/anaf/setup?test=error&message=${error}`
    );
  }
}
