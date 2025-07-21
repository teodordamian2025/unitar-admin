// ==================================================================
// CALEA: app/admin/rapoarte/components/ActionDropdown.tsx
// MODIFICAT: Înlocuit factureaza.me cu sistemul hibrid
// ==================================================================

'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';

interface ActionDropdownProps {
  proiect: {
    ID_Proiect: string;
    Denumire: string;
    Client: string;
    Status: string;
    Valoare_Estimata?: number;
  };
  onRefresh?: () => void;
}

export default function ActionDropdown({ proiect, onRefresh }: ActionDropdownProps) {
  const [showActions, setShowActions] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const handleCreateInvoice = async () => {
    try {
      setIsGeneratingInvoice(true);
      setShowActions(false);
      
      // MODIFICAT: Folosește sistemul hibrid în loc de factureaza.me
      toast.info('Se generează factura PDF...');
      
      const response = await fetch('/api/actions/invoices/generate-hibrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          proiectId: proiect.ID_Proiect,
          liniiFactura: [{
            denumire: `Servicii proiect ${proiect.Denumire}`,
            cantitate: 1,
            pretUnitar: proiect.Valoare_Estimata || 0,
            cotaTva: 19
          }],
          observatii: `Factură generată automat pentru proiectul ${proiect.ID_Proiect}`
        })
      });

      console.log('Invoice response status:', response.status);
      const result = await response.json();
      console.log('Invoice response data:', result);

      if (result.success) {
        toast.success('Factură PDF generată cu succes!');
        
        // Download automat
        if (result.downloadUrl) {
          window.open(result.downloadUrl, '_blank');
        }
        
        if (onRefresh) {
          onRefresh();
        }
      } else {
        throw new Error(result.error || 'Eroare la generarea facturii');
      }
      
    } catch (error) {
      console.error('Eroare factură:', error);
      toast.error(`Eroare la generarea facturii: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleGenerateContract = async () => {
    try {
      setShowActions(false);
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
          window.open(result.downloadUrl, '_blank');
        }
      } else {
        toast.error(result.error || 'Eroare la generarea contractului');
      }
    } catch (error) {
      toast.error('Eroare la generarea contractului');
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShowActions(!showActions)}
        disabled={isGeneratingInvoice}
        style={{
          padding: '8px 16px',
          backgroundColor: isGeneratingInvoice ? '#95a5a6' : '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isGeneratingInvoice ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }}
      >
        {isGeneratingInvoice ? '⏳ Generare...' : '⚙️ Acțiuni'}
      </button>

      {showActions && !isGeneratingInvoice && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '200px',
              marginTop: '4px'
            }}
          >
            <div style={{ padding: '8px 0' }}>
              <button
                onClick={handleCreateInvoice}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>💰</span>
                <span>Generează Factură PDF</span>
              </button>

              <div style={{ height: '1px', backgroundColor: '#eee', margin: '4px 0' }} />

              <button
                onClick={handleGenerateContract}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>📄</span>
                <span>Generează Contract</span>
              </button>
            </div>
          </div>

          {/* Overlay pentru închidere */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onClick={() => setShowActions(false)}
          />
        </>
      )}
    </div>
  );
}
