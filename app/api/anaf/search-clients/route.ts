// ==================================================================
// CALEA: app/api/anaf/search-clients/route.ts
// DESCRIERE: Căutare și import clienți din ANAF în baza de date
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Configurare BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
  credentials: process.env.GOOGLE_CLOUD_KEY_FILE ? undefined : {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
  },
});

const dataset = bigquery.dataset('PanouControlUnitar');
const clientiTable = dataset.table('Clienti');

// ✅ GET: Căutare client în ANAF și import opțional în BD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cui = searchParams.get('cui');
  const autoImport = searchParams.get('autoImport') === 'true';
  
  if (!cui) {
    return NextResponse.json(
      { error: 'CUI este obligatoriu' },
      { status: 400 }
    );
  }
  
  try {
    // 1. Căută în ANAF
    const anafData = await searchInANAF(cui);
    
    if (!anafData.success || !anafData.data) {
      return NextResponse.json(anafData, { status: 404 });
    }
    
    // 2. Verifică dacă clientul există deja în BD
    const existingClient = await checkExistingClient(anafData.data.cui);
    
    // 3. Auto-import dacă este cerut
    if (autoImport && !existingClient) {
      const importResult = await importClientToBD(anafData.data);
      return NextResponse.json({
        success: true,
        data: anafData.data,
        imported: true,
        clientId: importResult.clientId,
        message: 'Client găsit în ANAF și importat în baza de date'
      });
    }
    
    return NextResponse.json({
      success: true,
      data: anafData.data,
      existsInBD: !!existingClient,
      clientId: existingClient?.id || null,
      message: existingClient 
        ? 'Client găsit în ANAF și există deja în baza de date'
        : 'Client găsit în ANAF dar nu există în baza de date'
    });
    
  } catch (error) {
    console.error('Eroare căutare client ANAF:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Eroare la căutarea clientului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}` 
      },
      { status: 500 }
    );
  }
}

// ✅ POST: Import forțat client din ANAF în BD
export async function POST(request: NextRequest) {
  try {
    const { cui, updateIfExists = false } = await request.json();
    
    if (!cui) {
      return NextResponse.json(
        { error: 'CUI este obligatoriu' },
        { status: 400 }
      );
    }
    
    // 1. Căută în ANAF
    const anafData = await searchInANAF(cui);
    
    if (!anafData.success || !anafData.data) {
      return NextResponse.json(anafData, { status: 404 });
    }
    
    // 2. Verifică dacă există în BD
    const existingClient = await checkExistingClient(anafData.data.cui);
    
    if (existingClient && !updateIfExists) {
      return NextResponse.json({
        success: false,
        error: 'Clientul există deja în baza de date',
        clientId: existingClient.id,
        existingData: existingClient
      }, { status: 409 });
    }
    
    // 3. Import sau update
    if (existingClient && updateIfExists) {
      const updateResult = await updateClientInBD(existingClient.id, anafData.data);
      return NextResponse.json({
        success: true,
        updated: true,
        clientId: existingClient.id,
        message: 'Client actualizat cu datele din ANAF'
      });
    } else {
      const importResult = await importClientToBD(anafData.data);
      return NextResponse.json({
        success: true,
        imported: true,
        clientId: importResult.clientId,
        message: 'Client importat cu succes din ANAF'
      });
    }
    
  } catch (error) {
    console.error('Eroare import client ANAF:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Eroare la importul clientului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}` 
      },
      { status: 500 }
    );
  }
}

