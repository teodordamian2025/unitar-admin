// ==================================================================
// CALEA: app/api/anaf/search-clients/route.ts
// DESCRIERE: Căutare și import clienți din ANAF - REPARAT cu API v9 public
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate cu partitioning + clustering
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

// ✅ Tabele cu suffix dinamic
const TABLE_CLIENTI = `\`${PROJECT_ID}.${DATASET}.Clienti${tableSuffix}\``;

console.log(`🔧 ANAF Search Clients API - Tables Mode: ${useV2Tables ? 'V2 (Optimized with Partitioning)' : 'V1 (Standard)'}`);
console.log(`📊 Using table: Clienti${tableSuffix}`);

// Configurare BigQuery
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

const dataset = bigquery.dataset(DATASET);
const clientiTable = dataset.table(`Clienti${tableSuffix}`);

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

// ✅ Helper: Căutare în ANAF cu API v9 public - REPARAT COMPLET
async function searchInANAF(cui: string) {
  const cleanCui = cui.replace(/[^0-9]/g, '');
  
  if (cleanCui.length < 6 || cleanCui.length > 10) {
    return {
      success: false,
      error: 'CUI invalid - trebuie să aibă între 6 și 10 cifre'
    };
  }
  
  console.log(`Căutare ANAF pentru CUI: ${cleanCui}`);
  
  // ✅ URL PUBLIC ANAF v9 - FĂRĂ AUTENTIFICARE
  const anafUrl = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';
  
  try {
    console.log(`Apelare ANAF API v9: ${anafUrl}`);
    
    const response = await fetch(anafUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UNITAR-PROIECT/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify([{ 
        cui: cleanCui, 
        data: new Date().toISOString().split('T')[0] 
      }])
    });

    console.log(`ANAF Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`ANAF API HTTP Error: ${response.status} - ${response.statusText}`);
      return {
        success: false,
        error: `Serviciul ANAF nu este disponibil: ${response.status} - ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log('ANAF Response Data v9:', JSON.stringify(data, null, 2));
    
    // ✅ PARSING ACTUALIZAT PENTRU STRUCTURA v9
    if (data.found && data.found.length > 0) {
      const info = data.found[0];
      const dateGenerale = info.date_generale || {};
      const adresaSediuSocial = info.adresa_sediu_social || {};
      const adresaDomiciliuFiscal = info.adresa_domiciliu_fiscal || {};
      const inregistrareScop = info.inregistrare_scop_Tva || {};
      const stareInactiv = info.stare_inactiv || {};
      
      console.log('ANAF Company Found v9:', {
        denumire: dateGenerale.denumire,
        cui: dateGenerale.cui,
        status: stareInactiv.statusInactivi ? 'Inactiv' : 'Activ'
      });
      
      return {
        success: true,
        data: {
          denumire: dateGenerale.denumire || '',
          cui: dateGenerale.cui ? `RO${dateGenerale.cui}` : '',
          nrRegCom: dateGenerale.nrRegCom || '',
          adresa: buildCompleteAddressV9(adresaDomiciliuFiscal, adresaSediuSocial),
          telefon: dateGenerale.telefon || '',
          email: '', // ANAF nu furnizează email
          status: stareInactiv.statusInactivi ? 'Inactiv' : 'Activ',
          platitorTva: inregistrareScop.scpTVA ? 'Da' : 'Nu',
          // Date detaliate pentru BD
          judet: adresaDomiciliuFiscal.ddenumire_Judet || adresaSediuSocial.sdenumire_Judet || '',
          oras: adresaDomiciliuFiscal.ddenumire_Localitate || adresaSediuSocial.sdenumire_Localitate || '',
          codPostal: adresaDomiciliuFiscal.dcod_Postal || adresaSediuSocial.scod_Postal || '',
          strada: adresaDomiciliuFiscal.ddenumire_Strada || adresaSediuSocial.sdenumire_Strada || '',
          numar: adresaDomiciliuFiscal.dnumar_Strada || adresaSediuSocial.snumar_Strada || '',
          detaliiAdresa: adresaDomiciliuFiscal.ddetalii_Adresa || adresaSediuSocial.sdetalii_Adresa || '',
          dataInregistrare: dateGenerale.data_inregistrare || null,
          dataActualizare: new Date().toISOString()
        }
      };
    } else if (data.notFound && data.notFound.length > 0) {
      console.log('CUI not found in ANAF v9:', data.notFound);
      return {
        success: false,
        error: 'CUI-ul nu este înregistrat în sistemul ANAF sau nu este valid'
      };
    } else {
      console.log('Răspuns neașteptat de la ANAF v9:', data);
      return {
        success: false,
        error: 'Răspuns neașteptat de la serviciul ANAF'
      };
    }
    
  } catch (error) {
    console.error(`Eroare pentru ANAF API v9:`, error);
    return {
      success: false,
      error: `Nu s-a putut conecta la serviciul ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`
    };
  }
}

// ✅ Helper: Verifică client existent în BD
async function checkExistingClient(cui: string) {
  try {
    const query = `
      SELECT id, nume, cui, adresa, telefon, email, iban, activ
      FROM ${TABLE_CLIENTI}
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

    // Helper: Convertește empty strings în null pentru BigQuery
    const toNullIfEmpty = (value: any) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      return typeof value === 'string' ? value.trim() : value;
    };

    const clientData = {
      id: clientId,
      nume: anafData.denumire,
      tip_client: anafData.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
      cui: anafData.cui,
      nr_reg_com: toNullIfEmpty(anafData.nrRegCom),
      adresa: toNullIfEmpty(anafData.adresa),
      judet: toNullIfEmpty(anafData.judet),
      oras: toNullIfEmpty(anafData.oras),
      cod_postal: toNullIfEmpty(anafData.codPostal),
      tara: 'Romania',
      telefon: toNullIfEmpty(anafData.telefon),
      email: toNullIfEmpty(anafData.email),
      banca: null,
      iban: null,
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
      UPDATE ${TABLE_CLIENTI}
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

// ✅ Helper: Construirea adresei complete din structura v9 (reutilizat și optimizat)
function buildCompleteAddressV9(domiciliuFiscal: any, sediuSocial: any): string {
  const addressParts: string[] = [];
  
  // Prioritate: domiciliu fiscal, apoi sediu social
  const adresa = domiciliuFiscal || sediuSocial || {};
  
  // Strada și numărul
  const strada = adresa.ddenumire_Strada || adresa.sdenumire_Strada || '';
  const numar = adresa.dnumar_Strada || adresa.snumar_Strada || '';
  
  if (strada) {
    addressParts.push(strada);
  }
  if (numar) {
    addressParts.push(`nr. ${numar}`);
  }
  
  // Detalii adresă (bloc, scară, etaj, apartament)
  const detalii = adresa.ddetalii_Adresa || adresa.sdetalii_Adresa || '';
  if (detalii) {
    addressParts.push(detalii);
  }
  
  // Localitate și județ
  const localitate = adresa.ddenumire_Localitate || adresa.sdenumire_Localitate || '';
  const judet = adresa.ddenumire_Judet || adresa.sdenumire_Judet || '';
  
  const locationParts: string[] = [];
  if (localitate) locationParts.push(localitate);
  if (judet) locationParts.push(`jud. ${judet}`);
  
  if (locationParts.length > 0) {
    addressParts.push(locationParts.join(', '));
  }
  
  // Cod poștal
  const codPostal = adresa.dcod_Postal || adresa.scod_Postal || '';
  if (codPostal) {
    addressParts.push(`CP ${codPostal}`);
  }
  
  return addressParts.join(', ');
}
