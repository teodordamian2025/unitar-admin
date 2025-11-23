// ==================================================================
// CALEA: app/admin/rapoarte/clienti/components/ANAFClientSearch.tsx
// DESCRIERE: Componentă pentru căutare și import clienți din ANAF
// ==================================================================

'use client';

import { useState } from 'react';

interface ANAFClientSearchProps {
  onClientFound?: (clientData: any) => void;
  onClientImported?: (clientId: string, clientData: any) => void;
  className?: string;
  showInModal?: boolean;
}

interface ANAFClientData {
  denumire: string;
  cui: string;
  nrRegCom: string;
  adresa: string;
  telefon: string;
  email: string;
  status: string;
  platitorTva: string;
  judet: string;
  oras: string;
  codPostal: string;
  existsInBD?: boolean;
  clientId?: string;
}

// ✅ Toast system cu Z-index compatibil
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

export default function ANAFClientSearch({ 
  onClientFound, 
  onClientImported, 
  className = '',
  showInModal = false 
}: ANAFClientSearchProps) {
  const [cui, setCui] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<ANAFClientData | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleSearch = async () => {
    if (!cui.trim()) {
      showToast('Introduceți un CUI pentru căutare', 'error');
      return;
    }

    setLoading(true);
    setSearchResult(null);

    try {
      const response = await fetch(`/api/anaf/company-info?cui=${encodeURIComponent(cui.trim())}`);
      const result = await response.json();

      if (result.success) {
        setSearchResult({
          ...result.data,
          existsInBD: false, // Verificarea va fi adăugată mai târziu
          clientId: null
        });

        showToast('Client găsit în ANAF!', 'success');

        if (onClientFound) {
          onClientFound({
            ...result.data,
            existsInBD: false,
            clientId: null
          });
        }

        setShowImportDialog(true);
      } else {
        showToast(result.error || 'Client nu a fost găsit în ANAF', 'error');
        setSearchResult(null);
      }
    } catch (error) {
      console.error('Eroare căutare ANAF:', error);
      showToast('Eroare la căutarea în ANAF', 'error');
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (updateIfExists = false) => {
    if (!cui.trim()) return;

    setLoading(true);
    setShowImportDialog(false);

    try {
      const response = await fetch('/api/anaf/search-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cui: cui.trim(),
          updateIfExists 
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message, 'success');

        if (onClientImported) {
          onClientImported(result.clientId, {
            ...searchResult,
            clientId: result.clientId,
            existsInBD: true
          });
        }

        // Actualizează rezultatul afișat
        if (searchResult) {
          setSearchResult({
            ...searchResult,
            existsInBD: true,
            clientId: result.clientId
          });
        }
      } else {
        if (response.status === 409) {
          // Client există deja - arată opțiunea de update
          const confirmUpdate = confirm(
            `Clientul există deja în baza de date.\n\nVrei să îl actualizezi cu datele din ANAF?`
          );
          
          if (confirmUpdate) {
            await handleImport(true);
            return;
          }
        }
        
        showToast(result.error || 'Eroare la importul clientului', 'error');
      }
    } catch (error) {
      console.error('Eroare import client:', error);
      showToast('Eroare la importul clientului', 'error');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = showInModal ? {
    background: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #e0e0e0',
    margin: '1rem 0'
  } : {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    padding: '1.5rem',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    margin: '1rem 0'
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ 
          margin: '0 0 0.5rem 0', 
          color: '#2c3e50',
          fontSize: '1.2rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🏢 Căutare Client în ANAF
        </h3>
        <p style={{ 
          margin: 0, 
          fontSize: '14px', 
          color: '#7f8c8d' 
        }}>
          Introduceți CUI-ul pentru a căuta și importa datele clientului din ANAF
        </p>
      </div>

      {/* Formular căutare */}
      <div style={{ 
        display: 'flex', 
        gap: '0.75rem', 
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            value={cui}
            onChange={(e) => setCui(e.target.value)}
            placeholder="Introduceți CUI (ex: RO12345678 sau 12345678)"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'monospace',
              fontWeight: '500'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
        </div>
        
        <button
          onClick={handleSearch}
          disabled={loading || !cui.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (loading || !cui.trim()) ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(52, 152, 219, 0.4)',
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? '⏳ Căutare...' : '🔍 Caută în ANAF'}
        </button>
      </div>

      {/* Rezultate căutare */}
      {searchResult && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '1.5rem',
          marginTop: '1rem'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '1rem'
          }}>
            <h4 style={{ 
              margin: 0, 
              color: '#2c3e50',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}>
              📋 Date găsite în ANAF
            </h4>
            
            {searchResult.existsInBD ? (
              <span style={{
                padding: '0.25rem 0.75rem',
                background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                ✅ Există în BD
              </span>
            ) : (
              <span style={{
                padding: '0.25rem 0.75rem',
                background: 'linear-gradient(135deg, #f39c12 0%, #f5b041 100%)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                ⚠️ Nu există în BD
              </span>
            )}
          </div>

          {/* Date client în grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>DENUMIRE</label>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>
                {searchResult.denumire}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>CUI</label>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', fontFamily: 'monospace' }}>
                {searchResult.cui}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>NR. REG. COM.</label>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50', fontFamily: 'monospace' }}>
                {searchResult.nrRegCom || 'N/A'}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>STATUS</label>
              <div style={{ fontSize: '14px', fontWeight: '600', color: searchResult.status === 'Activ' ? '#27ae60' : '#e74c3c' }}>
                {searchResult.status === 'Activ' ? '🟢' : '🔴'} {searchResult.status}
              </div>
            </div>
            
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>ADRESĂ</label>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50' }}>
                {searchResult.adresa}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>TELEFON</label>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c3e50' }}>
                {searchResult.telefon || 'N/A'}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>PLĂTITOR TVA</label>
              <div style={{ fontSize: '14px', fontWeight: '600', color: searchResult.platitorTva === 'Da' ? '#27ae60' : '#f39c12' }}>
                {searchResult.platitorTva === 'Da' ? '✅' : '⚠️'} {searchResult.platitorTva}
              </div>
            </div>
          </div>

          {/* Butoane acțiuni - doar când NU suntem în modal */}
          {!searchResult.existsInBD && !showInModal && (
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid #e0e0e0'
            }}>
              <button
                onClick={() => handleImport()}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: loading ? 'none' : '0 4px 12px rgba(39, 174, 96, 0.4)',
                  transition: 'all 0.3s ease'
                }}
              >
                📥 Importă în Baza de Date
              </button>

              <button
                onClick={() => setShowImportDialog(false)}
                style={{
                  padding: '0.75rem 1rem',
                  background: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Ignoră
              </button>
            </div>
          )}

          {/* Info pentru utilizator când suntem în modal */}
          {!searchResult.existsInBD && showInModal && (
            <div style={{
              paddingTop: '1rem',
              borderTop: '1px solid #e0e0e0'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(93, 173, 226, 0.1) 100%)',
                border: '1px solid rgba(52, 152, 219, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '14px',
                color: '#2c3e50'
              }}>
                💡 <strong>Date încărcate din ANAF</strong> - Completează informațiile lipsă (telefon, email, IBAN, etc.) în formularul de mai jos și salvează clientul.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog import - doar când NU suntem în modal */}
      {showImportDialog && searchResult && !searchResult.existsInBD && !showInModal && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%)',
          border: '1px solid rgba(39, 174, 96, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginTop: '1rem'
        }}>
          <p style={{
            margin: '0 0 1rem 0',
            fontSize: '14px',
            color: '#2c3e50',
            fontWeight: '500'
          }}>
            💡 <strong>Client găsit în ANAF!</strong> Vrei să îl imporți automat în baza de date?
          </p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleImport()}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              ✅ Da, importă
            </button>

            <button
              onClick={() => setShowImportDialog(false)}
              style={{
                padding: '0.5rem 1rem',
                background: '#f8f9fa',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Nu mulțumesc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
