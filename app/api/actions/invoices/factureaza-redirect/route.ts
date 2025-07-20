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
    const { proiectId } = await request.json();

    if (!proiectId) {
      return NextResponse.json({ 
        error: 'ID proiect necesar' 
      }, { status: 400 });
    }

    // Verifică dacă API key-ul este configurat
    if (!process.env.FACTUREAZA_API_KEY || !process.env.FACTUREAZA_API_ENDPOINT) {
      return NextResponse.json({ 
        error: 'Configurare factureaza.me incompletă. Verifică variabilele de mediu.' 
      }, { status: 500 });
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

    // 2. Obține informații despre client
    let clientInfo = null;
    try {
      const clientQuery = `
        SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
        WHERE nume = @clientNume
        LIMIT 1
      `;

      const [clientRows] = await bigquery.query({
        query: clientQuery,
        params: { clientNume: proiect.Client },
        location: 'EU',
      });

      if (clientRows.length > 0) {
        clientInfo = clientRows[0];
      }
    } catch (error) {
      console.log('Nu s-au găsit informații detaliate despre client:', error);
    }

    // 3. Pregătește datele pentru API factureaza.me
    const invoiceData = prepareFactureazaApiData(proiect, clientInfo);

    // 4. Creează factura prin API factureaza.me
    const factureazaResult = await createInvoiceViaApi(invoiceData);

    if (!factureazaResult.success) {
      return NextResponse.json({ 
        error: 'Eroare la crearea facturii în factureaza.me',
        details: factureazaResult.error 
      }, { status: 500 });
    }

    // 5. Salvează rezultatul pentru tracking
    await saveInvoiceResult(proiectId, invoiceData, factureazaResult.data);

    return NextResponse.json({
      success: true,
      message: 'Factură creată cu succes în factureaza.me',
      invoiceId: factureazaResult.data.id,
      invoiceUrl: factureazaResult.data.public_url,
      downloadUrl: factureazaResult.data.download_url,
      factureazaData: factureazaResult.data
    });

  } catch (error) {
    console.error('Eroare la crearea facturii:', error);
    return NextResponse.json({ 
      error: 'Eroare la crearea facturii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

function prepareFactureazaApiData(proiect: any, clientInfo: any | null) {
  const currentDate = new Date();
  const dueDateDefault = new Date();
  dueDateDefault.setDate(currentDate.getDate() + 30); // 30 zile termen de plată

  // Calculează TVA și total
  const valoareFaraTva = proiect.Valoare_Estimata || 0;
  const rataTva = 19; // 19% TVA standard România
  const valoareTva = valoareFaraTva * (rataTva / 100);
  const valoareTotala = valoareFaraTva + valoareTva;

  return {
    // Informații factură
    tip: 'factura',
    serie: 'UNI',
    numar: generateInvoiceNumber(),
    data: formatDateForApi(currentDate),
    scadenta: formatDateForApi(dueDateDefault),
    moneda: 'RON',
    
    // Informații client
    client: {
      tip: clientInfo?.tip_client || 'persoana_juridica',
      nume: proiect.Client,
      cui: clientInfo?.cui || '',
      nr_reg_com: clientInfo?.nr_reg_com || '',
      adresa: clientInfo?.adresa || '',
      judet: clientInfo?.judet || '',
      oras: clientInfo?.oras || '',
      cod_postal: clientInfo?.cod_postal || '',
      tara: 'România',
      telefon: clientInfo?.telefon || '',
      email: clientInfo?.email || '',
      banca: clientInfo?.banca || '',
      iban: clientInfo?.iban || ''
    },
    
    // Produse/servicii
    produse: [
      {
        nume: `Servicii inginerie structurală - ${proiect.Denumire}`,
        descriere: `Prestări servicii de inginerie structurală pentru proiectul ${proiect.ID_Proiect}`,
        um: 'buc',
        cantitate: 1,
        pret: valoareFaraTva,
        reducere: 0,
        cota_tva: rataTva
      }
    ],
    
    // Totale
    subtotal: valoareFaraTva,
    total_tva: valoareTva,
    total: valoareTotala,
    
    // Informații plată
    modalitate_plata: 'Transfer bancar',
    termene_conditii: 'Plata se face în termen de 30 de zile de la data facturii.',
    
    // Metadata
    observatii: `Proiect: ${proiect.ID_Proiect} - ${proiect.Denumire}`,
    referinta_externa: proiect.ID_Proiect
  };
}

async function createInvoiceViaApi(invoiceData: any) {
  try {
    const response = await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/facturi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FACTUREAZA_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseData.message || responseData.error || 'Eroare necunoscută de la factureaza.me'
      };
    }

    return {
      success: true,
      data: responseData
    };

  } catch (error) {
    console.error('Eroare la apelul API factureaza.me:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Eroare de conectare la factureaza.me'
    };
  }
}

async function saveInvoiceResult(proiectId: string, invoiceData: any, factureazaResponse: any) {
  try {
    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.FacturiGenerate\`
      (id, proiect_id, id_factura_externa, numar_factura, data_creare, valoare_totala, 
       status, url_publica, url_download, date_complete_json)
      VALUES (@id, @proiectId, @idFacturaExterna, @numarFactura, @dataCreare, @valoareTotala,
              @status, @urlPublica, @urlDownload, @dateComplete)
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: `factura_${proiectId}_${Date.now()}`,
        proiectId,
        idFacturaExterna: factureazaResponse.id || '',
        numarFactura: `${invoiceData.serie}${invoiceData.numar}`,
        dataCreare: new Date().toISOString(),
        valoareTotala: invoiceData.total,
        status: 'creata',
        urlPublica: factureazaResponse.public_url || '',
        urlDownload: factureazaResponse.download_url || '',
        dateComplete: JSON.stringify({
          invoiceData,
          factureazaResponse
        })
      },
      location: 'EU',
    });
  } catch (error) {
    console.log('Nu s-a putut salva rezultatul facturii:', error);
  }
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4); // ultimele 4 cifre
  return `${year}${month}${timestamp}`;
}

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// GET endpoint pentru verificarea statusului facturii (webhook de la factureaza.me)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoice_id');
    const status = searchParams.get('status');

    // Aici poți implementa logica pentru webhook-uri de la factureaza.me
    // când statusul facturii se schimbă (plătită, anulată, etc.)

    return NextResponse.json({
      success: true,
      message: 'Webhook procesat cu succes'
    });

  } catch (error) {
    console.error('Eroare la procesarea webhook-ului:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea webhook-ului'
    }, { status: 500 });
  }
}
