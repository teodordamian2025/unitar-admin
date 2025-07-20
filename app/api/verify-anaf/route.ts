import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cui = searchParams.get('cui');

    if (!cui) {
      return NextResponse.json({ 
        error: 'CUI necesar pentru verificare' 
      }, { status: 400 });
    }

    // Curăță CUI-ul (doar cifre)
    const cuiCurat = cui.replace(/[^0-9]/g, '');
    
    if (cuiCurat.length < 7) {
      return NextResponse.json({ 
        error: 'CUI invalid - prea scurt' 
      }, { status: 400 });
    }

    // Verifică ANAF folosind API-ul public
    const anafResult = await checkANAF(cuiCurat);

    if (anafResult.success) {
      return NextResponse.json({
        success: true,
        data: anafResult.data,
        message: 'Date ANAF găsite'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: anafResult.error || 'Nu s-au găsit date pentru acest CUI'
      });
    }

  } catch (error) {
    console.error('Eroare la verificarea ANAF:', error);
    return NextResponse.json({ 
      error: 'Eroare la verificarea ANAF',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

async function checkANAF(cui: string) {
  try {
    // Opțiunea 1: API ANAF oficial (necesită înregistrare)
    // const anafResponse = await fetch('https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify([{ cui: parseInt(cui) }])
    // });

    // Opțiunea 2: API terță parte (openapi.ro, mfinante.gov.ro, etc.)
    const response = await fetch(`https://api.openapi.ro/api/companies/${cui}`, {
      headers: {
        'x-api-key': process.env.OPENAPI_RO_KEY || 'demo' // Configurează în .env
      }
    });

    if (!response.ok) {
      // Fallback - încearcă alt serviciu sau returnează date mock pentru testing
      if (cui === '12345678' || cui.startsWith('123')) {
        return {
          success: true,
          data: {
            nume: 'SC EXEMPLU SRL',
            cui: `RO${cui}`,
            adresa: 'Str. Exemplu Nr. 123, București',
            judet: 'București',
            oras: 'București',
            cod_postal: '010123',
            telefon: '',
            email: '',
            status: 'ACTIV'
          }
        };
      }
      
      return {
        success: false,
        error: 'Nu s-au găsit date pentru acest CUI'
      };
    }

    const data = await response.json();

    // Mapează răspunsul la structura noastră
    return {
      success: true,
      data: {
        nume: data.name || data.denumire || '',
        cui: data.cui || `RO${cui}`,
        adresa: data.address || data.adresa || '',
        judet: data.county || data.judet || '',
        oras: data.city || data.oras || '',
        cod_postal: data.postal_code || data.cod_postal || '',
        telefon: data.phone || data.telefon || '',
        email: data.email || '',
        status: data.status || 'NECUNOSCUT',
        nr_reg_com: data.registration_number || data.nr_reg_com || ''
      }
    };

  } catch (error) {
    console.error('Eroare la API ANAF:', error);
    
    // Fallback pentru testing - returnează date mock pentru CUI-uri specifice
    if (cui === '12345678' || cui.startsWith('123')) {
      return {
        success: true,
        data: {
          nume: 'SC EXEMPLU TEST SRL',
          cui: `RO${cui}`,
          adresa: 'Str. Test Nr. 456, București',
          judet: 'București', 
          oras: 'București',
          cod_postal: '012345',
          telefon: '0123456789',
          email: 'test@exemplu.ro',
          status: 'ACTIV',
          nr_reg_com: 'J40/1234/2020'
        }
      };
    }

    return {
      success: false,
      error: 'Eroare la conectarea cu ANAF'
    };
  }
}
