// ==================================================================
// CALEA: app/admin/rapoarte/clienti/components/ClientEditModal.tsx
// DESCRIERE: Modal pentru editarea clienților existenți cu funcție de ștergere
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import ClientContacteSection from './ClientContacteSection';

interface Contact {
  id?: string;
  prenume: string;
  nume: string;
  email: string;
  telefon: string;
  rol: string;
  comentariu: string;
  primeste_notificari: boolean;
}

interface Client {
  id: string;
  nume: string;
  tip_client: string;
  cui?: string;
  cnp?: string;
  nr_reg_com?: string;
  adresa?: string;
  judet?: string;
  oras?: string;
  cod_postal?: string;
  telefon?: string;
  email?: string;
  banca?: string;
  iban?: string;
  ci_serie?: string;
  ci_numar?: string;
  ci_eliberata_de?: string;
  ci_eliberata_la?: string;
  observatii?: string;
}

interface ClientEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientUpdated: () => void;
  client: Client | null;
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
  }, type === 'success' || type === 'error' ? 4000 : 6000);
};

export default function ClientEditModal({ isOpen, onClose, onClientUpdated, client }: ClientEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [contacte, setContacte] = useState<Contact[]>([]);
  const [contacteInitiale, setContacteInitiale] = useState<Contact[]>([]);
  const [formData, setFormData] = useState({
    nume: '',
    tip_client: 'Juridic',
    cui: '',
    nr_reg_com: '',
    adresa: '',
    judet: '',
    oras: '',
    cod_postal: '',
    telefon: '',
    email: '',
    banca: '',
    iban: '',
    cnp: '',
    ci_serie: '',
    ci_numar: '',
    ci_eliberata_de: '',
    ci_eliberata_la: '',
    observatii: ''
  });

  // ✅ Populează formularul și încarcă contactele când se deschide modalul
  useEffect(() => {
    if (client && isOpen) {
      setFormData({
        nume: client.nume || '',
        tip_client: client.tip_client || 'Juridic',
        cui: client.cui || '',
        nr_reg_com: client.nr_reg_com || '',
        adresa: client.adresa || '',
        judet: client.judet || '',
        oras: client.oras || '',
        cod_postal: client.cod_postal || '',
        telefon: client.telefon || '',
        email: client.email || '',
        banca: client.banca || '',
        iban: client.iban || '',
        cnp: client.cnp || '',
        ci_serie: client.ci_serie || '',
        ci_numar: client.ci_numar || '',
        ci_eliberata_de: client.ci_eliberata_de || '',
        ci_eliberata_la: client.ci_eliberata_la || '',
        observatii: client.observatii || ''
      });

      // Încarcă contactele clientului
      loadContacte(client.id);
    }
  }, [client, isOpen]);

  const loadContacte = async (clientId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/clienti/contacte?client_id=${encodeURIComponent(clientId)}`);
      const result = await response.json();

      if (result.success && result.data) {
        const loadedContacte = result.data.map((c: any) => ({
          id: c.id,
          prenume: c.prenume || '',
          nume: c.nume || '',
          email: c.email || '',
          telefon: c.telefon || '',
          rol: c.rol || '',
          comentariu: c.comentariu || '',
          primeste_notificari: c.primeste_notificari !== false
        }));
        setContacte(loadedContacte);
        setContacteInitiale(JSON.parse(JSON.stringify(loadedContacte)));
      }
    } catch (error) {
      console.error('Eroare la încărcarea contactelor:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) {
      showToast('Eroare: Nu există client selectat', 'error');
      return;
    }

    setLoading(true);

    try {
      // Validări
      if (!formData.nume.trim()) {
        showToast('Numele clientului este obligatoriu', 'error');
        setLoading(false);
        return;
      }

      if (formData.tip_client.includes('Juridic') && !formData.cui.trim()) {
        showToast('CUI-ul este obligatoriu pentru persoane juridice', 'error');
        setLoading(false);
        return;
      }

      if (formData.tip_client === 'Fizic' && !formData.cnp.trim()) {
        showToast('CNP-ul este obligatoriu pentru persoane fizice', 'error');
        setLoading(false);
        return;
      }

      console.log('Actualizare client:', client.id, formData);
      showToast('Se actualizează clientul...', 'info');

      // Construiește datele pentru API
      const updateData = {
        id: client.id,
        ...formData
      };

      const response = await fetch('/api/rapoarte/clienti', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success || response.ok) {
        // Gestionează contactele
        await saveContacte(client.id);

        showToast('Client actualizat cu succes!', 'success');
        onClientUpdated();
        onClose();
      } else {
        console.error('Eroare API:', result);
        showToast(`Eroare: ${result.error || 'Eroare necunoscută'}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la actualizarea clientului:', error);
      showToast('Eroare la actualizarea clientului', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!client) {
      showToast('Eroare: Nu există client selectat', 'error');
      return;
    }

    const confirmDelete = confirm(
      `Ești sigur că vrei să ștergi clientul "${client.nume}"?\n\nAceastă acțiune nu poate fi anulată.`
    );
    
    if (!confirmDelete) return;

    setLoading(true);

    try {
      showToast('Se șterge clientul...', 'info');

      const response = await fetch(`/api/rapoarte/clienti?id=${encodeURIComponent(client.id)}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(`Clientul "${client.nume}" a fost șters cu succes`, 'success');
        onClientUpdated();
        onClose();
      } else {
        showToast(`Eroare la ștergerea clientului: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la ștergerea clientului:', error);
      showToast('Eroare la ștergerea clientului', 'error');
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

  // Salvează modificările la contacte
  const saveContacte = async (clientId: string) => {
    try {
      // Găsește contactele șterse (existau inițial dar nu mai sunt)
      const contacteSterse = contacteInitiale.filter(
        ci => ci.id && !contacte.find(c => c.id === ci.id)
      );

      // Șterge contactele eliminate
      for (const contact of contacteSterse) {
        if (contact.id) {
          await fetch(`/api/rapoarte/clienti/contacte?id=${encodeURIComponent(contact.id)}`, {
            method: 'DELETE'
          });
        }
      }

      // Adaugă/actualizează contactele curente
      for (const contact of contacte) {
        if (!contact.nume || !contact.email) continue;

        if (contact.id) {
          // Update contact existent
          await fetch('/api/rapoarte/clienti/contacte', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contact)
          });
        } else {
          // Adaugă contact nou
          await fetch('/api/rapoarte/clienti/contacte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: clientId,
              ...contact
            })
          });
        }
      }
    } catch (error) {
      console.error('Eroare la salvarea contactelor:', error);
    }
  };

  if (!isOpen || !client) return null;

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
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
              ✏️ Editează Client
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                fontSize: '20px',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
            Modifică informațiile clientului: {client.nume}
          </p>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <form onSubmit={handleSubmit}>
            <div style={{
              background: '#f8f9fa',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              marginBottom: '1rem'
            }}>
              <h4 style={{ 
                margin: '0 0 1rem 0', 
                color: '#2c3e50',
                fontSize: '1.1rem',
                fontWeight: '600'
              }}>
                📝 Informații Client
              </h4>

              {/* Tip client */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Tip client *
                </label>
                <select
                  value={formData.tip_client}
                  onChange={(e) => handleInputChange('tip_client', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Juridic">Persoană Juridică</option>
                  <option value="Juridic_TVA">Persoană Juridică (Plătitor TVA)</option>
                  <option value="Fizic">Persoană Fizică</option>
                </select>
              </div>

              {/* Grid pentru câmpuri principale */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                {/* Nume */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Nume/Denumire *
                  </label>
                  <input
                    type="text"
                    value={formData.nume}
                    onChange={(e) => handleInputChange('nume', e.target.value)}
                    disabled={loading}
                    placeholder="Numele clientului"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* CUI/CNP */}
                {formData.tip_client.includes('Juridic') ? (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                      CUI *
                    </label>
                    <input
                      type="text"
                      value={formData.cui}
                      onChange={(e) => handleInputChange('cui', e.target.value)}
                      disabled={loading}
                      placeholder="RO12345678"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                      CNP *
                    </label>
                    <input
                      type="text"
                      value={formData.cnp}
                      onChange={(e) => handleInputChange('cnp', e.target.value)}
                      disabled={loading}
                      placeholder="1234567890123"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Nr. Reg. Com pentru persoane juridice */}
              {formData.tip_client.includes('Juridic') && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Nr. Reg. Com.
                  </label>
                  <input
                    type="text"
                    value={formData.nr_reg_com}
                    onChange={(e) => handleInputChange('nr_reg_com', e.target.value)}
                    disabled={loading}
                    placeholder="J40/1234/2020"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              )}

              {/* Adresă */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Adresă
                </label>
                <input
                  type="text"
                  value={formData.adresa}
                  onChange={(e) => handleInputChange('adresa', e.target.value)}
                  disabled={loading}
                  placeholder="Strada, numărul, sectorul/comuna"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Grid pentru localitate */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Județ
                  </label>
                  <input
                    type="text"
                    value={formData.judet}
                    onChange={(e) => handleInputChange('judet', e.target.value)}
                    disabled={loading}
                    placeholder="București"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Oraș
                  </label>
                  <input
                    type="text"
                    value={formData.oras}
                    onChange={(e) => handleInputChange('oras', e.target.value)}
                    disabled={loading}
                    placeholder="București"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Cod Poștal
                  </label>
                  <input
                    type="text"
                    value={formData.cod_postal}
                    onChange={(e) => handleInputChange('cod_postal', e.target.value)}
                    disabled={loading}
                    placeholder="010123"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Contact */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.telefon}
                    onChange={(e) => handleInputChange('telefon', e.target.value)}
                    disabled={loading}
                    placeholder="0123456789"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={loading}
                    placeholder="contact@client.ro"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Date bancare */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Bancă
                  </label>
                  <input
                    type="text"
                    value={formData.banca}
                    onChange={(e) => handleInputChange('banca', e.target.value)}
                    disabled={loading}
                    placeholder="Banca Transilvania"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => handleInputChange('iban', e.target.value)}
                    disabled={loading}
                    placeholder="RO49AAAA1B31007593840000"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>

              {/* Observații */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Observații
                </label>
                <textarea
                  value={formData.observatii}
                  onChange={(e) => handleInputChange('observatii', e.target.value)}
                  disabled={loading}
                  placeholder="Observații despre client..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Secțiune Contacte pentru Notificări Email */}
              <ClientContacteSection
                clientId={client?.id}
                contacte={contacte}
                setContacte={setContacte}
                disabled={loading}
              />

              {/* Butoane */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                gap: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #dee2e6'
              }}>
                {/* Buton ștergere (stânga) */}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: loading ? '#bdc3c7' : '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  🗑️ Șterge Client
                </button>

                {/* Butoane acțiune (dreapta) */}
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
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    Anulează
                  </button>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      boxShadow: loading ? 'none' : '0 4px 12px rgba(243, 156, 18, 0.4)'
                    }}
                  >
                    {loading ? '⏳ Se actualizează...' : '💾 Actualizează Client'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
