import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Listează toate rutele protejate
const protectedRoutes = ['/admin'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value;

  // Dacă ruta e protejată și nu avem token, redirecționează la login
  if (protectedRoutes.includes(request.nextUrl.pathname) && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
