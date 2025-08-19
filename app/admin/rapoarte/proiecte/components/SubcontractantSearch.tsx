// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SubcontractantSearch.tsx
// DATA: 20.08.2025 00:15 (ora României)
// DESCRIERE: FIX pentru conflictul de nume selectedSubcontractant
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

interface SubcontractantSearchProps {
  onSubcontractantSelected?: (subcontractant: any) => void;
  onShowAddModal?: () => void;
  selectedSubcontractant?: string;
  className?: string;
  showInModal?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

interface Subcontractant {
  id: string;
  nume: string;
  tip_client: string;
  cui?: string;
  cnp?: string;
  email?: string;
  telefon?: string;
  adresa?: string;
  oras?: string;
  judet?: string;
  activ?: boolean;
}

interface ANAFResult {
  denumire: string;
  cui: string;
  nrRegCom: string;
  adresa: string;
  status: string;
  platitorTva: string;
}

// Toast system cu Z-index compatibil
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

export default function SubcontractantSearch({ 
  onSubcontractantSelected,
  onShowAddModal,
  selectedSubcontractant: initialSelectedSubcontractant = '',
  className = '',
  showInModal = false,
  disabled = false,
  placeholder = "Caută subcontractant sau CUI..."
}: SubcontractantSearchProps) {
  const [searchTerm, setSearchTerm] = useState(initialSelectedSubcontractant);
  const [subcontractanti, setSubcontractanti] = useState<Subcontractant[]>([]);
  const [anafResults, setAnafResults] = useState<ANAFResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Subcontractant | null>(null);
  const [searchMode, setSearchMode] = useState<'local' | 'anaf'>('local');
  const [loadingAnaf, setLoadingAnaf] = useState(false);

  // Încarcă subcontractanți inițiali
  useEffect(() => {
    loadSubcontractanti();
  }, []);

  // Setează valoarea inițială
  useEffect(() => {
    if (initialSelectedSubcontractant && initialSelectedSubcontractant !== searchTerm) {
      setSearchTerm(initialSelectedSubcontractant);
      const foundSubcontractant = subcontractanti.find(s => 
        s.nume === initialSelectedSubcontractant || 
        s.cui === initialSelectedSubcontractant ||
        s.id === initialSelectedSubcontractant
      );
      if (foundSubcontractant) {
        setSelectedItem(foundSubcontractant);
      }
    }
  }, [initialSelectedSubcontractant, subcontractanti]);

  const loadSubcontractanti = async (search?: string) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search && search.trim().length > 0) {
        queryParams.append('search', search.trim());
      }
      queryParams.append('limit', '20');

