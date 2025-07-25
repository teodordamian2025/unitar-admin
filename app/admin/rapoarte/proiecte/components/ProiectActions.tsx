// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectActions.tsx
// MODIFICAT: Adăugat "Adauga subproiect" + modal pentru subproiecte
// ==================================================================

'use client';

import React from 'react';
import { toast } from 'react-toastify';
import FacturaHibridModal from './FacturaHibridModal';

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
    tip?: 'proiect' | 'subproiect'; // Pentru a diferenția tipul
  };
  onRefresh?: () => void;
}

// ✅ NOUĂ: Interfață pentru datele subproiectului
interface SubproiectData {
  denumire: string;
  responsabil: string;
  dataStart: string;
  dataFinal: string;
  valoareEstimata: number;
  status: string;
}

export default function ProiectActions({ proiect, onRefresh }: ProiectActionsProps) {
  const [showFacturaModal, setShowFacturaModal] = React.useState(false);
  const [showSubproiectModal, setShowSubproiectModal] = React.useState(false);

  // ✅ ACTUALIZAT: Actions cu "Adauga subproiect" doar pentru proiectele principale
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
    // ✅ NOUĂ: Adaugă subproiect doar pentru proiectele principale
    ...(proiect.tip !== 'subproiect' ? [{
      key: 'add_subproject',
      label: 'Adaugă Subproiect',
      icon: '📂',
      color: 'success' as const,
      disabled: proiect.Status === 'Anulat' || proiect.Status === 'Arhivat'
    }] : []),
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
      label: 'Generează Factură PDF',
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
        case 'duplicate':
          await handleDuplicate();
          break;
        case 'add_subproject':
          // ✅ NOUĂ: Deschide modalul pentru subproiect
          handleAddSubproject();
          break;
        case 'generate_contract':
          await handleGenerateContract();
          break;
        case 'generate_invoice':
          handleCreateInvoiceHibrid();
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

  // ✅ NOUĂ FUNCȚIE: Deschide modalul pentru adăugare subproiect
  const handleAddSubproject = () => {
    setShowSubproiectModal(true);
  };

  const handleCreateInvoiceHibrid = () => {
    setShowFacturaModal(true);
  };

  const handleInvoiceSuccess = (invoiceId: string, downloadUrl: string) => {
    setShowFacturaModal(false);
    toast.success(`Factura ${invoiceId} a fost generată cu succes!`);
    
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleViewDetails = async () => {
    toast.info(`Vizualizare detalii pentru ${proiect.ID_Proiect}`);
  };

  const handleEdit = async () => {
    toast.info(`Editare ${proiect.tip === 'subproiect' ? 'subproiect' : 'proiect'} ${proiect.ID_Proiect}`);
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
    const itemType = proiect.tip === 'subproiect' ? 'subproiectul' : 'proiectul';
    const confirmed = confirm(`Sigur vrei să ștergi ${itemType} ${proiect.ID_Proiect}?`);
    if (!confirmed) return;

    try {
      const apiEndpoint = proiect.tip === 'subproiect' 
        ? `/api/rapoarte/subproiecte?id=${proiect.ID_Proiect}`
        : `/api/rapoarte/proiecte?id=${proiect.ID_Proiect}`;
      
      const response = await fetch(apiEndpoint, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} șters cu succes!`);
        onRefresh?.();
      } else {
        toast.error(result.error || `Eroare la ștergerea ${itemType}`);
      }
    } catch (error) {
      toast.error(`Eroare la ștergerea ${itemType}`);
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
    <>
      <EnhancedActionDropdown
        actions={actions}
        onAction={handleAction}
        proiect={proiect}
        getColorClass={getColorClass}
      />
      
      {/* Modal pentru factură hibridă */}
      {showFacturaModal && (
        <FacturaHibridModal
          proiect={proiect}
          onClose={() => setShowFacturaModal(false)}
          onSuccess={handleInvoiceSuccess}
        />
      )}

      {/* ✅ NOUĂ: Modal pentru adăugare subproiect */}
      {showSubproiectModal && (
        <SubproiectModal
          proiectParinte={proiect}
          onClose={() => setShowSubproiectModal(false)}
          onSuccess={() => {
            setShowSubproiectModal(false);
            toast.success('Subproiect adăugat cu succes!');
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}

// ✅ NOUĂ COMPONENTĂ: Modal pentru adăugare subproiect
interface SubproiectModalProps {
  proiectParinte: any;
  onClose: () => void;
  onSuccess: () => void;
}

function SubproiectModal({ proiectParinte, onClose, onSuccess }: SubproiectModalProps) {
  const [formData, setFormData] = React.useState<SubproiectData>({
    denumire: '',
    responsabil: '',
    dataStart: new Date().toISOString().split('T')[0],
    dataFinal: '',
    valoareEstimata: 0,
    status: 'Activ'
  });
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.denumire.trim()) {
      toast.error('Denumirea subproiectului este obligatorie');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Generează ID unic pentru subproiect
      const subproiectId = `${proiectParinte.ID_Proiect}_SUB_${Date.now()}`;
      
      const response = await fetch('/api/rapoarte/subproiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ID_Subproiect: subproiectId,
          ID_Proiect: proiectParinte.ID_Proiect,
          Denumire: formData.denumire.trim(),
          Responsabil: formData.responsabil.trim() || null,
          Data_Start: formData.dataStart || null,
          Data_Final: formData.dataFinal || null,
          Valoare_Estimata: formData.valoareEstimata || null,
          Status: formData.status
        })
      });

      const result = await response.json();

      if (result.success) {
        onSuccess();
      } else {
        toast.error(result.error || 'Eroare la adăugarea subproiectului');
      }
    } catch (error) {
      toast.error('Eroare la adăugarea subproiectului');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof SubproiectData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              📂 Adaugă Subproiect Nou
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Proiect părinte: {proiectParinte.ID_Proiect} - {proiectParinte.Denumire}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl p-1"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Denumire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Denumire Subproiect *
            </label>
            <input
              type="text"
              value={formData.denumire}
              onChange={(e) => updateField('denumire', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Introduceți denumirea subproiectului..."
              required
            />
          </div>

          {/* Grid pentru câmpurile în două coloane */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Responsabil */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Responsabil
              </label>
              <input
                type="text"
                value={formData.responsabil}
                onChange={(e) => updateField('responsabil', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Numele responsabilului..."
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Activ">Activ</option>
                <option value="Suspendat">Suspendat</option>
                <option value="Finalizat">Finalizat</option>
              </select>
            </div>

            {/* Data Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Început
              </label>
              <input
                type="date"
                value={formData.dataStart}
                onChange={(e) => updateField('dataStart', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Finalizare
              </label>
              <input
                type="date"
                value={formData.dataFinal}
                onChange={(e) => updateField('dataFinal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Valoare Estimată */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valoare Estimată (RON)
            </label>
            <input
              type="number"
              value={formData.valoareEstimata || ''}
              onChange={(e) => updateField('valoareEstimata', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          {/* Info despre proiectul părinte */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Informații Proiect Părinte:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div><strong>Client:</strong> {proiectParinte.Client}</div>
              <div><strong>Status:</strong> {proiectParinte.Status}</div>
              <div><strong>Valoare:</strong> {proiectParinte.Valoare_Estimata ? `${proiectParinte.Valoare_Estimata} RON` : 'N/A'}</div>
              <div><strong>Data start:</strong> {proiectParinte.Data_Start || 'N/A'}</div>
            </div>
          </div>

          {/* Butoane */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 disabled:opacity-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.denumire.trim()}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>⏳ Se adaugă...</>
              ) : (
                <>📂 Adaugă Subproiect</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Componenta dropdown rămâne neschimbată
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
          zIndex: 9999,
          minWidth: '220px',
          marginTop: '4px'
        }}>
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
              {proiect.tip === 'subproiect' && (
                <span style={{ 
                  marginLeft: '8px',
                  fontSize: '10px',
                  background: '#3498db',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '3px'
                }}>
                  SUB
                </span>
              )}
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

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
