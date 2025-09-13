// ==================================================================
// CALEA: app/api/setari/contracte/next-number/route.ts
// DATA: 12.09.2025 21:00 (ora României)
// VERIFICAT: Import corect din funcția exportată + logging îmbunătățit
// PĂSTRATE: Toate funcționalitățile existente
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getNextContractNumber } from '../route';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipDocument = searchParams.get('tipDocument') || 'contract';
  const proiectId = searchParams.get('proiectId') || undefined;

  try {
    console.log('[NEXT-NUMBER] 🔢 Preview număr contract pentru:', { tipDocument, proiectId });

    // VERIFICAT: Folosește funcția exportată din ../route.ts pentru numerotarea consecutivă
    const contractData = await getNextContractNumber(tipDocument, proiectId);

    console.log('[NEXT-NUMBER] ✅ Număr contract generat:', {
      numar_contract: contractData.numar_contract,
      numar_secvential: contractData.numar_secvential,
      serie: contractData.serie,
      prefix: contractData.setari.prefix || '',
      format_folosit: contractData.setari.format_numerotare
    });

    return NextResponse.json({
      success: true,
      contract_preview: contractData.numar_contract,
      numar_secvential: contractData.numar_secvential,
      serie: contractData.serie,
      prefix: contractData.setari.prefix || '',
      format_numerotare: contractData.setari.format_numerotare,
      include_an: contractData.setari.include_an,
      include_luna: contractData.setari.include_luna,
      include_proiect_id: contractData.setari.include_proiect_id,
      message: `Următorul număr pentru ${tipDocument}: ${contractData.numar_contract}`,
      debug_info: {
        tip_document: tipDocument,
        proiect_id: proiectId,
        setari_id: contractData.setari.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[NEXT-NUMBER] ❌ Eroare la generarea numărului contract:', error);
    
    // Fallback cu număr temporar dacă setările nu funcționează
    const currentYear = new Date().getFullYear();
    const fallbackNumber = 'TEMP-0001-' + currentYear;
    
    return NextResponse.json({
      success: false,
      error: 'Eroare la generarea numărului de contract',
      details: error instanceof Error ? error.message : 'Eroare necunoscută',
      fallback_number: fallbackNumber,
      message: 'Folosește numărul temporar sau verifică setările contractelor',
      debug_info: {
        tip_document: tipDocument,
        proiect_id: proiectId,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}
