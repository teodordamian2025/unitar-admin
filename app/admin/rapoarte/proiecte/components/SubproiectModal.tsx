// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SubproiectModal.tsx
// CORECTAT: Integrare curs BNR automat
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

// Toast system
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
  }, type === 'success' ? 4000 : type === 'error' ? 5000 : 6000);
};

export default function SubproiectModal({ proiectParinte, isOpen, onClose, onSuccess }: SubproiectModalProps) {
  const [formData, setFormData] = React.useState({
    denumire: '',
    responsabil: '',
    dataStart: new Date().toISOString().split('T')[0],
    dataFinal: '',
    valoareEstimata: '0',
    status: 'Activ',
    // ✅ NOU: Câmpuri pentru valută
    moneda: 'RON',
    curs_valutar: 1,
    valoare_ron: 0
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingCurs, setIsLoadingCurs] = React.useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ NOU: Funcție pentru preluare curs BNR
  const getCursBNR = async (moneda: string): Promise<number> => {
    if (moneda === 'RON') return 1;
    
    setIsLoadingCurs(true);
    try {
      const response = await fetch(`/api/curs-valutar?moneda=${moneda}`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Curs BNR pentru ${moneda}: ${data.curs} (sursa: ${data.source})`);
        showToast(`📊 Curs BNR ${moneda}: ${data.curs.toFixed(4)} RON`, 'info');
        return data.curs;
      }
    } catch (error) {
      console.error('Eroare preluare curs BNR:', error);
      showToast('⚠️ Nu s-a putut prelua cursul BNR. Folosesc curs aproximativ.', 'error');
    } finally {
      setIsLoadingCurs(false);
    }
    
    // Fallback la cursuri aproximative
    const cursuriFallback: { [key: string]: number } = {
      'EUR': 4.9755,
      'USD': 4.3561,
      'GBP': 5.8585
    };
    
    return cursuriFallback[moneda] || 1;
  };

  // ✅ NOU: Handler pentru schimbare monedă
  const handleMonedaChange = async (moneda: string) => {
    setFormData(prev => ({ ...prev, moneda }));
    
    if (moneda !== 'RON' && formData.valoareEstimata) {
      const cursReal = await getCursBNR(moneda);
      const valoareRON = parseFloat(formData.valoareEstimata) * cursReal;
      
      setFormData(prev => ({
        ...prev,
        curs_valutar: cursReal,
        valoare_ron: valoareRON
      }));
    } else if (moneda === 'RON') {
      setFormData(prev => ({
        ...prev,
        curs_valutar: 1,
        valoare_ron: parseFloat(formData.valoareEstimata) || 0
      }));
    }
  };

  // ✅ NOU: Handler pentru schimbare valoare
  const handleValoareChange = async (valoare: string) => {
    setFormData(prev => ({ ...prev, valoareEstimata: valoare }));
    
    if (formData.moneda !== 'RON' && valoare) {
      const valoareRON = parseFloat(valoare) * formData.curs_valutar;
      setFormData(prev => ({ ...prev, valoare_ron: valoareRON }));
    } else {
      setFormData(prev => ({ ...prev, valoare_ron: parseFloat(valoare) || 0 }));
    }
  };

  const resetForm = () => {
    setFormData({
      denumire: '',
      responsabil: '',
      dataStart: new Date().toISOString().split('T')[0],
      dataFinal: '',
      valoareEstimata: '0',
      status: 'Activ',
      moneda: 'RON',
      curs_valutar: 1,
      valoare_ron: 0
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
      
      // Pregătește datele complete cu valută
      const requestData = {
        ID_Subproiect: subproiectId,
        ID_Proiect: proiectParinte.ID_Proiect,
        Denumire: formData.denumire.trim(),
        Responsabil: formData.responsabil.trim() || null,
        Data_Start: formData.dataStart || null,
        Data_Final: formData.dataFinal || null,
        Valoare_Estimata: formData.valoareEstimata ? parseFloat(formData.valoareEstimata) : null,
        Status: formData.status,
        
        // ✅ Câmpuri multi-valută cu curs real BNR
        moneda: formData.moneda,
        curs_valutar: formData.curs_valutar,
        data_curs_valutar: new Date().toISOString().split('T')[0],
        valoare_ron: formData.valoare_ron,
        
        // Status-uri multiple
        status_predare: 'Nepredat',
        status_contract: 'Nu e cazul',
        status_facturare: 'Nefacturat',
        status_achitare: 'Neachitat'
      };

      console.log('📤 Trimitere subproiect cu curs BNR:', requestData);

      const response = await fetch('/api/rapoarte/subproiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      
      if (result.success) {
        onSuccess();
        resetForm();
        showToast(`✅ Subproiect adăugat cu succes!${
          formData.moneda !== 'RON' ? ` (Curs BNR ${formData.moneda}: ${formData.curs_valutar.toFixed(4)})` : ''
        }`, 'success');
      } else {
        console.error('❌ Eroare API:', result);
        showToast(result.error || 'Eroare la adăugarea subproiectului', 'error');
      }
    } catch (error) {
      console.error('❌ Eroare la adăugarea subproiectului:', error);
      showToast('Eroare la adăugarea subproiectului', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        border: '1px solid #e0e0e0'
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
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
            border: '1px solid #cce7ff'
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
                boxSizing: 'border-box'
              }}
              placeholder="Introduceți denumirea subproiectului..."
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Grid pentru câmpuri */}
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
              border: '1px solid #e0e0e0'
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
              border: '1px solid #e0e0e0'
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
              border: '1px solid #e0e0e0'
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
              border: '1px solid #e0e0e0'
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
                  boxSizing: 'border-box'
                }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* ✅ NOU: Secțiune Valoare și Valută */}
          <div style={{
            background: '#e8f8e8',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid #c3e6cb'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '1rem'
            }}>
              💰 Valoare Estimată și Valută
            </h4>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 2fr',
              gap: '1rem',
              alignItems: 'end'
            }}>
              {/* Valoare */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  marginBottom: '0.5rem'
                }}>
                  Valoare
                </label>
                <input
                  type="number"
                  value={formData.valoareEstimata}
                  onChange={(e) => handleValoareChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    fontSize: '16px',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={isSubmitting}
                />
              </div>

              {/* Moneda */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  marginBottom: '0.5rem'
                }}>
                  Moneda
                </label>
                <select
                  value={formData.moneda}
                  onChange={(e) => handleMonedaChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    fontSize: '16px',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                  disabled={isSubmitting || isLoadingCurs}
                >
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              {/* Valoare în RON */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  marginBottom: '0.5rem'
                }}>
                  Echivalent RON
                </label>
                <div style={{
                  padding: '1rem',
                  background: '#f0f8ff',
                  border: '1px solid #cce7ff',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#27ae60'
                }}>
                  {formData.valoare_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                </div>
              </div>
            </div>

            {/* Afișare curs valutar */}
            {formData.moneda !== 'RON' && formData.curs_valutar > 1 && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: '#d1ecf1',
                border: '1px solid #bee5eb',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#0c5460'
              }}>
                📊 Curs BNR: 1 {formData.moneda} = {formData.curs_valutar.toFixed(4)} RON
              </div>
            )}

            {isLoadingCurs && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#856404'
              }}>
                ⏳ Se preia cursul BNR...
              </div>
            )}
          </div>

          {/* Info despre proiectul părinte */}
          <div style={{
            background: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid #e0e0e0'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '1rem'
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
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase' }}>CLIENT</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Client}</div>
              </div>
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase' }}>STATUS</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Status}</div>
              </div>
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase' }}>VALOARE</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#27ae60', marginTop: '0.25rem' }}>
                  {proiectParinte.Valoare_Estimata ? `${proiectParinte.Valoare_Estimata.toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
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
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              ✕ Închide
            </button>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={isSubmitting || !formData.denumire.trim() || isLoadingCurs}
                style={{
                  background: (isSubmitting || !formData.denumire.trim() || isLoadingCurs) ? 
                    '#f8f9fa' : 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                  color: (isSubmitting || !formData.denumire.trim() || isLoadingCurs) ? '#6c757d' : 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (isSubmitting || !formData.denumire.trim() || isLoadingCurs) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isSubmitting ? (
                  <>⏳ Se adaugă...</>
                ) : isLoadingCurs ? (
                  <>⏳ Se preia cursul...</>
                ) : (
                  <>📂 Adaugă Subproiect</>
                )}
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting || isLoadingCurs}
                style={{
                  background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (isSubmitting || isLoadingCurs) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                title="Resetează formularul pentru a adăuga alt subproiect"
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
