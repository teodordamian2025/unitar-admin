// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectEditModal.tsx
// MODIFICAT: Modal de editare identic cu ProiectNouModal + Buton Șterge
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

interface ProiectEditModalProps {
  isOpen: boolean;
  proiect: {
    ID_Proiect: string;
    Denumire: string;
    Client: string;
    Status: string;
    Data_Start?: string;
    Data_Final?: string;
    Valoare_Estimata?: number;
    Responsabil?: string;
    Adresa?: string;
    Observatii?: string;
    Descriere?: string;
  };
  onClose: () => void;
  onProiectUpdated: () => void;
  onProiectDeleted: () => void;
}

interface Client {
  id: string;
  nume: string;
  cui?: string;
  email?: string;
}

// ✅ Toast system cu Z-index compatibil cu modalele
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
    z-index: 60000;
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
  }, type === 'success' || type === 'error' ? 4000 : 6000);
};

export default function ProiectEditModal({ 
  isOpen, 
  proiect, 
  onClose, 
  onProiectUpdated, 
  onProiectDeleted 
}: ProiectEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [clienti, setClienti] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  const [formData, setFormData] = useState({
    ID_Proiect: '',
    Denumire: '',
    Client: '',
    selectedClientId: '',
    Adresa: '',
    Descriere: '',
    Data_Start: '',
    Data_Final: '',
    Status: 'Activ',
    Valoare_Estimata: '',
    Responsabil: '',
    Observatii: ''
  });

  // ✅ Helper pentru safe parsing a datelor
  const safeDateParse = (date?: string | { value: string }): string => {
    if (!date) return '';
    if (typeof date === 'string') {
      return date.includes('T') ? date.split('T')[0] : date;
    }
    if (typeof date === 'object' && date.value) {
      return date.value.includes('T') ? date.value.split('T')[0] : date.value;
    }
    return '';
  };

  useEffect(() => {
    if (isOpen && proiect) {
      loadClienti();
      // Pre-populează formularul cu datele existente
      setFormData({
        ID_Proiect: proiect.ID_Proiect || '',
        Denumire: proiect.Denumire || '',
        Client: proiect.Client || '',
        selectedClientId: '',
        Adresa: proiect.Adresa || '',
        Descriere: proiect.Descriere || '',
        Data_Start: safeDateParse(proiect.Data_Start), // ✅ Safe parsing
        Data_Final: safeDateParse(proiect.Data_Final), // ✅ Safe parsing
        Status: proiect.Status || 'Activ',
        Valoare_Estimata: proiect.Valoare_Estimata ? proiect.Valoare_Estimata.toString() : '',
        Responsabil: proiect.Responsabil || '',
        Observatii: proiect.Observatii || ''
      });
      setClientSearch(proiect.Client || '');
    }
  }, [isOpen, proiect]);

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
      if (!formData.Denumire.trim()) {
        showToast('Denumirea proiectului este obligatorie', 'error');
        setLoading(false);
        return;
      }

      if (!formData.Client.trim()) {
        showToast('Clientul este obligatoriu', 'error');
        setLoading(false);
        return;
      }

      showToast('Se actualizează proiectul...', 'info');

      const proiectData = {
        id: proiect.ID_Proiect,
        Denumire: formData.Denumire.trim(),
        Client: formData.Client.trim(),
        Adresa: formData.Adresa.trim(),
        Descriere: formData.Descriere.trim(),
        Data_Start: formData.Data_Start || null,
        Data_Final: formData.Data_Final || null,
        Status: formData.Status,
        Valoare_Estimata: formData.Valoare_Estimata ? parseFloat(formData.Valoare_Estimata) : null,
        Responsabil: formData.Responsabil.trim(),
        Observatii: formData.Observatii.trim()
      };

      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proiectData)
      });

      const result = await response.json();

      if (result.success || response.ok) {
        showToast('Proiect actualizat cu succes!', 'success');
        onProiectUpdated();
        onClose();
      } else {
        showToast(`Eroare: ${result.error || 'Eroare necunoscută'}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la actualizarea proiectului:', error);
      showToast('Eroare la actualizarea proiectului', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = confirm(`Sigur vrei să ștergi proiectul "${proiect.Denumire}"?\n\nAceastă acțiune nu poate fi anulată!`);
    if (!confirmed) return;

    setLoading(true);

    try {
      showToast('Se șterge proiectul...', 'info');

      const response = await fetch(`/api/rapoarte/proiecte?id=${encodeURIComponent(proiect.ID_Proiect)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showToast('Proiect șters cu succes!', 'success');
        onProiectDeleted();
        onClose();
      } else {
        showToast(`Eroare: ${result.error || 'Eroare la ștergerea proiectului'}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la ștergerea proiectului:', error);
      showToast('Eroare la ștergerea proiectului', 'error');
    } finally {
      setLoading(false);
    }
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

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 50000,
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
          background: '#f0f8ff',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>
              ✏️ Editează Proiect
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
            Proiect: <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#3498db' }}>{proiect.ID_Proiect}</span>
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
            {/* ID Proiect (readonly) */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                ID Proiect
              </label>
              <input
                type="text"
                value={formData.ID_Proiect}
                disabled={true}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  background: '#f8f9fa',
                  color: '#6c757d'
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
                <option value="Finalizat">✅ Finalizat</option>
                <option value="Arhivat">📦 Arhivat</option>
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
            <div style={{ position: 'relative' }}>
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
          </div>

          {/* Adresa */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Adresa Proiect
            </label>
            <input
              type="text"
              value={formData.Adresa}
              onChange={(e) => handleInputChange('Adresa', e.target.value)}
              disabled={loading}
              placeholder="Adresa unde se desfășoară proiectul"
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
            justifyContent: 'space-between', 
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            {/* Buton Șterge (stânga) */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#bdc3c7' : '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              🗑️ Șterge Proiect
            </button>

            {/* Butoane dreapta */}
            <div style={{ display: 'flex', gap: '1rem' }}>
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
                  background: loading ? '#bdc3c7' : '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? '⏳ Se salvează...' : '💾 Salvează Modificările'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
