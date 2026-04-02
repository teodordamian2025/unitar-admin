// ==================================================================
// CALEA: app/api/admin/users/create-firebase/route.ts
// DATA: 21.09.2025 11:30 (ora României)
// DESCRIERE: API pentru creare utilizatori în Firebase Admin SDK
// FUNCȚIONALITATE: Creează utilizatori cu email, trimite email reset password
// ==================================================================

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { sendEmail, wrapEmailHTML } from '@/lib/notifications/send-email';

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

    const auth = admin.auth();

    // Verifică dacă utilizatorul există deja
    try {
      const existingUser = await auth.getUserByEmail(email);
      // Utilizatorul există deja - returnăm UID-ul pentru a permite inserarea în BigQuery
      console.log(`Utilizator Firebase existent găsit: ${existingUser.uid} - ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Utilizatorul există deja în Firebase, se folosește contul existent',
        data: {
          uid: existingUser.uid,
          email: existingUser.email,
          existing: true
        }
      });
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
    let resetLink = '';
    let emailSent = false;

    try {
      const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://admin.unitarproiect.eu';
      resetLink = await auth.generatePasswordResetLink(email, {
        url: `${appUrl}/login`
      });

      console.log(`Link reset password generat pentru ${email}`);

      // Trimite emailul de activare cont
      const emailHtml = wrapEmailHTML(`
        <p>Buna,</p>
        <p>Un cont nou a fost creat pentru tine in platforma <strong>UNITAR PROIECT</strong>.</p>
        <p>Pentru a-ti activa contul si a seta parola, apasa pe butonul de mai jos:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #2563eb; color: white; padding: 14px 32px;
                    text-decoration: none; border-radius: 8px; font-weight: 600;
                    font-size: 16px; display: inline-block;">
            Activeaza Contul
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Daca butonul nu functioneaza, copiaza acest link in browser:<br/>
          <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Dupa activare, te poti autentifica la: <a href="${appUrl}/login">${appUrl}/login</a>
        </p>
      `, 'Activare cont UNITAR PROIECT');

      const emailResult = await sendEmail({
        to: email,
        subject: 'Activare cont UNITAR PROIECT',
        html: emailHtml,
        text: `Un cont nou a fost creat pentru tine in platforma UNITAR PROIECT. Activeaza-ti contul accesand: ${resetLink}`,
      });

      emailSent = emailResult.success;
      if (emailResult.success) {
        console.log(`Email de activare trimis cu succes catre ${email}`);
      } else {
        console.error(`Eroare la trimiterea emailului de activare:`, emailResult.error);
      }

    } catch (linkError) {
      console.error('Eroare la generarea link-ului de reset:', linkError);
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Utilizator creat cu succes. Email de activare trimis.'
        : 'Utilizator creat, dar emailul de activare nu a putut fi trimis. Utilizatorul poate folosi "Am uitat parola" din pagina de login.',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        emailSent
      }
    });

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
    const auth = admin.auth();

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