// ✅ Helper: Căutare în ANAF cu multiple URL-uri fallback
async function searchInANAF(cui: string) {
  const cleanCui = cui.replace(/[^0-9]/g, '');
  
  if (cleanCui.length < 6 || cleanCui.length > 10) {
    return {
      success: false,
      error: 'CUI invalid - trebuie să aibă între 6 și 10 cifre'
    };
  }
  
  console.log(`Căutare ANAF pentru CUI: ${cleanCui}`);
  
  // ✅ Încercăm multiple URL-uri ANAF
  const anafUrls = [
    'https://webservicesp.anaf.ro/PlatformDevelopers/rest/api/v1/ws/tva',
    'https://webservicesp.anaf.ro/PlatformDevelopers/rest/api/v1/tva', // URL alternativ
    'https://webservicesp.anaf.ro/rest/api/v1/ws/tva' // URL mai scurt
  ];
  
  for (const anafUrl of anafUrls) {
    try {
      console.log(`Încercăm URL ANAF: ${anafUrl}`);
      
      const response = await fetch(anafUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'UNITAR-PROIECT/1.0',
          'Accept': 'application/json'
        },
        body: JSON.stringify([{ cui: cleanCui }])
      });

      console.log(`ANAF Response Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        console.error(`ANAF API HTTP Error pentru ${anafUrl}: ${response.status} - ${response.statusText}`);
        continue; // Încearcă următorul URL
      }

      const data = await response.json();
      console.log('ANAF Response Data:', data);
      
      if (data.found && data.found.length > 0) {
        const info = data.found[0];
        console.log('ANAF Company Found:', info);
        
        return {
          success: true,
          data: {
            denumire: info.denumire,
            cui: `RO${info.cui}`,
            nrRegCom: info.nrRegCom || '',
            adresa: buildCompleteAddress(info),
            telefon: info.telefon || '',
            email: '', // ANAF nu furnizează email
            status: info.statusInactivi ? 'Inactiv' : 'Activ',
            platitorTva: info.scpTVA ? 'Da' : 'Nu',
            // Date detaliate pentru BD
            judet: info.judet || '',
            oras: info.localitate || '',
            codPostal: info.codPostal || '',
            strada: info.adresa || '',
            numar: info.numar || '',
            bloc: info.bloc || '',
            scara: info.scara || '',
            etaj: info.etaj || '',
            apartament: info.ap || '',
            dataInregistrare: info.dataInregistrare,
            dataActualizare: info.dataActualizare
          }
        };
      } else if (data.notfound && data.notfound.length > 0) {
        console.log('CUI not found in ANAF:', data.notfound);
        return {
          success: false,
          error: 'CUI-ul nu este înregistrat în sistemul ANAF sau nu este valid'
        };
      }
      
      // Dacă ajungem aici, încearcă următorul URL
      console.log(`Nu s-au găsit date pentru URL ${anafUrl}, încercăm următorul...`);
      
    } catch (error) {
      console.error(`Eroare pentru URL ${anafUrl}:`, error);
      continue; // Încearcă următorul URL
    }
  }
  
  // Dacă nici un URL nu a funcționat
  return {
    success: false,
    error: 'Nu s-a putut conecta la serviciul ANAF. Serviciul poate fi temporar indisponibil.'
  };
}

// ✅ Helper: Verifică client existent în BD
async function checkExistingClient(cui: string) {
  try {
    const query = `
      SELECT id, nume, cui, adresa, telefon, email, iban, activ
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
      WHERE cui = @cui
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { cui },
      types: { cui: 'STRING' }
    });
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Eroare verificare client existent:', error);
    throw error;
  }
}

