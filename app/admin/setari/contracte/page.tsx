// ==================================================================
// CALEA: app/admin/setari/contracte/page.tsx
// DATA: 26.08.2025 21:40 (ora României)
// DESCRIERE: Pagină completă pentru configurarea setărilor de contracte
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';

interface SetareContract {
  id: string;
  tip_document: string;
  serie: string;
  prefix: string;
  numar_curent: number;
  format_numerotare: string;
  separator: string;
  include_an: boolean;
  include_luna: boolean;
  include_proiect_id: boolean;
  activ: boolean;
  data_creare?: string;
  data_actualizare?: string;
}

interface FormData {
  id?: string;
  tip_document: string;
  serie: string;
  prefix: string;
  numar_curent: number;
  format_numerotare: string;
  separator: string;
  include_an: boolean;
  include_luna: boolean;
  include_proiect_id: boolean;
}

const defaultFormData: FormData = {
  tip_document: 'contract',
  serie: 'CONTR',
  prefix: '',
  numar_curent: 1000,
  format_numerotare: '{serie}-{numar}-{an}',
  separator: '-',
  include_an: true,
  include_luna: false,
  include_proiect_id: false
};

const tipuriDocument = [
  { value: 'contract', label: 'Contract de servicii', icon: '📄' },
  { value: 'pv', label: 'Proces Verbal Predare', icon: '📋' },
  { value: 'anexa', label: 'Anexă contract', icon: '📎' }
];

