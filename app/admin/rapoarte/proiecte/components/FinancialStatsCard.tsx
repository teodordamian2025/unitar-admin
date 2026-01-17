// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/FinancialStatsCard.tsx
// DATA: 17.01.2026 (ora României)
// DESCRIERE: Component pentru afișare statistici financiare și timp lucrat proiect
// FUNCȚIONALITĂȚI: Timp lucrat, indicatori financiari, progres, cheltuieli
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

interface PersonStats {
  utilizator_uid: string;
  utilizator_nume: string;
  ore_lucrate: number;
  zile_lucrate: number;
  numar_inregistrari: number;
  prima_zi?: string;
  ultima_zi?: string;
}

interface Cheltuiala {
  id: string;
  tip: string;
  furnizor: string;
  descriere: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  status_achitare: string;
  status_predare: string;
}

interface ProiectStats {
  proiect: {
    id: string;
    denumire: string;
    valoare: number;
    moneda: string;
    valoare_ron: number;
    curs_valutar: number;
    status: string;
    data_start?: string;
    data_final?: string;
  };
  timp_lucrat: {
    total_ore: number;
    total_zile: number;
    persoane: PersonStats[];
    numar_persoane: number;
  };
  cheltuieli: {
    total: number;
    total_ron: number;
    moneda: string;
    lista: Cheltuiala[];
    numar_cheltuieli: number;
  };
  indicatori: {
    productivitate_per_ora: number;
    productivitate_label: string;
    ore_alocate_disponibile: number;
    zile_alocate_disponibile: number;
    ore_ramase: number;
    zile_ramase: number;
    progres_timp_procent: number;
    depasire_timp: boolean;
    cost_timp_lucrat: number;
    cost_final_proiect: number;
    profit_pierdere: number;
    este_profitabil: boolean;
    cost_ora_setat: number;
    cost_zi_setat: number;
    ore_pe_zi: number;
    moneda_cost: string;
  };
  sumar: {
    valoare_proiect: number;
    cheltuieli_directe: number;
    cost_timp_lucrat: number;
    total_costuri: number;
    diferenta: number;
    diferenta_tip: 'profit' | 'pierdere';
    moneda: string;
  };
}

interface FinancialStatsCardProps {
  proiectId: string;
  onRefresh?: () => void;
}

