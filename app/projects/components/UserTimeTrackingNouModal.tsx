// ==================================================================
// CALEA: app/projects/components/UserTimeTrackingNouModal.tsx
// DATA: 25.09.2025 18:30 (ora României) - ACTUALIZAT CU OBJECTIVESELECTOR
// DESCRIERE: Modal pentru înregistrare timp cu selector ierarhic obiective
// FUNCȚIONALITATE: Permite înregistrarea pe Proiect/Subproiect/Sarcină
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ObjectiveSelector from '@/app/components/user/ObjectiveSelector';

interface SelectedObjective {
  tip: 'proiect' | 'subproiect' | 'sarcina';
  proiect_id: string;
  proiect_nume: string;
  subproiect_id?: string;
  subproiect_nume?: string;
  sarcina_id?: string;
  sarcina_nume?: string;
}

interface ProiectData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  tip?: 'proiect' | 'subproiect';
}

interface UserTimeTrackingNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeAdded: () => void;
  proiect: ProiectData; // Proiectul curent din care s-a deschis modalul
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
  utilizatorCurent
}: UserTimeTrackingNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<SelectedObjective | null>(null);
  const [availableSubprojecte, setAvailableSubprojecte] = useState<any[]>([]);
  const [availableSarcini, setAvailableSarcini] = useState<any[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<'proiect' | 'subproiect' | 'sarcina'>('proiect');
  const [loadingValidari, setLoadingValidari] = useState(false);
  const [timpTotalZiua, setTimpTotalZiua] = useState(0);

  const [formData, setFormData] = useState({
    data_lucru: new Date().toISOString().split('T')[0],
    ore_lucrate: '',
    descriere_lucru: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const resetForm = () => {
    setFormData({
      data_lucru: new Date().toISOString().split('T')[0],
      ore_lucrate: '',
      descriere_lucru: ''
    });
    setSelectedObjective(null);
    setErrors({});
  };

  // Verifică total ore pe zi când se schimbă data
  // Pre-setează obiectivul cu proiectul curent la deschidere
  useEffect(() => {
    if (proiect && isOpen) {
      const initialObjective: SelectedObjective = {
        tip: proiect.tip || 'proiect',
        proiect_id: proiect.ID_Proiect,
        proiect_nume: proiect.Denumire
      };
      setSelectedObjective(initialObjective);
      loadSubproiecteAndSarcini();
    }
  }, [proiect, isOpen]);

  // Verifică total ore pe zi când se schimbă data
  useEffect(() => {
    if (formData.data_lucru && utilizatorCurent) {
      verificaTotalOreZiua();
    }
  }, [formData.data_lucru, utilizatorCurent]);

  const loadSubproiecteAndSarcini = async () => {
    if (!utilizatorCurent || !proiect) return;

    try {
      // Încarcă obiectivele pentru proiectul curent
      const response = await fetch(`/api/user/objectives?user_id=${utilizatorCurent.uid}`);
      const data = await response.json();

      if (data.success) {
        const objectives = data.objectives;

        // Filtrează doar obiectivele pentru proiectul curent
        const currentProjectSubproiecte = objectives.proiecte?.find(p => p.id === proiect.ID_Proiect)?.subproiecte || [];
        const currentProjectSarcini = objectives.proiecte?.find(p => p.id === proiect.ID_Proiect)?.sarcini || [];

        setAvailableSubprojecte(currentProjectSubproiecte);
        setAvailableSarcini(currentProjectSarcini);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor și sarcinilor:', error);
    }
  };

  const verificaTotalOreZiua = async () => {
    if (!utilizatorCurent || !formData.data_lucru) return;

    setLoadingValidari(true);
    try {
      const response = await fetch(`/api/user/timetracking?user_id=${utilizatorCurent.uid}&start_date=${formData.data_lucru}&end_date=${formData.data_lucru}`);
      const data = await response.json();

      if (data.success) {
        const totalOre = data.data?.reduce((sum: number, record: any) => sum + (record.ore_lucrate || 0), 0) || 0;
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
    // Nu validez dacă câmpul este gol - să permită utilizatorului să înceapă să tasteze
    if (!value || value.trim() === '') {
      return true; // Permitem câmpuri goale în timpul editării
    }

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

    if (!selectedObjective) {
      newErrors.selectedObjective = 'Selectează un obiectiv (proiect, subproiect sau sarcină)';
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
      // Convertesc ore în minute pentru API
      const durationMinutes = parseFloat(formData.ore_lucrate) * 60;

      const timeData = {
        user_id: utilizatorCurent.uid,
        proiect_id: selectedObjective!.proiect_id,
        subproiect_id: selectedObjective!.subproiect_id || null,
        sarcina_id: selectedObjective!.sarcina_id || null,
        task_description: formData.descriere_lucru.trim(),
        data_lucru: formData.data_lucru,
        duration_minutes: durationMinutes
      };

      console.log('Înregistrez timp cu obiectiv ierarhic:', timeData);

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
        onClose();
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
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                ⏱️ Înregistrare Timp Ierarhic
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                Alege nivelul și obiectivul pentru înregistrarea timpului
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

          {/* Context Proiect + Selector Nivel */}
          <div style={{ marginBottom: '1rem' }}>
            {/* Afișare Proiect Curent */}
            <div style={{
              padding: '1rem',
              background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
              borderRadius: '12px',
              marginBottom: '1rem'
            }}>
              <div style={{ color: 'white', fontSize: '14px', opacity: 0.9 }}>Înregistrezi timp pentru:</div>
              <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                📂 {proiect.Denumire}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                {proiect.tip === 'subproiect' ? 'Subproiect' : 'Proiect'} • {proiect.Status}
              </div>
            </div>

            {/* Selector Nivel */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                Nivel înregistrare:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLevel('proiect');
                    setSelectedObjective({
                      tip: 'proiect',
                      proiect_id: proiect.ID_Proiect,
                      proiect_nume: proiect.Denumire
                    });
                  }}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: selectedLevel === 'proiect' ? '2px solid #3498db' : '1px solid #dee2e6',
                    background: selectedLevel === 'proiect' ? '#3498db' : 'white',
                    color: selectedLevel === 'proiect' ? 'white' : '#2c3e50',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📂 Direct pe Proiect
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLevel('subproiect')}
                  disabled={availableSubprojecte.length === 0}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: selectedLevel === 'subproiect' ? '2px solid #3498db' : '1px solid #dee2e6',
                    background: selectedLevel === 'subproiect' ? '#3498db' : (availableSubprojecte.length === 0 ? '#f8f9fa' : 'white'),
                    color: selectedLevel === 'subproiect' ? 'white' : (availableSubprojecte.length === 0 ? '#6c757d' : '#2c3e50'),
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: availableSubprojecte.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  📋 Pe Subproiect ({availableSubprojecte.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLevel('sarcina')}
                  disabled={availableSarcini.length === 0}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: selectedLevel === 'sarcina' ? '2px solid #3498db' : '1px solid #dee2e6',
                    background: selectedLevel === 'sarcina' ? '#3498db' : (availableSarcini.length === 0 ? '#f8f9fa' : 'white'),
                    color: selectedLevel === 'sarcina' ? 'white' : (availableSarcini.length === 0 ? '#6c757d' : '#2c3e50'),
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: availableSarcini.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✅ Pe Sarcină ({availableSarcini.length})
                </button>
              </div>
            </div>

            {/* Selector Subproiect dacă este cazul */}
            {selectedLevel === 'subproiect' && availableSubprojecte.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Subproiect:
                </label>
                <select
                  onChange={(e) => {
                    const subproiect = availableSubprojecte.find(sp => sp.id === e.target.value);
                    if (subproiect) {
                      setSelectedObjective({
                        tip: 'subproiect',
                        proiect_id: proiect.ID_Proiect,
                        proiect_nume: proiect.Denumire,
                        subproiect_id: subproiect.id,
                        subproiect_nume: subproiect.nume
                      });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Alege subproiectul...</option>
                  {availableSubprojecte.map((subproiect) => (
                    <option key={subproiect.id} value={subproiect.id}>
                      📋 {subproiect.nume} ({subproiect.status || 'Activ'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Selector Sarcină dacă este cazul */}
            {selectedLevel === 'sarcina' && availableSarcini.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  Sarcină:
                </label>
                <select
                  onChange={(e) => {
                    const sarcina = availableSarcini.find(s => s.id === e.target.value);
                    if (sarcina) {
                      setSelectedObjective({
                        tip: 'sarcina',
                        proiect_id: proiect.ID_Proiect,
                        proiect_nume: proiect.Denumire,
                        sarcina_id: sarcina.id,
                        sarcina_nume: sarcina.nume
                      });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Alege sarcina...</option>
                  {availableSarcini.map((sarcina) => (
                    <option key={sarcina.id} value={sarcina.id}>
                      ✅ {sarcina.nume} ({sarcina.prioritate || 'Normal'})
                    </option>
                  ))}
                </select>
              </div>
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
              disabled={loading || Object.keys(errors).length > 0 || loadingValidari || !selectedObjective}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || Object.keys(errors).length > 0 || loadingValidari || !selectedObjective ? '#bdc3c7' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || Object.keys(errors).length > 0 || loadingValidari || !selectedObjective ? 'not-allowed' : 'pointer',
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