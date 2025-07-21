// ==================================================================
// CALEA: app/admin/rapoarte/facturi/page.tsx
// DESCRIERE: Pagină dedicată pentru gestionarea facturilor
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import FacturiList from '../proiecte/components/FacturiList';

interface FacturiStats {
  total_facturi: number;
  facturi_pdf: number;
  facturi_anaf: number;
  facturi_eroare: number;
  valoare_totala: number;
  valoare_platita: number;
  rest_de_plata: number;
  facturi_expirate: number;
  facturi_expira_curand: number;
}

export default function FacturiPage() {
  const [stats, setStats] = useState<FacturiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [perioada, setPerioada] = useState(30);

  useEffect(() => {
    loadStats();
  }, [perioada]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/actions/invoices/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perioada: perioada.toString() })
      });
      
      const data = await response.json();
      if (data.success) {
        setStats(data.statistici);
      }
    } catch (error) {
      console.error('Eroare loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              💰 Gestionare Facturi
            </h1>
            <p className="text-gray-600 mt-2">
              Sistemul hibrid de facturare - PDF instant + integrare ANAF
            </p>
          </div>
          
          {/* Selector perioada */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Perioada:</label>
            <select
              value={perioada}
              onChange={(e) => setPerioada(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value={7}>Ultima săptămână</option>
              <option value={30}>Ultima lună</option>
              <option value={90}>Ultimele 3 luni</option>
              <option value={365}>Ultimul an</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistici Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow border">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Facturi */}
          <div className="bg-white p-6 rounded-lg shadow border border-blue-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Facturi</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total_facturi}</p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
          </div>

          {/* Valoare Totală */}
          <div className="bg-white p-6 rounded-lg shadow border border-green-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Valoare Totală</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.valoare_totala)}
                </p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </div>

          {/* Încasări */}
          <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Încasate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(stats.valoare_platita)}
                </p>
                <p className="text-xs text-gray-500">
                  {stats.valoare_totala > 0 ? 
                    `${((stats.valoare_platita / stats.valoare_totala) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </p>
              </div>
              <div className="text-3xl">💳</div>
            </div>
          </div>

          {/* Rest de plată */}
          <div className="bg-white p-6 rounded-lg shadow border border-orange-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Rest de plată</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(stats.rest_de_plata)}
                </p>
              </div>
              <div className="text-3xl">⏳</div>
            </div>
          </div>

          {/* PDF Generate */}
          <div className="bg-white p-6 rounded-lg shadow border border-green-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">PDF Generate</p>
                <p className="text-2xl font-bold text-green-600">{stats.facturi_pdf}</p>
                <p className="text-xs text-gray-500">
                  {stats.total_facturi > 0 ? 
                    `${((stats.facturi_pdf / stats.total_facturi) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </p>
              </div>
              <div className="text-3xl">📄</div>
            </div>
          </div>

          {/* ANAF Succes */}
          <div className="bg-white p-6 rounded-lg shadow border border-blue-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">ANAF Succes</p>
                <p className="text-2xl font-bold text-blue-600">{stats.facturi_anaf}</p>
                <p className="text-xs text-gray-500">
                  {stats.total_facturi > 0 ? 
                    `${((stats.facturi_anaf / stats.total_facturi) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>

          {/* Erori ANAF */}
          <div className="bg-white p-6 rounded-lg shadow border border-red-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Erori ANAF</p>
                <p className="text-2xl font-bold text-red-600">{stats.facturi_eroare}</p>
              </div>
              <div className="text-3xl">❌</div>
            </div>
          </div>

          {/* Facturi Expirate */}
          <div className="bg-white p-6 rounded-lg shadow border border-red-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Expirate</p>
                <p className="text-2xl font-bold text-red-600">{stats.facturi_expirate}</p>
                {stats.facturi_expira_curand > 0 && (
                  <p className="text-xs text-orange-600">
                    +{stats.facturi_expira_curand} expiră curând
                  </p>
                )}
              </div>
              <div className="text-3xl">🔴</div>
            </div>
          </div>
        </div>
      )}

      {/* Alerte */}
      {stats && (stats.facturi_expirate > 0 || stats.facturi_expira_curand > 0 || stats.facturi_eroare > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 text-2xl">⚠️</div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Atenție necesară</h3>
              <div className="mt-2 text-sm text-yellow-700 space-y-1">
                {stats.facturi_expirate > 0 && (
                  <div>• {stats.facturi_expirate} facturi expirate</div>
                )}
                {stats.facturi_expira_curand > 0 && (
                  <div>• {stats.facturi_expira_curand} facturi expiră în curând</div>
                )}
                {stats.facturi_eroare > 0 && (
                  <div>• {stats.facturi_eroare} erori ANAF de rezolvat</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista Facturi */}
      <div className="bg-white rounded-lg shadow">
        <FacturiList 
          showFilters={true} 
          maxHeight="600px"
        />
      </div>
    </div>
  );
}
