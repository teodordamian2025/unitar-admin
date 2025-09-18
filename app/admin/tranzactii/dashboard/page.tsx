// =================================================================
// DASHBOARD PRINCIPAL TRANZACTII CU FILTRARE SI MANAGEMENT
// Generat: 18 septembrie 2025, 00:10 (Romania)
// Cale: app/admin/tranzactii/dashboard/page.tsx
// =================================================================

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import ManualMatchingModal from './components/ManualMatchingModal';

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================

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

// =================================================================
// COMPONENTE HELPER
// =================================================================

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: string;
  trend?: string;
}> = ({ title, value, subtitle, icon, color, trend }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-6 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="text-3xl">{icon}</div>
    </div>
    {trend && (
      <div className="mt-2 text-xs text-gray-500">
        {trend}
      </div>
    )}
  </div>
);

const FilterPanel: React.FC<{
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
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🔍 Filtrare</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {isExpanded ? '▲ Comprimă' : '▼ Extinde'}
        </button>
      </div>

      <div className={`space-y-4 ${isExpanded ? 'block' : 'hidden'}`}>
        {/* Prima linie - Date și Direcție */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data start
            </label>
            <input
              type="date"
              value={filters.data_start}
              onChange={(e) => updateFilter('data_start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data end
            </label>
            <input
              type="date"
              value={filters.data_end}
              onChange={(e) => updateFilter('data_end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direcție
            </label>
            <select
              value={filters.directie}
              onChange={(e) => updateFilter('directie', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toate</option>
              <option value="in">📈 Încasări</option>
              <option value="out">📉 Plăți</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toate</option>
              <option value="nou">🆕 Nou</option>
              <option value="matched">✅ Matched</option>
              <option value="partial">🟡 Parțial</option>
              <option value="complet">🟢 Complet</option>
            </select>
          </div>
        </div>

        {/* A doua linie - Matching și Confidence */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tip Matching
            </label>
            <select
              value={filters.matching_tip}
              onChange={(e) => updateFilter('matching_tip', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toate</option>
              <option value="none">❌ Fără match</option>
              <option value="auto">🤖 Automat</option>
              <option value="manual">👤 Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confidence min (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.min_confidence}
              onChange={(e) => updateFilter('min_confidence', e.target.value)}
              placeholder="0-100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sumă min (RON)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.min_suma}
              onChange={(e) => updateFilter('min_suma', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sumă max (RON)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.max_suma}
              onChange={(e) => updateFilter('max_suma', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* A treia linie - Căutare */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Căutare contrapartidă
            </label>
            <input
              type="text"
              value={filters.search_contrapartida}
              onChange={(e) => updateFilter('search_contrapartida', e.target.value)}
              placeholder="Nume companie, CUI, sau cuvinte din detalii..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Butoane */}
        <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
          <button
            onClick={onApply}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            {isLoading ? '🔄' : '🔍'} Aplicare Filtre
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            🗑️ Reset
          </button>
        </div>
      </div>

      {/* Quick filters când e comprimat */}
      {!isExpanded && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              onFiltersChange({ ...filters, matching_tip: 'none' });
              onApply();
            }}
            className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200 transition-colors"
          >
            ❌ Fără match
          </button>
          <button
            onClick={() => {
              onFiltersChange({ ...filters, directie: 'in' });
              onApply();
            }}
            className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200 transition-colors"
          >
            📈 Încasări
          </button>
          <button
            onClick={() => {
              onFiltersChange({ ...filters, directie: 'out' });
              onApply();
            }}
            className="inline-flex items-center px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm hover:bg-orange-200 transition-colors"
          >
            📉 Plăți
          </button>
        </div>
      )}
    </div>
  );
};

const TransactionTable: React.FC<{
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
	  // Procesează formatul BigQuery DATE field
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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={transactions.length > 0 && selectedIds.size === transactions.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sumă
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contrapartidă
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detalii
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Matching
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(transaction.id)}
                    onChange={() => toggleSelection(transaction.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {formatDate(transaction.data_procesare)}
                </td>
                <td className="px-4 py-4 text-sm">
                  <span className={`font-medium ${
                    transaction.directie === 'in' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.directie === 'in' ? '+' : ''}{formatCurrency(transaction.suma)}
                  </span>
                  <div className="text-xs text-gray-500">{transaction.tip_categorie}</div>
                </td>
                <td className="px-4 py-4 text-sm">
                  <div className="font-medium text-gray-900">
                    {truncateText(transaction.nume_contrapartida || 'N/A', 25)}
                  </div>
                  {transaction.cui_contrapartida && (
                    <div className="text-xs text-gray-500">CUI: {transaction.cui_contrapartida}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  <div title={transaction.detalii_tranzactie}>
                    {truncateText(transaction.detalii_tranzactie, 40)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    transaction.badge_color || 'bg-gray-100 text-gray-800'
                  }`}>
                    {transaction.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm">
                  {transaction.matching_tip !== 'none' && transaction.matching_confidence > 0 ? (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">
                          {transaction.matching_tip === 'auto' ? '🤖' : '👤'}
                        </span>
                        <span className="font-medium">{transaction.matching_confidence}%</span>
                      </div>
                      <div className="text-xs text-gray-500">{transaction.confidence_label}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Fără match</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onShowDetails(transaction)}
                      className="text-blue-600 hover:text-blue-800 text-xs hover:underline"
                    >
                      👁️ Detalii
                    </button>
                    {(transaction.matching_tip === 'none' || !transaction.matching_tip) && (
                      <button
                        onClick={() => onManualMatch(transaction)}
                        className="text-green-600 hover:text-green-800 text-xs hover:underline"
                      >
                        🔧 Match Manual
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nu există tranzacții</h3>
          <p className="text-gray-500">Încearcă să modifici filtrele sau să imporți noi tranzacții.</p>
        </div>
      )}
    </div>
  );
};

const Pagination: React.FC<{
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}> = ({ pagination, onPageChange }) => {
  const { currentPage, totalPages, totalCount, limit } = pagination;

  const getVisiblePages = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
        >
          Următorul
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Afișare <span className="font-medium">{(currentPage - 1) * limit + 1}</span> până la{' '}
            <span className="font-medium">{Math.min(currentPage * limit, totalCount)}</span> din{' '}
            <span className="font-medium">{totalCount}</span> rezultate
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
            >
              ←
            </button>
            {getVisiblePages().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === 'number' ? onPageChange(page) : undefined}
                disabled={typeof page !== 'number'}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  page === currentPage
                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                    : typeof page === 'number'
                    ? 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    : 'bg-white border-gray-300 text-gray-300 cursor-default'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
            >
              →
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

// =================================================================
// COMPONENTA PRINCIPALĂ
// =================================================================

const TranzactiiDashboard: React.FC = () => {
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

  // =================================================================
  // DATA LOADING
  // =================================================================

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
        setSelectedIds(new Set()); // Reset selection
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

  // =================================================================
  // HANDLERS
  // =================================================================

  const handleFiltersApply = () => {
    loadDashboardData(1); // Reset to page 1 when applying filters
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
    // Auto-apply after reset
    setTimeout(() => loadDashboardData(1), 100);
  };

  const handlePageChange = (page: number) => {
    loadDashboardData(page);
  };

  const handleBulkOperation = async (action: string, newStatus?: string) => {
    if (selectedIds.size === 0) {
      toast.error('Selectează cel puțin o tranzacție');
      return;
    }

    const toastId = toast.loading(`Se execută operațiunea ${action}...`);
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
        toast.success(`${result.updatedCount} tranzacții actualizate`, { id: toastId });
        loadDashboardData(pagination.currentPage); // Reload current page
      } else {
        toast.error(result.error || 'Eroare la operațiunea bulk', { id: toastId });
      }
    } catch (error) {
      toast.error('Eroare la executarea operațiunii', { id: toastId });
    }
  };

  const handleAutoMatch = async () => {
    const toastId = toast.loading('Se rulează auto-matching...');
    try {
      const response = await fetch('/api/tranzactii/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_confidence: 70 })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`${result.stats.matchesApplied} matching-uri aplicate!`, { id: toastId });
        loadDashboardData(pagination.currentPage); // Reload data
      } else {
        toast.error(result.error || 'Eroare auto-matching', { id: toastId });
      }
    } catch (error) {
      toast.error('Eroare la auto-matching', { id: toastId });
    }
  };

  // =================================================================
  // EFFECTS
  // =================================================================

  useEffect(() => {
    loadDashboardData(1);
  }, []); // Load on mount

  // =================================================================
  // COMPUTED VALUES
  // =================================================================

  const statsCards = useMemo(() => {
    if (!stats) return [];

    return [
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
  }, [stats]);

  // =================================================================
  // RENDER
  // =================================================================

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                💳 Dashboard Tranzacții
              </h1>
              <p className="mt-2 text-gray-600">
                Management și reconciliation tranzacții bancare
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/admin/tranzactii/import"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📤 Import CSV
              </a>
              <button
                onClick={handleAutoMatch}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🤖 Auto-Match
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statsCards.map((card, index) => (
              <StatCard key={index} {...card} />
            ))}
          </div>
        )}

        {/* Filters */}
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleFiltersReset}
          onApply={handleFiltersApply}
          isLoading={isLoading}
        />

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                {selectedIds.size} tranzacții selectate
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkOperation('remove_matches')}
                  className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors text-sm"
                >
                  🗑️ Elimină Match-uri
                </button>
                <button
                  onClick={() => handleBulkOperation('mark_review')}
                  className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors text-sm"
                >
                  ⚠️ Marchează Review
                </button>
                <button
                  onClick={() => handleBulkOperation('update_status', 'complet')}
                  className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors text-sm"
                >
                  ✅ Marchează Complet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Table */}
        <TransactionTable
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
        <Pagination
          pagination={pagination}
          onPageChange={handlePageChange}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center gap-4">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-lg font-medium text-gray-900">Se încarcă...</span>
            </div>
          </div>
        )}

        {/* Manual Matching Modal */}
        <ManualMatchingModal
          isOpen={isManualMatchingOpen}
          onClose={() => {
            setIsManualMatchingOpen(false);
            setSelectedTransaction(null);
          }}
          transaction={selectedTransaction}
          onMatchApplied={() => {
            loadDashboardData(pagination.currentPage); // Refresh data
            setIsManualMatchingOpen(false);
            setSelectedTransaction(null);
          }}
        />

        {/* Transaction Details Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    📄 Detalii Tranzacție
                  </h3>
                  <button
                    onClick={() => setSelectedTransaction(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-medium text-gray-700">Data:</label>
                      <p>{new Date(selectedTransaction.data_procesare).toLocaleDateString('ro-RO')}</p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Sumă:</label>
                      <p className={selectedTransaction.directie === 'in' ? 'text-green-600' : 'text-red-600'}>
                        {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(selectedTransaction.suma)}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="font-medium text-gray-700">Contrapartidă:</label>
                    <p>{selectedTransaction.nume_contrapartida || 'N/A'}</p>
                    {selectedTransaction.cui_contrapartida && (
                      <p className="text-gray-500">CUI: {selectedTransaction.cui_contrapartida}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="font-medium text-gray-700">Detalii tranzacție:</label>
                    <p className="bg-gray-50 p-2 rounded text-xs">{selectedTransaction.detalii_tranzactie || 'N/A'}</p>
                  </div>
                  
                  {selectedTransaction.matched_details && (
                    <div>
                      <label className="font-medium text-gray-700">Matching details:</label>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedTransaction.matched_details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranzactiiDashboard;
