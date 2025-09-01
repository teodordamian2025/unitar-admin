// ==================================================================
// CALEA: app/api/setari/contracte/next-number/route.ts
// DATA: 01.09.2025 19:30 (ora României)
// FIX PRINCIPAL: API pentru numerotare consecutivă (nu aleatorie)
// PĂSTRATE: Toate funcționalitățile existente din getNextContractNumber()
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getNextContractNumber } from '../route';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipDocument = searchParams.get('tipDocument') || 'contract';
    const proiectId = searchParams.get('proiectId') || undefined;

    console.log('🔢 Preview număr contract pentru:', { tipDocument, proiectId });

    // Folosește funcția existentă pentru numerotarea consecutivă
    const contractData = await getNextContractNumber(tipDocument, proiectId);

    console.log('✅ Număr contract generat:', contractData.numar_contract);

    return NextResponse.json({
      success: true,
      contract_preview: contractData.numar_contract,
      numar_secvential: contractData.numar_secvential,
      serie: contractData.serie,
      prefix: contractData.setari.prefix || '',
      message: `Următorul număr pentru ${tipDocument}: ${contractData.numar_contract}`
    });

  } catch (error) {
    console.error('❌ Eroare la generarea numărului contract:', error);
    return NextResponse.json({
      success: false,
      error: 'Eroare la generarea numărului de contract',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}