      const response = await fetch(`/api/rapoarte/subcontractanti?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSubcontractanti(data.data || []);
      } else {
        showToast('Eroare la încărcarea subcontractanților', 'error');
        setSubcontractanti([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subcontractanților:', error);
      showToast('Eroare de conectare', 'error');
      setSubcontractanti([]);
    } finally {
      setLoading(false);
    }
  };

  const searchInANAF = async (cui: string) => {
    if (!cui || cui.trim().length < 6) return;
    
    setLoadingAnaf(true);
    try {
      const response = await fetch(`/api/anaf/company-info?cui=${encodeURIComponent(cui.trim())}`);
      const result = await response.json();

      if (result.success) {
        setAnafResults([{
          denumire: result.data.denumire,
          cui: result.data.cui,
          nrRegCom: result.data.nrRegCom,
          adresa: result.data.adresa,
          status: result.data.status,
          platitorTva: result.data.platitorTva
        }]);
        showToast('Găsit în ANAF!', 'success');
      } else {
        setAnafResults([]);
        showToast('Nu a fost găsit în ANAF', 'info');
      }
    } catch (error) {
      console.error('Eroare căutare ANAF:', error);
      showToast('Eroare la căutarea în ANAF', 'error');
      setAnafResults([]);
    } finally {
      setLoadingAnaf(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSelectedItem(null);
    setAnafResults([]);
    
    // Detectează dacă este CUI (doar cifre)
    const isCUI = /^\d+$/.test(value.trim()) && value.trim().length >= 6;
    
    if (isCUI) {
      setSearchMode('anaf');
      setShowSuggestions(true);
      // Căutare ANAF pentru CUI
      if (value.trim().length >= 6) {
        searchInANAF(value);
      }
    } else {
      setSearchMode('local');
      if (value.trim().length >= 2) {
        setShowSuggestions(true);
        loadSubcontractanti(value);
      } else if (value.trim().length === 0) {
        setShowSuggestions(true);
        loadSubcontractanti();
      } else {
        setShowSuggestions(false);
      }
    }

    // Notifică părintele că selecția a fost resetată
    if (onSubcontractantSelected) {
      onSubcontractantSelected(null);
    }
  };

  const handleSelectSubcontractant = (subcontractant: Subcontractant) => {
    setSearchTerm(subcontractant.nume);
    setSelectedItem(subcontractant);
    setShowSuggestions(false);
    
    if (onSubcontractantSelected) {
      onSubcontractantSelected({
        id: subcontractant.id,
        nume: subcontractant.nume,
        cui: subcontractant.cui,
        tip_client: subcontractant.tip_client,
        telefon: subcontractant.telefon,
        email: subcontractant.email
      });
    }
  };

  const handleSelectAnafResult = (anafResult: ANAFResult) => {
    setSearchTerm(anafResult.denumire);
    setShowSuggestions(false);
    
    if (onSubcontractantSelected) {
      onSubcontractantSelected({
        nume: anafResult.denumire,
        cui: anafResult.cui,
        nr_reg_com: anafResult.nrRegCom,
        adresa: anafResult.adresa,
        tip_client: anafResult.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
        din_anaf: true // Marker pentru a știi că vine din ANAF
      });
    }
    
    showToast('Date preluate din ANAF. Completează detaliile și salvează.', 'info');
  };

  const handleFocus = () => {
    if (!disabled && (subcontractanti.length > 0 || anafResults.length > 0)) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const getTipClientIcon = (tip: string) => {
    if (tip === 'Juridic' || tip === 'Juridic_TVA') return '🏢';
    return '👤';
  };

  const getTipClientLabel = (tip: string) => {
    switch (tip) {
      case 'Juridic': return 'Juridic';
      case 'Juridic_TVA': return 'Juridic (TVA)';
      case 'Fizic': return 'Fizic';
      default: return tip;
    }
  };

  const containerStyle = showInModal ? {
    background: 'transparent',
    margin: 0
  } : {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    margin: '0.5rem 0'
  };

  return (
    <div className={className} style={containerStyle}>
      {!showInModal && (
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#2c3e50',
            marginBottom: '0.5rem'
          }}>
            🗃️ Subcontractant
          </label>
          <p style={{
            margin: 0,
            fontSize: '12px',
            color: '#7f8c8d'
          }}>
            Caută în baza de date sau introduce CUI pentru căutare ANAF
          </p>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled || loading}
          placeholder={loading ? 'Se încarcă...' : placeholder}
          style={{
            width: '100%',
            padding: '0.75rem',
            paddingRight: '3.5rem',
            border: `1px solid ${selectedItem ? '#27ae60' : '#dee2e6'}`,
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: disabled ? '#f8f9fa' : 'white',
            color: disabled ? '#6c757d' : '#2c3e50'
          }}
        />

        {/* Indicator status și mod căutare */}
        <div style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          {loadingAnaf && (
            <span style={{ color: '#3498db', fontSize: '10px' }} title="Căutare ANAF">🔍</span>
          )}
          {loading && (
            <span style={{ color: '#3498db', fontSize: '12px' }}>⏳</span>
          )}
          {selectedItem && (
            <span style={{ color: '#27ae60', fontSize: '12px' }}>✅</span>
          )}
          {!loading && !selectedItem && searchTerm && (
            <span style={{ color: '#f39c12', fontSize: '12px' }}>⚠️</span>
          )}
          {searchMode === 'anaf' && (
            <span style={{ color: '#3498db', fontSize: '10px' }} title="Mod căutare ANAF">🏢</span>
          )}
        </div>

        {/* Dropdown cu sugestii */}
        {showSuggestions && (searchMode === 'local' ? subcontractanti.length > 0 : anafResults.length > 0) && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #dee2e6',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '250px',
            overflowY: 'auto'
          }}>
            {/* Rezultate din baza de date locală */}
            {searchMode === 'local' && subcontractanti.map(subcontractant => (
              <div
                key={subcontractant.id}
                onClick={() => handleSelectSubcontractant(subcontractant)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f2f6',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f8f9fa';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: '600', 
                      color: '#2c3e50',
                      fontSize: '14px'
                    }}>
                      {subcontractant.nume}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#7f8c8d',
                      marginTop: '0.25rem'
                    }}>
                      {subcontractant.cui && `CUI: ${subcontractant.cui}`}
                      {subcontractant.cnp && `CNP: ${subcontractant.cnp}`}
                    </div>
                    {(subcontractant.email || subcontractant.telefon) && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#95a5a6',
                        marginTop: '0.25rem'
                      }}>
                        {subcontractant.email && `📧 ${subcontractant.email}`}
                        {subcontractant.telefon && ` 📞 ${subcontractant.telefon}`}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.25rem'
                  }}>
                    <span style={{ fontSize: '16px' }}>
                      {getTipClientIcon(subcontractant.tip_client)}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: '#7f8c8d',
                      textAlign: 'center'
                    }}>
                      {getTipClientLabel(subcontractant.tip_client)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Rezultate din ANAF */}
            {searchMode === 'anaf' && anafResults.map((result, index) => (
              <div
                key={index}
                onClick={() => handleSelectAnafResult(result)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f2f6',
                  background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.05) 0%, rgba(46, 204, 113, 0.05) 100%)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(52, 152, 219, 0.05) 0%, rgba(46, 204, 113, 0.05) 100%)';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem'
                    }}>
                      <span style={{ fontSize: '14px' }}>🏢</span>
                      <span style={{ 
                        fontWeight: '600', 
                        color: '#2c3e50',
                        fontSize: '14px'
                      }}>
                        {result.denumire}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: '#3498db',
                        color: 'white',
                        borderRadius: '8px',
                        fontWeight: 'bold'
                      }}>
                        ANAF
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#7f8c8d',
                      marginBottom: '0.25rem'
                    }}>
                      CUI: {result.cui} | Reg. Com: {result.nrRegCom || 'N/A'}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#95a5a6'
                    }}>
                      {result.adresa}
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.25rem'
                  }}>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: result.status === 'Activ' ? '#27ae60' : '#e74c3c',
                      color: 'white',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}>
                      {result.status}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: result.platitorTva === 'Da' ? '#f39c12' : '#95a5a6',
                      color: 'white',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}>
                      {result.platitorTva === 'Da' ? 'TVA' : 'FĂRĂ TVA'}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading states */}
            {(loading || loadingAnaf) && (
              <div style={{
                padding: '1rem',
                textAlign: 'center',
                color: '#7f8c8d',
                fontSize: '14px'
              }}>
                {loadingAnaf ? '🔍 Se caută în ANAF...' : '⏳ Se încarcă subcontractanți...'}
              </div>
            )}
          </div>
        )}

        {/* Mesaj no results */}
        {showSuggestions && !loading && !loadingAnaf && (
          <>
            {searchMode === 'local' && subcontractanti.length === 0 && searchTerm.trim().length >= 2 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #dee2e6',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '1rem',
                textAlign: 'center',
                color: '#7f8c8d',
                fontSize: '14px'
              }}>
                <div>Nu au fost găsiți subcontractanți pentru "{searchTerm}"</div>
                {onShowAddModal && (
                  <button
                    onClick={onShowAddModal}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    + Adaugă subcontractant nou
                  </button>
                )}
              </div>
            )}
            
            {searchMode === 'anaf' && anafResults.length === 0 && searchTerm.trim().length >= 6 && !loadingAnaf && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #dee2e6',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '1rem',
                textAlign: 'center',
                color: '#7f8c8d',
                fontSize: '14px'
              }}>
                <div>CUI-ul "{searchTerm}" nu a fost găsit în ANAF</div>
                {onShowAddModal && (
                  <button
                    onClick={onShowAddModal}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    + Adaugă manual
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Info despre subcontractantul selectat */}
      {selectedItem && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)',
          border: '1px solid rgba(39, 174, 96, 0.2)',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#27ae60'
              }}>
                ✅ Subcontractant selectat
              </div>
              <div style={{
                fontSize: '11px',
                color: '#7f8c8d',
                marginTop: '0.25rem'
              }}>
                {selectedItem.cui && `CUI: ${selectedItem.cui}`}
                {selectedItem.telefon && ` • ${selectedItem.telefon}`}
              </div>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedItem(null);
                if (onSubcontractantSelected) {
                  onSubcontractantSelected(null);
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#e74c3c',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0.25rem'
              }}
              title="Șterge selecția"
            >
              ❌
            </button>
          </div>
        </div>
      )}

      {/* Buton pentru adăugare subcontractant nou */}
      {!showInModal && onShowAddModal && (
        <div style={{ marginTop: '0.75rem' }}>
          <button
            onClick={onShowAddModal}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)',
              transition: 'all 0.3s ease'
            }}
          >
            + Adaugă subcontractant nou
          </button>
        </div>
      )}
    </div>
  );
}
