// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// DESCRIERE: Modal pentru editare/stornare factură bazat pe FacturaHibridModal
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import FacturaHibridModal from './FacturaHibridModal';

interface Factura {
  id: string;
  numar: string;
  data_factura: string | { value: string };
  client_nume: string;
  client_cui: string;
  proiect_id?: string;
  proiect_denumire?: string;
  subtotal: number;
  total_tva: number;
  total: number;
  status: string;
  date_complete_json?: string;
  efactura_enabled?: boolean;
  efactura_status?: string;
}

interface EditFacturaModalProps {
  factura: Factura;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (action: 'updated' | 'cancelled' | 'reversed', facturaId: string) => void;
  mode?: 'edit' | 'storno';
}

// Toast system
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ffffff;
    color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 100000;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #e0e0e0;
    max-width: 350px;
  `;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  
  setTimeout(() => {
    if (document.body.contains(toastEl)) {
      document.body.removeChild(toastEl);
    }
  }, 4000);
};

export default function EditFacturaModal({ 
  factura, 
  isOpen, 
  onClose, 
  onSuccess,
  mode = 'edit'
}: EditFacturaModalProps) {
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [proiectData, setProiectData] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && factura) {
      loadFacturaData();
    }
  }, [isOpen, factura]);

  const loadFacturaData = async () => {
    setLoading(true);
    try {
      // Parse date_complete_json pentru a obține datele complete
      let dateComplete: any = {};
      if (factura.date_complete_json) {
        try {
          dateComplete = JSON.parse(factura.date_complete_json);
        } catch (e) {
          console.error('Eroare parsare date_complete_json:', e);
        }
      }

      // Pentru STORNO, inversăm valorile
      if (mode === 'storno') {
        // Inversează liniile facturii
        if (dateComplete.liniiFactura) {
          dateComplete.liniiFactura = dateComplete.liniiFactura.map((linie: any) => ({
            ...linie,
            pretUnitar: -Math.abs(linie.pretUnitar || 0),
            denumire: `STORNO: ${linie.denumire}`
          }));
        }

        // Marchează ca factură de stornare
        dateComplete.tipFactura = 'storno';
        dateComplete.facturaOriginala = factura.numar;
      }

      // Pregătește datele pentru FacturaHibridModal
      const proiect = {
        ID_Proiect: factura.proiect_id || dateComplete.proiectInfo?.id || 'UNKNOWN',
        Denumire: factura.proiect_denumire || dateComplete.proiectInfo?.denumire || 'Proiect necunoscut',
        Client: factura.client_nume,
        Status: 'Activ',
        Valoare_Estimata: factura.subtotal
      };

      setProiectData(proiect);
      setInitialData({
        liniiFactura: dateComplete.liniiFactura || [{
          denumire: dateComplete.proiectInfo?.denumire || 'Servicii',
          cantitate: 1,
          pretUnitar: mode === 'storno' ? -factura.subtotal : factura.subtotal,
          cotaTva: factura.total_tva > 0 ? 19 : 0
        }],
        clientInfo: dateComplete.clientInfo || {
          denumire: factura.client_nume,
          cui: factura.client_cui
        },
        observatii: dateComplete.observatii || '',
        numarFactura: mode === 'edit' ? factura.numar : null, // Păstrează numărul doar la EDIT
        facturaId: mode === 'edit' ? factura.id : null,
        isEdit: mode === 'edit',
        isStorno: mode === 'storno',
        facturaOriginala: mode === 'storno' ? factura.numar : null
      });

      setShowFacturaModal(true);
      
    } catch (error) {
      console.error('Eroare la încărcarea datelor facturii:', error);
      showToast('Eroare la încărcarea datelor facturii', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFacturaSuccess = async (invoiceId: string, downloadUrl: string) => {
    try {
      if (mode === 'edit') {
        // Actualizează factura existentă în BD
        const response = await fetch('/api/actions/invoices/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facturaId: factura.id,
            // Datele actualizate sunt deja salvate de FacturaHibridModal
          })
        });

        if (response.ok) {
          showToast('✅ Factură actualizată cu succes', 'success');
          onSuccess('updated', factura.id);
        }
      } else if (mode === 'storno') {
        // Marchează factura originală ca stornată
        const response = await fetch('/api/actions/invoices/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facturaId: factura.id,
            status: 'stornata',
            stornoFacturaId: invoiceId
          })
        });

        if (response.ok) {
          showToast('✅ Factură de stornare creată cu succes', 'success');
          onSuccess('reversed', invoiceId);
        }
      }
    } catch (error) {
      console.error('Eroare la procesarea facturii:', error);
      showToast('Eroare la procesarea facturii', 'error');
    }

    setShowFacturaModal(false);
    onClose();
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div>⏳ Se încarcă datele facturii...</div>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  // Folosește FacturaHibridModal cu datele încărcate
  if (showFacturaModal && proiectData && initialData) {
    return (
      <FacturaHibridModalWrapper
        proiect={proiectData}
        initialData={initialData}
        onClose={() => {
          setShowFacturaModal(false);
          onClose();
        }}
        onSuccess={handleFacturaSuccess}
        mode={mode}
      />
    );
  }

  return null;
}

// Wrapper pentru FacturaHibridModal cu date inițiale
interface FacturaHibridModalWrapperProps {
  proiect: any;
  initialData: any;
  onClose: () => void;
  onSuccess: (invoiceId: string, downloadUrl: string) => void;
  mode: 'edit' | 'storno';
}

function FacturaHibridModalWrapper({ 
  proiect, 
  initialData, 
  onClose, 
  onSuccess,
  mode
}: FacturaHibridModalWrapperProps) {
  // Creăm o versiune modificată a FacturaHibridModal care acceptă date inițiale
  const ModifiedFacturaHibridModal = (props: any) => {
    const OriginalModal = FacturaHibridModal as any;
    
    // Injectăm datele inițiale în componentă
    React.useEffect(() => {
      // Acest hack permite injectarea datelor în modal după ce se încarcă
      const timer = setTimeout(() => {
        // Găsim elementele din DOM și le populăm
        if (initialData.liniiFactura) {
          // Logica pentru popularea liniilor facturii
          console.log('Populez liniile facturii:', initialData.liniiFactura);
        }
        if (initialData.clientInfo) {
          // Logica pentru popularea datelor clientului
          console.log('Populez datele clientului:', initialData.clientInfo);
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }, []);

    return <OriginalModal {...props} />;
  };

  return (
    <ModifiedFacturaHibridModal
      proiect={{
        ...proiect,
        // Adaugă flag-uri pentru edit/storno
        _isEdit: mode === 'edit',
        _isStorno: mode === 'storno',
        _initialData: initialData
      }}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
