// ==================================================================
// CALEA: app/admin/rapoarte/contracte/components/ContractActions.tsx
// DATA: 15.01.2025 08:50 (ora României)
// MODIFICAT: Adăugat ContractSignModal pentru setarea datei semnării
// PĂSTRATE: Toate funcționalitățile existente + nou modal pentru semnare
// ==================================================================

'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import ContractSignModal from './ContractSignModal';

interface ActionItem {
  key: string;
  label: string;
  icon: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  divider?: boolean;
}

interface ContractActionsProps {
  contract: {
    ID_Contract: string;
    numar_contract: string;
    Status: string;
    client_nume: string;
    proiect_id: string;
    Denumire_Contract: string;
    Data_Semnare?: string;
    Data_Expirare?: string;
    Valoare?: number;
    Moneda?: string;
    valoare_ron?: number;
    etape_count?: number;
    etape_facturate?: number;
    etape_incasate?: number;
    Observatii?: string;
    etape?: any[];
  };
  onRefresh?: () => void;
  // Callback-uri pentru modale externe (gestionate în ContracteTable)
  onShowFacturaModal?: (contract: any) => void;
  onShowEditModal?: (contract: any) => void;
  onShowPVModal?: (contract: any) => void;
}

// System global pentru management dropdown-uri multiple - IDENTIC cu ProiectActions
let currentOpenDropdown: string | null = null;
const openDropdowns = new Map<string, () => void>();

// Toast system cu Z-index compatibil cu modalele externe - IDENTIC cu ProiectActions
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
  }, type === 'success' || type === 'error' ? 4000 : type === 'info' && message.length > 200 ? 10000 : 6000);
};

