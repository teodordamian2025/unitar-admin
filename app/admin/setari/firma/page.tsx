// ==================================================================
// CALEA: app/admin/setari/firma/page.tsx
// DESCRIERE: Configurare completă date firmă - nume, adresă, CUI, contact
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';

interface SetariFirma {
  id: string;
  nume_firma: string;
  cui: string;
  nr_reg_com: string;
  adresa_completa: string;
  judet: string;
  oras: string;
  cod_postal: string;
  tara: string;
  telefon_principal: string;
  telefon_secundar: string;
  email_principal: string;
  email_secundar: string;
  website: string;
  capital_social: number;
  tip_firma: string; // SRL, SA, PFA, etc.
  reprezentant_legal: string;
  data_infiintare: string;
  observatii: string;
  data_creare?: string;
  data_actualizare?: string;
}

export default function SetariFirma() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('admin');

  const [setari, setSetari] = useState<SetariFirma>({
    id: 'setari_firma_main',
    nume_firma: 'UNITAR PROIECT TDA SRL',
    cui: 'RO35639210',
    nr_reg_com: 'J2016002024405',
    adresa_completa: 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
    judet: 'Bucuresti',
    oras: 'Bucuresti',
    cod_postal: '041836',
    tara: 'Romania',
    telefon_principal: '0765486044',
    telefon_secundar: '',
    email_principal: 'contact@unitarproiect.eu',
    email_secundar: 'office@unitarproiect.eu',
    website: 'https://unitarproiect.eu',
    capital_social: 200,
    tip_firma: 'SRL',
    reprezentant_legal: '',
    data_infiintare: '2020-01-15',
    observatii: ''
  });

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSetari, setOriginalSetari] = useState<SetariFirma | null>(null);

  // Auth check
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(user.displayName || user.email || 'Utilizator');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadSetari();
  }, [user]);

  const loadSetari = async () => {
    setLoadingData(true);
    try {
      const response = await fetch('/api/setari/firma');
      const data = await response.json();
      
      if (data.success) {
        const loadedSetari = data.setari || setari;
        setSetari(loadedSetari);
        setOriginalSetari(loadedSetari);
      } else {
        console.log('Prima configurare - folosind setări default');
        setOriginalSetari(setari);
      }
    } catch (error) {
      console.error('Eroare la încărcarea setărilor:', error);
      showToast('Eroare la încărcarea setărilor', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const saveSetari = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/setari/firma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setari)
      });

      const data = await response.json();
      
      if (data.success) {
        setOriginalSetari({...setari});
        showToast('Date firmă salvate cu succes!', 'success');
      } else {
        throw new Error(data.error || 'Eroare la salvare');
      }
    } catch (error) {
      console.error('Eroare la salvarea datelor:', error);
      showToast('Eroare la salvarea datelor', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (confirm('Sigur vrei să resetezi toate datele la valorile implicite?')) {
      const defaultSetari: SetariFirma = {
        id: 'setari_firma_main',
        nume_firma: 'UNITAR PROIECT TDA SRL',
        cui: 'RO35639210',
        nr_reg_com: 'J2016002024405',
        adresa_completa: 'Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4',
        judet: 'Bucuresti',
        oras: 'Bucuresti',
        cod_postal: '041836',
        tara: 'Romania',
        telefon_principal: '0765486044',
        telefon_secundar: '',
        email_principal: 'contact@unitarproiect.eu',
        email_secundar: 'office@unitarproiect.eu',
        website: 'https://unitarproiect.eu',
        capital_social: 200,
        tip_firma: 'SRL',
        reprezentant_legal: '',
        data_infiintare: '2020-01-15',
        observatii: ''
      };
      setSetari(defaultSetari);
      showToast('Date resetate la valorile implicite', 'info');
    }
  };

  const handleInputChange = (field: keyof SetariFirma, value: any) => {
    setSetari(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const hasChanges = () => {
    return JSON.stringify(setari) !== JSON.stringify(originalSetari);
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

  if (loading || !user) {
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
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              🏢 Date Firmă
            </h1>
            <p className="text-gray-600 mt-2">
              Configurare completă informații companie - vor fi folosite în documente și facturi
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

      {/* Preview Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">📄 Preview Antet Factură</h3>
        <div className="bg-white p-4 rounded-lg border-2 border-dashed border-blue-300">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{setari.nume_firma}</h2>
            <div className="text-sm text-gray-600">
              CUI: {setari.cui} | Nr. Reg. Com.: {setari.nr_reg_com}
            </div>
          </div>
          <div className="text-sm text-gray-700">
            <div><strong>Adresa:</strong> {setari.adresa_completa}</div>
            <div><strong>Telefon:</strong> {setari.telefon_principal}</div>
            <div><strong>Email:</strong> {setari.email_principal}</div>
            {setari.website && <div><strong>Website:</strong> {setari.website}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Informații de Bază */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">🏢 Informații de Bază</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nume Firmă *
              </label>
              <input
                type="text"
                value={setari.nume_firma}
                onChange={(e) => handleInputChange('nume_firma', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="UNITAR PROIECT TDA SRL"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CUI *
                </label>
                <input
                  type="text"
                  value={setari.cui}
                  onChange={(e) => handleInputChange('cui', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="RO35639210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nr. Reg. Com. *
                </label>
                <input
                  type="text"
                  value={setari.nr_reg_com}
                  onChange={(e) => handleInputChange('nr_reg_com', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="J2016002024405"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tip Firmă
                </label>
                <select
                  value={setari.tip_firma}
                  onChange={(e) => handleInputChange('tip_firma', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SRL">SRL</option>
                  <option value="SA">SA</option>
                  <option value="PFA">PFA</option>
                  <option value="II">Întreprindere Individuală</option>
                  <option value="ONG">ONG</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capital Social (RON)
                </label>
                <input
                  type="number"
                  value={setari.capital_social}
                  onChange={(e) => handleInputChange('capital_social', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reprezentant Legal
              </label>
              <input
                type="text"
                value={setari.reprezentant_legal}
                onChange={(e) => handleInputChange('reprezentant_legal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Numele reprezentantului legal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Înființare
              </label>
              <input
                type="date"
                value={setari.data_infiintare}
                onChange={(e) => handleInputChange('data_infiintare', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Adresă */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">📍 Adresă</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresa Completă *
              </label>
              <textarea
                value={setari.adresa_completa}
                onChange={(e) => handleInputChange('adresa_completa', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bd. Gheorghe Sincai, nr. 15, bl. 5A, sc. 1, ap. 1, interfon 01, mun. Bucuresti, sector 4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Județ/Sector
                </label>
                <input
                  type="text"
                  value={setari.judet}
                  onChange={(e) => handleInputChange('judet', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Bucuresti"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Oraș
                </label>
                <input
                  type="text"
                  value={setari.oras}
                  onChange={(e) => handleInputChange('oras', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Bucuresti"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cod Poștal
                </label>
                <input
                  type="text"
                  value={setari.cod_postal}
                  onChange={(e) => handleInputChange('cod_postal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="041836"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Țara
                </label>
                <select
                  value={setari.tara}
                  onChange={(e) => handleInputChange('tara', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Romania">🇷🇴 Romania</option>
                  <option value="Moldova">🇲🇩 Moldova</option>
                  <option value="Bulgaria">🇧🇬 Bulgaria</option>
                  <option value="Ungaria">🇭🇺 Ungaria</option>
                  <option value="Italia">🇮🇹 Italia</option>
                  <option value="Germania">🇩🇪 Germania</option>
                  <option value="Franta">🇫🇷 Franța</option>
                  <option value="Spania">🇪🇸 Spania</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">📞 Contact</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon Principal *
                </label>
                <input
                  type="tel"
                  value={setari.telefon_principal}
                  onChange={(e) => handleInputChange('telefon_principal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0765486044"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon Secundar
                </label>
                <input
                  type="tel"
                  value={setari.telefon_secundar}
                  onChange={(e) => handleInputChange('telefon_secundar', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0732123456"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Principal *
                </label>
                <input
                  type="email"
                  value={setari.email_principal}
                  onChange={(e) => handleInputChange('email_principal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="contact@unitarproiect.eu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Secundar
                </label>
                <input
                  type="email"
                  value={setari.email_secundar}
                  onChange={(e) => handleInputChange('email_secundar', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="office@unitarproiect.eu"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website
              </label>
              <input
                type="url"
                value={setari.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://unitarproiect.eu"
              />
            </div>
          </div>
        </div>

        {/* Observații */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">📝 Observații</h3>
          </div>
          <div className="p-6">
            <textarea
              value={setari.observatii}
              onChange={(e) => handleInputChange('observatii', e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Observații suplimentare despre firmă..."
            />
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
            {saving ? '⏳ Se salvează...' : '💾 Salvează Date Firmă'}
          </button>
        </div>
      </div>
      </div>
    </ModernLayout>
  );
}
