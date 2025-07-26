// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SubproiectModal.tsx
// PARTEA 2: Modal Separat pentru management în ProiecteTable.tsx
// MODIFICAT: Z-index 50000 + Toast System compatibil + Design optimizat
// ==================================================================

'use client';

import React from 'react';

interface SubproiectModalProps {
  proiectParinte: {
    ID_Proiect: string;
    Denumire: string;
    Client: string;
    Status: string;
    Valoare_Estimata?: number;
    Data_Start?: string | { value: string };
    Data_Final?: string | { value: string };
    tip?: 'proiect' | 'subproiect';
    Responsabil?: string;
    Adresa?: string;
    Observatii?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ✅ Toast system cu Z-index compatibil cu modalele externe
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
    white-space: pre-line;
    transform: translateY(-10px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  // Smooth entrance animation
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
  }, type === 'success' ? 4000 : type === 'error' ? 5000 : type === 'info' && message.length > 200 ? 10000 : 6000);
};

export default function SubproiectModal({ proiectParinte, isOpen, onClose, onSuccess }: SubproiectModalProps) {
  const [formData, setFormData] = React.useState({
    denumire: '',
    responsabil: '',
    dataStart: new Date().toISOString().split('T')[0],
    dataFinal: '',
    valoareEstimata: '0',
    status: 'Activ'
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      denumire: '',
      responsabil: '',
      dataStart: new Date().toISOString().split('T')[0],
      dataFinal: '',
      valoareEstimata: '0',
      status: 'Activ'
    });
    showToast('📋 Formular resetat pentru noul subproiect!', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.denumire.trim()) {
      showToast('Denumirea subproiectului este obligatorie', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const subproiectId = `${proiectParinte.ID_Proiect}_SUB_${Date.now()}`;
      
      const requestData = {
        ID_Subproiect: subproiectId,
        ID_Proiect: proiectParinte.ID_Proiect,
        Denumire: formData.denumire.trim(),
        Responsabil: formData.responsabil.trim() || null,
        Data_Start: formData.dataStart || null,
        Data_Final: formData.dataFinal || null,
        Valoare_Estimata: formData.valoareEstimata ? parseFloat(formData.valoareEstimata) : null,
        Status: formData.status
      };

      console.log('Trimitere subproiect:', requestData);

      const response = await fetch('/api/rapoarte/subproiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      console.log('Răspuns subproiect:', result);

      if (result.success) {
        onSuccess();
        resetForm();
        showToast('✅ Subproiect adăugat cu succes!', 'success');
      } else {
        showToast(result.error || 'Eroare la adăugarea subproiectului', 'error');
      }
    } catch (error) {
      console.error('Eroare la adăugarea subproiectului:', error);
      showToast('Eroare la adăugarea subproiectului', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Nu renderează nimic dacă modalul nu este deschis
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed' as const,
      inset: '0',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50000,
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        border: '1px solid #e0e0e0',
        position: 'relative' as const,
        transform: 'scale(1)',
        opacity: 1
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid #e0e0e0',
          background: '#e8f5e8',
          borderRadius: '16px 16px 0 0'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#2c3e50',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📂 Adaugă Subproiect Nou
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#7f8c8d',
              margin: '0.5rem 0 0 0',
              fontWeight: '500'
            }}>
              🏗️ Proiect părinte: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#3498db' }}>{proiectParinte.ID_Proiect}</span>
            </p>
            <p style={{
              fontSize: '12px',
              color: '#95a5a6',
              margin: '0.25rem 0 0 0'
            }}>
              {proiectParinte.Denumire}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'rgba(231, 76, 60, 0.1)',
              color: '#e74c3c',
              border: 'none',
              borderRadius: '12px',
              width: '48px',
              height: '48px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '20px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseOut={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Denumire */}
          <div style={{
            background: '#f0f8ff',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid #cce7ff',
            boxShadow: '0 4px 12px rgba(52, 152, 219, 0.15)'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '0.75rem'
            }}>
              📝 Denumire Subproiect *
            </label>
            <input
              type="text"
              value={formData.denumire}
              onChange={(e) => handleInputChange('denumire', e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                fontSize: '16px',
                background: '#ffffff',
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
              }}
              placeholder="Introduceți denumirea subproiectului..."
              required
              disabled={isSubmitting}
              onFocus={(e) => {
                e.currentTarget.style.border = '2px solid #3498db';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid #e0e0e0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Grid pentru câmpuri în două coloane */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {/* Responsabil */}
            <div style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                👤 Responsabil
              </label>
              <input
                type="text"
                value={formData.responsabil}
                onChange={(e) => handleInputChange('responsabil', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                placeholder="Numele responsabilului..."
                disabled={isSubmitting}
              />
            </div>

            {/* Status */}
            <div style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                📊 Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                disabled={isSubmitting}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Planificat">📅 Planificat</option>
                <option value="Suspendat">⏸️ Suspendat</option>
                <option value="Finalizat">✅ Finalizat</option>
              </select>
            </div>

            {/* Data Start */}
            <div style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                📅 Data Început
              </label>
              <input
                type="date"
                value={formData.dataStart}
                onChange={(e) => handleInputChange('dataStart', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                disabled={isSubmitting}
              />
            </div>

            {/* Data Final */}
            <div style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                🏁 Data Finalizare
              </label>
              <input
                type="date"
                value={formData.dataFinal}
                onChange={(e) => handleInputChange('dataFinal', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Valoare Estimată */}
          <div style={{
            background: '#e8f8e8',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid #c3e6cb',
            boxShadow: '0 4px 12px rgba(39, 174, 96, 0.15)'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '0.75rem'
            }}>
              💰 Valoare Estimată (RON)
            </label>
            <input
              type="number"
              value={formData.valoareEstimata}
              onChange={(e) => handleInputChange('valoareEstimata', e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                fontSize: '16px',
                background: '#ffffff',
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
              }}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={isSubmitting}
            />
          </div>

          {/* Info despre proiectul părinte */}
          <div style={{
            background: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🏗️ Informații Proiect Părinte
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLIENT</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Client}</div>
              </div>
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Status}</div>
              </div>
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VALOARE</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#27ae60', marginTop: '0.25rem' }}>
                  {proiectParinte.Valoare_Estimata ? `${proiectParinte.Valoare_Estimata.toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
              </div>
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ADRESĂ</div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Adresa || 'Nespecificată'}</div>
              </div>
            </div>
          </div>

          {/* Butoane */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e0e0e0'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: '#f8f9fa',
                color: '#6c757d',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = '#e9ecef';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseOut={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = '#f8f9fa';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              ✕ Închide
            </button>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={isSubmitting || !formData.denumire.trim()}
                style={{
                  background: isSubmitting || !formData.denumire.trim() ? 
                    '#f8f9fa' : 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                  color: isSubmitting || !formData.denumire.trim() ? '#6c757d' : 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (isSubmitting || !formData.denumire.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: (isSubmitting || !formData.denumire.trim()) ? 'none' : '0 4px 12px rgba(52, 152, 219, 0.4)'
                }}
                onMouseOver={(e) => {
                  if (!isSubmitting && formData.denumire.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSubmitting && formData.denumire.trim()) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.4)';
                  }
                }}
              >
                {isSubmitting ? (
                  <>⏳ Se adaugă...</>
                ) : (
                  <>📂 Adaugă Subproiect</>
                )}
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(39, 174, 96, 0.4)'
                }}
                title="Resetează formularul pentru a adăuga alt subproiect"
                onMouseOver={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(39, 174, 96, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
                  }
                }}
              >
                🔄 Resetează
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
