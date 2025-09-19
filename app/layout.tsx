// ==================================================================
// CALEA: app/layout.tsx
// DATA: 19.09.2025 22:20 (ora României)
// DESCRIERE: Root layout cu PWA support și meta tags
// FUNCȚIONALITATE: PWA manifest, viewport, theme-color, apple-touch-icon
// ==================================================================

import { Metadata } from 'next';

export interface Viewport {
  themeColor?: Array<{ media: string; color: string }> | string;
  width?: string;
  initialScale?: number;
  maximumScale?: number;
  userScalable?: boolean;
  viewportFit?: string;
}

export const metadata: Metadata = {
  title: {
    default: 'UNITAR PROIECT - ERP Management',
    template: '%s | UNITAR ERP'
  },
  description: 'Sistem ERP modern pentru management proiecte, clienți și facturare cu integrare ANAF',
  keywords: ['ERP', 'Management', 'Proiecte', 'ANAF', 'Facturare', 'Clienți', 'România'],
  authors: [{ name: 'UNITAR PROIECT' }],
  creator: 'UNITAR PROIECT',
  publisher: 'UNITAR PROIECT',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    url: '/',
    title: 'UNITAR PROIECT - ERP Management',
    description: 'Sistem ERP modern pentru management proiecte, clienți și facturare cu integrare ANAF',
    siteName: 'UNITAR ERP',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'UNITAR ERP Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNITAR PROIECT - ERP Management',
    description: 'Sistem ERP modern pentru management proiecte, clienți și facturare cu integrare ANAF',
    images: ['/icons/icon-512x512.png'],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/icons/icon-152x152.png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UNITAR ERP',
    startupImage: [
      {
        url: '/icons/icon-512x512.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <head>
        <meta name="application-name" content="UNITAR ERP" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="UNITAR ERP" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />

        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />

        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />

        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#3b82f6" />
        <link rel="shortcut icon" href="/favicon.ico" />

        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Preload critial resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
