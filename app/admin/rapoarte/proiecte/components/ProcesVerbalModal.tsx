// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProcesVerbalModal.tsx
// DATA: 07.09.2025 23:30 (ora României)
// MODIFICAT: Eliminare completă informații financiare din interfața PV
// PĂSTRATE: Toate funcționalitățile operaționale + logica selector subproiecte
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ProiectData {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number;
  Data_Start?: string | { value: string };
  Data_Final?: string | { value: string };
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  Responsabil?: string;
  Adresa?: string;
  Descriere?: string;
  Observatii?: string;
}

interface SubproiectInfo {
  ID_Subproiect: string;
  Denumire: string;
  Valoare_Estimata?: number; // PĂSTRAT pentru logica internă, nu se afișează
  Status: string;
  status_predare?: string;
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  Data_Final?: string | { value: string };
  Responsabil?: string;
}

interface ProiectComplet {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata?: number | { value: string };
  Data_Start?: string | { value: string };
  Data_Final?: string | { value: string };
  moneda?: string;
  valoare_ron?: number | { value: string };
  curs_valutar?: number | { value: string };
  Responsabil?: string;
  Adresa?: string;
  Descriere?: string;
  Observatii?: string;
  client_id?: string;
  client_nume?: string;
  client_cui?: string;
  client_reg_com?: string;
  client_adresa?: string;
  client_telefon?: string;
  client_email?: string;
}

interface ProcesVerbalModalProps {
  proiect: ProiectData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Toast system PĂSTRAT din ContractModal
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
  }, type === 'success' ? 4000 : type === 'error' ? 5000 : 6000);
};

