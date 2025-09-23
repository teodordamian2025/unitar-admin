// ==================================================================
// CALEA: app/projects/components/UserTimeTrackingNouModal.tsx
// DATA: 23.09.2025 18:40 (ora României)
// DESCRIERE: Modal pentru înregistrare timp utilizatori normali - IDENTIC cu admin
// FUNCȚIONALITATE: Înregistrare timp pe sarcini cu validări limită zilnică
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface UserTimeTrackingNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeAdded: () => void;
  proiect: {
    ID_Proiect: string;
    Denumire: string;
    tip?: 'proiect' | 'subproiect';
  };
  sarcini: Array<{
    id: string;
    titlu: string;
    status: string;
  }>;
  utilizatorCurent: {
    uid: string;
    nume_complet: string;
  } | null;
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

export default function UserTimeTrackingNouModal({
  isOpen,
  onClose,
  onTimeAdded,
  proiect,
  sarcini,
  utilizatorCurent
}: UserTimeTrackingNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingValidari, setLoadingValidari] = useState(false);
  const [timpTotalZiua, setTimpTotalZiua] = useState(0);

  const [formData, setFormData] = useState({
    sarcina_id: '',
    data_lucru: new Date().toISOString().split('T')[0], // Data curentă
    ore_lucrate: '',
    descriere_lucru: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const resetForm = () => {
    setFormData({
      sarcina_id: '',
      data_lucru: new Date().toISOString().split('T')[0],
      ore_lucrate: '',
      descriere_lucru: ''
    });
    setErrors({});
    setTimpTotalZiua(0);
  };

  // Verifică total ore pe zi când se schimbă data
  useEffect(() => {
    if (formData.data_lucru && utilizatorCurent) {
      verificaTotalOreZiua();
    }
  }, [formData.data_lucru, utilizatorCurent]);

  const verificaTotalOreZiua = async () => {
    if (!utilizatorCurent || !formData.data_lucru) return;

    setLoadingValidari(true);
    try {
      const response = await fetch(`/api/user/timetracking?utilizator_uid=${utilizatorCurent.uid}&data_lucru=${formData.data_lucru}&validare_limita=true`);
      const data = await response.json();

      if (data.success) {
        const totalOre = data.total_ore_ziua || 0;
        setTimpTotalZiua(totalOre);

        if (totalOre >= 8) {
          setErrors(prev => ({
            ...prev,
            ore_lucrate: `Ai deja ${totalOre}h înregistrate pentru această zi. Limita zilnică: 8h`
          }));
        } else {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.ore_lucrate;
            return newErrors;
          });
        }
      }
    } catch (error) {
      console.error('Eroare la verificarea timpului zilnic:', error);
    } finally {
      setLoadingValidari(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validări în timp real
    if (field === 'ore_lucrate') {
      validateOre(value);
    }

    // Șterge eroarea pentru câmpul curent
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateOre = (value: string) => {
    const ore = parseFloat(value);

    if (isNaN(ore) || ore <= 0) {
      setErrors(prev => ({
        ...prev,
        ore_lucrate: 'Orele trebuie să fie un număr pozitiv'
      }));
      return false;
    }

    if (ore > 16) {
      setErrors(prev => ({
        ...prev,
        ore_lucrate: 'Maxim 16 ore pe înregistrare'
      }));
      return false;
    }

    const totalCuNoua = timpTotalZiua + ore;
    if (totalCuNoua > 16) {
      setErrors(prev => ({
        ...prev,
        ore_lucrate: `Total zilnic ar fi ${totalCuNoua.toFixed(1)}h. Limita zilnică: 16h`
      }));
      return false;
    }

    if (totalCuNoua > 8) {
      // Avertisment, nu eroare
      setErrors(prev => ({
        ...prev,
        ore_lucrate: `Avertisment: Total zilnic va fi ${totalCuNoua.toFixed(1)}h (peste 8h normale)`
      }));
    }

    return true;
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.sarcina_id) {
      newErrors.sarcina_id = 'Selectează o sarcină';
    }

    if (!formData.data_lucru) {
      newErrors.data_lucru = 'Data lucrului este obligatorie';
    }

    if (!formData.ore_lucrate) {
      newErrors.ore_lucrate = 'Orele lucrate sunt obligatorii';
    } else if (!validateOre(formData.ore_lucrate)) {
      // Validarea orelor setează deja eroarea
    }

    if (!formData.descriere_lucru.trim()) {
      newErrors.descriere_lucru = 'Descrierea lucrului este obligatorie';
    }

    // Verifică dacă data nu este în viitor
    const dataLucru = new Date(formData.data_lucru);
    const astazi = new Date();
    astazi.setHours(23, 59, 59, 999); // Sfârșitul zilei de astăzi

    if (dataLucru > astazi) {
      newErrors.data_lucru = 'Data lucrului nu poate fi în viitor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!utilizatorCurent) {
      showToast('Nu s-au putut prelua datele utilizatorului curent', 'error');
      return;
    }

    if (!validateForm()) {
      showToast('Corectează erorile din formular', 'error');
      return;
    }

    setLoading(true);

    try {
      // Găsește titlul sarcinii
      const sarcinaSelectata = sarcini.find(s => s.id === formData.sarcina_id);

      const timeData = {
        id: `TIME_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sarcina_id: formData.sarcina_id,
        utilizator_uid: utilizatorCurent.uid,
        utilizator_nume: utilizatorCurent.nume_complet,
        data_lucru: formData.data_lucru,
        ore_lucrate: parseFloat(formData.ore_lucrate),
        descriere_lucru: formData.descriere_lucru.trim(),
        tip_inregistrare: 'manual',
        sarcina_titlu: sarcinaSelectata?.titlu || 'Sarcină necunoscută'
      };

      console.log('Înregistrez timp:', timeData);

      const response = await fetch('/api/user/timetracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timeData)
      });

      const result = await response.json();

      if (result.success) {
        showToast('Timp înregistrat cu succes!', 'success');
        onTimeAdded();
        resetForm();
      } else {
        showToast(result.error || 'Eroare la înregistrarea timpului', 'error');
      }
    } catch (error) {
      console.error('Eroare la înregistrarea timpului:', error);
      showToast('Eroare la înregistrarea timpului', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSarcinaStatus = (status: string) => {
    switch (status) {
      case 'În lucru': return { color: '#f39c12', icon: '🔄' };
      case 'De făcut': return { color: '#95a5a6', icon: '📋' };
      case 'În verificare': return { color: '#9b59b6', icon: '🔍' };
      case 'Finalizată': return { color: '#27ae60', icon: '✅' };
      default: return { color: '#7f8c8d', icon: '❓' };
    }
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
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: 'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                ⏱️ Înregistrare Timp
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                {proiect.tip === 'subproiect' ? 'Subproiect' : 'Proiect'}: {proiect.ID_Proiect} - {proiect.Denumire}
              </p>
              {utilizatorCurent && (
                <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                  Utilizator: {utilizatorCurent.nume_complet}
                </p>
              )}
            </div>
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
                color: 'white'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Info timp total ziua */}
          {timpTotalZiua > 0 && (
            <div style={{
              background: timpTotalZiua >= 8 ? '#f8d7da' : '#d4edda',
              border: `1px solid ${timpTotalZiua >= 8 ? '#f5c6cb' : '#c3e6cb'}`,
              color: timpTotalZiua >= 8 ? '#721c24' : '#155724',
              padding: '0.75rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '14px'
            }}>
              <strong>Timp înregistrat astăzi:</strong> {timpTotalZiua}h
              {timpTotalZiua >= 8 && ' - Limita zilnică atinsă!'}
              {loadingValidari && ' (Se verifică...)'}
            </div>
          )}

          {/* Sarcină */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Sarcină *
            </label>
            <select
              value={formData.sarcina_id}
              onChange={(e) => handleInputChange('sarcina_id', e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: errors.sarcina_id ? '2px solid #e74c3c' : '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Selectează sarcina...</option>
              {sarcini.map(sarcina => {
                const statusInfo = getSarcinaStatus(sarcina.status);
                return (
                  <option key={sarcina.id} value={sarcina.id}>
                    {statusInfo.icon} {sarcina.titlu} ({sarcina.status})
                  </option>
                );
              })}
            </select>
            {errors.sarcina_id && (
              <p style={{ margin: '0.25rem 0 0 0', color: '#e74c3c', fontSize: '12px' }}>
                {errors.sarcina_id}
              </p>
            )}
          </div>

          {/* Data lucru */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Data Lucru *
            </label>
            <input
              type="date"
              value={formData.data_lucru}
              onChange={(e) => handleInputChange('data_lucru', e.target.value)}
              disabled={loading}
              max={new Date().toISOString().split('T')[0]} // Nu permite date viitoare
              style={{
                width: '100%',
                padding: '0.75rem',
                border: errors.data_lucru ? '2px solid #e74c3c' : '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            {errors.data_lucru && (
              <p style={{ margin: '0.25rem 0 0 0', color: '#e74c3c', fontSize: '12px' }}>
                {errors.data_lucru}
              </p>
            )}
          </div>

          {/* Ore lucrate */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Ore Lucrate *
            </label>
            <input
              type="number"
              min="0.1"
              max="16"
              step="0.1"
              value={formData.ore_lucrate}
              onChange={(e) => handleInputChange('ore_lucrate', e.target.value)}
              disabled={loading}
              placeholder="Ex: 2.5"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: errors.ore_lucrate ? '2px solid #e74c3c' : '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            {errors.ore_lucrate && (
              <p style={{
                margin: '0.25rem 0 0 0',
                color: errors.ore_lucrate.includes('Avertisment') ? '#f39c12' : '#e74c3c',
                fontSize: '12px'
              }}>
                {errors.ore_lucrate}
              </p>
            )}
            <p style={{ margin: '0.25rem 0 0 0', color: '#7f8c8d', fontSize: '12px' }}>
              Limita normală: 8h/zi • Limita maximă: 16h/zi
            </p>
          </div>

          {/* Descriere lucru */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Descriere Lucru *
            </label>
            <textarea
              value={formData.descriere_lucru}
              onChange={(e) => handleInputChange('descriere_lucru', e.target.value)}
              disabled={loading}
              placeholder="Descrie activitatea desfășurată..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: errors.descriere_lucru ? '2px solid #e74c3c' : '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
            {errors.descriere_lucru && (
              <p style={{ margin: '0.25rem 0 0 0', color: '#e74c3c', fontSize: '12px' }}>
                {errors.descriere_lucru}
              </p>
            )}
          </div>

          {/* Butoane */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #dee2e6' }}>
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
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Anulează
            </button>

            <button
              type="submit"
              disabled={loading || Object.keys(errors).length > 0 || loadingValidari}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || Object.keys(errors).length > 0 || loadingValidari ? '#bdc3c7' : '#f39c12',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || Object.keys(errors).length > 0 || loadingValidari ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Se înregistrează...' : 'Înregistrează Timp'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}