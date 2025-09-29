// ==================================================================
// CALEA: app/api/planificator/timer/stop/route.ts
// DATA: 29.09.2025 18:00 (ora României)
// DESCRIERE: API pentru oprirea timer-ului din planificator
// FUNCȚIONALITATE: Wrapper pentru API-ul live-timer existent cu autentificare
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Verifică autentificarea Firebase
    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    // Obține sesiunea activă pentru utilizatorul curent
    const liveTimerResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/analytics/live-timer?user_id=${userId}`, {
      headers: {
        'Authorization': authHeader
      }
    });

    if (!liveTimerResponse.ok) {
      return NextResponse.json({ error: 'Failed to get active sessions' }, { status: 500 });
    }

    const liveTimerData = await liveTimerResponse.json();

    if (!liveTimerData.success || !liveTimerData.data || liveTimerData.data.length === 0) {
      return NextResponse.json({ error: 'No active timer session found' }, { status: 404 });
    }

    // Găsește sesiunea activă pentru utilizatorul curent
    const activeSession = liveTimerData.data.find((session: any) =>
      session.utilizator_uid === userId &&
      (session.status === 'activ' || session.status === 'pausat')
    );

    if (!activeSession) {
      return NextResponse.json({ error: 'No active timer session found for user' }, { status: 404 });
    }

    // Oprește timer-ul folosind API-ul live-timer existent
    const stopResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/analytics/live-timer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        action: 'stop',
        session_id: activeSession.id
      })
    });

    const stopResult = await stopResponse.json();

    if (stopResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Timer stopped successfully from planificator',
        session_id: activeSession.id,
        worked_hours: stopResult.worked_hours || 0,
        project_context: stopResult.project_context || null
      });
    } else {
      return NextResponse.json({
        error: stopResult.error || 'Failed to stop timer'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error stopping timer from planificator:', error);
    return NextResponse.json(
      { error: 'Failed to stop timer from planificator' },
      { status: 500 }
    );
  }
}