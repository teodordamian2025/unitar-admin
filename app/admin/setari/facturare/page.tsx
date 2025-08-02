// ==================================================================
// CALEA: app/admin/setari/facturare/page.tsx
// DESCRIERE: Configurare completă setări facturare - serii, numerotare, e-factura
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SetariFacturare {
  // Serii documente
  serie_facturi: string;
  serie_proforme: string;
  serie_chitante: string;
  serie_contracte: string;
  
  // Numerotare
  numar_curent_facturi: number;
  numar_curent_proforme: number;
  numar_curent_chitante: number;
  numar_curent_contracte: number;
  
  // Format numerotare
  format_numerotare: string; // 'simplu' | 'compus' | 'custom'
  separator_numerotare: string;
  include_an_numerotare: boolean;
  include_luna_numerotare: boolean;
  
  // e-Factura ANAF
  efactura_enabled: boolean;
  efactura_timp_intarziere: number; // în minute
  efactura_mock_mode: boolean;
  efactura_auto_send: boolean;
  
  // TVA
  cota_tva_standard: number;
  cota_tva_redusa: number;
  
  // Alte setări
  valabilitate_proforme: number; // în zile
  termen_plata_standard: number; // în zile
  
  // Metadata
  data_creare?: string;
  data_actualizare?: string;
}

const formatExamples = {
  'simplu': 'INV-001',
  'compus': 'INV-2025-001',
  'custom': 'INV-P2025001-12345'
};

