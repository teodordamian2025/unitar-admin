// ==================================================================
// CALEA: app/projects/[id]/page.tsx
// DATA: 23.09.2025 18:15 (ora României)
// DESCRIERE: Pagină detalii proiect pentru utilizatori normali - identică cu admin dar fără date financiare
// FUNCȚIONALITATE: Detalii complete proiect cu contracte, facturi și sarcini - FĂRĂ informații financiare
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/app/firebase-config';
import UserLayout from '@/app/components/user/UserLayout';
import { LoadingSpinner } from '@/app/components/ui';
import UserSarciniProiectModal from '../components/UserSarciniProiectModal';

interface ProiectDetails {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Data_Start: any;
  Data_Final: any;
  Descriere?: string;
  Prioritate?: string;
  Tip_Proiect?: string;
  Status_Predare?: string;
  Responsabil_Principal?: string;
  Responsabil_Secundar?: string;
  Client_CUI?: string;
  Client_Adresa?: string;
  Client_Telefon?: string;
  Client_Email?: string;
  // Removed all financial fields for user view
}

interface ContractInfo {
  ID_Contract: string;
  Data_Semnare?: any;
  Status_Contract: string;
  Observatii?: string;
  // Removed financial fields
}

interface FacturaInfo {
  ID_Factura: string;
  Numar_Factura: string;
  Data_Emitere: any;
  Status_Plata: string;
  Subproiect_Asociat?: string;
  // Removed financial fields
}

