'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const EMAIL_ACCOUNTS = [
  { email: 'office@unitarproiect.eu', label: 'Office', description: 'Cont principal de business' },
  { email: 'contact@unitarproiect.eu', label: 'Contact', description: 'Cont pentru comunicare clienți' },
];

export default function EmailConnectPage() {
  const searchParams = useSearchParams();
  const successEmail = searchParams?.get('success') || null;
  const errorMsg = searchParams?.get('error') || null;

  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatuses();
  }, []);

  async function checkStatuses() {
    setLoading(true);
    const results: Record<string, boolean> = {};
    for (const account of EMAIL_ACCOUNTS) {
      try {
        const res = await fetch(`/api/ai/email?email_account=${account.email}&limit=1`);
        const data = await res.json();
        results[account.email] = data.success === true;
      } catch {
        results[account.email] = false;
      }
    }
    setStatuses(results);
    setLoading(false);
  }

  function handleConnect(email: string) {
    window.location.href = `/api/auth/gmail?email=${encodeURIComponent(email)}`;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Conectare Email Gmail</h1>
      <p className="text-gray-400 mb-6">
        Conectează conturile de email pentru ca asistentul AI să poată citi și răspunde la emailuri.
      </p>

      {successEmail && (
        <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
          Contul <strong>{successEmail}</strong> a fost conectat cu succes!
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          Eroare: {errorMsg}
        </div>
      )}

      <div className="space-y-4">
        {EMAIL_ACCOUNTS.map(account => {
          const isConnected = statuses[account.email];
          return (
            <div
              key={account.email}
              className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg">{account.label}</span>
                    {loading ? (
                      <span className="text-xs text-gray-500">verificare...</span>
                    ) : isConnected ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        Conectat
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        Neconectat
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{account.email}</p>
                  <p className="text-xs text-gray-500 mt-1">{account.description}</p>
                </div>
                <button
                  onClick={() => handleConnect(account.email)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isConnected
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isConnected ? 'Reconectează' : 'Conectează'}
                </button>
              </div>

              {isConnected && (
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                  AI-ul poate citi inbox-ul și răspunde la emailuri (cu confirmare).
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10">
        <h3 className="font-medium mb-2">Cum funcționează?</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>1. Click pe &quot;Conectează&quot; pentru fiecare cont</li>
          <li>2. Te va redirecționa la Google pentru autorizare</li>
          <li>3. Selectează contul de email și apasă &quot;Allow&quot;</li>
          <li>4. Revii automat aici cu status &quot;Conectat&quot;</li>
          <li>5. Asistentul AI poate acum citi și răspunde la emailuri (cu confirmare)</li>
        </ul>
      </div>
    </div>
  );
}
