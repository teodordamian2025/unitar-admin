// ==================================================================
// CALEA: app/admin/setari/costuri/page.tsx
// DATA: 17.01.2026 (ora României)
// DESCRIERE: Pagină admin pentru setări cost/oră și cost/zi de om
// FUNCȚIONALITĂȚI: Configurare costuri pentru calcul productivitate și randament
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import { toast } from 'react-toastify';

interface CostSettings {
  id: string;
  cost_ora: number;
  cost_zi: number;
  ore_pe_zi: number;
  moneda: string;
  descriere?: string;
  is_default?: boolean;
}

export default function SetariCosturiPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('admin');

  const [settings, setSettings] = useState<CostSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [costOra, setCostOra] = useState<number>(40);
  const [costZi, setCostZi] = useState<number>(320);
  const [orePeZi, setOrePeZi] = useState<number>(8);
  const [moneda, setMoneda] = useState<string>('EUR');
  const [descriere, setDescriere] = useState<string>('');

  // Auto-calculate mode
  const [autoCalculate, setAutoCalculate] = useState<'ora' | 'zi'>('zi');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(localStorage.getItem('displayName') || 'Admin');
    setUserRole(localStorage.getItem('userRole') || 'admin');
    fetchSettings();
  }, [user, loading, router]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/setari/costuri');
      const data = await response.json();

      if (data.success && data.data) {
        setSettings(data.data);
        setCostOra(data.data.cost_ora);
        setCostZi(data.data.cost_zi);
        setOrePeZi(data.data.ore_pe_zi);
        setMoneda(data.data.moneda);
        setDescriere(data.data.descriere || '');
      }
    } catch (error) {
      console.error('Eroare la încărcarea setărilor:', error);
      toast.error('Eroare la încărcarea setărilor de cost');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-calculate cost_zi when cost_ora changes
  const handleCostOraChange = (value: number) => {
    setCostOra(value);
    if (autoCalculate === 'zi') {
      setCostZi(value * orePeZi);
    }
  };

  // Auto-calculate cost_ora when cost_zi changes
  const handleCostZiChange = (value: number) => {
    setCostZi(value);
    if (autoCalculate === 'ora') {
      setCostOra(value / orePeZi);
    }
  };

  // Recalculate when ore_pe_zi changes
  const handleOrePeZiChange = (value: number) => {
    setOrePeZi(value);
    if (autoCalculate === 'zi') {
      setCostZi(costOra * value);
    } else {
      setCostOra(costZi / value);
    }
  };

  const handleSave = async () => {
    if (costOra <= 0 || costZi <= 0) {
      toast.error('Costurile trebuie să fie mai mari ca 0');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/setari/costuri', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_ora: costOra,
          cost_zi: costZi,
          ore_pe_zi: orePeZi,
          moneda,
          descriere
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Setări salvate cu succes!');
        fetchSettings();
      } else {
        throw new Error(data.error || 'Eroare la salvare');
      }
    } catch (error) {
      console.error('Eroare la salvarea setărilor:', error);
      toast.error(`Eroare: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div>Se încarcă...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => router.push('/admin/setari')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ← Înapoi la Setări
          </button>

          <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            💰 Setări Cost de Om
          </h1>
          <p style={{ margin: '0.5rem 0', color: '#6c757d' }}>
            Configurează costurile pentru calculul productivității și randamentului pe proiecte
          </p>
        </div>

        {/* Info Card */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📊 Cum sunt folosite aceste setări</h3>
          <div style={{ display: 'grid', gap: '0.75rem', fontSize: '14px', opacity: 0.95 }}>
            <div>
              <strong>Productivitate (EUR/oră/om)</strong> = (Valoare proiect - Cheltuieli) / Timp lucrat
            </div>
            <div>
              <strong>Zile alocate disponibile</strong> = (Valoare proiect - Cheltuieli) / Cost pe oră
            </div>
            <div>
              <strong>Cost final proiect</strong> = Cheltuieli + (Cost pe oră × Timp lucrat)
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
          {/* Cost pe oră */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: 600,
              color: '#2c3e50',
              marginBottom: '0.5rem',
              fontSize: '14px'
            }}>
              Cost pe oră de om
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="number"
                value={costOra}
                onChange={(e) => handleCostOraChange(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.5}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 500,
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
              <span style={{
                padding: '0.75rem 1rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                fontWeight: 600,
                color: '#495057'
              }}>
                {moneda}/oră
              </span>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#6c757d'
              }}>
                <input
                  type="radio"
                  checked={autoCalculate === 'zi'}
                  onChange={() => setAutoCalculate('zi')}
                />
                Calculează zi automat
              </label>
            </div>
          </div>

          {/* Cost pe zi */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: 600,
              color: '#2c3e50',
              marginBottom: '0.5rem',
              fontSize: '14px'
            }}>
              Cost pe zi de om
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="number"
                value={costZi}
                onChange={(e) => handleCostZiChange(parseFloat(e.target.value) || 0)}
                min={0}
                step={1}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 500,
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
              <span style={{
                padding: '0.75rem 1rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                fontWeight: 600,
                color: '#495057'
              }}>
                {moneda}/zi
              </span>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#6c757d'
              }}>
                <input
                  type="radio"
                  checked={autoCalculate === 'ora'}
                  onChange={() => setAutoCalculate('ora')}
                />
                Calculează oră automat
              </label>
            </div>
          </div>

          {/* Ore pe zi */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: 600,
              color: '#2c3e50',
              marginBottom: '0.5rem',
              fontSize: '14px'
            }}>
              Ore de lucru pe zi
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <select
                value={orePeZi}
                onChange={(e) => handleOrePeZiChange(parseInt(e.target.value))}
                style={{
                  flex: 1,
                  maxWidth: '200px',
                  padding: '0.75rem 1rem',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 500,
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value={6}>6 ore/zi</option>
                <option value={7}>7 ore/zi</option>
                <option value={8}>8 ore/zi (standard)</option>
                <option value={10}>10 ore/zi</option>
                <option value={12}>12 ore/zi</option>
              </select>
              <span style={{ fontSize: '13px', color: '#6c757d' }}>
                Folosit pentru conversie ore ↔ zile în rapoarte
              </span>
            </div>
          </div>

          {/* Monedă */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontWeight: 600,
              color: '#2c3e50',
              marginBottom: '0.5rem',
              fontSize: '14px'
            }}>
              Monedă
            </label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              style={{
                width: '200px',
                padding: '0.75rem 1rem',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 500,
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="EUR">EUR (Euro)</option>
              <option value="RON">RON (Leu)</option>
              <option value="USD">USD (Dolar)</option>
            </select>
          </div>

          {/* Descriere */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontWeight: 600,
              color: '#2c3e50',
              marginBottom: '0.5rem',
              fontSize: '14px'
            }}>
              Notă / Descriere (opțional)
            </label>
            <textarea
              value={descriere}
              onChange={(e) => setDescriere(e.target.value)}
              placeholder="Ex: Tarif actualizat pentru 2026..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '14px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Preview Calcule */}
          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#495057', fontSize: '14px' }}>
              📋 Preview calcule cu setările curente:
            </h4>
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '13px', color: '#6c757d' }}>
              <div>
                • Proiect 1000 {moneda}, cheltuieli 100 {moneda}, timp 30h →
                <strong style={{ color: '#28a745', marginLeft: '0.5rem' }}>
                  Productivitate: {((1000 - 100) / 30).toFixed(2)} {moneda}/oră/om
                </strong>
              </div>
              <div>
                • Cu cost {costOra} {moneda}/oră →
                <strong style={{ color: '#007bff', marginLeft: '0.5rem' }}>
                  Zile alocate: {((1000 - 100) / costOra).toFixed(1)} ore ({((1000 - 100) / costOra / orePeZi).toFixed(2)} zile)
                </strong>
              </div>
              <div>
                • Cost final proiect = 100 + ({costOra} × 30) =
                <strong style={{ color: '#dc3545', marginLeft: '0.5rem' }}>
                  {(100 + costOra * 30).toFixed(2)} {moneda}
                </strong>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              onClick={() => fetchSettings()}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f8f9fa',
                color: '#495057',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              🔄 Resetează
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '0.75rem 2rem',
                background: isSaving ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isSaving ? (
                <>
                  <span style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }} />
                  Se salvează...
                </>
              ) : (
                '💾 Salvează Setări'
              )}
            </button>
          </div>
        </div>

        {/* CSS for spinner animation */}
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </ModernLayout>
  );
}