export default function ProcesVerbalModal({ proiect, isOpen, onClose, onSuccess }: ProcesVerbalModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [subproiecte, setSubproiecte] = useState<SubproiectInfo[]>([]);
  const [proiectComplet, setProiectComplet] = useState<ProiectComplet | null>(null);

  // State pentru PV
  const [observatii, setObservatii] = useState('');
  const [denumirePV, setDenumirePV] = useState('');
  const [subproiecteSelectate, setSubproiecteSelectate] = useState<Set<string>>(new Set());

  // State pentru preview număr PV
  const [pvPreview, setPvPreview] = useState('');

  // State pentru verificare contract
  const [contractGasit, setContractGasit] = useState<boolean>(true);
  const [contractNumar, setContractNumar] = useState<string | null>(null);
  const [anexeCount, setAnexeCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setLoadingCheck(true);
      Promise.all([
        loadProiectComplet(),
        loadSubproiecte(),
        previewPVNumber(),
        checkContractStatus()
      ]).finally(() => {
        setLoadingCheck(false);
      });
    }
  }, [isOpen, proiect.ID_Proiect]);

  // Încărcare proiect complet cu date client (PĂSTRAT din ContractModal)
  const loadProiectComplet = async () => {
    try {
      console.log(`Încărcare proiect complet din BigQuery: ${proiect.ID_Proiect}`);
      
      const response = await fetch(`/api/rapoarte/proiecte/${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.proiect) {
        setProiectComplet(result.proiect);
        
        // Setează denumirea PV default
        const denumireDefault = `PV Predare ${result.proiect.Denumire}`;
        setDenumirePV(denumireDefault);
        
        console.log('Proiect complet încărcat pentru PV:', {
          ID_Proiect: result.proiect.ID_Proiect,
          Client: result.proiect.Client,
          client_nume: result.proiect.client_nume,
          client_adresa: result.proiect.client_adresa
        });
      } else {
        console.warn('Nu s-au putut încărca datele complete ale proiectului');
        showToast('Nu s-au putut încărca datele complete ale proiectului', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectului complet:', error);
      showToast('Eroare la încărcarea datelor proiectului', 'error');
    }
  };

  // Preview număr PV consecutiv
  const previewPVNumber = async () => {
    try {
      console.log('Apelez API-ul pentru numerotare consecutivă PV...');

      const response = await fetch(`/api/setari/contracte/next-number?tipDocument=pv&proiectId=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();

      if (result.success) {
        setPvPreview(result.contract_preview);
        console.log('Număr consecutiv pentru PV nou:', result.contract_preview);
      } else {
        throw new Error(result.error || 'Eroare la obținerea numărului PV');
      }
    } catch (error) {
      console.error('Eroare la preview numărul PV:', error);
      showToast('Nu s-a putut obține următorul număr de PV', 'error');

      const currentYear = new Date().getFullYear();
      const fallbackNumber = 1001;
      setPvPreview(`PV-${fallbackNumber}-${currentYear}`);
    }
  };

  // Verificare existență contract pentru proiect
  const checkContractStatus = async () => {
    try {
      console.log('Verificare existență contract pentru proiect:', proiect.ID_Proiect);

      const response = await fetch(`/api/actions/pv/generate?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();

      if (result.success && result.proiect_test) {
        const hasContract = result.proiect_test.contract_gasit;
        const contractNum = result.proiect_test.contract_numar;
        const anexe = result.proiect_test.anexe_count || 0;

        setContractGasit(hasContract);
        setContractNumar(contractNum);
        setAnexeCount(anexe);

        console.log('Status contract pentru PV:', {
          contract_gasit: hasContract,
          numar_contract: contractNum,
          anexe_count: anexe
        });

        if (!hasContract) {
          console.warn('⚠️ AVERTISMENT: Proiectul nu are contract generat încă!');
        }
      }
    } catch (error) {
      console.error('Eroare la verificarea contractului:', error);
      // Nu afișăm toast pentru a nu suprasolicita utilizatorul
      // În caz de eroare, presupunem că există contract (optimistic)
      setContractGasit(true);
    }
  };

  // Încărcare subproiecte cu status predare
  const loadSubproiecte = async () => {
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSubproiecte(result.data);
        
        console.log(`Încărcate ${result.data.length} subproiecte pentru PV:`, {
          total: result.data.length,
          predate: result.data.filter((sub: SubproiectInfo) => sub.status_predare === 'Predat').length,
          disponibile: result.data.filter((sub: SubproiectInfo) => sub.status_predare !== 'Predat').length
        });
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor pentru PV:', error);
      showToast('Nu s-au putut încărca subproiectele', 'error');
    }
  };

  // Handler pentru selectare/deselectare subproiect
  const handleSubproiectToggle = (subproiectId: string, isPredat: boolean) => {
    if (isPredat) return; // Nu permite selectarea subproiectelor deja predate
    
    const newSelection = new Set(subproiecteSelectate);
    if (newSelection.has(subproiectId)) {
      newSelection.delete(subproiectId);
    } else {
      newSelection.add(subproiectId);
    }
    setSubproiecteSelectate(newSelection);
  };

  // Handler pentru selectare toate subproiectele disponibile
  const handleSelectAllAvailable = () => {
    const disponibile = subproiecte.filter(sub => sub.status_predare !== 'Predat');
    const allIds = new Set(disponibile.map(sub => sub.ID_Subproiect));
    setSubproiecteSelectate(allIds);
  };

  // Handler pentru deselectare toate
  const handleDeselectAll = () => {
    setSubproiecteSelectate(new Set());
  };

  // MODIFICAT: Calculare statistici selecție FĂRĂ informații financiare
  const getStatisticiSelectie = () => {
    const totalSubproiecte = subproiecte.length;
    const subproiectePredate = subproiecte.filter(sub => sub.status_predare === 'Predat').length;
    const subproiecteDisponibile = totalSubproiecte - subproiectePredate;
    const subproiecteSelectate_count = subproiecteSelectate.size;

    return {
      totalSubproiecte,
      subproiectePredate,
      subproiecteDisponibile,
      subproiecteSelectate: subproiecteSelectate_count
      // ELIMINAT: valoareTotalaSelectata
    };
  };

  // Handler pentru generarea PV
  const handleGeneratePV = async () => {
    setLoading(true);
    
    try {
      // Validări
      if (!denumirePV.trim()) {
        showToast('Denumirea PV este obligatorie', 'error');
        setLoading(false);
        return;
      }

      // Pentru proiecte cu subproiecte, verifică dacă are selectate cel puțin un subproiect
      if (subproiecte.length > 0 && subproiecteSelectate.size === 0) {
        showToast('Selectează cel puțin un subproiect pentru predare', 'error');
        setLoading(false);
        return;
      }

      const actionText = subproiecte.length === 0 ? 
        'generează PV pentru proiect' : 
        `generează PV pentru ${subproiecteSelectate.size} subproiecte`;
      showToast(`Se ${actionText}...`, 'info');

      const response = await fetch('/api/actions/pv/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiect.ID_Proiect,
          subproiecteIds: Array.from(subproiecteSelectate),
          observatii: observatii.trim(),
          denumirePV: denumirePV.trim()
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        
        const pvNumber = response.headers.get('X-PV-Number') || pvPreview;
        const pvId = response.headers.get('X-PV-ID') || 'unknown';
        const subproiecteCount = response.headers.get('X-Subproiecte-Count') || '0';
        
        // Download PV
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${pvNumber}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        const successMessage = subproiecte.length === 0 ?
          `PV ${pvNumber} generat cu succes pentru proiect!` :
          `PV ${pvNumber} generat cu succes pentru ${subproiecteCount} subproiecte!`;
        
        showToast(successMessage, 'success');
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        const errorResult = await response.json();
        throw new Error(errorResult.error || 'Eroare la procesarea PV');
      }
    } catch (error) {
      console.error('Eroare la generarea PV:', error);
      showToast(`Eroare la procesarea PV: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper pentru formatarea datei
  const formatDate = (dateString?: string | { value: string }): string => {
    if (!dateString) return 'N/A';
    const dateValue = typeof dateString === 'string' ? dateString : dateString.value;
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return 'N/A';
    }
  };

  if (!isOpen) return null;

  if (loadingCheck) {
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
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid #3498db',
            borderTop: '3px solid transparent',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
            Încărcare date pentru PV...
          </div>
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
      </div>,
      document.body
    ) : null;
  }

  const statistici = getStatisticiSelectie();

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
        maxWidth: '1100px', // MODIFICAT: Redus din 1200px
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                📋 Generare Proces Verbal Predare-Primire
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{proiect.ID_Proiect}</span> - {proiect.Denumire}
              </p>
              {proiectComplet && (
                <div style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                  Client: {proiectComplet.client_nume || proiect.Client} • Subproiecte: {statistici.totalSubproiecte}
                  {statistici.subproiectePredate > 0 && (
                    <span> • Predate deja: {statistici.subproiectePredate}</span>
                  )}
                </div>
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
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'white'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {loading && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                textAlign: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '3px solid #27ae60',
                    borderTop: '3px solid transparent',
                    animation: 'spin 1s linear infinite'
                  }}>
                  </div>
                  <span>Se generează Procesul Verbal...</span>
                </div>
                <style>
                  {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
              </div>
            </div>
          )}

          {/* Preview număr PV */}
          <div style={{
            background: '#e8f5e8',
            border: '1px solid #c3e6cb',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '16px' }}>
              Număr Proces Verbal Consecutiv
            </h3>
            <div style={{
              padding: '0.5rem 1rem',
              background: '#fff',
              border: '2px solid #27ae60',
              borderRadius: '8px',
              fontSize: '18px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#27ae60',
              textAlign: 'center'
            }}>
              {pvPreview}
            </div>
          </div>

          {/* Avertisment lipsă contract - PĂSTRĂM posibilitatea generării PV */}
          {!contractGasit && (
            <div style={{
              background: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '8px',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ fontSize: '32px', lineHeight: '1' }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#856404', fontSize: '16px', fontWeight: 'bold' }}>
                    AVERTISMENT: Lipsește Contractul
                  </h3>
                  <p style={{ margin: '0 0 0.75rem 0', color: '#856404', fontSize: '14px', lineHeight: '1.5' }}>
                    Acest proiect nu are încă un contract generat. Este recomandat să generezi mai întâi contractul înainte de procesul verbal de predare-primire.
                  </p>
                  <div style={{
                    background: 'rgba(255, 193, 7, 0.15)',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#856404',
                    lineHeight: '1.5'
                  }}>
                    <strong>ℹ️ Poți continua generarea PV-ului</strong>, dar în document va apărea:
                    <span style={{ fontFamily: 'monospace', display: 'block', marginTop: '0.5rem', fontWeight: 'bold' }}>
                      "LA CONTRACTUL [LIPSĂ CONTRACT - Proiectul nu are încă contract]"
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info contract găsit */}
          {contractGasit && contractNumar && (
            <div style={{
              background: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '14px',
              color: '#155724',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              <span>
                Contract găsit: <strong style={{ fontFamily: 'monospace' }}>{contractNumar}</strong>
                {anexeCount > 0 && <span> (cu {anexeCount} {anexeCount === 1 ? 'anexă' : 'anexe'})</span>}
              </span>
            </div>
          )}

          {/* Denumire PV */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Denumire Proces Verbal *
            </label>
            <input
              type="text"
              value={denumirePV}
              onChange={(e) => setDenumirePV(e.target.value)}
              disabled={loading}
              placeholder="Ex: PV Predare Faza SF pentru Proiect..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            />
          </div>

          {/* Selector subproiecte sau mesaj pentru proiecte fără subproiecte */}
          {subproiecte.length === 0 ? (
            <div style={{
              background: '#e3f2fd',
              border: '1px solid #2196f3',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📄</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1976d2', fontSize: '18px' }}>
                Proiect fără subproiecte
              </h3>
              <p style={{ margin: 0, color: '#1976d2', fontSize: '14px' }}>
                Se va genera PV pentru întregul proiect
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>
                  Selectează subproiectele pentru predare
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllAvailable}
                    disabled={loading || statistici.subproiecteDisponibile === 0}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (loading || statistici.subproiecteDisponibile === 0) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    Selectează toate disponibile
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    disabled={loading || subproiecteSelectate.size === 0}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (loading || subproiecteSelectate.size === 0) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    Deselectează toate
                  </button>
                </div>
              </div>

              {/* MODIFICAT: Headers pentru tabel subproiecte FĂRĂ coloana Valoare */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '40px 2fr 1fr 1fr 1fr', // MODIFICAT: 5 coloane în loc de 6
                gap: '0.5rem',
                marginBottom: '0.5rem',
                padding: '0.5rem',
                background: '#f8f9fa',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#2c3e50'
              }}>
                <div style={{ textAlign: 'center' }}>Select</div>
                <div>Subproiect</div>
                <div style={{ textAlign: 'center' }}>Status</div>
                <div style={{ textAlign: 'center' }}>Status Predare</div>
                <div style={{ textAlign: 'center' }}>Responsabil</div>
                {/* ELIMINAT: coloana Valoare */}
              </div>

              {/* MODIFICAT: Lista subproiecte FĂRĂ coloana Valoare */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' }}>
                {subproiecte.map((subproiect) => {
                  const isPredat = subproiect.status_predare === 'Predat';
                  const isSelected = subproiecteSelectate.has(subproiect.ID_Subproiect);
                  
                  return (
                    <div
                      key={subproiect.ID_Subproiect}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 2fr 1fr 1fr 1fr', // MODIFICAT: 5 coloane în loc de 6
                        gap: '0.5rem',
                        padding: '0.75rem 0.5rem',
                        borderBottom: '1px solid #f8f9fa',
                        background: isSelected ? '#e8f5e8' : isPredat ? '#ffeaa7' : 'white',
                        opacity: isPredat ? 0.7 : 1,
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isPredat || loading}
                          onChange={() => handleSubproiectToggle(subproiect.ID_Subproiect, isPredat)}
                          style={{
                            cursor: (isPredat || loading) ? 'not-allowed' : 'pointer',
                            transform: 'scale(1.2)'
                          }}
                        />
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#3498db', fontWeight: 'bold' }}>
                          📋 {subproiect.ID_Subproiect}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50' }}>
                          {subproiect.Denumire}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: subproiect.Status === 'Activ' ? '#d4edda' : '#f8d7da',
                          color: subproiect.Status === 'Activ' ? '#155724' : '#721c24'
                        }}>
                          {subproiect.Status}
                        </span>
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: isPredat ? '#ffeaa7' : '#e8f5e8',
                          color: isPredat ? '#856404' : '#155724'
                        }}>
                          {isPredat ? '✅ Predat' : '⏳ Nepredat'}
                        </span>
                      </div>
                      
                      <div style={{ textAlign: 'center', fontSize: '12px', color: '#7f8c8d' }}>
                        {subproiect.Responsabil || 'N/A'}
                      </div>
                      
                      {/* ELIMINAT: div cu valoarea */}
                    </div>
                  );
                })}
              </div>

              {/* MODIFICAT: Statistici selecție FĂRĂ valoarea totală */}
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#2c3e50'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                  <div>
                    <strong>Total subproiecte:</strong> {statistici.totalSubproiecte}
                  </div>
                  <div>
                    <strong>Deja predate:</strong> {statistici.subproiectePredate}
                  </div>
                  <div>
                    <strong>Disponibile:</strong> {statistici.subproiecteDisponibile}
                  </div>
                  <div>
                    <strong>Selectate:</strong> {statistici.subproiecteSelectate}
                  </div>
                  {/* ELIMINAT: div cu valoarea selectată */}
                </div>
              </div>
            </div>
          )}

          {/* Observații */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații și Note Speciale
            </label>
            <textarea
              value={observatii}
              onChange={(e) => setObservatii(e.target.value)}
              disabled={loading}
              placeholder="Observații speciale pentru procesul verbal, detalii predare, etc."
              rows={3}
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

          {/* Sumar final */}
          <div style={{
            background: '#e8f5e8',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              Sumar Proces Verbal
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>NUMĂR PV</div>
                <div style={{ fontSize: '16px', color: '#27ae60', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {pvPreview}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>PROIECT</div>
                <div style={{ fontSize: '14px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {proiect.Denumire}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>CLIENT</div>
                <div style={{ fontSize: '14px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {proiectComplet?.client_nume || proiect.Client}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>PREDARE</div>
                <div style={{ fontSize: '14px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {subproiecte.length === 0 ? 
                    'Proiect complet' : 
                    `${statistici.subproiecteSelectate} din ${statistici.subproiecteDisponibile} subproiecte`
                  }
                </div>
              </div>
              {/* ELIMINAT: sumarele financiare */}
            </div>
          </div>

          {/* Butoane finale */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid #dee2e6'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#7f8c8d',
              fontWeight: '500'
            }}>
              Se va genera Procesul Verbal ca fișier DOCX
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={onClose}
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
                onClick={handleGeneratePV}
                disabled={
                  loading || 
                  !denumirePV.trim() || 
                  (subproiecte.length > 0 && subproiecteSelectate.size === 0)
                }
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (
                    loading || 
                    !denumirePV.trim() || 
                    (subproiecte.length > 0 && subproiecteSelectate.size === 0)
                  ) ? '#bdc3c7' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (
                    loading || 
                    !denumirePV.trim() || 
                    (subproiecte.length > 0 && subproiecteSelectate.size === 0)
                  ) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Se procesează...' : 'Generează Proces Verbal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
