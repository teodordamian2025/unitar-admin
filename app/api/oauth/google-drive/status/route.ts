// =====================================================
// GOOGLE DRIVE OAUTH TOKEN STATUS API
// Endpoint pentru verificare status token OAuth
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const DATASET = 'PanouControlUnitar';

/**
 * GET /api/oauth/google-drive/status
 * Returnează status OAuth token pentru Google Drive
 */
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 [Google Drive OAuth] Verificare status token...');

    // Fetch token info din BigQuery
    const query = `
      SELECT
        user_email,
        expires_at,
        activ,
        data_creare,
        TIMESTAMP_DIFF(expires_at, CURRENT_TIMESTAMP(), HOUR) as ore_ramase
      FROM \`${PROJECT_ID}.${DATASET}.GoogleDriveTokens\`
      WHERE user_email = 'unitarproiect@gmail.com'
        AND activ = TRUE
      ORDER BY data_creare DESC
      LIMIT 1
    `;

    const [rows] = await bigquery.query({ query, location: 'EU' });

    if (rows.length === 0) {
      console.warn('⚠️ [Google Drive OAuth] Token nu există în BigQuery');
      return NextResponse.json({
        success: false,
        status: 'missing',
        message: 'Token OAuth nu a fost configurat. Te rog să autorizezi Google Drive.',
        authorize_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive`
      });
    }

    const token = rows[0];
    const oreRamase = token.ore_ramase;

    // Determină status pe baza orelor rămase
    let status: 'valid' | 'expiring_soon' | 'expired';
    let message: string;

    if (oreRamase < 0) {
      status = 'expired';
      message = '❌ Token-ul a expirat. Este necesară reautorizarea.';
    } else if (oreRamase < 24) {
      status = 'expiring_soon';
      message = `⚠️ Token-ul va expira în ${Math.floor(oreRamase)} ore. Recomandăm reautorizarea.`;
    } else {
      status = 'valid';
      message = `✅ Token-ul este valid încă ${Math.floor(oreRamase / 24)} zile.`;
    }

    console.log(`✅ [Google Drive OAuth] Status: ${status}, ore rămase: ${oreRamase}`);

    return NextResponse.json({
      success: true,
      status,
      message,
      token_info: {
        expires_at: token.expires_at?.value || token.expires_at,
        ore_ramase: Math.floor(oreRamase),
        zile_ramase: Math.floor(oreRamase / 24),
        data_creare: token.data_creare?.value || token.data_creare
      },
      authorize_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive`
    });

  } catch (error: any) {
    console.error('❌ [Google Drive OAuth] Eroare verificare status:', error);

    return NextResponse.json({
      success: false,
      status: 'error',
      message: 'Eroare la verificarea statusului token-ului',
      error: error.message,
      authorize_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/oauth/google-drive`
    }, { status: 500 });
  }
}
