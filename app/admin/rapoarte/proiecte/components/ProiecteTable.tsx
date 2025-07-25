// app/admin/rapoarte/proiecte/components/ProiecteTable.tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Building2, Users, Download, RefreshCw, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ProiectActions from './ProiectActions';
import * as XLSX from 'xlsx';

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
  Observatii?: string;
}

interface ProiecteTableProps {
  searchParams: { [k: string]: any };
}

export default function ProiecteTable({ searchParams }: ProiecteTableProps) {
  const [loading, setLoading] = useState(true);
  const [proiecte, setProiecte] = useState<Proiect[]>([]);
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loadingRefresh, setLoadingRefresh] = useState(false);

  // Extrage valorile din searchParams
  const searchTerm = searchParams?.search || '';
  const statusFilter = searchParams?.status || '';
  const clientFilter = searchParams?.client || '';

  useEffect(() => {
    loadData();
  }, [searchTerm, statusFilter, clientFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadProiecte(), loadSubproiecte()]);
    } catch (error) {
      console.error('Eroare la încărcarea datelor:', error);
      toast.error('Eroare la încărcarea datelor');
    } finally {
      setLoading(false);
    }
  };

  const loadProiecte = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/rapoarte/proiecte?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setProiecte(result.proiecte || []);
      } else {
        throw new Error(result.error || 'Eroare la încărcarea proiectelor');
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
      throw error;
    }
  };

  const loadSubproiecte = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/rapoarte/subproiecte?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setSubproiecte(result.subproiecte || []);
      } else {
        console.warn('Eroare la încărcarea subproiectelor:', result.error);
        setSubproiecte([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea subproiectelor:', error);
      setSubproiecte([]);
    }
  };

  const handleRefresh = async () => {
    setLoadingRefresh(true);
    try {
      await loadData();
      toast.success('Date actualizate!');
    } catch (error) {
      console.error('Eroare la refresh:', error);
      toast.error('Eroare la actualizarea datelor');
    } finally {
      setLoadingRefresh(false);
    }
  };

  const toggleProjectExpansion = (proiectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(proiectId)) {
        newSet.delete(proiectId);
      } else {
        newSet.add(proiectId);
      }
      return newSet;
    });
  };

  const getSubproiecteForProject = (proiectId: string): Subproiect[] => {
    return subproiecte.filter(sub => sub.ID_Proiect === proiectId);
  };

  const formatDate = (dateObj: { value: string }) => {
    try {
      return new Date(dateObj.value).toLocaleDateString('ro-RO');
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount: number) => {
    return amount?.toLocaleString('ro-RO', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }) + ' LEI';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Planificat': 'bg-blue-100 text-blue-800',
      'In progres': 'bg-yellow-100 text-yellow-800',
      'Suspendat': 'bg-red-100 text-red-800',
      'Finalizat': 'bg-green-100 text-green-800',
      'Anulat': 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig[status as keyof typeof statusConfig] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  // Filtrare proiecte
  const filteredProiecte = proiecte.filter(proiect => {
    if (statusFilter && proiect.Status !== statusFilter) return false;
    if (clientFilter && !proiect.Client.toLowerCase().includes(clientFilter.toLowerCase())) return false;
    return true;
  });

  const exportToExcel = () => {
    try {
      const exportData: any[] = [];

      filteredProiecte.forEach(proiect => {
        // Adaugă proiectul principal
        exportData.push({
          'Tip': 'Proiect',
          'ID': proiect.ID_Proiect,
          'Denumire': proiect.Denumire,
          'Client': proiect.Client,
          'Status': proiect.Status,
          'Valoare Estimată (LEI)': proiect.Valoare_Estimata || 0,
          'Data Start': formatDate(proiect.Data_Start),
          'Data Final': formatDate(proiect.Data_Final),
          'Responsabil': proiect.Responsabil || 'Neatribuit',
          'Adresă': proiect.Adresa || 'Nespecificată'
        });

        // Adaugă subproiectele
        const subproiecteProiect = getSubproiecteForProject(proiect.ID_Proiect);
        subproiecteProiect.forEach(subproiect => {
          exportData.push({
            'Tip': 'Subproiect',
            'ID': subproiect.ID_Subproiect,
            'Denumire': `  → ${subproiect.Denumire}`,
            'Client': subproiect.Client,
            'Status': subproiect.Status,
            'Valoare Estimată (LEI)': subproiect.Valoare_Estimata || 0,
            'Data Start': formatDate(subproiect.Data_Start),
            'Data Final': formatDate(subproiect.Data_Final),
            'Responsabil': subproiect.Responsabil || 'Neatribuit',
            'Adresă': subproiect.Adresa || 'Nespecificată'
          });
        });
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Setare lățimi coloane
      const colWidths = [
        { wch: 12 }, // Tip
        { wch: 25 }, // ID
        { wch: 40 }, // Denumire
        { wch: 20 }, // Client
        { wch: 12 }, // Status
        { wch: 15 }, // Valoare
        { wch: 12 }, // Data Start
        { wch: 12 }, // Data Final
        { wch: 15 }, // Responsabil
        { wch: 30 }  // Adresă
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Proiecte & Subproiecte');

      const filename = `Proiecte_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success('📊 Export Excel realizat cu succes!');
    } catch (error) {
      console.error('Eroare la export:', error);
      toast.error('Eroare la exportul Excel');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Se încarcă proiectele...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header cu acțiuni */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-medium text-gray-900">
              <Building2 className="w-5 h-5 inline mr-2" />
              Proiecte & Subproiecte
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{filteredProiecte.length} proiecte</span>
              <span>•</span>
              <span>{subproiecte.length} subproiecte</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loadingRefresh}
              className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              title="Actualizează datele"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRefresh ? 'animate-spin' : ''}`} />
              Actualizează
            </button>
            
            <button
              onClick={exportToExcel}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1"
              title="Export Excel"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proiect / Subproiect
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valoare Estimată
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Perioada
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Responsabil
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProiecte.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  Nu s-au găsit proiecte care să corespundă filtrelor aplicaţe.
                </td>
              </tr>
            ) : (
              filteredProiecte.map((proiect) => {
                const subproiecteProiect = getSubproiecteForProject(proiect.ID_Proiect);
                const isExpanded = expandedProjects.has(proiect.ID_Proiect);
                const hasSubprojects = subproiecteProiect.length > 0;

                return (
                  <>
                    {/* Rândul proiectului principal */}
                    <tr key={proiect.ID_Proiect} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {hasSubprojects && (
                            <button
                              onClick={() => toggleProjectExpansion(proiect.ID_Proiect)}
                              className="mr-2 p-1 rounded hover:bg-gray-200 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-blue-600" />
                              <p className="text-sm font-medium text-gray-900">
                                {proiect.Denumire}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              ID: {proiect.ID_Proiect}
                            </p>
                            {hasSubprojects && (
                              <p className="text-xs text-blue-600 mt-1">
                                {subproiecteProiect.length} subproiect{subproiecteProiect.length !== 1 ? 'e' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{proiect.Client}</p>
                        {proiect.Adresa && (
                          <p className="text-xs text-gray-500 mt-1">{proiect.Adresa}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(proiect.Status)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(proiect.Valoare_Estimata || 0)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">
                          {formatDate(proiect.Data_Start)}
                        </p>
                        <p className="text-xs text-gray-500">
                          → {formatDate(proiect.Data_Final)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">
                          {proiect.Responsabil || 'Neatribuit'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ProiectActions
                          proiect={proiect}
                          onRefresh={loadData}
                          isSubproiect={false}
                        />
                      </td>
                    </tr>

                    {/* Rândurile subproiectelor (dacă sunt expandate) */}
                    {isExpanded && subproiecteProiect.map((subproiect) => (
                      <tr 
                        key={subproiect.ID_Subproiect} 
                        className="bg-blue-25 hover:bg-blue-50 transition-colors border-l-4 border-blue-200"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center ml-8">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Users className="w-3 h-3 text-blue-500" />
                                <p className="text-sm text-gray-800">
                                  {subproiect.Denumire}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                ID: {subproiect.ID_Subproiect}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-gray-700">{subproiect.Client}</p>
                          {subproiect.Adresa && (
                            <p className="text-xs text-gray-500 mt-1">{subproiect.Adresa}</p>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {getStatusBadge(subproiect.Status)}
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm font-medium text-gray-800">
                            {formatCurrency(subproiect.Valoare_Estimata || 0)}
                          </p>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-gray-800">
                            {formatDate(subproiect.Data_Start)}
                          </p>
                          <p className="text-xs text-gray-500">
                            → {formatDate(subproiect.Data_Final)}
                          </p>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-gray-800">
                            {subproiect.Responsabil || 'Neatribuit'}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <ProiectActions
                            proiect={{
                              ID_Proiect: subproiect.ID_Subproiect,
                              Denumire: subproiect.Denumire,
                              Client: subproiect.Client,
                              Status: subproiect.Status,
                              Valoare_Estimata: subproiect.Valoare_Estimata,
                              Data_Start: subproiect.Data_Start,
                              Data_Final: subproiect.Data_Final,
                              Responsabil: subproiect.Responsabil,
                              Adresa: subproiect.Adresa,
                              Observatii: subproiect.Observatii
                            }}
                            onRefresh={loadData}
                            isSubproiect={true}
                          />
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer cu statistici */}
      {filteredProiecte.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Total Proiecte</p>
              <p className="text-lg font-semibold text-gray-900">{filteredProiecte.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Subproiecte</p>
              <p className="text-lg font-semibold text-blue-600">{subproiecte.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valoare Totală Proiecte</p>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(filteredProiecte.reduce((sum, p) => sum + (p.Valoare_Estimata || 0), 0))}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valoare Totală Subproiecte</p>
              <p className="text-lg font-semibold text-purple-600">
                {formatCurrency(subproiecte.reduce((sum, s) => sum + (s.Valoare_Estimata || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
