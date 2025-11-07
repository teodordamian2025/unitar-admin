// ==================================================================
// CALEA: app/admin/tranzactii/matching/page.tsx
// DATA: 20.09.2025 12:15 (ora României)
// DESCRIERE: Pagină dedicată pentru matching manual tranzacții cu facturi
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

export default function MatchingPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('admin');

  // State pentru matching
  const [tranzactiiNematchate, setTranzactiiNematchate] = useState<TranzactieDetail[]>([]);
  const [loadingTranzactii, setLoadingTranzactii] = useState(true);
  const [selectedTranzactie, setSelectedTranzactie] = useState<TranzactieDetail | null>(null);
  const [candidatiFacuri, setCandidatiFacuri] = useState<EtapaFacturaCandidat[]>([]);
  const [loadingCandidati, setLoadingCandidati] = useState(false);

  // Auth check
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(localStorage.getItem('displayName') || 'Utilizator');
  }, [user, loading, router]);

  // Încărcare tranzacții neimperecheate
  useEffect(() => {
    if (!user) return;
    loadTranzactiiNematchate();
  }, [user]);

  const loadTranzactiiNematchate = async () => {
    try {
      setLoadingTranzactii(true);
      const response = await fetch('/api/tranzactii/manual-match?status=neimperecheate&limit=500');
      const data = await response.json();

      if (data.success && data.data) {
        setTranzactiiNematchate(data.data);
      }
    } catch (error) {
      console.error('Eroare încărcare tranzacții:', error);
    } finally {
      setLoadingTranzactii(false);
    }
  };

  const loadCandidatiFacuri = async (tranzactie: TranzactieDetail) => {
    try {
      setLoadingCandidati(true);
      setCandidatiFacuri([]);

      const response = await fetch('/api/tranzactii/manual-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tranzactie_id: tranzactie.id,
          nume_contrapartida: tranzactie.nume_contrapartida,
          suma: tranzactie.suma,
          tip_search: 'advanced'
        })
      });

      const data = await response.json();
      if (data.success && data.candidati) {
        setCandidatiFacuri(data.candidati);
      }
    } catch (error) {
      console.error('Eroare încărcare candidați:', error);
    } finally {
      setLoadingCandidati(false);
    }
  };

  const handleSelectTranzactie = (tranzactie: TranzactieDetail) => {
    setSelectedTranzactie(tranzactie);
    loadCandidatiFacuri(tranzactie);
  };

  const handleMatchTranzactie = async (etapaId: string) => {
    if (!selectedTranzactie) return;

    try {
      const response = await fetch('/api/tranzactii/manual-match', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tranzactie_id: selectedTranzactie.id,
          etapa_id: etapaId,
          action: 'match'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Reîncarcă tranzacțiile
        await loadTranzactiiNematchate();
        setSelectedTranzactie(null);
        setCandidatiFacuri([]);
      }
    } catch (error) {
      console.error('Eroare matching:', error);
    }
  };

  if (loading || !user) {
    return <div>Se încarcă...</div>;
  }

  return (
    <RealtimeProvider>
      <ModernLayout user={user} displayName={displayName} userRole={userRole}>
        <div style={{
          padding: '2rem',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            padding: '2rem',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            position: 'relative',
            zIndex: 10
          }}>
            <div>
              <h1 style={{
                margin: 0,
                color: '#2c3e50',
                fontSize: '2.5rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #2c3e50 0%, #4a6741 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                🔄 Asociere Auto
              </h1>
              <p style={{
                margin: '0.75rem 0 0 0',
                color: '#7f8c8d',
                fontSize: '1.1rem',
                fontWeight: '500'
              }}>
                Asociere automată a tranzacțiilor cu facturile pe baza algoritmilor inteligenți
              </p>
            </div>

            <div style={{
              padding: '1rem 2rem',
              background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
              color: 'white',
              borderRadius: '16px',
              fontSize: '16px',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
            }}>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Tranzacții neimperecheate</div>
              <div style={{ fontSize: '18px' }}>{tranzactiiNematchate.length}</div>
            </div>
          </div>

          {/* Layout în două coloane */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            height: 'calc(100vh - 300px)'
          }}>
            {/* Coloana stângă - Tranzacții neimperecheate */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h2 style={{
                margin: '0 0 1rem 0',
                color: '#2c3e50',
                fontSize: '1.5rem',
                fontWeight: '600'
              }}>
                Tranzactii Neimperecheate
              </h2>

              <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '0.5rem'
              }}>
                {loadingTranzactii ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    Se încarcă...
                  </div>
                ) : tranzactiiNematchate.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#6c757d'
                  }}>
                    🎉 Toate tranzactiile sunt imperecheate!
                  </div>
                ) : (
                  tranzactiiNematchate.map((tranzactie) => (
                    <div
                      key={tranzactie.id}
                      onClick={() => handleSelectTranzactie(tranzactie)}
                      style={{
                        padding: '1rem',
                        marginBottom: '0.5rem',
                        background: selectedTranzactie?.id === tranzactie.id
                          ? 'rgba(52, 152, 219, 0.1)'
                          : 'rgba(248, 249, 250, 0.8)',
                        border: selectedTranzactie?.id === tranzactie.id
                          ? '2px solid #3498db'
                          : '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        fontWeight: '600',
                        color: '#2c3e50',
                        marginBottom: '0.5rem'
                      }}>
                        {tranzactie.nume_contrapartida}
                      </div>
                      <div style={{
                        color: tranzactie.directie === 'intrare' ? '#27ae60' : '#e74c3c',
                        fontWeight: '700',
                        fontSize: '1.1rem'
                      }}>
                        {tranzactie.directie === 'intrare' ? '+' : '-'}{tranzactie.suma} RON
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6c757d',
                        marginTop: '0.25rem'
                      }}>
                        {new Date(tranzactie.data_procesare).toLocaleDateString('ro-RO')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Coloana dreaptă - Candidați facturi */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h2 style={{
                margin: '0 0 1rem 0',
                color: '#2c3e50',
                fontSize: '1.5rem',
                fontWeight: '600'
              }}>
                Facturi Candidat
              </h2>

              <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '0.5rem'
              }}>
                {!selectedTranzactie ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#6c757d'
                  }}>
                    👈 Selecteaza o tranzactie pentru a vedea candidatii
                  </div>
                ) : loadingCandidati ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    Se cauta candidati...
                  </div>
                ) : candidatiFacuri.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#6c757d'
                  }}>
                    ❌ Nu s-au gasit candidati potriviti
                  </div>
                ) : (
                  candidatiFacuri.map((candidat) => (
                    <div
                      key={candidat.id}
                      style={{
                        padding: '1rem',
                        marginBottom: '0.5rem',
                        background: 'rgba(248, 249, 250, 0.8)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '12px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.5rem'
                      }}>
                        <div>
                          <div style={{
                            fontWeight: '600',
                            color: '#2c3e50'
                          }}>
                            Factura #{candidat.factura_numar}
                          </div>
                          <div style={{
                            color: '#6c757d',
                            fontSize: '0.875rem'
                          }}>
                            {candidat.client_nume}
                          </div>
                        </div>
                        {candidat.confidence_score && (
                          <div style={{
                            padding: '0.25rem 0.5rem',
                            background: candidat.confidence_score > 80
                              ? 'rgba(39, 174, 96, 0.1)'
                              : 'rgba(243, 156, 18, 0.1)',
                            color: candidat.confidence_score > 80 ? '#27ae60' : '#f39c12',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {candidat.confidence_score}%
                          </div>
                        )}
                      </div>

                      <div style={{
                        color: '#27ae60',
                        fontWeight: '700',
                        marginBottom: '0.5rem'
                      }}>
                        {candidat.factura_suma} RON
                      </div>

                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6c757d',
                        marginBottom: '1rem'
                      }}>
                        {candidat.etapa_nume} • {new Date(candidat.factura_data).toLocaleDateString('ro-RO')}
                      </div>

                      <button
                        onClick={() => handleMatchTranzactie(candidat.id)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.3)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        🔗 Match Tranzacție
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </ModernLayout>
    </RealtimeProvider>
  );
}