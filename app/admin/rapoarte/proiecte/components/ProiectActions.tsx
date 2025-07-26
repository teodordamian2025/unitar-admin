// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectActions.tsx
// PARTEA 1: Component Principal + Dropdown (FĂRĂ modale locale)
// MODIFICAT: Z-index Management + Callback System pentru modale externe
// ==================================================================

'use client';

import React from 'react';

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
    tip?: 'proiect' | 'subproiect';
    Responsabil?: string;
    Adresa?: string;
    Observatii?: string;
  };
  onRefresh?: () => void;
  // ✅ NOWI: Callback-uri pentru modale externe (gestionate în ProiecteTable)
  onShowFacturaModal?: (proiect: any) => void;
  onShowSubproiectModal?: (proiect: any) => void;
}

// ✅ FIX: System global pentru management dropdown-uri multiple
let currentOpenDropdown: string | null = null;
const openDropdowns = new Map<string, () => void>();

// ✅ Toast system cu Z-index compatibil cu modalele externe
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
  
  // Smooth entrance animation
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
  onShowSubproiectModal 
}: ProiectActionsProps) {
  
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

  const actions: ActionItem[] = [
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
    // ✅ FIX: Adaugă subproiect doar pentru proiectele principale
    ...(proiect.tip !== 'subproiect' ? [{
      key: 'add_subproject',
      label: 'Adaugă Subproiect',
      icon: '📂',
      color: 'success' as const,
      disabled: proiect.Status === 'Anulat' || proiect.Status === 'Arhivat'
    }] : []),
    // ✅ FIX: Factură doar pentru proiectele principale, NU pentru subproiecte
    ...(proiect.tip !== 'subproiect' ? [{
      key: 'divider1',
      label: '',
      icon: '',
      color: 'primary' as const,
      divider: true
    }, {
      key: 'generate_invoice',
      label: 'Generează Factură PDF',
      icon: '💰',
      color: 'warning' as const,
      disabled: proiect.Status === 'Anulat'
    }] : []),
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
      label: proiect.tip === 'subproiect' ? 'Suspendă Subproiect' : 'Suspendă Proiect',
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
      label: proiect.tip === 'subproiect' ? 'Șterge Subproiect' : 'Șterge Proiect',
      icon: '🗑️',
      color: 'danger'
    }
  ];

  const handleAction = async (actionKey: string) => {
    try {
      switch (actionKey) {
        case 'view':
          await handleViewDetails();
          break;
        case 'edit':
          await handleEdit();
          break;
        case 'add_subproject':
          handleAddSubproject();
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

  // ✅ MODIFICAT: Folosește callback extern în loc de modal local
  const handleAddSubproject = () => {
    if (onShowSubproiectModal) {
      onShowSubproiectModal(proiect);
    } else {
      console.warn('onShowSubproiectModal callback not provided');
      showToast('Funcția de adăugare subproiect nu este disponibilă', 'error');
    }
  };

  // ✅ MODIFICAT: Folosește callback extern în loc de modal local
  const handleCreateInvoiceHibrid = () => {
    if (onShowFacturaModal) {
      onShowFacturaModal(proiect);
    } else {
      console.warn('onShowFacturaModal callback not provided');
      showToast('Funcția de generare factură nu este disponibilă', 'error');
    }
  };

  const handleViewDetails = async () => {
    const detalii = `📋 ${proiect.tip === 'subproiect' ? 'SUBPROIECT' : 'PROIECT'}: ${proiect.ID_Proiect}

📝 Denumire: ${proiect.Denumire}
👤 Client: ${proiect.Client}
📊 Status: ${proiect.Status}
💰 Valoare: ${proiect.Valoare_Estimata ? `${proiect.Valoare_Estimata.toLocaleString('ro-RO')} RON` : 'N/A'}
📅 Începe: ${formatDate(proiect.Data_Start)}
📅 Finalizare: ${formatDate(proiect.Data_Final)}
👤 Responsabil: ${proiect.Responsabil || 'Neatribuit'}
📍 Adresă: ${proiect.Adresa || 'Nespecificată'}
📝 Observații: ${proiect.Observatii || 'Fără observații'}`;
    
    showToast(detalii, 'info');
    console.log('Detalii proiect:', proiect);
  };

  const handleEdit = async () => {
    const confirmare = confirm(`Vrei să editezi ${proiect.tip === 'subproiect' ? 'subproiectul' : 'proiectul'} "${proiect.Denumire}"?\n\nNOTĂ: Funcția de editare va fi implementată în următoarea versiune.`);
    
    if (confirmare) {
      showToast('Funcția de editare va fi disponibilă în curând!', 'info');
    }
    
    const editUrl = proiect.tip === 'subproiect' 
      ? `/admin/rapoarte/subproiecte/${proiect.ID_Proiect}/edit`
      : `/admin/rapoarte/proiecte/${proiect.ID_Proiect}/edit`;
    
    console.log('Ar trebui să redirectionez la:', editUrl);
    console.log('Date pentru editare:', proiect);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    const confirmare = confirm(`Sigur vrei să schimbi statusul la "${newStatus}"?`);
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
    const itemType = proiect.tip === 'subproiect' ? 'subproiectul' : 'proiectul';
    const confirmed = confirm(`Sigur vrei să ștergi ${itemType} ${proiect.ID_Proiect}?\n\nAceastă acțiune nu poate fi anulată!`);
    if (!confirmed) return;

    try {
      const apiEndpoint = proiect.tip === 'subproiect' 
        ? `/api/rapoarte/subproiecte?id=${encodeURIComponent(proiect.ID_Proiect)}`
        : `/api/rapoarte/proiecte?id=${encodeURIComponent(proiect.ID_Proiect)}`;
      
      const response = await fetch(apiEndpoint, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showToast(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} șters cu succes!`, 'success');
        onRefresh?.();
      } else {
        showToast(result.error || `Eroare la ștergerea ${itemType}`, 'error');
      }
    } catch (error) {
      showToast(`Eroare la ștergerea ${itemType}`, 'error');
    }
  };

  return (
    <EnhancedActionDropdown
      actions={actions}
      onAction={handleAction}
      proiect={proiect}
    />
  );
}

// ✅ Dropdown cu Z-index Management optimizat pentru modalele externe
interface EnhancedActionDropdownProps {
  actions: ActionItem[];
  onAction: (actionKey: string) => void;
  proiect: any;
}

function EnhancedActionDropdown({ actions, onAction, proiect }: EnhancedActionDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<'bottom' | 'top'>('bottom');
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  
  // ✅ FIX: ID unic pentru acest dropdown
  const dropdownId = React.useMemo(() => `dropdown-${proiect.ID_Proiect}-${Math.random().toString(36).substr(2, 9)}`, [proiect.ID_Proiect]);

  // ✅ FIX: Înregistrează funcția de închidere
  React.useEffect(() => {
    openDropdowns.set(dropdownId, () => setIsOpen(false));
    
    return () => {
      openDropdowns.delete(dropdownId);
    };
  }, [dropdownId]);

  // ✅ FIX: Închide dropdown-ul când se deschide altul
  React.useEffect(() => {
    if (isOpen) {
      // Închide toate celelalte dropdown-uri
      if (currentOpenDropdown && currentOpenDropdown !== dropdownId) {
        const closeFunction = openDropdowns.get(currentOpenDropdown);
        if (closeFunction) {
          closeFunction();
        }
      }
      currentOpenDropdown = dropdownId;
      calculateDropdownPosition();
      
      // Adaugă event listener pentru resize
      window.addEventListener('resize', calculateDropdownPosition);
      return () => window.removeEventListener('resize', calculateDropdownPosition);
    } else {
      if (currentOpenDropdown === dropdownId) {
        currentOpenDropdown = null;
      }
    }
  }, [isOpen, dropdownId]);

  // ✅ FIX: Calculează poziționarea inteligentă
  const calculateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 350;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    console.log('📏 Dropdown positioning:', { 
      spaceBelow, 
      spaceAbove, 
      dropdownHeight,
      buttonTop: buttonRect.top,
      buttonBottom: buttonRect.bottom,
      viewportHeight,
      dropdownId 
    });
    
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      console.log(`🔼 Dropdown ${dropdownId} va urca sus`);
      setDropdownPosition('top');
    } else {
      console.log(`🔽 Dropdown ${dropdownId} va coborî jos`);
      setDropdownPosition('bottom');
    }
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

  return (
    <div style={{ position: 'relative' as const, display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={() => {
          console.log(`🔘 Buton ${dropdownId} apăsat, isOpen: ${isOpen}`);
          setIsOpen(!isOpen);
        }}
        disabled={loading !== null}
        style={{
          background: loading ? 
            '#f8f9fa' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: loading ? '#6c757d' : 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
        onMouseOver={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
          }
        }}
        onMouseOut={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          }
        }}
      >
        {loading ? '⏳' : '⚙️'} Acțiuni
      </button>

      {isOpen && (
        <>
          {/* ✅ Overlay cu z-index optimizat pentru modalele externe */}
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
            onClick={() => {
              console.log(`🔘 Overlay ${dropdownId} clicked - closing`);
              setIsOpen(false);
            }}
          />

          {/* ✅ Dropdown cu z-index sub modalele externe (50000) */}
          <div style={{
            position: 'absolute' as const,
            ...(dropdownPosition === 'bottom' 
              ? { top: '100%', marginTop: '8px' }
              : { bottom: '100%', marginBottom: '8px' }
            ),
            right: 0,
            background: '#ffffff',
            opacity: 1,
            borderRadius: '16px',
            minWidth: '260px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            border: '1px solid #e0e0e0',
            zIndex: 41000,
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
                {proiect.ID_Proiect}
                {proiect.tip === 'subproiect' && (
                  <span style={{ 
                    marginLeft: '8px',
                    fontSize: '10px',
                    background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontWeight: '600'
                  }}>
                    SUB
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                Status: <span style={{ 
                  color: getStatusColor(proiect.Status),
                  fontWeight: '600'
                }}>
                  {proiect.Status}
                </span>
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
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
