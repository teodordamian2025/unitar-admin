// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectNouModal.tsx
// MODIFICAT: Adăugat câmp Adresa pentru proiecte
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ClientNouModal from '../../clienti/components/ClientNouModal';

interface ProiectNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProiectAdded: () => void;
}

interface Client {
  id: string;
  nume: string;
  cui?: string;
  email?: string;
}

export default function ProiectNouModal({ isOpen, onClose, onProiectAdded }: ProiectNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [clienti, setClienti] = useState<Client[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    ID_Proiect: '',
    Denumire: '',
    Client: '',
    selectedClientId: '',
    Adresa: '', // ✅ NOUĂ: Câmp Adresa
    Descriere: '',
    Data_Start: '',
    Data_Final: '',
    Status: 'Activ',
    Valoare_Estimata: '',
    Responsabil: '',
    Observatii: '',
    // Pentru subproiecte
    subproiecte: [] as Array<{
      id: string;
      denumire: string;
      responsabil: string;
      valoare: string;
      status: string;
    }>
  });

  useEffect(() => {
    if (isOpen) {
      loadClienti();
      // Generează ID proiect automat
      setFormData(prev => ({
        ...prev,
        ID_Proiect: `P${new Date().getFullYear()}${String(Date.now()).slice(-3)}`
      }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validări
      if (!formData.ID_Proiect.trim()) {
        toast.error('ID proiect este obligatoriu');
        setLoading(false);
        return;
      }

      if (!formData.Denumire.trim()) {
        toast.error('Denumirea proiectului este obligatorie');
        setLoading(false);
        return;
      }

      if (!formData.Client.trim()) {
        toast.error('Clientul este obligatoriu');
        setLoading(false);
        return;
      }

      console.log('Trimitere date proiect:', formData); // Debug
      toast.info('Se adaugă proiectul...');

      // ✅ ACTUALIZAT: Adaugă proiectul principal cu câmpul Adresa
      const proiectData = {
        ID_Proiect: formData.ID_Proiect.trim(),
        Denumire: formData.Denumire.trim(),
        Client: formData.Client.trim(),
        Adresa: formData.Adresa.trim(), // ✅ NOUĂ: Include Adresa
        Descriere: formData.Descriere.trim(),
        Data_Start: formData.Data_Start || null,
        Data_Final: formData.Data_Final || null,
        Status: formData.Status,
        Valoare_Estimata: formData.Valoare_Estimata ? parseFloat(formData.Valoare_Estimata) : null,
        Responsabil: formData.Responsabil.trim(),
        Observatii: formData.Observatii.trim()
      };

      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proiectData)
      });

      console.log('Response status proiect:', response.status); // Debug
      const result = await response.json();
      console.log('Response data proiect:', result); // Debug

      if (result.success || response.ok) {
        // Adaugă subproiectele dacă există
        if (formData.subproiecte.length > 0) {
          await addSubproiecte(formData.ID_Proiect);
        }

        toast.success('Proiect adăugat cu succes!');
        onProiectAdded();
        onClose();
        resetForm();
      } else {
        console.error('Eroare API proiect:', result); // Debug
        toast.error(`Eroare: ${result.error || 'Eroare necunoscută'}`);
      }
    } catch (error) {
      console.error('Eroare la adăugarea proiectului:', error); // Debug
      toast.error('Eroare la adăugarea proiectului');
    } finally {
      setLoading(false);
    }
  };

  const addSubproiecte = async (proiectId: string) => {
    for (const subproiect of formData.subproiecte) {
      try {
        const subproiectData = {
          ID_Subproiect: `${proiectId}_SUB_${subproiect.id}`,
          ID_Proiect: proiectId,
          Denumire: subproiect.denumire,
          Responsabil: subproiect.responsabil,
          Status: subproiect.status,
          Valoare_Estimata: subproiect.valoare ? parseFloat(subproiect.valoare) : null
        };

        await fetch('/api/rapoarte/subproiecte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subproiectData)
        });
      } catch (error) {
        console.error(`Eroare la adăugarea subproiectului ${subproiect.denumire}:`, error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      ID_Proiect: '',
      Denumire: '',
      Client: '',
      selectedClientId: '',
      Adresa: '', // ✅ NOUĂ: Reset Adresa
      Descriere: '',
      Data_Start: '',
      Data_Final: '',
      Status: 'Activ',
      Valoare_Estimata: '',
      Responsabil: '',
      Observatii: '',
      subproiecte: []
    });
    setClientSearch('');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClientSearch = (value: string) => {
    setClientSearch(value);
    setFormData(prev => ({ ...prev, Client: value }));
    setShowClientSuggestions(value.length > 0);
  };

  const selectClient = (client: Client) => {
    setClientSearch(client.nume);
    setFormData(prev => ({ 
      ...prev, 
      Client: client.nume,
      selectedClientId: client.id 
    }));
    setShowClientSuggestions(false);
  };

  const filteredClients = clienti.filter(client =>
    client.nume.toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 5);

  const addSubproiect = () => {
    const newSubproiect = {
      id: Date.now().toString(),
      denumire: '',
      responsabil: '',
      valoare: '',
      status: 'Planificat'
    };
    setFormData(prev => ({
      ...prev,
      subproiecte: [...prev.subproiecte, newSubproiect]
    }));
  };

  const removeSubproiect = (id: string) => {
    setFormData(prev => ({
      ...prev,
      subproiecte: prev.subproiecte.filter(sub => sub.id !== id)
    }));
  };

  const updateSubproiect = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      subproiecte: prev.subproiecte.map(sub =>
        sub.id === id ? { ...sub, [field]: value } : sub
      )
    }));
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>
              📋 Adaugă Proiect Nou
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6c757d'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
            Completează informațiile pentru noul proiect și subproiectele asociate
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Grid pentru informații de bază */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {/* ID Proiect */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                ID Proiect *
              </label>
              <input
                type="text"
                value={formData.ID_Proiect}
                onChange={(e) => handleInputChange('ID_Proiect', e.target.value)}
                disabled={loading}
                placeholder="P202501"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold'
                }}
              />
            </div>

            {/* Status */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Status
              </label>
              <select
                value={formData.Status}
                onChange={(e) => handleInputChange('Status', e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Planificat">📅 Planificat</option>
                <option value="Suspendat">⏸️ Suspendat</option>
              </select>
            </div>
          </div>

          {/* Denumire proiect */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Denumire Proiect *
            </label>
            <input
              type="text"
              value={formData.Denumire}
              onChange={(e) => handleInputChange('Denumire', e.target.value)}
              disabled={loading}
              placeholder="Numele proiectului"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Client cu căutare */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Client *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  disabled={loading}
                  placeholder="Caută client sau scrie numele..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                
                {/* Suggestions dropdown */}
                {showClientSuggestions && filteredClients.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #dee2e6',
                    borderTop: 'none',
                    borderRadius: '0 0 6px 6px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {filteredClients.map(client => (
                      <div
                        key={client.id}
                        onClick={() => selectClient(client)}
                        style={{
                          padding: '0.75rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f2f6',
                          fontSize: '14px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f8f9fa';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                        }}
                      >
                        <div style={{ fontWeight: 'bold' }}>{client.nume}</div>
                        {client.cui && (
                          <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                            CUI: {client.cui}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => setShowClientModal(true)}
                disabled={loading}
                style={{
                  padding: '0.75rem 1rem',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                + Client Nou
              </button>
            </div>
          </div>

          {/* ✅ NOUĂ: Câmp Adresa */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Adresa Proiect
            </label>
            <input
              type="text"
              value={formData.Adresa}
              onChange={(e) => handleInputChange('Adresa', e.target.value)}
              disabled={loading}
              placeholder="Adresa unde se desfășoară proiectul (ex: Str. Exemplu Nr. 1, Bucuresti)"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Grid pentru date și valori */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Data Început
              </label>
              <input
                type="date"
                value={formData.Data_Start}
                onChange={(e) => handleInputChange('Data_Start', e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Data Finalizare
              </label>
              <input
                type="date"
                value={formData.Data_Final}
                onChange={(e) => handleInputChange('Data_Final', e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Valoare Estimată (RON)
              </label>
              <input
                type="number"
                value={formData.Valoare_Estimata}
                onChange={(e) => handleInputChange('Valoare_Estimata', e.target.value)}
                disabled={loading}
                placeholder="15000"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Responsabil */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Responsabil
            </label>
            <input
              type="text"
              value={formData.Responsabil}
              onChange={(e) => handleInputChange('Responsabil', e.target.value)}
              disabled={loading}
              placeholder="Numele responsabilului de proiect"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Descriere */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Descriere
            </label>
            <textarea
              value={formData.Descriere}
              onChange={(e) => handleInputChange('Descriere', e.target.value)}
              disabled={loading}
              placeholder="Descrierea detaliată a proiectului..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Subproiecte */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#2c3e50' }}>📋 Subproiecte</h4>
              <button
                type="button"
                onClick={addSubproiect}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                + Adaugă Subproiect
              </button>
            </div>

            {formData.subproiecte.map((subproiect, index) => (
              <div
                key={subproiect.id}
                style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#f8f9fa'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50' }}>
                    Subproiect #{index + 1}
                  </h5>
                  <button
                    type="button"
                    onClick={() => removeSubproiect(subproiect.id)}
                    disabled={loading}
                    style={{
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️
                  </button>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '0.5rem'
                }}>
                  <input
                    type="text"
                    value={subproiect.denumire}
                    onChange={(e) => updateSubproiect(subproiect.id, 'denumire', e.target.value)}
                    disabled={loading}
                    placeholder="Denumire subproiect"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <input
                    type="text"
                    value={subproiect.responsabil}
                    onChange={(e) => updateSubproiect(subproiect.id, 'responsabil', e.target.value)}
                    disabled={loading}
                    placeholder="Responsabil"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={subproiect.valoare}
                    onChange={(e) => updateSubproiect(subproiect.id, 'valoare', e.target.value)}
                    disabled={loading}
                    placeholder="Valoare (RON)"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <select
                    value={subproiect.status}
                    onChange={(e) => updateSubproiect(subproiect.id, 'status', e.target.value)}
                    disabled={loading}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="Planificat">📅 Planificat</option>
                    <option value="Activ">🟢 Activ</option>
                    <option value="Finalizat">✅ Finalizat</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Observații */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații
            </label>
            <textarea
              value={formData.Observatii}
              onChange={(e) => handleInputChange('Observatii', e.target.value)}
              disabled={loading}
              placeholder="Observații despre proiect..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Butoane */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Anulează
            </button>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#bdc3c7' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ Se adaugă...' : '💾 Adaugă Proiect'}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Client Nou */}
      {showClientModal && (
        <ClientNouModal
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          onClientAdded={() => {
            loadClienti(); // Reîncarcă lista de clienți
            setShowClientModal(false);
          }}
        />
      )}
    </div>
  );
}
