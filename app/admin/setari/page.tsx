// ==================================================================
// CALEA: app/admin/setari/page.tsx
// DATA: 31.08.2025 12:30 (ora României)
// MODIFICAT: Adăugat buton pentru setări contracte
// PĂSTRATE: Toate funcționalitățile existente
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SystemStats {
  tabeleExistente: number;
  versiuneApp: string;
  ultimaActualizare: string;
  backupAutomat: boolean;
}

export default function SetariDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemStats();
  }, []);

  const loadSystemStats = async () => {
    try {
      // Simulează încărcarea stats-urilor sistemului
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStats({
        tabeleExistente: 16,
        versiuneApp: '2.1.0',
        ultimaActualizare: new Date().toLocaleDateString('ro-RO'),
        backupAutomat: true
      });
    } catch (error) {
      console.error('Eroare la încărcarea statisticilor:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              ⚙️ Setări Sistem
            </h1>
            <p className="text-gray-600 mt-2">
              Configurare completă pentru UNITAR PROIECT - Numerotare, date firmă și parametri sistem
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              ← Înapoi la Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* System Overview Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
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
          {/* Tabele Sistem */}
          <div className="bg-white p-6 rounded-lg shadow border border-blue-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Tabele Sistem</p>
                <p className="text-2xl font-bold text-blue-600">{stats.tabeleExistente}</p>
              </div>
              <div className="text-3xl">🗃️</div>
            </div>
          </div>

          {/* Versiune App */}
          <div className="bg-white p-6 rounded-lg shadow border border-green-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Versiune App</p>
                <p className="text-2xl font-bold text-green-600">{stats.versiuneApp}</p>
              </div>
              <div className="text-3xl">🚀</div>
            </div>
          </div>

          {/* Ultima Actualizare */}
          <div className="bg-white p-6 rounded-lg shadow border border-purple-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Ultima Actualizare</p>
                <p className="text-lg font-bold text-purple-600">{stats.ultimaActualizare}</p>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </div>

          {/* Backup Status */}
          <div className="bg-white p-6 rounded-lg shadow border border-orange-200">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Backup Automat</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.backupAutomat ? 'Activ' : 'Inactiv'}
                </p>
              </div>
              <div className="text-3xl">{stats.backupAutomat ? '✅' : '❌'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Setări Principale */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Setări Facturare */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              📄 Setări Facturare
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Configurare numerotare, serii și parametri e-factura
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Serie Facturi</div>
                  <div className="text-sm text-gray-600">Curent: INV-{'{proiectId}'}-{'{timestamp}'}</div>
                </div>
                <div className="text-blue-600 text-2xl">📋</div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Proforme</div>
                  <div className="text-sm text-gray-600">Serie: PRF</div>
                </div>
                <div className="text-green-600 text-2xl">📝</div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">e-Factura ANAF</div>
                  <div className="text-sm text-gray-600">Timp întârziere: 30 min</div>
                </div>
                <div className="text-purple-600 text-2xl">📤</div>
              </div>
            </div>
            
            <div className="mt-6">
              <Link
                href="/admin/setari/facturare"
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
              >
                ⚙️ Configurează Facturare
              </Link>
            </div>
          </div>
        </div>

        {/* Setări Firmă */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              🏢 Date Firmă
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Informații complete despre companie
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">UNITAR PROIECT TDA SRL</div>
                  <div className="text-sm text-gray-600">CUI: RO35639210</div>
                </div>
                <div className="text-blue-600 text-2xl">🏢</div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Nr. Reg. Com.</div>
                  <div className="text-sm text-gray-600">J2016002024405</div>
                </div>
                <div className="text-orange-600 text-2xl">📋</div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Contact</div>
                  <div className="text-sm text-gray-600">📞 0765486044</div>
                </div>
                <div className="text-green-600 text-2xl">📞</div>
              </div>
            </div>
            
            <div className="mt-6">
              <Link
                href="/admin/setari/firma"
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
              >
                🏢 Editează Date Firmă
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* SECȚIUNE NOUĂ: Setări Contracte */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              📄 Setări Contracte
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Configurare numerotare și format pentru contracte, PV-uri și anexe
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Contracte</div>
                  <div className="text-sm text-gray-600">Serie: CONTR</div>
                </div>
                <div className="text-blue-600 text-2xl">📄</div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Procese Verbale</div>
                  <div className="text-sm text-gray-600">Serie: PV</div>
                </div>
                <div className="text-green-600 text-2xl">📋</div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">Anexe</div>
                  <div className="text-sm text-gray-600">Serie: ANX</div>
                </div>
                <div className="text-purple-600 text-2xl">📎</div>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="text-2xl">⚙️</div>
                <div>
                  <div className="font-medium text-amber-900">Configurare Numerotare</div>
                  <div className="text-sm text-amber-700">
                    Setează formatul și seriile pentru toate tipurile de contracte
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <Link
                href="/admin/setari/contracte"
                className="w-full bg-amber-600 text-white px-4 py-3 rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 font-medium"
              >
                📄 Configurează Contracte
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Setări Avansate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conturi Bancare */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              🏦 Conturi Bancare
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="font-medium text-gray-900">ING Bank</div>
                <div className="text-sm text-gray-600">RO82INGB***7533</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="font-medium text-gray-900">Trezorerie</div>
                <div className="text-sm text-gray-600">RO29TREZ***8857</div>
              </div>
            </div>
            
            <div className="mt-4">
              <Link
                href="/admin/setari/banca"
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 text-sm font-medium"
              >
                🏦 Gestionează Conturi
              </Link>
            </div>
          </div>
        </div>

        {/* Import/Export */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              📦 Import/Export
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <button className="w-full p-3 bg-green-50 text-green-800 rounded-lg hover:bg-green-100 flex items-center justify-center gap-2">
                📤 Export Setări
              </button>
              <button className="w-full p-3 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2">
                📥 Import Setări
              </button>
              <button className="w-full p-3 bg-orange-50 text-orange-800 rounded-lg hover:bg-orange-100 flex items-center justify-center gap-2">
                🔄 Reset la Default
              </button>
            </div>
          </div>
        </div>

        {/* System Tools */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              🔧 Unelte Sistem
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <button className="w-full p-3 bg-yellow-50 text-yellow-800 rounded-lg hover:bg-yellow-100 flex items-center justify-center gap-2">
                🧹 Curăță Cache
              </button>
              <button className="w-full p-3 bg-purple-50 text-purple-800 rounded-lg hover:bg-purple-100 flex items-center justify-center gap-2">
                📊 Diagnosticare
              </button>
              <Link
                href="/admin/anaf/monitoring"
                className="w-full p-3 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 flex items-center justify-center gap-2"
              >
                📈 ANAF Monitoring
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Notă Importantă</h4>
            <p className="text-sm text-gray-600 mt-1">
              Modificările la setări vor afecta generarea documentelor viitoare. 
              Documentele existente nu vor fi modificate.
            </p>
          </div>
          <div className="text-4xl">⚠️</div>
        </div>
      </div>
    </div>
  );
}
