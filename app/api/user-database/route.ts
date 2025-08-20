// app/api/user-database/route.ts

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
                            lower.includes('plată') || lower.includes('bancă') ||
                            lower.includes('tranzacție') || lower.includes('valoare');

    if (isFinancialQuery && userRole === 'normal') {
      return NextResponse.json({
        success: true,
        reply: '🚫 Nu ai acces la informații financiare. Contactează un administrator.'
      });
    }

    // Pentru utilizatori normali, prompt restricționat și scurt
    const restrictedPrompt = `Ești asistent AI pentru utilizator cu rol "${userRole}". Răspunde FOARTE SCURT.

Cererea: ${prompt}

RESTRICȚII: doar proiecte, timp lucrat, rapoarte non-financiare.
NU accesa: BancaTranzactii, FacturiEmise, FacturiPrimite.
POATE accesa: Proiecte, Subproiecte, SesiuniLucru.

Răspunde în maximum 2-3 propoziții, direct la obiect.`;

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

