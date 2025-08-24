// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectActions.tsx
// DATA: 21.08.2025 01:35 (ora României)
// MODIFICAT: Acțiuni diferențiate - subproiecte active au doar "Sarcini"
// PĂSTRATE: Toate funcționalitățile existente pentru proiecte
// ==================================================================

'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import SarciniProiectModal from './SarciniProiectModal';

interface ActionItem {
  key: string;
  label: string;
  icon: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  divider?: boolean;
}

interface ProiectActionsProps {
  proiect: {
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
    data_curs_valutar?: string;
    status_predare?: string;
    status_contract?: string;
    status_facturare?: string;
    status_achitare?: string;
    tip?: 'proiect' | 'subproiect';
    ID_Proiect_Parinte?: string;
    Responsabil?: string;
    Adresa?: string;
    Descriere?: string;
    Observatii?: string;
  };
  onRefresh?: () => void;
  // Callback-uri pentru modale externe (gestionate în ProiecteTable)
  onShowFacturaModal?: (proiect: any) => void;
  onShowSubproiectModal?: (proiect: any) => void;
  onShowEditModal?: (proiect: any) => void;
}

// System global pentru management dropdown-uri multiple
let currentOpenDropdown: string | null = null;
const openDropdowns = new Map<string, () => void>();

// Toast system cu Z-index compatibil cu modalele externe
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
    white-space: pre-line;
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
  }, type === 'success' ? 4000 : type === 'error' ? 5000 : type === 'info' && message.length > 200 ? 10000 : 6000);
};

