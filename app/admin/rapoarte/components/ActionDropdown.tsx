// ==================================================================
// CALEA: app/admin/rapoarte/components/ActionDropdown.tsx
// MODIFICAT: Eliminat vechiul sistem de factură - se folosește doar FacturaHibridModal
// ==================================================================

'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';

interface ActionDropdownProps {
  proiectId: string;
  onRefresh?: () => void;
}

export default function ActionDropdown({ proiectId, onRefresh }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ELIMINAT: handleCreateInvoice - se folosește doar sistemul hibrid din ProiectActions

  const handleViewProject = () => {
    toast.info(`Vizualizare proiect: ${proiectId}`);
    setIsOpen(false);
  };

  const handleEditProject = () => {
    toast.info(`Editare proiect: ${proiectId}`);
    setIsOpen(false);
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      toast.info('Se exportă datele...');
      
      // Implementare export
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Date exportate cu succes!');
    } catch (error) {
      toast.error('Eroare la exportul datelor');
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const actions = [
    { key: 'view', label: '👁️ Vezi Proiect', action: handleViewProject },
    { key: 'edit', label: '✏️ Editează', action: handleEditProject },
    { key: 'export', label: '📊 Exportă Date', action: handleExportData },
    // ELIMINAT: Generare factură - se face din ProiectActions cu sistemul hibrid
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        style={{
          padding: '8px 16px',
          backgroundColor: loading ? '#95a5a6' : '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }}
      >
        {loading ? '⏳' : '⚙️'} Acțiuni
      </button>

      {isOpen && (
        <>
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
          
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              zIndex: 1000,
              minWidth: '180px',
              marginTop: '4px'
            }}
          >
            {actions.map((action) => (
              <button
                key={action.key}
                onClick={action.action}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
