'use client';

// ==================================================================
// CALEA: app/admin/setari/smartfintech/page.tsx
// DATA: 18.10.2025 (ora României)
// DESCRIERE: Pagină admin pentru configurare Smart Fintech API
// FUNCȚIONALITATE: Set credentials, test connection, manual sync, view status
// ==================================================================

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ModernLayout from '@/app/components/ModernLayout';

// ==================== TYPES ====================

interface SmartFintechConfig {
  id: string;
  client_id: string;
  client_secret_masked?: string;
  is_active: boolean;
  ultima_sincronizare?: string;
  ultima_eroare?: string;
  numar_conturi: number;
  data_creare?: string;
  data_actualizare?: string;
}

interface SyncStatus {
  is_syncing: boolean;
  last_sync_result?: any;
}

// ==================== COMPONENT ====================

export default function SmartFintechSettingsPage() {
  const [user, authLoading] = useAuthState(auth);
  const router = useRouter();

  // State
  const [config, setConfig] = useState<SmartFintechConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ is_syncing: false });

  // Form state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // ==================== LOAD CONFIG ====================

  useEffect(() => {
    if (!authLoading && user) {
      loadConfig();
    }
  }, [authLoading, user]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const idToken = await user!.getIdToken();

      const response = await fetch('/api/tranzactii/smartfintech/config', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setClientId(data.config?.client_id || '');
        // Nu setăm client_secret (e criptat în DB)
      } else if (response.status === 404) {
        // Nu există configurație → init defaults
        setClientId('ahdJHJM-87844kjkfgf-fgfghf9jnfdf');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Eroare la încărcare configurație');
    } finally {
      setLoading(false);
    }
  };

  // ==================== SAVE CONFIG ====================

  const handleSaveConfig = async () => {
    if (!clientId || !clientSecret) {
      toast.error('Client ID și Client Secret sunt obligatorii');
      return;
    }

    try {
      setSaving(true);
      const idToken = await user!.getIdToken();

      const response = await fetch('/api/tranzactii/smartfintech/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Configurație salvată cu succes');
        setClientSecret(''); // Clear secret din input
        loadConfig(); // Reload config
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(error.message || 'Eroare la salvare configurație');
    } finally {
      setSaving(false);
    }
  };

  // ==================== TEST CONNECTION ====================

  const handleTestConnection = async () => {
    if (!config?.client_id) {
      toast.error('Salvează configurația mai întâi');
      return;
    }

    try {
      toast.loading('Testare conexiune...', { id: 'test' });
      const idToken = await user!.getIdToken();

      const response = await fetch('/api/tranzactii/smartfintech/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Conexiune OK: ${data.accounts_count} conturi găsite`, { id: 'test' });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast.error(error.message || 'Eroare la testare conexiune', { id: 'test' });
    }
  };

  // ==================== MANUAL SYNC ====================

  const handleManualSync = async () => {
    try {
      setSyncStatus({ is_syncing: true });
      toast.loading('Sincronizare în curs...', { id: 'sync' });

      const idToken = await user!.getIdToken();

      const response = await fetch('/api/tranzactii/smartfintech/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zile: 7 })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Sincronizare completă: ${data.data.new_transactions} tranzacții noi`,
          { id: 'sync', duration: 5000 }
        );
        setSyncStatus({
          is_syncing: false,
          last_sync_result: data.data
        });
        loadConfig(); // Reload pentru ultima_sincronizare
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error syncing:', error);
      toast.error(error.message || 'Eroare la sincronizare', { id: 'sync' });
      setSyncStatus({ is_syncing: false });
    }
  };

  // ==================== AUTH CHECK ====================

  if (authLoading || loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          fontSize: '1.25rem',
          color: 'white',
          fontWeight: '600'
        }}>
          Se încarcă...
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  // ==================== RENDER ====================

  return (
    <ModernLayout>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1rem'
      }}>
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'white',
            marginBottom: '0.5rem'
          }}>
            ⚙️ Smart Fintech API - Configurare
          </h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '1rem'
          }}>
            Configurare acces Smart Accounts Platform pentru sincronizare automată tranzacții bancare
          </p>
        </div>

        {/* Status Card */}
        {config && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'white',
              marginBottom: '1rem'
            }}>
              📊 Status Sincronizare
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem' }}>
                  Ultima sincronizare
                </div>
                <div style={{ color: 'white', fontSize: '1rem', fontWeight: '600' }}>
                  {config.ultima_sincronizare
                    ? new Date(config.ultima_sincronizare).toLocaleString('ro-RO')
                    : 'Niciodată'}
                </div>
              </div>

              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem' }}>
                  Conturi conectate
                </div>
                <div style={{ color: 'white', fontSize: '1rem', fontWeight: '600' }}>
                  {config.numar_conturi || 0} conturi
                </div>
              </div>

              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem' }}>
                  Status
                </div>
                <div style={{
                  color: config.ultima_eroare ? '#fca5a5' : '#86efac',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  {config.ultima_eroare ? `❌ Eroare: ${config.ultima_eroare}` : '✅ OK'}
                </div>
              </div>
            </div>

            {syncStatus.last_sync_result && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px'
              }}>
                <div style={{ color: 'white', fontSize: '0.875rem' }}>
                  <strong>Ultimul sync:</strong>{' '}
                  {syncStatus.last_sync_result.new_transactions} tranzacții noi din{' '}
                  {syncStatus.last_sync_result.total_transactions} total{' '}
                  ({syncStatus.last_sync_result.duration_ms}ms)
                </div>
              </div>
            )}
          </div>
        )}

        {/* Config Form */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'white',
            marginBottom: '1.5rem'
          }}>
            🔑 Credențiale API
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Client ID */}
            <div>
              <label style={{
                display: 'block',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="ahdJHJM-87844kjkfgf-fgfghf9jnfdf"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '0.875rem',
                  color: '#1f2937'
                }}
              />
            </div>

            {/* Client Secret */}
            <div>
              <label style={{
                display: 'block',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Client Secret
                {config && (
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    (lasă gol dacă nu dorești să schimbi)
                  </span>
                )}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={config ? '••••••••••••••••' : '21355751-a31a-419f-bc0c-380b6e377e49'}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    paddingRight: '3rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    background: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '0.875rem',
                    color: '#1f2937'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.25rem'
                  }}
                >
                  {showSecret ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              style={{
                padding: '0.875rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: saving
                  ? 'rgba(156, 163, 175, 0.8)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
                transition: 'all 0.2s'
              }}
            >
              {saving ? '⏳ Se salvează...' : '💾 Salvează Configurația'}
            </button>
          </div>
        </div>

        {/* Actions */}
        {config && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'white',
              marginBottom: '1.5rem'
            }}>
              🎯 Acțiuni
            </h2>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              {/* Test Connection */}
              <button
                onClick={handleTestConnection}
                style={{
                  padding: '0.875rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
                  transition: 'all 0.2s',
                  flex: '1 1 auto'
                }}
              >
                🔌 Testează Conexiunea
              </button>

              {/* Manual Sync */}
              <button
                onClick={handleManualSync}
                disabled={syncStatus.is_syncing}
                style={{
                  padding: '0.875rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: syncStatus.is_syncing
                    ? 'rgba(156, 163, 175, 0.8)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: syncStatus.is_syncing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.39)',
                  transition: 'all 0.2s',
                  flex: '1 1 auto'
                }}
              >
                {syncStatus.is_syncing ? '⏳ Sincronizare...' : '🔄 Sincronizare Manuală'}
              </button>

              {/* View Dashboard */}
              <button
                onClick={() => router.push('/admin/tranzactii/dashboard')}
                style={{
                  padding: '0.875rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
                  transition: 'all 0.2s',
                  flex: '1 1 auto'
                }}
              >
                📊 Vezi Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Documentation */}
        <div style={{
          marginTop: '2rem',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'white',
            marginBottom: '1rem'
          }}>
            📚 Informații
          </h3>
          <div style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '0.875rem',
            lineHeight: '1.6'
          }}>
            <p style={{ marginBottom: '0.5rem' }}>
              • <strong>Sincronizare automată:</strong> La fiecare 6 ore (00:00, 06:00, 12:00, 18:00)
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              • <strong>Interval sincronizare:</strong> Ultimele 7 zile
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              • <strong>Deduplicare:</strong> Automată bazată pe hash-uri tranzacții
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              • <strong>Auto-match:</strong> Asociere automată cu facturi și cheltuieli proiecte
            </p>
            <p>
              • <strong>Documentație API:</strong> Vezi <code>/docs/sa-v2.yaml</code>
            </p>
          </div>
        </div>
      </div>
    </ModernLayout>
  );
}
