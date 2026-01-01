'use client';

// =================================================================
// PAGINĂ ADMIN: Propuneri Plăți Automate
// Locație: /admin/financiar/propuneri-plati
// Generat: 2026-01-01
// =================================================================

import React, { useState, useEffect, useCallback } from 'react';
import ModernLayout from '@/app/components/ModernLayout';
import { toast } from 'react-hot-toast';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  Filter,
  ArrowRight,
  Loader2,
  CheckCheck,
  Info,
  FileText,
  Wallet,
  Building2
} from 'lucide-react';

interface PropunerePlata {
  id: string;
  tranzactie_id: string;
  target_type: 'factura_primita' | 'cheltuiala';
  factura_primita_id: string | null;
  cheltuiala_id: string | null;
  cheltuiala_asociata_din_factura: string | null;
  score: number;
  auto_approvable: boolean;
  suma_plata: number;
  suma_target: number;
  suma_target_cu_tva: number | null;
  diferenta_ron: number | null;
  diferenta_procent: number | null;
  matching_algorithm: string | null;
  referinta_gasita: string | null;
  matching_details: any;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  furnizor_cui: string | null;
  furnizor_nume: string | null;
  factura_serie_numar: string | null;
  proiect_id: string | null;
  proiect_denumire: string | null;
  subproiect_id: string | null;
  subproiect_denumire: string | null;
  cheltuiala_descriere: string | null;
  tranzactie_data: string | null;
  tranzactie_contrapartida: string | null;
  tranzactie_cui: string | null;
  tranzactie_detalii: string | null;
  data_creare: string;
  is_valid: boolean;
}

interface Stats {
  total: number;
  pending: number;
  auto_approvable: number;
  review_needed: number;
  approved: number;
  rejected: number;
  expired: number;
}

