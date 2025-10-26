import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ success: false, error: 'Token lipsă' }, { status: 400 });
  }

  // Use GOOGLE_RECAPTCHA_PROJECT_ID for reCAPTCHA (unitar-admin Firebase project)
  // Different from GOOGLE_CLOUD_PROJECT_ID which is for BigQuery (hale-mode-464009-i6)
  const projectId = process.env.GOOGLE_RECAPTCHA_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || '6LdhXH4rAAAAAKJQz4M-1dWIJ7VKpdh3SNnLuyxz';

  if (!projectId) {
    return NextResponse.json({ success: false, error: 'reCAPTCHA Project ID lipsă' }, { status: 500 });
  }

  try {
    // Initialize Google Auth with service account credentials
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    // Get access token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      return NextResponse.json({ success: false, error: 'Nu s-a putut obține access token' }, { status: 500 });
    }

    // Call reCAPTCHA Enterprise API
    const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments`;

    const assessmentResponse = await fetch(assessmentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: {
          token,
          siteKey,
          expectedAction: 'LOGIN',
        },
      }),
    });

    const assessment = await assessmentResponse.json();

    // Check if assessment was successful
    if (!assessmentResponse.ok) {
      console.error('reCAPTCHA Enterprise API error:', assessment);
      return NextResponse.json({
        success: false,
        error: assessment.error?.message || 'Eroare la verificarea reCAPTCHA'
      }, { status: 500 });
    }

    // Verify token properties
    const tokenProperties = assessment.tokenProperties;
    if (!tokenProperties?.valid) {
      return NextResponse.json({
        success: false,
        error: 'Token reCAPTCHA invalid',
        reason: tokenProperties?.invalidReason || 'Unknown'
      }, { status: 400 });
    }

    // Verify action matches
    if (tokenProperties.action !== 'LOGIN') {
      return NextResponse.json({
        success: false,
        error: 'Acțiunea reCAPTCHA nu corespunde'
      }, { status: 400 });
    }

    // Check risk score (0.0 = bot, 1.0 = human)
    const riskScore = assessment.riskAnalysis?.score ?? 0;
    const threshold = 0.5; // Adjust as needed (0.0-1.0)

    const success = riskScore >= threshold;

    return NextResponse.json({
      success,
      score: riskScore,
      reasons: assessment.riskAnalysis?.reasons || []
    });

  } catch (error: any) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Eroare la verificarea reCAPTCHA'
    }, { status: 500 });
  }
}
