// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SarciniProiectModal.tsx
// DATA: 21.08.2025 01:40 (ora României)
// MODIFICAT: Fix utilizator curent real din Firebase Auth + BigQuery
// PĂSTRATE: Toate funcționalitățile existente + formatDate BigQuery compatibility
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ResponsabilSearch from './ResponsabilSearch';
import SarcinaNouaModal from './SarcinaNouaModal';
import TimeTrackingNouModal from './TimeTrackingNouModal';

interface SarciniProiectModalProps {
  isOpen: boolean;
  onClose: () => void;
  proiect: {
    ID_Proiect: string;
    Denumire: string;
    Client: string;
    Status: string;
    tip?: 'proiect' | 'subproiect';
  };
}

interface Sarcina {
  id: string;
  proiect_id: string;
  tip_proiect: string;
  titlu: string;
  descriere: string;
  prioritate: string;
  status: string;
  data_creare: string;
  data_scadenta?: string | { value: string };
  data_finalizare?: string | { value: string };
  observatii?: string;
  responsabili: Array<{
    responsabil_uid: string;
    responsabil_nume: string;
    rol_in_sarcina: string;
  }>;
  total_ore_lucrate: number;
}

interface Comentariu {
  id: string;
  proiect_id: string;
  autor_uid: string;
  autor_nume: string;
  comentariu: string;
  data_comentariu: string | { value: string };
  tip_comentariu: string;
}

interface TimeTracking {
  id: string;
  sarcina_id: string;
  utilizator_uid: string;
  utilizator_nume: string;
  data_lucru: string | { value: string };
  ore_lucrate: number;
  descriere_lucru: string;
  sarcina_titlu: string;
}

