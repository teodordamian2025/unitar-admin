'use client';

// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectActions.tsx
// MODIFICAT: Fix React Error #31 + buton "Mai adaugă subproiect" + toast optimizat
// ==================================================================

import React from 'react';
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
    Data_Start?: string | { value: string }; // ✅ FIX: Support pentru ambele formate
    Data_Final?: string | { value: string }; // ✅ FIX: Support pentru ambele formate
    tip?: 'proiect' | 'subproiect';
    Responsabil?: string;
    Adresa?: string;
    Observatii?: string;
  };
  onRefresh?: () => void;
}

// ✅ FIX: Toast simple fără dependențe externe cu durată optimizată
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 400px;
    word-wrap: break-word;
    white-space: pre-line;
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  // ✅ FIX: Durată optimizată - mai mult pentru mesaje lungi
  setTimeout(() => {
    if (document.body.contains(toastEl)) {
      document.body.removeChild(toastEl);
    }
  }, type === 'success' ? 4000 : type === 'error' ? 5000 : type === 'info' && message.length > 200 ? 10000 : 6000);
};

export default function ProiectActions({ proiect, onRefresh }: ProiectActionsProps) {
  const [showFacturaModal, setShowFacturaModal] = React.useState(false);
  const [showSubproiectModal, setShowSubproiectModal] = React.useState(false);

  // ✅ FIX: Helper pentru formatarea datelor
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

  // ✅ FIX: Deschide modalul pentru adăugare subproiect
  const handleAddSubproject = () => {
    setShowSubproiectModal(true);
  };

  const handleCreateInvoiceHibrid = () => {
    setShowFacturaModal(true);
  };

  const handleInvoiceSuccess = (invoiceId: string, downloadUrl: string) => {
    setShowFacturaModal(false);
    showToast(`Factura ${invoiceId} a fost generată cu succes!`, 'success');
    
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleViewDetails = async () => {
    // ✅ FIX: Afișează detalii complete în toast
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
    // ✅ FIX: Modal de confirmare pentru editare
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
    <>
      <EnhancedActionDropdown
        actions={actions}
        onAction={handleAction}
        proiect={proiect}
      />
      
      {/* Modal pentru factură hibridă */}
      {showFacturaModal && (
        <FacturaHibridModal
          proiect={proiect}
          onClose={() => setShowFacturaModal(false)}
          onSuccess={handleInvoiceSuccess}
        />
      )}

      {/* ✅ FIX: Modal pentru adăugare subproiect - VERSIUNE SAFE cu buton "Mai adaugă" */}
      {showSubproiectModal && (
        <SubproiectModal
          proiectParinte={proiect}
          onClose={() => setShowSubproiectModal(false)}
          onSuccess={() => {
            // ✅ NOUĂ: Nu închide modalul automat, doar refreshează datele
            showToast('✅ Subproiect adăugat cu succes!', 'success');
            onRefresh?.();
            showToast('💡 Poți adăuga încă un subproiect sau închide modalul!', 'info');
          }}
        />
      )}
    </>
  );
}

// ✅ FIX: Modal pentru adăugare subproiect - SAFE IMPLEMENTATION cu buton "Mai adaugă"
interface SubproiectModalProps {
  proiectParinte: any;
  onClose: () => void;
  onSuccess: () => void;
}

function SubproiectModal({ proiectParinte, onClose, onSuccess }: SubproiectModalProps) {
  // ✅ FIX: State safe cu strings pentru toate valorile
  const [formData, setFormData] = React.useState({
    denumire: '',
    responsabil: '',
    dataStart: new Date().toISOString().split('T')[0],
    dataFinal: '',
    valoareEstimata: '0',
    status: 'Activ'
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // ✅ FIX: Handler safe pentru input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ NOUĂ: Funcție pentru resetarea formularului
  const resetForm = () => {
    setFormData({
      denumire: '',
      responsabil: '',
      dataStart: new Date().toISOString().split('T')[0],
      dataFinal: '',
      valoareEstimata: '0',
      status: 'Activ'
    });
    showToast('📋 Formular resetat pentru noul subproiect!', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.denumire.trim()) {
      showToast('Denumirea subproiectului este obligatorie', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const subproiectId = `${proiectParinte.ID_Proiect}_SUB_${Date.now()}`;
      
      const requestData = {
        ID_Subproiect: subproiectId,
        ID_Proiect: proiectParinte.ID_Proiect,
        Denumire: formData.denumire.trim(),
        Responsabil: formData.responsabil.trim() || null,
        Data_Start: formData.dataStart || null,
        Data_Final: formData.dataFinal || null,
        Valoare_Estimata: formData.valoareEstimata ? parseFloat(formData.valoareEstimata) : null,
        Status: formData.status
      };

      console.log('Trimitere subproiect:', requestData);

      const response = await fetch('/api/rapoarte/subproiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      console.log('Răspuns subproiect:', result);

      if (result.success) {
        onSuccess(); // Trigger refresh fără închiderea modalului
        // Reset formular pentru următorul subproiect
        resetForm();
      } else {
        showToast(result.error || 'Eroare la adăugarea subproiectului', 'error');
      }
    } catch (error) {
      console.error('Eroare la adăugarea subproiectului:', error);
      showToast('Eroare la adăugarea subproiectului', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header îmbunătățit */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              📂 Adaugă Subproiect Nou
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              🏗️ Proiect părinte: <span className="font-mono font-semibold">{proiectParinte.ID_Proiect}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {proiectParinte.Denumire}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        {/* Form îmbunătățit */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Denumire cu design îmbunătățit */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📝 Denumire Subproiect *
            </label>
            <input
              type="text"
              value={formData.denumire}
              onChange={(e) => handleInputChange('denumire', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="Introduceți denumirea subproiectului..."
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Grid pentru câmpurile în două coloane */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Responsabil */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Responsabil
              </label>
              <input
                type="text"
                value={formData.responsabil}
                onChange={(e) => handleInputChange('responsabil', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Numele responsabilului..."
                disabled={isSubmitting}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Planificat">📅 Planificat</option>
                <option value="Suspendat">⏸️ Suspendat</option>
                <option value="Finalizat">✅ Finalizat</option>
              </select>
            </div>

            {/* Data Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Început
              </label>
              <input
                type="date"
                value={formData.dataStart}
                onChange={(e) => handleInputChange('dataStart', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏁 Data Finalizare
              </label>
              <input
                type="date"
                value={formData.dataFinal}
                onChange={(e) => handleInputChange('dataFinal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Valoare Estimată */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💰 Valoare Estimată (RON)
            </label>
            <input
              type="number"
              value={formData.valoareEstimata}
              onChange={(e) => handleInputChange('valoareEstimata', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={isSubmitting}
            />
          </div>

          {/* Info despre proiectul părinte îmbunătățit */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              🏗️ Informații Proiect Părinte
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white p-2 rounded border">
                <div className="text-gray-600 text-xs">CLIENT</div>
                <div className="font-medium">{proiectParinte.Client}</div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-gray-600 text-xs">STATUS</div>
                <div className="font-medium">{proiectParinte.Status}</div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-gray-600 text-xs">VALOARE</div>
                <div className="font-medium">
                  {proiectParinte.Valoare_Estimata ? `${proiectParinte.Valoare_Estimata.toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-gray-600 text-xs">ADRESĂ</div>
                <div className="font-medium text-xs">{proiectParinte.Adresa || 'Nespecificată'}</div>
              </div>
            </div>
          </div>

          {/* ✅ NOUĂ: Butoane îmbunătățite cu "Mai adaugă" */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              ✕ Închide
            </button>
            
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !formData.denumire.trim()}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <>⏳ Se adaugă...</>
                ) : (
                  <>📂 Adaugă Subproiect</>
                )}
              </button>
              
              {/* ✅ NOUĂ: Butonul "Mai adaugă subproiect" */}
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-1 transition-colors"
                title="Resetează formularul pentru a adăuga alt subproiect"
              >
                ➕ Mai adaugă
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ✅ FIX: Componenta dropdown simplificată și stabilă
interface EnhancedActionDropdownProps {
  actions: ActionItem[];
  onAction: (actionKey: string) => void;
  proiect: any;
}

function EnhancedActionDropdown({ actions, onAction, proiect }: EnhancedActionDropdownProps) {
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
        <>
          {/* Overlay pentru a închide dropdown-ul */}
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

          {/* Dropdown menu */}
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
        </>
      )}
    </div>
  );
}
