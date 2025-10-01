import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_FACTURI_GENERATE = `\`${PROJECT_ID}.${DATASET}.FacturiGenerate${tableSuffix}\``;
const TABLE_PROIECTE = `\`${PROJECT_ID}.${DATASET}.Proiecte${tableSuffix}\``;

console.log(`🔧 Invoice Webhook API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using tables: FacturiGenerate${tableSuffix}, Proiecte${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// Webhook endpoint pentru notificări de la factureaza.me
export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json();
    
    console.log('Webhook primit de la factureaza.me:', webhookData);

    // Validare webhook (opțional - verifică semnătura dacă factureaza.me o oferă)
    const isValidWebhook = await validateWebhook(request, webhookData);
    if (!isValidWebhook) {
      return NextResponse.json({ 
        error: 'Webhook invalid' 
      }, { status: 401 });
    }

    // Procesează diferite tipuri de evenimente
    const result = await processWebhookEvent(webhookData);

    return NextResponse.json({
      success: true,
      message: 'Webhook procesat cu succes',
      processed: result
    });

  } catch (error) {
    console.error('Eroare la procesarea webhook-ului factureaza.me:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea webhook-ului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

async function validateWebhook(request: NextRequest, data: any): Promise<boolean> {
  // Implementează validarea webhook-ului dacă factureaza.me oferă semnături
  // Pentru moment, returnăm true
  // În implementarea reală, verifici header-ul de semnătură
  
  const signature = request.headers.get('X-Factureaza-Signature');
  if (!signature) {
    console.log('Webhook fără semnătură - acceptat pentru testare');
    return true;
  }

  // TODO: Implementează verificarea semnăturii
  // const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(data)).digest('hex');
  // return signature === expectedSignature;

  return true;
}

async function processWebhookEvent(webhookData: any) {
  const { event_type, invoice_id, data } = webhookData;

  switch (event_type) {
    case 'invoice.created':
      return await handleInvoiceCreated(invoice_id, data);
    
    case 'invoice.paid':
      return await handleInvoicePaid(invoice_id, data);
    
    case 'invoice.cancelled':
      return await handleInvoiceCancelled(invoice_id, data);
    
    case 'invoice.updated':
      return await handleInvoiceUpdated(invoice_id, data);
    
    default:
      console.log(`Tip eveniment necunoscut: ${event_type}`);
      return { processed: false, reason: 'Tip eveniment necunoscut' };
  }
}

async function handleInvoiceCreated(invoiceId: string, data: any) {
  try {
    // Actualizează statusul facturii în baza de date
    const updateQuery = `
      UPDATE ${TABLE_FACTURI_GENERATE}
      SET status = 'creata_confirmat',
          data_confirmare = @dataConfirmare,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        invoiceId,
        dataConfirmare: new Date().toISOString(),
        webhookData: JSON.stringify(data)
      },
      location: 'EU',
    });

    console.log(`Factură confirmată: ${invoiceId}`);
    return { processed: true, action: 'invoice_confirmed' };

  } catch (error) {
    console.error('Eroare la confirmarea facturii:', error);
    return { processed: false, error: error.message };
  }
}

async function handleInvoicePaid(invoiceId: string, data: any) {
  try {
    // Actualizează statusul facturii ca plătită
    const updateQuery = `
      UPDATE ${TABLE_FACTURI_GENERATE}
      SET status = 'platita',
          data_plata = @dataPlata,
          suma_platita = @sumaPlata,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        invoiceId,
        dataPlata: data.payment_date || new Date().toISOString(),
        sumaPlata: data.paid_amount || data.total_amount,
        webhookData: JSON.stringify(data)
      },
      location: 'EU',
    });

    // Opțional: Actualizează și statusul proiectului
    if (data.external_reference) {
      await updateProjectPaymentStatus(data.external_reference, 'platit');
    }

    console.log(`Factură plătită: ${invoiceId}`);
    return { processed: true, action: 'invoice_paid' };

  } catch (error) {
    console.error('Eroare la procesarea plății:', error);
    return { processed: false, error: error.message };
  }
}

async function handleInvoiceCancelled(invoiceId: string, data: any) {
  try {
    // Actualizează statusul facturii ca anulată
    const updateQuery = `
      UPDATE ${TABLE_FACTURI_GENERATE}
      SET status = 'anulata',
          data_anulare = @dataAnulare,
          motiv_anulare = @motivAnulare,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        invoiceId,
        dataAnulare: new Date().toISOString(),
        motivAnulare: data.cancellation_reason || 'Nu a fost specificat',
        webhookData: JSON.stringify(data)
      },
      location: 'EU',
    });

    console.log(`Factură anulată: ${invoiceId}`);
    return { processed: true, action: 'invoice_cancelled' };

  } catch (error) {
    console.error('Eroare la anularea facturii:', error);
    return { processed: false, error: error.message };
  }
}

async function handleInvoiceUpdated(invoiceId: string, data: any) {
  try {
    // Actualizează datele facturii
    const updateQuery = `
      UPDATE ${TABLE_FACTURI_GENERATE}
      SET data_actualizare = @dataActualizare,
          webhook_data = @webhookData
      WHERE id_factura_externa = @invoiceId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        invoiceId,
        dataActualizare: new Date().toISOString(),
        webhookData: JSON.stringify(data)
      },
      location: 'EU',
    });

    console.log(`Factură actualizată: ${invoiceId}`);
    return { processed: true, action: 'invoice_updated' };

  } catch (error) {
    console.error('Eroare la actualizarea facturii:', error);
    return { processed: false, error: error.message };
  }
}

async function updateProjectPaymentStatus(proiectId: string, status: string) {
  try {
    // Actualizează statusul de plată al proiectului
    const updateQuery = `
      UPDATE ${TABLE_PROIECTE}
      SET Status_Plata = @statusPlata,
          Data_Actualizare_Plata = @dataActualizare
      WHERE ID_Proiect = @proiectId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        proiectId,
        statusPlata: status,
        dataActualizare: new Date().toISOString()
      },
      location: 'EU',
    });

    console.log(`Status plată actualizat pentru proiectul ${proiectId}: ${status}`);

  } catch (error) {
    console.error('Eroare la actualizarea statusului de plată:', error);
  }
}

// GET endpoint pentru testare webhook
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Webhook endpoint activ',
    url: request.url,
    timestamp: new Date().toISOString()
  });
}
