// ==================================================================
// CALEA: app/api/anaf/company-info/route.ts
// DESCRIERE: Preluare informații companie din ANAF - REPARAT cu API v9 public
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cui = searchParams.get('cui');
  
  if (!cui) {
    return NextResponse.json(
      { error: 'CUI este obligatoriu' },
      { status: 400 }
    );
  }
  
  try {
    // Curățare CUI (eliminare RO, spații, etc.)
    const cleanCui = cui.replace(/[^0-9]/g, '');

    if (cleanCui.length === 0 || cleanCui.length > 10) {
      return NextResponse.json(
        { error: 'CUI invalid - trebuie să aibă maxim 10 cifre' },
        { status: 400 }
      );
    }
    
    console.log(`Interogare ANAF pentru CUI: ${cleanCui}`);
    
    // ✅ URL PUBLIC ANAF v9 - FĂRĂ AUTENTIFICARE
    const anafUrl = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';
    
    // ✅ FIX TYPESCRIPT: lastError poate fi string sau null
    let lastError: string | null = null;
    
    try {
      console.log(`Apelare ANAF API v9: ${anafUrl}`);
      
      const response = await fetch(anafUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'UNITAR-PROIECT/1.0',
          'Accept': 'application/json'
        },
        body: JSON.stringify([{ cui: cleanCui, data: new Date().toISOString().split('T')[0] }])
      });

      console.log(`ANAF Response Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        lastError = `ANAF API error: ${response.status} - ${response.statusText}`;
        console.error(lastError);
        
        return NextResponse.json({
          success: false,
          error: lastError
        }, { status: response.status });
      }

      const data = await response.json();
      console.log('ANAF Response v9:', JSON.stringify(data, null, 2));
      
      // ✅ PARSING ACTUALIZAT PENTRU STRUCTURA v9
      if (data.found && data.found.length > 0) {
        const info = data.found[0];
        const dateGenerale = info.date_generale || {};
        const adresaSediuSocial = info.adresa_sediu_social || {};
        const adresaDomiciliuFiscal = info.adresa_domiciliu_fiscal || {};
        const inregistrareScop = info.inregistrare_scop_Tva || {};
        const stareInactiv = info.stare_inactiv || {};
        
        return NextResponse.json({
          success: true,
          data: {
            denumire: dateGenerale.denumire || '',
            cui: dateGenerale.cui ? `RO${dateGenerale.cui}` : '',
            nrRegCom: dateGenerale.nrRegCom || '',
            adresa: buildCompleteAddressV9(adresaDomiciliuFiscal, adresaSediuSocial),
            telefon: dateGenerale.telefon || '',
            status: stareInactiv.statusInactivi ? 'Inactiv' : 'Activ',
            dataInregistrare: dateGenerale.data_inregistrare || null,
            platitorTva: inregistrareScop.scpTVA ? 'Da' : 'Nu',
            dataInceputTva: inregistrareScop.perioade_TVA?.data_inceput_ScpTVA || null,
            dataAnulareTva: inregistrareScop.perioade_TVA?.data_sfarsit_ScpTVA || null,
            dataActualizare: new Date().toISOString(),
            // Date suplimentare pentru completare automată
            judet: adresaDomiciliuFiscal.ddenumire_Judet || adresaSediuSocial.sdenumire_Judet || '',
            localitate: adresaDomiciliuFiscal.ddenumire_Localitate || adresaSediuSocial.sdenumire_Localitate || '',
            codPostal: adresaDomiciliuFiscal.dcod_Postal || adresaSediuSocial.scod_Postal || '',
            strada: adresaDomiciliuFiscal.ddenumire_Strada || adresaSediuSocial.sdenumire_Strada || '',
            numar: adresaDomiciliuFiscal.dnumar_Strada || adresaSediuSocial.snumar_Strada || '',
            detaliiAdresa: adresaDomiciliuFiscal.ddetalii_Adresa || adresaSediuSocial.sdetalii_Adresa || ''
          }
        });
      } else if (data.notFound && data.notFound.length > 0) {
        // CUI nu a fost găsit
        return NextResponse.json({
          success: false,
          error: 'CUI-ul nu este înregistrat în sistemul ANAF sau nu este valid'
        }, { status: 404 });
      } else {
        // Răspuns neașteptat
        return NextResponse.json({
          success: false,
          error: 'Răspuns neașteptat de la ANAF'
        }, { status: 502 });
      }
      
    } catch (error) {
      console.error(`Eroare pentru ANAF API:`, error);
      lastError = error instanceof Error ? error.message : 'Eroare necunoscută';
      
      return NextResponse.json({
        success: false,
        error: `Nu s-a putut conecta la serviciul ANAF: ${lastError}`
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('Eroare ANAF API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Eroare la preluarea datelor de la ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}` 
      },
      { status: 500 }
    );
  }
}

// ✅ Helper function pentru construirea adresei complete din structura v9
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
  
  // Detalii adresă (bloc, scară, etc.)
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

// ==================================================================
// POST: Verificare rapidă CUI și status TVA
// ==================================================================

export async function POST(request: NextRequest) {
  try {
    const { cui } = await request.json();
    
    if (!cui) {
      return NextResponse.json(
        { error: 'CUI este obligatoriu' },
        { status: 400 }
      );
    }
    
    const cleanCui = cui.replace(/[^0-9]/g, '');
    
    // ✅ Folosește API-ul public v9
    const anafUrl = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';
    
    try {
      const response = await fetch(anafUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'UNITAR-PROIECT/1.0'
        },
        body: JSON.stringify([{ cui: cleanCui, data: new Date().toISOString().split('T')[0] }])
      });

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: 'Nu s-a putut verifica CUI-ul la ANAF'
        }, { status: 503 });
      }

      const data = await response.json();
      
      if (data.found && data.found.length > 0) {
        const info = data.found[0];
        const dateGenerale = info.date_generale || {};
        const inregistrareScop = info.inregistrare_scop_Tva || {};
        const stareInactiv = info.stare_inactiv || {};
        const adresaDomiciliuFiscal = info.adresa_domiciliu_fiscal || {};
        const adresaSediuSocial = info.adresa_sediu_social || {};
        
        return NextResponse.json({
          success: true,
          isValid: true,
          isActive: !stareInactiv.statusInactivi,
          isVatPayer: !!inregistrareScop.scpTVA,
          data: {
            denumire: dateGenerale.denumire || '',
            cui: dateGenerale.cui ? `RO${dateGenerale.cui}` : '',
            status: stareInactiv.statusInactivi ? 'Inactiv' : 'Activ',
            platitorTva: inregistrareScop.scpTVA ? 'Da' : 'Nu',
            adresa: buildCompleteAddressV9(adresaDomiciliuFiscal, adresaSediuSocial)
          }
        });
      } else {
        return NextResponse.json({
          success: true,
          isValid: false,
          message: 'CUI-ul nu este valid sau nu este înregistrat la ANAF'
        });
      }
    } catch (error) {
      console.error('Eroare verificare TVA:', error);
      return NextResponse.json({
        success: false,
        error: 'Nu s-a putut verifica CUI-ul la ANAF'
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('Eroare verificare TVA:', error);
    return NextResponse.json(
      { success: false, error: 'Eroare la verificarea CUI-ului' },
      { status: 500 }
    );
  }
}
