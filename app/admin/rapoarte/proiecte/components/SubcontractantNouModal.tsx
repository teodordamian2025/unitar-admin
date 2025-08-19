// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SubcontractantNouModal.tsx
// DATA: 19.08.2025 21:50 (ora României)
// DESCRIERE: Modal pentru adăugare subcontractanți noi cu integrare ANAF
// ==================================================================

'use client';

import { useState } from 'react';

interface SubcontractantNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubcontractantAdded: () => void;
  initialData?: any; // Date din ANAF pentru pre-completare
}

// Toast system cu Z-index compatibil cu modalele
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

export default function SubcontractantNouModal({ 
  isOpen, 
  onClose, 
  onSubcontractantAdded,
  initialData 
}: SubcontractantNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [showAnafSearch, setShowAnafSearch] = useState(!initialData);
  const [anafData, setAnafData] = useState(initialData || null);

  const [formData, setFormData] = useState({
    nume: initialData?.nume || '',
    tip_client: initialData?.tip_client || 'Juridic',
    cui: initialData?.cui || '',
    nr_reg_com: initialData?.nr_reg_com || '',
    adresa: initialData?.adresa || '',
    judet: initialData?.judet || '',
    oras: initialData?.oras || '',
    cod_postal: initialData?.cod_postal || '',
    telefon: initialData?.telefon || '',
    email: initialData?.email || '',
    banca: '',
    iban: '',
    // Pentru persoane fizice
    cnp: '',
    ci_serie: '',
    ci_numar: '',
    ci_eliberata_de: '',
    ci_eliberata_la: '',
    observatii: initialData?.din_anaf ? 
      `Date preluate din ANAF la ${new Date().toLocaleString('ro-RO')}` : ''
  });

  const handleAnafDataFound = (data: any) => {
    setAnafData(data);
    setFormData(prev => ({
      ...prev,
      nume: data.denumire || '',
      cui: data.cui || '',
      nr_reg_com: data.nrRegCom || '',
      adresa: data.adresa || '',
      judet: data.judet || '',
      oras: data.oras || '',
      cod_postal: data.codPostal || '',
      telefon: data.telefon || '',
      tip_client: data.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
      observatii: `Date preluate din ANAF la ${new Date().toLocaleString('ro-RO')}`
    }));
    setShowAnafSearch(false);
    showToast('Date ANAF încărcate în formular. Completați restul informațiilor.', 'info');
  };

  const handleAnafDataImported = (subcontractantId: string, data: any) => {
    showToast('Subcontractant importat automat din ANAF!', 'success');
    setTimeout(() => {
      onSubcontractantAdded();
      onClose();
      resetForm();
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validări
      if (!formData.nume.trim()) {
        showToast('Numele subcontractantului este obligatoriu', 'error');
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

      showToast('Se adaugă subcontractantul...', 'info');

      // Construiește datele pentru BigQuery
      const subcontractantData = {
        ...formData,
        id: `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        tara: 'Romania',
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString(),
        activ: true
      };

      const response = await fetch('/api/rapoarte/subcontractanti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subcontractantData)
      });

      const result = await response.json();

      if (result.success || response.ok) {
        showToast('Subcontractant adăugat cu succes!', 'success');
        onSubcontractantAdded();
        onClose();
        resetForm();
      } else {
        console.error('Eroare API:', result);
        showToast(`Eroare: ${result.error || 'Eroare necunoscută'}`, 'error');
      }
    } catch (error) {
      console.error('Eroare la adăugarea subcontractantului:', error);
      showToast('Eroare la adăugarea subcontractantului', 'error');
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

  const resetForm = () => {
    setFormData({
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
    setAnafData(null);
    setShowAnafSearch(true);
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
          background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
              🏗️ Adaugă Subcontractant Nou
            </h2>
            <button
              onClick={() => {
                onClose();
                resetForm();
              }}
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
            Caută în ANAF pentru import automat sau adaugă manual
          </p>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Căutare ANAF (când nu avem date din ANAF) */}
          {showAnafSearch && (
            <>
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
                  🔍 Căutare în ANAF
                </h4>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '0.75rem', 
                  marginBottom: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <input
                      type="text"
                      placeholder="Introduceți CUI (ex: RO12345678 sau 12345678)"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        fontWeight: '500'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const cui = (e.target as HTMLInputElement).value;
                          if (cui.trim()) {
                            // Trigger ANAF search
                            showToast('Funcție ANAF în dezvoltare - folosiți formularul manual', 'info');
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <button
                    onClick={() => showToast('Funcție ANAF în dezvoltare - folosiți formularul manual', 'info')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)'
                    }}
                  >
                    🔍 Caută în ANAF
                  </button>
                </div>
              </div>

              {/* Separator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '2rem 0',
                gap: '1rem'
              }}>
                <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
                <span style={{ 
                  padding: '0.5rem 1rem',
                  background: '#f8f9fa',
                  borderRadius: '20px',
                  fontSize: '14px',
                  color: '#6c757d',
                  fontWeight: '600'
                }}>
                  SAU
                </span>
                <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
              </div>

              {/* Buton pentru formular manual */}
              <div style={{ textAlign: 'center', margin: '2rem 0' }}>
                <button
                  onClick={() => setShowAnafSearch(false)}
                  style={{
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                    boxShadow: '0 8px 24px rgba(39, 174, 96, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(39, 174, 96, 0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(39, 174, 96, 0.4)';
                  }}
                >
                  ✏️ Adaugă Manual (fără ANAF)
                </button>
              </div>
            </>
          )}

          {/* Formular manual */}
          {!showAnafSearch && (
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
                  📝 Completează Informațiile Subcontractant
                  {anafData && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '12px',
                      padding: '0.25rem 0.5rem',
                      background: '#3498db',
                      color: 'white',
                      borderRadius: '8px'
                    }}>
                      Date din ANAF
                    </span>
                  )}
                </h4>

                {/* Tip client */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                    Tip subcontractant *
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
                      placeholder="Numele subcontractantului"
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
                      placeholder="contact@subcontractant.ro"
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
                    placeholder="Observații despre subcontractant..."
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

                {/* Butoane */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #dee2e6'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowAnafSearch(true)}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#f8f9fa',
                      color: '#6c757d',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    ← Înapoi la ANAF
                  </button>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        resetForm();
                      }}
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
                        background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        boxShadow: loading ? 'none' : '0 4px 12px rgba(52, 152, 219, 0.4)'
                      }}
                    >
                      {loading ? '⏳ Se adaugă...' : '💾 Adaugă Subcontractant'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
