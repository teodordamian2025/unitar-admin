//app/admin/rapoarte/clienti/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ClientNouModal from './components/ClientNouModal';
import ClientEditModal from './components/ClientEditModal';

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
  activ?: boolean;
}

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowEditModal(true);
  };

  const handleDeleteClient = async (clientId: string, numeClient: string) => {
    const confirmDelete = confirm(
      `Ești sigur că vrei să ștergi clientul "${numeClient}"?\n\nAceastă acțiune nu poate fi anulată.`
    );
    
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/rapoarte/clienti?id=${encodeURIComponent(clientId)}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Clientul "${numeClient}" a fost șters cu succes`);
        loadClienti(); // Reîncarcă lista
      } else {
        toast.error(`Eroare la ștergerea clientului: ${result.error}`);
      }
    } catch (error) {
      console.error('Eroare la ștergerea clientului:', error);
      toast.error('Eroare la ștergerea clientului');
    }
  };

  const getTipClientIcon = (tip: string) => {
    if (tip === 'Juridic' || tip === 'Juridic_TVA' || tip === 'persoana_juridica') {
      return '🏢';
    }
    return '👤';
  };

  const getTipClientLabel = (tip: string) => {
    switch (tip) {
      case 'Juridic':
        return 'Juridic';
      case 'Juridic_TVA':
        return 'Juridic (TVA)';
      case 'persoana_juridica':
        return 'Juridic';
      case 'persoana_fizica':
      case 'Fizic':
        return 'Fizic';
      default:
        return tip;
    }
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
          Gestionează clienții și sincronizează cu ANAF
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
            Clienți activi în baza de date
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
            Adaugă primul client sau importă din ANAF
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
                fontWeight: 'bold'
              }}
            >
              + Adaugă Client
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
                  Acțiuni
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '18px' }}>
                        {getTipClientIcon(client.tip_client)}
                      </span>
                      <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
                        {getTipClientLabel(client.tip_client)}
                      </span>
                    </div>
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
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleEditClient(client)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        title="Editează client"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client.id, client.nume)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        title="Șterge client"
                      >
                        🗑️ Del
                      </button>
                    </div>
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

      {/* Modal Client Edit */}
      <ClientEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedClient(null);
        }}
        onClientUpdated={loadClienti}
        client={selectedClient}
      />
    </div>
  );
}
