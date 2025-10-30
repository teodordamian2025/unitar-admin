// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/SubcontractantSearch.tsx
// DATA: 24.08.2025 19:15 (ora României)
// MODIFICAT: Adăugată salvare automată din ANAF similar cu ANAFClientSearch.tsx
// PĂSTRATE: Toate funcționalitățile existente de căutare locală și ANAF
// ==================================================================

'use client';

import { useState, useEffect, useRef } from 'react';

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
  judet?: string;
  oras?: string;
  codPostal?: string;
  telefon?: string;
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

  // NOU: State pentru dialog import automat
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [anafDataForImport, setAnafDataForImport] = useState<ANAFResult | null>(null);

  // FIX: Debounce timer pentru input greoi
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    // FIX: Prevent race conditions - abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);

    try {
      const queryParams = new URLSearchParams();
      if (search && search.trim().length > 0) {
        queryParams.append('search', search.trim());
      }
      queryParams.append('limit', '20');

      const response = await fetch(`/api/rapoarte/subcontractanti?${queryParams.toString()}`, {
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSubcontractanti(data.data || []);
      } else {
        console.error('API error:', data.error);
        setSubcontractanti([]);
      }
    } catch (error: any) {
      // FIX: Ignore abort errors (normal când user type rapid)
      if (error.name === 'AbortError') {
        console.log('Request aborted (normal behavior)');
        return;
      }

      console.error('Eroare la încărcarea subcontractanților:', error);
      // Nu mai arăt toast pentru fiecare eroare - era prea intruziv
      setSubcontractanti([]);
    } finally {
      setLoading(false);
    }
  };

  // MODIFICAT: Căutare în ANAF cu verificare existență în BD
  const searchInANAF = async (cui: string) => {
    if (!cui || cui.trim().length < 6) return;

    setLoadingAnaf(true);
    try {
      // Primul pas: caută în ANAF
      const response = await fetch(`/api/anaf/company-info?cui=${encodeURIComponent(cui.trim())}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const anafData: ANAFResult = {
          denumire: result.data.denumire || '',
          cui: result.data.cui || cui,
          nrRegCom: result.data.nrRegCom || '',
          adresa: result.data.adresa || '',
          status: result.data.status || 'N/A',
          platitorTva: result.data.platitorTva || 'Nu',
          judet: result.data.judet || '',
          oras: result.data.oras || '',
          codPostal: result.data.codPostal || '',
          telefon: result.data.telefon || ''
        };

        // Al doilea pas: verifică dacă există în BD
        const existingSubcontractant = await checkExistingSubcontractant(anafData.cui);

        if (existingSubcontractant) {
          // Există în BD - returnează direct
          setAnafResults([]);
          setSubcontractanti([existingSubcontractant]);
          showToast('Subcontractant găsit în baza de date!', 'success');
        } else {
          // Nu există în BD - afișează pentru import
          setAnafResults([anafData]);
          setAnafDataForImport(anafData);
          setShowImportDialog(true);
          showToast('Găsit în ANAF! Poți să îl imporți automat.', 'info');
        }
      } else {
        setAnafResults([]);
        // Nu mai arăt toast pentru "not found" - era prea intruziv
        console.log('CUI nu a fost găsit în ANAF:', cui);
      }
    } catch (error: any) {
      console.error('Eroare căutare ANAF:', error);
      // FIX: Nu aruncă toast error - doar log pentru debugging
      setAnafResults([]);
    } finally {
      setLoadingAnaf(false);
    }
  };

  // NOU: Verifică dacă subcontractantul există în BD
  const checkExistingSubcontractant = async (cui: string): Promise<Subcontractant | null> => {
    try {
      const response = await fetch(`/api/rapoarte/subcontractanti?cui=${encodeURIComponent(cui)}&limit=1`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        return data.data[0];
      }
      return null;
    } catch (error) {
      console.error('Eroare verificare subcontractant existent:', error);
      return null;
    }
  };

  // NOU: Import automat din ANAF în BD
  const importFromANAF = async (anafData: ANAFResult) => {
    // FIX: Validare date înainte de import
    if (!anafData || !anafData.denumire || !anafData.cui) {
      showToast('Date ANAF incomplete - nu se poate importa', 'error');
      return;
    }

    try {
      setLoadingAnaf(true);

      const subcontractantData = {
        id: `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        nume: anafData.denumire.trim(),
        tip_client: anafData.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
        cui: anafData.cui.trim(),
        nr_reg_com: anafData.nrRegCom || '',
        adresa: anafData.adresa || '',
        judet: anafData.judet || '',
        oras: anafData.oras || '',
        cod_postal: anafData.codPostal || '',
        tara: 'Romania',
        telefon: anafData.telefon || '',
        email: '',
        banca: '',
        iban: '',
        cnp: null,
        ci_serie: null,
        ci_numar: null,
        ci_eliberata_de: null,
        ci_eliberata_la: null,
        data_creare: new Date().toISOString(),
        data_actualizare: new Date().toISOString(),
        activ: anafData.status === 'Activ',
        observatii: `Importat automat din ANAF la ${new Date().toLocaleString('ro-RO')}`,
        id_factureaza: null,
        data_ultima_sincronizare: null
      };

      const response = await fetch('/api/rapoarte/subcontractanti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subcontractantData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success || response.ok) {
        showToast('Subcontractant importat cu succes din ANAF!', 'success');

        // Selectează automat subcontractantul importat
        const newSubcontractant: Subcontractant = {
          id: subcontractantData.id,
          nume: subcontractantData.nume,
          tip_client: subcontractantData.tip_client,
          cui: subcontractantData.cui,
          telefon: subcontractantData.telefon,
          email: subcontractantData.email,
          activ: true
        };

        setSelectedItem(newSubcontractant);
        setSearchTerm(newSubcontractant.nume);
        setShowImportDialog(false);
        setAnafResults([]);

        if (onSubcontractantSelected) {
          onSubcontractantSelected({
            id: newSubcontractant.id,
            nume: newSubcontractant.nume,
            cui: newSubcontractant.cui,
            tip_client: newSubcontractant.tip_client,
            telefon: newSubcontractant.telefon,
            email: newSubcontractant.email
          });
        }
      } else {
        console.error('Eroare API:', result);
        showToast(`Eroare la import: ${result.error || 'Eroare necunoscută'}`, 'error');
      }
    } catch (error: any) {
      console.error('Eroare la importul din ANAF:', error);
      showToast(`Eroare la importul din ANAF: ${error.message || 'Eroare necunoscută'}`, 'error');
    } finally {
      setLoadingAnaf(false);
    }
  };

  // FIX: Debounce effect pentru căutare - 500ms delay
  useEffect(() => {
    // Cleanup previous timer și abort previous request
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Dacă nu este searchTerm, nu face nimic
    if (!searchTerm || searchTerm.trim().length === 0) {
      setSearchMode('local');
      setShowSuggestions(false);
      setAnafResults([]);
      setSubcontractanti([]);
      return;
    }

    // Detectează dacă este CUI (doar cifre)
    const isCUI = /^\d+$/.test(searchTerm.trim()) && searchTerm.trim().length >= 6;

    // Setează modul de căutare imediat (pentru UI feedback)
    if (isCUI) {
      setSearchMode('anaf');
      setShowSuggestions(true);
    } else {
      setSearchMode('local');
      setShowSuggestions(searchTerm.trim().length >= 2);
    }

    // Debounce: așteaptă 500ms înainte de a face request
    debounceTimerRef.current = setTimeout(() => {
      if (isCUI && searchTerm.trim().length >= 6) {
        // Căutare ANAF pentru CUI
        searchInANAF(searchTerm);
      } else if (searchTerm.trim().length >= 2) {
        // Căutare locală pentru text
        loadSubcontractanti(searchTerm);
      } else if (searchTerm.trim().length === 0) {
        // Load all când e gol
        loadSubcontractanti();
      }
    }, 500); // 500ms delay - input devine fluid

    // Cleanup la unmount sau la change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]); // Re-run când searchTerm se schimbă

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSelectedItem(null);
    setAnafResults([]);
    setShowImportDialog(false);
    setAnafDataForImport(null);

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

  // MODIFICAT: Selectare rezultat ANAF cu opțiune de import automat
  const handleSelectAnafResult = (anafResult: ANAFResult) => {
    setSearchTerm(anafResult.denumire);
    setShowSuggestions(false);
    setAnafDataForImport(anafResult);
    setShowImportDialog(true);
  };

  const handleFocus = () => {
    if (!disabled && (subcontractanti.length > 0 || anafResults.length > 0)) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!showImportDialog) {
        setShowSuggestions(false);
      }
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

      {/* NOU: Dialog import automat din ANAF */}
      {showImportDialog && anafDataForImport && (
        <div style={{
          marginTop: '0.5rem',
          background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)',
          border: '1px solid rgba(52, 152, 219, 0.3)',
          borderRadius: '8px',
          padding: '1rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.75rem'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.25rem'
              }}>
                🏢 {anafDataForImport.denumire}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#7f8c8d'
              }}>
                CUI: {anafDataForImport.cui} • {anafDataForImport.status} • {anafDataForImport.platitorTva === 'Da' ? 'Plătitor TVA' : 'Fără TVA'}
              </div>
            </div>
          </div>
          
          <p style={{
            margin: '0 0 1rem 0',
            fontSize: '13px',
            color: '#2c3e50'
          }}>
            💡 Subcontractant găsit în ANAF! Vrei să îl imporți automat în baza de date?
          </p>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => importFromANAF(anafDataForImport)}
              disabled={loadingAnaf}
              style={{
                padding: '0.5rem 1rem',
                background: loadingAnaf ? '#bdc3c7' : 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loadingAnaf ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              {loadingAnaf ? '⏳ Se importă...' : '✅ Da, importă automat'}
            </button>
            
            <button
              onClick={() => {
                setShowImportDialog(false);
                setAnafDataForImport(null);
                if (onSubcontractantSelected) {
                  onSubcontractantSelected({
                    nume: anafDataForImport.denumire,
                    cui: anafDataForImport.cui,
                    tip_client: anafDataForImport.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
                    din_anaf: true
                  });
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f8f9fa',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Folosește fără salvare
            </button>
            
            <button
              onClick={() => {
                setShowImportDialog(false);
                setAnafDataForImport(null);
                setAnafResults([]);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f8f9fa',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Anulează
            </button>
          </div>
        </div>
      )}

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
              ✖
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
