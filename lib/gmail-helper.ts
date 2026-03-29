// lib/gmail-helper.ts
// Helper pentru Gmail API - citire inbox și trimitere emailuri

import { google, gmail_v1 } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import crypto from 'crypto';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const DATASET = 'PanouControlUnitar';

function decryptToken(encryptedToken: string): string {
  const key = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY invalid');
  }
  const [ivHex, encryptedHex] = encryptedToken.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Obține un client Gmail autentificat pentru un email
export async function getGmailClient(userEmail: string): Promise<gmail_v1.Gmail> {
  // Fetch token activ din BigQuery
  const [rows] = await bigquery.query({
    query: `SELECT refresh_token, access_token, expires_at
            FROM \`${DATASET}.GmailTokens_v2\`
            WHERE user_email = @email AND is_active = TRUE
            ORDER BY creat_la DESC LIMIT 1`,
    params: { email: userEmail },
  });

  if (!rows || rows.length === 0) {
    throw new Error(`Nu există token Gmail activ pentru ${userEmail}. Conectează contul din Setări → Email Connect.`);
  }

  const token = rows[0];
  const refreshToken = decryptToken(token.refresh_token);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: token.access_token || undefined,
  });

  // Auto-refresh: update token în BigQuery când se reîmprospătează
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      try {
        await bigquery.query({
          query: `UPDATE \`${DATASET}.GmailTokens_v2\`
                  SET access_token = @access_token, expires_at = @expires_at, actualizat_la = CURRENT_TIMESTAMP()
                  WHERE user_email = @email AND is_active = TRUE`,
          params: {
            email: userEmail,
            access_token: tokens.access_token,
            expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600000).toISOString(),
          },
        });
      } catch (e) {
        console.warn('⚠️ Nu s-a putut actualiza access token Gmail:', e);
      }
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Verifică dacă un email e conectat
export async function isEmailConnected(userEmail: string): Promise<boolean> {
  try {
    const [rows] = await bigquery.query({
      query: `SELECT COUNT(*) as cnt FROM \`${DATASET}.GmailTokens_v2\`
              WHERE user_email = @email AND is_active = TRUE`,
      params: { email: userEmail },
    });
    return (rows?.[0]?.cnt || 0) > 0;
  } catch {
    return false;
  }
}

// Tipuri
export type EmailSummary = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  hasAttachments: boolean;
};

export type EmailDetail = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  date: string;
  isUnread: boolean;
  attachments: { filename: string; mimeType: string; size: number }[];
};

// Listare emailuri din inbox
export async function listEmails(
  userEmail: string,
  options: { maxResults?: number; query?: string; unreadOnly?: boolean } = {}
): Promise<EmailSummary[]> {
  const gmail = await getGmailClient(userEmail);

  let q = options.query || '';
  if (options.unreadOnly) q += ' is:unread';

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: options.maxResults || 20,
    q: q.trim() || undefined,
    labelIds: ['INBOX'],
  });

  const messages = res.data.messages || [];
  const emails: EmailSummary[] = [];

  for (const msg of messages.slice(0, options.maxResults || 20)) {
    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      emails.push({
        id: msg.id!,
        threadId: msg.threadId || '',
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        snippet: detail.data.snippet || '',
        date: getHeader('Date'),
        isUnread: (detail.data.labelIds || []).includes('UNREAD'),
        hasAttachments: (detail.data.payload?.parts || []).some(p => p.filename && p.filename.length > 0),
      });
    } catch (e) {
      // Skip mesaje cu erori
    }
  }

  return emails;
}

// Citire detalii email complet
export async function getEmailDetail(userEmail: string, messageId: string): Promise<EmailDetail> {
  const gmail = await getGmailClient(userEmail);

  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = res.data.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  // Extrage body din payload
  let body = '';
  const payload = res.data.payload;

  if (payload?.body?.data) {
    body = Buffer.from(payload.body.data, 'base64url').toString('utf8');
  } else if (payload?.parts) {
    // Caută text/plain sau text/html
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    const part = textPart || htmlPart;
    if (part?.body?.data) {
      body = Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
    // Recursive pentru multipart
    if (!body) {
      for (const p of payload.parts) {
        if (p.parts) {
          const inner = p.parts.find(ip => ip.mimeType === 'text/plain') || p.parts.find(ip => ip.mimeType === 'text/html');
          if (inner?.body?.data) {
            body = Buffer.from(inner.body.data, 'base64url').toString('utf8');
            break;
          }
        }
      }
    }
  }

  // Strip HTML tags pentru text simplu
  if (body.includes('<html') || body.includes('<div') || body.includes('<p')) {
    body = body
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Extrage attachments
  const attachments = (payload?.parts || [])
    .filter(p => p.filename && p.filename.length > 0)
    .map(p => ({
      filename: p.filename || '',
      mimeType: p.mimeType || '',
      size: parseInt(p.body?.size?.toString() || '0'),
    }));

  return {
    id: messageId,
    threadId: res.data.threadId || '',
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    subject: getHeader('Subject'),
    body: body.substring(0, 5000), // Limităm la 5000 caractere
    date: getHeader('Date'),
    isUnread: (res.data.labelIds || []).includes('UNREAD'),
    attachments,
  };
}

// Trimite reply la un email (în același thread)
export async function replyToEmail(
  userEmail: string,
  originalMessageId: string,
  replyBody: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient(userEmail);

    // Obține detalii mesaj original pentru References și In-Reply-To
    const original = await gmail.users.messages.get({
      userId: 'me',
      id: originalMessageId,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Subject', 'Message-ID', 'References'],
    });

    const headers = original.data.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const originalFrom = getHeader('From');
    const originalSubject = getHeader('Subject');
    const originalMessageIdHeader = getHeader('Message-ID');
    const originalReferences = getHeader('References');

    // Construiește subiectul reply
    const replySubject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;

    // Construiește References header
    const references = originalReferences
      ? `${originalReferences} ${originalMessageIdHeader}`
      : originalMessageIdHeader;

    // Construiește mesajul MIME
    const messageParts = [
      `From: ${userEmail}`,
      `To: ${originalFrom}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${originalMessageIdHeader}`,
      `References: ${references}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      replyBody,
    ];

    const rawMessage = Buffer.from(messageParts.join('\r\n')).toString('base64url');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
        threadId: original.data.threadId || undefined,
      },
    });

    return { success: true, messageId: res.data.id || undefined };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Trimite email nou (nu reply)
export async function sendNewEmail(
  userEmail: string,
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient(userEmail);

    const messageParts = [
      `From: ${userEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ];

    const rawMessage = Buffer.from(messageParts.join('\r\n')).toString('base64url');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    });

    return { success: true, messageId: res.data.id || undefined };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
