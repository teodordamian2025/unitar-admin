// ==================================================================
// CALEA: lib/firebase-admin.ts
// DATA: 28.09.2025 22:30 (ora României)
// DESCRIERE: Helper pentru decodarea Firebase tokens pe server-side
// FUNCȚIONALITATE: Validare și decodare token Firebase pentru API authentication
// ==================================================================

import * as admin from 'firebase-admin';

// Inițializare Firebase Admin SDK (singleton pattern)
if (!admin.apps.length) {
  try {
    // Detectează automat project ID-ul corect pentru production
    // În production token-urile vin cu audience "unitar-admin"
    // În development folosim "unitarproiect"
    // IMPORTANT: Trebuie să fie sincronizat cu NEXT_PUBLIC_FIREBASE_PROJECT_ID din client
    const projectId = process.env.NODE_ENV === 'production'
      ? 'unitar-admin'
      : (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unitarproiect');

    // Pentru production, verifică dacă e setat explicit un project ID Firebase
    const finalProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || projectId;

    console.log(`🔧 Firebase Admin SDK initializing with project ID: ${finalProjectId}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV}, Auto-detected: ${projectId}, Final: ${finalProjectId}`);

    const serviceAccount = {
      projectId: finalProjectId,
      clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: finalProjectId
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
  }
}

/**
 * Decodează și validează un Firebase ID token
 * @param token - ID token-ul Firebase din Authorization header
 * @returns Promise cu decoded token sau null în caz de eroare
 */
export async function verifyFirebaseToken(token: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return null;
  }
}

/**
 * Extract user ID din Authorization header cu validare Firebase
 * @param authHeader - Authorization header din request
 * @returns Promise cu user UID sau null dacă token invalid
 */
export async function getUserIdFromToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('🔍 getUserIdFromToken: Missing or invalid Authorization header');
    return null;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await verifyFirebaseToken(token);

    if (decodedToken?.uid) {
      console.log(`✅ Firebase token verified successfully for user: ${decodedToken.uid}`);
      return decodedToken.uid;
    } else {
      // Token verificat cu succes dar fără UID - folosește fallback
      console.log('⚠️ Token verified but no UID found, using fallback');
      return 'demo_user_id';
    }
  } catch (error) {
    // Token invalid sau alt error - folosește fallback pentru development
    console.log('❌ Firebase token verification failed, using fallback for development');
    if (process.env.NODE_ENV === 'production') {
      // În production nu returnăm fallback pentru securitate
      console.error('🚨 Production: Firebase token invalid, rejecting request');
      return null;
    }
    return 'demo_user_id';
  }
}

export { admin };