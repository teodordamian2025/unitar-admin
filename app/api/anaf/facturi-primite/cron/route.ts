// =====================================================
// CRON JOB: Sincronizare zilnică facturi ANAF
// Rulează automat zilnic la 06:00 AM
// URL: GET /api/anaf/facturi-primite/cron
// Data: 08.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute

// Vercel Cron config (rulează zilnic la 06:00 AM)
// Configurare în vercel.json:
// { "crons": [{ "path": "/api/anaf/facturi-primite/cron", "schedule": "0 6 * * *" }] }

/**
 * GET /api/anaf/facturi-primite/cron
 * Trigger automat de Vercel Cron sau manual din admin UI
 */
export async function GET(req: NextRequest) {
  try {
    console.log('⏰ [Cron] Început sincronizare automată facturi ANAF...');

    // Verificare autorizare cron (Vercel trimite header special)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    // În production, verificăm header Vercel
    if (process.env.NODE_ENV === 'production') {
      const vercelCronSecret = req.headers.get('x-vercel-cron-secret');
      if (vercelCronSecret !== cronSecret) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Apelează API sync intern (ultimele 7 zile)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const syncResponse = await fetch(`${baseUrl}/api/anaf/facturi-primite/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ zile: 7 }),
    });

    if (!syncResponse.ok) {
      const error = await syncResponse.json();
      throw new Error(`Sync failed: ${error.error}`);
    }

    const result = await syncResponse.json();

    console.log('✅ [Cron] Sincronizare completă:', result);

    // TODO: Trimite raport email admin dacă sunt facturi noi
    // if (result.success_count > 0) {
    //   await sendEmailReport(result);
    // }

    return NextResponse.json({
      success: true,
      message: 'Cron job executat cu succes',
      timestamp: new Date().toISOString(),
      result,
    });

  } catch (error: any) {
    console.error('❌ [Cron] Eroare sincronizare automată:', error);

    // TODO: Log eroare în BigQuery + notificare admin
    // await logCronError(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/anaf/facturi-primite/cron
 * Trigger manual din admin UI (fără verificare secret)
 */
export async function POST(req: NextRequest) {
  return GET(req); // Refolosim logica GET
}
