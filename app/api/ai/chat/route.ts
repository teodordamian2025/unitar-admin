// app/api/ai/chat/route.ts
// Endpoint principal pentru chatbot-ul AI cu Claude Haiku + Tool Use

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ChatSession } from '@/lib/ai/types';
import { getSystemPrompt } from '@/lib/ai/system-prompt';
import { getAnthropicTools } from '@/lib/ai/tools';
import { executeTool } from '@/lib/ai/tool-executor';

// Sesiuni in-memory (se resetează la cold start pe Vercel - acceptabil pentru MVP)
const sessions = new Map<string, ChatSession>();
const SESSION_TTL = 30 * 60 * 1000; // 30 minute

// Cleanup sesiuni expirate
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    sessions.forEach((session, key) => {
      if (now - session.lastActivity > SESSION_TTL) {
        sessions.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, userId, userRole, userName } = body;

    if (!message || !sessionId || !userId) {
      return NextResponse.json(
        { error: 'Lipsesc parametri obligatorii: message, sessionId, userId' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY nu este configurat' },
        { status: 500 }
      );
    }

    // Construiește baseUrl pentru apeluri interne
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host');
    const baseUrl = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : host
        ? `${host.includes('localhost') ? 'http' : 'https'}://${host}`
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Obține sau creează sesiunea
    const role = userRole || 'normal';
    const name = userName || 'Utilizator';
    let session = sessions.get(sessionId);

    if (!session) {
      session = {
        messages: [],
        userId,
        userRole: role,
        userName: name,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      sessions.set(sessionId, session);
    }

    session.lastActivity = Date.now();

    // Adaugă mesajul utilizatorului
    session.messages.push({
      role: 'user',
      content: message
    });

    // Limitează istoricul la ultimele 20 mesaje pentru a controla costurile
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    // Inițializează clientul Anthropic
    const anthropic = new Anthropic({ apiKey });

    // Pregătește tools-urile bazate pe rol
    const tools = getAnthropicTools(role);

    // Apelează Claude Haiku
    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: getSystemPrompt(role, name),
      tools,
      messages: session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    });

    // Tool use loop - max 5 iterații pentru a preveni bucle infinite
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (response.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
      iterations++;

      // Extrage toate tool_use blocks din răspuns
      const toolUseBlocks = response.content.filter(
        (block: any) => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) break;

      // Adaugă răspunsul asistentului cu tool_use în istoric
      session.messages.push({
        role: 'assistant',
        content: response.content
      });

      // Execută fiecare tool și colectează rezultatele
      const toolResults: any[] = [];
      for (const toolUse of toolUseBlocks) {
        const tu = toolUse as any;
        const result = await executeTool(
          tu.name,
          tu.input as Record<string, any>,
          { userId, userRole: role, userName: name, baseUrl }
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result
        });
      }

      // Adaugă rezultatele tool-urilor în istoric
      session.messages.push({
        role: 'user',
        content: toolResults
      });

      // Apelează Claude din nou cu rezultatele
      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: getSystemPrompt(role, name),
        tools,
        messages: session.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      });
    }

    // Extrage textul final din răspuns
    const textBlocks = response.content.filter(
      (block: any) => block.type === 'text'
    );
    let reply = textBlocks.map((block: any) => block.text).join('\n') || 'Nu am putut genera un răspuns.';

    // Decodează Unicode escapes (ex: \u0103 → ă) în cazul în care modelul le generează literal
    reply = reply.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

    // Adaugă răspunsul final în istoric
    session.messages.push({
      role: 'assistant',
      content: reply
    });

    return NextResponse.json({
      reply,
      sessionId
    });

  } catch (error: any) {
    console.error('Eroare AI Chat:', error);

    // Erori specifice Anthropic
    if (error?.status === 401) {
      return NextResponse.json(
        { error: 'Cheie API invalidă. Verificați ANTHROPIC_API_KEY.' },
        { status: 500 }
      );
    }
    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Prea multe cereri. Încearcă din nou în câteva secunde.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Eroare server: ${error.message || 'Necunoscută'}` },
      { status: 500 }
    );
  }
}
