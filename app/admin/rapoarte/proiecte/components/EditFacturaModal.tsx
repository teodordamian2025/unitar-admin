// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// MODIFICAT: Suport complet pentru Edit/Storno cu date din BD
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
  const [proiectData, setProiectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && factura) {
      loadFacturaCompleteData();
    }
  }, [isOpen, factura, mode]);

  const loadFacturaCompleteData = async () => {
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

      // ✅ MODIFICAT: Încarcă date proiect din BD dacă avem proiect_id
      let proiectInfo = dateComplete.proiectInfo || {};
      if (factura.proiect_id) {
        try {
          const proiectResponse = await fetch(`/api/rapoarte/proiecte?search=${factura.proiect_id}`);
          const proiectData = await proiectResponse.json();
          
          if (proiectData.success && proiectData.data && proiectData.data.length > 0) {
            const proiect = proiectData.data[0];
            proiectInfo = {
              id: proiect.ID_Proiect,
              denumire: proiect.Denumire,
              client: proiect.Client,
              valoare: proiect.Valoare_Estimata,
              moneda: proiect.moneda,
              curs_valutar: proiect.curs_valutar,
              valoare_ron: proiect.valoare_ron,
              status: proiect.Status
            };
            console.log('✅ Date proiect încărcate din BD:', proiectInfo);
          }
        } catch (error) {
          console.error('Eroare la încărcarea datelor proiectului:', error);
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

      // ✅ MODIFICAT: Pregătește datele pentru FacturaHibridModal cu mai multe detalii
      const proiect = {
        ID_Proiect: factura.proiect_id || proiectInfo.id || 'UNKNOWN',
        Denumire: factura.proiect_denumire || proiectInfo.denumire || 'Proiect necunoscut',
        Client: factura.client_nume || proiectInfo.client,
        Status: proiectInfo.status || 'Activ',
        Valoare_Estimata: proiectInfo.valoare || factura.subtotal,
        moneda: proiectInfo.moneda || 'RON',
        curs_valutar: proiectInfo.curs_valutar,
        valoare_ron: proiectInfo.valoare_ron,
        // Flag-uri pentru edit/storno
        _isEdit: mode === 'edit',
        _isStorno: mode === 'storno',
        _initialData: {
          liniiFactura: dateComplete.liniiFactura || [{
            denumire: proiectInfo.denumire || 'Servicii',
            cantitate: 1,
            pretUnitar: mode === 'storno' ? -factura.subtotal : factura.subtotal,
            cotaTva: factura.total_tva > 0 ? 19 : 0,
            monedaOriginala: proiectInfo.moneda,
            valoareOriginala: proiectInfo.valoare,
            cursValutar: proiectInfo.curs_valutar
          }],
          clientInfo: dateComplete.clientInfo || {
            denumire: factura.client_nume,
            cui: factura.client_cui,
            nrRegCom: '',
            adresa: ''
          },
          observatii: dateComplete.observatii || '',
          numarFactura: mode === 'edit' ? factura.numar : null,
          facturaId: mode === 'edit' ? factura.id : null,
          proiectId: factura.proiect_id,
          isEdit: mode === 'edit',
          isStorno: mode === 'storno',
          facturaOriginala: mode === 'storno' ? factura.numar : null,
          cursuriUtilizate: dateComplete.cursuriUtilizate || {}
        }
      };

      setProiectData(proiect);
      setLoading(false);
      
    } catch (error) {
      console.error('Eroare la încărcarea datelor complete ale facturii:', error);
      showToast('Eroare la încărcarea datelor facturii', 'error');
      setLoading(false);
    }
  };

  const handleFacturaSuccess = async (invoiceId: string, downloadUrl: string) => {
    try {
      if (mode === 'edit') {
        // Pentru Edit, factura a fost deja actualizată de generate-hibrid
        showToast('✅ Factură actualizată cu succes', 'success');
        onSuccess('updated', factura.id);
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
        } else {
          throw new Error('Eroare la actualizarea statusului facturii originale');
        }
      }
    } catch (error) {
      console.error('Eroare la procesarea facturii:', error);
      showToast('Eroare la procesarea facturii', 'error');
    }

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
          <div>⏳ Se încarcă datele complete ale facturii...</div>
        </div>
      </div>
    );
  }

  if (!isOpen || !proiectData) return null;

  // Folosește FacturaHibridModal cu datele încărcate
  return (
    <FacturaHibridModal
      proiect={proiectData}
      onClose={onClose}
      onSuccess={handleFacturaSuccess}
    />
  );
}
