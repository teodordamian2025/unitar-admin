// ==================================================================
// CALEA: app/admin/rapoarte/contracte/components/ContractSignModal.tsx
// DATA: 15.01.2025 08:45 (ora României)
// CREAT: Modal pentru setarea datei semnării contractului
// FUNCTIONALITATE: Setare Data_Semnare + calcul automat Data_Expirare
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ContractSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: {
    ID_Contract: string;
    numar_contract: string;
    Denumire_Contract: string;
    client_nume: string;
    Status: string;
    etape?: any[];
    // Date pentru calculul expirării
    Valoare?: number;
    Moneda?: string;
  };
}

// Toast system cu z-index crescut pentru modal
const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#3498db'};
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
  }, type === 'success' || type === 'error' ? 4000 : type === 'warning' ? 6000 : 5000);
};

export default function ContractSignModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  contract 
}: ContractSignModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingTermen, setLoadingTermen] = useState(true);
  
  const [formData, setFormData] = useState({
    data_semnare: new Date().toISOString().split('T')[0], // Default la data curentă
    termen_executie_zile: 30, // Default 30 zile
    observatii_semnare: ''
  });

  const [dataExpirare, setDataExpirare] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [warnings, setWarnings] = useState<{[key: string]: string}>({});

  // Calculează data expirării când se schimbă data semnării sau termenul
  useEffect(() => {
    if (formData.data_semnare && formData.termen_executie_zile) {
      const dataSemnare = new Date(formData.data_semnare);
      const dataExp = new Date(dataSemnare);
      dataExp.setDate(dataExp.getDate() + formData.termen_executie_zile);
      
      setDataExpirare(dataExp.toISOString().split('T')[0]);
    }
  }, [formData.data_semnare, formData.termen_executie_zile]);

  // Încarcă termenul standard din setări sau calculează pe baza valorii
  useEffect(() => {
    if (isOpen) {
      incarcaTermenStandard();
    }
  }, [isOpen, contract]);

  const incarcaTermenStandard = async () => {
    setLoadingTermen(true);
    try {
      // Calculează termenul pe baza valorii contractului
      let termenEstimat = 30; // Default

      if (contract.Valoare) {
        // Logica de estimare: 1 zi per 1000 RON, minim 15 zile, maxim 365
        const valoare = contract.Valoare;
        termenEstimat = Math.max(15, Math.min(365, Math.round(valoare / 1000)));
      }

      // Dacă sunt etape, calculează pe baza etapelor
      if (contract.etape && contract.etape.length > 0) {
        // Estimez 15-30 zile per etapă
        termenEstimat = contract.etape.length * 20;
      }

      setFormData(prev => ({
        ...prev,
        termen_executie_zile: termenEstimat
      }));

    } catch (error) {
      console.error('Eroare la calculul termenului:', error);
      // Păstrează default-ul de 30 zile
    } finally {
      setLoadingTermen(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validări în timp real
    validateField(field, value);
  };

  const validateField = (field: string, value: string | number) => {
    const newErrors = { ...errors };
    const newWarnings = { ...warnings };

    if (field === 'data_semnare') {
      const dataSemnare = new Date(value as string);
      const astazi = new Date();
      const diferentaZile = Math.ceil((dataSemnare.getTime() - astazi.getTime()) / (1000 * 60 * 60 * 24));

      delete newErrors[field];
      delete newWarnings[field];

      if (diferentaZile > 30) {
        newWarnings[field] = `Data semnării este cu ${diferentaZile} zile în viitor. Verifică dacă este corectă.`;
      } else if (diferentaZile > 0) {
        newWarnings[field] = `Data semnării este în viitor (${diferentaZile} ${diferentaZile === 1 ? 'zi' : 'zile'}).`;
      }

      // Verifică dacă data nu este prea în trecut
      if (diferentaZile < -365) {
        newWarnings[field] = `Data semnării este cu ${Math.abs(diferentaZile)} zile în trecut. Verifică dacă este corectă.`;
      }
    }

    if (field === 'termen_executie_zile') {
      const termen = Number(value);
      delete newErrors[field];
      delete newWarnings[field];

      if (termen < 1) {
        newErrors[field] = 'Termenul trebuie să fie cel puțin 1 zi';
      } else if (termen > 1095) { // 3 ani
        newWarnings[field] = `Termen foarte lung: ${termen} zile (${Math.round(termen/30)} luni)`;
      } else if (termen > 365) { // 1 an
        newWarnings[field] = `Termen lung: ${termen} zile (${Math.round(termen/30)} luni)`;
      }
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.data_semnare) {
      newErrors.data_semnare = 'Data semnării este obligatorie';
    }

    if (!formData.termen_executie_zile || formData.termen_executie_zile < 1) {
      newErrors.termen_executie_zile = 'Termenul de execuție trebuie să fie cel puțin 1 zi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('Corectează erorile din formular', 'error');
      return;
    }

    // Confirmarea pentru contracte cu termene lungi
    if (formData.termen_executie_zile > 180) {
      const confirmare = confirm(`Sigur vrei să setezi termenul la ${formData.termen_executie_zile} zile (${Math.round(formData.termen_executie_zile/30)} luni)?`);
      if (!confirmare) return;
    }

    setLoading(true);

    try {
      const updateData = {
        ID_Contract: contract.ID_Contract,
        Status: 'Semnat',
        Data_Semnare: formData.data_semnare,
        Data_Expirare: dataExpirare,
        termen_executie_zile: formData.termen_executie_zile,
        observatii_semnare: formData.observatii_semnare.trim() || undefined
      };

      console.log('Actualizez contract cu semnare:', updateData);

      const response = await fetch('/api/rapoarte/contracte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        showToast(
          `Contract ${contract.numar_contract} marcat ca semnat!\n` +
          `Data semnare: ${new Date(formData.data_semnare).toLocaleDateString('ro-RO')}\n` +
          `Data expirare: ${new Date(dataExpirare).toLocaleDateString('ro-RO')}`,
          'success'
        );
        onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Eroare la marcarea contractului ca semnat', 'error');
      }
    } catch (error) {
      console.error('Eroare la semnarea contractului:', error);
      showToast('Eroare la semnarea contractului', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      data_semnare: new Date().toISOString().split('T')[0],
      termen_executie_zile: 30,
      observatii_semnare: ''
    });
    setErrors({});
    setWarnings({});
  };

  if (!isOpen) return null;

  return typeof window !== 'undefined' ? createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 65000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        maxWidth: '550px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: '700' }}>
                ✅ Marchează Contract Semnat
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px' }}>
                <strong>{contract.numar_contract}</strong> - {contract.client_nume}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                {contract.Denumire_Contract}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '12px',
                width: '36px',
                height: '36px',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'white',
                marginLeft: '1rem'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          
          {/* Informații context */}
          <div style={{
            background: 'rgba(52, 152, 219, 0.1)',
            border: '1px solid rgba(52, 152, 219, 0.2)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '16px' }}>ℹ️</span>
              <strong style={{ color: '#3498db', fontSize: '14px' }}>
                Setare date semnare contract
              </strong>
            </div>
            <div style={{ fontSize: '13px', color: '#2c3e50', lineHeight: '1.4' }}>
              Completează data semnării și termenul de execuție. 
              Data expirării se va calcula automat.
              {contract.etape && contract.etape.length > 0 && (
                <div style={{ marginTop: '0.5rem', fontWeight: '500' }}>
                  📋 Contractul are {contract.etape.length} etape definite
                </div>
              )}
            </div>
          </div>

          {/* Data semnării */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Data Semnării *
            </label>
            <input
              type="date"
              value={formData.data_semnare}
              onChange={(e) => handleInputChange('data_semnare', e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.data_semnare ? '#e74c3c' : warnings.data_semnare ? '#f39c12' : '#dee2e6'}`,
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: loading ? '#f8f9fa' : 'white'
              }}
            />
            {errors.data_semnare && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                ❌ {errors.data_semnare}
              </div>
            )}
            {warnings.data_semnare && !errors.data_semnare && (
              <div style={{ color: '#f39c12', fontSize: '12px', marginTop: '0.25rem' }}>
                ⚠️ {warnings.data_semnare}
              </div>
            )}
          </div>

          {/* Termen execuție */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Termen Execuție (zile) *
              {loadingTermen && <span style={{ color: '#f39c12', marginLeft: '0.5rem' }}>⏳</span>}
            </label>
            <input
              type="number"
              min="1"
              max="1095"
              value={formData.termen_executie_zile}
              onChange={(e) => handleInputChange('termen_executie_zile', parseInt(e.target.value) || 0)}
              disabled={loading || loadingTermen}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.termen_executie_zile ? '#e74c3c' : warnings.termen_executie_zile ? '#f39c12' : '#dee2e6'}`,
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: loading || loadingTermen ? '#f8f9fa' : 'white'
              }}
            />
            <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '0.25rem' }}>
              Termene comune: 15 zile (rapid), 30 zile (standard), 60 zile (complex)
              {formData.termen_executie_zile > 0 && (
                <span style={{ color: '#3498db', fontWeight: '500' }}>
                  {' '}≈ {Math.round(formData.termen_executie_zile / 30 * 10) / 10} luni
                </span>
              )}
            </div>
            {errors.termen_executie_zile && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                ❌ {errors.termen_executie_zile}
              </div>
            )}
            {warnings.termen_executie_zile && !errors.termen_executie_zile && (
              <div style={{ color: '#f39c12', fontSize: '12px', marginTop: '0.25rem' }}>
                ⚠️ {warnings.termen_executie_zile}
              </div>
            )}
          </div>

          {/* Data expirării (calculată automat) */}
          {dataExpirare && (
            <div style={{
              background: 'rgba(39, 174, 96, 0.1)',
              border: '1px solid rgba(39, 174, 96, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '16px' }}>📅</span>
                <strong style={{ color: '#27ae60', fontSize: '14px' }}>
                  Data Expirare (calculată automat)
                </strong>
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#27ae60' }}>
                {new Date(dataExpirare).toLocaleDateString('ro-RO', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          )}

          {/* Observații opționale */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații Semnare (opțional)
            </label>
            <textarea
              value={formData.observatii_semnare}
              onChange={(e) => handleInputChange('observatii_semnare', e.target.value)}
              disabled={loading}
              placeholder="Ex: Semnat la sediul clientului, condiții speciale..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                backgroundColor: loading ? '#f8f9fa' : 'white'
              }}
            />
          </div>

          {/* Footer cu butoane */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
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
              disabled={loading || loadingTermen || Object.keys(errors).length > 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || loadingTermen || Object.keys(errors).length > 0 ? 
                  '#bdc3c7' : 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || loadingTermen || Object.keys(errors).length > 0 ? 
                  'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ Se semnează...' : '✅ Marchează Semnat'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}
