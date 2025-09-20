// ==================================================================
// CALEA: app/admin/rapoarte/contracte/components/AnexaSignModal.tsx
// DATA: 20.09.2025 15:45 (ora României)
// CREAT: Modal pentru setarea datei semnării anexelor de contract
// FUNCTIONALITATE: Setare data_start, data_final și Status pentru anexe
// SIMILAR CU: ContractSignModal.tsx dar adaptat pentru tabelul AnexeContract
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AnexaSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  anexa: {
    ID_Anexa: string;
    anexa_numar: number;
    denumire: string;
    contract_id: string;
    proiect_id: string;
    valoare?: number;
    moneda?: string;
    termen_zile?: number;
    status?: string; // Status-ul anexei (va fi adăugat în BigQuery)
  };
  contract: {
    numar_contract: string;
    client_nume: string;
    Denumire_Contract: string;
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

export default function AnexaSignModal({
  isOpen,
  onClose,
  onSuccess,
  anexa,
  contract
}: AnexaSignModalProps) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    data_start: new Date().toISOString().split('T')[0], // Default la data curentă
    data_final: '', // Va fi calculată automat
    status: 'Semnat', // Default status pentru anexă semnată
    observatii_semnare: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [warnings, setWarnings] = useState<{[key: string]: string}>({});

  // Calculează data finală când se schimbă data start
  useEffect(() => {
    if (formData.data_start && anexa.termen_zile) {
      const dataStart = new Date(formData.data_start);
      const dataFinal = new Date(dataStart);
      dataFinal.setDate(dataFinal.getDate() + anexa.termen_zile);

      setFormData(prev => ({
        ...prev,
        data_final: dataFinal.toISOString().split('T')[0]
      }));
    }
  }, [formData.data_start, anexa.termen_zile]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validări în timp real
    validateField(field, value);
  };

  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };
    const newWarnings = { ...warnings };

    if (field === 'data_start') {
      const dataStart = new Date(value);
      const astazi = new Date();
      const diferentaZile = Math.ceil((dataStart.getTime() - astazi.getTime()) / (1000 * 60 * 60 * 24));

      delete newErrors[field];
      delete newWarnings[field];

      if (diferentaZile > 30) {
        newWarnings[field] = `Data start este cu ${diferentaZile} zile în viitor. Verifică dacă este corectă.`;
      } else if (diferentaZile > 0) {
        newWarnings[field] = `Data start este în viitor (${diferentaZile} ${diferentaZile === 1 ? 'zi' : 'zile'}).`;
      }

      // Verifică dacă data nu este prea în trecut
      if (diferentaZile < -365) {
        newWarnings[field] = `Data start este cu ${Math.abs(diferentaZile)} zile în trecut. Verifică dacă este corectă.`;
      }
    }

    if (field === 'data_final') {
      const dataFinal = new Date(value);
      const dataStart = new Date(formData.data_start);

      delete newErrors[field];
      delete newWarnings[field];

      if (dataFinal <= dataStart) {
        newErrors[field] = 'Data finală trebuie să fie după data start';
      }
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.data_start) {
      newErrors.data_start = 'Data start este obligatorie';
    }

    if (!formData.data_final) {
      newErrors.data_final = 'Data finală este obligatorie';
    }

    if (formData.data_start && formData.data_final) {
      const dataStart = new Date(formData.data_start);
      const dataFinal = new Date(formData.data_final);

      if (dataFinal <= dataStart) {
        newErrors.data_final = 'Data finală trebuie să fie după data start';
      }
    }

    if (!formData.status) {
      newErrors.status = 'Status-ul este obligatoriu';
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

    setLoading(true);

    try {
      const updateData = {
        ID_Anexa: anexa.ID_Anexa,
        data_start: formData.data_start,
        data_final: formData.data_final,
        status: formData.status,
        observatii_semnare: formData.observatii_semnare.trim() || undefined
      };

      console.log('Actualizez anexa cu date semnare:', updateData);

      const response = await fetch('/api/rapoarte/anexe-contract', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        showToast(
          `Anexa ${anexa.anexa_numar} marcată ca ${formData.status.toLowerCase()}!\n` +
          `Data start: ${new Date(formData.data_start).toLocaleDateString('ro-RO')}\n` +
          `Data finală: ${new Date(formData.data_final).toLocaleDateString('ro-RO')}`,
          'success'
        );
        onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Eroare la marcarea anexei', 'error');
      }
    } catch (error) {
      console.error('Eroare la semnarea anexei:', error);
      showToast('Eroare la semnarea anexei', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      data_start: new Date().toISOString().split('T')[0],
      data_final: '',
      status: 'Semnat',
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
          background: 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: '700' }}>
                📋 Actualizează Anexa Contract
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px' }}>
                <strong>Anexa {anexa.anexa_numar}</strong> - {contract.numar_contract}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                {anexa.denumire}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}>
                Client: {contract.client_nume}
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
            background: 'rgba(142, 68, 173, 0.1)',
            border: '1px solid rgba(142, 68, 173, 0.2)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '16px' }}>📋</span>
              <strong style={{ color: '#8e44ad', fontSize: '14px' }}>
                Setare perioade anexă contract
              </strong>
            </div>
            <div style={{ fontSize: '13px', color: '#2c3e50', lineHeight: '1.4' }}>
              Completează data start și finală pentru anexa de contract.
              {anexa.valoare && (
                <div style={{ marginTop: '0.5rem', fontWeight: '500' }}>
                  💰 Valoare anexă: {anexa.valoare.toLocaleString('ro-RO')} {anexa.moneda || 'RON'}
                </div>
              )}
              {anexa.termen_zile && (
                <div style={{ marginTop: '0.25rem', fontWeight: '500' }}>
                  ⏰ Termen estimat: {anexa.termen_zile} zile
                </div>
              )}
            </div>
          </div>

          {/* Data start */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Data Start *
            </label>
            <input
              type="date"
              value={formData.data_start}
              onChange={(e) => handleInputChange('data_start', e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.data_start ? '#e74c3c' : warnings.data_start ? '#f39c12' : '#dee2e6'}`,
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: loading ? '#f8f9fa' : 'white'
              }}
            />
            {errors.data_start && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                ❌ {errors.data_start}
              </div>
            )}
            {warnings.data_start && !errors.data_start && (
              <div style={{ color: '#f39c12', fontSize: '12px', marginTop: '0.25rem' }}>
                ⚠️ {warnings.data_start}
              </div>
            )}
          </div>

          {/* Data finală */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Data Finală *
            </label>
            <input
              type="date"
              value={formData.data_final}
              onChange={(e) => handleInputChange('data_final', e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.data_final ? '#e74c3c' : warnings.data_final ? '#f39c12' : '#dee2e6'}`,
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: loading ? '#f8f9fa' : 'white'
              }}
            />
            {anexa.termen_zile && formData.data_start && (
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '0.25rem' }}>
                📅 Calculată automat: {anexa.termen_zile} zile de la data start
              </div>
            )}
            {errors.data_final && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                ❌ {errors.data_final}
              </div>
            )}
            {warnings.data_final && !errors.data_final && (
              <div style={{ color: '#f39c12', fontSize: '12px', marginTop: '0.25rem' }}>
                ⚠️ {warnings.data_final}
              </div>
            )}
          </div>

          {/* Status anexă */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Status Anexă *
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.status ? '#e74c3c' : '#dee2e6'}`,
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: loading ? '#f8f9fa' : 'white'
              }}
            >
              <option value="Semnat">Semnat</option>
              <option value="In lucru">În lucru</option>
              <option value="Finalizata">Finalizată</option>
              <option value="Suspendata">Suspendată</option>
              <option value="Anulata">Anulată</option>
            </select>
            {errors.status && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                ❌ {errors.status}
              </div>
            )}
          </div>

          {/* Observații opționale */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații (opțional)
            </label>
            <textarea
              value={formData.observatii_semnare}
              onChange={(e) => handleInputChange('observatii_semnare', e.target.value)}
              disabled={loading}
              placeholder="Ex: Anexa semnată cu modificări, condiții speciale..."
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
              disabled={loading || Object.keys(errors).length > 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || Object.keys(errors).length > 0 ?
                  '#bdc3c7' : 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || Object.keys(errors).length > 0 ?
                  'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ Se actualizează...' : '✅ Actualizează Anexa'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}