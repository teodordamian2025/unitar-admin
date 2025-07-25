// app/admin/rapoarte/proiecte/components/ProiectNouModal.tsx
'use client';

import { useState } from 'react';
import { X, Calendar, User, MapPin, FileText, DollarSign } from 'lucide-react';
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

interface ProiectNouModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  proiectParinte?: Proiect;
  isSubproiect?: boolean;
}

export default function ProiectNouModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  proiectParinte, 
  isSubproiect = false 
}: ProiectNouModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    denumire: '',
    client: proiectParinte?.Client || '',
    status: 'Planificat',
    valoareEstimata: '',
    dataStart: '',
    dataFinal: '',
    responsabil: '',
    adresa: proiectParinte?.Adresa || '',
    observatii: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.denumire.trim()) {
      errors.push('Denumirea este obligatorie');
    }

    if (!formData.client.trim()) {
      errors.push('Clientul este obligatoriu');
    }

    if (!formData.dataStart) {
      errors.push('Data de start este obligatorie');
    }

    if (!formData.dataFinal) {
      errors.push('Data finală este obligatorie');
    }

    if (formData.dataStart && formData.dataFinal && new Date(formData.dataStart) > new Date(formData.dataFinal)) {
      errors.push('Data de start nu poate fi după data finală');
    }

    if (formData.valoareEstimata && isNaN(Number(formData.valoareEstimata))) {
      errors.push('Valoarea estimată trebuie să fie un număr valid');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(errors.join('\n'));
      return;
    }

    setLoading(true);

    try {
      // Pregătim datele pentru API - FIX PENTRU NULL VALUES
      const dataToSend = {
        denumire: formData.denumire.trim(),
        client: formData.client.trim(),
        status: formData.status,
        valoare_estimata: formData.valoareEstimata ? Number(formData.valoareEstimata) : 0,
        data_start: formData.dataStart,
        data_final: formData.dataFinal,
        responsabil: formData.responsabil.trim() || null, // Explicit null pentru empty strings
        adresa: formData.adresa.trim() || null, // Explicit null pentru empty strings
        observatii: formData.observatii.trim() || null, // Explicit null pentru empty strings
        // Pentru subproiecte
        ...(isSubproiect && proiectParinte && {
          id_proiect_parinte: proiectParinte.ID_Proiect
        })
      };

      console.log('Trimitere date:', dataToSend);

      const endpoint = isSubproiect ? '/api/rapoarte/subproiecte' : '/api/rapoarte/proiecte';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Response error text:', errorText);
        throw new Error(`Eroare HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Response data proiect:', result);

      if (result.success) {
        toast.success(`${isSubproiect ? 'Subproiectul' : 'Proiectul'} a fost adăugat cu succes!`);
        
        // Reset form
        setFormData({
          denumire: '',
          client: proiectParinte?.Client || '',
          status: 'Planificat',
          valoareEstimata: '',
          dataStart: '',
          dataFinal: '',
          responsabil: '',
          adresa: proiectParinte?.Adresa || '',
          observatii: ''
        });
        
        onSuccess();
      } else {
        throw new Error(result.error || `Eroare la adăugarea ${isSubproiect ? 'subproiectului' : 'proiectului'}`);
      }

    } catch (error) {
      console.error('Eroare la submit:', error);
      toast.error(`Eroare la adăugarea ${isSubproiect ? 'subproiectului' : 'proiectului'}: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isSubproiect ? `Adaugă Subproiect pentru "${proiectParinte?.Denumire}"` : 'Adaugă Proiect Nou'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Denumire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Denumire {isSubproiect ? 'Subproiect' : 'Proiect'} *
            </label>
            <input
              type="text"
              name="denumire"
              value={formData.denumire}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`Introduceți denumirea ${isSubproiect ? 'subproiectului' : 'proiectului'}...`}
              required
            />
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Client *
            </label>
            <input
              type="text"
              name="client"
              value={formData.client}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Introduceți numele clientului..."
              required
            />
          </div>

          {/* Row cu Status și Valoare */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Planificat">Planificat</option>
                <option value="In progres">În progres</option>
                <option value="Suspendat">Suspendat</option>
                <option value="Finalizat">Finalizat</option>
                <option value="Anulat">Anulat</option>
              </select>
            </div>

            {/* Valoare Estimată */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Valoare Estimată (LEI)
              </label>
              <input
                type="number"
                name="valoareEstimata"
                value={formData.valoareEstimata}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Row cu Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Start *
              </label>
              <input
                type="date"
                name="dataStart"
                value={formData.dataStart}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Finală *
              </label>
              <input
                type="date"
                name="dataFinal"
                value={formData.dataFinal}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Responsabil */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Responsabil
            </label>
            <input
              type="text"
              name="responsabil"
              value={formData.responsabil}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nume responsabil..."
            />
          </div>

          {/* Adresa Proiect */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Adresa {isSubproiect ? 'Subproiect' : 'Proiect'}
            </label>
            <input
              type="text"
              name="adresa"
              value={formData.adresa}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Adresa unde se desfășoară lucrările..."
            />
          </div>

          {/* Observatii */}
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
              placeholder="Observații suplimentare..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={loading}
            >
              Anulează
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Se adaugă...' : `Adaugă ${isSubproiect ? 'Subproiect' : 'Proiect'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
