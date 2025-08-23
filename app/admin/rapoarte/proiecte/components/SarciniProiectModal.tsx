// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SarciniProiectModal.tsx
// DATA: 24.08.2025 17:45 (ora României)
// MODIFICAT: Adăugat afișare și editare progres cu indicatori vizuali - COMPLET
// PĂSTRATE: Toate funcționalitățile existente + timp estimat + editare inline
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  timp_estimat_zile?: number;
  timp_estimat_ore?: number;
  timp_estimat_total_ore?: number;
  progres_procent?: number;
  progres_descriere?: string;
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

export default function SarciniProiectModal({ isOpen, onClose, proiect }: SarciniProiectModalProps) {
  const [activeTab, setActiveTab] = useState<'sarcini' | 'comentarii' | 'timetracking'>('sarcini');
  const [loading, setLoading] = useState(false);
  
  // Hook Firebase pentru utilizatorul autentificat
  const [firebaseUser, firebaseLoading, firebaseError] = useAuthState(auth);
  
  // State pentru utilizatorul curent
  const [utilizatorCurent, setUtilizatorCurent] = useState<UtilizatorCurent | null>(null);
  const [loadingUtilizator, setLoadingUtilizator] = useState(false);
  
  // State pentru sarcini
  const [sarcini, setSarcini] = useState<Sarcina[]>([]);
  const [showSarcinaNouaModal, setShowSarcinaNouaModal] = useState(false);
  
  // State pentru editare inline cu progres
  const [editingSarcina, setEditingSarcina] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  
  // State pentru comentarii
  const [comentarii, setComentarii] = useState<Comentariu[]>([]);
  const [newComentariu, setNewComentariu] = useState('');
  const [tipComentariu, setTipComentariu] = useState('General');
  
  // State pentru time tracking
  const [timeTracking, setTimeTracking] = useState<TimeTracking[]>([]);
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Funcție formatDate compatibilă cu obiectele BigQuery
  const formatDate = (date?: string | { value: string } | any): string => {
    if (!date) return 'N/A';
    
    try {
      const dateValue = typeof date === 'string' ? date : 
                      typeof date === 'object' && date.value ? date.value : 
                      date.toString();
      
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

  // Funcție pentru formatarea timpului estimat
  const formatTimpEstimat = (zile?: number, ore?: number, totalOre?: number) => {
    const zileNum = Number(zile) || 0;
    const oreNum = Number(ore) || 0;
    const totalOreNum = Number(totalOre) || 0;
    
    if (totalOreNum === 0) {
      return 'Nestabilit';
    }

    const parts: string[] = [];
    if (zileNum > 0) {
      parts.push(`${zileNum} ${zileNum === 1 ? 'zi' : 'zile'}`);
    }
    if (oreNum > 0) {
      parts.push(`${oreNum}h`);
    }

    return parts.length > 0 
      ? `${parts.join(', ')} (${totalOreNum.toFixed(1)}h total)`
      : `${totalOreNum.toFixed(1)}h`;
  };

  // Funcție pentru culoarea progresului
  const getProgressColor = (procent?: number) => {
    const prog = procent || 0;
    if (prog < 25) return '#e74c3c'; // Roșu
    if (prog < 75) return '#f39c12'; // Galben/Portocaliu
    return '#27ae60'; // Verde
  };

  // Componenta bară de progres
  const ProgressBar = ({ procent, size = 'normal' }: { procent?: number, size?: 'small' | 'normal' }) => {
    const progress = procent || 0;
    const height = size === 'small' ? '8px' : '16px';
    const fontSize = size === 'small' ? '10px' : '11px';
    
    return (
      <div style={{ 
        background: '#f8f9fa', 
        height, 
        borderRadius: height, 
        position: 'relative',
        border: '1px solid #dee2e6',
        overflow: 'hidden',
        minWidth: size === 'small' ? '60px' : '100px'
      }}>
        <div style={{
          background: `linear-gradient(90deg, ${getProgressColor(progress)} 0%, ${getProgressColor(progress)} 100%)`,
          height: '100%',
          width: `${progress}%`,
          borderRadius: height,
          transition: 'all 0.3s ease'
        }} />
        {size === 'normal' && progress > 20 && (
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: progress > 50 ? 'white' : '#2c3e50',
            fontSize,
            fontWeight: 'bold',
            textShadow: progress > 50 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
          }}>
            {progress}%
          </span>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

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
      } else {
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

  // Funcții pentru editare inline sarcini cu progres
  const startEdit = (sarcina: Sarcina) => {
    setEditingSarcina(sarcina.id);
    setEditData({
      titlu: sarcina.titlu,
      descriere: sarcina.descriere || '',
      prioritate: sarcina.prioritate,
      status: sarcina.status,
      data_scadenta: sarcina.data_scadenta 
        ? (typeof sarcina.data_scadenta === 'string' ? sarcina.data_scadenta : sarcina.data_scadenta.value)
        : '',
      observatii: sarcina.observatii || '',
      timp_estimat_zile: sarcina.timp_estimat_zile || 0,
      timp_estimat_ore: sarcina.timp_estimat_ore || 0,
      progres_procent: sarcina.progres_procent || 0,
      progres_descriere: sarcina.progres_descriere || ''
    });
  };

  const cancelEdit = () => {
    setEditingSarcina(null);
    setEditData({});
  };

  const saveEdit = async (sarcinaId: string) => {
    if (!utilizatorCurent) {
      showToast('Nu s-au putut prelua datele utilizatorului curent', 'error');
      return;
    }

    // Validări
    if (!editData.titlu?.trim()) {
      showToast('Titlul sarcinii este obligatoriu', 'error');
      return;
    }

    const zileString = editData.timp_estimat_zile?.toString() || '';
    const oreString = editData.timp_estimat_ore?.toString() || '';

    // Validare că zilele sunt numere întregi
    if (zileString && zileString.includes('.')) {
      showToast('Zilele trebuie să fie numere întregi (ex: 1, 2, 3), nu zecimale!', 'error');
      return;
    }

    const zile = parseInt(editData.timp_estimat_zile) || 0;
    const ore = parseFloat(editData.timp_estimat_ore) || 0;

    if (zile < 0) {
      showToast('Zilele estimate nu pot fi negative', 'error');
      return;
    }

    if (!Number.isInteger(zile)) {
      showToast('Zilele trebuie să fie numere întregi (0, 1, 2, 3...)', 'error');
      return;
    }

    if (ore < 0 || ore >= 8) {
      showToast('Orele estimate trebuie să fie între 0 și 7.9', 'error');
      return;
    }

    if (zile === 0 && ore === 0) {
      showToast('Specifică cel puțin o estimare de timp', 'error');
      return;
    }

    // Validare progres
    const progres = parseInt(editData.progres_procent) || 0;
    if (progres < 0 || progres > 100) {
      showToast('Progresul trebuie să fie între 0 și 100 procente', 'error');
      return;
    }

    setSavingEdit(true);

    try {
      const response = await fetch('/api/rapoarte/sarcini', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sarcinaId,
          titlu: editData.titlu.trim(),
          descriere: editData.descriere?.trim() || null,
          prioritate: editData.prioritate,
          status: editData.status,
          data_scadenta: editData.data_scadenta || null,
          observatii: editData.observatii?.trim() || null,
          timp_estimat_zile: zile,
          timp_estimat_ore: ore,
          progres_procent: progres,
          progres_descriere: editData.progres_descriere?.trim() || null,
          updated_by: utilizatorCurent.uid
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast('Sarcină actualizată cu succes', 'success');
        setEditingSarcina(null);
        setEditData({});
        await loadSarcini();
      } else {
        showToast(result.error || 'Eroare la actualizarea sarcinii', 'error');
      }
    } catch (error) {
      console.error('Eroare la actualizarea sarcinii:', error);
      showToast('Eroare la actualizarea sarcinii', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSarcinaAdded = () => {
    setShowSarcinaNouaModal(false);
    loadSarcini();
    showToast('Sarcină adăugată cu succes', 'success');
  };

  const handleTimeAdded = () => {
    setShowTimeModal(false);
    loadTimeTracking();
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
    <>
      {typeof window !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 55000,
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

              {/* TAB SARCINI cu progres și editare */}
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
                            border: editingSarcina === sarcina.id ? '2px solid #3498db' : '1px solid #dee2e6',
                            borderRadius: '8px',
                            padding: '1rem',
                            background: editingSarcina === sarcina.id ? '#f8f9fa' : 'white',
                            boxShadow: editingSarcina === sarcina.id ? '0 4px 12px rgba(52, 152, 219, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          {editingSarcina === sarcina.id ? (
                            // Form editabil inline cu progres
                            <div>
                              {/* Titlu editabil */}
                              <input
                                type="text"
                                value={editData.titlu || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, titlu: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #dee2e6',
                                  borderRadius: '4px',
                                  fontSize: '16px',
                                  fontWeight: 'bold',
                                  marginBottom: '0.5rem'
                                }}
                                placeholder="Titlu sarcină..."
                              />

                              {/* Badges prioritate și status */}
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <select
                                  value={editData.prioritate || ''}
                                  onChange={(e) => setEditData(prev => ({ ...prev, prioritate: e.target.value }))}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}
                                >
                                  <option value="Scăzută">Scăzută</option>
                                  <option value="Medie">Medie</option>
                                  <option value="Înaltă">Înaltă</option>
                                  <option value="Critică">Critică</option>
                                </select>

                                <select
                                  value={editData.status || ''}
                                  onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value }))}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}
                                >
                                  <option value="De făcut">De făcut</option>
                                  <option value="În lucru">În lucru</option>
                                  <option value="În verificare">În verificare</option>
                                  <option value="Finalizată">Finalizată</option>
                                </select>
                              </div>

                              {/* Descriere editabilă */}
                              <textarea
                                value={editData.descriere || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, descriere: e.target.value }))}
                                placeholder="Descrierea sarcinii..."
                                rows={3}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #dee2e6',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  marginBottom: '1rem',
                                  resize: 'vertical'
                                }}
                              />

                              {/* Progres editabil */}
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '14px' }}>
                                  Progres
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                  <div>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={editData.progres_procent || 0}
                                      onChange={(e) => setEditData(prev => ({ ...prev, progres_procent: e.target.value }))}
                                      placeholder="0-100"
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <ProgressBar procent={parseInt(editData.progres_procent) || 0} />
                                  </div>
                                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2c3e50' }}>
                                    {parseInt(editData.progres_procent) || 0}%
                                  </div>
                                </div>
                                
                                {/* Descriere progres editabilă */}
                                <textarea
                                  value={editData.progres_descriere || ''}
                                  onChange={(e) => setEditData(prev => ({ ...prev, progres_descriere: e.target.value }))}
                                  placeholder="Descriere progres..."
                                  rows={2}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    marginTop: '0.5rem',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>

                              {/* Timp estimat editabil */}
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '14px' }}>
                                  Timp Estimat
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                  <div>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={editData.timp_estimat_zile || ''}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (!value.includes('.')) {
                                          setEditData(prev => ({ ...prev, timp_estimat_zile: value }));
                                        }
                                      }}
                                      onKeyPress={(e) => {
                                        if (e.key === '.' || e.key === ',') {
                                          e.preventDefault();
                                        }
                                      }}
                                      placeholder="Zile (întregi)"
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: editData.timp_estimat_zile?.toString().includes('.') ? 
                                          '2px solid #e74c3c' : '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <input
                                      type="number"
                                      min="0"
                                      max="7.9"
                                      step="0.1"
                                      value={editData.timp_estimat_ore || ''}
                                      onChange={(e) => setEditData(prev => ({ ...prev, timp_estimat_ore: e.target.value }))}
                                      placeholder="Ore"
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                      }}
                                    />
                                  </div>
                                  <div style={{
                                    background: '#f39c12',
                                    color: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    minWidth: '60px'
                                  }}>
                                    {(((parseInt(editData.timp_estimat_zile) || 0) * 8) + (parseFloat(editData.timp_estimat_ore) || 0)).toFixed(1)}h
                                  </div>
                                </div>
                              </div>

                              {/* Data scadență și observații */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '12px', fontWeight: 'bold' }}>
                                    Data Scadență
                                  </label>
                                  <input
                                    type="date"
                                    value={editData.data_scadenta || ''}
                                    onChange={(e) => setEditData(prev => ({ ...prev, data_scadenta: e.target.value }))}
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem',
                                      border: '1px solid #dee2e6',
                                      borderRadius: '4px',
                                      fontSize: '12px'
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '12px', fontWeight: 'bold' }}>
                                    Observații
                                  </label>
                                  <input
                                    type="text"
                                    value={editData.observatii || ''}
                                    onChange={(e) => setEditData(prev => ({ ...prev, observatii: e.target.value }))}
                                    placeholder="Observații suplimentare..."
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem',
                                      border: '1px solid #dee2e6',
                                      borderRadius: '4px',
                                      fontSize: '12px'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Butoane salvare/anulare */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Anulează
                                </button>
                                <button
                                  onClick={() => saveEdit(sarcina.id)}
                                  disabled={savingEdit || !editData.titlu?.trim()}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: savingEdit || !editData.titlu?.trim() ? '#bdc3c7' : '#27ae60',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: savingEdit || !editData.titlu?.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  {savingEdit ? 'Se salvează...' : 'Salvează'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Afișare normală cu progres vizual
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
                                  {Number(entry.ore_lucrate) || 0}h
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
        </div>,
        document.body
      )}
      
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
    </>
  );
}'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
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

                              {/* Afișare progres vizual */}
                              <div style={{ 
                                background: 'rgba(52, 152, 219, 0.1)', 
                                border: '1px solid rgba(52, 152, 219, 0.3)',
                                borderRadius: '6px',
                                padding: '0.75rem',
                                margin: '0.5rem 0',
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr auto',
                                gap: '1rem',
                                alignItems: 'center'
                              }}>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#3498db' }}>
                                  Progres:
                                </div>
                                <ProgressBar procent={sarcina.progres_procent || 0} />
                                <div style={{ 
                                  fontSize: '14px', 
                                  fontWeight: 'bold', 
                                  color: getProgressColor(sarcina.progres_procent || 0) 
                                }}>
                                  {sarcina.progres_procent || 0}%
                                </div>
                              </div>

                              {sarcina.progres_descriere && (
                                <div style={{ 
                                  fontSize: '13px', 
                                  color: '#7f8c8d', 
                                  fontStyle: 'italic',
                                  marginBottom: '0.5rem',
                                  background: '#f8f9fa',
                                  padding: '0.5rem',
                                  borderRadius: '4px'
                                }}>
                                  "{sarcina.progres_descriere}"
                                </div>
                              )}

                              {/* Timp estimat */}
                              <div style={{ 
                                background: 'rgba(243, 156, 18, 0.1)', 
                                border: '1px solid rgba(243, 156, 18, 0.3)',
                                borderRadius: '6px',
                                padding: '0.5rem',
                                margin: '0.5rem 0',
                                fontSize: '13px'
                              }}>
                                <strong style={{ color: '#f39c12' }}>Timp estimat:</strong> {formatTimpEstimat(
                                  sarcina.timp_estimat_zile || 0, 
                                  sarcina.timp_estimat_ore || 0, 
                                  sarcina.timp_estimat_total_ore || 0
                                )}
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                                  <span>Responsabili: {sarcina.responsabili.map(r => r.responsabil_nume).join(', ') || 'Neatribuit'}</span>
                                  <span style={{ marginLeft: '1rem' }}>Timp lucrat: {sarcina.total_ore_lucrate}h</span>
                                  {sarcina.data_scadenta && (
                                    <span style={{ marginLeft: '1rem' }}>
                                      Scadența: {formatDate(sarcina.data_scadenta)}
                                    </span>
                                  )}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    onClick={() => startEdit(sarcina)}
                                    disabled={editingSarcina !== null}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      background: editingSarcina !== null ? '#bdc3c7' : '#3498db',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: editingSarcina !== null ? 'not-allowed' : 'pointer',
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
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB COMENTARII - PĂSTRAT identic */}
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

              {/* TAB TIME TRACKING - PĂSTRAT identic */}
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
                              {Number(timeTracking.reduce((sum, t) => sum + (Number(t.ore_lucrate) || 0), 0)).toFixed(1)}h
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
                              {new Set(timeTracking.map(t => {
                                const dataLucru = typeof t.data_lucru === 'string' ? t.data_lucru : 
                                                 typeof t.data_lucru === 'object' && t.data_lucru?.value ? t.data_lucru.value : 
                                                 t.data_lucru?.toString() || '';
                                return dataLucru;
                              })).size}
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
                                 {Number(entry.ore_lucrate) || 0}h
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
       </div>,
       document.body
     )}
     
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
   </>
 );
}
