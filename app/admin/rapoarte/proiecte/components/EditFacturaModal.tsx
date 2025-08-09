// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/EditFacturaModal.tsx
// CORECTAT: Încărcare completă date proiect + subproiecte
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
          console.log('✅ Date complete parsate:', dateComplete);
        } catch (e) {
          console.error('Eroare parsare date_complete_json:', e);
        }
      }

      // ✅ CORECTAT: Extrage proiect_id corect
      const proiectIdActual = factura.proiect_id || 
                              dateComplete.proiectInfo?.id || 
                              dateComplete.proiectId ||
                              null;

      console.log('🔍 Proiect ID găsit:', proiectIdActual);

      // ✅ CORECTAT: Încarcă date proiect din BD
      let proiectInfo = dateComplete.proiectInfo || {};
      if (proiectIdActual) {
        try {
          // Caută exact după ID, nu după search
          const proiectResponse = await fetch(`/api/rapoarte/proiecte`);
          const proiectData = await proiectResponse.json();
          
          if (proiectData.success && proiectData.data) {
            // Găsește proiectul exact după ID
            const proiect = proiectData.data.find((p: any) => p.ID_Proiect === proiectIdActual);
            
            if (proiect) {
              proiectInfo = {
                id: proiect.ID_Proiect,
                denumire: proiect.Denumire,
                client: proiect.Client,
                valoare: proiect.Valoare_Estimata,
                moneda: proiect.moneda || 'RON',
                curs_valutar: proiect.curs_valutar,
                valoare_ron: proiect.valoare_ron,
                status: proiect.Status,
                adresa: proiect.Adresa
              };
              console.log('✅ Date proiect încărcate din BD:', proiectInfo);
            } else {
              console.warn('⚠️ Proiect nu găsit în BD pentru ID:', proiectIdActual);
            }
          }
        } catch (error) {
          console.error('Eroare la încărcarea datelor proiectului:', error);
        }
      }

      // ✅ CORECTAT: Pentru STORNO, inversăm valorile
      let liniiFacturaPregatite = dateComplete.liniiFactura || [{
        denumire: proiectInfo.denumire || factura.proiect_denumire || 'Servicii',
        cantitate: 1,
        pretUnitar: factura.subtotal,
        cotaTva: factura.total_tva > 0 ? 19 : 0,
        monedaOriginala: proiectInfo.moneda,
        valoareOriginala: proiectInfo.valoare,
        cursValutar: proiectInfo.curs_valutar
      }];

      if (mode === 'storno') {
        // Inversează valorile pentru storno
        liniiFacturaPregatite = liniiFacturaPregatite.map((linie: any) => ({
          ...linie,
          pretUnitar: -Math.abs(linie.pretUnitar || 0),
          denumire: linie.denumire.startsWith('STORNO:') ? linie.denumire : `STORNO: ${linie.denumire}`
        }));
      }

      // ✅ CORECTAT: Pregătește datele complete pentru FacturaHibridModal
      const proiect = {
        ID_Proiect: proiectIdActual || 'UNKNOWN',
        Denumire: proiectInfo.denumire || factura.proiect_denumire || 'Proiect necunoscut',
        Client: factura.client_nume || proiectInfo.client,
        Status: proiectInfo.status || 'Activ',
        Valoare_Estimata: proiectInfo.valoare || factura.subtotal,
        moneda: proiectInfo.moneda || 'RON',
        curs_valutar: proiectInfo.curs_valutar,
        valoare_ron: proiectInfo.valoare_ron,
        Adresa: proiectInfo.adresa,
        // Flag-uri pentru edit/storno
        _isEdit: mode === 'edit',
        _isStorno: mode === 'storno',
        _initialData: {
          liniiFactura: liniiFacturaPregatite,
          clientInfo: dateComplete.clientInfo || {
            id: '',
            denumire: factura.client_nume,
            cui: factura.client_cui,
            nrRegCom: '',
            adresa: '',
            telefon: '',
            email: ''
          },
          observatii: dateComplete.observatii || '',
          numarFactura: mode === 'edit' ? factura.numar : null, // Păstrează numărul doar la EDIT
          facturaId: mode === 'edit' ? factura.id : null,
          proiectId: proiectIdActual, // ✅ IMPORTANT: Trimite proiect ID corect
          isEdit: mode === 'edit',
          isStorno: mode === 'storno',
          facturaOriginala: mode === 'storno' ? factura.numar : null,
          cursuriUtilizate: dateComplete.cursuriUtilizate || {},
          setariFacturare: dateComplete.setariFacturare || null
        }
      };

      console.log('📋 Date finale pentru modal:', proiect);
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
        // ✅ CORECTAT: Marchează factura originală ca stornată
        const response = await fetch('/api/actions/invoices/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facturaId: factura.id,
            status: 'stornata',
            observatii: `Stornată prin factura ${invoiceId}`
          })
        });

        if (response.ok) {
          showToast('✅ Factură de stornare creată cu succes', 'success');
          onSuccess('reversed', invoiceId);
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Eroare la actualizarea statusului facturii originale');
        }
      }
    } catch (error) {
      console.error('Eroare la procesarea facturii:', error);
      showToast(`Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`, 'error');
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

  // ✅ Folosește FacturaHibridModal cu datele încărcate
  return (
    <FacturaHibridModal
      proiect={proiectData}
      onClose={onClose}
      onSuccess={handleFacturaSuccess}
    />
  );
}
