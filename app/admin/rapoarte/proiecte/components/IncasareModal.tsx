// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/IncasareModal.tsx
// DATA: 09.12.2025
// DESCRIERE: Modal pentru marcare încasări facturi cu două opțiuni:
// - Match cu tranzacții bancare existente (încasări din conturi)
// - Încasare manuală (doar data + observații)
// FEATURES:
// - Tab-uri pentru selectare metodă
// - Căutare și match tranzacții bancare cu scor
// - Încasare manuală simplă
// - Actualizare automată status factură
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CreditCard,
  Wallet,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  Building2,
  Calendar,
  FileText,
  BadgeCheck,
  Banknote
} from 'lucide-react';

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
}

interface TranzactieBancara {
  id: string;
  data_procesare: string;
  suma: number;
  directie: string;
  tip_categorie: string;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  status: string;
  matching_score: number;
  diferenta: number;
  diferenta_procent: number;
  referinta_bancii?: string;
}

interface IncasareModalProps {
  factura: Factura;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

type TabType = 'tranzactie' | 'manual';

export default function IncasareModal({
  factura,
  isOpen,
  onClose,
  onSuccess
}: IncasareModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tranzactie');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State pentru tab tranzacție
  const [tranzactii, setTranzactii] = useState<TranzactieBancara[]>([]);
  const [selectedTranzactie, setSelectedTranzactie] = useState<TranzactieBancara | null>(null);
  const [toleranta, setToleranta] = useState(10);

  // State pentru tab manual
  const [valoareManuala, setValoareManuala] = useState('');
  const [dataIncasare, setDataIncasare] = useState(new Date().toISOString().split('T')[0]);
  const [observatii, setObservatii] = useState('');

  // Calcule
  const total = parseFloat(String(factura.total)) || 0;
  const platit = parseFloat(String(factura.valoare_platita)) || 0;
  const restDePlata = factura.rest_de_plata !== undefined
    ? parseFloat(String(factura.rest_de_plata))
    : (total - platit);

  // Reset la deschidere
  useEffect(() => {
    if (isOpen) {
      setActiveTab('tranzactie');
      setSelectedTranzactie(null);
      setTranzactii([]);
      setValoareManuala(restDePlata > 0 ? restDePlata.toFixed(2) : '');
      setDataIncasare(new Date().toISOString().split('T')[0]);
      setObservatii('');
      setError(null);
      // Căutăm tranzacții automat
      searchTranzactii();
    }
  }, [isOpen, factura]);

  // Căutare tranzacții bancare
  const searchTranzactii = async () => {
    setSearchLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        factura_id: factura.id,
        toleranta: toleranta.toString()
      });

      const response = await fetch(`/api/actions/invoices/incasare?${params}`);
      const data = await response.json();

