// app/api/ai/email/route.ts
// API pentru citire emailuri Gmail prin AI
// GET - listare emailuri + detalii email individual

import { NextRequest, NextResponse } from 'next/server';
import { listEmails, getEmailDetail, isEmailConnected } from '@/lib/gmail-helper';

// GET - Citire emailuri
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email_account = searchParams.get('email_account') || 'office@unitarproiect.eu';
    const message_id = searchParams.get('message_id');
    const query = searchParams.get('query') || '';
    const unread_only = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '15');

    // Verifică dacă contul e conectat
    const connected = await isEmailConnected(email_account);
    if (!connected) {
      return NextResponse.json({
        success: false,
        error: `Contul ${email_account} nu este conectat. Mergi la Setări → Email Connect pentru a autoriza accesul.`,
        needs_auth: true,
      }, { status: 401 });
    }

    // Detalii email individual
    if (message_id) {
      const detail = await getEmailDetail(email_account, message_id);
      return NextResponse.json({
        success: true,
        email: detail,
      });
    }

    // Listare emailuri
    const emails = await listEmails(email_account, {
      maxResults: limit,
      query,
      unreadOnly: unread_only,
    });

    return NextResponse.json({
      success: true,
      emails,
      count: emails.length,
      account: email_account,
    });

  } catch (error: any) {
    console.error('❌ Eroare citire email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la citire emailuri' },
      { status: 500 }
    );
  }
}
