// ==================================================================
// CALEA: app/api/anaf/company-info/route.ts
// DESCRIERE: Preluare informații companie din ANAF
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
    
    if (cleanCui.length < 6 || cleanCui.length > 10) {
      return NextResponse.json(
        { error: 'CUI invalid - trebuie să aibă între 6 și 10 cifre' },
        { status: 400 }
      );
    }
    
    console.log(`Interogare ANAF pentru CUI: ${cleanCui}`);
    
    const response = await fetch('https://webservicesp.anaf.ro/PlatformDevelopers/rest/api/v1/ws/tva', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UNITAR-PROIECT/1.0'
      },
      body: JSON.stringify([{ cui: cleanCui }])
    });

    if (!response.ok) {
      throw new Error(`ANAF API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('ANAF Response:', data);
    
    if (data.found && data.found.length > 0) {
      const info = data.found[0];
      
      return NextResponse.json({
        success: true,
        data: {
          denumire: info.denumire,
          cui: `RO${info.cui}`,
          nrRegCom: info.nrRegCom || '',
          adresa: buildCompleteAddress(info),
          telefon: info.telefon || '',
          status: info.statusInactivi ? 'Inactiv' : 'Activ',
          dataInregistrare: info.dataInregistrare,
          platitorTva: info.scpTVA ? 'Da' : 'Nu',
          dataInceputTva: info.dataInceputTva || null,
          dataAnulareTva: info.dataAnulareTva || null,
          dataActualizare: info.dataActualizare,
          // Date suplimentare pentru completare automată
          judet: info.judet || '',
          localitate: info.localitate || '',
          codPostal: info.codPostal || '',
          strada: info.adresa || '',
          numar: info.numar || '',
          bloc: info.bloc || '',
          scara: info.scara || '',
          etaj: info.etaj || '',
          apartament: info.ap || ''
        }
      });
    } else {
      // Verifică dacă există în lista de erori
      if (data.notfound && data.notfound.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'CUI-ul nu este înregistrat în sistemul ANAF sau nu este valid'
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Nu s-au găsit informații pentru CUI-ul specificat'
      }, { status: 404 });
    }
    
  } catch (error) {
    console.error('Eroare ANAF API:', error);
    
    // Verifică tipul de eroare
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Nu s-a putut conecta la serviciul ANAF. Verificați conexiunea la internet.' 
          },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Eroare la preluarea datelor de la ANAF: ${error instanceof Error ? error.message : 'Eroare necunoscută'}` 
      },
      { status: 500 }
    );
  }
}

// Helper function pentru construirea adresei complete
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

// ==================================================================
// CALEA: app/api/anaf/verify-vat/route.ts
// DESCRIERE: Verificare rapidă CUI și status TVA
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
    
    const response = await fetch('https://webservicesp.anaf.ro/PlatformDevelopers/rest/api/v1/ws/tva', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UNITAR-PROIECT/1.0'
      },
      body: JSON.stringify([{ cui: cleanCui }])
    });

    const data = await response.json();
    
    if (data.found && data.found.length > 0) {
      const info = data.found[0];
      
      return NextResponse.json({
        success: true,
        isValid: true,
        isActive: !info.statusInactivi,
        isVatPayer: !!info.scpTVA,
        data: {
          denumire: info.denumire,
          cui: `RO${info.cui}`,
          status: info.statusInactivi ? 'Inactiv' : 'Activ',
          platitorTva: info.scpTVA ? 'Da' : 'Nu',
          adresa: buildCompleteAddress(info)
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
    return NextResponse.json(
      { success: false, error: 'Eroare la verificarea CUI-ului' },
      { status: 500 }
    );
  }
}