interface UtilizatorCurent {
  uid: string;
  email: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  rol: string;
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

export default function SarciniProiectModal({ isOpen, onClose, proiect }: SarciniProiectModalProps) {
  const [activeTab, setActiveTab] = useState<'sarcini' | 'comentarii' | 'timetracking'>('sarcini');
  const [loading, setLoading] = useState(false);
  
  // ACTUALIZAT: Hook Firebase pentru utilizatorul autentificat
  const [firebaseUser, firebaseLoading, firebaseError] = useAuthState(auth);
  
  // State pentru utilizatorul curent
  const [utilizatorCurent, setUtilizatorCurent] = useState<UtilizatorCurent | null>(null);
  const [loadingUtilizator, setLoadingUtilizator] = useState(false);
  
  // State pentru sarcini
  const [sarcini, setSarcini] = useState<Sarcina[]>([]);
  const [showSarcinaNouaModal, setShowSarcinaNouaModal] = useState(false);
  const [selectedSarcina, setSelectedSarcina] = useState<Sarcina | null>(null);
  
  // State pentru comentarii
  const [comentarii, setComentarii] = useState<Comentariu[]>([]);
  const [newComentariu, setNewComentariu] = useState('');
  const [tipComentariu, setTipComentariu] = useState('General');
  
  // State pentru time tracking
  const [timeTracking, setTimeTracking] = useState<TimeTracking[]>([]);
  const [showTimeModal, setShowTimeModal] = useState(false);

  // FIX: Funcție formatDate compatibilă cu obiectele BigQuery
  const formatDate = (date?: string | { value: string } | any): string => {
    if (!date) return 'N/A';
    
    try {
      // Extrage valoarea reală din obiectul BigQuery sau folosește string-ul direct
      const dateValue = typeof date === 'string' ? date : 
                      typeof date === 'object' && date.value ? date.value : 
                      date.toString();
      
      // Parsează și formatează data
      const parsedDate = new Date(dateValue);
      
      if (isNaN(parsedDate.getTime())) {
        console.warn('Data invalidă primită:', date);
        return 'Data invalidă';
      }
      
      return parsedDate.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Eroare la formatarea datei:', date, error);
      return 'Eroare dată';
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  // ACTUALIZAT: Încarcă utilizatorul curent real din Firebase + BigQuery
  useEffect(() => {
    if (isOpen && firebaseUser && !firebaseLoading) {
      loadUtilizatorCurent();
    }
  }, [isOpen, firebaseUser, firebaseLoading]);

  const loadUtilizatorCurent = async () => {
    if (!firebaseUser) {
      console.error('Nu există utilizator Firebase autentificat');
      showToast('Nu există utilizator autentificat', 'error');
      return;
    }

    setLoadingUtilizator(true);
    
    try {
      console.log('Preiau datele pentru utilizatorul Firebase:', firebaseUser.uid);
      
      const response = await fetch('/api/utilizatori/curent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid })
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const user = data.data;
        setUtilizatorCurent({
          uid: user.uid,
          email: user.email,
          nume: user.nume || '',
          prenume: user.prenume || '',
          nume_complet: user.nume_complet,
          rol: user.rol
        });
        
        console.log('Utilizator curent încărcat:', user.nume_complet);
      } else {
        console.error('Eroare la preluarea utilizatorului:', data.error);
        
        // Fallback cu datele din Firebase
        setUtilizatorCurent({
          uid: firebaseUser.uid,
          email: firebaseUser.email || 'email@necunoscut.com',
          nume: '',
          prenume: '',
          nume_complet: firebaseUser.displayName || firebaseUser.email || 'Utilizator Necunoscut',
          rol: 'normal'
        });
        
        showToast('S-au folosit datele Firebase ca fallback', 'info');
      }
    } catch (error) {
      console.error('Eroare la încărcarea utilizatorului curent:', error);
      
      // Fallback final cu datele din Firebase
      setUtilizatorCurent({
        uid: firebaseUser.uid,
        email: firebaseUser.email || 'email@necunoscut.com',
        nume: '',
        prenume: '',
        nume_complet: firebaseUser.displayName || firebaseUser.email || 'Utilizator Necunoscut',
        rol: 'normal'
      });
      
      showToast('Eroare la încărcarea datelor utilizator, se folosesc datele Firebase', 'error');
    } finally {
      setLoadingUtilizator(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'sarcini':
          await loadSarcini();
          break;
        case 'comentarii':
          await loadComentarii();
          break;
        case 'timetracking':
          await loadTimeTracking();
          break;
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor:', error);
      showToast('Eroare la încărcarea datelor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSarcini = async () => {
    try {
      const response = await fetch(`/api/rapoarte/sarcini?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}&tip_proiect=${proiect.tip || 'proiect'}`);
      const data = await response.json();
      
      if (data.success) {
        setSarcini(data.data || []);
      } else {
        showToast('Eroare la încărcarea sarcinilor', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea sarcinilor:', error);
      showToast('Eroare la încărcarea sarcinilor', 'error');
    }
  };

  const loadComentarii = async () => {
    try {
      const response = await fetch(`/api/rapoarte/comentarii?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}&tip_proiect=${proiect.tip || 'proiect'}`);
      const data = await response.json();
      
      if (data.success) {
        setComentarii(data.data || []);
      } else {
        showToast('Eroare la încărcarea comentariilor', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea comentariilor:', error);
      showToast('Eroare la încărcarea comentariilor', 'error');
    }
  };

  const loadTimeTracking = async () => {
    try {
      const response = await fetch(`/api/rapoarte/timetracking?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const data = await response.json();
      
      if (data.success) {
        setTimeTracking(data.data || []);
      } else {
        showToast('Eroare la încărcarea time tracking', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea time tracking:', error);
      showToast('Eroare la încărcarea time tracking', 'error');
    }
  };

  // ACTUALIZAT: Folosește datele reale ale utilizatorului curent
  const handleAddComentariu = async () => {
    if (!newComentariu.trim()) {
      showToast('Comentariul nu poate fi gol', 'error');
      return;
    }

    if (!utilizatorCurent) {
      showToast('Nu s-au putut prelua datele utilizatorului curent', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/rapoarte/comentarii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `COM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          proiect_id: proiect.ID_Proiect,
          tip_proiect: proiect.tip || 'proiect',
          autor_uid: utilizatorCurent.uid,
          autor_nume: utilizatorCurent.nume_complet,
          comentariu: newComentariu.trim(),
          tip_comentariu: tipComentariu
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showToast('Comentariu adăugat cu succes', 'success');
        setNewComentariu('');
        setTipComentariu('General');
        await loadComentarii();
      } else {
        showToast(result.error || 'Eroare la adăugarea comentariului', 'error');
      }
    } catch (error) {
      console.error('Eroare la adăugarea comentariului:', error);
      showToast('Eroare la adăugarea comentariului', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSarcinaAdded = () => {
    setShowSarcinaNouaModal(false);
    loadSarcini(); // Refresh lista sarcinilor
    showToast('Sarcină adăugată cu succes', 'success');
  };

  const handleTimeAdded = () => {
    setShowTimeModal(false);
    loadTimeTracking(); // Refresh lista time tracking
    showToast('Timp înregistrat cu succes', 'success');
  };

  const getPriorityColor = (prioritate: string) => {
    switch (prioritate) {
      case 'Critică': return '#e74c3c';
      case 'Înaltă': return '#f39c12';
      case 'Medie': return '#3498db';
      case 'Scăzută': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Finalizată': return '#27ae60';
      case 'În lucru': return '#f39c12';
      case 'În verificare': return '#9b59b6';
      case 'De făcut': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  // Nu afișa modalul dacă nu este deschis sau există erori Firebase
  if (!isOpen || firebaseError) {
    if (firebaseError) {
      console.error('Eroare Firebase Auth:', firebaseError);
    }
    return null;
  }

  // Loading pentru Firebase Auth
  if (firebaseLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          color: '#2c3e50'
        }}>
          Se încarcă autentificarea...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 50000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                {proiect.tip === 'subproiect' ? 'Subproiect' : 'Proiect'}: {proiect.ID_Proiect}
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                {proiect.Denumire} • Client: {proiect.Client}
              </p>
              {/* ACTUALIZAT: Afișează utilizatorul curent real */}
              {utilizatorCurent && (
                <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                  Conectat ca: {utilizatorCurent.nume_complet} ({utilizatorCurent.rol})
                </p>
              )}
              {loadingUtilizator && (
                <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                  Se încarcă datele utilizatorului...
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

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa'
        }}>
          {[
            { key: 'sarcini', label: 'Sarcini', icon: '📋' },
            { key: 'comentarii', label: 'Comentarii', icon: '💬' },
            { key: 'timetracking', label: 'Time Tracking', icon: '⏱️' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '1rem 1.5rem',
                border: 'none',
                background: activeTab === tab.key ? 'white' : 'transparent',
                color: activeTab === tab.key ? '#2c3e50' : '#7f8c8d',
                fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '3px solid #3498db' : '3px solid transparent',
                transition: 'all 0.3s ease'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
              Se încarcă datele...
            </div>
          )}

          {/* TAB SARCINI */}
          {activeTab === 'sarcini' && !loading && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>Sarcini ({sarcini.length})</h3>
                <button
                  onClick={() => setShowSarcinaNouaModal(true)}
                  disabled={!utilizatorCurent}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: !utilizatorCurent ? '#bdc3c7' : 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: !utilizatorCurent ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  + Sarcină Nouă
                </button>
              </div>

              {sarcini.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: '#7f8c8d',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '2px dashed #dee2e6'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📋</div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Nu există sarcini</h4>
                  <p style={{ margin: 0 }}>Adaugă prima sarcină pentru acest proiect</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {sarcini.map(sarcina => (
                    <div
                      key={sarcina.id}
                      style={{
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        padding: '1rem',
                        background: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: '#2c3e50' }}>{sarcina.titlu}</h4>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            background: getPriorityColor(sarcina.prioritate),
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {sarcina.prioritate}
                          </span>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            background: getStatusColor(sarcina.status),
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {sarcina.status}
                          </span>
                        </div>
                      </div>
                      
                      {sarcina.descriere && (
                        <p style={{ margin: '0.5rem 0', color: '#7f8c8d', fontSize: '14px' }}>
                          {sarcina.descriere}
                        </p>
                      )}
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                        <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                          <span>Responsabili: {sarcina.responsabili.map(r => r.responsabil_nume).join(', ') || 'Neatribuit'}</span>
                          <span style={{ marginLeft: '1rem' }}>Timp lucrat: {sarcina.total_ore_lucrate}h</span>
                          {sarcina.data_scadenta && (
                            <span style={{ marginLeft: '1rem' }}>
                              Scadenta: {formatDate(sarcina.data_scadenta)}
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setSelectedSarcina(sarcina)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#3498db',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Editează
                          </button>
                          <button
                            onClick={() => setShowTimeModal(true)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#f39c12',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Adaugă Timp
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB COMENTARII */}
          {activeTab === 'comentarii' && !loading && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Adaugă Comentariu</h3>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <select
                    value={tipComentariu}
                    onChange={(e) => setTipComentariu(e.target.value)}
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '14px',
                      minWidth: '150px'
                    }}
                  >
                    <option value="General">General</option>
                    <option value="Status">Status</option>
                    <option value="Problema">Problema</option>
                    <option value="Progres">Progres</option>
                  </select>
                </div>

                <textarea
                  value={newComentariu}
                  onChange={(e) => setNewComentariu(e.target.value)}
                  placeholder="Scrie comentariul aici..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical',
                    marginBottom: '1rem'
                  }}
                />
                
                <button
                  onClick={handleAddComentariu}
                  disabled={loading || !newComentariu.trim() || !utilizatorCurent}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: loading || !newComentariu.trim() || !utilizatorCurent ? '#bdc3c7' : '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading || !newComentariu.trim() || !utilizatorCurent ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {loading ? 'Se adaugă...' : 'Adaugă Comentariu'}
                </button>
              </div>

              <div style={{ borderTop: '1px solid #dee2e6', paddingTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
                  Istoric Comentarii ({comentarii.length})
                </h3>

                {comentarii.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#7f8c8d',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px dashed #dee2e6'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '1rem' }}>💬</div>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Nu există comentarii</h4>
                    <p style={{ margin: 0 }}>Adaugă primul comentariu pentru acest proiect</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {comentarii.map(comentariu => (
                      <div
                        key={comentariu.id}
                        style={{
                          border: '1px solid #dee2e6',
                          borderRadius: '8px',
                          padding: '1rem',
                          background: 'white',
                          borderLeft: `4px solid ${comentariu.tip_comentariu === 'Problema' ? '#e74c3c' : 
                                                   comentariu.tip_comentariu === 'Progres' ? '#27ae60' :
                                                   comentariu.tip_comentariu === 'Status' ? '#f39c12' : '#3498db'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <strong style={{ color: '#2c3e50' }}>{comentariu.autor_nume}</strong>
                            <span style={{
                              marginLeft: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              background: '#f8f9fa',
                              color: '#7f8c8d',
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}>
                              {comentariu.tip_comentariu}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
                            {formatDate(comentariu.data_comentariu)}
                          </span>
                        </div>
                        <p style={{
                          margin: 0,
                          color: '#2c3e50',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {comentariu.comentariu}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB TIME TRACKING */}
          {activeTab === 'timetracking' && !loading && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>
                  Time Tracking ({timeTracking.length} înregistrări)
                </h3>
                <button
                  onClick={() => setShowTimeModal(true)}
                  disabled={!utilizatorCurent}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: !utilizatorCurent ? '#bdc3c7' : 'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: !utilizatorCurent ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  + Înregistrează Timp
                </button>
              </div>

              {timeTracking.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: '#7f8c8d',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '2px dashed #dee2e6'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⏱️</div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Nu există timp înregistrat</h4>
                  <p style={{ margin: 0 }}>Înregistrează primul timp lucrat pe acest proiect</p>
                </div>
              ) : (
                <div>
                  {/* Sumar timp */}
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                          {timeTracking.reduce((sum, t) => sum + t.ore_lucrate, 0).toFixed(1)}h
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>Total ore lucrate</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                          {new Set(timeTracking.map(t => t.utilizator_uid)).size}
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>Persoane implicate</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                          {new Set(timeTracking.map(t => t.data_lucru)).size}
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>Zile de lucru</div>
                      </div>
                    </div>
                  </div>

                  {/* Lista înregistrări */}
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {timeTracking.map(entry => (
                      <div
                        key={entry.id}
                        style={{
                          border: '1px solid #dee2e6',
                          borderRadius: '8px',
                          padding: '1rem',
                          background: 'white',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: '1rem',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#2c3e50' }}>{entry.utilizator_nume}</strong>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              background: '#f39c12',
                              color: 'white',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {entry.ore_lucrate}h
                            </span>
                            <span style={{ fontSize: '14px', color: '#7f8c8d' }}>
                              {formatDate(entry.data_lucru)}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: '14px', color: '#3498db', marginBottom: '0.5rem' }}>
                            Sarcină: {entry.sarcina_titlu}
                          </div>
                          
                          {entry.descriere_lucru && (
                            <p style={{
                              margin: 0,
                              fontSize: '14px',
                              color: '#7f8c8d',
                              fontStyle: 'italic'
                            }}>
                              {entry.descriere_lucru}
                            </p>
                          )}
                        </div>
                        
                        <button
                          style={{
                            padding: '0.5rem',
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="Șterge înregistrare"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #dee2e6',
          background: '#f8f9fa',
          borderRadius: '0 0 16px 16px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
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
            Închide
          </button>
        </div>
      </div>

      {/* Modale suplimentare */}
      {showSarcinaNouaModal && utilizatorCurent && (
        <SarcinaNouaModal
          isOpen={showSarcinaNouaModal}
          onClose={() => setShowSarcinaNouaModal(false)}
          onSarcinaAdded={handleSarcinaAdded}
          proiect={proiect}
          utilizatorCurent={utilizatorCurent}
        />
      )}

      {showTimeModal && utilizatorCurent && (
        <TimeTrackingNouModal
          isOpen={showTimeModal}
          onClose={() => setShowTimeModal(false)}
          onTimeAdded={handleTimeAdded}
          proiect={proiect}
          sarcini={sarcini}
          utilizatorCurent={utilizatorCurent}
        />
      )}
    </div>
  );
}
