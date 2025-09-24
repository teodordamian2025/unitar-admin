// ==================================================================
// CALEA: app/projects/components/UserSarciniProiectModal.tsx
// DATA: 23.09.2025 18:25 (ora României)
// DESCRIERE: Modal sarcini/comentarii/timetracking pentru utilizatori normali - IDENTIC cu admin
// FUNCȚIONALITATE: 3 tab-uri cu editare inline, progres și sincronizare timp real - FĂRĂ restricții financiare
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import UserSarcinaNouaModal from './UserSarcinaNouaModal';
import UserTimeTrackingNouModal from './UserTimeTrackingNouModal';

interface ProiectData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  tip?: 'proiect' | 'subproiect';
}

interface Sarcina {
  id: string;
  proiect_id: string;
  tip_proiect: string;
  titlu: string;
  descriere?: string;
  status: string;
  prioritate: string;
  progres_procent?: number;
  progres_descriere?: string;
  timp_estimat_zile?: number;
  timp_estimat_ore?: number;
  timp_estimat_total_ore?: number;
  data_scadenta?: string;
  observatii?: string;
  responsabili: Array<{
    responsabil_uid: string;
    responsabil_nume: string;
    rol_in_sarcina: string;
  }>;
  total_ore_lucrate?: number;
  data_creare?: any;
  data_modificare?: any;
}

interface Comentariu {
  id: string;
  proiect_id: string;
  tip_comentariu: string;
  comentariu: string;
  autor_uid: string;
  autor_nume: string;
  data_comentariu: any;
}

interface TimeTrackingEntry {
  id: string;
  proiect_id: string;
  sarcina_id?: string;
  sarcina_titlu?: string;
  utilizator_uid: string;
  utilizator_nume: string;
  ore_lucrate: number;
  data_lucru: any;
  descriere_lucru?: string;
}

interface UtilizatorCurent {
  uid: string;
  email: string;
  nume_complet: string;
  rol: string;
}

interface UserSarciniProiectModalProps {
  isOpen: boolean;
  onClose: () => void;
  proiect: ProiectData;
}

// Progress Bar Component - IDENTIC cu admin
const ProgressBar: React.FC<{ procent: number }> = ({ procent }) => {
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '#27ae60';
    if (percent >= 70) return '#2ecc71';
    if (percent >= 50) return '#f39c12';
    if (percent >= 30) return '#e67e22';
    return '#e74c3c';
  };

  return (
    <div style={{
      width: '100%',
      height: '8px',
      background: '#ecf0f1',
      borderRadius: '4px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, procent))}%`,
        height: '100%',
        background: getProgressColor(procent),
        transition: 'width 0.3s ease, background-color 0.3s ease'
      }} />
    </div>
  );
};