export default function SetariContracte() {
  const router = useRouter();
  const [user, loadingAuth] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('admin');

  const [setari, setSetari] = useState<SetareContract[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSetare, setEditingSetare] = useState<SetareContract | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  // Auth check
  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(localStorage.getItem('displayName') || 'Utilizator');
  }, [user, loadingAuth, router]);

  useEffect(() => {
    if (!user) return;
    loadSetari();
  }, [user]);

  const loadSetari = async () => {
    setLoadingData(true);
    try {
      const response = await fetch('/api/setari/contracte');
      const data = await response.json();
      
      if (data.success) {
        setSetari(data.setari || []);
      } else {
        showToast('Eroare la încărcarea setărilor contracte', 'error');
      }
    } catch (error) {
      console.error('Eroare la încărcarea setărilor:', error);
      showToast('Eroare la încărcarea setărilor contracte', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenModal = (setare?: SetareContract) => {
    if (setare) {
      setEditingSetare(setare);
      setFormData({
        id: setare.id,
        tip_document: setare.tip_document,
        serie: setare.serie,
        prefix: setare.prefix || '',
        numar_curent: setare.numar_curent,
        format_numerotare: setare.format_numerotare,
        separator: setare.separator,
        include_an: setare.include_an,
        include_luna: setare.include_luna,
        include_proiect_id: setare.include_proiect_id
      });
    } else {
      setEditingSetare(null);
      setFormData(defaultFormData);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSetare(null);
    setFormData(defaultFormData);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validări frontend
      if (!formData.serie.trim()) {
        showToast('Seria este obligatorie', 'error');
        setSaving(false);
        return;
      }

      if (formData.numar_curent < 1) {
        showToast('Numărul curent trebuie să fie pozitiv', 'error');
        setSaving(false);
        return;
      }

      const method = editingSetare ? 'PUT' : 'POST';
      const response = await fetch('/api/setari/contracte', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        showToast(data.message || 'Setare contracte salvată cu succes!', 'success');
        handleCloseModal();
        await loadSetari();
      } else {
        throw new Error(data.error || 'Eroare la salvare');
      }
    } catch (error) {
      console.error('Eroare la salvarea setării:', error);
      showToast(error instanceof Error ? error.message : 'Eroare la salvarea setării', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Generează preview pentru numărul contractului
  const generatePreview = () => {
    let preview = formData.format_numerotare;
    
    preview = preview.replace('{serie}', formData.serie);
    preview = preview.replace('{prefix}', formData.prefix);
    preview = preview.replace('{numar}', (formData.numar_curent + 1).toString());
    
    if (formData.include_an) {
      preview = preview.replace('{an}', new Date().getFullYear().toString());
    }
    
    if (formData.include_luna) {
      const luna = String(new Date().getMonth() + 1).padStart(2, '0');
      preview = preview.replace('{luna}', luna);
    }
    
    if (formData.include_proiect_id) {
      preview = preview.replace('{proiect_id}', 'P2025001');
    }

    return preview;
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

  if (loadingAuth || loadingData) {
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

  if (!user) {
    return <div>Se încarcă...</div>;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              📄 Setări Contracte
            </h1>
            <p className="text-gray-600 mt-2">
              Configurare numerotare și format pentru contracte, PV-uri și anexe
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
              + Adaugă Setare
            </button>
          </div>
        </div>
      </div>

      {/* Preview numerotare */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Preview Numerotare</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tipuriDocument.map(tip => {
            const setareExistenta = setari.find(s => s.tip_document === tip.value);
            return (
              <div key={tip.value} className="bg-white p-4 rounded-lg border-2 border-dashed border-blue-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{tip.icon}</span>
                  <h4 className="font-medium text-gray-900">{tip.label}</h4>
                </div>
                {setareExistenta ? (
                  <div className="text-sm text-gray-600">
                    <div className="font-mono bg-gray-50 p-2 rounded text-center font-bold text-green-600">
                      {setareExistenta.serie}-{setareExistenta.numar_curent + 1}-{new Date().getFullYear()}
                    </div>
                    <div className="mt-2 text-xs">
                      Serie: {setareExistenta.serie} • Următorul: {setareExistenta.numar_curent + 1}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-2">
                    Nu este configurat
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista Setări */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Lista Setări Contracte ({setari.length})
            </h3>
          </div>
        </div>

        {setari.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Nicio setare configurată
            </h4>
            <p className="text-gray-600 mb-4">
              Adaugă prima setare pentru numerotarea contractelor
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              + Adaugă prima setare
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tip Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serie / Format
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Număr Curent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Următorul Număr
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {setari.map((setare) => {
                  const tipDocument = tipuriDocument.find(t => t.value === setare.tip_document);
                  const urmatorul = setare.numar_curent + 1;
                  let preview = setare.format_numerotare;
                  preview = preview.replace('{serie}', setare.serie);
                  preview = preview.replace('{numar}', urmatorul.toString());
                  preview = preview.replace('{an}', new Date().getFullYear().toString());

                  return (
                    <tr key={setare.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-2xl mr-3">{tipDocument?.icon || '📄'}</div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {tipDocument?.label || setare.tip_document}
                            </div>
                            <div className="text-sm text-gray-500">
                              {setare.data_creare && new Date(setare.data_creare).toLocaleDateString('ro-RO')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {setare.serie}
                          {setare.prefix && <span className="text-blue-600"> ({setare.prefix})</span>}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {setare.format_numerotare}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {setare.numar_curent.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Separator: "{setare.separator}"
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                          {preview}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {setare.include_an && '📅 An'} 
                          {setare.include_luna && ' 🗓️ Lună'}
                          {setare.include_proiect_id && ' 🏷️ Proiect'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(setare)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md text-sm"
                          >
                            ✏️ Editează
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
                      {editingSetare ? '✏️ Editează Setare Contract' : '+ Adaugă Setare Contract'}
                    </h3>

                    <div className="space-y-6">
                      {/* Tip document */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tip Document *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {tipuriDocument.map(tip => (
                            <label key={tip.value} className={`
                              flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors
                              ${formData.tip_document === tip.value 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                              }
                            `}>
                              <input
                                type="radio"
                                name="tipDocument"
                                value={tip.value}
                                checked={formData.tip_document === tip.value}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev, 
                                  tip_document: e.target.value,
                                  // Schimbă seria default pe baza tipului
                                  serie: tip.value === 'contract' ? 'CONTR' : 
                                         tip.value === 'pv' ? 'PV' : 'ANX'
                                }))}
                                disabled={saving || !!editingSetare}
                                className="sr-only"
                              />
                              <span className="text-2xl">{tip.icon}</span>
                              <span className="text-sm font-medium">{tip.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Serie și prefix */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Serie *
                          </label>
                          <input
                            type="text"
                            value={formData.serie}
                            onChange={(e) => setFormData(prev => ({ ...prev, serie: e.target.value.toUpperCase() }))}
                            disabled={saving}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="CONTR"
                            maxLength={10}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Prefix (opțional)
                          </label>
                          <input
                            type="text"
                            value={formData.prefix}
                            onChange={(e) => setFormData(prev => ({ ...prev, prefix: e.target.value }))}
                            disabled={saving}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Prefix personalizat"
                            maxLength={5}
                          />
                        </div>
                      </div>

                      {/* Număr curent și separator */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Număr curent *
                          </label>
                          <input
                            type="number"
                            value={formData.numar_curent}
                            onChange={(e) => setFormData(prev => ({ ...prev, numar_curent: parseInt(e.target.value) || 0 }))}
                            disabled={saving}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="1"
                            placeholder="1000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Separator
                          </label>
                          <select
                            value={formData.separator}
                            onChange={(e) => setFormData(prev => ({ ...prev, separator: e.target.value }))}
                            disabled={saving}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="-">Minus (-)</option>
                            <option value="_">Underscore (_)</option>
                            <option value="/">Slash (/)</option>
                            <option value=".">Punct (.)</option>
                          </select>
                        </div>
                      </div>

                      {/* Format numerotare */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Format numerotare *
                        </label>
                        <input
                          type="text"
                          value={formData.format_numerotare}
                          onChange={(e) => setFormData(prev => ({ ...prev, format_numerotare: e.target.value }))}
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="{serie}-{numar}-{an}"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Folosește: {'{serie}'}, {'{prefix}'}, {'{numar}'}, {'{an}'}, {'{luna}'}, {'{proiect_id}'}
                        </p>
                      </div>

                      {/* Opțiuni */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Opțiuni includere
                        </label>
                        <div className="space-y-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.include_an}
                              onChange={(e) => setFormData(prev => ({ ...prev, include_an: e.target.checked }))}
                              disabled={saving}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">📅 Include anul</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.include_luna}
                              onChange={(e) => setFormData(prev => ({ ...prev, include_luna: e.target.checked }))}
                              disabled={saving}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">🗓️ Include luna</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.include_proiect_id}
                              onChange={(e) => setFormData(prev => ({ ...prev, include_proiect_id: e.target.checked }))}
                              disabled={saving}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">🏷️ Include ID proiect</span>
                          </label>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2">Preview număr generat:</h4>
                        <div className="font-mono font-bold text-lg text-green-700 bg-white p-3 rounded border">
                          {generatePreview()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.serie.trim()}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                    saving || !formData.serie.trim()
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {saving ? 'Se salvează...' : (editingSetare ? '💾 Actualizează' : '+ Adaugă Setare')}
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
    </ModernLayout>
  );
}
