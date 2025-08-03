// ==================================================================
// CALEA: app/admin/setari/banca/page.tsx
// DESCRIERE: Pagina completă pentru managementul conturilor bancare
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ContBancar {
  id: string;
  nume_banca: string;
  iban: string;
  cont_principal: boolean;
  observatii: string | null;
  data_creare?: string;
  data_actualizare?: string;
}

interface FormData {
  id?: string;
  nume_banca: string;
  iban: string;
  cont_principal: boolean;
  observatii: string;
}

const defaultFormData: FormData = {
  nume_banca: '',
  iban: '',
  cont_principal: false,
  observatii: ''
};

export default function SetariBanca() {
  const [conturi, setConturi] = useState<ContBancar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCont, setEditingCont] = useState<ContBancar | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  useEffect(() => {
    loadConturi();
  }, []);

  const loadConturi = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setari/banca');
      const data = await response.json();
      
      if (data.success) {
        setConturi(data.conturi || []);
      } else {
        showToast('Eroare la încărcarea conturilor bancare', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea conturilor:', error);
      showToast('Eroare la încărcarea conturilor bancare', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (cont?: ContBancar) => {
    if (cont) {
      setEditingCont(cont);
      setFormData({
        id: cont.id,
        nume_banca: cont.nume_banca,
        iban: cont.iban,
        cont_principal: cont.cont_principal,
        observatii: cont.observatii || ''
      });
    } else {
      setEditingCont(null);
      setFormData(defaultFormData);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCont(null);
    setFormData(defaultFormData);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validări frontend
      if (!formData.nume_banca.trim() || !formData.iban.trim()) {
        showToast('Numele băncii și IBAN sunt obligatorii', 'error');
        setSaving(false);
        return;
      }

      const method = editingCont ? 'PUT' : 'POST';
      const response = await fetch('/api/setari/banca', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        showToast(data.message || 'Cont bancar salvat cu succes!', 'success');
        handleCloseModal();
        await loadConturi();
      } else {
        throw new Error(data.error || 'Eroare la salvare');
      }
    } catch (error) {
      console.error('Eroare la salvarea contului:', error);
      showToast(error instanceof Error ? error.message : 'Eroare la salvarea contului', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cont: ContBancar) => {
    if (!confirm(`Sigur vrei să ștergi contul ${cont.nume_banca}?\n\nAceastă acțiune nu poate fi anulată.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/setari/banca?id=${cont.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        showToast('Cont bancar șters cu succes', 'success');
        await loadConturi();
      } else {
        throw new Error(data.error || 'Eroare la ștergere');
      }
    } catch (error) {
      console.error('Eroare la ștergerea contului:', error);
      showToast(error instanceof Error ? error.message : 'Eroare la ștergerea contului', 'error');
    }
  };

  const formatIBAN = (iban: string) => {
    // Formatează IBAN pentru afișare cu spații la fiecare 4 caractere
    return iban.replace(/(.{4})/g, '$1 ').trim();
  };

  const maskIBAN = (iban: string) => {
    // Maskează mijlocul IBAN-ului pentru securitate
    if (iban.length <= 8) return iban;
    const start = iban.substring(0, 4);
    const end = iban.substring(iban.length - 4);
    const middle = '*'.repeat(Math.min(iban.length - 8, 12));
    return `${start}${middle}${end}`;
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              🏦 Conturi Bancare
            </h1>
            <p className="text-gray-600 mt-2">
              Configurare conturi bancare - vor fi afișate în facturi pentru încasări
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/admin/setari"
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              ← Înapoi la Setări
            </Link>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              + Adaugă Cont Bancar
            </button>
          </div>
        </div>
      </div>

      {/* Preview Factură */}
      {conturi.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">📄 Preview Conturi în Factură</h3>
          <div className="bg-white p-4 rounded-lg border-2 border-dashed border-blue-300">
            <h4 className="font-medium text-gray-900 mb-3">Condiții de plată</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {conturi.map((cont, index) => (
                <div key={cont.id} className="border border-gray-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-medium text-gray-900">{cont.nume_banca}</h5>
                    {cont.cont_principal && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">PRINCIPAL</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    IBAN: {formatIBAN(cont.iban)}
                  </div>
                  {cont.observatii && (
                    <div className="text-xs text-gray-500 mt-1">{cont.observatii}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista Conturi */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Lista Conturi Bancare ({conturi.length})
            </h3>
          </div>
        </div>

        {conturi.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🏦</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Niciun cont bancar configurat
            </h4>
            <p className="text-gray-600 mb-4">
              Adaugă primul cont bancar pentru a putea genera facturi
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              + Adaugă primul cont bancar
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bancă
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IBAN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Observații
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {conturi.map((cont) => (
                  <tr key={cont.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-2xl mr-3">🏦</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {cont.nume_banca}
                          </div>
                          <div className="text-sm text-gray-500">
                            {cont.data_creare && new Date(cont.data_creare).toLocaleDateString('ro-RO')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">
                        {formatIBAN(maskIBAN(cont.iban))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {cont.iban.substring(0, 2)} • {cont.iban.length} caractere
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cont.cont_principal ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ⭐ Principal
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          📋 Secundar
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {cont.observatii || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(cont)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md text-sm"
                        >
                          ✏️ Editează
                        </button>
                        <button
                          onClick={() => handleDelete(cont)}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md text-sm"
                        >
                          🗑️ Șterge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Adăugare/Editare */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleCloseModal}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {editingCont ? '✏️ Editează Cont Bancar' : '+ Adaugă Cont Bancar'}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nume Bancă *
                        </label>
                        <input
                          type="text"
                          value={formData.nume_banca}
                          onChange={(e) => setFormData(prev => ({ ...prev, nume_banca: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="ex: ING Bank, Trezorerie, BCR"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          IBAN *
                        </label>
                        <input
                          type="text"
                          value={formData.iban}
                          onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="RO49AAAA1B31007593840000"
                          maxLength={34}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Format: 2 litere țară + 2 cifre control + max 30 caractere alfanumerice
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="cont_principal"
                            checked={formData.cont_principal}
                            onChange={(e) => setFormData(prev => ({ ...prev, cont_principal: e.target.checked }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="cont_principal" className="ml-2 text-sm text-gray-700">
                            ⭐ Marchează ca cont principal
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Contul principal va fi afișat primul în facturi (totuși toate conturile vor fi vizibile)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observații
                        </label>
                        <textarea
                          value={formData.observatii}
                          onChange={(e) => setFormData(prev => ({ ...prev, observatii: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="ex: Cont pentru încasări externe, Trezoreria sectorului 3 Bucuresti..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                    saving 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {saving ? '⏳ Se salvează...' : (editingCont ? '💾 Actualizează' : '+ Adaugă Cont')}
                </button>
                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