      if (data.success) {
        setTranzactii(data.tranzactii || []);
      } else {
        setError(data.error || 'Eroare la căutarea tranzacțiilor');
      }
    } catch (err) {
      console.error('Eroare căutare tranzacții:', err);
      setError('Eroare la căutarea tranzacțiilor bancare');
    } finally {
      setSearchLoading(false);
    }
  };

  // Submit încasare
  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      const userId = localStorage.getItem('userId') || '';
      const userName = localStorage.getItem('displayName') || '';

      let payload: any = {
        factura_id: factura.id,
        user_id: userId,
        user_name: userName
      };

      if (activeTab === 'tranzactie') {
        if (!selectedTranzactie) {
          setError('Selectați o tranzacție bancară');
          setLoading(false);
          return;
        }
        payload.tip_incasare = 'tranzactie';
        payload.tranzactie_id = selectedTranzactie.id;
        payload.observatii = observatii;
      } else {
        const valoare = parseFloat(valoareManuala);
        if (!valoare || valoare <= 0) {
          setError('Introduceți o valoare validă');
          setLoading(false);
          return;
        }
        if (valoare > restDePlata * 1.05) {
          setError('Valoarea depășește restul de plată');
          setLoading(false);
          return;
        }
        payload.tip_incasare = 'manual';
        payload.valoare_incasata = valoare;
        payload.data_incasare = dataIncasare;
        payload.observatii = observatii;
      }

      const response = await fetch('/api/actions/invoices/incasare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la înregistrarea încasării');
      }

      onSuccess(result);
      onClose();

    } catch (err) {
      console.error('Eroare încasare:', err);
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
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

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ro-RO');
    } catch {
      return dateStr;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { bg: '#dcfce7', text: '#166534', label: 'Excelent' };
    if (score >= 60) return { bg: '#dbeafe', text: '#1e40af', label: 'Bun' };
    if (score >= 40) return { bg: '#fef3c7', text: '#92400e', label: 'Posibil' };
    return { bg: '#fee2e2', text: '#991b1b', label: 'Slab' };
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
          maxWidth: '700px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Banknote size={24} color="white" />
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '600' }}>
                Marcare Încasare
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

        {/* Info Box */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div
            style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>Client</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>
                {factura.client_nume}
              </div>
              {factura.client_cui && (
                <div style={{ fontSize: '12px', color: '#6c757d' }}>CUI: {factura.client_cui}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>Total factură</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>
                {formatCurrency(total)}
              </div>
              {platit > 0 && (
                <div style={{ fontSize: '12px', color: '#27ae60' }}>
                  Plătit: {formatCurrency(platit)}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>Rest de plată</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#e74c3c' }}>
                {formatCurrency(restDePlata)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('tranzactie')}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: activeTab === 'tranzactie' ? '#f8f9fa' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'tranzactie' ? '3px solid #3498db' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: activeTab === 'tranzactie' ? '600' : '500',
              color: activeTab === 'tranzactie' ? '#3498db' : '#6c757d',
              transition: 'all 0.2s ease'
            }}
          >
            <CreditCard size={18} />
            Match Tranzacție Bancară
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: activeTab === 'manual' ? '#f8f9fa' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'manual' ? '3px solid #27ae60' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: activeTab === 'manual' ? '600' : '500',
              color: activeTab === 'manual' ? '#27ae60' : '#6c757d',
              transition: 'all 0.2s ease'
            }}
          >
            <Wallet size={18} />
            Încasare Manuală
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {activeTab === 'tranzactie' ? (
            // Tab: Match Tranzacție
            <div>
              {/* Search Controls */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: '#6c757d' }}>Toleranță:</label>
                  <select
                    value={toleranta}
                    onChange={(e) => setToleranta(parseInt(e.target.value))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #ced4da',
                      fontSize: '13px'
                    }}
                  >
                    <option value={5}>±5%</option>
                    <option value={10}>±10%</option>
                    <option value={15}>±15%</option>
                    <option value={20}>±20%</option>
                  </select>
                </div>
                <button
                  onClick={searchTranzactii}
                  disabled={searchLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #3498db',
                    background: '#ffffff',
                    color: '#3498db',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: searchLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw size={14} className={searchLoading ? 'animate-spin' : ''} />
                  Reîncarcă
                </button>
              </div>

              {/* Lista tranzacții */}
              {searchLoading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  color: '#6c757d'
                }}>
                  <RefreshCw size={24} className="animate-spin" />
                  <span style={{ marginLeft: '12px' }}>Se caută tranzacții...</span>
                </div>
              ) : tranzactii.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#6c757d',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '12px'
                }}>
                  <Search size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <div style={{ fontSize: '14px' }}>
                    Nu s-au găsit tranzacții bancare potrivite
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    Încercați să măriți toleranța sau folosiți încasarea manuală
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tranzactii.map((tranzactie) => {
                    const isSelected = selectedTranzactie?.id === tranzactie.id;
                    const scoreBadge = getScoreBadge(tranzactie.matching_score);

                    return (
                      <div
                        key={tranzactie.id}
                        onClick={() => setSelectedTranzactie(tranzactie)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #3498db' : '1px solid #e5e7eb',
                          backgroundColor: isSelected ? '#ebf5ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#27ae60'
                              }}>
                                +{formatCurrency(tranzactie.suma)}
                              </span>
                              <span style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                backgroundColor: scoreBadge.bg,
                                color: scoreBadge.text,
                                fontWeight: '600'
                              }}>
                                {scoreBadge.label} ({tranzactie.matching_score}%)
                              </span>
                              {isSelected && (
                                <BadgeCheck size={18} color="#3498db" />
                              )}
                            </div>

                            <div style={{ fontSize: '13px', color: '#2c3e50', fontWeight: '500' }}>
                              {tranzactie.nume_contrapartida || 'N/A'}
                            </div>

                            {tranzactie.cui_contrapartida && (
                              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                                CUI: {tranzactie.cui_contrapartida}
                              </div>
                            )}

                            {tranzactie.detalii_tranzactie && (
                              <div style={{
                                fontSize: '11px',
                                color: '#95a5a6',
                                marginTop: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '400px'
                              }}>
                                {tranzactie.detalii_tranzactie}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', color: '#6c757d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={12} />
                              {formatDate(tranzactie.data_procesare)}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              marginTop: '4px',
                              color: tranzactie.diferenta_procent <= 2 ? '#27ae60' : '#f39c12'
                            }}>
                              Diferență: {tranzactie.diferenta_procent.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // Tab: Încasare Manuală
            <div>
              <div style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                border: '1px solid #bbf7d0'
              }}>
                <Wallet size={18} color="#27ae60" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px', color: '#166534' }}>
                  <strong>Încasare manuală</strong>
                  <br />
                  <span style={{ fontSize: '12px' }}>
                    Folosiți această opțiune pentru încasări în numerar sau când nu aveți tranzacție bancară.
                  </span>
                </div>
              </div>

              {/* Valoare */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  marginBottom: '8px'
                }}>
                  Valoare încasată (RON) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={restDePlata * 1.05}
                    value={valoareManuala}
                    onChange={(e) => setValoareManuala(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px 60px 14px 16px',
                      fontSize: '18px',
                      fontWeight: '600',
                      border: '2px solid #27ae60',
                      borderRadius: '10px',
                      outline: 'none',
                      textAlign: 'right',
                      boxSizing: 'border-box'
                    }}
                    placeholder="0.00"
                  />
                  <span style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6c757d',
                    fontSize: '14px'
                  }}>
                    LEI
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setValoareManuala(restDePlata.toFixed(2))}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #ced4da',
                      background: '#f8f9fa',
                      cursor: 'pointer',
                      color: '#495057'
                    }}
                  >
                    Tot restul ({formatCurrency(restDePlata)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setValoareManuala((restDePlata / 2).toFixed(2))}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #ced4da',
                      background: '#f8f9fa',
                      cursor: 'pointer',
                      color: '#495057'
                    }}
                  >
                    50% ({formatCurrency(restDePlata / 2)})
                  </button>
                </div>
              </div>

              {/* Data încasare */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  marginBottom: '8px'
                }}>
                  Data încasării *
                </label>
                <input
                  type="date"
                  value={dataIncasare}
                  onChange={(e) => setDataIncasare(e.target.value)}
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

              {/* Observații */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  marginBottom: '8px'
                }}>
                  Observații (opțional)
                </label>
                <textarea
                  value={observatii}
                  onChange={(e) => setObservatii(e.target.value)}
                  rows={2}
                  placeholder="Ex: Încasare numerar, chitanță nr. ..."
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f8f9fa'
        }}>
          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: '#fdf2f2',
              border: '1px solid #f8d7da',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#721c24',
              fontSize: '14px'
            }}>
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {/* Summary */}
          {activeTab === 'tranzactie' && selectedTranzactie && (
            <div style={{
              backgroundColor: '#ebf5ff',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '13px', color: '#1e40af' }}>
                <strong>Tranzacție selectată:</strong> {formatCurrency(selectedTranzactie.suma)}
                {' '}din {formatDate(selectedTranzactie.data_procesare)}
              </div>
              <ArrowRight size={16} color="#3498db" />
            </div>
          )}

          {activeTab === 'manual' && parseFloat(valoareManuala) > 0 && (
            <div style={{
              backgroundColor: '#f0fdf4',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '13px', color: '#166534' }}>
                <strong>Încasare manuală:</strong> {formatCurrency(parseFloat(valoareManuala))}
                {' '}din {formatDate(dataIncasare)}
              </div>
              <ArrowRight size={16} color="#27ae60" />
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
              Anulează
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (activeTab === 'tranzactie' && !selectedTranzactie) ||
                       (activeTab === 'manual' && (!valoareManuala || parseFloat(valoareManuala) <= 0))}
              style={{
                flex: 2,
                padding: '14px',
                fontSize: '15px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '10px',
                background: (loading || (activeTab === 'tranzactie' && !selectedTranzactie) ||
                           (activeTab === 'manual' && (!valoareManuala || parseFloat(valoareManuala) <= 0)))
                  ? '#95a5a6'
                  : activeTab === 'tranzactie'
                    ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
                    : 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: '#ffffff',
                cursor: (loading || (activeTab === 'tranzactie' && !selectedTranzactie) ||
                        (activeTab === 'manual' && (!valoareManuala || parseFloat(valoareManuala) <= 0)))
                  ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Se procesează...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  {activeTab === 'tranzactie' ? 'Confirmă Match' : 'Înregistrează Încasare'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
