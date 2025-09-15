import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import toast from 'react-hot-toast';

// ==================================================================
// CALEA: app/admin/analytics/components/QuickTimeEntryModal.tsx
// CREAT: 14.09.2025 14:00 (ora României)  
// DESCRIERE: Modal rapid pentru înregistrarea timpului lucrat cu timer live
// ==================================================================

interface QuickTimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedProiect?: string;
  preSelectedSarcina?: string;
  onTimeAdded?: () => void;
}

interface Proiect {
  ID_Proiect: string;
  Denumire: string;
  Status: string;
}

interface Sarcina {
  id: string;
  titlu: string;
  proiect_id: string;
  status: string;
  prioritate: string;
}

export default function QuickTimeEntryModal({ 
  isOpen, 
  onClose, 
  preSelectedProiect,
  preSelectedSarcina,
  onTimeAdded 
}: QuickTimeEntryModalProps) {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(false);
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [sarcini, setSarcini] = useState<Sarcina[]>([]);
  
  // Form state
  const [selectedProiect, setSelectedProiect] = useState(preSelectedProiect || '');
  const [selectedSarcina, setSelectedSarcina] = useState(preSelectedSarcina || '');
  const [dataLucru, setDataLucru] = useState(new Date().toISOString().split('T')[0]);
  const [oreLucrate, setOreLucrate] = useState('');
  const [descriereLucru, setDescriereLucru] = useState('');
  const [tipInregistrare, setTipInregistrare] = useState('manual');

  // Live timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchProiecte();
      // Reset form când se deschide modalul
      if (!preSelectedProiect) setSelectedProiect('');
      if (!preSelectedSarcina) setSelectedSarcina('');
      setOreLucrate('');
      setDescriereLucru('');
    }
  }, [isOpen, preSelectedProiect, preSelectedSarcina]);

  useEffect(() => {
    if (selectedProiect) {
      fetchSarcini(selectedProiect);
    } else {
      setSarcini([]);
      setSelectedSarcina('');
    }
  }, [selectedProiect]);

  // Timer logic pentru funcție live
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerStart) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - timerStart.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStart]);

  const fetchProiecte = async () => {
    try {
      const response = await fetch('/api/rapoarte/proiecte');
      if (response.ok) {
        const data = await response.json();
        // Filtrăm doar proiectele active
        const proiecteActive = data.data.filter((p: Proiect) => p.Status === 'Activ');
        setProiecte(proiecteActive);
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
    }
  };

  const fetchSarcini = async (proiectId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/sarcini?proiect_id=${proiectId}`);
      if (response.ok) {
        const data = await response.json();
        // Filtrăm sarcinile active și în progress
        const sarciniActive = data.data.filter((s: Sarcina) => 
          s.status === 'in_progress' || s.status === 'to_do'
        );
        setSarcini(sarciniActive);
      }
    } catch (error) {
      console.error('Eroare la încărcarea sarcinilor:', error);
    }
  };

  const handleStartTimer = () => {
    if (!selectedProiect || !selectedSarcina) {
      toast.error('Selectează proiectul și sarcina înainte de a începe timer-ul!');
      return;
    }

    setIsTimerRunning(true);
    setTimerStart(new Date());
    setElapsedTime(0);
    setTipInregistrare('live_timer');
    toast.success('Timer pornit! 🕒');
  };

  const handleStopTimer = () => {
    if (timerStart) {
      const totalSeconds = Math.floor((Date.now() - timerStart.getTime()) / 1000);
      const hours = (totalSeconds / 3600).toFixed(2);
      setOreLucrate(hours);
      setIsTimerRunning(false);
      setTimerStart(null);
      toast.success(`Timer oprit! ${hours} ore înregistrate.`);
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Nu ești autentificat!');
      return;
    }

    if (!selectedProiect || !selectedSarcina || !oreLucrate || !dataLucru) {
      toast.error('Completează toate câmpurile obligatorii!');
      return;
    }

    const oreNum = parseFloat(oreLucrate);
    if (isNaN(oreNum) || oreNum <= 0) {
      toast.error('Introdu un număr valid de ore!');
      return;
    }

    if (oreNum > 24) {
      toast.error('Nu poți lucra mai mult de 24 ore pe zi!');
      return;
    }

    setLoading(true);

    try {
      const timeEntryData = {
        sarcina_id: selectedSarcina,
        proiect_id: selectedProiect, // pentru denormalizare
        utilizator_uid: user.uid,
        utilizator_nume: user.displayName || user.email?.split('@')[0] || 'Utilizator',
        data_lucru: dataLucru,
        ore_lucrate: oreNum,
        descriere_lucru: descriereLucru,
        tip_inregistrare: tipInregistrare
      };

      const response = await fetch('/api/rapoarte/timetracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(timeEntryData),
      });

      if (response.ok) {
        toast.success('Timp înregistrat cu succes!');
        onClose();
        onTimeAdded?.(); // Callback pentru refresh date
        
        // Reset form
        setSelectedProiect(preSelectedProiect || '');
        setSelectedSarcina(preSelectedSarcina || '');
        setOreLucrate('');
        setDescriereLucru('');
        setElapsedTime(0);
        
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Eroare la înregistrarea timpului');
      }
      
    } catch (error) {
      console.error('Eroare:', error);
      toast.error('Eroare de conexiune');
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>
            ⏱️ Înregistrare Timp
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999'
            }}
          >
            ×
          </button>
        </div>

        {/* Live Timer Section */}
        <div style={{
          background: isTimerRunning ? '#e8f5e8' : '#f8f9fa',
          padding: '1rem',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          border: isTimerRunning ? '2px solid #28a745' : '1px solid #dee2e6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: isTimerRunning ? '#28a745' : '#666' }}>
                🕒 Live Timer: {formatElapsedTime(elapsedTime)}
              </strong>
              {isTimerRunning && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '0.25rem' }}>
                  Pornit la: {timerStart?.toLocaleTimeString()}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!isTimerRunning ? (
                <button
                  onClick={handleStartTimer}
                  disabled={!selectedProiect || !selectedSarcina}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: selectedProiect && selectedSarcina ? 'pointer' : 'not-allowed',
                    opacity: selectedProiect && selectedSarcina ? 1 : 0.5,
                    fontSize: '12px'
                  }}
                >
                  ▶️ Start
                </button>
              ) : (
                <button
                  onClick={handleStopTimer}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ⏹️ Stop
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div>
          {/* Proiect Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: 'bold',
              color: '#333'
            }}>
              Proiect *
            </label>
            <select
              value={selectedProiect}
              onChange={(e) => setSelectedProiect(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">Selectează proiectul...</option>
              {proiecte.map((proiect) => (
                <option key={proiect.ID_Proiect} value={proiect.ID_Proiect}>
                  {proiect.Denumire} ({proiect.Status})
                </option>
              ))}
            </select>
          </div>

          {/* Sarcina Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: 'bold',
              color: '#333'
            }}>
              Sarcina *
            </label>
            <select
              value={selectedSarcina}
              onChange={(e) => setSelectedSarcina(e.target.value)}
              required
              disabled={!selectedProiect}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                opacity: selectedProiect ? 1 : 0.5
              }}
            >
              <option value="">Selectează sarcina...</option>
              {sarcini.map((sarcina) => (
                <option key={sarcina.id} value={sarcina.id}>
                  {sarcina.titlu} ({sarcina.prioritate})
                </option>
              ))}
            </select>
          </div>

          {/* Data și Ore */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                Data Lucru *
              </label>
              <input
                type="date"
                value={dataLucru}
                onChange={(e) => setDataLucru(e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]} // Nu permite zile viitoare
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                Ore Lucrate *
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={oreLucrate}
                onChange={(e) => setOreLucrate(e.target.value)}
                placeholder="ex: 2.5"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Descriere */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: 'bold',
              color: '#333'
            }}>
              Descriere Activitate
            </label>
            <textarea
              value={descriereLucru}
              onChange={(e) => setDescriereLucru(e.target.value)}
              placeholder="Descrie pe scurt ce ai lucrat..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Tip înregistrare info */}
          <div style={{ 
            background: '#f8f9fa',
            padding: '0.75rem',
            borderRadius: '4px',
            marginBottom: '1.5rem',
            fontSize: '12px',
            color: '#666'
          }}>
            <strong>Tip înregistrare:</strong> {
              tipInregistrare === 'live_timer' ? '🔴 Timer Live' : '✍️ Intrare Manuală'
            }
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            justifyContent: 'flex-end' 
          }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Anulează
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={loading || isTimerRunning}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: loading ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || isTimerRunning ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: loading || isTimerRunning ? 0.7 : 1
              }}
            >
              {loading ? 'Se salvează...' : isTimerRunning ? 'Oprește timer-ul înainte' : '💾 Salvează'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