// ✅ Helper: Import client în BD
async function importClientToBD(anafData: any) {
  try {
    const clientId = `CLI_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const clientData = {
      id: clientId,
      nume: anafData.denumire,
      tip_client: anafData.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
      cui: anafData.cui,
      nr_reg_com: anafData.nrRegCom,
      adresa: anafData.adresa,
      judet: anafData.judet,
      oras: anafData.oras,
      cod_postal: anafData.codPostal,
      tara: 'Romania',
      telefon: anafData.telefon,
      email: anafData.email,
      banca: '',
      iban: '',
      cnp: null,
      ci_serie: null,
      ci_numar: null,
      ci_eliberata_de: null,
      ci_eliberata_la: null,
      data_creare: new Date().toISOString(),
      data_actualizare: new Date().toISOString(),
      activ: anafData.status === 'Activ',
      observatii: `Importat automat din ANAF la ${new Date().toLocaleString('ro-RO')}`,
      id_factureaza: null,
      sincronizat_factureaza: false,
      data_ultima_sincronizare: null
    };
    
    await clientiTable.insert([clientData]);
    
    console.log(`Client importat cu ID: ${clientId}`);
    return { clientId, clientData };
    
  } catch (error) {
    console.error('Eroare import client în BD:', error);
    throw error;
  }
}

// ✅ Helper: Update client în BD
async function updateClientInBD(clientId: string, anafData: any) {
  try {
    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.PanouControlUnitar.Clienti\`
      SET 
        nume = @nume,
        cui = @cui,
        nr_reg_com = @nr_reg_com,
        adresa = @adresa,
        judet = @judet,
        oras = @oras,
        cod_postal = @cod_postal,
        telefon = @telefon,
        tip_client = @tip_client,
        activ = @activ,
        data_actualizare = @data_actualizare,
        observatii = CONCAT(IFNULL(observatii, ''), ' | Actualizat din ANAF la ', @timestamp)
      WHERE id = @id
    `;
    
    const params = {
      id: clientId,
      nume: anafData.denumire,
      cui: anafData.cui,
      nr_reg_com: anafData.nrRegCom,
      adresa: anafData.adresa,
      judet: anafData.judet,
      oras: anafData.oras,
      cod_postal: anafData.codPostal,
      telefon: anafData.telefon,
      tip_client: anafData.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
      activ: anafData.status === 'Activ',
      data_actualizare: new Date().toISOString(),
      timestamp: new Date().toLocaleString('ro-RO')
    };
    
    await bigquery.query({
      query: updateQuery,
      params,
      types: {
        id: 'STRING',
        nume: 'STRING',
        cui: 'STRING',
        nr_reg_com: 'STRING',
        adresa: 'STRING',
        judet: 'STRING',
        oras: 'STRING',
        cod_postal: 'STRING',
        telefon: 'STRING',
        tip_client: 'STRING',
        activ: 'BOOLEAN',
        data_actualizare: 'TIMESTAMP',
        timestamp: 'STRING'
      }
    });
    
    console.log(`Client actualizat cu ID: ${clientId}`);
    return { clientId };
    
  } catch (error) {
    console.error('Eroare update client în BD:', error);
    throw error;
  }
}

// ✅ Helper: Construirea adresei complete (reutilizat din API-ul existent)
function buildCompleteAddress(info: any): string {
  const addressParts: string[] = [];
  
  // Strada și numărul
  if (info.adresa) {
    addressParts.push(info.adresa);
  }
  if (info.numar) {
    addressParts.push(`nr. ${info.numar}`);
  }
  
  // Bloc, scară, etaj, apartament
  const buildingParts: string[] = [];
  if (info.bloc) buildingParts.push(`Bl. ${info.bloc}`);
  if (info.scara) buildingParts.push(`Sc. ${info.scara}`);
  if (info.etaj) buildingParts.push(`Et. ${info.etaj}`);
  if (info.ap) buildingParts.push(`Ap. ${info.ap}`);
  
  if (buildingParts.length > 0) {
    addressParts.push(buildingParts.join(', '));
  }
  
  // Localitate și județ
  const locationParts: string[] = [];
  if (info.localitate) locationParts.push(info.localitate);
  if (info.judet) locationParts.push(`jud. ${info.judet}`);
  
  if (locationParts.length > 0) {
    addressParts.push(locationParts.join(', '));
  }
  
  // Cod poștal
  if (info.codPostal) {
    addressParts.push(`CP ${info.codPostal}`);
  }
  
  return addressParts.join(', ');
}