export default function ContractActions({ 
  contract, 
  onRefresh, 
  onShowFacturaModal, 
  onShowEditModal,
  onShowPVModal
}: ContractActionsProps) {
  
  // ADĂUGAT: State pentru modalul de semnare
  const [showSignModal, setShowSignModal] = useState(false);
  
  // Logica pentru status contract
  const isActiv = contract.Status === 'Semnat' || contract.Status === 'Generat';
  const isAnulat = contract.Status === 'Anulat';
  const isDejaSemat = contract.Status === 'Semnat';

  // Helper pentru formatarea datelor - IDENTIC cu ProiectActions
  const formatDate = (date?: string): string => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('ro-RO');
    } catch {
      return 'N/A';
    }
  };

  // ACTUALIZAT: Construire acțiuni pentru contracte cu modal pentru semnare
  const actions: ActionItem[] = [
    {
      key: 'view',
      label: 'Vezi Detalii',
      icon: '👁️',
      color: 'primary'
    },
    {
      key: 'edit',
      label: 'Editează Contract',
      icon: '✏️',
      color: 'secondary'
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
      disabled: isAnulat
    },
    {
      key: 'generate_pv',
      label: 'Generează Proces Verbal',
      icon: '📋',
      color: 'success',
      disabled: isAnulat
    },
    {
      key: 'divider2',
      label: '',
      icon: '',
      color: 'primary',
      divider: true
    },
    {
      key: 'mark_signed',
      label: isDejaSemat ? 'Actualizează Semnare' : 'Marchează Semnat',
      icon: '✅',
      color: 'success',
      disabled: isAnulat
    },
    {
      key: 'mark_expired',
      label: 'Marchează Expirat',
      icon: '⚠️',
      color: 'warning',
      disabled: contract.Status === 'Expirat' || isAnulat
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
      label: 'Anulează Contract',
      icon: '🗑️',
      color: 'danger',
      disabled: isAnulat
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
        case 'generate_invoice':
          handleCreateInvoice();
          break;
        case 'generate_pv':
          handleGeneratePV();
          break;
        case 'mark_signed':
          // MODIFICAT: Deschide modalul în loc de actualizare directă
          handleMarkSigned();
          break;
        case 'mark_expired':
          await handleUpdateStatus('Expirat');
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

  // ADĂUGAT: Handler pentru deschiderea modalului de semnare
  const handleMarkSigned = () => {
    setShowSignModal(true);
  };

  // ADĂUGAT: Handler pentru succesul semnării
  const handleSignSuccess = () => {
    setShowSignModal(false);
    onRefresh?.();
  };

  // ADĂUGAT: Handler pentru închiderea modalului de semnare
  const handleSignClose = () => {
    setShowSignModal(false);
  };

  // Handler pentru Editare Contract - PĂSTRAT
  const handleEdit = async () => {
    if (onShowEditModal) {
      onShowEditModal(contract);
    } else {
      console.warn('onShowEditModal callback not provided');
      showToast('Funcția de editare contract nu este disponibilă', 'error');
    }
  };

  // Handler pentru Generare Factură - PĂSTRAT
  const handleCreateInvoice = () => {
    if (onShowFacturaModal) {
      onShowFacturaModal(contract);
    } else {
      console.warn('onShowFacturaModal callback not provided');
      showToast('Funcția de generare factură nu este disponibilă', 'error');
    }
  };

  // Handler pentru Proces Verbal - PĂSTRAT
  const handleGeneratePV = () => {
    if (onShowPVModal) {
      onShowPVModal(contract);
    } else {
      console.warn('onShowPVModal callback not provided');
      showToast('Funcția de generare proces verbal nu este disponibilă', 'error');
    }
  };

  const handleViewDetails = async () => {
    const statusInfo = contract.Status === 'Semnat' ? ' ✅' : 
                      contract.Status === 'Anulat' ? ' 🔴' : '';
    const etapeInfo = contract.etape_count ? 
      `\n📋 Etape: ${contract.etape_count} total (${contract.etape_facturate || 0} facturate, ${contract.etape_incasate || 0} încasate)` : '';
    
    // ACTUALIZAT: Afișează și datele de semnare/expirare
    const dateInfo = contract.Data_Semnare || contract.Data_Expirare ? 
      `\n📅 Semnat: ${formatDate(contract.Data_Semnare)}\n📅 Expirare: ${formatDate(contract.Data_Expirare)}` : 
      '\n📅 Date semnare: Lipsesc - folosește "Marchează Semnat"';
    
    const detalii = `📄 CONTRACT: ${contract.ID_Contract}

🏷️ Număr: ${contract.numar_contract}
👤 Client: ${contract.client_nume}
🗂️ Proiect: ${contract.proiect_id}
📊 Status: ${contract.Status}${statusInfo}
💰 Valoare: ${contract.Valoare ? `${contract.Valoare.toLocaleString('ro-RO')} ${contract.Moneda || 'RON'}` : 'N/A'}${dateInfo}${etapeInfo}
📝 Observații: ${contract.Observatii || 'Fără observații'}`;
    
    showToast(detalii, 'info');
    console.log('Detalii contract:', contract);
  };

  // MODIFICAT: Pentru alte status-uri (nu Semnat), păstrează logica veche
  const handleUpdateStatus = async (newStatus: string) => {
    const confirmare = confirm(`Sigur vrei să schimbi statusul contractului la "${newStatus}"?`);
    if (!confirmare) return;

    try {
      const response = await fetch('/api/rapoarte/contracte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ID_Contract: contract.ID_Contract, 
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
    const confirmed = confirm(`Sigur vrei să anulezi contractul ${contract.numar_contract}?\n\nContractul va fi marcat ca "Anulat" și etapele vor fi dezactivate.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/rapoarte/contracte?id=${encodeURIComponent(contract.ID_Contract)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        showToast(`Contract ${contract.numar_contract} anulat cu succes!`, 'success');
        onRefresh?.();
      } else {
        showToast(result.error || 'Eroare la anularea contractului', 'error');
      }
    } catch (error) {
      showToast('Eroare la anularea contractului', 'error');
    }
  };

  return (
    <>
      <EnhancedActionDropdown
        actions={actions}
        onAction={handleAction}
        contract={contract}
      />

      {/* ADĂUGAT: Modal pentru semnarea contractului */}
      <ContractSignModal
        isOpen={showSignModal}
        onClose={handleSignClose}
        onSuccess={handleSignSuccess}
        contract={contract}
      />
    </>
  );
}

// Dropdown cu Z-index Management optimizat pentru modalele externe - IDENTIC cu ProiectActions
interface EnhancedActionDropdownProps {
  actions: ActionItem[];
  onAction: (actionKey: string) => void;
  contract: any;
}

function EnhancedActionDropdown({ actions, onAction, contract }: EnhancedActionDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<'bottom' | 'top'>('bottom');
  const [dropdownCoords, setDropdownCoords] = React.useState({ top: 0, left: 0, width: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  
  const dropdownId = React.useMemo(() => `dropdown-${contract.ID_Contract}-${Math.random().toString(36).substr(2, 9)}`, [contract.ID_Contract]);

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
      case 'Semnat': return '#27ae60';
      case 'Generat': return '#3498db';
      case 'Anulat': return '#e74c3c';
      case 'Expirat': return '#f39c12';
      case 'În așteptare': return '#95a5a6';
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

  const isActiv = contract.Status === 'Semnat' || contract.Status === 'Generat';

  return (
    <div style={{ position: 'relative' as const, display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading !== null}
        style={{
          background: loading ? '#f8f9fa' : isActiv ? 
            'linear-gradient(135deg, #3498db 0%, #5dade2 100%)' : 
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: loading ? '#6c757d' : 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: loading ? 'none' : isActiv ? 
            '0 4px 12px rgba(52, 152, 219, 0.4)' : 
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
              '0 6px 16px rgba(52, 152, 219, 0.5)' : 
              '0 6px 16px rgba(102, 126, 234, 0.5)';
          }
        }}
        onMouseOut={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isActiv ? 
              '0 4px 12px rgba(52, 152, 219, 0.4)' : 
              '0 4px 12px rgba(102, 126, 234, 0.4)';
          }
        }}
      >
        {loading ? '⏳' : '📄'} 
        Acțiuni
        {isActiv && !loading && (
          <span style={{ 
            fontSize: '10px', 
            background: 'rgba(255,255,255,0.2)', 
            padding: '2px 6px', 
            borderRadius: '8px',
            fontWeight: 'bold'
          }}>
            ACTIV
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
                  📄 {contract.numar_contract}
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                  Status: <span style={{ 
                    color: getStatusColor(contract.Status),
                    fontWeight: '600'
                  }}>
                    {contract.Status}
                  </span>
                  {contract.etape_count && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '10px',
                      background: '#3498db',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}>
                      {contract.etape_count} ETAPE
                    </span>
                  )}
                  {/* ADĂUGAT: Indicator dacă lipsesc datele de semnare */}
                  {!contract.Data_Semnare && contract.Status === 'Semnat' && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '10px',
                      background: '#f39c12',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}>
                      FĂRĂ DATE
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
                        {action.key === 'mark_signed' && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '10px',
                            background: '#27ae60',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                          }}>
                            MODAL
                          </span>
                        )}
                        {action.key === 'edit' && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '10px',
                            background: '#95a5a6',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                          }}>
                            MODAL
                          </span>
                        )}
                        {action.key === 'generate_invoice' && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '10px',
                            background: '#f39c12',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                          }}>
                            PDF
                          </span>
                        )}
                        {action.key === 'generate_pv' && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '10px',
                            background: '#27ae60',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontWeight: 'bold'
                          }}>
                            NOU
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
