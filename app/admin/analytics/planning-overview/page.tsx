'use client';

// ==================================================================
// CALEA: app/admin/analytics/planning-overview/page.tsx
// DATA: 18.01.2026
// DESCRIERE: Pagină vizualizare planning toți utilizatorii
// FAZA 4 din GANTT_PLAN.md
// ==================================================================

import { useState, useEffect, useCallback } from 'react';
import ModernLayout from '@/app/components/ModernLayout';
import {
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Info,
  X
} from 'lucide-react';

interface Utilizator {
  uid: string;
  nume: string;
  email: string;
  rol: string;
  echipa?: string;
}

interface Planificare {
  id: string;
  proiect_id?: string;
  subproiect_id?: string;
  sarcina_id?: string;
  proiect_denumire?: string;
  subproiect_denumire?: string;
  sarcina_titlu?: string;
  ore_planificate: number;
  prioritate: string;
  observatii?: string;
  proiect_culoare?: string;
}

interface PlanningData {
  utilizatori: Utilizator[];
  planificariMap: Record<string, Record<string, Planificare[]>>;
  orePerZiPerUtilizator: Record<string, Record<string, number>>;
  alocareStatus: Record<string, Record<string, string>>;
  zile: string[];
  statistici: {
    total_utilizatori: number;
    total_planificari: number;
    zile_in_perioada: number;
    ore_totale_planificate: number;
  };
}

