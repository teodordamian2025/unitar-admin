'use client';

// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ProiectActions.tsx
// MODIFICAT: Glassmorphism Premium + Dropdown Inteligent + Workflow îmbunătățit + OPACITATE FIXATĂ COMPLET
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
    Data_Start?: string | { value: string };
    Data_Final?: string | { value: string };
    tip?: 'proiect' | 'subproiect';
    Responsabil?: string;
    Adresa?: string;
    Observatii?: string;
  };
  onRefresh?: () => void;
}

// ✅ FIX: System global pentru management dropdown-uri multiple
let currentOpenDropdown: string | null = null;
const openDropdowns = new Map<string, () => void>();

// ✅ Toast system Glassmorphism Premium
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    padding: 16px 20px;
    border-radius: 16px;
    z-index: 15000;
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

export default function ProiectActions({ proiect, onRefresh }: ProiectActionsProps) {
  const [showFacturaModal, setShowFacturaModal] = React.useState(false);
  const [showSubproiectModal, setShowSubproiectModal] = React.useState(false);

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

      {/* ✅ Modal Glassmorphism pentru adăugare subproiect OPACITATE FIXATĂ */}
      {showSubproiectModal && (
        <SubproiectModal
          proiectParinte={proiect}
          onClose={() => setShowSubproiectModal(false)}
          onSuccess={() => {
            showToast('✅ Subproiect adăugat cu succes!', 'success');
            onRefresh?.();
            showToast('💡 Poți adăuga încă un subproiect sau închide modalul!', 'info');
          }}
        />
      )}
    </>
  );
}

// ✅ Modal Glassmorphism Premium pentru adăugare subproiect OPACITATE FIXATĂ COMPLET
interface SubproiectModalProps {
  proiectParinte: any;
  onClose: () => void;
  onSuccess: () => void;
}

