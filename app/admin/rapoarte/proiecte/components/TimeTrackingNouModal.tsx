// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/TimeTrackingNouModal.tsx
// DATA: 24.08.2025 16:30 (ora României)
// MODIFICAT: Corectare poziționare modal cu createPortal
// PĂSTRATE: Toate funcționalitățile existente cu validări timp
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TimeTrackingNouModalProps {
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

// Toast system cu z-index crescut pentru a fi deasupra modalului
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

export default function TimeTrackingNouModal({ 
  isOpen, 
  onClose, 
  onTimeAdded, 
  proiect,
  sarcini,
  utilizatorCurent 
}: TimeTrackingNouModalProps) {
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
      const response = await fetch(`/api/rapoarte/timetracking?utilizator_uid=${utilizatorCurent.uid}&data_lucru=${formData.data_lucru}&validare_limita=true`);
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

    // Sarcina este opțională - se poate înregistra timp direct pe proiect/subproiect

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
      // Găsește titlul sarcinii dacă este selectată
      const sarcinaSelectata = formData.sarcina_id ? sarcini.find(s => s.id === formData.sarcina_id) : null;

      const timeData = {
        id: `TIME_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sarcina_id: formData.sarcina_id || null, // Poate fi null pentru timp direct pe proiect
        utilizator_uid: utilizatorCurent.uid,
        utilizator_nume: utilizatorCurent.nume_complet,
        data_lucru: formData.data_lucru,
        ore_lucrate: parseFloat(formData.ore_lucrate),
        descriere_lucru: formData.descriere_lucru.trim(),
        tip_inregistrare: 'manual',
        // Pentru API TimeTracking trebuie să adăugăm proiect_id
        proiect_id: proiect.tip === 'subproiect' ? null : proiect.ID_Proiect,
        subproiect_id: proiect.tip === 'subproiect' ? proiect.ID_Proiect : null,
        sarcina_titlu: sarcinaSelectata?.titlu || (proiect.tip === 'subproiect' ?
          `Direct pe subproiect: ${proiect.Denumire}` :
          `Direct pe proiect: ${proiect.Denumire}`)
      };

      console.log('Înregistrez timp:', timeData);

      const response = await fetch('/api/rapoarte/timetracking', {
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
          {/* Informații context timp zilnic */}
          {formData.data_lucru && utilizatorCurent && (
            <div style={{
              background: timpTotalZiua >= 8 ? 'rgba(231, 76, 60, 0.1)' : 'rgba(52, 152, 219, 0.1)',
              border: `1px solid ${timpTotalZiua >= 8 ? '#e74c3c' : '#3498db'}`,
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '18px' }}>
                  {timpTotalZiua >= 8 ? '⚠️' : 'ℹ️'}
                </span>
                <strong style={{ color: timpTotalZiua >= 8 ? '#e74c3c' : '#3498db' }}>
                  Timp înregistrat pentru {formData.data_lucru}
                </strong>
                {loadingValidari && <span style={{ color: '#f39c12' }}>⏳</span>}
              </div>
              <div style={{ fontSize: '14px', color: '#2c3e50' }}>
                Total ore: <strong>{timpTotalZiua.toFixed(1)}h</strong>
                {timpTotalZiua >= 8 && (
                  <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}>
                    (Peste limita normală de 8h)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Selectare sarcină */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Sarcină (opțională)
            </label>
            {sarcini.length === 0 ? (
              <div style={{
                padding: '1rem',
                background: '#f8f9fa',
                border: '2px dashed #dee2e6',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#7f8c8d'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '0.5rem' }}>📋</div>
                <div>Nu există sarcini disponibile pentru acest proiect</div>
                <div style={{ fontSize: '12px', marginTop: '0.5rem' }}>
                  Adaugă mai întâi o sarcină în tab-ul "Sarcini"
                </div>
              </div>
            ) : (
              <select
                value={formData.sarcina_id}
                onChange={(e) => handleInputChange('sarcina_id', e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.sarcina_id ? '#e74c3c' : '#dee2e6'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: loading ? '#f8f9fa' : 'white'
                }}
              >
                <option value="">📂 Direct pe {proiect.tip === 'subproiect' ? 'subproiect' : 'proiect'} (fără sarcină specifică)</option>
                {sarcini.map(sarcina => {
                  const statusInfo = getSarcinaStatus(sarcina.status);
                  return (
                    <option key={sarcina.id} value={sarcina.id}>
                      {statusInfo.icon} {sarcina.titlu} ({sarcina.status})
                    </option>
                  );
                })}
              </select>
            )}
            {errors.sarcina_id && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                {errors.sarcina_id}
              </div>
            )}
          </div>

          {/* Data și ore - grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Data Lucrului *
              </label>
              <input
                type="date"
                value={formData.data_lucru}
                onChange={(e) => handleInputChange('data_lucru', e.target.value)}
                disabled={loading}
                max={new Date().toISOString().split('T')[0]} // Nu poate fi în viitor
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.data_lucru ? '#e74c3c' : '#dee2e6'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: loading ? '#f8f9fa' : 'white'
                }}
              />
              {errors.data_lucru && (
                <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                  {errors.data_lucru}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Ore Lucrate *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="16"
                value={formData.ore_lucrate}
                onChange={(e) => handleInputChange('ore_lucrate', e.target.value)}
                disabled={loading}
                placeholder="Ex: 2.5"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${errors.ore_lucrate ? '#e74c3c' : '#dee2e6'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: loading ? '#f8f9fa' : 'white'
                }}
              />
              {errors.ore_lucrate && (
                <div style={{ 
                  color: errors.ore_lucrate.includes('Avertisment') ? '#f39c12' : '#e74c3c', 
                  fontSize: '12px', 
                  marginTop: '0.25rem' 
                }}>
                  {errors.ore_lucrate}
                </div>
              )}
            </div>
          </div>

          {/* Descrierea lucrului */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Descrierea Lucrului *
            </label>
            <textarea
              value={formData.descriere_lucru}
              onChange={(e) => handleInputChange('descriere_lucru', e.target.value)}
              disabled={loading}
              placeholder="Descriere detaliată a activității desfășurate..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${errors.descriere_lucru ? '#e74c3c' : '#dee2e6'}`,
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                backgroundColor: loading ? '#f8f9fa' : 'white'
              }}
            />
            {errors.descriere_lucru && (
              <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '0.25rem' }}>
                {errors.descriere_lucru}
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '0.25rem' }}>
              Exemple: "Implementat funcționalitatea de login", "Debug probleme cu API-ul", "Documentație tehnică"
            </div>
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
              disabled={loading || !utilizatorCurent || Object.keys(errors).some(key => !errors[key].includes('Avertisment'))}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || !utilizatorCurent || Object.keys(errors).some(key => !errors[key].includes('Avertisment')) ?
                  '#bdc3c7' : 'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !utilizatorCurent || Object.keys(errors).some(key => !errors[key].includes('Avertisment')) ?
                  'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ Se înregistrează...' : '💾 Înregistrează Timpul'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}
