// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ContractModal.tsx
// DATA: 26.08.2025 21:35 (ora României)
// DESCRIERE: Modal complet pentru configurarea și generarea contractelor
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';

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
}

interface ArticolSuplimentar {
  id: string;
  descriere: string;
  valoare: number;
  moneda: string;
  termen_zile: number;
}

interface SubproiectInfo {
  ID_Subproiect: string;
  Denumire: string;
  Valoare_Estimata?: number;
  Status: string;
  moneda?: string;
  valoare_ron?: number;
}

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
  const [subproiecte, setSubproiecte] = useState<SubproiectInfo[]>([]);
  const [loadingSubproiecte, setLoadingSubproiecte] = useState(false);
  
  // State pentru configurarea contractului
  const [tipDocument, setTipDocument] = useState<'contract' | 'pv' | 'anexa'>('contract');
  const [observatii, setObservatii] = useState('');
  
  // State pentru termene personalizate
  const [termenePersonalizate, setTermenePersonalizate] = useState<TermenPersonalizat[]>([
    { id: '1', denumire: 'La semnare', termen_zile: 0, procent_plata: 30 },
    { id: '2', denumire: 'La predarea proiectului', termen_zile: 60, procent_plata: 70 }
  ]);
  
  // State pentru articole suplimentare
  const [articoleSuplimentare, setArticoleSuplimentare] = useState<ArticolSuplimentar[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadSubproiecte();
    }
  }, [isOpen, proiect.ID_Proiect]);

  const loadSubproiecte = async () => {
    setLoadingSubproiecte(true);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setSubproiecte(result.data);
        console.log(`Încărcate ${result.data.length} subproiecte pentru contract`);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor pentru contract:', error);
      showToast('Nu s-au putut încărca subproiectele', 'error');
    } finally {
      setLoadingSubproiecte(false);
    }
  };

  // Calculează suma totală a contractului
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
    
    // Adaugă articolele suplimentare
    articoleSuplimentare.forEach(articol => {
      let valoareRON = articol.valoare;
      
      // Conversie simplă pentru articolele suplimentare (ar trebui să preia cursul real)
      if (articol.moneda !== 'RON') {
        const cursuriApproximative: { [key: string]: number } = {
          'EUR': 5.0683,
          'USD': 4.3688,
          'GBP': 5.8777
        };
        valoareRON = articol.valoare * (cursuriApproximative[articol.moneda] || 1);
      }
      
      suma += valoareRON;
    });
    
    return suma;
  };

  // Funcții pentru managementul termenelor
  const addTermen = () => {
    const newTermen: TermenPersonalizat = {
      id: Date.now().toString(),
      denumire: '',
      termen_zile: 30,
      procent_plata: 0
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

  // Funcții pentru managementul articolelor suplimentare
  const addArticol = () => {
    const newArticol: ArticolSuplimentar = {
      id: Date.now().toString(),
      descriere: '',
      valoare: 0,
      moneda: 'RON',
      termen_zile: 30
    };
    setArticoleSuplimentare([...articoleSuplimentare, newArticol]);
  };

  const removeArticol = (id: string) => {
    setArticoleSuplimentare(articoleSuplimentare.filter(a => a.id !== id));
  };

  const updateArticol = (id: string, field: keyof ArticolSuplimentar, value: string | number) => {
    setArticoleSuplimentare(prev => 
      prev.map(a => a.id === id ? { ...a, [field]: value } : a)
    );
  };

  const handleGenerateContract = async () => {
    setLoading(true);
    
    try {
      // Validări de bază
      if (termenePersonalizate.some(t => !t.denumire.trim())) {
        showToast('Toate termenele trebuie să aibă o denumire', 'error');
        setLoading(false);
        return;
      }

      if (articoleSuplimentare.some(a => !a.descriere.trim() || a.valoare <= 0)) {
        showToast('Toate articolele suplimentare trebuie să aibă descriere și valoare validă', 'error');
        setLoading(false);
        return;
      }

      // Validare procente termene (opțional să ajungă la 100%)
      const totalProcente = termenePersonalizate.reduce((sum, t) => sum + t.procent_plata, 0);
      if (totalProcente > 100) {
        showToast('Suma procentelor de plată nu poate depăși 100%', 'error');
        setLoading(false);
        return;
      }

      showToast(`Se generează ${tipDocument === 'contract' ? 'contractul' : tipDocument === 'pv' ? 'PV-ul' : 'anexa'}...`, 'info');

      const response = await fetch('/api/actions/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiectId: proiect.ID_Proiect,
          tipDocument,
          termenePersonalizate,
          articoleSuplimentare,
          observatii: observatii.trim()
        })
      });

      if (response.ok) {
        // Pentru download de fișier DOCX
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Extrage numele fișierului din header-uri
        const contractNumber = response.headers.get('X-Contract-Number') || 'contract';
        const fileName = `${contractNumber}.docx`;
        
        // Crează link pentru download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        
        showToast(`${tipDocument.charAt(0).toUpperCase() + tipDocument.slice(1)} generat cu succes!`, 'success');
        
        if (onSuccess) {
          onSuccess();
        }
        
        onClose();
      } else {
        const errorResult = await response.json();
        throw new Error(errorResult.error || 'Eroare la generarea contractului');
      }
    } catch (error) {
      console.error('Eroare la generarea contractului:', error);
      showToast(`Eroare la generarea contractului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const sumaTotala = calculeazaSumaTotala();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '1000px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
          borderRadius: '8px 8px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>
              📄 Generare Contract
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#6c757d'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
            Proiect: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#3498db' }}>{proiect.ID_Proiect}</span> - {proiect.Denumire}
          </p>
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
                  <span>Se generează contractul...</span>
                </div>
                <style>
                  {`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}
                </style>
              </div>
            </div>
          )}

          {/* Tip document */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Tip Document</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {(['contract', 'pv', 'anexa'] as const).map(tip => (
                <label key={tip} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${tipDocument === tip ? '#3498db' : '#dee2e6'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: tipDocument === tip ? '#f0f8ff' : 'white'
                }}>
                  <input
                    type="radio"
                    name="tipDocument"
                    value={tip}
                    checked={tipDocument === tip}
                    onChange={(e) => setTipDocument(e.target.value as any)}
                    disabled={loading}
                  />
                  <span style={{ fontWeight: '500' }}>
                    {tip === 'contract' ? 'Contract de servicii' :
                     tip === 'pv' ? 'Proces Verbal Predare' :
                     'Anexă contract'}
                  </span>
                </label>
              ))}
            </div>
          </div>

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

          {/* Termene personalizate */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>Termene și Etape de Plată</h3>
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
                + Adaugă Termen
              </button>
            </div>

            {termenePersonalizate.map((termen, index) => (
              <div key={termen.id} style={{
                border: '1px solid #3498db',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '0.5rem',
                background: '#f8fbff'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h5 style={{ margin: 0, color: '#2c3e50' }}>Etapa {index + 1}</h5>
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
                    disabled={loading}
                    placeholder="Denumire etapă (ex: La semnare)"
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      fontSize: '14px'
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

          {/* Articole suplimentare */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>Articole Suplimentare</h3>
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
              articoleSuplimentare.map((articol, index) => (
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
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    gap: '0.5rem'
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
                    
                    <input
                      type="number"
                      value={articol.termen_zile}
                      onChange={(e) => updateArticol(articol.id, 'termen_zile', parseInt(e.target.value) || 0)}
                      disabled={loading}
                      placeholder="Termen zile"
                      min="0"
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Observații */}
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

          {/* Sumar final */}
          <div style={{
            background: '#e8f5e8',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Sumar Contract</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#155724', fontWeight: 'bold' }}>TIP DOCUMENT</div>
                <div style={{ fontSize: '16px', color: '#2c3e50', fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {tipDocument}
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
              Contractul va fi generat ca fișier DOCX cu toate datele configurate
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
                  background: (loading || termenePersonalizate.some(t => !t.denumire.trim())) ? '#bdc3c7' : '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || termenePersonalizate.some(t => !t.denumire.trim())) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Se generează...' : `📄 Generează ${tipDocument.charAt(0).toUpperCase() + tipDocument.slice(1)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
