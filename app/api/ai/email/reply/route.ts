// app/api/ai/email/reply/route.ts
// API pentru trimitere reply la email prin Gmail API

import { NextRequest, NextResponse } from 'next/server';
import { replyToEmail, sendNewEmail, isEmailConnected } from '@/lib/gmail-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email_account, message_id, reply_body, to, subject, is_new } = body;

    const account = email_account || 'office@unitarproiect.eu';

    if (!reply_body && !is_new) {
      return NextResponse.json(
        { success: false, error: 'reply_body este obligatoriu' },
        { status: 400 }
      );
    }

    // Verifică dacă contul e conectat
    const connected = await isEmailConnected(account);
    if (!connected) {
      return NextResponse.json({
        success: false,
        error: `Contul ${account} nu este conectat. Mergi la Setări → Email Connect.`,
        needs_auth: true,
      }, { status: 401 });
    }

    let result;

    if (is_new && to && subject) {
      // Email nou
      result = await sendNewEmail(account, to, subject, reply_body);
    } else if (message_id) {
      // Reply la email existent
      result = await replyToEmail(account, message_id, reply_body);
    } else {
      return NextResponse.json(
        { success: false, error: 'Specifică message_id pentru reply sau to+subject+is_new pentru email nou' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Eroare la trimitere' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: is_new ? 'Email trimis cu succes' : 'Reply trimis cu succes',
      messageId: result.messageId,
      account,
    });

  } catch (error: any) {
    console.error('❌ Eroare reply email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Eroare la trimitere email' },
      { status: 500 }
    );
  }
}
