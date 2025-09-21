// ==================================================================
// CALEA: app/api/admin/users/delete-firebase/route.ts
// DATA: 21.09.2025 11:35 (ora României)
// DESCRIERE: API pentru ștergerea utilizatorilor din Firebase Admin SDK
// FUNCȚIONALITATE: Șterge utilizatori din Firebase Auth
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();

    // Validări
    if (!uid) {
      return NextResponse.json({
        success: false,
        error: 'UID utilizator este obligatoriu'
      }, { status: 400 });
    }

    const auth = getAuth();

    // Verifică dacă utilizatorul există
    try {
      const userRecord = await auth.getUser(uid);
      console.log(`Găsit utilizator Firebase pentru ștergere: ${userRecord.email}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json({
          success: false,
          error: 'Utilizatorul nu există în Firebase'
        }, { status: 404 });
      }
      throw error;
    }

    // Șterge utilizatorul din Firebase
    await auth.deleteUser(uid);

    console.log(`Utilizator Firebase șters cu succes: ${uid}`);

    return NextResponse.json({
      success: true,
      message: 'Utilizator șters cu succes din Firebase',
      data: {
        uid: uid
      }
    });

  } catch (error: any) {
    console.error('Eroare la ștergerea utilizatorului Firebase:', error);

    // Tratează diferite tipuri de erori Firebase
    let errorMessage = 'Eroare la ștergerea utilizatorului';

    if (error.code) {
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Utilizatorul nu există în Firebase';
          break;
        case 'auth/invalid-uid':
          errorMessage = 'UID invalid furnizat';
          break;
        default:
          errorMessage = `Firebase error: ${error.message}`;
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error.message
    }, { status: 500 });
  }
}

// Endpoint pentru dezactivarea utilizatorului (alternative la ștergere)
export async function PUT(request: NextRequest) {
  try {
    const { uid, disabled } = await request.json();

    if (!uid) {
      return NextResponse.json({
        success: false,
        error: 'UID utilizator este obligatoriu'
      }, { status: 400 });
    }

    const auth = getAuth();

    // Actualizează statusul utilizatorului
    await auth.updateUser(uid, {
      disabled: disabled ?? true
    });

    console.log(`Utilizator Firebase ${disabled ? 'dezactivat' : 'activat'}: ${uid}`);

    return NextResponse.json({
      success: true,
      message: `Utilizator ${disabled ? 'dezactivat' : 'activat'} cu succes`,
      data: {
        uid: uid,
        disabled: disabled ?? true
      }
    });

  } catch (error: any) {
    console.error('Eroare la actualizarea statusului utilizatorului:', error);

    return NextResponse.json({
      success: false,
      error: 'Eroare la actualizarea statusului utilizatorului',
      details: error.message
    }, { status: 500 });
  }
}