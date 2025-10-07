// ==================================================================
// CALEA: app/projects/components/UserProiectNouModal.tsx
// DATA: 07.10.2025 (actualizat)
// DESCRIERE: Modal creare proiect pentru utilizatori normali cu restricții financiare
// MODIFICAT: Adăugat căutare client + responsabili multipli (pattern admin)
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import ClientNouModal from '@/app/admin/rapoarte/clienti/components/ClientNouModal';
import ResponsabilSearch from '@/app/admin/rapoarte/proiecte/components/ResponsabilSearch';

interface UserProiectNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProiectCreated: () => void;
}

interface Client {
  id: string;
  nume: string;
  cui?: string;
  email?: string;
}

interface Responsabil {
  uid: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  email: string;
  rol: string;
}

interface ResponsabilSelectat {
  uid: string;
  nume_complet: string;
  email: string;
  rol_in_proiect: string;
}

interface FormData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  selectedClientId: string;
  Adresa: string;
  Descriere: string;
  Data_Start: string;
  Data_Final: string;
  Status: string;
  status_predare: string;
  status_contract: string;
  Observatii: string;
}

export default function UserProiectNouModal({ isOpen, onClose, onProiectCreated }: UserProiectNouModalProps) {
  const [formData, setFormData] = useState<FormData>({
    ID_Proiect: '',
    Denumire: '',
    Client: '',
    selectedClientId: '',
    Adresa: '',
    Descriere: '',
    Data_Start: '',
    Data_Final: '',
    Status: 'Activ',
    status_predare: 'Nepredat',
    status_contract: 'Nu e cazul',
    Observatii: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // State pentru clienți
  const [clienti, setClienti] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  // State pentru responsabili multipli
  const [responsabiliSelectati, setResponsabiliSelectati] = useState<ResponsabilSelectat[]>([]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadClienti();
      // Reset form când se deschide modal
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        ID_Proiect: '',
        Denumire: '',
        Client: '',
        selectedClientId: '',
        Adresa: '',
        Descriere: '',
        Data_Start: today,
        Data_Final: '',
        Status: 'Activ',
        status_predare: 'Nepredat',
        status_contract: 'Nu e cazul',
        Observatii: ''
      });

      setClientSearch('');
      setResponsabiliSelectati([]);

      // Generare ID proiect automat
      generateProjectId();
    }
  }, [isOpen]);

  const loadClienti = async () => {
    try {
      const response = await fetch('/api/rapoarte/clienti');
      const data = await response.json();
      if (data.success) {
        setClienti(data.data || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea clienților:', error);
    }
  };

  const generateProjectId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const time = now.getTime().toString().slice(-4);

    const projectId = `PRJ-${year}${month}${day}-${time}`;
    setFormData(prev => ({ ...prev, ID_Proiect: projectId }));
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handler pentru căutare client
  const handleClientSearch = (value: string) => {
    setClientSearch(value);
    setFormData(prev => ({ ...prev, Client: value, selectedClientId: '' }));
    setShowClientSuggestions(value.length > 0);
  };

  // Handler pentru selectare client din listă
  const selectClient = (client: Client) => {
    setClientSearch(client.nume);
    setFormData(prev => ({
      ...prev,
      Client: client.nume,
      selectedClientId: client.id
    }));
    setShowClientSuggestions(false);
  };

  // Filtrare clienți pentru sugestii
  const filteredClients = clienti.filter(client =>
    client.nume.toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 5);

  // Handler pentru adăugare client nou
  const handleClientAdded = async () => {
    setShowClientModal(false);
    await loadClienti(); // Reîncarcă lista de clienți
    toast.success('Client adăugat cu succes! Selectați-l din listă.');
  };

  // Handler pentru selectarea responsabilului
  const handleResponsabilSelect = (responsabil: Responsabil | null) => {
    if (responsabil) {
      const existaResponsabil = responsabiliSelectati.find(r => r.uid === responsabil.uid);
      if (existaResponsabil) {
        toast.error('Responsabilul este deja adăugat');
        return;
      }

      const nouResponsabil: ResponsabilSelectat = {
        uid: responsabil.uid,
        nume_complet: responsabil.nume_complet,
        email: responsabil.email,
        rol_in_proiect: responsabiliSelectati.length === 0 ? 'Principal' : 'Normal'
      };

      setResponsabiliSelectati(prev => [...prev, nouResponsabil]);
      toast.success(`Responsabil ${responsabil.nume_complet} adăugat`);
    }
  };

  // Funcții pentru managementul responsabililor
  const removeResponsabil = (uid: string) => {
    setResponsabiliSelectati(prev => prev.filter(r => r.uid !== uid));
  };

  const updateRolResponsabil = (uid: string, nouRol: string) => {
    setResponsabiliSelectati(prev =>
      prev.map(r => r.uid === uid ? { ...r, rol_in_proiect: nouRol } : r)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Validări de bază
    if (!formData.ID_Proiect.trim()) {
      toast.error('ID Proiect este obligatoriu!');
      return;
    }
    if (!formData.Denumire.trim()) {
      toast.error('Denumirea proiectului este obligatorie!');
      return;
    }
    if (!formData.Client.trim()) {
      toast.error('Clientul este obligatoriu!');
      return;
    }

    try {
      setIsSubmitting(true);

      // Responsabil principal pentru compatibilitate cu tabela Proiecte
      const responsabilPrincipal = responsabiliSelectati.find(r => r.rol_in_proiect === 'Principal')
        || responsabiliSelectati[0];

      const payload = {
        ...formData,
        Responsabil: responsabilPrincipal ? responsabilPrincipal.nume_complet : null,
        // Adăugăm responsabili multipli pentru a fi salvați în ProiecteResponsabili
        responsabili_multipli: responsabiliSelectati.length > 0 ? responsabiliSelectati : null
      };

      console.log('📤 Submitting user project:', payload);

      const response = await fetch('/api/user/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Eroare la crearea proiectului');
      }

      console.log('✅ User project created successfully');
      toast.success('Proiect creat cu succes!');
      onProiectCreated();

    } catch (error) {
      console.error('❌ Error creating user project:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la crearea proiectului!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      onClick={handleBackdropClick}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '2rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(229, 231, 235, 0.3)'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📋 Proiect Nou
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              margin: 0
            }}>
              Creează un proiect nou (fără informații financiare)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '0.5rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Info note pentru utilizatori normali */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '2rem',
          fontSize: '0.875rem',
          color: '#065f46',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>💰</span>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              Restricții pentru utilizatori normali
            </div>
            <div>
              Câmpurile financiare (valoare, monedă, facturare, achitare) sunt gestionate automat de sistem.
              Proiectul va fi creat cu valoare 0 RON și status-uri financiare "Nu se aplică".
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* ID Proiect */}
            <div>
              <label style={labelStyle}>
                🆔 ID Proiect *
              </label>
              <input
                type="text"
                value={formData.ID_Proiect}
                onChange={(e) => handleInputChange('ID_Proiect', e.target.value)}
                style={inputStyle}
                placeholder="PRJ-20251007-1234"
                required
              />
            </div>

            {/* Denumire */}
            <div>
              <label style={labelStyle}>
                📝 Denumire Proiect *
              </label>
              <input
                type="text"
                value={formData.Denumire}
                onChange={(e) => handleInputChange('Denumire', e.target.value)}
                style={inputStyle}
                placeholder="Numele proiectului..."
                required
              />
            </div>
          </div>

          {/* Client cu căutare și adăugare */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>
              🏢 Client *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  placeholder="Caută client sau scrie numele..."
                  style={{
                    ...inputStyle,
                    borderColor: formData.selectedClientId ? '#27ae60' : 'rgba(209, 213, 219, 0.5)'
                  }}
                  required
                />

                {/* Dropdown cu sugestii */}
                {showClientSuggestions && filteredClients.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid rgba(209, 213, 219, 0.5)',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginTop: '2px'
                  }}>
                    {filteredClients.map(client => (
                      <div
                        key={client.id}
                        onClick={() => selectClient(client)}
                        style={{
                          padding: '0.75rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f2f6',
                          fontSize: '0.875rem',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f8f9fa';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                        }}
                      >
                        <div style={{ fontWeight: '600', color: '#2c3e50' }}>{client.nume}</div>
                        {client.cui && (
                          <div style={{ fontSize: '0.75rem', color: '#7f8c8d', marginTop: '0.25rem' }}>
                            CUI: {client.cui}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Indicator client selectat */}
                {formData.selectedClientId && (
                  <div style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#27ae60',
                    fontSize: '1rem'
                  }}>
                    ✅
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowClientModal(true)}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(39, 174, 96, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(39, 174, 96, 0.3)';
                }}
              >
                + Client Nou
              </button>
            </div>
          </div>

          {/* Responsabili Multipli */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>
              👥 Responsabili Proiect
            </label>
            <ResponsabilSearch
              onResponsabilSelected={handleResponsabilSelect}
              showInModal={true}
              placeholder="Caută și adaugă responsabili..."
            />

            {/* Lista responsabili selectați */}
            {responsabiliSelectati.length > 0 && (
              <div style={{
                marginTop: '1rem',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#1e40af',
                  marginBottom: '0.75rem'
                }}>
                  👥 Responsabili selectați ({responsabiliSelectati.length})
                </div>
                {responsabiliSelectati.map(resp => (
                  <div
                    key={resp.uid}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: 'white',
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                      border: '1px solid rgba(209, 213, 219, 0.3)'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#2c3e50' }}>
                        {resp.nume_complet}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#7f8c8d', marginTop: '0.25rem' }}>
                        📧 {resp.email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <select
                        value={resp.rol_in_proiect}
                        onChange={(e) => updateRolResponsabil(resp.uid, e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          border: '1px solid rgba(209, 213, 219, 0.5)',
                          borderRadius: '4px',
                          background: 'white'
                        }}
                      >
                        <option value="Principal">👑 Principal</option>
                        <option value="Normal">👤 Normal</option>
                        <option value="Supervizor">👔 Supervizor</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeResponsabil(resp.uid)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#e74c3c',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0.25rem'
                        }}
                        title="Șterge responsabil"
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Adresa */}
            <div>
              <label style={labelStyle}>
                📍 Adresa
              </label>
              <input
                type="text"
                value={formData.Adresa}
                onChange={(e) => handleInputChange('Adresa', e.target.value)}
                style={inputStyle}
                placeholder="Adresa proiectului..."
              />
            </div>

            {/* Data Start */}
            <div>
              <label style={labelStyle}>
                📅 Data Început
              </label>
              <input
                type="date"
                value={formData.Data_Start}
                onChange={(e) => handleInputChange('Data_Start', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Data Final */}
            <div>
              <label style={labelStyle}>
                🏁 Data Final
              </label>
              <input
                type="date"
                value={formData.Data_Final}
                onChange={(e) => handleInputChange('Data_Final', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>
                📊 Status Proiect
              </label>
              <select
                value={formData.Status}
                onChange={(e) => handleInputChange('Status', e.target.value)}
                style={inputStyle}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Suspendat">⏸️ Suspendat</option>
                <option value="Finalizat">✅ Finalizat</option>
                <option value="Anulat">❌ Anulat</option>
              </select>
            </div>

            {/* Status Predare */}
            <div>
              <label style={labelStyle}>
                📦 Status Predare
              </label>
              <select
                value={formData.status_predare}
                onChange={(e) => handleInputChange('status_predare', e.target.value)}
                style={inputStyle}
              >
                <option value="Nepredat">⏳ Nepredat</option>
                <option value="Predat">📦 Predat</option>
              </select>
            </div>
          </div>

          {/* Descriere - full width */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>
              📄 Descriere Proiect
            </label>
            <textarea
              value={formData.Descriere}
              onChange={(e) => handleInputChange('Descriere', e.target.value)}
              style={{
                ...inputStyle,
                minHeight: '100px',
                resize: 'vertical'
              }}
              placeholder="Descrierea detaliată a proiectului..."
            />
          </div>

          {/* Observatii - full width */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={labelStyle}>
              📝 Observații
            </label>
            <textarea
              value={formData.Observatii}
              onChange={(e) => handleInputChange('Observatii', e.target.value)}
              style={{
                ...inputStyle,
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder="Observații suplimentare..."
            />
          </div>

          {/* Sectiune financiara blocked */}
          <div style={{
            background: 'rgba(229, 231, 235, 0.3)',
            border: '2px dashed rgba(156, 163, 175, 0.5)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              🔒 BLOCAT
            </div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
            <div style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '0.5rem'
            }}>
              Secțiune Financiară
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#9ca3af'
            }}>
              Valorile financiare sunt gestionate automat:<br/>
              • Valoare: 0 RON<br/>
              • Status facturare: "Nu se aplică"<br/>
              • Status achitare: "Nu se aplică"
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(229, 231, 235, 0.3)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'rgba(107, 114, 128, 0.1)',
                color: '#374151',
                border: '1px solid rgba(107, 114, 128, 0.2)',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: isSubmitting
                  ? 'rgba(107, 114, 128, 0.3)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Se creează...
                </>
              ) : (
                <>
                  <span>💾</span>
                  Creează Proiect
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Client Nou */}
      {showClientModal && (
        <ClientNouModal
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          onClientAdded={handleClientAdded}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Stiluri constante
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '0.5rem'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid rgba(209, 213, 219, 0.5)',
  borderRadius: '8px',
  fontSize: '0.875rem',
  background: 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(4px)',
  transition: 'all 0.2s ease'
};
