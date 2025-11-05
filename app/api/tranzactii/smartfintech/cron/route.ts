// ==================================================================
// CALEA: app/api/tranzactii/smartfintech/cron/route.ts
// DATA: 18.10.2025 (ora României)
// MODIFICAT: 04.11.2025 - Adăugat sync sold disponibil în metadata
// DESCRIERE: Smart Fintech Cron Job for automated transaction + balance sync
// Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00)
// Configured in vercel.json
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/tranzactii/smartfintech/cron
 * Automated trigger by Vercel Cron
 * Schedule: "0 0,6,12,18 * * *" - Every 6 hours (at 00:00, 06:00, 12:00, 18:00)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[SmartFintech Cron] Starting automated sync...');

    // Verify Vercel Cron authorization header (security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized - invalid cron secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // STEP 1: Sync transactions
    console.log('[Cron] Calling /sync endpoint...');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.unitarproiect.eu';

    const syncResponse = await fetch(`${baseUrl}/api/tranzactii/smartfintech/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zile: 7 // Last 7 days
      })
    });

    const syncData = await syncResponse.json();

    if (!syncData.success) {
      throw new Error(`Sync failed: ${syncData.error}`);
    }

    console.log(`[Cron] Sync completed: ${syncData.data.new_transactions} new transactions`);

    // STEP 2: Auto-match (if new transactions exist)
    if (syncData.data.new_transactions > 0) {
      console.log('[Cron] Calling auto-match...');

      const matchResponse = await fetch(`${baseUrl}/api/tranzactii/auto-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date_range_days: 7,
          min_confidence: 70
        })
      });

      const matchData = await matchResponse.json();

      if (matchData.success) {
        console.log(`[Cron] Auto-match completed: ${matchData.data?.total_matches || 0} matches`);
      } else {
        console.warn(`[Cron] Auto-match failed: ${matchData.error}`);
        // Don't throw error - sync succeeded, only match failed
      }
    } else {
      console.log('[Cron] No new transactions, skipping auto-match');
    }

    // STEP 3: Fetch și salvează sold disponibil în metadata
    console.log('[Cron] Fetching available balance...');
    let balanceData: any = null;

    try {
      const balanceResponse = await fetch(`${baseUrl}/api/tranzactii/smartfintech/balance?force_refresh=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      balanceData = await balanceResponse.json();

      if (balanceData?.success && balanceData?.balance) {
        console.log(`[Cron] Balance fetched: ${balanceData.balance.total} RON`);
      } else {
        console.warn('[Cron] Balance fetch failed:', balanceData?.message || balanceData?.error);
      }
    } catch (balanceError: any) {
      console.error('[Cron] Balance fetch error:', balanceError.message);
      // Nu aruncăm eroare - continuăm chiar dacă balance-ul failed
    }

    // STEP 4: Return summary
    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      sync: {
        accounts_count: syncData.data.accounts_count,
        total_transactions: syncData.data.total_transactions,
        new_transactions: syncData.data.new_transactions,
        duplicate_transactions: syncData.data.duplicate_transactions
      },
      auto_match_triggered: syncData.data.new_transactions > 0,
      balance: balanceData?.balance ? {
        total: balanceData.balance.total,
        currency: balanceData.balance.currency,
        lastSync: balanceData.balance.lastSync
      } : null
    };

    console.log(`[SmartFintech Cron] Completed in ${duration}ms`);

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('[SmartFintech Cron] Error:', error);

    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Cron job failed',
        timestamp: new Date().toISOString(),
        duration_ms: duration
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tranzactii/smartfintech/cron
 * Manual trigger for admin (with authentication check)
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add Firebase auth check for admin only
    // const userId = await getUserIdFromToken(request.headers.get('authorization'));
    // if (!isAdmin(userId)) { return 401 }

    // Trigger sync identical to GET
    return GET(request);

  } catch (error: any) {
    console.error('[Manual Cron Trigger] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