export default function SetariFacturare() {
  const [setari, setSetari] = useState<SetariFacturare>({
    serie_facturi: 'INV',
    serie_proforme: 'PRF',
    serie_chitante: 'CHT',
    serie_contracte: 'CTR',
    numar_curent_facturi: 1,
    numar_curent_proforme: 1,
    numar_curent_chitante: 1,
    numar_curent_contracte: 1,
    format_numerotare: 'compus',
    separator_numerotare: '-',
    include_an_numerotare: true,
    include_luna_numerotare: false,
    efactura_enabled: true,
    efactura_timp_intarziere: 30,
    efactura_mock_mode: true,
    efactura_auto_send: false,
    cota_tva_standard: 19,
    cota_tva_redusa: 9,
    valabilitate_proforme: 30,
    termen_plata_standard: 30
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSetari, setOriginalSetari] = useState<SetariFacturare | null>(null);

  useEffect(() => {
    loadSetari();
  }, []);

  const loadSetari = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setari/facturare');
      const data = await response.json();
      
      if (data.success) {
        const loadedSetari = data.setari || setari; // Fallback la default-uri
        setSetari(loadedSetari);
        setOriginalSetari(loadedSetari);
      } else {
        // Prima utilizare - va salva setările default
        console.log('Prima configurare - folosind setări default');
        setOriginalSetari(setari);
      }
    } catch (error) {
      console.error('Eroare la încărcarea setărilor:', error);
      showToast('Eroare la încărcarea setărilor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSetari = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/setari/facturare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setari)
      });

      const data = await response.json();
      
      if (data.success) {
        setOriginalSetari({...setari});
        showToast('Setări salvate cu succes!', 'success');
      } else {
        throw new Error(data.error || 'Eroare la salvare');
      }
    } catch (error) {
      console.error('Eroare la salvarea setărilor:', error);
      showToast('Eroare la salvarea setărilor', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (confirm('Sigur vrei să resetezi toate setările la valorile implicite?')) {
      const defaultSetari: SetariFacturare = {
        serie_facturi: 'INV',
        serie_proforme: 'PRF',
        serie_chitante: 'CHT',
        serie_contracte: 'CTR',
        numar_curent_facturi: 1,
        numar_curent_proforme: 1,
        numar_curent_chitante: 1,
        numar_curent_contracte: 1,
        format_numerotare: 'compus',
        separator_numerotare: '-',
        include_an_numerotare: true,
        include_luna_numerotare: false,
        efactura_enabled: true,
        efactura_timp_intarziere: 30,
        efactura_mock_mode: true,
        efactura_auto_send: false,
        cota_tva_standard: 19,
        cota_tva_redusa: 9,
        valabilitate_proforme: 30,
        termen_plata_standard: 30
      };
      setSetari(defaultSetari);
      showToast('Setări resetate la valorile implicite', 'info');
    }
  };

  const handleInputChange = (field: keyof SetariFacturare, value: any) => {
    setSetari(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generatePreview = () => {
    const { serie_facturi, format_numerotare, separator_numerotare, include_an_numerotare, include_luna_numerotare, numar_curent_facturi } = setari;
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    let preview = serie_facturi;
    
    if (format_numerotare === 'compus') {
      if (include_an_numerotare) preview += `${separator_numerotare}${currentYear}`;
      if (include_luna_numerotare) preview += `${separator_numerotare}${currentMonth}`;
      preview += `${separator_numerotare}${String(numar_curent_facturi).padStart(3, '0')}`;
    } else if (format_numerotare === 'simplu') {
      preview += `${separator_numerotare}${String(numar_curent_facturi).padStart(3, '0')}`;
    } else {
      // Custom format din codul actual
      preview = `INV-P${currentYear}${String(numar_curent_facturi).padStart(3, '0')}-${Date.now().toString().slice(-5)}`;
    }
    
    return preview;
  };

  const hasChanges = () => {
    return JSON.stringify(setari) !== JSON.stringify(originalSetari);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Simple toast implementation
    const toastEl = document.createElement('div');
    toastEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              📄 Setări Facturare
            </h1>
            <p className="text-gray-600 mt-2">
              Configurare serii, numerotare și parametri pentru toate tipurile de documente
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/admin/setari"
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              ← Înapoi la Setări
            </Link>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Preview Numerotare</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">Factură următoare:</div>
            <div className="text-xl font-bold text-blue-600">{generatePreview()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">Proformă următoare:</div>
            <div className="text-xl font-bold text-green-600">
              {generatePreview().replace(setari.serie_facturi, setari.serie_proforme)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">Chitanță următoare:</div>
            <div className="text-xl font-bold text-purple-600">
              {generatePreview().replace(setari.serie_facturi, setari.serie_chitante)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">Contract următor:</div>
            <div className="text-xl font-bold text-orange-600">
              {generatePreview().replace(setari.serie_facturi, setari.serie_contracte)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Serii Documente */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">📋 Serii Documente</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serie Facturi
              </label>
              <input
                type="text"
                value={setari.serie_facturi}
                onChange={(e) => handleInputChange('serie_facturi', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="INV"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serie Proforme
              </label>
              <input
                type="text"
                value={setari.serie_proforme}
                onChange={(e) => handleInputChange('serie_proforme', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="PRF"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serie Chitanțe
              </label>
              <input
                type="text"
                value={setari.serie_chitante}
                onChange={(e) => handleInputChange('serie_chitante', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CHT"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serie Contracte
              </label>
              <input
                type="text"
                value={setari.serie_contracte}
                onChange={(e) => handleInputChange('serie_contracte', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CTR"
                maxLength={5}
              />
            </div>
          </div>
        </div>

        {/* Numerotare */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">🔢 Numerotare</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format Numerotare
              </label>
              <select
                value={setari.format_numerotare}
                onChange={(e) => handleInputChange('format_numerotare', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="simplu">Simplu (INV-001)</option>
                <option value="compus">Compus (INV-2025-001)</option>
                <option value="custom">Custom (sistem actual)</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Exemplu: {formatExamples[setari.format_numerotare as keyof typeof formatExamples]}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Separator
              </label>
              <select
                value={setari.separator_numerotare}
                onChange={(e) => handleInputChange('separator_numerotare', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={setari.format_numerotare === 'custom'}
              >
                <option value="-">Liniuță (-)</option>
                <option value="/">Slash (/)</option>
                <option value="_">Underscore (_)</option>
                <option value=".">Punct (.)</option>
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="include_an"
                  checked={setari.include_an_numerotare}
                  onChange={(e) => handleInputChange('include_an_numerotare', e.target.checked)}
                  disabled={setari.format_numerotare === 'custom'}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="include_an" className="ml-2 text-sm text-gray-700">
                  Include anul în numerotare
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="include_luna"
                  checked={setari.include_luna_numerotare}
                  onChange={(e) => handleInputChange('include_luna_numerotare', e.target.checked)}
                  disabled={setari.format_numerotare === 'custom'}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="include_luna" className="ml-2 text-sm text-gray-700">
                  Include luna în numerotare
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Numere Curente */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">🎯 Numere Curente</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Număr Curent Facturi
              </label>
              <input
                type="number"
                value={setari.numar_curent_facturi}
                onChange={(e) => handleInputChange('numar_curent_facturi', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Număr Curent Proforme
              </label>
              <input
                type="number"
                value={setari.numar_curent_proforme}
                onChange={(e) => handleInputChange('numar_curent_proforme', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Număr Curent Chitanțe
              </label>
              <input
                type="number"
                value={setari.numar_curent_chitante}
                onChange={(e) => handleInputChange('numar_curent_chitante', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Număr Curent Contracte
              </label>
              <input
                type="number"
                value={setari.numar_curent_contracte}
                onChange={(e) => handleInputChange('numar_curent_contracte', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* e-Factura ANAF */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">📤 e-Factura ANAF</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="efactura_enabled"
                checked={setari.efactura_enabled}
                onChange={(e) => handleInputChange('efactura_enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="efactura_enabled" className="ml-2 text-sm text-gray-700">
                Activează integrarea e-Factura ANAF
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="efactura_mock_mode"
                checked={setari.efactura_mock_mode}
                onChange={(e) => handleInputChange('efactura_mock_mode', e.target.checked)}
                disabled={!setari.efactura_enabled}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="efactura_mock_mode" className="ml-2 text-sm text-gray-700">
                🧪 Mock Mode (pentru testare - NU trimite la ANAF)
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="efactura_auto_send"
                checked={setari.efactura_auto_send}
                onChange={(e) => handleInputChange('efactura_auto_send', e.target.checked)}
                disabled={!setari.efactura_enabled}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="efactura_auto_send" className="ml-2 text-sm text-gray-700">
                Trimitere automată la ANAF
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timp întârziere e-Factura (minute)
              </label>
              <input
                type="number"
                value={setari.efactura_timp_intarziere}
                onChange={(e) => handleInputChange('efactura_timp_intarziere', parseInt(e.target.value) || 30)}
                disabled={!setari.efactura_enabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="5"
                max="1440"
              />
              <p className="text-sm text-gray-500 mt-1">
                Timp de așteptare înainte de trimiterea automată la ANAF
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TVA & Alte Setări */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* TVA */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">💰 Cote TVA</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TVA Standard (%)
              </label>
              <select
                value={setari.cota_tva_standard}
                onChange={(e) => handleInputChange('cota_tva_standard', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={19}>19% (standard RON)</option>
                <option value={21}>21% (din august 2025)</option>
                <option value={0}>0% (scutit de TVA)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TVA Redusă (%)
              </label>
              <select
                value={setari.cota_tva_redusa}
                onChange={(e) => handleInputChange('cota_tva_redusa', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={9}>9% (cota redusă)</option>
                <option value={5}>5% (cota super-redusă)</option>
                <option value={0}>0% (scutit de TVA)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alte Setări */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">⏰ Termene</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valabilitate Proforme (zile)
              </label>
              <input
                type="number"
                value={setari.valabilitate_proforme}
                onChange={(e) => handleInputChange('valabilitate_proforme', parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="365"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Termen Plată Standard (zile)
              </label>
              <input
                type="number"
                value={setari.termen_plata_standard}
                onChange={(e) => handleInputChange('termen_plata_standard', parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="365"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={resetToDefault}
          className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 flex items-center gap-2"
        >
          🔄 Reset la Default
        </button>

        <div className="flex gap-3">
          {hasChanges() && (
            <div className="text-sm text-orange-600 flex items-center gap-2 mr-4">
              ⚠️ Modificări nesalvate
            </div>
          )}
          
          <button
            onClick={saveSetari}
            disabled={saving || !hasChanges()}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 font-medium ${
              saving || !hasChanges()
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? '⏳ Se salvează...' : '💾 Salvează Setări'}
          </button>
        </div>
      </div>
    </div>
  );
}
