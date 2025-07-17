import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ success: false, error: 'Token lipsă' }, { status: 400 });
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json({ success: false, error: 'Cheia secretă lipsă' }, { status: 500 });
  }

  const verifyURL = 'https://www.google.com/recaptcha/api/siteverify';

  const response = await fetch(verifyURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${secretKey}&response=${token}`,
  });

  const data = await response.json();

  const success = data.success && data.score >= 0.5;

  return NextResponse.json({ success });
}
