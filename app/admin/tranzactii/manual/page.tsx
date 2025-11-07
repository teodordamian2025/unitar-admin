// ==================================================================
// CALEA: app/admin/tranzactii/manual/page.tsx
// DATA: 20.09.2025 15:30 (ora României)
// DESCRIERE: Pagină pentru asociere manuală tranzacții cu facturi
// FUNCȚIONALITATE: UI modern glassmorphism pentru manual matching
// ==================================================================

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import RealtimeProvider from '@/app/components/realtime/RealtimeProvider';

interface TranzactieDetail {
  id: string;
  data_procesare: string;
  suma: number;
  directie: string;
  tip_categorie: string;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  status: string;
}

interface EtapaFacturaCandidat {
  id: string;
  factura_id: string;
  factura_numar: string;
  factura_suma: number;
  factura_data: string;
  client_nume: string;
  etapa_nume: string;
  status_facturare: string;
  confidence_score?: number;
}

export default function ManualMatchingPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('admin');

  // State pentru asociere manuala
  const [tranzactiiNeimperecheate, setTranzactiiNeimperecheate] = useState<TranzactieDetail[]>([]);
  const [loadingTranzactii, setLoadingTranzactii] = useState(true);
  const [selectedTranzactie, setSelectedTranzactie] = useState<TranzactieDetail | null>(null);
  const [candidatFacturi, setCandidatFacturi] = useState<EtapaFacturaCandidat[]>([]);
  const [loadingCandidati, setLoadingCandidati] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Authentication check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
  }, [user, loading, router]);

  // Load user data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.email || 'Utilizator');
      fetchUserRole();
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email })
      });
      const data = await response.json();
      if (data.success) {
        setUserRole(data.role || 'admin');
      }
    } catch (error) {
      console.error('Eroare la preluarea rolului:', error);
    }
  };

  // Load tranzacții neimperecheate
  useEffect(() => {
    loadTranzactiiNeimperecheate();
  }, []);

  const loadTranzactiiNeimperecheate = async () => {
    setLoadingTranzactii(true);
    try {
      const response = await fetch('/api/tranzactii/manual-match?status=neimperecheate');
      const result = await response.json();

      if (result.success) {
        setTranzactiiNeimperecheate(result.data || []);
      } else {
        console.error('Eroare la încărcarea tranzacțiilor:', result.error);
      }
    } catch (error) {
      console.error('Eroare la încărcarea tranzacțiilor:', error);
    } finally {
      setLoadingTranzactii(false);
    }
  };

  // Load candidați facturi pentru o tranzacție
  const loadCandidatFacturi = async (tranzactie: TranzactieDetail) => {
    setSelectedTranzactie(tranzactie);
    setLoadingCandidati(true);
    setCandidatFacturi([]);

    try {
      const response = await fetch(`/api/tranzactii/manual-match?action=candidates&tranzactie_id=${tranzactie.id}`);
      const result = await response.json();

      if (result.success) {
        setCandidatFacturi(result.data || []);
      } else {
        console.error('Eroare la încărcarea candidaților:', result.error);
      }
    } catch (error) {
      console.error('Eroare la încărcarea candidaților:', error);
    } finally {
      setLoadingCandidati(false);
    }
  };

  // Manual match între tranzacție și factură
  const executeManualMatch = async (tranzactieId: string, facturaId: string) => {
    setProcessing(true);
    try {
      const response = await fetch('/api/tranzactii/manual-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tranzactie_id: tranzactieId,
          factura_id: facturaId,
          match_type: 'manual'
        })
      });

      const result = await response.json();

      if (result.success) {
        // Refresh data după match-ul reușit
        loadTranzactiiNeimperecheate();
        setSelectedTranzactie(null);
        setCandidatFacturi([]);

        // Toast success
        showToast('Asociere manuală realizată cu succes!', 'success');
      } else {
        showToast(result.error || 'Eroare la asocierea manuală', 'error');
      }
    } catch (error) {
      console.error('Eroare la asocierea manuală:', error);
      showToast('Eroare la asocierea manuală', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Toast system
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const toastEl = document.createElement('div');
    toastEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
      padding: 16px 20px;
      border-radius: 16px;
      z-index: 70000;
      font-family: 'Inter', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      max-width: 400px;
      word-wrap: break-word;
      transform: translateY(-10px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    toastEl.textContent = message;
    document.body.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.transform = 'translateY(0)';
      toastEl.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      toastEl.style.transform = 'translateY(-10px)';
      toastEl.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(toastEl)) {
          document.body.removeChild(toastEl);
        }
      }, 300);
    }, type === 'success' || type === 'error' ? 4000 : 5000);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Se încarcă...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <RealtimeProvider>
      <ModernLayout user={user} displayName={displayName} userRole={userRole}>
        <Suspense fallback={
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '60vh',
            color: '#64748b'
          }}>
            Se încarcă datele...
          </div>
        }>
          {/* Header */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '24px',
            padding: '2rem',
            marginBottom: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
          }}>
            <h1 style={{
              margin: '0 0 0.75rem 0',
              fontSize: '2.5rem',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              ✍️ Asociere Manuala
            </h1>
            <p style={{
              margin: '0.75rem 0 0 0',
              color: '#64748b',
              fontSize: '1.1rem',
              lineHeight: '1.6'
            }}>
              Asociază manual tranzacțiile cu facturile corespunzătoare prin selectare directă
            </p>
          </div>

          {/* Main Content Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: selectedTranzactie ? '1fr 1fr' : '1fr',
            gap: '2rem'
          }}>
            {/* Tranzacții Neimperecheate */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(12px)',
              borderRadius: '24px',
              padding: '2rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{
                margin: '0 0 1.5rem 0',
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🔄 Tranzacții Neimperecheate
                <span style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  {tranzactiiNeimperecheate.length}
                </span>
              </h2>

              {loadingTranzactii ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: '#64748b'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #e2e8f0',
                    borderTop: '4px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                  }} />
                  Se încarcă tranzacțiile...
                </div>
              ) : tranzactiiNeimperecheate.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: '#64748b'
                }}>
                  🎉 Toate tranzacțiile sunt imperecheate!
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  maxHeight: '500px',
                  overflowY: 'auto'
                }}>
                  {tranzactiiNeimperecheate.map((tranzactie) => (
                    <div
                      key={tranzactie.id}
                      onClick={() => loadCandidatFacturi(tranzactie)}
                      style={{
                        padding: '1.5rem',
                        border: selectedTranzactie?.id === tranzactie.id
                          ? '2px solid #3b82f6'
                          : '1px solid #e2e8f0',
                        borderRadius: '16px',
                        background: selectedTranzactie?.id === tranzactie.id
                          ? 'rgba(59, 130, 246, 0.05)'
                          : 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        transform: selectedTranzactie?.id === tranzactie.id
                          ? 'translateY(-2px)'
                          : 'none',
                        boxShadow: selectedTranzactie?.id === tranzactie.id
                          ? '0 10px 30px rgba(59, 130, 246, 0.2)'
                          : '0 4px 12px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{
                          fontWeight: '600',
                          color: '#1e293b',
                          fontSize: '1.1rem'
                        }}>
                          {tranzactie.nume_contrapartida || 'Contrapartidă necunoscută'}
                        </div>
                        <div style={{
                          background: tranzactie.directie === 'intrare'
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          {tranzactie.suma.toLocaleString('ro-RO')} RON
                        </div>
                      </div>

                      <div style={{
                        color: '#64748b',
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem'
                      }}>
                        📅 {new Date(tranzactie.data_procesare).toLocaleDateString('ro-RO')}
                        {tranzactie.cui_contrapartida && (
                          <span style={{ marginLeft: '1rem' }}>
                            🏢 CUI: {tranzactie.cui_contrapartida}
                          </span>
                        )}
                      </div>

                      {tranzactie.detalii_tranzactie && (
                        <div style={{
                          color: '#64748b',
                          fontSize: '0.85rem',
                          fontStyle: 'italic'
                        }}>
                          {tranzactie.detalii_tranzactie.substring(0, 100)}
                          {tranzactie.detalii_tranzactie.length > 100 && '...'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Candidați Facturi */}
            {selectedTranzactie && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(12px)',
                borderRadius: '24px',
                padding: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
              }}>
                <h2 style={{
                  margin: '0 0 1.5rem 0',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📄 Facturi Candidat
                  <span style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    {candidatFacturi.length}
                  </span>
                </h2>

                {loadingCandidati ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#64748b'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #e2e8f0',
                      borderTop: '4px solid #10b981',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 1rem'
                    }} />
                    Se caută facturi candidat...
                  </div>
                ) : candidatFacturi.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#64748b'
                  }}>
                    🔍 Nu s-au găsit facturi candidat pentru această tranzacție
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    maxHeight: '500px',
                    overflowY: 'auto'
                  }}>
                    {candidatFacturi.map((factura) => (
                      <div
                        key={factura.id}
                        style={{
                          padding: '1.5rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '16px',
                          background: 'rgba(255, 255, 255, 0.5)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '1rem'
                        }}>
                          <div>
                            <div style={{
                              fontWeight: '600',
                              color: '#1e293b',
                              fontSize: '1.1rem',
                              marginBottom: '0.25rem'
                            }}>
                              {factura.factura_numar}
                            </div>
                            <div style={{
                              color: '#64748b',
                              fontSize: '0.9rem'
                            }}>
                              Client: {factura.client_nume}
                            </div>
                          </div>
                          <div style={{
                            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}>
                            {factura.factura_suma.toLocaleString('ro-RO')} RON
                          </div>
                        </div>

                        <div style={{
                          color: '#64748b',
                          fontSize: '0.85rem',
                          marginBottom: '1rem'
                        }}>
                          📅 {new Date(factura.factura_data).toLocaleDateString('ro-RO')} |
                          🏗️ {factura.etapa_nume} |
                          📊 {factura.status_facturare}
                          {factura.confidence_score && (
                            <span style={{ marginLeft: '1rem', color: '#10b981' }}>
                              🎯 Match: {Math.round(factura.confidence_score * 100)}%
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => executeManualMatch(selectedTranzactie.id, factura.factura_id)}
                          disabled={processing}
                          style={{
                            background: processing
                              ? '#94a3b8'
                              : 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: processing ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            width: '100%'
                          }}
                        >
                          {processing ? '⏳ Se procesează...' : '✅ Asociază Manual'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CSS pentru animații */}
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Suspense>
      </ModernLayout>
    </RealtimeProvider>
  );
}