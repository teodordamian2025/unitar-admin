'use client';

import { useState, useEffect } from 'react';
import ModernLayout from '@/app/components/ModernLayout';
import { Check, AlertTriangle } from 'lucide-react';

export default function SetariEFacturaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    tip_facturare: 'iapp', // 'iapp' sau 'anaf_direct'
    auto_transmite_efactura: true,
    serie_default: 'SERIE_TEST',
    moneda_default: 'RON',
    footer_intocmit_name: 'Administrator UNITAR',
    email_responsabil: 'contact@unitarproiect.eu',
    sursa_facturi_primite: 'iapp' // 'iapp' sau 'anaf' - pentru facturi primite de la furnizori
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/iapp/config');
      const data = await response.json();

      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/iapp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Setări salvate cu succes!');
      } else {
        alert('❌ Eroare: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('❌ Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ModernLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Se încarcă setările...</p>
          </div>
        </div>
      </ModernLayout>
    );
  }

  return (
    <ModernLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Setări e-Factura</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            Configurează metoda de transmitere a facturilor către ANAF e-Factura
          </p>
        </div>

        {/* Metodă Facturare */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
            Metodă de facturare electronică
          </h2>

          <div className="space-y-4">
            {/* Radio: iapp.ro */}
            <div
              className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                config.tip_facturare === 'iapp'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setConfig({ ...config, tip_facturare: 'iapp' })}
            >
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  checked={config.tip_facturare === 'iapp'}
                  onChange={() => setConfig({ ...config, tip_facturare: 'iapp' })}
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center flex-wrap">
                  <label className="text-base sm:text-lg font-medium text-gray-900">
                    iapp.ro (Recomandat)
                  </label>
                  <span className="ml-3 px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                    RECOMANDAT
                  </span>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-gray-600">
                  Folosește platforma iapp.ro pentru emiterea și transmiterea automată a facturilor către ANAF e-Factura.
                </p>
                <ul className="mt-3 space-y-1 text-xs sm:text-sm text-gray-600">
                  <li className="flex items-center">
                    <Check className="w-4 h-4 mr-2 flex-shrink-0 text-green-500" />
                    Configurare simplificată (fără OAuth)
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 mr-2 flex-shrink-0 text-green-500" />
                    Auto-completare date client din CIF
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 mr-2 flex-shrink-0 text-green-500" />
                    Sincronizare automată facturi primite
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 mr-2 flex-shrink-0 text-green-500" />
                    Raportare și tracking avansat
                  </li>
                </ul>
              </div>
            </div>

            {/* Radio: ANAF Direct */}
            <div
              className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                config.tip_facturare === 'anaf_direct'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setConfig({ ...config, tip_facturare: 'anaf_direct' })}
            >
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  checked={config.tip_facturare === 'anaf_direct'}
                  onChange={() => setConfig({ ...config, tip_facturare: 'anaf_direct' })}
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-4 flex-1">
                <label className="text-base sm:text-lg font-medium text-gray-900">
                  ANAF Direct (OAuth)
                </label>
                <p className="mt-2 text-xs sm:text-sm text-gray-600">
                  Transmitere directă către ANAF e-Factura folosind OAuth 2.0 cu certificat digital.
                </p>
                <ul className="mt-3 space-y-1 text-xs sm:text-sm text-gray-600">
                  <li className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-500" />
                    Necesită certificat digital și OAuth
                  </li>
                  <li className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-500" />
                    Configurare complexă
                  </li>
                  <li className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-500" />
                    Fără sincronizare automată facturi primite
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Setări Avansate (doar pentru iapp.ro) */}
        {config.tip_facturare === 'iapp' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Setări Avansate iapp.ro
            </h2>

            <div className="space-y-4">
              {/* Auto-transmite */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Auto-transmitere la ANAF e-Factura
                  </label>
                  <p className="text-sm text-gray-600">
                    Transmite automat facturile către ANAF după emitere
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_transmite_efactura}
                    onChange={(e) => setConfig({ ...config, auto_transmite_efactura: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Serie Default */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Serie Factură Default
                </label>
                <input
                  type="text"
                  value={config.serie_default}
                  onChange={(e) => setConfig({ ...config, serie_default: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="SERIE_TEST"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Seria trebuie să existe în aplicația iapp.ro
                </p>
              </div>

              {/* Monedă Default */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Monedă Default
                </label>
                <select
                  value={config.moneda_default}
                  onChange={(e) => setConfig({ ...config, moneda_default: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              {/* Footer Întocmit */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Nume Persoană Întocmire
                </label>
                <input
                  type="text"
                  value={config.footer_intocmit_name}
                  onChange={(e) => setConfig({ ...config, footer_intocmit_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Administrator UNITAR"
                />
              </div>

              {/* Email Responsabil */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Email Responsabil
                </label>
                <input
                  type="email"
                  value={config.email_responsabil}
                  onChange={(e) => setConfig({ ...config, email_responsabil: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@unitarproiect.eu"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Pentru gestiune internă - identifică facturile emise prin API
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Secțiune: Preluare Facturi Primite de la Furnizori */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Preluare Facturi Primite de la Furnizori
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            Alege sursa pentru sincronizarea automată a facturilor primite de la furnizori din SPV ANAF
          </p>

          <div className="space-y-4">
            {/* Radio: iapp.ro */}
            <div
              className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                config.sursa_facturi_primite === 'iapp'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setConfig({ ...config, sursa_facturi_primite: 'iapp' })}
            >
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  checked={config.sursa_facturi_primite === 'iapp'}
                  onChange={() => setConfig({ ...config, sursa_facturi_primite: 'iapp' })}
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center flex-wrap">
                  <label className="text-base sm:text-lg font-medium text-gray-900">
                    iapp.ro (Recomandat)
                  </label>
                  <span className="ml-3 px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                    RECOMANDAT
                  </span>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-gray-600">
                  Sincronizare automată facturi primite prin API iapp.ro - fără OAuth, configurare simplă
                </p>
                <ul className="mt-2 space-y-1 text-xs sm:text-sm text-gray-600">
                  <li className="flex items-center">
                    <Check className="w-4 h-4 mr-2 flex-shrink-0 text-green-500" />
                    Aceleași credențiale ca pentru emitere
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 mr-2 flex-shrink-0 text-green-500" />
                    Sincronizare rapidă (doar metadata JSON)
                  </li>
                  <li className="flex items-center">
                    <Check className="w-4 h-4 mr-2 flex-shrink-0 text-green-500" />
                    Auto-asociere cu cheltuieli proiecte
                  </li>
                </ul>
              </div>
            </div>

            {/* Radio: ANAF Direct */}
            <div
              className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                config.sursa_facturi_primite === 'anaf'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setConfig({ ...config, sursa_facturi_primite: 'anaf' })}
            >
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  checked={config.sursa_facturi_primite === 'anaf'}
                  onChange={() => setConfig({ ...config, sursa_facturi_primite: 'anaf' })}
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-4 flex-1">
                <label className="text-base sm:text-lg font-medium text-gray-900">
                  ANAF Direct (OAuth)
                </label>
                <p className="mt-2 text-xs sm:text-sm text-gray-600">
                  Descărcare directă din SPV ANAF prin OAuth 2.0 + certificat digital
                </p>
                <ul className="mt-2 space-y-1 text-xs sm:text-sm text-gray-600">
                  <li className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-500" />
                    Necesită configurare OAuth separată
                  </li>
                  <li className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-500" />
                    Descarcă fișiere ZIP/XML/PDF (mai lent)
                  </li>
                  <li className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-500" />
                    Poate întâmpina erori SPV ANAF
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Se salvează...' : 'Salvează Setările'}
          </button>
        </div>
      </div>
    </ModernLayout>
  );
}
