import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_CLIENTI = `\`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\``;

console.log(`🔧 Sync Factureaza API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: Clienti${tableSuffix}`);

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

// GET - Sincronizează clienți din factureaza.me către BigQuery
export async function GET(request: NextRequest) {
  try {
    if (!process.env.FACTUREAZA_API_KEY || !process.env.FACTUREAZA_API_ENDPOINT) {
      return NextResponse.json({ 
        error: 'Configurare factureaza.me incompletă' 
      }, { status: 500 });
    }

    // 1. Obține clienții din factureaza.me
    const factureazaClients = await fetchClientsFromFactureaza();
    
    if (!factureazaClients.success) {
      return NextResponse.json({ 
        error: 'Eroare la obținerea clienților din factureaza.me',
        details: factureazaClients.error 
      }, { status: 500 });
    }

    // 2. Sincronizează cu BigQuery
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Verifică că avem date valide
    const clientsToSync = factureazaClients.data || [];

    for (const client of clientsToSync) {
      try {
        await syncClientToBigQuery(client);
        syncedCount++;
      } catch (error) {
        errorCount++;
        errors.push(`${client.nume}: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sincronizare completă: ${syncedCount} clienți sincronizați, ${errorCount} erori`,
      totalClients: clientsToSync.length,
      syncedCount,
      errorCount,
      errors: errorCount > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Eroare la sincronizarea clienților:', error);
    return NextResponse.json({ 
      error: 'Eroare la sincronizarea clienților',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

// POST - Adaugă client nou în ambele sisteme (BigQuery + factureaza.me)
export async function POST(request: NextRequest) {
  try {
    const clientData = await request.json();

    // Validări obligatorii
    if (!clientData.nume) {
      return NextResponse.json({ 
        error: 'Numele clientului este obligatoriu' 
      }, { status: 400 });
    }

    // 1. Adaugă clientul în factureaza.me
    const factureazaResult = await addClientToFactureaza(clientData);
    
    if (!factureazaResult.success) {
      return NextResponse.json({ 
        error: 'Eroare la adăugarea clientului în factureaza.me',
        details: factureazaResult.error 
      }, { status: 500 });
    }

    // 2. Adaugă clientul în BigQuery cu ID-ul din factureaza.me
    const bigQueryResult = await addClientToBigQuery({
      ...clientData,
      id_factureaza: factureazaResult.data.id,
      sincronizat_factureaza: true
    });

    if (!bigQueryResult.success) {
      // Dacă BigQuery eșuează, încearcă să ștergi din factureaza.me (rollback)
      console.warn('BigQuery failed, attempting rollback in factureaza.me');
      await deleteClientFromFactureaza(factureazaResult.data.id);
      
      return NextResponse.json({ 
        error: 'Eroare la salvarea în BigQuery',
        details: bigQueryResult.error 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Client adăugat cu succes în ambele sisteme',
      factureazaId: factureazaResult.data.id,
      bigQueryId: bigQueryResult.data?.id || 'unknown'
    });

  } catch (error) {
    console.error('Eroare la adăugarea clientului:', error);
    return NextResponse.json({ 
      error: 'Eroare la adăugarea clientului',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

async function fetchClientsFromFactureaza() {
  try {
    console.log('Încercare conectare factureaza.me...'); // Debug
    
    // Endpoint corect conform documentației: /client/list
    const response = await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/client/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.FACTUREAZA_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log('Response status factureaza.me:', response.status); // Debug
    
    const data = await response.json();
    console.log('Response data factureaza.me:', data); // Debug

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `HTTP ${response.status}: Eroare la obținerea clienților`
      };
    }

    // Verifică diferite formate de răspuns
    const clientsData = data.clients || data.clienti || data.data || data;
    
    if (!Array.isArray(clientsData)) {
      console.log('Răspuns neașteptat factureaza.me:', data); // Debug
      return {
        success: false,
        error: 'Format răspuns neașteptat de la factureaza.me'
      };
    }

    console.log(`Găsiți ${clientsData.length} clienți în factureaza.me`); // Debug

    return {
      success: true,
      data: clientsData
    };

  } catch (error) {
    console.error('Eroare conectare factureaza.me:', error); // Debug
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Eroare de conectare'
    };
  }
}

async function addClientToFactureaza(clientData: any) {
  try {
    const factureazaClient = {
      nume: clientData.nume,
      tip: clientData.tip_client || 'persoana_juridica',
      cui: clientData.cui || '',
      nr_reg_com: clientData.nr_reg_com || '',
      adresa: clientData.adresa || '',
      judet: clientData.judet || '',
      oras: clientData.oras || '',
      cod_postal: clientData.cod_postal || '',
      tara: clientData.tara || 'România',
      telefon: clientData.telefon || '',
      email: clientData.email || '',
      banca: clientData.banca || '',
      iban: clientData.iban || '',
      // Pentru persoane fizice
      cnp: clientData.cnp || '',
      ci_serie: clientData.ci_serie || '',
      ci_numar: clientData.ci_numar || '',
      ci_eliberata_de: clientData.ci_eliberata_de || '',
      ci_eliberata_la: clientData.ci_eliberata_la || ''
    };

    // Endpoint corect conform documentației
    const response = await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/client/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FACTUREAZA_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(factureazaClient)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || 'Eroare la adăugarea clientului în factureaza.me'
      };
    }

    return {
      success: true,
      data: data
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Eroare de conectare la factureaza.me'
    };
  }
}

async function syncClientToBigQuery(factureazaClient: any) {
  const clientId = `client_factureaza_${factureazaClient.id || Date.now()}`;

  const insertQuery = `
    INSERT INTO ${TABLE_CLIENTI}
    (id, nume, tip_client, cui, nr_reg_com, adresa, judet, oras, cod_postal, tara,
     telefon, email, banca, iban, cnp, ci_serie, ci_numar, ci_eliberata_de, ci_eliberata_la,
     data_creare, data_actualizare, activ, id_factureaza, sincronizat_factureaza, observatii)
    VALUES (@id, @nume, @tip_client, @cui, @nr_reg_com, @adresa, @judet, @oras, @cod_postal, @tara,
            @telefon, @email, @banca, @iban, @cnp, @ci_serie, @ci_numar, @ci_eliberata_de, @ci_eliberata_la,
            @data_creare, @data_actualizare, @activ, @id_factureaza, @sincronizat_factureaza, @observatii)
  `;

  await bigquery.query({
    query: insertQuery,
    params: {
      id: clientId,
      nume: factureazaClient.nume || '',
      tip_client: factureazaClient.tip || 'persoana_juridica',
      cui: factureazaClient.cui || null,
      nr_reg_com: factureazaClient.nr_reg_com || null,
      adresa: factureazaClient.adresa || null,
      judet: factureazaClient.judet || null,
      oras: factureazaClient.oras || null,
      cod_postal: factureazaClient.cod_postal || null,
      tara: factureazaClient.tara || 'România',
      telefon: factureazaClient.telefon || null,
      email: factureazaClient.email || null,
      banca: factureazaClient.banca || null,
      iban: factureazaClient.iban || null,
      cnp: factureazaClient.cnp || null,
      ci_serie: factureazaClient.ci_serie || null,
      ci_numar: factureazaClient.ci_numar || null,
      ci_eliberata_de: factureazaClient.ci_eliberata_de || null,
      ci_eliberata_la: factureazaClient.ci_eliberata_la || null,
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString(),
      activ: true,
      id_factureaza: factureazaClient.id || '',
      sincronizat_factureaza: true,
      observatii: 'Sincronizat din factureaza.me'
    },
    location: 'EU',
    types: {
      id: 'STRING',
      nume: 'STRING', 
      tip_client: 'STRING',
      cui: 'STRING',
      nr_reg_com: 'STRING',
      adresa: 'STRING',
      judet: 'STRING',
      oras: 'STRING',
      cod_postal: 'STRING',
      tara: 'STRING',
      telefon: 'STRING',
      email: 'STRING',
      banca: 'STRING',
      iban: 'STRING',
      cnp: 'STRING',
      ci_serie: 'STRING',
      ci_numar: 'STRING',
      ci_eliberata_de: 'STRING',
      ci_eliberata_la: 'DATE',
      data_creare: 'TIMESTAMP',
      data_actualizare: 'TIMESTAMP',
      activ: 'BOOLEAN',
      id_factureaza: 'STRING',
      sincronizat_factureaza: 'BOOLEAN',
      observatii: 'STRING'
    }
  });
}

async function addClientToBigQuery(clientData: any) {
  try {
    const clientId = `client_${Date.now()}`;

    const insertQuery = `
      INSERT INTO ${TABLE_CLIENTI}
      (id, nume, tip_client, cui, nr_reg_com, adresa, judet, oras, cod_postal, tara,
       telefon, email, banca, iban, cnp, ci_serie, ci_numar, ci_eliberata_de, ci_eliberata_la,
       data_creare, data_actualizare, activ, id_factureaza, sincronizat_factureaza, observatii)
      VALUES (@id, @nume, @tip_client, @cui, @nr_reg_com, @adresa, @judet, @oras, @cod_postal, @tara,
              @telefon, @email, @banca, @iban, @cnp, @ci_serie, @ci_numar, @ci_eliberata_de, @ci_eliberata_la,
              @data_creare, @data_actualizare, @activ, @id_factureaza, @sincronizat_factureaza, @observatii)
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: clientId,
        nume: clientData.nume,
        tip_client: clientData.tip_client || 'persoana_juridica',
        cui: clientData.cui || '',
        nr_reg_com: clientData.nr_reg_com || '',
        adresa: clientData.adresa || '',
        judet: clientData.judet || '',
        oras: clientData.oras || '',
        cod_postal: clientData.cod_postal || '',
        tara: clientData.tara || 'România',
        telefon: clientData.telefon || '',
        email: clientData.email || '',
        banca: clientData.banca || '',
        iban: clientData.iban || '',
        cnp: clientData.cnp || '',
        ci_serie: clientData.ci_serie || '',
        ci_numar: clientData.ci_numar || '',
        ci_eliberata_de: clientData.ci_eliberata_de || '',
        ci_eliberata_la: clientData.ci_eliberata_la || null,
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString(),
        activ: true,
        id_factureaza: clientData.id_factureaza || '',
        sincronizat_factureaza: clientData.sincronizat_factureaza || false,
        observatii: clientData.observatii || ''
      },
      location: 'EU',
    });

    return {
      success: true,
      data: { id: clientId }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Eroare la salvarea în BigQuery'
    };
  }
}

async function deleteClientFromFactureaza(clientId: string) {
  try {
    await fetch(`${process.env.FACTUREAZA_API_ENDPOINT}/clienti/${clientId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.FACTUREAZA_API_KEY}`
      }
    });
  } catch (error) {
    console.error('Eroare la ștergerea clientului din factureaza.me:', error);
  }
}
