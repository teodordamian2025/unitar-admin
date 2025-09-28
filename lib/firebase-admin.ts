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
    // Pentru development - folosim variabilele de mediu existente
    // În producție, ar trebui să folosim service account key-ul proper
    const serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
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
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await verifyFirebaseToken(token);

  return decodedToken?.uid || null;
}

export { admin };