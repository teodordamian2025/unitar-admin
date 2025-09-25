// ==================================================================
// CALEA: app/components/user/ObjectiveSelector.tsx
// DATA: 25.09.2025 18:00 (ora României)
// DESCRIERE: Selector ierarhic pentru obiective time tracking (Proiect/Subproiect/Sarcină)
// FUNCȚIONALITATE: Permite alegerea nivelului și obiectivului pentru înregistrarea timpului
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
// Folosim iconuri simple din HTML entities în loc de Heroicons
const FolderIcon = ({ className }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center`}>📂</div>
);
const DocumentTextIcon = ({ className }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center`}>📋</div>
);
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center`}>✅</div>
);

interface Objective {
  id: string;
  nume: string;
  status?: string;
  data_start?: any;
  data_final?: any;
  prioritate?: string;
  data_scadenta?: any;
  subproiecte?: Objective[];
  sarcini?: Objective[];
}

interface ObjectivesData {
  proiecte: Objective[];
}

interface SelectedObjective {
  tip: 'proiect' | 'subproiect' | 'sarcina';
  proiect_id: string;
  proiect_nume: string;
  subproiect_id?: string;
  subproiect_nume?: string;
  sarcina_id?: string;
  sarcina_nume?: string;
}

interface ObjectiveSelectorProps {
  userId: string;
  onSelectionChange: (objective: SelectedObjective | null) => void;
  className?: string;
}

const ObjectiveSelector: React.FC<ObjectiveSelectorProps> = ({
  userId,
  onSelectionChange,
  className = ''
}) => {
  const [objectives, setObjectives] = useState<ObjectivesData>({ proiecte: [] });
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<'proiect' | 'subproiect' | 'sarcina'>('proiect');
  const [selectedProiect, setSelectedProiect] = useState<string>('');
  const [selectedSubproiect, setSelectedSubproiect] = useState<string>('');
  const [selectedSarcina, setSelectedSarcina] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<string>('');

  // Încarcă obiectivele din API
  useEffect(() => {
    const fetchObjectives = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/user/objectives?user_id=${userId}`);
        const data = await response.json();

        if (data.success) {
          setObjectives(data.objectives);
        }
      } catch (error) {
        console.error('Eroare la încărcarea obiectivelor:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchObjectives();
    }
  }, [userId]);

  // Resetează selecțiile când se schimbă nivelul
  useEffect(() => {
    setSelectedProiect('');
    setSelectedSubproiect('');
    setSelectedSarcina('');
    onSelectionChange(null);
  }, [selectedLevel]);

  // Actualizează selecția finală
  useEffect(() => {
    if (!selectedProiect) {
      onSelectionChange(null);
      return;
    }

    const proiect = objectives.proiecte.find(p => p.id === selectedProiect);
    if (!proiect) return;

    let finalSelection: SelectedObjective = {
      tip: selectedLevel,
      proiect_id: selectedProiect,
      proiect_nume: proiect.nume
    };

    if (selectedLevel === 'subproiect' && selectedSubproiect) {
      const subproiect = proiect.subproiecte?.find(sp => sp.id === selectedSubproiect);
      if (subproiect) {
        finalSelection.subproiect_id = selectedSubproiect;
        finalSelection.subproiect_nume = subproiect.nume;
      }
    } else if (selectedLevel === 'sarcina' && selectedSarcina) {
      let sarcina: Objective | undefined;
      let parentSubproiect: Objective | undefined;

      // Caută sarcina în proiect direct sau în subproiecte
      sarcina = proiect.sarcini?.find(s => s.id === selectedSarcina);
      if (!sarcina && proiect.subproiecte) {
        for (const sp of proiect.subproiecte) {
          sarcina = sp.sarcini?.find(s => s.id === selectedSarcina);
          if (sarcina) {
            parentSubproiect = sp;
            break;
          }
        }
      }

      if (sarcina) {
        finalSelection.sarcina_id = selectedSarcina;
        finalSelection.sarcina_nume = sarcina.nume;
        if (parentSubproiect) {
          finalSelection.subproiect_id = parentSubproiect.id;
          finalSelection.subproiect_nume = parentSubproiect.nume;
        }
      }
    }

    onSelectionChange(finalSelection);
  }, [selectedProiect, selectedSubproiect, selectedSarcina, selectedLevel, objectives]);

  // Obține subproiectele pentru proiectul selectat
  const getSubproiecte = () => {
    if (!selectedProiect) return [];
    const proiect = objectives.proiecte.find(p => p.id === selectedProiect);
    return proiect?.subproiecte || [];
  };

  // Obține sarcinile pentru combinația selectată
  const getSarcini = () => {
    if (!selectedProiect) return [];

    const proiect = objectives.proiecte.find(p => p.id === selectedProiect);
    if (!proiect) return [];

    let allSarcini: Objective[] = [];

    // Sarcini direct din proiect
    if (proiect.sarcini) {
      allSarcini = [...allSarcini, ...proiect.sarcini];
    }

    // Sarcini din subproiecte
    if (proiect.subproiecte) {
      proiect.subproiecte.forEach(sp => {
        if (sp.sarcini) {
          allSarcini = [...allSarcini, ...sp.sarcini];
        }
      });
    }

    return allSarcini;
  };

  // Generează displayul contextului selectat
  const getContextDisplay = () => {
    const parts: string[] = [];

    if (selectedProiect) {
      const proiect = objectives.proiecte.find(p => p.id === selectedProiect);
      if (proiect) parts.push(`📂 ${proiect.nume}`);
    }

    if (selectedLevel !== 'proiect' && selectedSubproiect) {
      const subproiecte = getSubproiecte();
      const subproiect = subproiecte.find(sp => sp.id === selectedSubproiect);
      if (subproiect) parts.push(`📋 ${subproiect.nume}`);
    }

    if (selectedLevel === 'sarcina' && selectedSarcina) {
      const sarcini = getSarcini();
      const sarcina = sarcini.find(s => s.id === selectedSarcina);
      if (sarcina) parts.push(`✅ ${sarcina.nume}`);
    }

    return parts.join(' → ');
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-md rounded-xl border border-white/20 p-6 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-1/4"></div>
          <div className="h-10 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/70 backdrop-blur-md rounded-xl border border-white/20 p-6 shadow-lg space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <FolderIcon className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Alege obiectivul pentru timp</h3>
          <p className="text-sm text-gray-600">Selectează nivelul și obiectivul</p>
        </div>
      </div>

      {/* Level Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Nivel înregistrare:</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedLevel('proiect')}
            className={`p-3 rounded-lg border text-sm font-medium transition-all ${
              selectedLevel === 'proiect'
                ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                : 'bg-white/50 text-gray-700 border-gray-200 hover:bg-white/80'
            }`}
          >
            <FolderIcon className="h-4 w-4 mx-auto mb-1" />
            Proiect
          </button>
          <button
            onClick={() => setSelectedLevel('subproiect')}
            className={`p-3 rounded-lg border text-sm font-medium transition-all ${
              selectedLevel === 'subproiect'
                ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                : 'bg-white/50 text-gray-700 border-gray-200 hover:bg-white/80'
            }`}
          >
            <DocumentTextIcon className="h-4 w-4 mx-auto mb-1" />
            Subproiect
          </button>
          <button
            onClick={() => setSelectedLevel('sarcina')}
            className={`p-3 rounded-lg border text-sm font-medium transition-all ${
              selectedLevel === 'sarcina'
                ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                : 'bg-white/50 text-gray-700 border-gray-200 hover:bg-white/80'
            }`}
          >
            <CheckCircleIcon className="h-4 w-4 mx-auto mb-1" />
            Sarcină
          </button>
        </div>
      </div>

      {/* Proiect Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Proiect:</label>
        <div className="relative">
          <select
            value={selectedProiect}
            onChange={(e) => setSelectedProiect(e.target.value)}
            className="w-full p-3 bg-white/60 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Alege proiectul...</option>
            {objectives.proiecte.map((proiect) => (
              <option key={proiect.id} value={proiect.id}>
                {proiect.nume} {proiect.status && `(${proiect.status})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subproiect Selector */}
      {selectedLevel !== 'proiect' && selectedProiect && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Subproiect:</label>
          <div className="relative">
            <select
              value={selectedSubproiect}
              onChange={(e) => setSelectedSubproiect(e.target.value)}
              className="w-full p-3 bg-white/60 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Alege subproiectul...</option>
              {getSubproiecte().map((subproiect) => (
                <option key={subproiect.id} value={subproiect.id}>
                  {subproiect.nume} {subproiect.status && `(${subproiect.status})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Sarcină Selector */}
      {selectedLevel === 'sarcina' && selectedProiect && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Sarcină:</label>
          <div className="relative">
            <select
              value={selectedSarcina}
              onChange={(e) => setSelectedSarcina(e.target.value)}
              className="w-full p-3 bg-white/60 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Alege sarcina...</option>
              {getSarcini().map((sarcina) => (
                <option key={sarcina.id} value={sarcina.id}>
                  {sarcina.nume} {sarcina.prioritate && `[${sarcina.prioritate}]`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Context Display */}
      {getContextDisplay() && (
        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/50">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">Înregistrezi timp pentru:</span>
          </div>
          <p className="mt-1 text-blue-800">{getContextDisplay()}</p>
        </div>
      )}
    </div>
  );
};

export default ObjectiveSelector;