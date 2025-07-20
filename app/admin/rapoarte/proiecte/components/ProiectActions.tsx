'use client';

import { toast } from 'react-toastify';

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
    Data_Start?: string;
    Data_Final?: string;
  };
  onRefresh?: () => void;
}

export default function ProiectActions({ proiect, onRefresh }: ProiectActionsProps) {
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
    {
      key: 'duplicate',
      label: 'Duplică Proiect',
      icon: '📋',
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
      key: 'generate_contract',
      label: 'Generează Contract',
      icon: '📄',
      color: 'success',
      disabled: proiect.Status === 'Anulat'
    },
    {
      key: 'generate_invoice',
      label: 'Creează Factură',
      icon: '💰',
      color: 'warning',
      disabled: proiect.Status !== 'Activ' && proiect.Status !== 'Finalizat'
    },
    {
      key: 'send_email',
      label: 'Trimite Email Client',
      icon: '📧',
      color: 'primary'
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
      key: 'archive',
      label: 'Arhivează Proiect',
      icon: '📦',
      color: 'secondary',
      disabled: proiect.Status === 'Arhivat'
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

  const handleAction = async (actionKey: string) => {
    try {
      switch (actionKey) {
        case 'view':
          await handleViewDetails();
          break;
        case 'edit':
          await handleEdit();
          break;
        case 'duplicate':
          await handleDuplicate();
          break;
        case 'generate_contract':
          await handleGenerateContract();
          break;
        case 'generate_invoice':
          await handleCreateInvoice();
          break;
        case 'send_email':
          await handleSendEmail();
          break;
        case 'mark_completed':
          await handleUpdateStatus('Finalizat');
          break;
        case 'suspend':
          await handleUpdateStatus('Suspendat');
          break;
        case 'archive':
          await handleUpdateStatus('Arhivat');
          break;
        case 'delete':
          await handleDelete();
          break;
        default:
          toast.info('Funcție în dezvoltare');
      }
    } catch (error) {
      console.error(`Eroare la ${actionKey}:`, error);
      toast.error(`Eroare la executarea acțiunii: ${actionKey}`);
    }
  };

  const handleViewDetails = async () => {
    toast.info(`Vizualizare detalii pentru ${proiect.ID_Proiect}`);
  };

  const handleEdit = async () => {
    toast.info(`Editare proiect ${proiect.ID_Proiect}`);
  };

  const handleDuplicate = async () => {
    const confirmed = confirm(`Sigur vrei să duplici proiectul ${proiect.ID_Proiect}?`);
    if (!confirmed) return;

    try {
      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...proiect,
          ID_Proiect: `${proiect.ID_Proiect}_COPY_${Date.now()}`,
          Denumire: `${proiect.Denumire} (Copie)`,
          Status: 'Activ'
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Proiect duplicat cu succes!');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Eroare la duplicarea proiectului');
      }
    } catch (error) {
      toast.error('Eroare la duplicarea proiectului');
    }
  };

  const handleGenerateContract = async () => {
    try {
      toast.info('Se generează contractul...');
      
      const response = await fetch('/api/actions/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proiectId: proiect.ID_Proiect })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Contract generat cu succes!');
        if (result.downloadUrl) {
          const link = document.createElement('a');
          link.href = result.downloadUrl;
          link.download = `Contract_${proiect.ID_Proiect}.docx`;
          link.click();
        }
      } else {
        toast.error(result.error || 'Eroare la generarea contractului');
      }
    } catch (error) {
      toast.error('Eroare la generarea contractului');
    }
  };

  const handleCreateInvoice = async () => {
    try {
      toast.info('Se creează factura în factureaza.me...');
      
      const response = await fetch('/api/actions/invoices/factureaza-redirect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proiectId: proiect.ID_Proiect })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Factură creată cu succes în factureaza.me!');
        
        if (result.invoiceUrl) {
          window.open(result.invoiceUrl, '_blank');
        }
        
        if (result.downloadUrl) {
          const downloadConfirm = confirm('Vrei să descarci factura acum?');
          if (downloadConfirm) {
            window.open(result.downloadUrl, '_blank');
          }
        }
        
        onRefresh?.();
      } else {
        toast.error(result.error || 'Eroare la crearea facturii');
      }
    } catch (error) {
      toast.error('Eroare la crearea facturii');
    }
  };

  const handleSendEmail = async () => {
    try {
      const response = await fetch('/api/actions/email/send-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proiectId: proiect.ID_Proiect })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Email trimis cu succes!');
      } else {
        toast.error(result.error || 'Eroare la trimiterea email-ului');
      }
    } catch (error) {
      toast.error('Eroare la trimiterea email-ului');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: proiect.ID_Proiect, 
          Status: newStatus 
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Status actualizat la: ${newStatus}`);
        onRefresh?.();
      } else {
        toast.error(result.error || 'Eroare la actualizarea statusului');
      }
    } catch (error) {
      toast.error('Eroare la actualizarea statusului');
    }
  };

  const handleDelete = async () => {
    const confirmed = confirm(`Sigur vrei să ștergi proiectul ${proiect.ID_Proiect}?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/rapoarte/proiecte?id=${proiect.ID_Proiect}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Proiect șters cu succes!');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Eroare la ștergerea proiectului');
      }
    } catch (error) {
      toast.error('Eroare la ștergerea proiectului');
    }
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'primary': return '#3498db';
      case 'secondary': return '#95a5a6';
      case 'success': return '#27ae60';
      case 'warning': return '#f39c12';
      case 'danger': return '#e74c3c';
      default: return '#3498db';
    }
  };

  return (
    <EnhancedActionDropdown
      actions={actions}
      onAction={handleAction}
      proiect={proiect}
      getColorClass={getColorClass}
    />
  );
}

interface EnhancedActionDropdownProps {
  actions: ActionItem[];
  onAction: (actionKey: string) => void;
  proiect: any;
  getColorClass: (color: string) => string;
}

function EnhancedActionDropdown({ actions, onAction, proiect, getColorClass }: EnhancedActionDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);

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

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading !== null}
        style={{
          padding: '6px 12px',
          background: loading ? '#bdc3c7' : '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        {loading ? '⏳' : '⚙️'} Acțiuni
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999, // Crescut z-index pentru a fi deasupra tuturor
          minWidth: '220px',
          marginTop: '4px'
        }}>
          {/* Informații proiect */}
          <div style={{
            padding: '12px',
            borderBottom: '1px solid #eee',
            background: '#f8f9fa'
          }}>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: 'bold',
              color: '#2c3e50',
              marginBottom: '4px'
            }}>
              {proiect.ID_Proiect}
            </div>
            <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
              Status: <span style={{ 
                color: getStatusColor(proiect.Status),
                fontWeight: 'bold'
              }}>
                {proiect.Status}
              </span>
            </div>
          </div>

          {/* Acțiuni */}
          <div style={{ padding: '8px 0' }}>
            {actions.map((action) => {
              if (action.divider) {
                return (
                  <div
                    key={action.key}
                    style={{
                      height: '1px',
                      background: '#eee',
                      margin: '8px 0'
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
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: (action.disabled || loading === action.key) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    color: action.disabled ? '#bdc3c7' : (action.color === 'danger' ? '#e74c3c' : '#2c3e50'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: action.disabled ? 0.5 : 1,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (!action.disabled && loading !== action.key) {
                      e.currentTarget.style.background = action.color === 'danger' ? '#fdf2f2' : '#f8f9fa';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ minWidth: '16px' }}>
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
      )}

      {/* Overlay pentru închidere */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998 // Un nivel sub dropdown
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Import React pentru useState
import React from 'react';
