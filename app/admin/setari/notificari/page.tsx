// CALEA: /app/admin/setari/notificari/page.tsx
// DATA: 05.10.2025 (ora României)
// DESCRIERE: Pagină admin pentru configurare setări notificări

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import type { NotificareSetting, UpdateSettingsRequest } from '@/lib/notifications/types';

export default function NotificariSetariPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [settings, setSettings] = useState<NotificareSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'toate' | 'active' | 'inactive'>('toate');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<NotificareSetting>>({});

  // Redirect dacă nu e autentificat
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch settings
  const fetchSettings = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      let url = `/api/notifications/settings?user_id=${user.uid}`;
      if (filter === 'active') url += '&activ_only=true';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setSettings(data.settings || []);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user?.uid, filter]);

  // Update setting
  const handleUpdate = async (settingId: string) => {
    if (!user?.uid) return;

    try {
      const body: UpdateSettingsRequest = {
        setting_id: settingId,
        user_id: user.uid,
        updates: editData,
      };

      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        alert('Setare actualizată cu succes!');
        setEditingId(null);
        setEditData({});
        fetchSettings();
      } else {
        alert(`Eroare: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      alert('Eroare la actualizare setare');
    }
  };

  // Get icon pentru categorie
  const getCategoryIcon = (categorie: string) => {
    if (categorie === 'proiecte') return '📊';
    if (categorie === 'sarcini') return '✅';
    if (categorie === 'financiar') return '💰';
    if (categorie === 'documente') return '📄';
    if (categorie === 'termene') return '⏰';
    if (categorie === 'sistem') return '⚙️';
    return '🔔';
  };

  // Filter settings
  const filteredSettings = settings.filter((s) => {
    if (filter === 'active') return s.activ;
    if (filter === 'inactive') return !s.activ;
    return true;
  });

  // Group by category
  const groupedSettings = filteredSettings.reduce((acc, setting) => {
    const cat = setting.categorie || 'sistem';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(setting);
    return acc;
  }, {} as Record<string, NotificareSetting[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.displayName || user.email || 'Utilizator';
  const userRole = 'admin';

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Setări Notificări</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configurează tipurile de notificări și canalele de livrare
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Afișare:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="toate">Toate setările</option>
              <option value="active">Doar active</option>
              <option value="inactive">Doar inactive</option>
            </select>
            <div className="ml-auto text-sm text-gray-600">
              Total: {filteredSettings.length} setări
            </div>
          </div>
        </div>

        {/* Settings List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Se încarcă setările...</p>
          </div>
        ) : Object.keys(groupedSettings).length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-600">Nu există setări pentru filtrele selectate</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSettings).map(([categorie, catSettings]) => (
              <div key={categorie} className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Category Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-2xl">{getCategoryIcon(categorie)}</span>
                    <span className="capitalize">{categorie}</span>
                    <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                      {catSettings.length}
                    </span>
                  </h2>
                </div>

                {/* Settings Items */}
                <div className="divide-y divide-gray-100">
                  {catSettings.map((setting) => (
                    <div key={setting.id} className="p-6 hover:bg-gray-50 transition-colors">
                      {editingId === setting.id ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nume Setare
                            </label>
                            <input
                              type="text"
                              value={setting.nume_setare}
                              disabled
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editData.activ ?? setting.activ}
                                onChange={(e) =>
                                  setEditData({ ...editData, activ: e.target.checked })
                                }
                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                              />
                              <label className="ml-2 text-sm text-gray-700">Activ</label>
                            </div>

                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editData.canal_email ?? setting.canal_email}
                                onChange={(e) =>
                                  setEditData({ ...editData, canal_email: e.target.checked })
                                }
                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                              />
                              <label className="ml-2 text-sm text-gray-700">📧 Email</label>
                            </div>

                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editData.canal_clopotel ?? setting.canal_clopotel}
                                onChange={(e) =>
                                  setEditData({ ...editData, canal_clopotel: e.target.checked })
                                }
                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                              />
                              <label className="ml-2 text-sm text-gray-700">🔔 Clopoțel</label>
                            </div>

                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editData.canal_push ?? setting.canal_push}
                                onChange={(e) =>
                                  setEditData({ ...editData, canal_push: e.target.checked })
                                }
                                className="h-4 w-4 text-blue-600 rounded border-gray-300"
                              />
                              <label className="ml-2 text-sm text-gray-700">📱 Push</label>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdate(setting.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              Salvează
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditData({});
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                            >
                              Anulează
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900">
                                {setting.nume_setare}
                              </h3>
                              <p className="mt-1 text-sm text-gray-600">{setting.descriere}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                Tip: <code className="bg-gray-100 px-1 py-0.5 rounded">{setting.tip_notificare}</code>
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {setting.activ ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Activ
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Inactiv
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  setEditingId(setting.id);
                                  setEditData({});
                                }}
                                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                Editează
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Canale:</span>
                            {setting.canal_email && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700">
                                📧 Email
                              </span>
                            )}
                            {setting.canal_clopotel && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-purple-50 text-purple-700">
                                🔔 Clopoțel
                              </span>
                            )}
                            {setting.canal_push && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700">
                                📱 Push
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModernLayout>
  );
}
