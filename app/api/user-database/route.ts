import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, sessionId, userRole, userPermissions } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt necesar' }, { status: 400 });
    }

    // Verifică permisiunile
    const lower = prompt.toLowerCase();
    const isFinancialQuery = lower.includes('factură') || lower.includes('suma') || 
                            lower.includes('buget') || lower.includes('cost') ||
                            lower.includes('plată') || lower.includes('bancă');

    if (isFinancialQuery && userRole === 'normal') {
      return NextResponse.json({
        success: true,
        reply: '🚫 Nu ai permisiunea să accesezi informații financiare. Contactează un administrator pentru detalii.'
      });
    }

    // Pentru utilizatori normali, limitează la proiecte și timp
    const restrictedPrompt = `${prompt}

RESTRICȚII IMPORTANTE:
- Acest utilizator are rol "${userRole}"
- NU poate accesa informații financiare (sume, bugete, facturi, tranzacții)
- Poate accesa doar: proiecte, timp lucrat, rapoarte de proiecte
- Poate modifica doar: proiecte și timp lucrat
- NU poate accesa tabelele: BancaTranzactii, FacturiEmise, FacturiPrimite
- Poate accesa: Proiecte, Subproiecte, SesiuniLucru

Te rog să respecti aceste restricții.`;

    // Folosește endpoint-ul ai-database cu restricții
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai-database`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: restrictedPrompt, 
        sessionId,
        context: `user_role_${userRole}`
      }),
    });

    const data = await res.json();
    
    return NextResponse.json({
      success: true,
      reply: data.reply || 'Fără răspuns.'
    });

  } catch (error) {
    console.error('Eroare user-database:', error);
    return NextResponse.json({ 
      error: 'Eroare la procesarea cererii',
      details: error instanceof Error ? error.message : 'Eroare necunoscută'
    }, { status: 500 });
  }
}

