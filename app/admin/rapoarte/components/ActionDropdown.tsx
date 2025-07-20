'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';

interface ActionDropdownProps {
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

export default function ActionDropdown({ proiect, onRefresh }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (actionType: string) => {
    setLoading(actionType);
    setIsOpen(false);

    try {
      switch (actionType) {
        case 'view':
          await handleViewDetails();
          break;
        case 'edit':
          await handleEdit();
          break;
        case 'contract':
          await handleGenerateContract();
          break;
        case 'invoice':
          await handleCreateInvoice();
          break;
        case 'email':
          await handleSendEmail();
          break;
        case 'status':
          await handleUpdateStatus();
          break;
        case 'archive':
          await handleArchive();
          break;
        case 'add_subproject':
          await handleAddSubproject();
          break;
        default:
          toast.info('Funcție în dezvoltare');
      }
    } catch (error) {
      console.error(`Eroare la ${actionType}:`, error);
      toast.error(`Eroare la executarea acțiunii: ${actionType}`);
    } finally {
      setLoading(null);
    }
  };

  const handleViewDetails = async () => {
    // TODO: Implementare modal cu detalii complete
    toast.info(`Vizualizare detalii pentru ${proiect.ID_Proiect}`);
  };

  const handleEdit = async () => {
    // TODO: Implementare modal editare
    toast.info(`Editare proiect ${proiect.ID_Proiect}`);
  };

  const handleGenerateContract = async () => {
    try {
      const response = await fetch('/api/actions/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proiectId: proiect.ID_Proiect })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Contract generat cu succes!');
        if (result.downloadUrl) {
          // Download automat
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

      console.log('Invoice response status:', response.status); // Debug
      const result = await response.json();
      console.log('Invoice response data:', result); // Debug

      if (result.success) {
        toast.success('Factură creată cu succes în factureaza.me!');
        
        // Deschide factura în tab nou dacă există URL
        if (result.invoiceUrl) {
          window.open(result.invoiceUrl, '_blank');
        }
        
        // Opțional: descarcă automat factura
        if (result.downloadUrl) {
          const downloadConfirm = confirm('Vrei să descarci factura acum?');
          if (downloadConfirm) {
            window.open(result.downloadUrl, '_blank');
          }
        }
        
        // Actualează lista pentru a reflecta modificările
        onRefresh?.();
      } else {
        console.error('Eroare factură:', result); // Debug
        toast.error(`Eroare factură: ${result.error || 'Eroare necunoscută'}`);
      }
    } catch (error) {
      console.error('Eroare la crearea facturii:', error); // Debug
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

  const handleUpdateStatus = async () => {
    const newStatus = proiect.Status === 'Activ' ? 'Finalizat' : 'Activ';
    
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

  const handleAddSubproject = async () => {
    const denumire = prompt(`Denumire subproiect pentru ${proiect.ID_Proiect}:`);
    const responsabil = prompt('Responsabil subproiect:');
    
    if (!denumire) return;

    try {
      const response = await fetch('/api/rapoarte/subproiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ID_Subproiect: `${proiect.ID_Proiect}_SUB_${Date.now()}`,
          ID_Proiect: proiect.ID_Proiect,
          Denumire: denumire,
          Responsabil: responsabil || '',
          Status: 'Planificat'
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Subproiect adăugat cu succes!');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Eroare la adăugarea subproiectului');
      }
    } catch (error) {
      toast.error('Eroare la adăugarea subproiectului');
    }
  };

  const handleArchive = async () => {
    const confirmed = confirm(`Sigur vrei să arhivezi proiectul ${proiect.ID_Proiect}?`);
    if (!confirmed) return;

    try {
      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: proiect.ID_Proiect, 
          Status: 'Arhivat' 
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Proiect arhivat cu succes!');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Eroare la arhivarea proiectului');
      }
    } catch (error) {
      toast.error('Eroare la arhivarea proiectului');
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
          zIndex: 1000,
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

          {/* Acțiuni principale */}
          <div style={{ padding: '8px 0' }}>
            <ActionButton 
              onClick={() => handleAction('view')}
              icon="👁️"
              text="Vezi Detalii"
              loading={loading === 'view'}
            />
            
            <ActionButton 
              onClick={() => handleAction('edit')}
              icon="✏️"
              text="Editează"
              loading={loading === 'edit'}
            />
          </div>

          <div style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
            <ActionButton 
              onClick={() => handleAction('contract')}
              icon="📄"
              text="Generează Contract"
              loading={loading === 'contract'}
            />
            
            <ActionButton 
              onClick={() => handleAction('invoice')}
              icon="💰"
              text="Creează Factură"
              loading={loading === 'invoice'}
            />
            
            <ActionButton 
              onClick={() => handleAction('email')}
              icon="📧"
              text="Trimite Email Client"
              loading={loading === 'email'}
            />
          </div>

          <div style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
            <ActionButton 
              onClick={() => handleAction('status')}
              icon="📊"
              text={`Marchează ${proiect.Status === 'Activ' ? 'Finalizat' : 'Activ'}`}
              loading={loading === 'status'}
            />
            
            <ActionButton 
              onClick={() => handleAction('archive')}
              icon="🗑️"
              text="Arhivează Proiect"
              loading={loading === 'archive'}
              danger
            />
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
            zIndex: 999
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  icon: string;
  text: string;
  loading?: boolean;
  danger?: boolean;
}

function ActionButton({ onClick, icon, text, loading, danger }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        color: danger ? '#e74c3c' : '#2c3e50',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background-color 0.2s'
      }}
      onMouseOver={(e) => {
        if (!loading) {
          e.currentTarget.style.background = danger ? '#fdf2f2' : '#f8f9fa';
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ minWidth: '16px' }}>
        {loading ? '⏳' : icon}
      </span>
      <span style={{ opacity: loading ? 0.6 : 1 }}>
        {text}
      </span>
    </button>
  );
}