function SubproiectModal({ proiectParinte, onClose, onSuccess }: SubproiectModalProps) {
  const [formData, setFormData] = React.useState({
    denumire: '',
    responsabil: '',
    dataStart: new Date().toISOString().split('T')[0],
    dataFinal: '',
    valoareEstimata: '0',
    status: 'Activ'
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
        onSuccess();
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
    <div style={{
      position: 'fixed' as const,
      inset: '0',
      background: 'rgba(0, 0, 0, 0.6)', // ✅ Overlay puternic pentru blocare
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 12000,
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)', // ✅ Shadow puternic pentru separare (luat de la dropdown-ul care urcă)
        border: '1px solid #e0e0e0', // ✅ Border solid pentru delimitare clară (luat de la dropdown-ul care urcă)
        position: 'relative' as const,
        // ✅ ELIMINAT orice animație sau proprietate care poate afecta opacitatea
        transform: 'scale(1)',
        opacity: 1 // ✅ OPACITATE 100% - COMPLETĂ (luat de la dropdown-ul care urcă)
      }}>
        {/* Header SOLID pentru subproiect */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid #e0e0e0', // ✅ Border solid
          background: '#e8f5e8', // ✅ Background solid verde deschis - COMPLET OPAC (luat de la dropdown-ul care urcă)
          borderRadius: '16px 16px 0 0'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#2c3e50',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📂 Adaugă Subproiect Nou
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#7f8c8d',
              margin: '0.5rem 0 0 0',
              fontWeight: '500'
            }}>
              🏗️ Proiect părinte: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#3498db' }}>{proiectParinte.ID_Proiect}</span>
            </p>
            <p style={{
              fontSize: '12px',
              color: '#95a5a6',
              margin: '0.25rem 0 0 0'
            }}>
              {proiectParinte.Denumire}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'rgba(231, 76, 60, 0.1)',
              color: '#e74c3c',
              border: 'none',
              borderRadius: '12px',
              width: '48px',
              height: '48px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '20px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.2)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseOut={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            ✕
          </button>
        </div>

        {/* ✅ Form Glassmorphism COMPLET OPAC */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Denumire cu design Glassmorphism COMPLET OPAC */}
          <div style={{
            background: '#f0f8ff', // ✅ BACKGROUND SOLID albastru foarte deschis - COMPLET OPAC (luat de la dropdown-ul care urcă)
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid #cce7ff', // ✅ Border solid albastru deschis (luat de la dropdown-ul care urcă)
            boxShadow: '0 4px 12px rgba(52, 152, 219, 0.15)' // ✅ Shadow subtil (luat de la dropdown-ul care urcă)
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '0.75rem'
            }}>
              📝 Denumire Subproiect *
            </label>
            <input
              type="text"
              value={formData.denumire}
              onChange={(e) => handleInputChange('denumire', e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
                borderRadius: '12px',
                fontSize: '16px',
                background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
              }}
              placeholder="Introduceți denumirea subproiectului..."
              required
              disabled={isSubmitting}
              onFocus={(e) => {
                e.currentTarget.style.border = '2px solid #3498db';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid #e0e0e0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Grid pentru câmpuri în două coloane COMPLET OPAC */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {/* Responsabil COMPLET OPAC */}
            <div style={{
              background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' // ✅ Shadow subtil (luat de la dropdown-ul care urcă)
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                👤 Responsabil
              </label>
              <input
                type="text"
                value={formData.responsabil}
                onChange={(e) => handleInputChange('responsabil', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                placeholder="Numele responsabilului..."
                disabled={isSubmitting}
              />
            </div>

            {/* Status COMPLET OPAC */}
            <div style={{
              background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
              padding: '1rem', // ✅ Corectat (era 1.25rem)
              borderRadius: '12px', // ✅ Corectat (era 16px)
              border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' // ✅ Shadow subtil (luat de la dropdown-ul care urcă)
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                📊 Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                disabled={isSubmitting}
              >
                <option value="Activ">🟢 Activ</option>
                <option value="Planificat">📅 Planificat</option>
                <option value="Suspendat">⏸️ Suspendat</option>
                <option value="Finalizat">✅ Finalizat</option>
              </select>
            </div>

            {/* Data Start COMPLET OPAC */}
            <div style={{
              background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
              padding: '1rem', // ✅ Corectat (era 1.25rem)
              borderRadius: '12px', // ✅ Corectat (era 16px)
              border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' // ✅ Shadow subtil (luat de la dropdown-ul care urcă)
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                📅 Data Început
              </label>
              <input
                type="date"
                value={formData.dataStart}
                onChange={(e) => handleInputChange('dataStart', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                disabled={isSubmitting}
              />
            </div>

            {/* Data Final COMPLET OPAC */}
            <div style={{
              background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
              padding: '1rem', // ✅ Corectat (era 1.25rem)
              borderRadius: '12px', // ✅ Corectat (era 16px)
              border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' // ✅ Shadow subtil (luat de la dropdown-ul care urcă)
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '0.75rem'
              }}>
                🏁 Data Finalizare
              </label>
              <input
                type="date"
                value={formData.dataFinal}
                onChange={(e) => handleInputChange('dataFinal', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
                  borderRadius: '12px',
                  fontSize: '14px',
                  background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Valoare Estimată COMPLET OPAC */}
          <div style={{
            background: '#e8f8e8', // ✅ BACKGROUND SOLID verde foarte deschis - COMPLET OPAC (luat de la dropdown-ul care urcă)
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid #c3e6cb', // ✅ Border solid verde deschis (luat de la dropdown-ul care urcă)
            boxShadow: '0 4px 12px rgba(39, 174, 96, 0.15)' // ✅ Shadow subtil verde (luat de la dropdown-ul care urcă)
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '0.75rem'
            }}>
              💰 Valoare Estimată (RON)
            </label>
            <input
              type="number"
              value={formData.valoareEstimata}
              onChange={(e) => handleInputChange('valoareEstimata', e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
                borderRadius: '12px',
                fontSize: '16px',
                background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
              }}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={isSubmitting}
            />
          </div>

          {/* Info despre proiectul părinte Glassmorphism COMPLET OPAC */}
          <div style={{
            background: '#f8f9fa', // ✅ BACKGROUND SOLID gri foarte deschis - COMPLET OPAC (luat de la dropdown-ul care urcă)
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' // ✅ Shadow subtil (luat de la dropdown-ul care urcă)
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🏗️ Informații Proiect Părinte
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0' // ✅ Border solid (luat de la dropdown-ul care urcă)
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLIENT</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Client}</div>
              </div>
              <div style={{
                background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0' // ✅ Border solid (luat de la dropdown-ul care urcă)
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Status}</div>
              </div>
              <div style={{
                background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0' // ✅ Border solid (luat de la dropdown-ul care urcă)
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VALOARE</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#27ae60', marginTop: '0.25rem' }}>
                  {proiectParinte.Valoare_Estimata ? `${proiectParinte.Valoare_Estimata.toLocaleString('ro-RO')} RON` : 'N/A'}
                </div>
              </div>
              <div style={{
                background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (luat de la dropdown-ul care urcă)
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e0e0e0' // ✅ Border solid (luat de la dropdown-ul care urcă)
              }}>
                <div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ADRESĂ</div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c3e50', marginTop: '0.25rem' }}>{proiectParinte.Adresa || 'Nespecificată'}</div>
              </div>
            </div>
          </div>

          {/* ✅ Butoane Glassmorphism cu workflow îmbunătățit COMPLET OPAC */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e0e0e0' // ✅ Border solid
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: '#f8f9fa', // ✅ BACKGROUND SOLID gri foarte deschis - COMPLET OPAC (luat de la dropdown-ul care urcă)
                color: '#6c757d', // ✅ CULOARE SOLIDĂ gri (luat de la dropdown-ul care urcă)
                border: '1px solid #e0e0e0', // ✅ Border solid (luat de la dropdown-ul care urcă)
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = '#e9ecef'; // ✅ BACKGROUND SOLID gri deschis - COMPLET OPAC (luat de la dropdown-ul care urcă)
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseOut={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = '#f8f9fa';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              ✕ Închide
            </button>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={isSubmitting || !formData.denumire.trim()}
                style={{
                  background: isSubmitting || !formData.denumire.trim() ? 
                    '#f8f9fa' : 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)', // ✅ BACKGROUND SOLID gri deschis sau gradient (luat de la dropdown-ul care urcă)
                  color: isSubmitting || !formData.denumire.trim() ? '#6c757d' : 'white', // ✅ CULORI SOLIDE (luat de la dropdown-ul care urcă)
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (isSubmitting || !formData.denumire.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: (isSubmitting || !formData.denumire.trim()) ? 'none' : '0 4px 12px rgba(52, 152, 219, 0.4)'
                }}
                onMouseOver={(e) => {
                  if (!isSubmitting && formData.denumire.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSubmitting && formData.denumire.trim()) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.4)';
                  }
                }}
              >
                {isSubmitting ? (
                  <>⏳ Se adaugă...</>
                ) : (
                  <>📂 Adaugă Subproiect</>
                )}
              </button>
              
              {/* ✅ Butonul "Resetează" înlocuiește "Mai adaugă" pentru UX mai bun */}
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(39, 174, 96, 0.4)'
                }}
                title="Resetează formularul pentru a adăuga alt subproiect"
                onMouseOver={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(39, 174, 96, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.4)';
                  }
                }}
              >
                🔄 Resetează
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ✅ Dropdown Glassmorphism Premium cu poziționare inteligentă OPACITATE FIXATĂ COMPLET
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

  // ✅ FIX: Calculează poziționarea inteligentă - CORECTATĂ COMPLET
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
    }); // ✅ Debug cu ID
    
    // ✅ FIX: Logică corectată - dacă e la început (sus), coboară jos; dacă e la sfârșit (jos), urcă sus
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
    setIsOpen(false); // ✅ Închide dropdown-ul
    
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
            '#f8f9fa' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // ✅ BACKGROUND SOLID gri deschis sau gradient (luat de la dropdown-ul care urcă)
          color: loading ? '#6c757d' : 'white', // ✅ CULORI SOLIDE (luat de la dropdown-ul care urcă)
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
          {/* ✅ Overlay Glassmorphism cu opacitate mărită */}
          <div
            style={{
              position: 'fixed' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)', // ✅ Păstrat pentru blocare interacțiune
              backdropFilter: 'blur(6px)',
              zIndex: 10998
            }}
            onClick={() => {
              console.log(`🔘 Overlay ${dropdownId} clicked - closing`);
              setIsOpen(false);
            }}
          />

          {/* ✅ Dropdown OPACITATE FIXATĂ COMPLET - ELIMINAT TOATE ANIMAȚIILE CARE RESETEAZĂ OPACITY */}
          <div style={{
            position: 'absolute' as const,
            ...(dropdownPosition === 'bottom' 
              ? { top: '100%', marginTop: '8px' }
              : { bottom: '100%', marginBottom: '8px' }
            ),
            right: 0,
            background: '#ffffff', // ✅ BACKGROUND SOLID ALBU - COMPLET OPAC (LUAT DE LA DROPDOWN-UL CARE URCĂ)
            opacity: 1, // ✅ OPACITATE 100% FIXĂ - FĂRĂ ANIMAȚII
            borderRadius: '16px',
            minWidth: '260px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)', // ✅ Shadow puternic pentru separare (LUAT DE LA DROPDOWN-UL CARE URCĂ)
            border: '1px solid #e0e0e0', // ✅ Border solid pentru delimitare clară (LUAT DE LA DROPDOWN-UL CARE URCĂ)
            zIndex: 10999,
            overflow: 'hidden' as const,
            transform: 'scale(1)' // ✅ SCALE STATIC - FĂRĂ ANIMAȚII
            // ✅ ELIMINAT COMPLET: animation, transition, toate proprietățile care pot reseta opacity
          }}>
            {/* ✅ ELIMINAT COMPLET: @keyframes și style cu animații care resetează opacity */}

            {/* Header OPACITATE FIXATĂ COMPLET */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #e0e0e0', // ✅ Border solid gri (LUAT DE LA DROPDOWN-UL CARE URCĂ)
              background: '#f8f9fa' // ✅ BACKGROUND SOLID gri foarte deschis - COMPLET OPAC (LUAT DE LA DROPDOWN-UL CARE URCĂ)
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

            {/* Actions cu Glassmorphism OPACITATE FIXATĂ COMPLET */}
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
                        e.currentTarget.style.background = `${getActionColor(action.color)}15`; // ✅ BACKGROUND SOLID cu transparență redusă (LUAT DE LA DROPDOWN-UL CARE URCĂ)
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
