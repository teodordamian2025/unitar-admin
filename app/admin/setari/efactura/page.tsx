'use client';

import { useState, useEffect } from 'react';
import ModernLayout from '@/app/components/ModernLayout';

export default function SetariEFacturaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    tip_facturare: 'iapp', // 'iapp' sau 'anaf_direct'
    auto_transmite_efactura: true,
    serie_default: 'SERIE_TEST',
    moneda_default: 'RON',
    footer_intocmit_name: 'Administrator UNITAR',
    email_responsabil: 'contact@unitarproiect.eu'
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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Setări e-Factura</h1>
          <p className="mt-2 text-gray-600">
            Configurează metoda de transmitere a facturilor către ANAF e-Factura
          </p>
        </div>

        {/* Metodă Facturare */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
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
                <div className="flex items-center">
                  <label className="text-lg font-medium text-gray-900">
                    iapp.ro (Recomandat)
                  </label>
                  <span className="ml-3 px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                    RECOMANDAT
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Folosește platforma iapp.ro pentru emiterea și transmiterea automată a facturilor către ANAF e-Factura.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-600">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    Configurare simplificată (fără OAuth)
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    Auto-completare date client din CIF
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    Sincronizare automată facturi primite
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
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
                <label className="text-lg font-medium text-gray-900">
                  ANAF Direct (OAuth)
                </label>
                <p className="mt-2 text-sm text-gray-600">
                  Transmitere directă către ANAF e-Factura folosind OAuth 2.0 cu certificat digital.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-600">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    Necesită certificat digital și OAuth
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    Configurare complexă
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
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
