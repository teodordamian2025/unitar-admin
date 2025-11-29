// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/ChitantaModal.tsx
// DATA: 29.11.2025
// DESCRIERE: Modal minimalist pentru inregistrarea incasarii cu chitanta
// FEATURES:
// - Precompletare automata date client si factura
// - Validare plafon legal ANAF (5000 lei PJ / 10000 lei PF)
// - Actualizare automata status factura
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface Factura {
  id: string;
  serie: string;
  numar: string;
  client_nume: string;
  client_cui: string;
  proiect_denumire?: string;
  total: number;
  valoare_platita: number;
  rest_de_plata?: number;
  date_complete_json?: string;
}

interface ChitantaModalProps {
  factura: Factura;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (chitantaData: any) => void;
}

// Plafonuri legale
const PLAFON_PJ = 5000;
const PLAFON_PF = 10000;

export default function ChitantaModal({
  factura,
  isOpen,
  onClose,
  onSuccess
}: ChitantaModalProps) {
  const [valoareIncasata, setValoareIncasata] = useState<string>('');
  const [reprezentantLegal, setReprezentantLegal] = useState('');
  const [dataChitanta, setDataChitanta] = useState(new Date().toISOString().split('T')[0]);
  const [descriere, setDescriere] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculeaza rest de plata si tip client
  const total = parseFloat(String(factura.total)) || 0;
  const platit = parseFloat(String(factura.valoare_platita)) || 0;
  const restDePlata = factura.rest_de_plata !== undefined
    ? parseFloat(String(factura.rest_de_plata))
    : (total - platit);

  // Determina tip client din CUI
  const tipClient = !factura.client_cui || factura.client_cui.length === 13 ? 'pf' : 'pj';
  const plafonAplicabil = tipClient === 'pf' ? PLAFON_PF : PLAFON_PJ;

  // Valoarea maxima permisa (minimul intre rest de plata si plafon)
  const valoareMaxima = Math.min(restDePlata, plafonAplicabil);

  // Reset la deschidere
  useEffect(() => {
    if (isOpen) {
      // Sugereaza restul de plata daca e sub plafon, altfel plafonul
      const sugestie = Math.min(restDePlata, plafonAplicabil);
      setValoareIncasata(sugestie > 0 ? sugestie.toFixed(2) : '');
      setReprezentantLegal('');
      setDataChitanta(new Date().toISOString().split('T')[0]);
      setDescriere(`Incasare factura ${factura.serie ? factura.serie + '-' : ''}${factura.numar}`);
      setError(null);
    }
  }, [isOpen, factura, restDePlata, plafonAplicabil]);

  // Validare valoare in timp real
  const valoareNumerica = parseFloat(valoareIncasata) || 0;
  const depasestePlafon = valoareNumerica > plafonAplicabil;
  const depasesteRest = valoareNumerica > restDePlata;
  const valoareInvalida = valoareNumerica <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (valoareInvalida) {
      setError('Valoarea trebuie sa fie pozitiva');
      return;
    }

    if (depasestePlafon) {
      setError(`Valoarea depaseste plafonul legal de ${plafonAplicabil.toLocaleString('ro-RO')} lei`);
      return;
    }

    if (depasesteRest) {
      setError(`Valoarea depaseste restul de plata de ${restDePlata.toLocaleString('ro-RO')} lei`);
      return;
    }

    setLoading(true);

    try {
      // Preia user info din localStorage
      const userId = localStorage.getItem('userId') || '';
      const userName = localStorage.getItem('displayName') || '';

      const response = await fetch('/api/actions/chitante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: factura.id,
          valoare_incasata: valoareNumerica,
          data_chitanta: dataChitanta,
          reprezentant_legal: reprezentantLegal,
          descriere: descriere,
          creat_de: userId,
          creat_de_nume: userName
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la emiterea chitantei');
      }

      onSuccess(result);
      onClose();

    } catch (err) {
      console.error('Eroare chitanta:', err);
      setError(err instanceof Error ? err.message : 'Eroare necunoscuta');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
            padding: '20px 24px',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Receipt size={24} color="white" />
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '600' }}>
                Emitere Chitanta
              </h2>
              <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>
                Factura {factura.serie ? `${factura.serie}-` : ''}{factura.numar}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} color="white" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Info Box - Date Factura */}
          <div
            style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              border: '1px solid #e9ecef'
            }}
          >
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6c757d' }}>Client:</span>
                <span style={{ fontWeight: '600', color: '#2c3e50' }}>{factura.client_nume}</span>
              </div>
              {factura.client_cui && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#6c757d' }}>CUI:</span>
                  <span style={{ fontWeight: '500', color: '#2c3e50' }}>{factura.client_cui}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6c757d' }}>Total factura:</span>
                <span style={{ fontWeight: '600', color: '#2c3e50' }}>{formatCurrency(total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6c757d' }}>Platit anterior:</span>
                <span style={{ fontWeight: '500', color: '#27ae60' }}>{formatCurrency(platit)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '15px',
                  paddingTop: '8px',
                  borderTop: '1px dashed #dee2e6',
                  marginTop: '4px'
                }}
              >
                <span style={{ color: '#e74c3c', fontWeight: '600' }}>Rest de plata:</span>
                <span style={{ fontWeight: '700', color: '#e74c3c' }}>{formatCurrency(restDePlata)}</span>
              </div>
            </div>
          </div>

          {/* Plafon Info */}
          <div
            style={{
              backgroundColor: '#fff8e6',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              border: '1px solid #ffeaa7'
            }}
          >
            <Info size={18} color="#f39c12" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#856404' }}>
              <strong>Plafon legal:</strong> {formatCurrency(plafonAplicabil)} ({tipClient === 'pf' ? 'persoana fizica' : 'persoana juridica'})
              <br />
              <span style={{ fontSize: '12px' }}>
                Conform OUG 193/2002, plata maxima in numerar este limitata.
              </span>
            </div>
          </div>

          {/* Valoare Incasata - Input Principal */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '8px'
              }}
            >
              Valoare incasata (RON) *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={valoareMaxima}
                value={valoareIncasata}
                onChange={(e) => setValoareIncasata(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '18px',
                  fontWeight: '600',
                  border: `2px solid ${depasestePlafon || depasesteRest ? '#e74c3c' : '#27ae60'}`,
                  borderRadius: '10px',
                  outline: 'none',
                  textAlign: 'right',
                  boxSizing: 'border-box'
                }}
                placeholder="0.00"
                required
              />
              <span
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6c757d',
                  fontSize: '14px',
                  pointerEvents: 'none'
                }}
              >
                LEI
              </span>
            </div>
            {/* Validare vizuala */}
            {(depasestePlafon || depasesteRest) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '8px',
                  color: '#e74c3c',
                  fontSize: '13px'
                }}
              >
                <AlertTriangle size={14} />
                {depasestePlafon
                  ? `Depaseste plafonul legal de ${formatCurrency(plafonAplicabil)}`
                  : `Depaseste restul de plata de ${formatCurrency(restDePlata)}`}
              </div>
            )}
            {valoareNumerica > 0 && valoareNumerica <= valoareMaxima && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '8px',
                  color: '#27ae60',
                  fontSize: '13px'
                }}
              >
                <CheckCircle size={14} />
                Valoare valida
              </div>
            )}
          </div>

          {/* Data Chitanta */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '8px'
              }}
            >
              Data chitanta
            </label>
            <input
              type="date"
              value={dataChitanta}
              onChange={(e) => setDataChitanta(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #ced4da',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Reprezentant Legal (optional) */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '8px'
              }}
            >
              Reprezentant legal (optional)
            </label>
            <input
              type="text"
              value={reprezentantLegal}
              onChange={(e) => setReprezentantLegal(e.target.value)}
              placeholder="Nume persoana care incaseaza"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #ced4da',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Descriere (optional) */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50',
                marginBottom: '8px'
              }}
            >
              Descriere (optional)
            </label>
            <textarea
              value={descriere}
              onChange={(e) => setDescriere(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '1px solid #ced4da',
                borderRadius: '10px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                backgroundColor: '#fdf2f2',
                border: '1px solid #f8d7da',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#721c24',
                fontSize: '14px'
              }}
            >
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '15px',
                fontWeight: '600',
                border: '1px solid #ced4da',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                color: '#495057',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              Anuleaza
            </button>
            <button
              type="submit"
              disabled={loading || valoareInvalida || depasestePlafon || depasesteRest}
              style={{
                flex: 2,
                padding: '14px',
                fontSize: '15px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '10px',
                background: (loading || valoareInvalida || depasestePlafon || depasesteRest)
                  ? '#95a5a6'
                  : 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: '#ffffff',
                cursor: (loading || valoareInvalida || depasestePlafon || depasesteRest)
                  ? 'not-allowed'
                  : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <span className="animate-spin">&#9696;</span>
                  Se emite...
                </>
              ) : (
                <>
                  <Receipt size={18} />
                  Emite Chitanta
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render cu portal pentru a fi deasupra tuturor elementelor
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