export default function UserProiectDetailsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [user, loading] = useAuthState(auth);

  const [proiect, setProiect] = useState<ProiectDetails | null>(null);
  const [contracte, setContracte] = useState<ContractInfo[]>([]);
  const [facturi, setFacturi] = useState<FacturaInfo[]>([]);
  const [subproiecte, setSubproiecte] = useState<ProiectDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSarciniModal, setShowSarciniModal] = useState(false);
  const [selectedProiectForSarcini, setSelectedProiectForSarcini] = useState<ProiectDetails | null>(null);

  // Firebase Auth Loading
  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50000
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  const displayName = user.displayName || user.email || 'Utilizator';
  const userRole = 'normal';

  useEffect(() => {
    if (projectId && user) {
      loadProiectDetails();
    }
  }, [projectId, user]);

  const loadProiectDetails = async () => {
    setLoadingData(true);
    setError(null);

    try {
      // Load project details from user API (without financial data)
      const response = await fetch(`/api/user/projects/${projectId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eroare la încărcarea detaliilor proiectului');
      }

      setProiect(data.proiect);
      setSubproiecte(data.subproiecte || []);
      setContracte(data.contracte || []);
      setFacturi(data.facturi || []);
    } catch (error) {
      console.error('Eroare la încărcarea detaliilor:', error);
      setError(error instanceof Error ? error.message : 'Eroare neașteptată');
    } finally {
      setLoadingData(false);
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';

    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue.toString();

    try {
      return new Date(dateStr).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activ': return '#27ae60';
      case 'Finalizat': return '#2ecc71';
      case 'În așteptare': return '#f39c12';
      case 'Suspendat': return '#e74c3c';
      case 'Anulat': return '#95a5a6';
      default: return '#3498db';
    }
  };

  const getPriorityColor = (prioritate: string) => {
    switch (prioritate) {
      case 'Critică': return '#e74c3c';
      case 'Înaltă': return '#f39c12';
      case 'Medie': return '#3498db';
      case 'Scăzută': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const handleOpenSarcini = (proiectData: ProiectDetails) => {
    setSelectedProiectForSarcini(proiectData);
    setShowSarciniModal(true);
  };

  if (loadingData) {
    return (
      <UserLayout user={user} displayName={displayName} userRole={userRole}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px'
        }}>
          <LoadingSpinner />
        </div>
      </UserLayout>
    );
  }

  if (error || !proiect) {
    return (
      <UserLayout user={user} displayName={displayName} userRole={userRole}>
        <div style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#e74c3c'
        }}>
          <h2>Eroare</h2>
          <p>{error || 'Proiectul nu a fost găsit'}</p>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout user={user} displayName={displayName} userRole={userRole}>
      <div style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '2rem', fontWeight: '700' }}>
                {proiect.Denumire}
              </h1>
              <p style={{ margin: '0.5rem 0 0 0', color: '#7f8c8d', fontSize: '1.1rem' }}>
                ID: {proiect.ID_Proiect} • Client: {proiect.Client}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{
                padding: '0.5rem 1rem',
                background: getStatusColor(proiect.Status),
                color: 'white',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {proiect.Status}
              </span>
              {proiect.Prioritate && (
                <span style={{
                  padding: '0.5rem 1rem',
                  background: getPriorityColor(proiect.Prioritate),
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  {proiect.Prioritate}
                </span>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            marginTop: '2rem'
          }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#3498db' }}>📅 Data Start</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                {formatDate(proiect.Data_Start)}
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#e74c3c' }}>🏁 Data Final</h4>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                {formatDate(proiect.Data_Final)}
              </p>
            </div>
            {proiect.Responsabil_Principal && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#27ae60' }}>👤 Responsabil Principal</h4>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  {proiect.Responsabil_Principal}
                </p>
              </div>
            )}
            {proiect.Status_Predare && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#f39c12' }}>📦 Status Predare</h4>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  {proiect.Status_Predare}
                </p>
              </div>
            )}
          </div>

          {proiect.Descriere && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>📝 Descriere</h4>
              <p style={{
                margin: 0,
                padding: '1rem',
                background: 'rgba(52, 152, 219, 0.1)',
                borderRadius: '8px',
                lineHeight: '1.6'
              }}>
                {proiect.Descriere}
              </p>
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => handleOpenSarcini(proiect)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            📋 Sarcini și Progres
          </button>
        </div>

        {/* Info Panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Contract Info */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📄 Informații Contract
            </h3>

            {contracte.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#7f8c8d',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '0.5rem' }}>📋</div>
                <p style={{ margin: 0 }}>Nu există contracte</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {contracte.map(contract => (
                  <div key={contract.ID_Contract} style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>Contract {contract.ID_Contract}</strong>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: contract.Status_Contract === 'Semnat' ? '#27ae60' : '#f39c12',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {contract.Status_Contract}
                      </span>
                    </div>
                    {contract.Data_Semnare && (
                      <p style={{ margin: '0.5rem 0', color: '#7f8c8d', fontSize: '14px' }}>
                        Semnat: {formatDate(contract.Data_Semnare)}
                      </p>
                    )}
                    {contract.Observatii && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', fontStyle: 'italic' }}>
                        {contract.Observatii}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facturi Info */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💰 Informații Facturi
            </h3>

            {facturi.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#7f8c8d',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '0.5rem' }}>🧾</div>
                <p style={{ margin: 0 }}>Nu există facturi</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {facturi.map(factura => (
                  <div key={factura.ID_Factura} style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>Factura {factura.Numar_Factura}</strong>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: factura.Status_Plata === 'Plătită' ? '#27ae60' :
                                   factura.Status_Plata === 'Parțial plătită' ? '#f39c12' : '#e74c3c',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {factura.Status_Plata}
                      </span>
                    </div>
                    <p style={{ margin: '0.5rem 0', color: '#7f8c8d', fontSize: '14px' }}>
                      Emisă: {formatDate(factura.Data_Emitere)}
                    </p>
                    {factura.Subproiect_Asociat && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', color: '#3498db' }}>
                        Subproiect: {factura.Subproiect_Asociat}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Subproiecte */}
        {subproiecte.length > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔗 Subproiecte ({subproiecte.length})
            </h3>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {subproiecte.map(subproiect => (
                <div key={subproiect.ID_Proiect} style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: 'white',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '1rem',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#2c3e50' }}>{subproiect.Denumire}</strong>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: getStatusColor(subproiect.Status),
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {subproiect.Status}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
                      ID: {subproiect.ID_Proiect} •
                      {formatDate(subproiect.Data_Start)} → {formatDate(subproiect.Data_Final)}
                    </p>
                  </div>

                  {subproiect.Status === 'Activ' && (
                    <button
                      onClick={() => handleOpenSarcini(subproiect)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      📋 Sarcini
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sarcini Modal */}
      {showSarciniModal && selectedProiectForSarcini && (
        <UserSarciniProiectModal
          isOpen={showSarciniModal}
          onClose={() => {
            setShowSarciniModal(false);
            setSelectedProiectForSarcini(null);
          }}
          proiect={selectedProiectForSarcini}
        />
      )}
    </UserLayout>
  );
}