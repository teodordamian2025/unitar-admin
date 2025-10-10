// CALEA: /lib/notifications/send-email.ts
// DATA: 05.10.2025 (ora României)
// DESCRIERE: Helper pentru trimitere email notificări (reutilizare pattern ANAF)

import nodemailer from 'nodemailer';
import type {
  EmailPayload,
  EmailSendResult,
  EmailTemplate,
  NotificareContext
} from './types';

// =====================================================
// SMTP TRANSPORTER CONFIGURATION (singleton)
// =====================================================

let transporter: nodemailer.Transporter | null = null;

export function getEmailTransporter() {
  if (!transporter) {
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true pentru 465, false pentru alte porturi
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    transporter = nodemailer.createTransport(smtpConfig);
  }

  return transporter;
}

// =====================================================
// TEMPLATE RENDERING
// =====================================================

/**
 * Renderizează template cu variabile din context
 * Suportă: {{variable}}, {{#if condition}}...{{/if}}
 */
export function renderTemplate(template: string, context: NotificareContext): string {
  let rendered = template;

  // Replace simple variables {{variable}}
  rendered = rendered.replace(/\{\{([^}#/]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = context[trimmedKey];
    return value !== undefined && value !== null ? String(value) : '';
  });

  // Handle {{#if condition}}...{{/if}} (multiline with [\s\S])
  rendered = rendered.replace(
    /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, condition, content) => {
      const trimmedCondition = condition.trim();
      const value = context[trimmedCondition];

      // Truthy check
      if (value && (typeof value !== 'number' || value !== 0)) {
        return content;
      }
      return '';
    }
  );

  return rendered;
}

// =====================================================
// EMAIL SENDING
// =====================================================

/**
 * Trimite email cu payload complet
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  try {
    const transport = getEmailTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || 'UNITAR PROIECT TDA <office@unitarproiect.eu>',
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      cc: payload.cc?.join(', '),
      bcc: payload.bcc?.join(', '),
      replyTo: payload.replyTo || process.env.SMTP_FROM,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    };

    const info = await transport.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      deliveredTo: Array.isArray(payload.to) ? payload.to : [payload.to],
    };
  } catch (error: any) {
    console.error('❌ Email send error:', error);
    return {
      success: false,
      error: error.message || 'Unknown email error',
    };
  }
}

/**
 * Trimite email bazat pe template și context
 */
export async function sendNotificationEmail(
  to: string | string[],
  templateSubject: string,
  templateContent: string,
  templateHtml: string,
  context: NotificareContext,
  options?: {
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: any[];
  }
): Promise<EmailSendResult> {
  const subject = renderTemplate(templateSubject, context);
  const text = renderTemplate(templateContent, context);
  const html = wrapEmailHTML(renderTemplate(templateHtml, context), subject);

  return sendEmail({
    to,
    cc: options?.cc,
    bcc: options?.bcc,
    subject,
    text,
    html,
    replyTo: options?.replyTo,
    attachments: options?.attachments,
  });
}

// =====================================================
// HTML EMAIL WRAPPER (design consistent UNITAR)
// =====================================================

export function wrapEmailHTML(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
      padding: 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    .email-header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .email-header .logo {
      margin-bottom: 15px;
    }
    .email-body {
      padding: 30px 25px;
    }
    .email-body p {
      margin-bottom: 15px;
      color: #4b5563;
      font-size: 15px;
    }
    .email-body strong {
      color: #1f2937;
      font-weight: 600;
    }
    .email-body blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 16px;
      margin: 20px 0;
      font-style: italic;
      color: #6b7280;
    }
    .cta-button {
      display: inline-block;
      background-color: #3b82f6;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      transition: background-color 0.3s ease;
    }
    .cta-button:hover {
      background-color: #2563eb;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 25px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .email-footer p {
      color: #6b7280;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .email-footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    .alert-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box {
      background-color: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .success-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="logo">
        <svg width="180" height="40" viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="180" height="40" rx="8" fill="white" fill-opacity="0.2"/>
          <text x="90" y="27" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">UNITAR PROIECT TDA</text>
        </svg>
      </div>
      <h1>${title}</h1>
    </div>
    <div class="email-body">
      ${content}
      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        Cu stimă,<br>
        <strong>Echipa UNITAR PROIECT TDA</strong>
      </p>
    </div>
    <div class="email-footer">
      <p><strong>UNITAR PROIECT TDA</strong></p>
      <p>
        📧 <a href="mailto:office@unitarproiect.eu">office@unitarproiect.eu</a> |
        🌐 <a href="https://admin.unitarproiect.eu">admin.unitarproiect.eu</a>
      </p>
      <p style="margin-top: 15px; font-size: 12px;">
        Acest email a fost trimis automat de sistemul UNITAR PROIECT TDA.<br>
        Dacă aveți întrebări, vă rugăm să ne contactați.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validează adresă email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitizează conținut HTML pentru email
 */
export function sanitizeHTML(html: string): string {
  // Basic sanitization - în producție folosește bibliotecă dedicată
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Extrage plain text din HTML
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// =====================================================
// BATCH EMAIL SENDING
// =====================================================

/**
 * Trimite email-uri în batch cu rate limiting
 */
export async function sendBatchEmails(
  emails: EmailPayload[],
  options?: {
    batchSize?: number;
    delayMs?: number;
  }
): Promise<EmailSendResult[]> {
  const batchSize = options?.batchSize || 10;
  const delayMs = options?.delayMs || 1000;
  const results: EmailSendResult[] = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(email => sendEmail(email))
    );

    results.push(...batchResults);

    // Delay între batch-uri pentru a evita rate limiting
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  getEmailTransporter,
  renderTemplate,
  sendEmail,
  sendNotificationEmail,
  wrapEmailHTML,
  isValidEmail,
  sanitizeHTML,
  htmlToPlainText,
  sendBatchEmails,
};
