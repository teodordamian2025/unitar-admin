// app/admin/rapoarte/proiecte/components/ProiectActions.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, FileText, Eye, Edit2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import FacturaHibridModal from './FacturaHibridModal';
import ProiectNouModal from './ProiectNouModal';
import { useRouter } from 'next/navigation';

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

interface ProiectActionsProps {
  proiect: Proiect;
  onRefresh: () => void;
  isSubproiect?: boolean;
}

export default function ProiectActions({ proiect, onRefresh, isSubproiect = false }: ProiectActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFacturaModalOpen, setIsFacturaModalOpen] = useState(false);
  const [isSubproiectModalOpen, setIsSubproiectModalOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Calculează poziția dropdown-ului
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Dacă nu avem suficient spațiu jos (< 200px), afișează sus
      if (spaceBelow < 200 && spaceAbove > 200) {
        setDropdownPosition('top');
      } else {
        setDropdownPosition('bottom');
      }
    }
  }, [isOpen]);

  const handleVeziDetalii = () => {
    console.log('Detalii proiect:', proiect);
    
    // Formatează datele pentru afișare
    const formatDate = (dateObj: { value: string }) => {
      try {
        return new Date(dateObj.value).toLocaleDateString('ro-RO');
      } catch {
        return 'N/A';
      }
    };

    const detalii = `
🏗️ DETALII PROIECT

📋 Denumire: ${proiect.Denumire}
🏢 Client: ${proiect.Client}
📊 Status: ${proiect.Status}
💰 Valoare Estimată: ${proiect.Valoare_Estimata?.toLocaleString('ro-RO')} LEI
📅 Data Start: ${formatDate(proiect.Data_Start)}
📅 Data Final: ${formatDate(proiect.Data_Final)}
👤 Responsabil: ${proiect.Responsabil || 'Neatribuit'}
📍 Adresă: ${proiect.Adresa || 'Nespecificată'}
📝 Observații: ${proiect.Observatii || 'Fără observații'}
    `.trim();

    toast.success(detalii, {
      duration: 8000,
      style: {
        background: '#f8fafc',
        color: '#1e293b',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '12px',
        whiteSpace: 'pre-line',
        maxWidth: '500px',
        padding: '16px'
      }
    });
    
    setIsOpen(false);
  };

  const handleEditeaza = () => {
    console.log('Date pentru editare:', proiect);
    
    try {
      // Creează URL-ul pentru editare
      const editUrl = `/admin/rapoarte/proiecte/${encodeURIComponent(proiect.ID_Proiect)}/edit`;
      console.log('Ar trebui să redirectionez la:', editUrl);
      
      // Pentru moment, afișăm un modal de confirmare
      const confirmare = confirm(`Vrei să editezi proiectul "${proiect.Denumire}"?\n\nNOTĂ: Funcția de editare va fi implementată în următoarea versiune.`);
      
      if (confirmare) {
        // Aici va fi implementată logica de editare
        toast.success('Funcția de editare va fi disponibilă în curând!', {
          duration: 3000,
          icon: '⚡'
        });
      }
      
    } catch (error) {
      console.error('Eroare la editare:', error);
      toast.error('Eroare la încărcarea editorului');
    }
    
    setIsOpen(false);
  };

  const handleGenerareFactura = () => {
    console.log('Generare factură pentru:', proiect);
    setIsFacturaModalOpen(true);
    setIsOpen(false);
  };

  const handleAdaugaSubproiect = () => {
    console.log('Adaugă subproiect pentru:', proiect);
    setIsSubproiectModalOpen(true);
    setIsOpen(false);
  };

  const handleSterge = async () => {
    const confirmare = confirm(`Ești sigur că vrei să ștergi ${isSubproiect ? 'subproiectul' : 'proiectul'}: "${proiect.Denumire}"?`);
    
    if (!confirmare) return;

    try {
      const endpoint = isSubproiect ? '/api/rapoarte/subproiecte' : '/api/rapoarte/proiecte';
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: proiect.ID_Proiect }),
      });

      if (!response.ok) {
        throw new Error(`Eroare HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(`${isSubproiect ? 'Subproiectul' : 'Proiectul'} a fost șters cu succes!`);
        onRefresh();
      } else {
        throw new Error(result.error || 'Eroare la ștergere');
      }
    } catch (error) {
      console.error('Eroare la ștergere:', error);
      toast.error(`Eroare la ștergerea ${isSubproiect ? 'subproiectului' : 'proiectului'}`);
    }
    
    setIsOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Acțiuni"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isOpen && (
          <>
            {/* Overlay pentru a închide dropdown-ul */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown menu */}
            <div 
              className={`absolute right-0 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 ${
                dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
              }`}
            >
              <button
                onClick={handleVeziDetalii}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Vezi Detalii
              </button>

              <button
                onClick={handleEditeaza}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Editează
              </button>

              <hr className="my-1" />

              <button
                onClick={handleGenerareFactura}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Generare Factură
              </button>

              {/* Adaugă Subproiect doar pentru proiecte principale */}
              {!isSubproiect && (
                <button
                  onClick={handleAdaugaSubproiect}
                  className="w-full px-4 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adaugă Subproiect
                </button>
              )}

              <hr className="my-1" />

              <button
                onClick={handleSterge}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Șterge {isSubproiect ? 'Subproiect' : 'Proiect'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal Factură Hibridă */}
      {isFacturaModalOpen && (
        <FacturaHibridModal
          proiect={proiect}
          onClose={() => setIsFacturaModalOpen(false)}
          onSuccess={() => {
            setIsFacturaModalOpen(false);
            onRefresh();
          }}
        />
      )}

      {/* Modal Subproiect Nou - FIX PENTRU EROAREA REACT #31 */}
      {isSubproiectModalOpen && (
        <ProiectNouModal
          isOpen={isSubproiectModalOpen}
          onClose={() => setIsSubproiectModalOpen(false)}
          onSuccess={() => {
            setIsSubproiectModalOpen(false);
            onRefresh();
          }}
          proiectParinte={proiect}
          isSubproiect={true}
        />
      )}
    </>
  );
}
