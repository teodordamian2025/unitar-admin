// app/admin/rapoarte/proiecte/components/FacturaHibridModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Search, Plus, Building2, FileText, Calculator, Users, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Proiect {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
  Valoare_Estimata: number;
  Data_Start: { value: string };
  Data_Final: { value: string };
  Responsabil?: string;
  Adresa?: string;
  Observatii?: string;
}

interface Subproiect {
  ID_Subproiect: string;
  ID_Proiect: string;
  Denumire: string;
  Responsabil?: string;
  Status: string;
  Valoare_Estimata: number;
  Data_Start: { value: string };
  Data_Final: { value: string };
  Client: string;
  Adresa?: string;
}

interface Client {
  id: string;
  nume: string;
  cui: string;
  nr_reg_com: string;
  adresa: string;
  email: string;
  telefon: string;
  banca: string;
  iban: string;
}

interface LinieFactura {
  id: string;
  descriere: string;
  cantitate: number;
  pretUnitarFaraTVA: number;
  totalFaraTVA: number;
}

interface FacturaHibridModalProps {
  proiect: Proiect;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FacturaHibridModal({ proiect, onClose, onSuccess }: FacturaHibridModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingANAF, setLoadingANAF] = useState(false);
  const [loadingSubproiecte, setLoadingSubproiecte] = useState(false);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [clientBD, setClientBD] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState({
    // Date firmă (precompletate)
    numarFactura: '',
    dataFactura: new Date().toISOString().split('T')[0],
    
    // Date client (auto-completare din BD + ANAF)
    numeClient: proiect.Client || '',
    cuiClient: '',
    nrRegComClient: '',
    adresaClient: proiect.Adresa || '',
    emailClient: '',
    telefonClient: '',
    
    // Setări factură
    rataTVA: '19', // 19% default
    observatii: ''
  });

  const [liniiFactura, setLiniiFactura] = useState<LinieFactura[]>([
    {
      id: '1',
      descriere: proiect.Denumire || '',
      cantitate: 1,
      pretUnitarFaraTVA: proiect.Valoare_Estimata || 0,
      totalFaraTVA: proiect.Valoare_Estimata || 0
    }
  ]);

  // Încărcare subproiecte la deschiderea modalului
  useEffect(() => {
    loadSubproiecte();
    loadClientFromDB();
  }, [proiect.ID_Proiect]);

