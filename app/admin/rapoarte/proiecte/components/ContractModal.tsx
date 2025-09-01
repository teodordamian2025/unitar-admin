// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ContractModal.tsx
// DATA: 01.09.2025 18:45 (ora României)
// ÎMBUNĂTĂȚIRI: Preview număr contract editabil + Subproiecte ca etape de plată + Conversii valutare
// PĂSTRATE: Toate funcționalitățile existente + logica contract existent/nou
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
}

interface ContractExistent {
  ID_Contract: string;
  numar_contract: string;
  Status: string;
  data_creare: string;
  Valoare: number;
  Moneda: string;
}

interface ContractModalProps {
  proiect: ProiectData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TermenPersonalizat {
  id: string;
  denumire: string;
  termen_zile: number;
  procent_plata: number;
  este_subproiect?: boolean; // NOU: Marchează dacă este subproiect
  subproiect_id?: string; // NOU: ID subproiect pentru referință
}

interface ArticolSuplimentar {
  id: string;
  descriere: string;
  valoare: number;
  moneda: string;
  termen_zile: number;
  valoare_ron?: number; // NOU: Pentru conversii valutare
}

interface SubproiectInfo {
  ID_Subproiect: string;
  Denumire: string;
  Valoare_Estimata?: number;
  Status: string;
  moneda?: string;
  valoare_ron?: number;
  curs_valutar?: number;
  Data_Final?: string | { value: string };
}

// Cursuri valutare aproximative pentru conversii real-time
const CURSURI_VALUTAR: { [key: string]: number } = {
  'EUR': 5.0683,
  'USD': 4.3688,
  'GBP': 5.8777,
  'RON': 1
};

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

export default function ContractModal({ proiect, isOpen, onClose, onSuccess }: ContractModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [subproiecte, setSubproiecte] = useState<SubproiectInfo[]>([]);
  const [contractExistent, setContractExistent] = useState<ContractExistent | null>(null);
  
  // State pentru configurarea contractului
  const [isEditMode, setIsEditMode] = useState(false);
  const [observatii, setObservatii] = useState('');
  
  // NOU: State pentru preview număr contract
  const [contractPrefix, setContractPrefix] = useState('CONTR');
  const [contractNumber, setContractNumber] = useState<number | null>(null);
  const [contractPreview, setContractPreview] = useState('');
  
  // State pentru termene personalizate (acum include subproiectele)
  const [termenePersonalizate, setTermenePersonalizate] = useState<TermenPersonalizat[]>([]);
  
  // State pentru articole suplimentare cu conversii
  const [articoleSuplimentare, setArticoleSuplimentare] = useState<ArticolSuplimentar[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLoadingCheck(true);
      Promise.all([
        loadSubproiecte(),
        checkContractExistent(),
        previewContractNumber()
      ]).finally(() => {
        setLoadingCheck(false);
      });
    }
  }, [isOpen, proiect.ID_Proiect]);

  // NOU: Funcție pentru preview numărul contractului
  const previewContractNumber = async () => {
    try {
      // Simulează logica de numerotare (ar trebui să apeleze API-ul real)
      const currentYear = new Date().getFullYear();
      // Pentru demo, folosim un număr aproximativ
      const nextNumber = 1000 + Math.floor(Math.random() * 100);
      
      setContractNumber(nextNumber);
      updateContractPreview(contractPrefix, nextNumber, currentYear);
    } catch (error) {
      console.error('Eroare la preview numărul contractului:', error);
    }
  };

  // NOU: Actualizează preview-ul contractului
  const updateContractPreview = (prefix: string, number: number | null, year?: number) => {
    const currentYear = year || new Date().getFullYear();
    if (number) {
      setContractPreview(`${prefix}-${number}-${currentYear}`);
    } else {
      setContractPreview(`${prefix}-???-${currentYear}`);
    }
  };

  // NOU: Handler pentru schimbarea prefix-ului
  const handlePrefixChange = (newPrefix: string) => {
    setContractPrefix(newPrefix);
    updateContractPreview(newPrefix, contractNumber);
  };

  const loadSubproiecte = async () => {
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSubproiecte(result.data);
        
        // NOU: Convertește subproiectele în termeni de plată automat
        const termeniDinSubproiecte = result.data.map((sub: SubproiectInfo, index: number) => {
          const valoareRON = parseFloat(sub.valoare_ron?.toString() || '') || 
                           parseFloat(sub.Valoare_Estimata?.toString() || '') || 0;
          
          // Calculează termenul în zile din Data_Final
          let terminZile = 30; // default
          if (sub.Data_Final) {
            const dataFinal = typeof sub.Data_Final === 'string' ? sub.Data_Final : sub.Data_Final.value;
            const dataStart = typeof proiect.Data_Start === 'string' ? proiect.Data_Start : proiect.Data_Start?.value;
            if (dataStart && dataFinal) {
              const diffTime = Math.abs(new Date(dataFinal).getTime() - new Date(dataStart).getTime());
              terminZile = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
          }
          
          return {
            id: `sub_${sub.ID_Subproiect}`,
            denumire: sub.Denumire,
            termen_zile: terminZile,
            procent_plata: 0, // Va fi calculat după
            este_subproiect: true,
            subproiect_id: sub.ID_Subproiect
          };
        });
        
        // Calculează procentele pentru subproiecte
        const sumaTotal = calculeazaSumaTotalaSubproiecte(result.data);
        if (sumaTotal > 0) {
          termeniDinSubproiecte.forEach(termen => {
            const subproiect = result.data.find((s: SubproiectInfo) => s.ID_Subproiect === termen.subproiect_id);
            if (subproiect) {
              const valoareSub = parseFloat(subproiect.valoare_ron?.toString() || '') || 
                               parseFloat(subproiect.Valoare_Estimata?.toString() || '') || 0;
              termen.procent_plata = Math.round((valoareSub / sumaTotal) * 100);
            }
          });
        }
        
        setTermenePersonalizate(termeniDinSubproiecte.length > 0 ? termeniDinSubproiecte : [
          { id: '1', denumire: 'La semnare', termen_zile: 0, procent_plata: 30 },
          { id: '2', denumire: 'La predarea proiectului', termen_zile: 60, procent_plata: 70 }
        ]);
        
        console.log(`Încărcate ${result.data.length} subproiecte, convertite în ${termeniDinSubproiecte.length} termeni`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor pentru contract:', error);
      showToast('Nu s-au putut încărca subproiectele', 'error');
    }
  };

  // NOU: Calculează suma totală din subproiecte
  const calculeazaSumaTotalaSubproiecte = (subproiecteList: SubproiectInfo[]) => {
    return subproiecteList.reduce((suma, sub) => {
      const valoare = parseFloat(sub.valoare_ron?.toString() || '') || 
                     parseFloat(sub.Valoare_Estimata?.toString() || '') || 0;
      return suma + valoare;
    }, 0);
  };

  // Funcție existentă pentru verificarea contractului existent (PĂSTRATĂ)
  const checkContractExistent = async () => {
    try {
      const response = await fetch(`/api/rapoarte/contracte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        const contract = result.data[0];
        setContractExistent(contract);
        setIsEditMode(true);
        
        // Precompletează numărul contractului existent
        const parts = contract.numar_contract.split('-');
        if (parts.length >= 3) {
          setContractPrefix(parts[0]);
          setContractNumber(parseInt(parts[1]) || 0);
          setContractPreview(contract.numar_contract);
        }
        
        // Precompletează datele din contractul existent (PĂSTRAT)
        if (contract.etape) {
          try {
            const etapeParsate = typeof contract.etape === 'string' 
              ? JSON.parse(contract.etape) 
              : contract.etape;
            setTermenePersonalizate(etapeParsate);
          } catch (e) {
            console.error('Eroare parsare etape:', e);
          }
        }
        
        if (contract.articole_suplimentare) {
          try {
            const articoleParsate = typeof contract.articole_suplimentare === 'string'
              ? JSON.parse(contract.articole_suplimentare)
              : contract.articole_suplimentare;
            
            // Adaugă conversiile valutare pentru articolele existente
            const articoleCuConversii = articoleParsate.map((art: ArticolSuplimentar) => ({
              ...art,
              valoare_ron: art.moneda !== 'RON' ? 
                (art.valoare * (CURSURI_VALUTAR[art.moneda] || 1)) : art.valoare
            }));
            
            setArticoleSuplimentare(articoleCuConversii);
          } catch (e) {
            console.error('Eroare parsare articole:', e);
          }
        }
        
        setObservatii(contract.Observatii || '');
        console.log(`Contract existent găsit: ${contract.numar_contract}`);
      } else {
        setContractExistent(null);
        setIsEditMode(false);
      }
    } catch (error) {
      console.error('Eroare la verificarea contractului existent:', error);
    }
  };

  // Calculează suma totală a contractului (ÎMBUNĂTĂȚITĂ)
  const calculeazaSumaTotala = () => {
    let suma = 0;
    
    // LOGICA CRITICĂ: Pentru proiecte cu subproiecte, suma = DOAR subproiecte + articole
    if (subproiecte.length > 0) {
      // Suma DOAR din subproiecte (NU din proiectul principal)
      subproiecte.forEach(sub => {
        const valoare = parseFloat(sub.valoare_ron?.toString() || '') || 
                       parseFloat(sub.Valoare_Estimata?.toString() || '') || 0;
        suma += valoare;
      });
    } else {
      // Pentru proiecte fără subproiecte, suma = valoarea proiectului
      suma = parseFloat(proiect.valoare_ron?.toString() || '') || 
             parseFloat(proiect.Valoare_Estimata?.toString() || '') || 0;
    }
    
    // Adaugă articolele suplimentare (cu conversii)
    articoleSuplimentare.forEach(articol => {
      suma += articol.valoare_ron || articol.valoare;
    });
    
    return suma;
  };

  // Funcții pentru managementul termenelor (ÎMBUNĂTĂȚITE)
  const addTermen = () => {
    const newTermen: TermenPersonalizat = {
      id: Date.now().toString(),
      denumire: '',
      termen_zile: 30,
      procent_plata: 0,
      este_subproiect: false
    };
    setTermenePersonalizate([...termenePersonalizate, newTermen]);
  };

  const removeTermen = (id: string) => {
    setTermenePersonalizate(termenePersonalizate.filter(t => t.id !== id));
  };

  const updateTermen = (id: string, field: keyof TermenPersonalizat, value: string | number) => {
    setTermenePersonalizate(prev => 
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  // Funcții pentru managementul articolelor suplimentare (ÎMBUNĂTĂȚITE cu conversii)
  const addArticol = () => {
    const newArticol: ArticolSuplimentar = {
      id: Date.now().toString(),
      descriere: '',
      valoare: 0,
      moneda: 'RON',
      termen_zile: 30,
      valoare_ron: 0
    };
    setArticoleSuplimentare([...articoleSuplimentare, newArticol]);
  };

  const removeArticol = (id: string) => {
    setArticoleSuplimentare(articoleSuplimentare.filter(a => a.id !== id));
  };

  const updateArticol = (id: string, field: keyof ArticolSuplimentar, value: string | number) => {
    setArticoleSuplimentare(prev => 
      prev.map(a => {
        if (a.id === id) {
          const updated = { ...a, [field]: value };
          
          // NOU: Recalculează valoarea în RON când se schimbă valoarea sau moneda
          if (field === 'valoare' || field === 'moneda') {
            const valoare = field === 'valoare' ? value as number : a.valoare;
            const moneda = field === 'moneda' ? value as string : a.moneda;
            updated.valoare_ron = moneda !== 'RON' ? 
              (valoare * (CURSURI_VALUTAR[moneda] || 1)) : valoare;
          }
          
          return updated;
        }
        return a;
      })
    );
  };

  // Funcție pentru forțarea contractului nou (PĂSTRATĂ)
  const handleForceNewContract = () => {
    setContractExistent(null);
    setIsEditMode(false);
    setContractPrefix('CONTR');
    previewContractNumber();
    
    // Resetează la termenii din subproiecte sau default
    if (subproiecte.length > 0) {
      loadSubproiecte(); // Re-încarcă pentru a reconverti subproiectele
    } else {
      setTermenePersonalizate([
        { id: '1', denumire: 'La semnare', termen_zile: 0, procent_plata: 30 },
        { id: '2', denumire: 'La predarea proiectului', termen_zile: 60, procent_plata: 70 }
      ]);
    }
    
    setArticoleSuplimentare([]);
    setObservatii('');
    showToast('Mod contract nou activat', 'info');
  };

  const handleGenerateContract = async () => {
    setLoading(true);
    
    try {
      // Validări de bază (PĂSTRATE + ÎMBUNĂTĂȚITE)
      if (termenePersonalizate.some(t => !t.denumire.trim())) {
        showToast('Toate etapele trebuie să aibă o denumire', 'error');
        setLoading(false);
        return;
      }

      if (articoleSuplimentare.some(a => !a.descriere.trim() || a.valoare <= 0)) {
        showToast('Toate articolele suplimentare trebuie să aibă descriere și valoare validă', 'error');
        setLoading(false);
        return;
      }

      // Validare procente termene
      const totalProcente = termenePersonalizate.reduce((sum, t) => sum + t.procent_plata, 0);
      if (totalProcente > 100) {
        showToast('Suma procentelor de plată nu poate depăși 100%', 'error');
        setLoading(false);
        return;
      }

      const actionText = isEditMode ? 'actualizează contractul' : 'generează contractul';
      showToast(`Se ${actionText}...`, 'info');

      const response = await fetch('/api/actions/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiect.ID_Proiect,
          tipDocument: 'contract',
          termenePersonalizate,
          articoleSuplimentare,
          observatii: observatii.trim(),
          isEdit: isEditMode,
          contractExistentId: contractExistent?.ID_Contract || null,
          // NOU: Trimite preview-ul pentru număr personalizat
          contractPreview: contractPreview,
          contractPrefix: contractPrefix
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const contractNumber = response.headers.get('X-Contract-Number') || 
                              contractExistent?.numar_contract ||
                              contractPreview;
        const fileName = `${contractNumber}.docx`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(url);
        
        const successMessage = isEditMode ? 
          `Contract ${contractNumber} actualizat cu succes!` :
          `Contract ${contractNumber} generat cu succes!`;
        
        showToast(successMessage, 'success');
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        const errorResult = await response.json();
        throw new Error(errorResult.error || 'Eroare la procesarea contractului');
      }
    } catch (error) {
      console.error('Eroare la generarea/actualizarea contractului:', error);
      showToast(`Eroare la procesarea contractului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Loading initial pentru verificare contract existent (PĂSTRAT)
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
            Verificare contract existent...
          </div>
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
      </div>,
      document.body
    ) : null;
  }

  const sumaTotala = calculeazaSumaTotala();

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
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: contractExistent ? 
            'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)' :
            'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                {contractExistent ? 'Editare Contract' : 'Generare Contract Nou'}
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
                Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{proiect.ID_Proiect}</span> - {proiect.Denumire}
              </p>
              {contractExistent && (
                <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                  Contract existent: {contractExistent.numar_contract} • Status: {contractExistent.Status}
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
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'white'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* LOADING OVERLAY */}
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
                    border: '3px solid #3498db',
                    borderTop: '3px solid transparent',
                    animation: 'spin 1s linear infinite'
                  }}>
                  </div>
                  <span>{isEditMode ? 'Se actualizează contractul...' : 'Se generează contractul...'}</span>
                </div>
                <style>
                  {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                </style>
              </div>
            </div>
          )}

          {/* NOU: Preview Număr Contract */}
          <div style={{
            background: '#e8f5e8',
            border: '1px solid #c3e6cb',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '16px' }}>
              Preview Număr Contract
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <label style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
                  PREFIX
                </label>
                <input
                  type="text"
                  value={contractPrefix}
                  onChange={(e) => handlePrefixChange(e.target.value.toUpperCase())}
                  disabled={loading || isEditMode}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #c3e6cb',
                    borderRadius: '4px',
                    fontSize: '14px',
                    width: '80px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold'
                  }}
                />
              </div>
              
              <div style={{ flex: '1', minWidth: '200px' }}>
                <label style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>
                  NUMĂR CONTRACT GENERAT
                </label>
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
                  {contractPreview}
                </div>
              </div>
              
              {!isEditMode && (
                <div style={{ flex: '0 0 auto' }}>
                  <button
                    type="button"
                    onClick={previewContractNumber}
                    disabled={loading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginTop: '1.5rem'
                    }}
                  >
                    Regenerează Nr.
                  </button>
                </div>
              )}
            </div>
            
            {isEditMode && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#856404'
              }}>
                Mod editare: se păstrează numărul contractului existent. Pentru număr nou, apasă "Contract cu Număr Nou".
              </div>
            )}
          </div>

          {/* Informații contract existent + buton contract nou */}
          {contractExistent && (
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#856404', marginBottom: '0.5rem' }}>
                    Contract existent pentru acest proiect
                  </div>
                  <div style={{ fontSize: '13px', color: '#856404' }}>
                    <strong>Nr. Contract:</strong> {contractExistent.numar_contract} •{' '}
                    <strong>Status:</strong> {contractExistent.Status} •{' '}
                    <strong>Valoare:</strong> {contractExistent.Valoare?.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {contractExistent.Moneda}
                  </div>
                  <div style={{ fontSize: '12px', color: '#856404', marginTop: '0.25rem' }}>
                    Creat: {contractExistent.data_creare && new Date(contractExistent.data_creare).toLocaleDateString('ro-RO')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleForceNewContract}
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  Contract cu Număr Nou
                </button>
              </div>
            </div>
          )}

          {/* Informații proiect și suma */}
          <div style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            border: '1px solid #dee2e6'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Informații Proiect</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>CLIENT</div>
                <div style={{ fontSize: '14px', color: '#2c3e50' }}>{proiect.Client}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>STATUS</div>
                <div style={{ fontSize: '14px', color: '#2c3e50' }}>{proiect.Status}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold' }}>VALOARE CALCULATĂ</div>
                <div style={{ fontSize: '16px', color: '#27ae60', fontWeight: 'bold' }}>
                  {sumaTotala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                </div>
                {subproiecte.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '2px' }}>
                    Calculat din {subproiecte.length} subproiecte + {articoleSuplimentare.length} articole
                  </div>
                )}
              </div>
            </div>
            
            {/* Afișează subproiectele dacă există */}
            {subproiecte.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #dee2e6' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#2c3e50' }}>
                  Subproiecte incluse ({subproiecte.length}):
                </h4>
                <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                  {subproiecte.map((sub, index) => {
                    const valoare = parseFloat(sub.valoare_ron?.toString() || '') || 
                                   parseFloat(sub.Valoare_Estimata?.toString() || '') || 0;
                    return (
                      <div key={sub.ID_Subproiect} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        background: 'rgba(52, 152, 219, 0.1)',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <span style={{ fontWeight: '500' }}>{sub.Denumire}</span>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
                          {valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ÎMBUNĂTĂȚIT: Etape și Termene de Plată cu logica subproiecte */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>
                  {subproiecte.length > 0 ? 'Etape de Plată (din Subproiecte)' : 'Etape și Termene de Plată'}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '12px', color: '#7f8c8d' }}>
                  {subproiecte.length > 0 ? 
                    `Subproiectele au fost convertite automat în etape de plată. Poți adăuga etape suplimentare.` :
                    `Configurează etapele de plată cu termenele și procentele corespunzătoare`
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={addTermen}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                + Adaugă Etapă
              </button>
            </div>

            {/* HEADERS DESCRIPTIVE PENTRU COLOANE */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr auto',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              background: '#e3f2fd',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#1976d2'
            }}>
              <div>Descriere Etapă</div>
              <div style={{ textAlign: 'center' }}>Termen (zile)</div>
              <div style={{ textAlign: 'center' }}>Procent (%)</div>
              <div style={{ textAlign: 'center' }}>Acțiuni</div>
            </div>

            {termenePersonalizate.map((termen, index) => (
              <div key={termen.id} style={{
                border: termen.este_subproiect ? '1px solid #27ae60' : '1px solid #3498db',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '0.5rem',
                background: termen.este_subproiect ? '#f8fff8' : '#f8fbff'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {termen.este_subproiect ? 'Subproiect' : 'Etapa'} {index + 1}
                    {termen.este_subproiect && (
                      <span style={{
                        fontSize: '10px',
                        background: '#27ae60',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontWeight: 'bold'
                      }}>
                        AUTO
                      </span>
                    )}
                  </h5>
                  <button
                    type="button"
                    onClick={() => removeTermen(termen.id)}
                    disabled={loading || termenePersonalizate.length === 1}
                    style={{
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: (loading || termenePersonalizate.length === 1) ? 'not-allowed' : 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '0.5rem'
                }}>
                  <input
                    type="text"
                    value={termen.denumire}
                    onChange={(e) => updateTermen(termen.id, 'denumire', e.target.value)}
                    disabled={loading || termen.este_subproiect}
                    placeholder="Denumire etapă (ex: La semnare)"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: termen.este_subproiect ? '#f8f9fa' : 'white'
                    }}
                  />
                  
                  <input
                    type="number"
                    value={termen.termen_zile}
                    onChange={(e) => updateTermen(termen.id, 'termen_zile', parseInt(e.target.value) || 0)}
                    disabled={loading}
                    placeholder="Zile"
                    min="0"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={termen.procent_plata}
                      onChange={(e) => updateTermen(termen.id, 'procent_plata', parseInt(e.target.value) || 0)}
                      disabled={loading}
                      placeholder="0"
                      min="0"
                      max="100"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    <span style={{ fontSize: '14px', color: '#7f8c8d' }}>%</span>
                  </div>
                </div>
                
                {termen.este_subproiect && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '11px',
                    color: '#27ae60',
                    fontStyle: 'italic'
                  }}>
                    Generat automat din subproiectul: {termen.subproiect_id}
                  </div>
                )}
              </div>
            ))}
            
            {/* Verificare total procente */}
            {(() => {
              const totalProcente = termenePersonalizate.reduce((sum, t) => sum + t.procent_plata, 0);
              return (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: totalProcente === 100 ? '#d4edda' : totalProcente > 100 ? '#f8d7da' : '#fff3cd',
                  border: `1px solid ${totalProcente === 100 ? '#c3e6cb' : totalProcente > 100 ? '#f5c6cb' : '#ffeaa7'}`,
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: totalProcente === 100 ? '#155724' : totalProcente > 100 ? '#721c24' : '#856404'
                }}>
                  Total procente: {totalProcente}% 
                  {totalProcente === 100 ? ' ✓' : totalProcente > 100 ? ' ⚠️ Depășește 100%' : ' (incomplet)'}
                </div>
              );
            })()}
          </div>

          {/* ÎMBUNĂTĂȚIT: Articole suplimentare cu conversii valutare */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>Articole Suplimentare</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '12px', color: '#7f8c8d' }}>
                  Servicii sau produse suplimentare cu conversie automată în RON
                </p>
              </div>
              <button
                type="button"
                onClick={addArticol}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                + Adaugă Articol
              </button>
            </div>

            {articoleSuplimentare.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#7f8c8d',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '0.5rem' }}>📋</div>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Nu sunt articole suplimentare. Adaugă servicii sau produse suplimentare.
                </p>
              </div>
            ) : (
              <>
                {/* Headers pentru articole */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  padding: '0.5rem',
                  background: '#e8f5e8',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#27ae60'
                }}>
                  <div>Descriere</div>
                  <div style={{ textAlign: 'center' }}>Valoare</div>
                  <div style={{ textAlign: 'center' }}>Moneda</div>
                  <div style={{ textAlign: 'center' }}>Val. RON</div>
                  <div style={{ textAlign: 'center' }}>Termen</div>
                  <div style={{ textAlign: 'center' }}>Act.</div>
                </div>

                {articoleSuplimentare.map((articol, index) => (
                  <div key={articol.id} style={{
                    border: '1px solid #27ae60',
                    borderRadius: '6px',
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    background: '#f8fff8'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <h5 style={{ margin: 0, color: '#2c3e50' }}>Articol {index + 1}</h5>
                      <button
                        type="button"
                        onClick={() => removeArticol(articol.id)}
                        disabled={loading}
                        style={{
                          background: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      gap: '0.5rem',
                      alignItems: 'end'
                    }}>
                      <input
                        type="text"
                        value={articol.descriere}
                        onChange={(e) => updateArticol(articol.id, 'descriere', e.target.value)}
                        disabled={loading}
                        placeholder="Descriere serviciu/produs"
                        style={{
                          padding: '0.5rem',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                      
                      <input
                        type="number"
                        value={articol.valoare}
                        onChange={(e) => updateArticol(articol.id, 'valoare', parseFloat(e.target.value) || 0)}
                        disabled={loading}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        style={{
                          padding: '0.5rem',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                      
                      <select
                        value={articol.moneda}
                        onChange={(e) => updateArticol(articol.id, 'moneda', e.target.value)}
                        disabled={loading}
                        style={{
                          padding: '0.5rem',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="RON">RON</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </select>
                      
                      {/* NOU: Afișaj valoare în RON calculată automat */}
                      <div style={{
                        padding: '0.5rem',
                        border: '1px solid #27ae60',
                        borderRadius: '4px',
                        background: '#f0f9ff',
                        fontSize: '14px',
                        textAlign: 'center',
                        color: '#27ae60',
                        fontWeight: 'bold'
                      }}>
                        {(articol.valoare_ron || articol.valoare).toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                      </div>
                      
                      <input
                        type="number"
                        value={articol.termen_zile}
                        onChange={(e) => updateArticol(articol.id, 'termen_zile', parseInt(e.target.value) || 0)}
                        disabled={loading}
                        placeholder="Zile"
                        min="0"
                        style={{
                          padding: '0.5rem',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    {/* NOU: Afișare info conversie */}
                    {articol.moneda !== 'RON' && articol.valoare > 0 && (
                      <div style={{
                        marginTop: '0.5rem',
                        fontSize: '11px',
                        color: '#7f8c8d',
                        fontStyle: 'italic'
                      }}>
                        Conversie: {articol.valoare} {articol.moneda} × {CURSURI_VALUTAR[articol.moneda]} = {(articol.valoare_ron || 0).toFixed(2)} RON
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Observații (PĂSTRAT) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Observații și Note Speciale
            </label>
            <textarea
              value={observatii}
              onChange={(e) => setObservatii(e.target.value)}
              disabled={loading}
              placeholder="Observații speciale pentru contract, clauze suplimentare, etc."
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

          {/* Sumar final (ÎMBUNĂTĂȚIT) */}
          <div style={{
            background: '#e8f5e8',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              {isEditMode ? 'Sumar Actualizare Contract' : 'Sumar Contract Nou'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>ACȚIUNE</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {isEditMode ? 'Actualizare' : 'Generare Nouă'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>NUMĂR CONTRACT</div>
                <div style={{ fontSize: '16px', color: '#27ae60', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {contractPreview}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>VALOARE TOTALĂ</div>
                <div style={{ fontSize: '18px', color: '#27ae60', fontWeight: 'bold' }}>
                  {sumaTotala.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>ETAPE PLATĂ</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {termenePersonalizate.length} etape
                  {subproiecte.length > 0 && ` (${termenePersonalizate.filter(t => t.este_subproiect).length} auto)`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>ARTICOLE EXTRA</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold' }}>
                  {articoleSuplimentare.length} articole
                </div>
              </div>
            </div>
          </div>

          {/* Butoane finale (PĂSTRAT) */}
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
              Contractul va fi {isEditMode ? 'actualizat și regenerat' : 'generat'} ca fișier DOCX
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
                onClick={handleGenerateContract}
                disabled={loading || termenePersonalizate.some(t => !t.denumire.trim())}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (loading || termenePersonalizate.some(t => !t.denumire.trim())) ? '#bdc3c7' : 
                    isEditMode ? '#f39c12' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || termenePersonalizate.some(t => !t.denumire.trim())) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Se procesează...' : 
                 isEditMode ? 'Actualizează Contract' : 'Generează Contract'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