export default function FinancialStatsCard({ proiectId, onRefresh }: FinancialStatsCardProps) {
  const [stats, setStats] = useState<ProiectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingCheltuiala, setUpdatingCheltuiala] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [proiectId]);

  const fetchStats = async () => {
    if (!proiectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rapoarte/proiecte/statistici?proiectId=${encodeURIComponent(proiectId)}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error || 'Eroare la încărcarea statisticilor');
      }
    } catch (err) {
      console.error('Eroare la încărcarea statisticilor:', err);
      setError('Eroare de conexiune');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCheltuialaStatus = async (cheltuialaId: string, field: string, value: string) => {
    setUpdatingCheltuiala(cheltuialaId);

    try {
      const response = await fetch('/api/rapoarte/cheltuieli', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cheltuialaId,
          [field]: value
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Status actualizat!', { autoClose: 2000 });
        fetchStats(); // Refresh
      } else {
        throw new Error(data.error || 'Eroare la actualizare');
      }
    } catch (err) {
      console.error('Eroare la actualizarea cheltuielii:', err);
      toast.error(`Eroare: ${err instanceof Error ? err.message : 'Eroare necunoscută'}`);
    } finally {
      setUpdatingCheltuiala(null);
    }
  };

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('ro-RO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatCurrency = (amount: number, currency: string = 'EUR'): string => {
    return `${formatNumber(amount)} ${currency}`;
  };

  if (isLoading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        gridColumn: 'span 2'
      }}>
        <div style={{ textAlign: 'center', color: '#6c757d', padding: '2rem' }}>
          Se încarcă statisticile...
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        gridColumn: 'span 2'
      }}>
        <div style={{ textAlign: 'center', color: '#dc3545', padding: '2rem' }}>
          {error || 'Nu s-au putut încărca statisticile'}
        </div>
      </div>
    );
  }

  const { timp_lucrat, indicatori, cheltuieli, sumar } = stats;

  return (
    <>
      {/* Card 1: Timp Lucrat */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 1.25rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⏱️ Timp Lucrat
        </h3>

        {/* Sumar timp */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            borderRadius: '8px',
            padding: '1rem',
            color: 'white'
          }}>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>Total Ore</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatNumber(timp_lucrat.total_ore, 1)}h</div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '8px',
            padding: '1rem',
            color: 'white'
          }}>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>Total Zile</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatNumber(timp_lucrat.total_zile, 1)} zile</div>
          </div>
        </div>

        {/* Lista persoane */}
        {timp_lucrat.persoane.length === 0 ? (
          <div style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '14px' }}>
            Nu există înregistrări de timp pentru acest proiect
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#495057', marginBottom: '0.25rem' }}>
              Persoane ({timp_lucrat.numar_persoane})
            </div>
            {timp_lucrat.persoane.map((persoana) => (
              <div key={persoana.utilizator_uid} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                <div>
                  <div style={{ fontWeight: 500, color: '#2c3e50' }}>{persoana.utilizator_nume}</div>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>
                    {persoana.numar_inregistrari} înregistrări
                    {persoana.ultima_zi && ` • Ultima: ${new Date(persoana.ultima_zi).toLocaleDateString('ro-RO')}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>{formatNumber(persoana.ore_lucrate, 1)}h</div>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>{formatNumber(persoana.zile_lucrate, 1)} zile</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card 2: Indicatori Financiari */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 1.25rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📊 Indicatori Financiari
        </h3>

        {/* Productivitate */}
        <div style={{
          background: indicatori.productivitate_per_ora >= indicatori.cost_ora_setat
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          color: 'white'
        }}>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Productivitate per oră/om</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{indicatori.productivitate_label}</div>
          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '0.25rem' }}>
            {indicatori.productivitate_per_ora >= indicatori.cost_ora_setat ? '✓ Peste costul setat' : '⚠ Sub costul setat'}
            ({indicatori.cost_ora_setat} {indicatori.moneda_cost}/oră)
          </div>
        </div>

        {/* Timp Rămas - Bară progres */}
        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#495057' }}>
              Timp Consumat / Alocat
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: indicatori.depasire_timp ? '#dc3545' : '#3b82f6'
            }}>
              {formatNumber(timp_lucrat.total_ore, 1)}h / {formatNumber(indicatori.ore_alocate_disponibile, 1)}h
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '12px',
            background: '#e9ecef',
            borderRadius: '6px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(indicatori.progres_timp_procent, 100)}%`,
              background: indicatori.depasire_timp
                ? 'linear-gradient(90deg, #dc3545, #c82333)'
                : indicatori.progres_timp_procent > 80
                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                : 'linear-gradient(90deg, #3b82f6, #10b981)',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
            {indicatori.depasire_timp && (
              <div style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '10px',
                fontWeight: 600,
                color: 'white'
              }}>
                DEPĂȘIRE!
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '12px' }}>
            <span style={{ color: indicatori.depasire_timp ? '#dc3545' : '#6c757d' }}>
              {indicatori.depasire_timp
                ? `⚠️ Depășire cu ${formatNumber(Math.abs(indicatori.ore_ramase), 1)}h (${formatNumber(Math.abs(indicatori.zile_ramase), 2)} zile)`
                : `✓ Disponibil: ${formatNumber(indicatori.ore_ramase, 1)}h (${formatNumber(indicatori.zile_ramase, 2)} zile)`
              }
            </span>
            <span style={{ color: '#6c757d' }}>
              {formatNumber(indicatori.progres_timp_procent, 0)}% consumat
            </span>
          </div>
        </div>

        {/* Cost Final și Profit/Pierdere */}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.75rem',
            background: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '13px'
          }}>
            <span style={{ color: '#495057' }}>Cost timp lucrat</span>
            <span style={{ fontWeight: 600, color: '#6c757d' }}>
              {formatCurrency(indicatori.cost_timp_lucrat, sumar.moneda)}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.75rem',
            background: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '13px'
          }}>
            <span style={{ color: '#495057' }}>Cost final proiect</span>
            <span style={{ fontWeight: 600, color: '#495057' }}>
              {formatCurrency(indicatori.cost_final_proiect, sumar.moneda)}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.75rem',
            background: indicatori.este_profitabil ? 'rgba(16, 185, 129, 0.1)' : 'rgba(220, 53, 69, 0.1)',
            borderRadius: '6px',
            border: `1px solid ${indicatori.este_profitabil ? '#10b981' : '#dc3545'}`,
            fontSize: '13px'
          }}>
            <span style={{ color: indicatori.este_profitabil ? '#059669' : '#dc3545', fontWeight: 500 }}>
              {indicatori.este_profitabil ? '📈 Profit estimat' : '📉 Pierdere estimată'}
            </span>
            <span style={{
              fontWeight: 700,
              color: indicatori.este_profitabil ? '#059669' : '#dc3545'
            }}>
              {indicatori.este_profitabil ? '+' : ''}{formatCurrency(indicatori.profit_pierdere, sumar.moneda)}
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Sumar Financiar */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        gridColumn: 'span 2'
      }}>
        <h3 style={{ margin: '0 0 1.25rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💰 Sumar Financiar
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
            borderRadius: '8px',
            padding: '1rem',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '0.25rem' }}>Valoare Proiect</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>
              {formatCurrency(sumar.valoare_proiect, sumar.moneda)}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
            borderRadius: '8px',
            padding: '1rem',
            borderLeft: '4px solid #ef4444'
          }}>
            <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '0.25rem' }}>Cheltuieli Directe</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
              -{formatCurrency(sumar.cheltuieli_directe, sumar.moneda)}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))',
            borderRadius: '8px',
            padding: '1rem',
            borderLeft: '4px solid #f59e0b'
          }}>
            <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '0.25rem' }}>Cost Timp Lucrat</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
              -{formatCurrency(sumar.cost_timp_lucrat, sumar.moneda)}
            </div>
          </div>

          <div style={{
            background: indicatori.este_profitabil
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))'
              : 'linear-gradient(135deg, rgba(220, 53, 69, 0.15), rgba(220, 53, 69, 0.05))',
            borderRadius: '8px',
            padding: '1rem',
            borderLeft: `4px solid ${indicatori.este_profitabil ? '#10b981' : '#dc3545'}`
          }}>
            <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '0.25rem' }}>
              {indicatori.este_profitabil ? 'Profit Estimat' : 'Pierdere Estimată'}
            </div>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: indicatori.este_profitabil ? '#10b981' : '#dc3545'
            }}>
              {indicatori.este_profitabil ? '+' : ''}{formatCurrency(sumar.diferenta, sumar.moneda)}
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#f8f9fa',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#6c757d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            Setări cost: {indicatori.cost_ora_setat} {indicatori.moneda_cost}/oră
            ({indicatori.cost_zi_setat} {indicatori.moneda_cost}/zi de {indicatori.ore_pe_zi}h)
          </span>
          <a
            href="/admin/setari/costuri"
            style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}
          >
            Modifică setările →
          </a>
        </div>
      </div>

      {/* Card 4: Cheltuieli */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        gridColumn: 'span 2'
      }}>
        <h3 style={{ margin: '0 0 1.25rem 0', color: '#2c3e50', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🧾 Cheltuieli Proiect ({cheltuieli.numar_cheltuieli})
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
            Total: {formatCurrency(cheltuieli.total, cheltuieli.moneda)}
          </span>
        </h3>

        {cheltuieli.lista.length === 0 ? (
          <div style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '14px', textAlign: 'center', padding: '2rem' }}>
            Nu există cheltuieli înregistrate pentru acest proiect
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e9ecef' }}>Tip</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e9ecef' }}>Furnizor</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e9ecef' }}>Descriere</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '2px solid #e9ecef' }}>Valoare</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #e9ecef' }}>Status Achitare</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #e9ecef' }}>Status Predare</th>
                </tr>
              </thead>
              <tbody>
                {cheltuieli.lista.map((ch) => (
                  <tr key={ch.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        background: '#e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {ch.tip}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{ch.furnizor || '-'}</td>
                    <td style={{ padding: '0.75rem', color: '#6c757d', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.descriere || '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(ch.valoare, ch.moneda)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <select
                        value={ch.status_achitare || 'Neachitat'}
                        onChange={(e) => handleUpdateCheltuialaStatus(ch.id, 'status_achitare', e.target.value)}
                        disabled={updatingCheltuiala === ch.id}
                        style={{
                          padding: '0.375rem 0.5rem',
                          border: '1px solid #e9ecef',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: ch.status_achitare === 'Achitat' ? '#d4edda' :
                                     ch.status_achitare === 'Nu e cazul' ? '#f8f9fa' : '#fff3cd',
                          color: ch.status_achitare === 'Achitat' ? '#155724' :
                                 ch.status_achitare === 'Nu e cazul' ? '#6c757d' : '#856404',
                          cursor: updatingCheltuiala === ch.id ? 'wait' : 'pointer'
                        }}
                      >
                        <option value="Neachitat">Neachitat</option>
                        <option value="Achitat">Achitat</option>
                        <option value="Nu e cazul">Nu e cazul</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <select
                        value={ch.status_predare || 'Nepredat'}
                        onChange={(e) => handleUpdateCheltuialaStatus(ch.id, 'status_predare', e.target.value)}
                        disabled={updatingCheltuiala === ch.id}
                        style={{
                          padding: '0.375rem 0.5rem',
                          border: '1px solid #e9ecef',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: ch.status_predare === 'Predat' ? '#d4edda' : '#fff3cd',
                          color: ch.status_predare === 'Predat' ? '#155724' : '#856404',
                          cursor: updatingCheltuiala === ch.id ? 'wait' : 'pointer'
                        }}
                      >
                        <option value="Nepredat">Nepredat</option>
                        <option value="Predat">Predat</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
