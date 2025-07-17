export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <head />
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