  const loadSubproiecte = async () => {
    setLoadingSubproiecte(true);
    try {
      const response = await fetch(`/api/rapoarte/subproiecte?proiect_id=${encodeURIComponent(proiect.ID_Proiect)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setSubproiecte(result.subproiecte || []);
        console.log('Subproiecte încărcate:', result.subproiecte);
      } else {
        console.warn('Nu s-au putut încărca subproiectele:', result.error);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor:', error);
      // Nu afișăm toast error pentru că subproiectele sunt opționale
    } finally {
      setLoadingSubproiecte(false);
    }
  };

  const loadClientFromDB = async () => {
    try {
      const response = await fetch(`/api/rapoarte/clienti?search=${encodeURIComponent(proiect.Client)}`);
      
      if (!response.ok) return;

      const result = await response.json();
      
      if (result.success && result.clienti && result.clienti.length > 0) {
        const client = result.clienti[0];
        setClientBD(client);
        
        // Auto-completare date client din BD
        setFormData(prev => ({
          ...prev,
          cuiClient: client.cui || '',
          nrRegComClient: client.nr_reg_com || '',
          adresaClient: client.adresa || prev.adresaClient,
          emailClient: client.email || '',
          telefonClient: client.telefon || ''
        }));

        toast.success('📊 Date client preluate din baza de date!', {
          duration: 3000,
          icon: '🔗'
        });
      }
    } catch (error) {
      console.error('Eroare la căutarea clientului în BD:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLinieChange = (id: string, field: keyof LinieFactura, value: string | number) => {
    setLiniiFactura(prev => prev.map(linie => {
      if (linie.id === id) {
        const updatedLinie = { ...linie, [field]: value };
        
        // Recalculare total pentru linia curentă
        if (field === 'cantitate' || field === 'pretUnitarFaraTVA') {
          updatedLinie.totalFaraTVA = Number(updatedLinie.cantitate) * Number(updatedLinie.pretUnitarFaraTVA);
        }
        
        return updatedLinie;
      }
      return linie;
    }));
  };

  const addLinie = () => {
    const newId = (liniiFactura.length + 1).toString();
    setLiniiFactura(prev => [...prev, {
      id: newId,
      descriere: '',
      cantitate: 1,
      pretUnitarFaraTVA: 0,
      totalFaraTVA: 0
    }]);
  };

  const removeLinie = (id: string) => {
    if (liniiFactura.length > 1) {
      setLiniiFactura(prev => prev.filter(linie => linie.id !== id));
    }
  };

  const addSubproiectToFactura = (subproiect: Subproiect) => {
    const newId = `sub_${subproiect.ID_Subproiect}`;
    
    // Verificăm dacă subproiectul nu e deja adăugat
    const existingLinie = liniiFactura.find(linie => linie.id === newId);
    if (existingLinie) {
      toast.error('Subproiectul este deja adăugat în factură!');
      return;
    }

    const newLinie: LinieFactura = {
      id: newId,
      descriere: `Subproiect: ${subproiect.Denumire}`,
      cantitate: 1,
      pretUnitarFaraTVA: subproiect.Valoare_Estimata || 0,
      totalFaraTVA: subproiect.Valoare_Estimata || 0
    };

    setLiniiFactura(prev => [...prev, newLinie]);
    toast.success(`Subproiectul "${subproiect.Denumire}" a fost adăugat în factură!`);
  };

  const validateANAF = async () => {
    if (!formData.cuiClient) {
      toast.error('Introduceți CUI-ul pentru validare ANAF');
      return;
    }

    setLoadingANAF(true);
    try {
      const response = await fetch('/api/anaf/company-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cui: formData.cuiClient }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const anafData = result.data;
        
        setFormData(prev => ({
          ...prev,
          numeClient: anafData.denumire || prev.numeClient,
          nrRegComClient: anafData.nrRegCom || prev.nrRegComClient,
          adresaClient: anafData.adresa || prev.adresaClient
        }));

        toast.success('✅ Date validate și completate din ANAF!');
      } else {
        toast.error('Nu s-au găsit date în ANAF pentru acest CUI');
      }
    } catch (error) {
      console.error('Eroare ANAF:', error);
      toast.error('Eroare la validarea cu ANAF');
    } finally {
      setLoadingANAF(false);
    }
  };

  // Calculare totale
  const subtotal = liniiFactura.reduce((sum, linie) => sum + Number(linie.totalFaraTVA), 0);
  const rataTVANumber = Number(formData.rataTVA);
  const totalTVA = subtotal * (rataTVANumber / 100);
  const total = subtotal + totalTVA;

  const generateInvoice = async () => {
    // Validări
    if (!formData.numarFactura.trim()) {
      toast.error('Numărul facturii este obligatoriu');
      return;
    }

    if (!formData.numeClient.trim() || !formData.cuiClient.trim()) {
      toast.error('Numele și CUI-ul clientului sunt obligatorii');
      return;
    }

    if (liniiFactura.some(linie => !linie.descriere.trim())) {
      toast.error('Toate liniile trebuie să aibă o descriere');
      return;
    }

    setLoading(true);
    try {
      const facturaData = {
        // Date proiect
        proiect: {
          id: proiect.ID_Proiect,
          denumire: proiect.Denumire,
          client: proiect.Client
        },
        
        // Date factură
        numarFactura: formData.numarFactura,
        dataFactura: formData.dataFactura,
        
        // Date client
        client: {
          nume: formData.numeClient,
          cui: formData.cuiClient,
          nrRegCom: formData.nrRegComClient,
          adresa: formData.adresaClient,
          email: formData.emailClient,
          telefon: formData.telefonClient,
          id: clientBD?.id || null
        },
        
        // Linii factură
        linii: liniiFactura,
        
        // Totale
        subtotal,
        rataTVA: rataTVANumber,
        totalTVA,
        total,
        
        // Observații
        observatii: formData.observatii
      };

      console.log('Generare factură cu datele:', facturaData);

      const response = await fetch('/api/actions/invoices/generate-hibrid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(facturaData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      
      // Download PDF
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factura_${formData.numarFactura.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('📄 Factura PDF a fost generată și descărcată!');
      onSuccess();

    } catch (error) {
      console.error('Eroare la generarea facturii:', error);
      toast.error(`Eroare la generarea facturii: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              <FileText className="w-5 h-5 inline mr-2" />
              Generare Factură Hibridă
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Proiect: {proiect.Denumire}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Secțiune 1: Date Factură */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-4 text-gray-900">📋 Date Factură</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Număr Factură *
                </label>
                <input
                  type="text"
                  name="numarFactura"
                  value={formData.numarFactura}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ex: 2025-001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Factură *
                </label>
                <input
                  type="date"
                  name="dataFactura"
                  value={formData.dataFactura}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rată TVA
                </label>
                <select
                  name="rataTVA"
                  value={formData.rataTVA}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="19">19%</option>
                  <option value="21">21%</option>
                  <option value="9">9%</option>
                  <option value="5">5%</option>
                  <option value="0">0%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Secțiunea 2: Date Client */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                <Building2 className="w-5 h-5 inline mr-2" />
                Date Client
                {clientBD && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Din BD</span>}
              </h3>
              <button
                onClick={validateANAF}
                disabled={loadingANAF || !formData.cuiClient}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Search className="w-4 h-4" />
                {loadingANAF ? 'Validez...' : 'Validare ANAF'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nume Client *
                </label>
                <input
                  type="text"
                  name="numeClient"
                  value={formData.numeClient}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CUI *
                </label>
                <input
                  type="text"
                  name="cuiClient"
                  value={formData.cuiClient}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ex: RO12345678"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nr. Reg. Com.
                </label>
                <input
                  type="text"
                  name="nrRegComClient"
                  value={formData.nrRegComClient}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Adresă
                </label>
                <input
                  type="text"
                  name="adresaClient"
                  value={formData.adresaClient}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="emailClient"
                  value={formData.emailClient}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  name="telefonClient"
                  value={formData.telefonClient}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Secțiunea 3: Subproiecte Disponibile */}
          {subproiecte.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  <Users className="w-5 h-5 inline mr-2" />
                  Subproiecte Disponibile
                </h3>
                {loadingSubproiecte && (
                  <span className="text-sm text-gray-500">Se încarcă...</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subproiecte.map((subproiect) => {
                  const isAdded = liniiFactura.some(linie => linie.id === `sub_${subproiect.ID_Subproiect}`);
                  
                  return (
                    <div
                      key={subproiect.ID_Subproiect}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        isAdded 
                          ? 'border-green-300 bg-green-100' 
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-gray-900 mb-1">
                            {subproiect.Denumire}
                          </h4>
                          <p className="text-xs text-gray-600 mb-2">
                            Valoare: {subproiect.Valoare_Estimata?.toLocaleString('ro-RO')} LEI
                          </p>
                          <p className="text-xs text-gray-500">
                            Status: {subproiect.Status}
                          </p>
                        </div>
                        <button
                          onClick={() => addSubproiectToFactura(subproiect)}
                          disabled={isAdded}
                          className={`ml-2 p-1 rounded transition-colors ${
                            isAdded
                              ? 'text-green-600 cursor-not-allowed'
                              : 'text-blue-600 hover:bg-blue-100'
                          }`}
                          title={isAdded ? 'Deja adăugat' : 'Adaugă în factură'}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Secțiunea 4: Linii Factură */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                <Calculator className="w-5 h-5 inline mr-2" />
                Linii Factură
              </h3>
              <button
                onClick={addLinie}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Adaugă Linie
              </button>
            </div>

            <div className="space-y-3">
              {liniiFactura.map((linie, index) => (
                <div key={linie.id} className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded border">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={linie.descriere}
                      onChange={(e) => handleLinieChange(linie.id, 'descriere', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Descriere serviciu..."
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={linie.cantitate}
                      onChange={(e) => handleLinieChange(linie.id, 'cantitate', Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={linie.pretUnitarFaraTVA}
                      onChange={(e) => handleLinieChange(linie.id, 'pretUnitarFaraTVA', Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={linie.totalFaraTVA.toFixed(2)}
                      readOnly
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-gray-50"
                    />
                  </div>
                  <div className="col-span-1">
                    {liniiFactura.length > 1 && (
                      <button
                        onClick={() => removeLinie(linie.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Șterge linia"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Headers pentru linii */}
            <div className="grid grid-cols-12 gap-2 mt-2 text-xs font-medium text-gray-600">
              <div className="col-span-5">Descriere</div>
              <div className="col-span-2">Cantitate</div>
              <div className="col-span-2">Preț Unit (fără TVA)</div>
              <div className="col-span-2">Total (fără TVA)</div>
              <div className="col-span-1">Acțiuni</div>
            </div>
          </div>

          {/* Secțiunea 5: Totale */}
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Subtotal (fără TVA)</p>
                <p className="text-lg font-semibold">{subtotal.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} LEI</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">TVA ({rataTVANumber}%)</p>
                <p className="text-lg font-semibold">{totalTVA.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} LEI</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-xl font-bold text-blue-600">{total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} LEI</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Linii factură</p>
                <p className="text-lg font-semibold">{liniiFactura.length}</p>
              </div>
            </div>
          </div>

          {/* Secțiunea 6: Observații */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observații
            </label>
            <textarea
              name="observatii"
              value={formData.observatii}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Observații suplimentare pentru factură..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={loading}
            >
              Anulează
            </button>
            <button
              onClick={generateInvoice}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading}
            >
              <FileText className="w-4 h-4" />
              {loading ? 'Generez PDF...' : 'Generează Factură PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
