// ==================================================================
// CALEA: app/admin/tranzactii/dashboard/page.tsx
// DATA: 19.09.2025 23:35 (ora României) - Updated 10.19.2025 for grid layout fix
// DESCRIERE: Dashboard modern tranzacții cu glassmorphism și real-time
// FUNCȚIONALITATE: Management tranzacții bancare cu auto-matching și filtrare avansată
// LAYOUT: Stats 4-column grid, Filters 5-column grid, Quick filters inline
// ==================================================================

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, Modal, Input, Alert, LoadingSpinner } from '@/app/components/ui';
import { LiveMetrics } from '@/app/components/realtime';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ManualMatchingModal from './components/ManualMatchingModal';

// ==================================================================
// TIPURI TYPESCRIPT
// ==================================================================

interface DashboardStats {
  totalTransactions: number;
  totalIncasari: number;
  totalPlati: number;
  sumaIncasari: number;
  sumaPlati: number;
  soldTotal: number;
  matchingRate: number;
  avgConfidence: number;
  pendingMatches: number;
  needsReview: number;
}

interface TranzactieDetail {
  id: string;
  data_procesare: string;
  suma: number;
  directie: string;
  tip_categorie: string;
  nume_contrapartida: string;
  cui_contrapartida: string;
  detalii_tranzactie: string;
  status: string;
  matching_tip: string;
  matching_confidence: number;
  matched_target_type?: string;
  matched_target_id?: string;
  matched_confidence?: number;
  matched_details?: any;
  badge_color?: string;
  confidence_label?: string;
}

interface FilterState {
  data_start: string;
  data_end: string;
  directie: string;
  status: string;
  matching_tip: string;
  min_confidence: string;
  search_contrapartida: string;
  min_suma: string;
  max_suma: string;
}

interface PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

// ==================================================================
// COMPONENTE MODERNE
// ==================================================================

const ModernStatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: string;
  trend?: string;
  onClick?: () => void;
}> = ({ title, value, subtitle, icon, color, trend, onClick }) => (
  <Card
    variant="default"
    className={`p-6 cursor-pointer transition-all duration-300 hover:scale-105 ${color}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="text-4xl opacity-80">{icon}</div>
    </div>
    {trend && (
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">{trend}</p>
      </div>
    )}
  </Card>
);

const ModernFilterPanel: React.FC<{
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onReset: () => void;
  onApply: () => void;
  isLoading: boolean;
}> = ({ filters, onFiltersChange, onReset, onApply, isLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card variant="default" className="p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          🔍 Filtrare Avansată
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '📄 Comprimă' : '📋 Extinde'}
        </Button>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Filtre principale pe un singur rând - 5 coloane egale */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.75rem' }}>
            <Input
              type="date"
              label="Data start"
              value={filters.data_start}
              onChange={(e) => updateFilter('data_start', e.target.value)}
            />
            <Input
              type="date"
              label="Data end"
              value={filters.data_end}
              onChange={(e) => updateFilter('data_end', e.target.value)}
            />
            <Input
              type="number"
              label="Confidence min (%)"
              value={filters.min_confidence}
              onChange={(e) => updateFilter('min_confidence', e.target.value)}
              placeholder="0-100"
            />
            <Input
              type="number"
              label="Sumă min (RON)"
              value={filters.min_suma}
              onChange={(e) => updateFilter('min_suma', e.target.value)}
              placeholder="0.00"
            />
            <Input
              type="number"
              label="Sumă max (RON)"
              value={filters.max_suma}
              onChange={(e) => updateFilter('max_suma', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Direcție
              </label>
              <select
                value={filters.directie}
                onChange={(e) => updateFilter('directie', e.target.value)}
                className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              >
                <option value="">Toate</option>
                <option value="in">📈 Încasări</option>
                <option value="out">📉 Plăți</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              >
                <option value="">Toate</option>
                <option value="nou">🆕 Nou</option>
                <option value="matched">✅ Matched</option>
                <option value="partial">🟡 Parțial</option>
                <option value="complet">🟢 Complet</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tip Matching
              </label>
              <select
                value={filters.matching_tip}
                onChange={(e) => updateFilter('matching_tip', e.target.value)}
                className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              >
                <option value="">Toate</option>
                <option value="none">❌ Fără match</option>
                <option value="auto">🤖 Automat</option>
                <option value="manual">👤 Manual</option>
              </select>
            </div>
            <Input
              type="text"
              label="Căutare contrapartidă"
              value={filters.search_contrapartida}
              onChange={(e) => updateFilter('search_contrapartida', e.target.value)}
              placeholder="Nume, CUI, detalii..."
            />
          </div>

          {/* Butoane acțiuni */}
          <div className="flex items-center gap-4 pt-2 border-t border-white/20">
            <Button
              variant="primary"
              onClick={onApply}
              disabled={isLoading}
              loading={isLoading}
            >
              🔍 Aplicare Filtre
            </Button>
            <Button
              variant="secondary"
              onClick={onReset}
            >
              🗑️ Reset Filtre
            </Button>
          </div>
        </div>
      )}

      {/* Quick filters când e comprimat - Forțat pe un singur rând */}
      {!isExpanded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'nowrap', overflowX: 'auto' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = { ...filters, matching_tip: 'none' };
              onFiltersChange(newFilters);
              setTimeout(() => onApply(), 50);
            }}
            className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 whitespace-nowrap"
          >
            ❌ Fără match
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = { ...filters, directie: 'in' };
              onFiltersChange(newFilters);
              setTimeout(() => onApply(), 50);
            }}
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 whitespace-nowrap"
          >
            📈 Încasări
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = { ...filters, directie: 'out' };
              onFiltersChange(newFilters);
              setTimeout(() => onApply(), 50);
            }}
            className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 whitespace-nowrap"
          >
            📉 Plăți
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = { ...filters, status: 'nou' };
              onFiltersChange(newFilters);
              setTimeout(() => onApply(), 50);
            }}
            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 whitespace-nowrap"
          >
            🆕 Noi
          </Button>
        </div>
      )}
    </Card>
  );
};

const ModernTransactionTable: React.FC<{
  transactions: TranzactieDetail[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onShowDetails: (transaction: TranzactieDetail) => void;
  onManualMatch: (transaction: TranzactieDetail) => void;
}> = ({ transactions, selectedIds, onSelectionChange, onShowDetails, onManualMatch }) => {
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === transactions.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(transactions.map(t => t.id)));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  const formatDate = (dateStr: string | any) => {
    let actualDate = dateStr;
    if (typeof dateStr === 'object' && dateStr !== null && 'value' in dateStr) {
      actualDate = dateStr.value;
    }

    if (!actualDate) return 'N/A';

    return new Date(actualDate).toLocaleDateString('ro-RO');
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <Card variant="default" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-white/20">
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={transactions.length > 0 && selectedIds.size === transactions.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Data
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Sumă
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Contrapartidă
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Detalii
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Status
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Matching
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => {
              // Case-insensitive check pentru directie
              const isIncasare = transaction.directie?.toLowerCase() === 'in' ||
                                 transaction.suma > 0;

              return (
                <tr
                  key={transaction.id}
                  style={{
                    backgroundColor: isIncasare
                      ? 'rgba(240, 253, 244, 0.3)'  // green-50 with 30% opacity
                      : 'rgba(254, 242, 242, 0.3)', // red-50 with 30% opacity
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isIncasare
                      ? 'rgba(240, 253, 244, 0.5)'  // green-50 with 50% opacity (hover)
                      : 'rgba(254, 242, 242, 0.5)'; // red-50 with 50% opacity (hover)
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isIncasare
                      ? 'rgba(240, 253, 244, 0.3)'
                      : 'rgba(254, 242, 242, 0.3)';
                  }}
                >
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(transaction.id)}
                    onChange={() => toggleSelection(transaction.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {formatDate(transaction.data_procesare)}
                </td>
                <td className="px-6 py-4">
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: isIncasare ? '#059669' : '#dc2626' // green-600 / red-600
                    }}
                  >
                    {isIncasare ? '+' : ''}{formatCurrency(transaction.suma)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{transaction.tip_categorie}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {truncateText(transaction.nume_contrapartida || 'N/A', 25)}
                  </div>
                  {transaction.cui_contrapartida && (
                    <div className="text-xs text-gray-500 mt-1">CUI: {transaction.cui_contrapartida}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <div title={transaction.detalii_tranzactie}>
                    {truncateText(transaction.detalii_tranzactie, 40)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    transaction.status === 'complet' ? 'bg-green-100 text-green-800' :
                    transaction.status === 'matched' ? 'bg-blue-100 text-blue-800' :
                    transaction.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {transaction.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {transaction.matching_tip !== 'none' && transaction.matching_confidence > 0 ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {transaction.matching_tip === 'auto' ? '🤖' : '👤'}
                        </span>
                        <span className="font-semibold text-blue-600">
                          {transaction.matching_confidence}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {transaction.confidence_label}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Fără match</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onShowDetails(transaction)}
                    >
                      👁️ Detalii
                    </Button>
                    {(transaction.matching_tip === 'none' || !transaction.matching_tip) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onManualMatch(transaction)}
                        className="text-green-600 hover:text-green-800"
                      >
                        🔧 Match
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nu există tranzacții</h3>
          <p className="text-gray-500">Încearcă să modifici filtrele sau să imporți noi tranzacții.</p>
        </div>
      )}
    </Card>
  );
};

// ==================================================================
// COMPONENTA PRINCIPALĂ
// ==================================================================

const ModernTranzactiiDashboard: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<TranzactieDetail[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    limit: 25
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TranzactieDetail | null>(null);
  const [isManualMatchingOpen, setIsManualMatchingOpen] = useState(false);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);

  // Starea filtrelor
  const [filters, setFilters] = useState<FilterState>({
    data_start: '',
    data_end: '',
    directie: '',
    status: '',
    matching_tip: '',
    min_confidence: '',
    search_contrapartida: '',
    min_suma: '',
    max_suma: ''
  });

  // ==================================================================
  // AUTHENTICATION
  // ==================================================================

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(localStorage.getItem('displayName') || 'Utilizator');
    setUserRole(localStorage.getItem('userRole') || 'user');
  }, [user, loading, router]);

  // ==================================================================
  // DATA LOADING
  // ==================================================================

  const loadDashboardData = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await fetch(`/api/tranzactii/dashboard?${params}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setTransactions(data.transactions || []);
        setPagination(data.pagination || pagination);
        setSelectedIds(new Set());
      } else {
        toast.error(data.error || 'Eroare la încărcarea datelor');
      }
    } catch (error) {
      console.error('❌ Eroare loading dashboard:', error);
      toast.error('Eroare la încărcarea dashboard-ului');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.limit]);

  const loadAvailableBalance = useCallback(async () => {
    try {
      const response = await fetch('/api/tranzactii/smartfintech/balance');
      const data = await response.json();

      if (data.success && data.balance) {
        setAvailableBalance(data.balance.total);
      } else {
        console.warn('⚠️ Sold disponibil nu poate fi încărcat:', data.error);
        setAvailableBalance(null);
      }
    } catch (error) {
      console.error('❌ Eroare loading available balance:', error);
      setAvailableBalance(null);
    }
  }, []);

  // ==================================================================
  // HANDLERS
  // ==================================================================

  const handleFiltersApply = () => {
    loadDashboardData(1);
  };

  const handleFiltersReset = () => {
    setFilters({
      data_start: '',
      data_end: '',
      directie: '',
      status: '',
      matching_tip: '',
      min_confidence: '',
      search_contrapartida: '',
      min_suma: '',
      max_suma: ''
    });
    setTimeout(() => loadDashboardData(1), 100);
  };

  const handleBulkOperation = async (action: string, newStatus?: string) => {
    if (selectedIds.size === 0) {
      toast.error('Selectează cel puțin o tranzacție');
      return;
    }

    try {
      const response = await fetch('/api/tranzactii/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          transaction_ids: Array.from(selectedIds),
          new_status: newStatus
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${result.updatedCount} tranzacții actualizate`);
        loadDashboardData(pagination.currentPage);
      } else {
        toast.error(result.error || 'Eroare la operațiunea bulk');
      }
    } catch (error) {
      toast.error('Eroare la executarea operațiunii');
    }
  };

  const handleAutoMatch = async () => {
    try {
      const response = await fetch('/api/tranzactii/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_confidence: 70 })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${result.stats.matchesApplied} matching-uri aplicate!`);
        loadDashboardData(pagination.currentPage);
      } else {
        toast.error(result.error || 'Eroare auto-matching');
      }
    } catch (error) {
      toast.error('Eroare la auto-matching');
    }
  };

  // ==================================================================
  // EFFECTS
  // ==================================================================

  useEffect(() => {
    if (user) {
      loadDashboardData(1);
      loadAvailableBalance();
    }
  }, [user, loadDashboardData, loadAvailableBalance]);

  // ==================================================================
  // COMPUTED VALUES
  // ==================================================================

  const statsCards = useMemo(() => {
    if (!stats) return [];

    const cards = [
      {
        title: 'Total Tranzacții',
        value: stats.totalTransactions.toLocaleString('ro-RO'),
        subtitle: `${stats.totalIncasari} încasări, ${stats.totalPlati} plăți`,
        icon: '📊',
        color: 'border-l-4 border-blue-500',
        trend: `${stats.matchingRate}% matched automat`
      },
      {
        title: 'Sold Total',
        value: new Intl.NumberFormat('ro-RO', {
          style: 'currency',
          currency: 'RON'
        }).format(stats.soldTotal),
        subtitle: stats.soldTotal >= 0 ? 'Pozitiv' : 'Negativ',
        icon: stats.soldTotal >= 0 ? '💰' : '📉',
        color: `border-l-4 ${stats.soldTotal >= 0 ? 'border-green-500' : 'border-red-500'}`,
        trend: `${new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(stats.sumaIncasari)} încasări`
      },
      {
        title: 'Matching Rate',
        value: `${stats.matchingRate}%`,
        subtitle: `Confidence medie: ${stats.avgConfidence}%`,
        icon: '🎯',
        color: 'border-l-4 border-purple-500',
        trend: `${stats.pendingMatches} pending review`
      },
      {
        title: 'Necesită Atenție',
        value: stats.needsReview,
        subtitle: `${stats.pendingMatches} cu confidence > 60%`,
        icon: '⚠️',
        color: 'border-l-4 border-yellow-500',
        trend: 'Review manual necesar'
      }
    ];

    // Adaugă cardul Sold Disponibil dacă există date
    if (availableBalance !== null) {
      cards.push({
        title: 'Sold Disponibil',
        value: new Intl.NumberFormat('ro-RO', {
          style: 'currency',
          currency: 'RON'
        }).format(availableBalance),
        subtitle: 'În conturi bancare',
        icon: '🏦',
        color: 'border-l-4 border-teal-500',
        trend: 'Smart Fintech API'
      });
    }

    return cards;
  }, [stats, availableBalance]);

  if (loading) {
    return <LoadingSpinner overlay />;
  }

  if (!user) {
    return null;
  }

  // ==================================================================
  // RENDER
  // ==================================================================

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              💳 Financial Hub
            </h1>
            <p className="text-gray-600 text-lg">
              Management și reconciliation tranzacții bancare cu auto-matching inteligent
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="primary"
              onClick={() => router.push('/admin/tranzactii/import')}
            >
              📤 Import CSV
            </Button>
            <Button
              variant="success"
              onClick={handleAutoMatch}
            >
              🤖 Auto-Match
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards - Grid dinamic (4 sau 5 coloane în funcție de sold disponibil) */}
      {stats && (
        <div
          className="gap-6 mb-8"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${statsCards.length}, minmax(0, 1fr))`,
            gap: '1.5rem',
            marginBottom: '2rem'
          }}
        >
          {statsCards.map((card, index) => (
            <ModernStatCard key={index} {...card} />
          ))}
        </div>
      )}

      {/* Filters */}
      <ModernFilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleFiltersReset}
        onApply={handleFiltersApply}
        isLoading={isLoading}
      />

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card variant="info" className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedIds.size} tranzacții selectate
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkOperation('remove_matches')}
                className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              >
                🗑️ Elimină Match-uri
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkOperation('mark_review')}
                className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
              >
                ⚠️ Marchează Review
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkOperation('update_status', 'complet')}
                className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              >
                ✅ Marchează Complet
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Transaction Table */}
      <ModernTransactionTable
        transactions={transactions}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onShowDetails={setSelectedTransaction}
        onManualMatch={(transaction) => {
          setSelectedTransaction(transaction);
          setIsManualMatchingOpen(true);
        }}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Card variant="default" className="mt-6 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Afișare <span className="font-medium">{(pagination.currentPage - 1) * pagination.limit + 1}</span> până la{' '}
              <span className="font-medium">{Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}</span> din{' '}
              <span className="font-medium">{pagination.totalCount}</span> rezultate
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDashboardData(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
              >
                ← Anterior
              </Button>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
                {pagination.currentPage} din {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDashboardData(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                Următorul →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading Overlay */}
      {isLoading && <LoadingSpinner overlay />}

      {/* Manual Matching Modal */}
      <ManualMatchingModal
        isOpen={isManualMatchingOpen}
        onClose={() => {
          setIsManualMatchingOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        onMatchApplied={() => {
          loadDashboardData(pagination.currentPage);
          setIsManualMatchingOpen(false);
          setSelectedTransaction(null);
        }}
      />

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <Modal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          title="📄 Detalii Tranzacție"
          size="xl"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data:</label>
                <p className="text-lg">{new Date(selectedTransaction.data_procesare).toLocaleDateString('ro-RO')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sumă:</label>
                <p className={`text-lg font-semibold ${selectedTransaction.directie === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                  {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(selectedTransaction.suma)}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contrapartidă:</label>
              <p className="text-lg">{selectedTransaction.nume_contrapartida || 'N/A'}</p>
              {selectedTransaction.cui_contrapartida && (
                <p className="text-sm text-gray-500 mt-1">CUI: {selectedTransaction.cui_contrapartida}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Detalii tranzacție:</label>
              <div className="bg-gray-50 p-4 rounded-xl text-sm">
                {selectedTransaction.detalii_tranzactie || 'N/A'}
              </div>
            </div>

            {selectedTransaction.matched_details && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Matching details:</label>
                <pre className="bg-gray-50 p-4 rounded-xl text-xs overflow-x-auto">
                  {JSON.stringify(selectedTransaction.matched_details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </ModernLayout>
  );
};

export default ModernTranzactiiDashboard;