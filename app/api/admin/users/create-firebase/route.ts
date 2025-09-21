// ==================================================================
// CALEA: app/api/admin/users/create-firebase/route.ts
// DATA: 21.09.2025 11:30 (ora României)
// DESCRIERE: API pentru creare utilizatori în Firebase Admin SDK
// FUNCȚIONALITATE: Creează utilizatori cu email, trimite email reset password
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
    const { email } = await request.json();

    // Validări
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email-ul este obligatoriu'
      }, { status: 400 });
    }

    // Verifică format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: 'Format email invalid'
      }, { status: 400 });
    }

    const auth = getAuth();

    // Verifică dacă utilizatorul există deja
    try {
      await auth.getUserByEmail(email);
      return NextResponse.json({
        success: false,
        error: 'Un utilizator cu acest email există deja în Firebase'
      }, { status: 409 });
    } catch (error: any) {
      // Error normal - utilizatorul nu există, putem continua
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Creează utilizatorul în Firebase
    const userRecord = await auth.createUser({
      email: email,
      emailVerified: false,
      disabled: false,
    });

    console.log(`Utilizator Firebase creat cu succes: ${userRecord.uid} - ${email}`);

    // Generează link pentru reset password (activare cont)
    try {
      const resetLink = await auth.generatePasswordResetLink(email, {
        url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login`
      });

      console.log(`Link reset password generat pentru ${email}`);

      // În producție aici ar trebui să trimitem email-ul
      // Pentru dev, îl returnăm în răspuns
      return NextResponse.json({
        success: true,
        message: 'Utilizator creat cu succes în Firebase',
        data: {
          uid: userRecord.uid,
          email: userRecord.email,
          resetLink: resetLink // Remove in production
        }
      });

    } catch (linkError) {
      console.error('Eroare la generarea link-ului de reset:', linkError);

      // Utilizatorul a fost creat, dar nu s-a putut genera link-ul
      return NextResponse.json({
        success: true,
        message: 'Utilizator creat, dar nu s-a putut genera link-ul de activare',
        data: {
          uid: userRecord.uid,
          email: userRecord.email
        },
        warning: 'Utilizatorul va trebui să folosească "Forgot Password" din pagina de login'
      });
    }

  } catch (error: any) {
    console.error('Eroare la crearea utilizatorului Firebase:', error);

    // Tratează diferite tipuri de erori Firebase
    let errorMessage = 'Eroare la crearea utilizatorului';

    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-exists':
          errorMessage = 'Un utilizator cu acest email există deja';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Format email invalid';
          break;
        case 'auth/invalid-password':
          errorMessage = 'Parola nu respectă criteriile minime';
          break;
        case 'auth/weak-password':
          errorMessage = 'Parola este prea slabă';
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

// GET method pentru testare conexiune Firebase Admin
export async function GET() {
  try {
    const auth = getAuth();

    // Test simplu - listează primii 10 utilizatori
    const listUsersResult = await auth.listUsers(10);

    return NextResponse.json({
      success: true,
      message: 'Firebase Admin SDK funcționează corect',
      data: {
        totalUsers: listUsersResult.users.length,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Firebase Admin SDK nu este configurat corect',
      details: error.message
    }, { status: 500 });
  }
}