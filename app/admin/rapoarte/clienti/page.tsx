'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ClientNouModal from './components/ClientNouModal';

interface Client {
  id: string;
  nume: string;
  tip_client: string;
  cui?: string;
  cnp?: string;
  email?: string;
  telefon?: string;
  adresa?: string;
  oras?: string;
  judet?: string;
  sincronizat_factureaza?: boolean;
  data_creare?: string;
}

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    loadClienti();
  }, []);

  const loadClienti = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/rapoarte/clienti');
      const data = await response.json();

      if (data.success) {
        setClienti(data.data || []);
      } else {
        toast.error('Eroare la încărcarea clienților');
        setClienti([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea clienților:', error);
      toast.error('Eroare de conectare');
      setClienti([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFactureaza = async () => {
    try {
      setSyncLoading(true);
      toast.info('Se sincronizează clienții din factureaza.me...');
      
      const response = await fetch('/api/actions/clients/sync-factureaza', {
        method: 'GET'
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Sincronizare completă: ${result.syncedCount} clienți adăugați`);
        if (result.errorCount > 0) {
          toast.warning(`${result.errorCount} erori în timpul sincronizării`);
        }
        loadClienti(); // Reîncarcă lista
      } else {
        toast.error(`Eroare la sincronizare: ${result.error}`);
      }
    } catch (error) {
      toast.error('Eroare la sincronizarea cu factureaza.me');
    } finally {
      setSyncLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('ro-RO');
    } catch {
      return '';
    }
  };

  const getTipClientIcon = (tip: string) => {
    return tip === 'persoana_juridica' ? '🏢' : '👤';
  };

  const getSyncIcon = (sincronizat?: boolean) => {
    return sincronizat ? '✅' : '⚠️';
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '300px',
        fontSize: '16px',
        color: '#7f8c8d'
      }}>
        ⏳ Se încarcă clienții...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '2rem',
        borderBottom: '2px solid #e9ecef',
        paddingBottom: '1rem'
      }}>
        <h1 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: '2rem',
          fontWeight: 'bold'
        }}>
          👥 Management Clienți
        </h1>
        <p style={{ 
          margin: '0.5rem 0 0 0', 
          color: '#7f8c8d',
          fontSize: '1.1rem'
        }}>
          Gestionează clienții și sincronizează cu factureaza.me
        </p>
      </div>

      {/* Header cu acțiuni */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>
            👥 Clienți găsiți: {clienti.length}
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '14px', color: '#7f8c8d' }}>
            {clienti.filter(c => c.sincronizat_factureaza).length} sincronizați cu factureaza.me
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '0.5rem 1rem',
              background: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            + Client Nou
          </button>
          
          <button
            onClick={handleSyncFactureaza}
            disabled={syncLoading}
            style={{
              padding: '0.5rem 1rem',
              background: syncLoading ? '#bdc3c7' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: syncLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {syncLoading ? '⏳ Sincronizare...' : '🔄 Sync factureaza.me'}
          </button>
          
          <button
            onClick={loadClienti}
            style={{
              padding: '0.5rem 1rem',
              background: '#f39c12',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🔄 Reîmprospătează
          </button>
        </div>
      </div>

      {/* Tabel clienți */}
      {clienti.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <p style={{ fontSize: '18px', color: '#7f8c8d', margin: 0 }}>
            👥 Nu au fost găsiți clienți
          </p>
          <p style={{ fontSize: '14px', color: '#bdc3c7', margin: '0.5rem 0' }}>
            Adaugă primul client sau sincronizează din factureaza.me
          </p>
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                marginRight: '1rem'
              }}
            >
              + Adaugă Client
            </button>
            <button
              onClick={handleSyncFactureaza}
              disabled={syncLoading}
              style={{
                padding: '0.75rem 1.5rem',
                background: syncLoading ? '#bdc3c7' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: syncLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {syncLoading ? '⏳ Sincronizare...' : 'Sincronizează din factureaza.me'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ 
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ 
                background: '#f8f9fa',
                borderBottom: '2px solid #dee2e6'
              }}>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Tip
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Nume
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  CUI/CNP
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Contact
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Localitate
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  factureaza.me
                </th>
                <th style={{ 
                  padding: '1rem 0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  Data Creare
                </th>
              </tr>
            </thead>
            <tbody>
              {clienti.map((client, index) => (
                <tr 
                  key={client.id}
                  style={{ 
                    borderBottom: '1px solid #f1f2f6',
                    background: index % 2 === 0 ? 'white' : '#fafbfc'
                  }}
                >
                  <td style={{ 
                    padding: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '18px' }}>
                      {getTipClientIcon(client.tip_client)}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    color: '#2c3e50',
                    fontWeight: 'bold'
                  }}>
                    {client.nume}
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    color: '#7f8c8d',
                    fontFamily: 'monospace'
                  }}>
                    {client.cui || client.cnp || '-'}
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    color: '#2c3e50'
                  }}>
                    <div>{client.email || '-'}</div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                      {client.telefon || '-'}
                    </div>
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    color: '#2c3e50'
                  }}>
                    <div>{client.oras || '-'}</div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                      {client.judet || '-'}
                    </div>
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <span style={{ 
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem'
                    }}>
                      {getSyncIcon(client.sincronizat_factureaza)}
                      <span style={{ 
                        fontSize: '12px',
                        color: client.sincronizat_factureaza ? '#27ae60' : '#f39c12'
                      }}>
                        {client.sincronizat_factureaza ? 'Sync' : 'Local'}
                      </span>
                    </span>
                  </td>
                  <td style={{ 
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#7f8c8d',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}>
                    {formatDate(client.data_creare)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Client Nou */}
      <ClientNouModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onClientAdded={loadClienti}
      />
    </div>
  );
}