export default function UserSarciniProiectModal({ isOpen, onClose, proiect }: UserSarciniProiectModalProps) {
  const [user, firebaseLoading, firebaseError] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<'sarcini' | 'comentarii' | 'timetracking'>('sarcini');
  const [loading, setLoading] = useState(false);
  const [utilizatorCurent, setUtilizatorCurent] = useState<UtilizatorCurent | null>(null);
  const [loadingUtilizator, setLoadingUtilizator] = useState(true);

  // States pentru sarcini
  const [sarcini, setSarcini] = useState<Sarcina[]>([]);
  const [editingSarcina, setEditingSarcina] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [showSarcinaNouaModal, setShowSarcinaNouaModal] = useState(false);

  // States pentru comentarii
  const [comentarii, setComentarii] = useState<Comentariu[]>([]);
  const [newComentariu, setNewComentariu] = useState('');
  const [tipComentariu, setTipComentariu] = useState('General');

  // States pentru timetracking
  const [timeTracking, setTimeTracking] = useState<TimeTrackingEntry[]>([]);
  const [showTimeModal, setShowTimeModal] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadUtilizatorCurent();
      loadSarcini();
      loadComentarii();
      loadTimeTracking();
    }
  }, [isOpen, user]);

  const loadUtilizatorCurent = async () => {
    setLoadingUtilizator(true);
    try {
      // For normal users, use Firebase user data directly instead of admin API
      if (user) {
        setUtilizatorCurent({
          uid: user.uid,
          email: user.email || '',
          nume_complet: user.displayName || user.email || 'Utilizator',
          rol: 'normal'
        });
      }
    } catch (error) {
      console.error('Eroare la încărcarea utilizatorului curent:', error);
    } finally {
      setLoadingUtilizator(false);
    }
  };

  const loadSarcini = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/sarcini?proiect_id=${proiect.ID_Proiect}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setSarcini(data.sarcini || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea sarcinilor:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComentarii = async () => {
    try {
      const response = await fetch(`/api/user/comentarii?proiect_id=${proiect.ID_Proiect}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setComentarii(data.comentarii || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea comentariilor:', error);
    }
  };

  const loadTimeTracking = async () => {
    try {
      const response = await fetch(`/api/user/timetracking?proiect_id=${proiect.ID_Proiect}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setTimeTracking(data.timeTracking || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea time tracking:', error);
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';

    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue.toString();

    try {
      return new Date(dateStr).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimpEstimat = (zile: number, ore: number, totalOre: number) => {
    if (totalOre > 0) return `${totalOre}h`;
    if (zile > 0 || ore > 0) {
      return `${zile || 0}z ${(ore || 0).toFixed(1)}h`;
    }
    return 'Nespecificat';
  };

  const getProgressColor = (procent: number) => {
    if (procent >= 90) return '#27ae60';
    if (procent >= 70) return '#2ecc71';
    if (procent >= 50) return '#f39c12';
    if (procent >= 30) return '#e67e22';
    return '#e74c3c';
  };

  // Funcții pentru editare sarcini - IDENTICE cu admin
  const startEdit = (sarcina: Sarcina) => {
    setEditingSarcina(sarcina.id);
    setEditData({
      titlu: sarcina.titlu,
      descriere: sarcina.descriere || '',
      status: sarcina.status,
      prioritate: sarcina.prioritate,
      progres_procent: sarcina.progres_procent || 0,
      progres_descriere: sarcina.progres_descriere || '',
      timp_estimat_zile: sarcina.timp_estimat_zile || '',
      timp_estimat_ore: sarcina.timp_estimat_ore || '',
      data_scadenta: sarcina.data_scadenta || '',
      observatii: sarcina.observatii || ''
    });
  };

  const cancelEdit = () => {
    setEditingSarcina(null);
    setEditData({});
  };

  // Sincronizare progres/status - IDENTIC cu admin
  const handleProgresChange = (value: string) => {
    const progres = parseInt(value) || 0;
    const newEditData = { ...editData, progres_procent: progres };

    if (progres === 100) {
      newEditData.status = 'Finalizată';
    }

    setEditData(newEditData);
  };

  const handleStatusChange = (status: string) => {
    const newEditData = { ...editData, status };

    if (status === 'Finalizată') {
      newEditData.progres_procent = 100;
    }

    setEditData(newEditData);
  };

  const saveEdit = async (sarcinaId: string) => {
    if (!editData.titlu?.trim()) return;

    setSavingEdit(true);
    try {
      const response = await fetch(`/api/user/sarcini/${sarcinaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        setEditingSarcina(null);
        setEditData({});
        await loadSarcini();
        showToast('Sarcină actualizată cu succes', 'success');
      } else {
        throw new Error('Eroare la actualizarea sarcinii');
      }
    } catch (error) {
      console.error('Eroare la salvarea sarcinii:', error);
      showToast('Eroare la actualizarea sarcinii', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Funcții pentru comentarii - IDENTICE cu admin
  const handleAddComentariu = async () => {
    if (!newComentariu.trim() || !utilizatorCurent) return;

    setLoading(true);
    try {
      const response = await fetch('/api/user/comentarii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiect_id: proiect.ID_Proiect,
          tip_comentariu: tipComentariu,
          comentariu: newComentariu.trim(),
          autor_uid: utilizatorCurent.uid,
          autor_nume: utilizatorCurent.nume_complet
        })
      });

      if (response.ok) {
        setNewComentariu('');
        await loadComentarii();
        showToast('Comentariu adăugat cu succes', 'success');
      } else {
        throw new Error('Eroare la adăugarea comentariului');
      }
    } catch (error) {
      console.error('Eroare la adăugarea comentariului:', error);
      showToast('Eroare la adăugarea comentariului', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handlers pentru modale secundare
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

  // Toast notification (simple)
  const showToast = (message: string, type: 'success' | 'error') => {
    // Implementare simplă pentru toast
    console.log(`${type.toUpperCase()}: ${message}`);
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

  // Verificare window pentru SSR
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <>
      {createPortal(
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
                      Se incarca datele utilizatorului...
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
                  Se incarca datele...
                </div>
              )}

              {/* TAB SARCINI cu progres si editare IMBUNATATIT cu sincronizare timp real */}
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
                      + Sarcina Noua
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
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>Nu exista sarcini</h4>
                      <p style={{ margin: 0 }}>Adauga prima sarcina pentru acest proiect</p>
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
                            // Form editabil inline cu progres IMBUNATATIT cu sincronizare timp real
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
                                placeholder="Titlu sarcina..."
                              />

                              {/* Alert pentru auto-completari cu sincronizare timp real */}
                              {(editData.progres_procent == 100 || editData.status === 'Finalizată') && (
                                <div style={{
                                  background: '#d1ecf1',
                                  border: '1px solid #bee5eb',
                                  color: '#0c5460',
                                  padding: '0.5rem',
                                  borderRadius: '4px',
                                  marginBottom: '1rem',
                                  fontSize: '12px'
                                }}>
                                  <strong>Sincronizare activă:</strong> {
                                    editData.progres_procent == 100
                                      ? 'Progres 100% va seta statusul automat la "Finalizată"'
                                      : 'Status "Finalizată" va seta progresul automat la 100%'
                                  }
                                </div>
                              )}

                              {/* Badges prioritate si status cu sincronizare */}
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

                                {/* Select status cu sincronizare prin handleStatusChange */}
                                <select
                                  value={editData.status || ''}
                                  onChange={(e) => handleStatusChange(e.target.value)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    background: editData.status === 'Finalizată' ? '#d4edda' : 'white'
                                  }}
                                >
                                  <option value="De făcut">De făcut</option>
                                  <option value="În lucru">În lucru</option>
                                  <option value="În verificare">În verificare</option>
                                  <option value="Finalizată">Finalizată</option>
                                </select>
                              </div>

                              {/* Descriere editabila */}
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

                              {/* Progres editabil cu logica imbunatatita si sincronizare timp real */}
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '14px' }}>
                                  Progres
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                  <div>
                                    {/* Input progres cu sincronizare prin handleProgresChange */}
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={editData.progres_procent || 0}
                                      onChange={(e) => handleProgresChange(e.target.value)}
                                      placeholder="0-100"
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        background: editData.progres_procent == 100 ? '#d4edda' : 'white'
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

                                {/* Descriere progres editabila */}
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
                                      placeholder="Zile (intregi)"
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

                              {/* Data scadenta si observatii */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '12px', fontWeight: 'bold' }}>
                                    Data Scadenta
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
                                    Observatii
                                  </label>
                                  <input
                                    type="text"
                                    value={editData.observatii || ''}
                                    onChange={(e) => setEditData(prev => ({ ...prev, observatii: e.target.value }))}
                                    placeholder="Observatii suplimentare..."
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
                                  Anuleaza
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
                                  {savingEdit ? 'Se salveaza...' : 'Salveaza'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Afisare normala cu progres vizual - PASTRAT identic
                            <div>
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

                              {/* Afisare progres vizual */}
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
                                      Scadenta: {formatDate(sarcina.data_scadenta)}
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
                                    Editeaza
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
                                    Adauga Timp
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

              {/* TAB COMENTARII - PASTRAT identic */}
              {activeTab === 'comentarii' && !loading && (
                <div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Adauga Comentariu</h3>

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
                      {loading ? 'Se adauga...' : 'Adauga Comentariu'}
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
                        <h4 style={{ margin: '0 0 0.5rem 0' }}>Nu exista comentarii</h4>
                        <p style={{ margin: 0 }}>Adauga primul comentariu pentru acest proiect</p>
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

              {/* TAB TIME TRACKING - PASTRAT identic */}
              {activeTab === 'timetracking' && !loading && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>
                      Time Tracking ({timeTracking.length} inregistrari)
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
                      + Inregistreaza Timp
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
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>Nu exista timp inregistrat</h4>
                      <p style={{ margin: 0 }}>Inregistreaza primul timp lucrat pe acest proiect</p>
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

                      {/* Lista inregistrari */}
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
                                Sarcina: {entry.sarcina_titlu}
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
                              title="Sterge inregistrare"
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
                Inchide
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modale suplimentare */}
      {showSarcinaNouaModal && utilizatorCurent && (
        <UserSarcinaNouaModal
          isOpen={showSarcinaNouaModal}
          onClose={() => setShowSarcinaNouaModal(false)}
          onSarcinaAdded={handleSarcinaAdded}
          proiect={proiect}
          utilizatorCurent={utilizatorCurent}
        />
      )}

      {showTimeModal && utilizatorCurent && (
        <UserTimeTrackingNouModal
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