export default function PlanningOverviewPage() {
  // State pentru date
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State pentru filtre
  const [dataStart, setDataStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });
  const [dataEnd, setDataEnd] = useState(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay() + 7);
    return sunday.toISOString().split('T')[0];
  });
  const [proiectFilter, setProiectFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // State pentru detalii
  const [selectedCell, setSelectedCell] = useState<{
    uid: string;
    nume: string;
    data: string;
    planificari: Planificare[];
    ore: number;
  } | null>(null);

  // Funcție pentru încărcarea datelor
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        data_start: dataStart,
        data_end: dataEnd
      });

      if (proiectFilter) {
        params.append('proiect_id', proiectFilter);
      }

      const response = await fetch(`/api/analytics/planning-overview?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Eroare la încărcarea datelor');
      }

      setData(result.data);
    } catch (err) {
      console.error('Eroare:', err);
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  }, [dataStart, dataEnd, proiectFilter]);

  // Încarcă datele la mount și când se schimbă filtrele
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Funcții pentru navigare săptămână
  const goToPreviousWeek = () => {
    const start = new Date(dataStart);
    start.setDate(start.getDate() - 7);
    const end = new Date(dataEnd);
    end.setDate(end.getDate() - 7);
    setDataStart(start.toISOString().split('T')[0]);
    setDataEnd(end.toISOString().split('T')[0]);
  };

  const goToNextWeek = () => {
    const start = new Date(dataStart);
    start.setDate(start.getDate() + 7);
    const end = new Date(dataEnd);
    end.setDate(end.getDate() + 7);
    setDataStart(start.toISOString().split('T')[0]);
    setDataEnd(end.toISOString().split('T')[0]);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay() + 7);
    setDataStart(monday.toISOString().split('T')[0]);
    setDataEnd(sunday.toISOString().split('T')[0]);
  };

  // Funcție pentru formatarea datei
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
    return {
      day: days[date.getDay()],
      date: date.getDate(),
      month: date.toLocaleDateString('ro-RO', { month: 'short' }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: dateStr === new Date().toISOString().split('T')[0]
    };
  };

  // Funcție pentru culoarea statusului
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'supraalocat':
        return 'bg-red-500/30 border-red-500/50 text-red-300';
      case 'complet':
        return 'bg-green-500/30 border-green-500/50 text-green-300';
      case 'partial':
        return 'bg-yellow-500/30 border-yellow-500/50 text-yellow-300';
      default:
        return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  // Funcție pentru icon status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'supraalocat':
        return <AlertTriangle className="w-3 h-3" />;
      case 'complet':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'partial':
        return <Clock className="w-3 h-3" />;
      default:
        return <MinusCircle className="w-3 h-3" />;
    }
  };

  return (
    <ModernLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Planning Overview</h1>
              <p className="text-sm text-gray-400">
                Vizualizare alocări zilnice pentru toți utilizatorii
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
                showFilters
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtre
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Reîncarcă
            </button>
          </div>
        </div>

        {/* Filtre */}
        {showFilters && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Data start
                </label>
                <input
                  type="date"
                  value={dataStart}
                  onChange={(e) => setDataStart(e.target.value)}
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Data sfârșit
                </label>
                <input
                  type="date"
                  value={dataEnd}
                  onChange={(e) => setDataEnd(e.target.value)}
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Proiect (opțional)
                </label>
                <input
                  type="text"
                  value={proiectFilter}
                  onChange={(e) => setProiectFilter(e.target.value)}
                  placeholder="ID proiect..."
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigare săptămână */}
        <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span className="text-white font-medium">
              {new Date(dataStart).toLocaleDateString('ro-RO', {
                day: 'numeric',
                month: 'long'
              })}
              {' - '}
              {new Date(dataEnd).toLocaleDateString('ro-RO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
            <button
              onClick={goToCurrentWeek}
              className="px-3 py-1 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
            >
              Săptămâna curentă
            </button>
          </div>

          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Statistici */}
        {data && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">
                {data.statistici.total_utilizatori}
              </div>
              <div className="text-sm text-gray-400">Utilizatori activi</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">
                {data.statistici.total_planificari}
              </div>
              <div className="text-sm text-gray-400">Alocări în perioadă</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">
                {data.statistici.ore_totale_planificate.toFixed(1)}h
              </div>
              <div className="text-sm text-gray-400">Ore totale planificate</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">
                {data.statistici.zile_in_perioada}
              </div>
              <div className="text-sm text-gray-400">Zile în perioadă</div>
            </div>
          </div>
        )}

        {/* Legendă */}
        <div className="flex items-center gap-6 text-sm">
          <span className="text-gray-400">Legendă:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50" />
            <span className="text-gray-300">Supraalocat (&gt;8h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50" />
            <span className="text-gray-300">Complet (8h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500/50" />
            <span className="text-gray-300">Partial (&lt;8h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-500/10 border border-gray-500/20" />
            <span className="text-gray-300">Liber</span>
          </div>
        </div>

        {/* Conținut principal */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-300">{error}</p>
          </div>
        ) : data && data.utilizatori.length > 0 ? (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="sticky left-0 bg-[#1a1f36] px-4 py-3 text-left text-sm font-medium text-gray-400 min-w-[200px]">
                      Utilizator
                    </th>
                    {data.zile.map((zi) => {
                      const { day, date, month, isWeekend, isToday } = formatDate(zi);
                      return (
                        <th
                          key={zi}
                          className={`px-2 py-3 text-center text-sm font-medium min-w-[80px] ${
                            isToday
                              ? 'bg-blue-500/20 text-blue-300'
                              : isWeekend
                              ? 'bg-purple-500/10 text-purple-300'
                              : 'text-gray-400'
                          }`}
                        >
                          <div>{day}</div>
                          <div className="text-xs opacity-70">
                            {date} {month}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.utilizatori.map((user) => (
                    <tr
                      key={user.uid}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="sticky left-0 bg-[#1a1f36] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                            {user.nume?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">
                              {user.nume}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.rol}
                            </div>
                          </div>
                        </div>
                      </td>
                      {data.zile.map((zi) => {
                        const planificari =
                          data.planificariMap[user.uid]?.[zi] || [];
                        const ore =
                          data.orePerZiPerUtilizator[user.uid]?.[zi] || 0;
                        const status =
                          data.alocareStatus[user.uid]?.[zi] || 'liber';
                        const { isWeekend, isToday } = formatDate(zi);

                        return (
                          <td
                            key={zi}
                            className={`px-2 py-3 ${
                              isToday ? 'bg-blue-500/10' : ''
                            } ${isWeekend ? 'bg-purple-500/5' : ''}`}
                          >
                            <button
                              onClick={() =>
                                setSelectedCell({
                                  uid: user.uid,
                                  nume: user.nume,
                                  data: zi,
                                  planificari,
                                  ore
                                })
                              }
                              className={`w-full p-2 rounded-lg border transition-all hover:scale-105 ${getStatusColor(
                                status
                              )}`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {getStatusIcon(status)}
                                <span className="text-sm font-medium">
                                  {ore > 0 ? `${ore}h` : '-'}
                                </span>
                              </div>
                              {planificari.length > 0 && (
                                <div className="text-xs opacity-70 mt-1">
                                  {planificari.length} task
                                  {planificari.length > 1 ? '-uri' : ''}
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
            <Info className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">Nu există utilizatori sau planificări</p>
            <p className="text-sm text-gray-500 mt-2">
              Asigurați-vă că există utilizatori activi în sistem și că tabelul
              PlanificariZilnice_v2 a fost creat.
            </p>
          </div>
        )}

        {/* Modal detalii celulă */}
        {selectedCell && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1f36] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedCell.nume}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {new Date(selectedCell.data).toLocaleDateString('ro-RO', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {selectedCell.ore}h planificate
                    </div>
                    <div className="text-sm text-gray-400">
                      {selectedCell.ore > 8
                        ? 'Supraalocat!'
                        : selectedCell.ore === 8
                        ? 'Complet alocat'
                        : selectedCell.ore > 0
                        ? `${8 - selectedCell.ore}h disponibile`
                        : 'Fără alocări'}
                    </div>
                  </div>
                </div>

                {selectedCell.planificari.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-400">
                      Alocări ({selectedCell.planificari.length})
                    </h4>
                    {selectedCell.planificari.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-white/5 border border-white/10 rounded-lg"
                        style={{
                          borderLeftColor: p.proiect_culoare || '#60A5FA',
                          borderLeftWidth: '3px'
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            {p.proiect_denumire && (
                              <div className="text-sm font-medium text-white">
                                {p.proiect_denumire}
                              </div>
                            )}
                            {p.subproiect_denumire && (
                              <div className="text-xs text-blue-400">
                                → {p.subproiect_denumire}
                              </div>
                            )}
                            {p.sarcina_titlu && (
                              <div className="text-xs text-purple-400">
                                → {p.sarcina_titlu}
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {p.ore_planificate}h
                          </div>
                        </div>
                        {p.observatii && (
                          <p className="text-xs text-gray-400 mt-2">
                            {p.observatii}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              p.prioritate === 'urgenta'
                                ? 'bg-red-500/20 text-red-300'
                                : p.prioritate === 'ridicata'
                                ? 'bg-orange-500/20 text-orange-300'
                                : 'bg-gray-500/20 text-gray-300'
                            }`}
                          >
                            {p.prioritate}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <MinusCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nu există alocări pentru această zi</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}
