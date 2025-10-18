// ==================================================================
// CALEA: app/api/profile/route.ts
// DATA: 18.10.2025 (ora României)
// DESCRIERE: API pentru gestionare profil personal utilizator
// FUNCȚIONALITATE: GET - citire profil, PUT - update profil
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { getUserIdFromToken } from '@/lib/firebase-admin';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hale-mode-464009-i6';
const DATASET = 'PanouControlUnitar';

// ✅ Toggle pentru tabele optimizate
const useV2Tables = process.env.BIGQUERY_USE_V2_TABLES === 'true';
const tableSuffix = useV2Tables ? '_v2' : '';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
  },
});

console.log(`🔧 [Profile API] - Mode: ${useV2Tables ? 'V2' : 'V1'}`);

// GET - Citire profil utilizator
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const query = `
      SELECT
        uid,
        email,
        nume,
        prenume,
        telefon,
        departament,
        pozitie,
        data_angajare,
        bio,
        rol
      FROM \`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\`
      WHERE uid = @userId
      LIMIT 1
    `;

    const [rows] = await bigquery.query({
      query,
      params: { userId }
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const profile = rows[0];

    return NextResponse.json({
      uid: profile.uid,
      email: profile.email,
      displayName: profile.prenume && profile.nume ?
        `${profile.prenume} ${profile.nume}` :
        (profile.nume || profile.prenume || ''),
      phone: profile.telefon || '',
      department: profile.departament || '',
      position: profile.pozitie || '',
      startDate: profile.data_angajare?.value || profile.data_angajare || '',
      bio: profile.bio || '',
      role: profile.rol
    });

  } catch (error) {
    console.error('Error loading user profile:', error);
    return NextResponse.json(
      { error: 'Failed to load user profile' },
      { status: 500 }
    );
  }
}

// PUT - Update profil utilizator
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, phone, department, position, startDate, bio } = body;

    // Validări
    if (!displayName || displayName.trim().length === 0) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    }

    // Split displayName în prenume și nume (simplu: primul cuvânt = prenume, rest = nume)
    const nameParts = displayName.trim().split(' ');
    const prenume = nameParts[0] || '';
    const nume = nameParts.slice(1).join(' ') || '';

    // Update query
    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET}.Utilizatori${tableSuffix}\`
      SET
        prenume = @prenume,
        nume = @nume,
        telefon = @telefon,
        departament = @departament,
        pozitie = @pozitie,
        data_angajare = @data_angajare,
        bio = @bio,
        updated_at = CURRENT_TIMESTAMP()
      WHERE uid = @userId
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        userId,
        prenume,
        nume,
        telefon: phone || null,
        departament: department || null,
        pozitie: position || null,
        data_angajare: startDate || null,
        bio: bio || null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
