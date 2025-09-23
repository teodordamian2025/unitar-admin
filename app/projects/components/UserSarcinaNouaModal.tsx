// ==================================================================
// CALEA: app/projects/components/UserSarcinaNouaModal.tsx
// DATA: 23.09.2025 18:35 (ora României)
// DESCRIERE: Modal pentru sarcină nouă utilizatori normali - IDENTIC cu admin
// FUNCȚIONALITATE: Creare sarcină cu sincronizare progres/status și responsabili
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface UserSarcinaNouaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSarcinaAdded: () => void;
  proiect: {
    ID_Proiect: string;
    Denumire: string;
    tip?: 'proiect' | 'subproiect';
  };
  utilizatorCurent: {
    uid: string;
    nume_complet: string;
  } | null;
}

interface ResponsabilSelectat {
  uid: string;
  nume_complet: string;
  email: string;
  rol_in_sarcina: string;
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

export default function UserSarcinaNouaModal({
  isOpen,
  onClose,
  onSarcinaAdded,
  proiect,
  utilizatorCurent
}: UserSarcinaNouaModalProps) {
  const [loading, setLoading] = useState(false);
  const [responsabiliSelectati, setResponsabiliSelectati] = useState<ResponsabilSelectat[]>([]);

  const [formData, setFormData] = useState({
    titlu: '',
    descriere: '',
    prioritate: 'Medie',
    status: 'De făcut',
    data_scadenta: '',
    observatii: '',
    timp_estimat_zile: '',
    timp_estimat_ore: '',
    progres_procent: '0',
    progres_descriere: ''
  });

  const [timpTotalOre, setTimpTotalOre] = useState(0);

  const resetForm = () => {
    setFormData({
      titlu: '',
      descriere: '',
      prioritate: 'Medie',
      status: 'De făcut',
      data_scadenta: '',
      observatii: '',
      timp_estimat_zile: '',
      timp_estimat_ore: '',
      progres_procent: '0',
      progres_descriere: ''
    });
    setResponsabiliSelectati([]);
    setTimpTotalOre(0);
  };

  // Calculează timpul total când se schimbă zilele sau orele
  useEffect(() => {
    const zile = parseInt(formData.timp_estimat_zile) || 0;
    const ore = parseFloat(formData.timp_estimat_ore) || 0;

    const zileInput = formData.timp_estimat_zile;
    if (zileInput && zileInput.includes('.')) {
      setTimpTotalOre(0);
    } else {
      setTimpTotalOre((zile * 8) + ore);
    }
  }, [formData.timp_estimat_zile, formData.timp_estimat_ore]);

  // Auto-adaugă utilizatorul curent ca responsabil principal la deschidere
  useEffect(() => {
    if (isOpen && utilizatorCurent && responsabiliSelectati.length === 0) {
      const responsabilPrincipal: ResponsabilSelectat = {
        uid: utilizatorCurent.uid,
        nume_complet: utilizatorCurent.nume_complet,
        email: utilizatorCurent.uid, // folosim uid ca placeholder pentru email
        rol_in_sarcina: 'Principal'
      };
      setResponsabiliSelectati([responsabilPrincipal]);
    }
  }, [isOpen, utilizatorCurent]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Funcție pentru sincronizarea status/progres în timp real - STATUS
  const handleStatusChangeNou = (newStatus: string) => {
    setFormData(prev => {
      const updated = { ...prev, status: newStatus };

      if (newStatus === 'Finalizată') {
        updated.progres_procent = '100';
        updated.progres_descriere = updated.progres_descriere || 'Sarcină finalizată manual - progres setat la 100%';
        showToast('Status finalizat - progresul va fi setat automat la 100%', 'info');
      }

      return updated;
    });
  };

  // Funcție pentru sincronizarea progres/status în timp real - PROGRES
  const handleProgresChangeNou = (newProgres: string) => {
    const progresNumeric = parseInt(newProgres) || 0;

    setFormData(prev => {
      const updated = { ...prev, progres_procent: newProgres };

      if (progresNumeric === 100) {
        updated.status = 'Finalizată';
        updated.progres_descriere = updated.progres_descriere || 'Sarcină finalizată automat la 100% progres';
        showToast('Progres 100% - sarcina va fi marcată automat ca finalizată', 'info');
      }

      return updated;
    });
  };

  const getProgressColor = (procent: number) => {
    if (procent < 25) return '#e74c3c';
    if (procent < 75) return '#f39c12';
    return '#27ae60';
  };

  // Validări pentru timp estimat
  const validateTimpEstimat = () => {
    const zileString = formData.timp_estimat_zile;
    const oreString = formData.timp_estimat_ore;

    if (zileString && zileString.includes('.')) {
      showToast('Zilele trebuie să fie numere întregi (ex: 1, 2, 3), nu zecimale!', 'error');
      return false;
    }

    const zile = parseInt(zileString) || 0;
    const ore = parseFloat(oreString) || 0;

    if (zile < 0) {
      showToast('Zilele estimate nu pot fi negative', 'error');
      return false;
    }

    if (!Number.isInteger(zile)) {
      showToast('Zilele trebuie să fie numere întregi (0, 1, 2, 3...)', 'error');
      return false;
    }

    if (ore < 0 || ore >= 8) {
      showToast('Orele estimate trebuie să fie între 0 și 7.9', 'error');
      return false;
    }

    if (zile === 0 && ore === 0) {
      showToast('Specifică cel puțin o estimare de timp (zile sau ore)', 'error');
      return false;
    }

    return true;
  };

  // Validări pentru progres
  const validateProgres = () => {
    const procent = parseInt(formData.progres_procent) || 0;

    if (procent < 0 || procent > 100) {
      showToast('Progresul trebuie să fie între 0 și 100 procente', 'error');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!utilizatorCurent) {
      showToast('Nu s-au putut prelua datele utilizatorului curent', 'error');
      return;
    }

    // Validări
    if (!formData.titlu.trim()) {
      showToast('Titlul sarcinii este obligatoriu', 'error');
      return;
    }

    if (responsabiliSelectati.length === 0) {
      showToast('Cel puțin un responsabil este obligatoriu', 'error');
      return;
    }

    const responsabilPrincipal = responsabiliSelectati.find(r => r.rol_in_sarcina === 'Principal');
    if (!responsabilPrincipal) {
      showToast('Cel puțin un responsabil trebuie să aibă rolul "Principal"', 'error');
      return;
    }

    if (!validateTimpEstimat()) {
      return;
    }

    if (!validateProgres()) {
      return;
    }

    setLoading(true);

    try {
      const sarcinaData = {
        id: `TASK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        proiect_id: proiect.ID_Proiect,
        tip_proiect: proiect.tip || 'proiect',
        titlu: formData.titlu.trim(),
        descriere: formData.descriere.trim() || null,
        prioritate: formData.prioritate,
        status: formData.status,
        progres_procent: parseInt(formData.progres_procent) || 0,
        progres_descriere: formData.progres_descriere.trim() || null,
        data_scadenta: formData.data_scadenta || null,
        observatii: formData.observatii.trim() || null,
        created_by: utilizatorCurent.uid,
        timp_estimat_zile: parseInt(formData.timp_estimat_zile) || 0,
        timp_estimat_ore: parseFloat(formData.timp_estimat_ore) || 0,
        responsabili: responsabiliSelectati.map(r => ({
          uid: r.uid,
          nume_complet: r.nume_complet,
          rol: r.rol_in_sarcina
        }))
      };

      console.log('Creez sarcină cu progres sincronizat:', sarcinaData);

      const response = await fetch('/api/user/sarcini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sarcinaData)
      });

      const result = await response.json();

      if (result.success) {
        const statusText = formData.status === 'Finalizată' ? ' (FINALIZATĂ)' : '';
        const progresText = formData.progres_procent === '100' ? ' cu progres 100%' : ` cu progres ${formData.progres_procent}%`;
        showToast(`Sarcină creată cu succes${statusText}${progresText}!`, 'success');
        onSarcinaAdded();
        resetForm();
      } else {
        showToast(result.error || 'Eroare la crearea sarcinii', 'error');
      }
    } catch (error) {
      console.error('Eroare la crearea sarcinii:', error);
      showToast('Eroare la crearea sarcinii', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const progresProcent = parseInt(formData.progres_procent) || 0;
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
        maxWidth: '900px',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                Sarcină Nouă
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                {proiect.tip === 'subproiect' ? 'Subproiect' : 'Proiect'}: {proiect.ID_Proiect} - {proiect.Denumire}
              </p>
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
          {/* Informații de bază */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.1rem' }}>
              Informații Sarcină
            </h3>

            {/* Titlu */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Titlu Sarcină *
              </label>
              <input
                type="text"
                value={formData.titlu}
                onChange={(e) => handleInputChange('titlu', e.target.value)}
                disabled={loading}
                placeholder="Ex: Implementare funcționalitate login"
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
                value={formData.descriere}
                onChange={(e) => handleInputChange('descriere', e.target.value)}
                disabled={loading}
                placeholder="Descrierea detaliată a sarcinii..."
                rows={4}
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

            {/* Grid pentru prioritate, status, data cu sincronizare */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Prioritate
                </label>
                <select
                  value={formData.prioritate}
                  onChange={(e) => handleInputChange('prioritate', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="Scăzută">Scăzută</option>
                  <option value="Medie">Medie</option>
                  <option value="Înaltă">Înaltă</option>
                  <option value="Critică">Critică</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleStatusChangeNou(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: formData.status === 'Finalizată' ? '#d4edda' : 'white'
                  }}
                >
                  <option value="De făcut">De făcut</option>
                  <option value="În lucru">În lucru</option>
                  <option value="În verificare">În verificare</option>
                  <option value="Finalizată">Finalizată</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Data Scadență
                </label>
                <input
                  type="date"
                  value={formData.data_scadenta}
                  onChange={(e) => handleInputChange('data_scadenta', e.target.value)}
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
            </div>

            {/* Alert pentru sincronizarea automată */}
            {(progresProcent === 100 || formData.status === 'Finalizată') && (
              <div style={{
                background: '#d1ecf1',
                border: '1px solid #bee5eb',
                color: '#0c5460',
                padding: '0.75rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '13px'
              }}>
                <strong>Sincronizare activă:</strong> {
                  progresProcent === 100
                    ? 'Progres 100% va seta statusul automat la "Finalizată"'
                    : 'Status "Finalizată" va seta progresul automat la 100%'
                }
              </div>
            )}
          </div>

          {/* Secțiune Progres cu sincronizare */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.1rem' }}>
              Progres Sarcină
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr auto',
              gap: '1rem',
              alignItems: 'end',
              marginBottom: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Progres %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.progres_procent}
                  onChange={(e) => handleProgresChangeNou(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: progresProcent === 100 ? '#d4edda' : 'white'
                  }}
                />
              </div>

              <div style={{ paddingBottom: '0.75rem' }}>
                <div style={{
                  width: '100%',
                  height: '12px',
                  background: '#ecf0f1',
                  borderRadius: '6px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(100, progresProcent))}%`,
                    height: '100%',
                    background: getProgressColor(progresProcent),
                    transition: 'width 0.3s ease, background-color 0.3s ease'
                  }} />
                </div>
              </div>

              <div style={{
                paddingBottom: '0.75rem',
                fontSize: '16px',
                fontWeight: 'bold',
                color: getProgressColor(progresProcent),
                minWidth: '60px',
                textAlign: 'center'
              }}>
                {progresProcent}%
              </div>
            </div>

            {/* Descriere progres */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Descriere Progres
              </label>
              <textarea
                value={formData.progres_descriere}
                onChange={(e) => handleInputChange('progres_descriere', e.target.value)}
                disabled={loading}
                placeholder="Descrierea progresului actual..."
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
          </div>

          {/* Timp Estimat */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.1rem' }}>
              Timp Estimat
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: '1rem',
              alignItems: 'end',
              marginBottom: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Zile (întregi)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.timp_estimat_zile}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value.includes('.')) {
                      handleInputChange('timp_estimat_zile', value);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === '.' || e.key === ',') {
                      e.preventDefault();
                    }
                  }}
                  disabled={loading}
                  placeholder="Ex: 3"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: formData.timp_estimat_zile?.includes('.') ?
                      '2px solid #e74c3c' : '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Ore (0-7.9)
                </label>
                <input
                  type="number"
                  min="0"
                  max="7.9"
                  step="0.1"
                  value={formData.timp_estimat_ore}
                  onChange={(e) => handleInputChange('timp_estimat_ore', e.target.value)}
                  disabled={loading}
                  placeholder="Ex: 4.5"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{
                background: '#f39c12',
                color: 'white',
                padding: '0.75rem',
                borderRadius: '6px',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                minWidth: '80px',
                marginBottom: '0.75rem'
              }}>
                {timpTotalOre.toFixed(1)}h
              </div>
            </div>
          </div>

          {/* Observații */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații
            </label>
            <input
              type="text"
              value={formData.observatii}
              onChange={(e) => handleInputChange('observatii', e.target.value)}
              disabled={loading}
              placeholder="Observații suplimentare..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Responsabili */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.1rem' }}>
              Responsabili
            </h3>

            {responsabiliSelectati.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {responsabiliSelectati.map(responsabil => (
                  <div key={responsabil.uid} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }}>
                    <div>
                      <strong>{responsabil.nume_complet}</strong>
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        background: responsabil.rol_in_sarcina === 'Principal' ? '#27ae60' : '#3498db',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {responsabil.rol_in_sarcina}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
              disabled={loading || !formData.titlu.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || !formData.titlu.trim() ? '#bdc3c7' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !formData.titlu.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Se creează...' : 'Creează Sarcina'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}