export default function ProiectActions({ 
  proiect, 
  onRefresh, 
  onShowFacturaModal, 
  onShowSubproiectModal,
  onShowEditModal
}: ProiectActionsProps) {
  
  // State pentru modalul de sarcini
  const [showSarciniModal, setShowSarciniModal] = useState(false);
  
  // ACTUALIZAT: Logica pentru tipul de proiect și status
  const isProiectPrincipal = proiect.tip !== 'subproiect';
  const isSubproiect = proiect.tip === 'subproiect';
  const isActiv = proiect.Status === 'Activ';

  // Helper pentru formatarea datelor
  const formatDate = (date?: string | { value: string }): string => {
    if (!date) return 'N/A';
    const dateValue = typeof date === 'string' ? date : date.value;
    try {
      return new Date(dateValue).toLocaleDateString('ro-RO');
    } catch {
      return 'N/A';
    }
  };

  // ACTUALIZAT: Construire acțiuni în funcție de tip și status
  const actions: ActionItem[] = (() => {
    // Pentru subproiecte active: DOAR Sarcini
    if (isSubproiect && isActiv) {
      return [{
        key: 'sarcini',
        label: 'Sarcini Subproiect',
        icon: '📋',
        color: 'primary' as const
      }];
    }
    
    // Pentru subproiecte inactive: NICIO acțiune
    if (isSubproiect && !isActiv) {
      return [];
    }
    
    // Pentru proiecte principale: toate acțiunile
    return [
      {
        key: 'view',
        label: 'Vezi Detalii',
        icon: '👁️',
        color: 'primary'
      },
      {
        key: 'edit',
        label: 'Editează',
        icon: '✏️',
        color: 'secondary'
      },
      // Sarcini doar pentru proiecte active
      ...(isActiv ? [{
        key: 'sarcini',
        label: 'Sarcini Proiect',
        icon: '📋',
        color: 'primary' as const
      }] : []),
      // Adaugă subproiect doar pentru proiecte principale
      {
        key: 'add_subproiect',
        label: 'Adaugă Subproiect',
        icon: '📁',
        color: 'primary' as const,
        disabled: proiect.Status === 'Anulat' || proiect.Status === 'Finalizat'
      },
      {
        key: 'divider1',
        label: '',
        icon: '',
        color: 'primary',
        divider: true
      },
      {
        key: 'generate_invoice',
        label: 'Generează Factură PDF',
        icon: '💰',
        color: 'warning',
        disabled: proiect.Status === 'Anulat'
      },
      {
        key: 'divider2',
        label: '',
        icon: '',
        color: 'primary',
        divider: true
      },
      {
        key: 'mark_completed',
        label: 'Marchează Finalizat',
        icon: '✅',
        color: 'success',
        disabled: proiect.Status === 'Finalizat' || proiect.Status === 'Anulat'
      },
      {
        key: 'suspend',
        label: 'Suspendă Proiect',
        icon: '⏸️',
        color: 'warning',
        disabled: proiect.Status === 'Suspendat' || proiect.Status === 'Finalizat'
      },
      {
        key: 'divider3',
        label: '',
        icon: '',
        color: 'primary',
        divider: true
      },
      {
        key: 'delete',
        label: 'Șterge Proiect',
        icon: '🗑️',
        color: 'danger'
      }
    ];
  })();

  const handleAction = async (actionKey: string) => {
    try {
      switch (actionKey) {
        case 'view':
          await handleViewDetails();
          break;
        case 'edit':
          await handleEdit();
          break;
        case 'sarcini':
          handleSarcini();
          break;
        case 'add_subproiect':
          handleAddSubproiect();
          break;
        case 'generate_invoice':
          handleCreateInvoiceHibrid();
          break;
        case 'mark_completed':
          await handleUpdateStatus('Finalizat');
          break;
        case 'suspend':
          await handleUpdateStatus('Suspendat');
          break;
        case 'delete':
          await handleDelete();
          break;
        default:
          showToast('Funcție în dezvoltare', 'info');
      }
    } catch (error) {
      console.error(`Eroare la ${actionKey}:`, error);
      showToast(`Eroare la executarea acțiunii: ${actionKey}`, 'error');
    }
  };

  // Handler pentru Sarcini
  const handleSarcini = () => {
    setShowSarciniModal(true);
    console.log('Deschidere modal sarcini pentru:', proiect.ID_Proiect);
  };

  // Handler pentru Adăugare Subproiect (doar pentru proiecte principale)
  const handleAddSubproiect = () => {
    if (onShowSubproiectModal) {
      onShowSubproiectModal(proiect);
    } else {
      console.warn('onShowSubproiectModal callback not provided');
      showToast('Funcția de adăugare subproiect nu este disponibilă', 'error');
    }
  };

  const handleCreateInvoiceHibrid = () => {
    if (onShowFacturaModal) {
      onShowFacturaModal(proiect);
    } else {
      console.warn('onShowFacturaModal callback not provided');
      showToast('Funcția de generare factură nu este disponibilă', 'error');
    }
  };

  const handleViewDetails = async () => {
    const tipText = proiect.tip === 'subproiect' ? 'SUBPROIECT' : 'PROIECT';
    const monedaInfo = proiect.moneda && proiect.moneda !== 'RON' 
      ? `\n💱 Monedă: ${proiect.moneda}\n💰 Valoare RON: ${proiect.valoare_ron ? `${proiect.valoare_ron.toLocaleString('ro-RO')} RON` : 'N/A'}`
      : '';
    
    const statusuriInfo = proiect.status_predare || proiect.status_contract || proiect.status_facturare || proiect.status_achitare
      ? `\n📊 Status Predare: ${proiect.status_predare || 'N/A'}\n📄 Status Contract: ${proiect.status_contract || 'N/A'}\n🧾 Status Facturare: ${proiect.status_facturare || 'N/A'}\n💳 Status Achitare: ${proiect.status_achitare || 'N/A'}`
      : '';

    const detalii = `📋 ${tipText}: ${proiect.ID_Proiect}

📝 Denumire: ${proiect.Denumire}
👤 Client: ${proiect.Client}
📊 Status: ${proiect.Status}${isActiv ? ' ✅' : ''}
💰 Valoare: ${proiect.Valoare_Estimata ? `${proiect.Valoare_Estimata.toLocaleString('ro-RO')} ${proiect.moneda || 'RON'}` : 'N/A'}${monedaInfo}
📅 Începe: ${formatDate(proiect.Data_Start)}
📅 Finalizare: ${formatDate(proiect.Data_Final)}
👤 Responsabil: ${proiect.Responsabil || 'Neatribuit'}
📍 Adresă: ${proiect.Adresa || 'Nespecificată'}${statusuriInfo}
📝 Observații: ${proiect.Observatii || 'Fără observații'}`;
    
    showToast(detalii, 'info');
    console.log(`Detalii ${tipText.toLowerCase()}:`, proiect);
  };

  const handleEdit = async () => {
    if (onShowEditModal) {
      onShowEditModal(proiect);
    } else {
      console.warn('onShowEditModal callback not provided');
      showToast('Funcția de editare nu este disponibilă', 'error');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    const tipText = proiect.tip === 'subproiect' ? 'subproiectului' : 'proiectului';
    const confirmare = confirm(`Sigur vrei să schimbi statusul ${tipText} la "${newStatus}"?`);
    if (!confirmare) return;

    try {
      const apiEndpoint = proiect.tip === 'subproiect' ? '/api/rapoarte/subproiecte' : '/api/rapoarte/proiecte';
      
      const response = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: proiect.ID_Proiect, 
          Status: newStatus 
        })
      });

      const result = await response.json();

      if (result.success) {
        showToast(`Status actualizat la: ${newStatus}`, 'success');
        onRefresh?.();
      } else {
        showToast(result.error || 'Eroare la actualizarea statusului', 'error');
      }
    } catch (error) {
      showToast('Eroare la actualizarea statusului', 'error');
    }
  };

  const handleDelete = async () => {
    const tipText = proiect.tip === 'subproiect' ? 'subproiectul' : 'proiectul';
    const confirmed = confirm(`Sigur vrei să ștergi ${tipText} ${proiect.ID_Proiect}?\n\nAceastă acțiune nu poate fi anulată!`);
    if (!confirmed) return;

    try {
      const apiEndpoint = proiect.tip === 'subproiect' ? '/api/rapoarte/subproiecte' : '/api/rapoarte/proiecte';
      
      const response = await fetch(`${apiEndpoint}?id=${encodeURIComponent(proiect.ID_Proiect)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showToast(`${tipText.charAt(0).toUpperCase() + tipText.slice(1)} șters cu succes!`, 'success');
        onRefresh?.();
      } else {
        showToast(result.error || `Eroare la ștergerea ${tipText}`, 'error');
      }
    } catch (error) {
      showToast(`Eroare la ștergerea ${tipText}`, 'error');
    }
  };

  // ACTUALIZAT: Nu afișa nimic pentru subproiecte inactive
  if (isSubproiect && !isActiv) {
    return null;
  }

  return (
    <>
      <EnhancedActionDropdown
        actions={actions}
        onAction={handleAction}
        proiect={proiect}
      />

      {/* Modal pentru sarcini */}
      {showSarciniModal && (
        <SarciniProiectModal
          isOpen={showSarciniModal}
          onClose={() => setShowSarciniModal(false)}
          proiect={proiect}
        />
      )}
    </>
  );
}

// Dropdown cu Z-index Management optimizat pentru modalele externe
interface EnhancedActionDropdownProps {
  actions: ActionItem[];
  onAction: (actionKey: string) => void;
  proiect: any;
}

function EnhancedActionDropdown({ actions, onAction, proiect }: EnhancedActionDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<'bottom' | 'top'>('bottom');
  const [dropdownCoords, setDropdownCoords] = React.useState({ top: 0, left: 0, width: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  
  const dropdownId = React.useMemo(() => `dropdown-${proiect.ID_Proiect}-${Math.random().toString(36).substr(2, 9)}`, [proiect.ID_Proiect]);

  // ACTUALIZAT: Nu afișa buton dacă nu sunt acțiuni
  if (actions.length === 0) {
    return null;
  }

  React.useEffect(() => {
    openDropdowns.set(dropdownId, () => setIsOpen(false));
    
    return () => {
      openDropdowns.delete(dropdownId);
    };
  }, [dropdownId]);

  React.useEffect(() => {
    if (isOpen) {
      if (currentOpenDropdown && currentOpenDropdown !== dropdownId) {
        const closeFunction = openDropdowns.get(currentOpenDropdown);
        if (closeFunction) {
          closeFunction();
        }
      }
      currentOpenDropdown = dropdownId;
      calculateDropdownPosition();
      
      window.addEventListener('resize', calculateDropdownPosition);
      return () => window.removeEventListener('resize', calculateDropdownPosition);
    } else {
      if (currentOpenDropdown === dropdownId) {
        currentOpenDropdown = null;
      }
    }
  }, [isOpen, dropdownId]);

  const calculateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 350;
    
    const tableRow = buttonRef.current.closest('tr');
    const rowHeight = tableRow ? tableRow.getBoundingClientRect().height : 50;
    
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top - rowHeight;
    
    let finalTop = 0;
    let finalLeft = buttonRect.right - 260;
    
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      finalTop = buttonRect.top - dropdownHeight - 8;
      setDropdownPosition('top');
    } else {
      finalTop = buttonRect.bottom + 8;
      setDropdownPosition('bottom');
    }
    
    if (finalLeft < 10) finalLeft = 10;
    if (finalLeft + 260 > window.innerWidth - 10) {
      finalLeft = window.innerWidth - 270;
    }
    
    setDropdownCoords({
      top: finalTop,
      left: finalLeft,
      width: 260
    });
  };

  const handleActionClick = async (actionKey: string) => {
    if (loading) return;
    
    setLoading(actionKey);
    setIsOpen(false);
    
    try {
      await onAction(actionKey);
    } finally {
      setLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activ': return '#27ae60';
      case 'Finalizat': return '#3498db';
      case 'Suspendat': return '#f39c12';
      case 'Arhivat': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getActionColor = (color: string) => {
    switch (color) {
      case 'primary': return '#3498db';
      case 'secondary': return '#95a5a6';
      case 'success': return '#27ae60';
      case 'warning': return '#f39c12';
      case 'danger': return '#e74c3c';
      default: return '#7f8c8d';
    }
  };

  const isActiv = proiect.Status === 'Activ';
  const isSubproiect = proiect.tip === 'subproiect';

  return (
    <div style={{ position: 'relative' as const, display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading !== null}
        style={{
          background: loading ? '#f8f9fa' : isActiv ? 
            (isSubproiect ? 
              'linear-gradient(135deg, #3498db 0%, #5dade2 100%)' : 
              'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)') : 
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: loading ? '#6c757d' : 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: loading ? 'none' : isActiv ? 
            (isSubproiect ? 
              '0 4px 12px rgba(52, 152, 219, 0.4)' : 
              '0 4px 12px rgba(39, 174, 96, 0.4)') : 
            '0 4px 12px rgba(102, 126, 234, 0.4)',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
        onMouseOver={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = isActiv ? 
              (isSubproiect ? 
                '0 6px 16px rgba(52, 152, 219, 0.5)' : 
                '0 6px 16px rgba(39, 174, 96, 0.5)') : 
              '0 6px 16px rgba(102, 126, 234, 0.5)';
          }
        }}
        onMouseOut={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isActiv ? 
              (isSubproiect ? 
                '0 4px 12px rgba(52, 152, 219, 0.4)' : 
                '0 4px 12px rgba(39, 174, 96, 0.4)') : 
              '0 4px 12px rgba(102, 126, 234, 0.4)';
          }
        }}
      >
        {loading ? '⏳' : (isSubproiect ? '📋' : '⚙️')} 
        {isSubproiect ? 'Sarcini' : 'Acțiuni'}
        {isActiv && !loading && (
          <span style={{ 
            fontSize: '10px', 
            background: 'rgba(255,255,255,0.2)', 
            padding: '2px 6px', 
            borderRadius: '8px',
            fontWeight: 'bold'
          }}>
            {isSubproiect ? 'SUB' : 'ACTIV'}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(6px)',
              zIndex: 40000
            }}
            onClick={() => setIsOpen(false)}
          />

          {typeof window !== 'undefined' && createPortal(
            <div style={{
              position: 'fixed' as const,
              top: dropdownCoords.top,
              left: dropdownCoords.left,
              width: dropdownCoords.width,
              background: '#ffffff',
              opacity: 1,
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              border: '1px solid #e0e0e0',
              zIndex: 45000,
              overflow: 'hidden' as const,
              transform: 'scale(1)'
            }}>
              {/* Header */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #e0e0e0',
                background: '#f8f9fa'
              }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '700',
                  color: '#2c3e50',
                  marginBottom: '0.5rem',
                  fontFamily: 'monospace'
                }}>
                  {proiect.tip === 'subproiect' ? '📁' : '🗃️'} {proiect.ID_Proiect}
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                  Status: <span style={{ 
                    color: getStatusColor(proiect.Status),
                    fontWeight: '600'
                  }}>
                    {proiect.Status}
                  </span>
                  {isSubproiect && isActiv && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '10px',
                      background: '#3498db',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}>
                      SUBPROIECT ACTIV
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: '0.5rem 0' }}>
                {actions.map((action) => {
                  if (action.divider) {
                    return (
                      <div
                        key={action.key}
                        style={{
                          height: '1px',
                          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%)',
                          margin: '0.5rem 0'
                        }}
                      />
                    );
                  }

                  return (
                    <button
                      key={action.key}
                      onClick={() => handleActionClick(action.key)}
                      disabled={action.disabled || loading === action.key}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: (action.disabled || loading === action.key) ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        color: action.disabled ? '#bdc3c7' : '#2c3e50',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        opacity: action.disabled ? 0.5 : 1,
                        transition: 'all 0.3s ease',
                        fontWeight: '500'
                      }}
                      onMouseOver={(e) => {
                        if (!action.disabled && loading !== action.key) {
                          e.currentTarget.style.background = `${getActionColor(action.color)}15`;
                          e.currentTarget.style.color = getActionColor(action.color);
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = action.disabled ? '#bdc3c7' : '#2c3e50';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <span style={{ 
                        minWidth: '20px',
                        fontSize: '16px'
                      }}>
                        {loading === action.key ? '⏳' : action.icon}
                      </span>
                      <span>
                        {action.label}
                        {action.key === 'sarcini' && isActiv && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '10px',
                            background: isSubproiect ? '#3498db' : '#27ae60',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                          }}>
                            {isSubproiect ? 'SUB' }
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
