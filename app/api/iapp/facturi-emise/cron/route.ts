// =====================================================
// API: Cron Job Facturi EMISE iapp.ro
// Trigger automat pentru sincronizare zilnică
// URL: GET /api/iapp/facturi-emise/cron
// Data: 29.10.2025
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minut pentru cron

/**
 * GET /api/iapp/facturi-emise/cron
 *
 * Endpoint pentru Vercel Cron sau GitHub Actions
 * Rulează sincronizare automată ultimele 7 zile
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('⏰ [iapp.ro Emise Cron] ========== START CRON JOB ==========');
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   User-Agent: ${req.headers.get('user-agent')}`);

    // Verifică dacă e trigger legitim (opțional - securitate basic)
    const userAgent = req.headers.get('user-agent') || '';
    const isGitHubActions = userAgent.includes('curl') || userAgent.includes('GitHub');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (!isGitHubActions && !isVercelCron) {
      console.warn('⚠️ [iapp.ro Emise Cron] Suspicious request (not from GitHub Actions or Vercel Cron)');
      // Continuăm oricum, dar loggăm warning
    }

    // Trigger sincronizare prin API intern
    const syncUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.unitarproiect.eu'}/api/iapp/facturi-emise/sync`;

    console.log(`🔄 [iapp.ro Emise Cron] Triggering sync: ${syncUrl}`);

    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ zile: 7 }) // Ultimele 7 zile
    });

    const syncData = await syncResponse.json();

    if (!syncResponse.ok || !syncData.success) {
      console.error('❌ [iapp.ro Emise Cron] Sync failed:', syncData);

      return NextResponse.json({
        success: false,
        error: 'Sync API failed',
        details: syncData,
        cronDuration: Date.now() - startTime
      }, { status: 500 });
    }

    const cronDuration = Date.now() - startTime;

    console.log(`✅ [iapp.ro Emise Cron] ========== CRON JOB COMPLETED (${cronDuration}ms) ==========`);
    console.log(`📊 [iapp.ro Emise Cron] Stats:`, syncData.stats);

    return NextResponse.json({
      success: true,
      message: 'Cron job completed successfully',
      sync_result: syncData,
      cronDuration
    });

  } catch (error) {
    console.error('❌ [iapp.ro Emise Cron] CRON ERROR:', error);

    return NextResponse.json({
      success: false,
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      cronDuration: Date.now() - startTime
    }, { status: 500 });
  }
}
