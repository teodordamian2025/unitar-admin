// ==================================================================
// CALEA: app/admin/anaf/setup/page.tsx
// DESCRIERE: Pagină pentru configurarea și testarea OAuth ANAF
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';

interface TokenInfo {
  id: string;
  expires_at: string;
  expires_in_minutes: number;
  is_expired: boolean;
  scope: string;
  data_creare: string;
}

export default function ANAFSetupPage() {
  const [tokenStatus, setTokenStatus] = useState<{
    hasValidToken: boolean;
    tokenInfo?: TokenInfo;
    loading: boolean;
  }>({ hasValidToken: false, loading: true });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    checkTokenStatus();
    
    // Verifică parametrii URL pentru mesaje
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setMessage({ type: 'success', text: 'OAuth ANAF configurat cu succes!' });
    } else if (urlParams.get('error')) {
      const error = urlParams.get('error');
      const description = urlParams.get('description');
      setMessage({ 
        type: 'error', 
        text: `Eroare OAuth: ${error}${description ? ` - ${description}` : ''}` 
      });
    }
  }, []);

  const checkTokenStatus = async () => {
    try {
      const response = await fetch('/api/anaf/oauth/token');
      const data = await response.json();
      
      setTokenStatus({
        hasValidToken: data.hasValidToken,
        tokenInfo: data.tokenInfo,
        loading: false
      });
    } catch (error) {
      console.error('Error checking token status:', error);
      setTokenStatus({ hasValidToken: false, loading: false });
    }
  };

  const initiateOAuth = async () => {
    setIsConnecting(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/anaf/oauth/authorize');
      const data = await response.json();
      
      if (data.success) {
        // Redirecționează către ANAF
        window.location.href = data.authUrl;
      } else {
        setMessage({ type: 'error', text: data.error || 'Eroare la inițierea OAuth' });
        setIsConnecting(false);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Eroare de rețea' });
      setIsConnecting(false);
    }
  };

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/anaf/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Token refreshat cu succes!' });
        await checkTokenStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Eroare la refresh' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Eroare de rețea' });
    }
  };

  const revokeTokens = async () => {
    if (!confirm('Sigur vrei să revoci toate token-urile ANAF?')) return;
    
    try {
      const response = await fetch('/api/anaf/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Token-uri revocate cu succes!' });
        await checkTokenStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Eroare la revocare' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Eroare de rețea' });
    }
  };

  const testConnection = async () => {
    try {
      const response = await fetch('/api/anaf/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection' })
      });
      
      const data = await response.json();
      
      if (data.success && data.isConnected) {
        setMessage({ 
          type: 'success', 
          text: `Conexiune ANAF activă! Expiră în ${data.expiresInMinutes} minute.` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Conexiune ANAF inactivă' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Eroare de rețea' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ro-RO');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          🔐 Configurare ANAF OAuth
        </h1>
        <p className="text-gray-600 mt-2">
          Configurarea autentificării pentru e-Factura ANAF
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
          'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            📊 Status Conexiune ANAF
          </h2>
        </div>
        <div className="p-6">
          {tokenStatus.loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3">Se verifică statusul...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status Conexiune:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  tokenStatus.hasValidToken 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {tokenStatus.hasValidToken ? '🟢 Conectat' : '🔴 Deconectat'}
                </span>
              </div>

              {tokenStatus.tokenInfo && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Token ID:</span>
                    <span className="font-mono text-sm">{tokenStatus.tokenInfo.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Scope:</span>
                    <span className="text-blue-600">{tokenStatus.tokenInfo.scope}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Expiră la:</span>
                    <span className={tokenStatus.tokenInfo.is_expired ? 'text-red-600' : 'text-green-600'}>
                      {formatDate(tokenStatus.tokenInfo.expires_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Timp rămas:</span>
                    <span className={tokenStatus.tokenInfo.expires_in_minutes < 60 ? 'text-orange-600' : 'text-green-600'}>
                      {tokenStatus.tokenInfo.expires_in_minutes} minute
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Creat la:</span>
                    <span className="text-gray-500">{formatDate(tokenStatus.tokenInfo.data_creare)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            ⚙️ Acțiuni Disponibile
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Conectare OAuth */}
            <button
              onClick={initiateOAuth}
              disabled={isConnecting}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Se conectează...
                </>
              ) : (
                <>🔗 Conectare OAuth ANAF</>
              )}
            </button>

            {/* Test Conexiune */}
            <button
              onClick={testConnection}
              className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2"
            >
              🧪 Test Conexiune
            </button>

            {/* Refresh Token */}
            <button
              onClick={refreshToken}
              disabled={!tokenStatus.hasValidToken}
              className="bg-yellow-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-600 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              🔄 Refresh Token
            </button>

            {/* Revocare Tokens */}
            <button
              onClick={revokeTokens}
              className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 flex items-center justify-center gap-2"
            >
              🗑️ Revocă Tokens
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">
          ℹ️ Informații OAuth ANAF
        </h3>
        <div className="text-blue-700 space-y-2 text-sm">
          <p><strong>Client ID:</strong> {process.env.NEXT_PUBLIC_ANAF_CLIENT_ID || 'f24919ad6dfddfc43098abbb52792edd0c58d20f033c8768'}</p>
          <p><strong>Callback URL:</strong> {process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.unitarproiect.eu'}/api/anaf/oauth/callback</p>
          <p><strong>Scope:</strong> RO e-Factura</p>
          <p><strong>Environment:</strong> {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}</p>
        </div>
      </div>
    </div>
  );
}
