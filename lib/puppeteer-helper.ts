// ==================================================================
// CALEA: lib/puppeteer-helper.ts
// DESCRIERE: Helper pentru lansare Puppeteer compatibil Vercel + local dev
// PATTERN: Folosește puppeteer-core + @sparticuz/chromium pe serverless,
//          puppeteer (full) local
// ==================================================================

import type { Browser } from 'puppeteer-core';

const isServerless =
  !!process.env.VERCEL ||
  !!process.env.VERCEL_ENV ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteerCore = await import('puppeteer-core');

    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Browser;
  }

  // Local development: use full puppeteer with bundled Chrome
  const puppeteer = await import('puppeteer');
  return puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }) as unknown as Browser;
}
