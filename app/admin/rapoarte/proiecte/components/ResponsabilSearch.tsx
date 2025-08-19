// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ResponsabilSearch.tsx
// DATA: 19.08.2025 21:35 (ora României)
// DESCRIERE: Componentă pentru căutare și selecție responsabili din tabelul Utilizatori
// ==================================================================

'use client';

import { useState, useEffect } from 'react';

interface ResponsabilSearchProps {
  onResponsabilSelected?: (responsabil: any) => void;
  selectedResponsabil?: string;
  className?: string;
  showInModal?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

interface Utilizator {
  uid: string;
  email: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  rol: string;
  activ: boolean;
  data_creare?: string;
  data_ultima_conectare?: string;
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

export default function ResponsabilSearch({ 
  onResponsabilSelected,
  selectedResponsabil = '',
  className = '',
  showInModal = false,
  disabled = false,
  placeholder = "Caută responsabil..."
}: ResponsabilSearchProps) {
  const [searchTerm, setSearchTerm] = useState(selectedResponsabil);
  const [utilizatori, setUtilizatori] = useState<Utilizator[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Utilizator | null>(null);

  // Încarcă utilizatori inițiali (primii 20 activi)
  useEffect(() => {
    loadUtilizatori();
  }, []);

  // Setează valoarea inițială când se primește selectedResponsabil
  useEffect(() => {
    if (selectedResponsabil && selectedResponsabil !== searchTerm) {
      setSearchTerm(selectedResponsabil);
      // Încearcă să găsească utilizatorul în lista existentă
      const foundUser = utilizatori.find(u => 
        u.nume_complet === selectedResponsabil || 
        u.email === selectedResponsabil ||
        u.uid === selectedResponsabil
      );
      if (foundUser) {
        setSelectedUser(foundUser);
      }
    }
  }, [selectedResponsabil, utilizatori]);

  const loadUtilizatori = async (search?: string) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search && search.trim().length > 0) {
        queryParams.append('search', search.trim());
      }
      queryParams.append('limit', '20');

      const response = await fetch(`/api/rapoarte/utilizatori?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setUtilizatori(data.data || []);
      } else {
        showToast('Eroare la încărcarea utilizatorilor', 'error');
        setUtilizatori([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea utilizatorilor:', error);
      showToast('Eroare de conectare', 'error');
      setUtilizatori([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSelectedUser(null);
    
    if (value.trim().length >= 2) {
      setShowSuggestions(true);
      loadUtilizatori(value);
    } else if (value.trim().length === 0) {
      setShowSuggestions(true);
      loadUtilizatori(); // Încarcă utilizatori implicit
    } else {
      setShowSuggestions(false);
    }

    // Notifică părintele că selecția a fost resetată
    if (onResponsabilSelected) {
      onResponsabilSelected(null);
    }
  };

  const handleSelectUser = (user: Utilizator) => {
    setSearchTerm(user.nume_complet);
    setSelectedUser(user);
    setShowSuggestions(false);
    
    if (onResponsabilSelected) {
      onResponsabilSelected({
        uid: user.uid,
        email: user.email,
        nume: user.nume,
        prenume: user.prenume,
        nume_complet: user.nume_complet,
        rol: user.rol
      });
    }
  };

  const handleFocus = () => {
    if (!disabled && utilizatori.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Întârziere pentru a permite click-ul pe sugestii
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const getRolIcon = (rol: string) => {
    switch (rol) {
      case 'admin': return '👑';
      case 'manager': return '👔';
      case 'normal': return '👤';
      default: return '👤';
    }
  };

  const getRolLabel = (rol: string) => {
    switch (rol) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      case 'normal': return 'Utilizator';
      default: return rol;
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
            👤 Responsabil Proiect
          </label>
          <p style={{
            margin: 0,
            fontSize: '12px',
            color: '#7f8c8d'
          }}>
            Caută și selectează responsabilul din echipă
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
          placeholder={loading ? 'Se încarcă utilizatori...' : placeholder}
          style={{
            width: '100%',
            padding: '0.75rem',
            paddingRight: '2.5rem',
            border: `1px solid ${selectedUser ? '#27ae60' : '#dee2e6'}`,
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: disabled ? '#f8f9fa' : 'white',
            color: disabled ? '#6c757d' : '#2c3e50'
          }}
        />

        {/* Indicator status */}
        <div style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          {loading && (
            <span style={{ color: '#3498db', fontSize: '12px' }}>⏳</span>
          )}
          {selectedUser && (
            <span style={{ color: '#27ae60', fontSize: '12px' }}>✅</span>
          )}
          {!loading && !selectedUser && searchTerm && (
            <span style={{ color: '#f39c12', fontSize: '12px' }}>⚠️</span>
          )}
        </div>

        {/* Dropdown cu sugestii */}
        {showSuggestions && utilizatori.length > 0 && (
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
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {utilizatori.map(user => (
              <div
                key={user.uid}
                onClick={() => handleSelectUser(user)}
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
                      {user.nume_complet || `${user.prenume || ''} ${user.nume || ''}`.trim()}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#7f8c8d',
                      marginTop: '0.25rem'
                    }}>
                      📧 {user.email}
                    </div>
                    {user.data_ultima_conectare && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#95a5a6',
                        marginTop: '0.25rem'
                      }}>
                        Ultima conectare: {new Date(user.data_ultima_conectare).toLocaleDateString('ro-RO')}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.25rem'
                  }}>
                    <span style={{
                      fontSize: '16px'
                    }}>
                      {getRolIcon(user.rol)}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: '#7f8c8d',
                      textAlign: 'center'
                    }}>
                      {getRolLabel(user.rol)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div style={{
                padding: '1rem',
                textAlign: 'center',
                color: '#7f8c8d',
                fontSize: '14px'
              }}>
                ⏳ Se caută utilizatori...
              </div>
            )}
          </div>
        )}

        {/* Mesaj no results */}
        {showSuggestions && !loading && utilizatori.length === 0 && searchTerm.trim().length >= 2 && (
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
            Nu au fost găsiți utilizatori pentru "{searchTerm}"
          </div>
        )}
      </div>

      {/* Info despre utilizatorul selectat */}
      {selectedUser && (
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
                ✅ Responsabil selectat
              </div>
              <div style={{
                fontSize: '11px',
                color: '#7f8c8d',
                marginTop: '0.25rem'
              }}>
                {selectedUser.email} • {getRolLabel(selectedUser.rol)}
              </div>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedUser(null);
                if (onResponsabilSelected) {
                  onResponsabilSelected(null);
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
    </div>
  );
}
