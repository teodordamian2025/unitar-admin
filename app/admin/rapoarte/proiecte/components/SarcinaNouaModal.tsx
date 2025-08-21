// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SarcinaNouaModal.tsx
// DATA: 21.08.2025 02:10 (ora României)
// MODIFICAT: Adăugat timp estimat (zile + ore) cu validări și conversie automată
// PĂSTRATE: Toate funcționalitățile existente cu responsabili multipli
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import ResponsabilSearch from './ResponsabilSearch';

interface SarcinaNouaModalProps {
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
    z-index: 75000;
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

export default function SarcinaNouaModal({ 
  isOpen, 
  onClose, 
  onSarcinaAdded, 
  proiect,
  utilizatorCurent 
}: SarcinaNouaModalProps) {
  const [loading, setLoading] = useState(false);
  const [responsabiliSelectati, setResponsabiliSelectati] = useState<ResponsabilSelectat[]>([]);

  const [formData, setFormData] = useState({
    titlu: '',
    descriere: '',
    prioritate: 'Medie',
    status: 'De făcut',
    data_scadenta: '',
    observatii: '',
    // ADĂUGAT: Câmpuri pentru timp estimat
    timp_estimat_zile: '',
    timp_estimat_ore: ''
  });

  // ADĂUGAT: State pentru calculul timpului total
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
      timp_estimat_ore: ''
    });
    setResponsabiliSelectati([]);
    setTimpTotalOre(0);
  };

  // ADĂUGAT: Calculează timpul total când se schimbă zilele sau orele
  useEffect(() => {
    const zile = parseInt(formData.timp_estimat_zile) || 0;
    const ore = parseFloat(formData.timp_estimat_ore) || 0;
    setTimpTotalOre((zile * 8) + ore);
  }, [formData.timp_estimat_zile, formData.timp_estimat_ore]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResponsabilSelected = (responsabil: any) => {
    if (!responsabil) return;

    // Verifică dacă responsabilul este deja adăugat
    const existaResponsabil = responsabiliSelectati.find(r => r.uid === responsabil.uid);
    if (existaResponsabil) {
      showToast('Responsabilul este deja adăugat', 'error');
      return;
    }

    const nouResponsabil: ResponsabilSelectat = {
      uid: responsabil.uid,
      nume_complet: responsabil.nume_complet,
      email: responsabil.email,
      rol_in_sarcina: responsabiliSelectati.length === 0 ? 'Principal' : 'Colaborator'
    };

    setResponsabiliSelectati(prev => [...prev, nouResponsabil]);
    showToast(`Responsabil ${responsabil.nume_complet} adăugat`, 'success');
  };

  const removeResponsabil = (uid: string) => {
    setResponsabiliSelectati(prev => prev.filter(r => r.uid !== uid));
  };

  const updateRolResponsabil = (uid: string, nouRol: string) => {
    setResponsabiliSelectati(prev => 
      prev.map(r => r.uid === uid ? { ...r, rol_in_sarcina: nouRol } : r)
    );
  };

  // ADĂUGAT: Validări pentru timp estimat
  const validateTimpEstimat = () => {
    const zile = parseInt(formData.timp_estimat_zile) || 0;
    const ore = parseFloat(formData.timp_estimat_ore) || 0;

    if (zile < 0) {
      showToast('Zilele estimate nu pot fi negative', 'error');
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

    // Verifică dacă există un responsabil principal
    const responsabilPrincipal = responsabiliSelectati.find(r => r.rol_in_sarcina === 'Principal');
    if (!responsabilPrincipal) {
      showToast('Cel puțin un responsabil trebuie să aibă rolul "Principal"', 'error');
      return;
    }

    // ADĂUGAT: Validări timp estimat
    if (!validateTimpEstimat()) {
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
        data_scadenta: formData.data_scadenta || null,
        observatii: formData.observatii.trim() || null,
        created_by: utilizatorCurent.uid,
        // ADĂUGAT: Timp estimat
        timp_estimat_zile: parseInt(formData.timp_estimat_zile) || 0,
        timp_estimat_ore: parseFloat(formData.timp_estimat_ore) || 0,
        responsabili: responsabiliSelectati.map(r => ({
          uid: r.uid,
          nume_complet: r.nume_complet,
          rol: r.rol_in_sarcina
        }))
      };

      console.log('Creez sarcină cu timp estimat:', sarcinaData);

      const response = await fetch('/api/rapoarte/sarcini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sarcinaData)
      });

      const result = await response.json();

      if (result.success) {
        showToast(`Sarcină creată cu succes! Timp estimat: ${timpTotalOre.toFixed(1)}h`, 'success');
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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 60000,
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

            {/* Grid pentru prioritate, status, data */}
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
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
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
          </div>

          {/* ADĂUGAT: Secțiune Timp Estimat */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.1rem' }}>
              Timp Estimat *
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
                  Zile
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.timp_estimat_zile}
                  onChange={(e) => handleInputChange('timp_estimat_zile', e.target.value)}
                  disabled={loading}
                  placeholder="0"
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
                  placeholder="0"
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
                background: 'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)',
                color: 'white',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                textAlign: 'center',
                minWidth: '120px'
              }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {timpTotalOre.toFixed(1)}h
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  Total estimat
                </div>
              </div>
            </div>

            <div style={{ 
              fontSize: '12px', 
              color: '#7f8c8d',
              background: '#f8f9fa',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #dee2e6'
            }}>
              <strong>Explicație:</strong> 1 zi = 8 ore de lucru. Poți combina zile și ore (ex: 2 zile + 4 ore = 20 ore total).
              Orele suplimentare trebuie să fie sub 8 pentru a nu forma o zi completă.
            </div>
          </div>

          {/* Observații */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații
            </label>
            <textarea
              value={formData.observatii}
              onChange={(e) => handleInputChange('observatii', e.target.value)}
              disabled={loading}
              placeholder="Observații suplimentare..."
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

          {/* Responsabili */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.1rem' }}>
              Responsabili Sarcină *
            </h3>

            {/* Componenta de căutare */}
            <div style={{
              background: '#f8f9fa',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              marginBottom: '1rem'
            }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Adaugă Responsabil
              </label>
              <ResponsabilSearch
                onResponsabilSelected={handleResponsabilSelected}
                showInModal={true}
                disabled={loading}
                placeholder="Caută și selectează responsabili..."
              />
            </div>

            {/* Lista responsabili selectați */}
            {responsabiliSelectati.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>
                  Responsabili Selectați ({responsabiliSelectati.length})
                </h4>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {responsabiliSelectati.map((responsabil) => (
                    <div
                      key={responsabil.uid}
                      style={{
                        border: '1px solid #27ae60',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        background: 'rgba(39, 174, 96, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                          {responsabil.nume_complet}
                        </div>
                        <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                          {responsabil.email}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <select
                          value={responsabil.rol_in_sarcina}
                          onChange={(e) => updateRolResponsabil(responsabil.uid, e.target.value)}
                          disabled={loading}
                          style={{
                            padding: '0.5rem',
                            border: '1px solid #dee2e6',
                            borderRadius: '4px',
                            fontSize: '12px',
                            minWidth: '120px'
                          }}
                        >
                          <option value="Principal">Principal</option>
                          <option value="Colaborator">Colaborator</option>
                          <option value="Observer">Observer</option>
                        </select>
                        
                        <button
                          type="button"
                          onClick={() => removeResponsabil(responsabil.uid)}
                          disabled={loading}
                          style={{
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="Elimină responsabil"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {responsabiliSelectati.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#7f8c8d',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '0.5rem' }}>👥</div>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Nu sunt selectați responsabili. Caută și adaugă cel puțin un responsabil.
                </p>
              </div>
            )}
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
              disabled={loading || !formData.titlu.trim() || responsabiliSelectati.length === 0 || timpTotalOre === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || !formData.titlu.trim() || responsabiliSelectati.length === 0 || timpTotalOre === 0 ? 
                  '#bdc3c7' : 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !formData.titlu.trim() || responsabiliSelectati.length === 0 || timpTotalOre === 0 ? 
                  'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {loading ? '⏳ Se creează...' : '💾 Creează Sarcina'}
          </button>
        </div>
      </form>
    </div>
  </div>
);
}