export default function PropuneriPlatiPage() {
  const [propuneri, setPropuneri] = useState<PropunerePlata[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Filtre
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [autoOnlyFilter, setAutoOnlyFilter] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch propuneri
  const fetchPropuneri = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (autoOnlyFilter) params.set('auto_only', 'true');
      params.set('limit', '100');

      const res = await fetch(`/api/plati/propuneri?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setPropuneri(data.propuneri || []);
        setStats(data.stats);
      } else {
        setError(data.error || 'Eroare la încărcarea propunerilor');
      }
    } catch (err: any) {
      setError(err.message || 'Eroare de rețea');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, autoOnlyFilter]);

  useEffect(() => {
    fetchPropuneri();
  }, [fetchPropuneri]);

  // Generare propuneri noi
  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);

      const res = await fetch('/api/plati/propuneri/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dry_run: false,
          send_notification: false
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`${data.propuneri_generate} propuneri generate!\n• Auto-aprobabile: ${data.propuneri_auto_approvable}\n• Necesită review: ${data.propuneri_review}`);
        fetchPropuneri();
      } else {
        setError(data.error || 'Eroare la generare');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Aprobare toate auto-aprobabile
  const handleApproveAll = async () => {
    if (!confirm('Sigur doriți să aprobați toate propunerile auto-aprobabile?')) return;

    try {
      setApprovingAll(true);
      setError(null);

      const res = await fetch('/api/plati/propuneri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_all',
          user_id: 'admin',
          user_name: 'Admin'
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`${data.approved} propuneri aprobate!`);
        fetchPropuneri();
      } else {
        setError(data.error || 'Eroare la aprobare');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApprovingAll(false);
    }
  };

  // Aprobare individuală
  const handleApprove = async (id: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(id));

      const res = await fetch('/api/plati/propuneri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          propunere_id: id,
          user_id: 'admin',
          user_name: 'Admin'
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Propunere aprobată!');
        fetchPropuneri();
      } else {
        toast.error(`Eroare: ${data.error || data.errors?.join(', ')}`);
      }
    } catch (err: any) {
      toast.error(`Eroare: ${err.message}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Respingere
  const handleReject = async (id: string) => {
    const motiv = prompt('Motivul respingerii (opțional):');
    if (motiv === null) return; // Cancelled

    try {
      setProcessingIds(prev => new Set(prev).add(id));

      const res = await fetch('/api/plati/propuneri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          propunere_id: id,
          motiv_respingere: motiv || 'Respins de admin',
          user_id: 'admin',
          user_name: 'Admin'
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Propunere respinsă');
        fetchPropuneri();
      } else {
        toast.error(`Eroare: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Eroare: ${err.message}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Badge scor
  const getScoreBadge = (score: number) => {
    if (score >= 95) return { bg: 'bg-green-100', text: 'text-green-800', label: 'Excelent' };
    if (score >= 90) return { bg: 'bg-green-50', text: 'text-green-700', label: 'Foarte bun' };
    if (score >= 85) return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Bun' };
    if (score >= 70) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Acceptabil' };
    if (score >= 60) return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Verificare' };
    return { bg: 'bg-red-100', text: 'text-red-800', label: 'Slab' };
  };

  // Grupare propuneri
  const autoApprovable = propuneri.filter(p => p.auto_approvable && p.is_valid);
  const reviewNeeded = propuneri.filter(p => !p.auto_approvable && p.is_valid);
  const invalid = propuneri.filter(p => !p.is_valid);

  return (
    <ModernLayout>
      <div className="p-6 space-y-6">
        {/* Header cu statistici */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Wallet className="w-7 h-7 text-red-500" />
                Propuneri Plăți Automate
              </h1>
              <p className="text-gray-600 mt-1">
                Matching inteligent între plăți și facturi primite / cheltuieli
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Generează Propuneri
              </button>

              {stats && stats.auto_approvable > 0 && (
                <button
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {approvingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  Aprobă Toate ({stats.auto_approvable})
                </button>
              )}
            </div>
          </div>

          {/* Statistici - Modern Card Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border-l-4 border-gray-400 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">În așteptare</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{stats.pending}</p>
                  </div>
                  <div className="text-2xl opacity-70">⏳</div>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border-l-4 border-green-500 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Auto-aprobabile</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{stats.auto_approvable}</p>
                  </div>
                  <div className="text-2xl opacity-70">🤖</div>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border-l-4 border-yellow-500 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Necesită review</p>
                    <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.review_needed}</p>
                  </div>
                  <div className="text-2xl opacity-70">👁️</div>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aprobate</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{stats.approved}</p>
                  </div>
                  <div className="text-2xl opacity-70">✅</div>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border-l-4 border-red-500 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Respinse</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected}</p>
                  </div>
                  <div className="text-2xl opacity-70">❌</div>
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 border-l-4 border-gray-300 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expirate</p>
                    <p className="text-3xl font-bold text-gray-500 mt-1">{stats.expired}</p>
                  </div>
                  <div className="text-2xl opacity-70">🕐</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filtre */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtre:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="pending">În așteptare</option>
              <option value="approved">Aprobate</option>
              <option value="rejected">Respinse</option>
              <option value="expired">Expirate</option>
              <option value="all">Toate</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoOnlyFilter}
                onChange={(e) => setAutoOnlyFilter(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Doar auto-aprobabile</span>
            </label>

            <button
              onClick={fetchPropuneri}
              disabled={loading}
              className="ml-auto px-3 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Reîncarcă
            </button>
          </div>
        </div>

        {/* Eroare */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        )}

        {/* Lista propuneri */}
        {!loading && propuneri.length === 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-12 text-center">
            <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700">Nu există propuneri</h3>
            <p className="text-gray-500 mt-2">
              Apăsați "Generează Propuneri" pentru a căuta matching-uri între plăți și facturi primite / cheltuieli.
            </p>
          </div>
        )}

        {/* Secțiune Auto-Aprobabile */}
        {!loading && statusFilter === 'pending' && autoApprovable.length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Auto-Aprobabile ({autoApprovable.length})
              <span className="text-sm font-normal text-gray-500">— Score ≥85%, pot fi aprobate fără verificare</span>
            </h2>

            <div className="space-y-4">
              {autoApprovable.map((p, idx) => (
                <PropunereCard
                  key={p.id}
                  propunere={p}
                  expanded={expandedIds.has(p.id)}
                  processing={processingIds.has(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                  onApprove={() => handleApprove(p.id)}
                  onReject={() => handleReject(p.id)}
                  getScoreBadge={getScoreBadge}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* Secțiune Review Needed */}
        {!loading && statusFilter === 'pending' && reviewNeeded.length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Necesită Verificare ({reviewNeeded.length})
              <span className="text-sm font-normal text-gray-500">— Score &lt;85%, verificați înainte de aprobare</span>
            </h2>

            <div className="space-y-4">
              {reviewNeeded.map((p, idx) => (
                <PropunereCard
                  key={p.id}
                  propunere={p}
                  expanded={expandedIds.has(p.id)}
                  processing={processingIds.has(p.id)}
                  onToggle={() => toggleExpand(p.id)}
                  onApprove={() => handleApprove(p.id)}
                  onReject={() => handleReject(p.id)}
                  getScoreBadge={getScoreBadge}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* Toate propunerile (pentru status != pending) */}
        {!loading && statusFilter !== 'pending' && propuneri.length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-lg p-6 space-y-4">
            {propuneri.map((p, idx) => (
              <PropunereCard
                key={p.id}
                propunere={p}
                expanded={expandedIds.has(p.id)}
                processing={processingIds.has(p.id)}
                onToggle={() => toggleExpand(p.id)}
                onApprove={() => handleApprove(p.id)}
                onReject={() => handleReject(p.id)}
                getScoreBadge={getScoreBadge}
                showActions={p.status === 'pending'}
                index={idx}
              />
            ))}
          </div>
        )}

        {/* Propuneri invalide */}
        {!loading && invalid.length > 0 && (
          <div className="bg-gray-100/60 backdrop-blur-sm rounded-xl shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-400 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Expirate/Invalide ({invalid.length})
              <span className="text-sm font-normal">— Target/tranzacție deja procesată</span>
            </h2>

            <div className="opacity-60 space-y-4">
              {invalid.slice(0, 5).map((p, idx) => (
                <PropunereCard
                  key={p.id}
                  propunere={p}
                  expanded={false}
                  processing={false}
                  onToggle={() => {}}
                  onApprove={() => {}}
                  onReject={() => {}}
                  getScoreBadge={getScoreBadge}
                  showActions={false}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}

// =================================================================
// COMPONENT: Card Propunere Plată
// =================================================================

interface PropunereCardProps {
  propunere: PropunerePlata;
  expanded: boolean;
  processing: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  getScoreBadge: (score: number) => { bg: string; text: string; label: string };
  showActions?: boolean;
}

function PropunereCard({
  propunere,
  expanded,
  processing,
  onToggle,
  onApprove,
  onReject,
  getScoreBadge,
  showActions = true,
  index = 0
}: PropunereCardProps & { index?: number }) {
  const scoreBadge = getScoreBadge(propunere.score);

  // Determine target display info
  const isFactura = propunere.target_type === 'factura_primita';
  const targetLabel = isFactura ? 'Factură Primită' : 'Cheltuială';
  const targetIcon = isFactura ? <FileText className="w-4 h-4" /> : <Wallet className="w-4 h-4" />;
  const targetRef = isFactura
    ? propunere.factura_serie_numar || 'N/A'
    : `${propunere.proiect_denumire || 'N/A'}${propunere.subproiect_denumire ? ` / ${propunere.subproiect_denumire}` : ''}`;

  // Alternating row colors for better visual separation
  const bgColor = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70';

  return (
    <div className={`${bgColor} rounded-xl shadow-md border-2 ${propunere.auto_approvable ? 'border-green-300 hover:border-green-400' : 'border-gray-200 hover:border-gray-300'} overflow-hidden transition-all duration-200 hover:shadow-lg`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          {/* Score Badge */}
          <div className={`px-3 py-1 rounded-full ${scoreBadge.bg} ${scoreBadge.text} font-bold text-sm min-w-[70px] text-center`}>
            {propunere.score}%
          </div>

          {/* Info Principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-red-700">
                -{Math.abs(propunere.suma_plata).toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className={`font-medium ${isFactura ? 'text-blue-700' : 'text-purple-700'} flex items-center gap-1`}>
                {targetIcon}
                {targetRef}
              </span>
              {propunere.auto_approvable && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  AUTO
                </span>
              )}
              <span className={`px-2 py-0.5 ${isFactura ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'} text-xs rounded-full`}>
                {targetLabel}
              </span>
              {propunere.referinta_gasita && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                  REF: {propunere.referinta_gasita}
                </span>
              )}
            </div>

            <div className="text-sm text-gray-500 mt-1 truncate">
              {propunere.tranzactie_contrapartida || propunere.furnizor_nume || 'N/A'} •
              CUI: {propunere.tranzactie_cui || propunere.furnizor_cui || 'N/A'} •
              {propunere.tranzactie_data}
            </div>
          </div>

          {/* Status sau Acțiuni */}
          <div className="flex items-center gap-2">
            {propunere.status === 'approved' && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Aprobat
              </span>
            )}
            {propunere.status === 'rejected' && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                Respins
              </span>
            )}
            {propunere.status === 'expired' && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                Expirat
              </span>
            )}

            {showActions && propunere.status === 'pending' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onApprove(); }}
                  disabled={processing}
                  className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                  title="Aprobă"
                >
                  {processing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onReject(); }}
                  disabled={processing}
                  className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                  title="Respinge"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </>
            )}

            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Detalii expandate */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Detalii Tranzacție Plată */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Plată Bancară
              </h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-500">Sumă:</span> <strong className="text-red-600">-{Math.abs(propunere.suma_plata).toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</strong></p>
                <p><span className="text-gray-500">Data:</span> {propunere.tranzactie_data}</p>
                <p><span className="text-gray-500">Către:</span> {propunere.tranzactie_contrapartida || 'N/A'}</p>
                <p><span className="text-gray-500">CUI:</span> {propunere.tranzactie_cui || 'N/A'}</p>
                {propunere.tranzactie_detalii && (
                  <p className="text-gray-600 text-xs mt-2 p-2 bg-gray-50 rounded">
                    {propunere.tranzactie_detalii.substring(0, 200)}...
                  </p>
                )}
              </div>
            </div>

            {/* Detalii Target */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
                {isFactura ? <FileText className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                {targetLabel}
              </h4>
              <div className="space-y-1 text-sm">
                {isFactura ? (
                  <>
                    <p><span className="text-gray-500">Serie-Număr:</span> <strong>{propunere.factura_serie_numar || 'N/A'}</strong></p>
                    <p><span className="text-gray-500">Furnizor:</span> {propunere.furnizor_nume || 'N/A'}</p>
                    <p><span className="text-gray-500">CUI Furnizor:</span> {propunere.furnizor_cui || 'N/A'}</p>
                    <p><span className="text-gray-500">Valoare cu TVA:</span> <strong>{propunere.suma_target_cu_tva?.toLocaleString('ro-RO', { minimumFractionDigits: 2 }) || propunere.suma_target.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</strong></p>
                    {propunere.cheltuiala_asociata_din_factura && (
                      <p className="text-purple-600 text-xs mt-2 p-2 bg-purple-50 rounded flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Are cheltuială asociată: {propunere.proiect_denumire}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p><span className="text-gray-500">Proiect:</span> <strong>{propunere.proiect_denumire || 'N/A'}</strong></p>
                    {propunere.subproiect_denumire && (
                      <p><span className="text-gray-500">Subproiect:</span> {propunere.subproiect_denumire}</p>
                    )}
                    <p><span className="text-gray-500">Furnizor:</span> {propunere.furnizor_nume || 'N/A'}</p>
                    <p><span className="text-gray-500">CUI:</span> {propunere.furnizor_cui || 'N/A'}</p>
                    <p><span className="text-gray-500">Valoare (fără TVA):</span> {propunere.suma_target.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</p>
                    <p><span className="text-gray-500">Valoare cu TVA:</span> <strong>{propunere.suma_target_cu_tva?.toLocaleString('ro-RO', { minimumFractionDigits: 2 }) || 'N/A'} RON</strong></p>
                    {propunere.cheltuiala_descriere && (
                      <p className="text-gray-600 text-xs mt-2 p-2 bg-gray-50 rounded">
                        {propunere.cheltuiala_descriere.substring(0, 150)}...
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detalii Matching */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2">Detalii Matching</h4>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className={`px-2 py-1 rounded ${scoreBadge.bg} ${scoreBadge.text}`}>
                Score: {propunere.score}% ({scoreBadge.label})
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                Algoritm: {propunere.matching_algorithm || 'N/A'}
              </span>
              {propunere.diferenta_procent != null && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  Diferență: {Number(propunere.diferenta_procent).toFixed(1)}% ({propunere.diferenta_ron != null ? Number(propunere.diferenta_ron).toFixed(2) : '0'} RON)
                </span>
              )}
              {propunere.referinta_gasita && (
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                  Referință: {propunere.referinta_gasita}
                </span>
              )}
            </div>

            {/* Score Breakdown */}
            {propunere.matching_details && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Breakdown Scor:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${propunere.matching_details.cui_score > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    CUI: {propunere.matching_details.cui_score || 0}p
                  </span>
                  <span className={`px-2 py-1 rounded ${propunere.matching_details.valoare_score > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    Valoare: {propunere.matching_details.valoare_score || 0}p
                  </span>
                  <span className={`px-2 py-1 rounded ${propunere.matching_details.referinta_score > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    Referință: {propunere.matching_details.referinta_score || 0}p
                  </span>
                  <span className={`px-2 py-1 rounded ${propunere.matching_details.data_score > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    Dată: {propunere.matching_details.data_score || 0}p
                  </span>
                </div>

                {/* Match reasons */}
                {propunere.matching_details.details?.matching_reasons && propunere.matching_details.details.matching_reasons.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Motive matching:</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {propunere.matching_details.details.matching_reasons.slice(0, 3).map((reason: string, idx: number) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
