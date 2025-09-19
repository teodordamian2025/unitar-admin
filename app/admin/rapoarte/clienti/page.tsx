// ==================================================================
// CALEA: app/admin/rapoarte/clienti/page.tsx
// DATA: 19.09.2025 22:00 (ora României)
// DESCRIERE: Management Clienți modernizat cu design glassmorphism
// FUNCȚIONALITATE: CRUD clienți cu integrare ANAF și UI modern
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, LoadingSpinner } from '@/app/components/ui';
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
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [clienti, setClienti] = useState<Client[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    setDisplayName(localStorage.getItem('displayName') || 'Utilizator');
    setUserRole(localStorage.getItem('userRole') || 'user');
    loadClienti();
  }, [user, loading, router]);

  const loadClienti = async () => {
    try {
      setLoadingData(true);
      
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
      setLoadingData(false);
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

  if (loading || loadingData) {
    return <LoadingSpinner overlay message="Se încarcă clienții..." />;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
            👥 Management Clienți
          </h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Gestionează clienții și sincronizează cu ANAF
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button
            variant="outline"
            size="sm"
            icon="🔄"
            onClick={loadClienti}
            loading={loadingData}
          >
            Reîmprospătează
          </Button>
          <Button
            variant="success"
            size="sm"
            icon="+"
            onClick={() => setShowModal(true)}
          >
            Client Nou
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <Card variant="info" size="sm" style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2rem' }}>👥</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                {clienti.length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Clienți în baza de date
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>
            <div>Sincronizare ANAF activă</div>
            <div>Validare automată CUI/CNP</div>
          </div>
        </div>
      </Card>

      {/* Clients List */}
      {clienti.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👥</div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
              Nu au fost găsiți clienți
            </h3>
            <p style={{ margin: '0 0 2rem 0', color: '#6b7280' }}>
              Adaugă primul client sau importă date din ANAF
            </p>
            <Button
              variant="success"
              size="md"
              icon="+"
              onClick={() => setShowModal(true)}
            >
              Adaugă Primul Client
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '1.5rem'
        }}>
          {clienti.map((client) => (
            <Card key={client.id}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: client.tip_client.includes('juridic') || client.tip_client.includes('Juridic') ?
                      'linear-gradient(135deg, #3b82f6, #1e40af)' :
                      'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}>
                    {getTipClientIcon(client.tip_client)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                      {client.nume}
                    </h3>
                    <div style={{
                      display: 'inline-block',
                      padding: '0.125rem 0.5rem',
                      background: client.tip_client.includes('juridic') || client.tip_client.includes('Juridic') ?
                        '#dbeafe' : '#d1fae5',
                      color: client.tip_client.includes('juridic') || client.tip_client.includes('Juridic') ?
                        '#1e40af' : '#059669',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      marginTop: '0.25rem'
                    }}>
                      {getTipClientLabel(client.tip_client)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon="✏️"
                    onClick={() => handleEditClient(client)}
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="🗑️"
                    onClick={() => handleDeleteClient(client.id, client.nume)}
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    Del
                  </Button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                padding: '1rem',
                background: 'rgba(249, 250, 251, 0.8)',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>CUI/CNP:</div>
                  <div style={{ color: '#1f2937', fontFamily: 'monospace', fontWeight: '500' }}>
                    {client.cui || client.cnp || '-'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Email:</div>
                  <div style={{ color: '#1f2937' }}>
                    {client.email || '-'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Telefon:</div>
                  <div style={{ color: '#1f2937' }}>
                    {client.telefon || '-'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Localitate:</div>
                  <div style={{ color: '#1f2937' }}>
                    {client.oras ? `${client.oras}${client.judet ? `, ${client.judet}` : ''}` : '-'}
                  </div>
                </div>
              </div>

              {client.adresa && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(243, 244, 246, 0.5)',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Adresă:</div>
                  <div style={{ color: '#1f2937' }}>{client.adresa}</div>
                </div>
              )}
            </Card>
          ))}
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
    </ModernLayout>
  );
}
