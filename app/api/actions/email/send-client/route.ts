import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { proiectId, emailType = 'status_update' } = await request.json();

    if (!proiectId) {
      return NextResponse.json({ 
        error: 'ID proiect necesar' 
      }, { status: 400 });
    }

    // 1. Obține datele proiectului din BigQuery
    const projectQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Proiecte\`
      WHERE ID_Proiect = @proiectId
    `;

    const [projectRows] = await bigquery.query({
      query: projectQuery,
      params: { proiectId },
      location: 'EU',
    });

    if (projectRows.length === 0) {
      return NextResponse.json({ 
        error: 'Proiectul nu a fost găsit' 
      }, { status: 404 });
    }

    const proiect = projectRows[0];

    // 2. Obține informații despre client (email)
    let clientEmail = null;
    try {
      const clientQuery = `
        SELECT email FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
        WHERE nume = @clientNume
        LIMIT 1
      `;

      const [clientRows] = await bigquery.query({
        query: clientQuery,
        params: { clientNume: proiect.Client },
        location: 'EU',
      });

      if (clientRows.length > 0 && clientRows[0].email) {
        clientEmail = clientRows[0].email;
      }
    } catch (error) {
      console.log('Nu s-a găsit email-ul clientului:', error);
    }

    if (!clientEmail) {
      return NextResponse.json({ 
        error: 'Email-ul clientului nu a fost găsit. Actualizați informațiile clientului.' 
      }, { status: 400 });
    }

    // 3. Generează conținutul email-ului
    const emailData = generateEmailContent(proiect, emailType);

    // 4. Trimite email-ul (simulare pentru moment)
    const emailResult = await sendEmail(clientEmail, emailData);

    // 5. Salvează log-ul email-ului
    await saveEmailLog(proiectId, clientEmail, emailType, emailResult.success);

    return NextResponse.json({
      success: true,
      message: emailResult.success ? 'Email trimis cu succes' : 'Email programat pentru trimitere',
      emailSent: emailResult.success,
      recipient: clientEmail,
      subject: emailData.subject
    });

  } catch (error) {
    console.error('Eroare la trimiterea email-ului:', error);
    return NextResponse.json({ 
      error: 'Eroare la trimiterea email-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

function generateEmailContent(proiect: any, emailType: string) {
  const companyName = 'UNITAR PROIECT TDA';
  const companyEmail = process.env.UNITAR_EMAIL || 'office@unitarproiect.eu';
  const companyPhone = process.env.UNITAR_TELEFON || '';

  switch (emailType) {
    case 'status_update':
      return {
        subject: `Update proiect ${proiect.ID_Proiect} - ${proiect.Denumire}`,
        text: `
Bună ziua,

Vă informăm despre statusul proiectului dumneavoastră:

Proiect: ${proiect.Denumire}
ID: ${proiect.ID_Proiect}
Status actual: ${proiect.Status}
${proiect.Data_Start ? `Data început: ${formatDate(proiect.Data_Start)}` : ''}
${proiect.Data_Final ? `Data finalizare estimată: ${formatDate(proiect.Data_Final)}` : ''}

Pentru orice întrebări, nu ezitați să ne contactați.

Cu stimă,
Echipa ${companyName}
Email: ${companyEmail}
${companyPhone ? `Telefon: ${companyPhone}` : ''}
        `,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #2c3e50; margin: 0;">Update Proiect</h2>
    <p style="color: #7f8c8d; margin: 0;">Informare status proiect</p>
  </div>
  
  <p>Bună ziua,</p>
  
  <p>Vă informăm despre statusul proiectului dumneavoastră:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
    <p><strong>Proiect:</strong> ${proiect.Denumire}</p>
    <p><strong>ID:</strong> ${proiect.ID_Proiect}</p>
    <p><strong>Status actual:</strong> <span style="color: #27ae60; font-weight: bold;">${proiect.Status}</span></p>
    ${proiect.Data_Start ? `<p><strong>Data început:</strong> ${formatDate(proiect.Data_Start)}</p>` : ''}
    ${proiect.Data_Final ? `<p><strong>Data finalizare estimată:</strong> ${formatDate(proiect.Data_Final)}</p>` : ''}
  </div>
  
  <p>Pentru orice întrebări, nu ezitați să ne contactați.</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
    <p><strong>Cu stimă,<br>Echipa ${companyName}</strong></p>
    <p style="color: #7f8c8d; font-size: 14px;">
      Email: ${companyEmail}<br>
      ${companyPhone ? `Telefon: ${companyPhone}` : ''}
    </p>
  </div>
</div>
        `
      };

    case 'contract_ready':
      return {
        subject: `Contract pregătit - ${proiect.ID_Proiect}`,
        text: `
Bună ziua,

Contractul pentru proiectul "${proiect.Denumire}" este pregătit pentru semnare.

Vă rugăm să ne contactați pentru stabilirea unei întâlniri sau pentru trimiterea documentelor.

Cu stimă,
Echipa ${companyName}
        `,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Contract Pregătit</h2>
  <p>Bună ziua,</p>
  <p>Contractul pentru proiectul <strong>"${proiect.Denumire}"</strong> este pregătit pentru semnare.</p>
  <p>Vă rugăm să ne contactați pentru stabilirea unei întâlniri sau pentru trimiterea documentelor.</p>
  <p><strong>Cu stimă,<br>Echipa ${companyName}</strong></p>
</div>
        `
      };

    case 'project_completed':
      return {
        subject: `Proiect finalizat - ${proiect.ID_Proiect}`,
        text: `
Bună ziua,

Avem plăcerea să vă anunțăm că proiectul "${proiect.Denumire}" a fost finalizat cu succes.

Documentația finală va fi transmisă în scurt timp.

Mulțumim pentru încrederea acordată!

Cu stimă,
Echipa ${companyName}
        `,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">🎉 Proiect Finalizat</h2>
  <p>Bună ziua,</p>
  <p>Avem plăcerea să vă anunțăm că proiectul <strong>"${proiect.Denumire}"</strong> a fost finalizat cu succes.</p>
  <p>Documentația finală va fi transmisă în scurt timp.</p>
  <p><strong>Mulțumim pentru încrederea acordată!</strong></p>
  <p><strong>Cu stimă,<br>Echipa ${companyName}</strong></p>
</div>
        `
      };

    default:
      return {
        subject: `Notificare proiect ${proiect.ID_Proiect}`,
        text: `Bună ziua,\n\nVă contactăm în legătură cu proiectul ${proiect.Denumire}.\n\nCu stimă,\nEchipa ${companyName}`,
        html: `<p>Bună ziua,</p><p>Vă contactăm în legătură cu proiectul <strong>${proiect.Denumire}</strong>.</p><p>Cu stimă,<br>Echipa ${companyName}</p>`
      };
  }
}

async function sendEmail(recipient: string, emailData: any) {
  // Pentru moment, simulăm trimiterea email-ului
  // În implementarea reală, aici ar fi integrarea cu serviciul de email
  // (Gmail API, SendGrid, AWS SES, etc.)
  
  console.log('Simulare trimitere email:', {
    to: recipient,
    subject: emailData.subject,
    text: emailData.text.substring(0, 100) + '...'
  });

  // Simulează un delay și succes random pentru testare
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // În implementarea reală, aici ar fi:
  /*
  try {
    const result = await emailService.send({
      to: recipient,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
  */

  return { success: true, messageId: `sim_${Date.now()}` };
}

async function saveEmailLog(proiectId: string, recipient: string, emailType: string, success: boolean) {
  try {
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.EmailLog\`
      (id, proiect_id, recipient, email_type, status, data_trimitere)
      VALUES (@id, @proiectId, @recipient, @emailType, @status, @dataTrimitere)
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: `email_${proiectId}_${Date.now()}`,
        proiectId,
        recipient,
        emailType,
        status: success ? 'trimis' : 'esuat',
        dataTrimitere: new Date().toISOString()
      },
      location: 'EU',
    });
  } catch (error) {
    console.log('Nu s-a putut salva log-ul email-ului:', error);
  }
}

function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return date.toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
