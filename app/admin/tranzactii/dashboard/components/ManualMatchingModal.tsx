// =================================================================
// MODAL MANUAL MATCHING CU CANDIDATI INTELIGENTI
// Generat: 18 septembrie 2025, 00:30 (Romania)
// Cale: app/admin/tranzactii/dashboard/components/ManualMatchingModal.tsx
// =================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================

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
}

interface EtapaFacturaCandidat {
  id: string;
  factura_id: string;
  etapa_id: string;
  proiect_id: string;
  subproiect_id: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  status_incasare: string;
  suma_ramasa: number;
  // Date factură
  factura_serie: string;
  factura_numar: string;
  factura_data: string;
  factura_client_nume: string;
  factura_client_cui: string;
  factura_total: number;
  // Date proiect
  proiect_denumire: string;
  subproiect_denumire: string;
  // Matching info
  matching_score: number;
  matching_reasons: string[];
  diferenta_ron: number;
  diferenta_procent: number;
}

interface CheltuialaCandidat {
  id: string;
  proiect_id: string;
  subproiect_id: string;
  tip_cheltuiala: string;
  furnizor_nume: string;
  furnizor_cui: string;
  descriere: string;
  valoare: number;
  moneda: string;
  valoare_ron: number;
  status_achitare: string;
  // Date proiect
  proiect_denumire: string;
  subproiect_denumire: string;
  // Matching info
  matching_score: number;
  matching_reasons: string[];
  diferenta_ron: number;
  diferenta_procent: number;
}

interface Candidati {
  etape_facturi?: EtapaFacturaCandidat[];
  cheltuieli?: CheltuialaCandidat[];
}

interface ManualMatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TranzactieDetail | null;
  onMatchApplied: () => void; // Callback pentru refresh dashboard
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Formatează DATE field din BigQuery (poate fi string sau {value: string})
 */
const formatDate = (dateStr: string | { value: string } | any): string => {
  if (!dateStr) return 'N/A';
  // ✅ FIX: Normalizare DATE field (BigQuery returnează {value: "2025-11-10"})
  const dateValue = typeof dateStr === 'object' && dateStr?.value ? dateStr.value : dateStr;
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('ro-RO');
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON'
  }).format(amount);
};

// =================================================================
// COMPONENTE HELPER
// =================================================================

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 75) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getScoreIcon = (score: number): string => {
    if (score >= 90) return '🎯';
    if (score >= 75) return '✅';
    if (score >= 60) return '⚠️';
    if (score >= 40) return '📊';
    return '❌';
  };

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(score)}`}>
      <span className="mr-1">{getScoreIcon(score)}</span>
      {score}%
    </div>
  );
};

const ReasonsList: React.FC<{ reasons: string[] }> = ({ reasons }) => (
  <div className="space-y-1">
    {reasons.map((reason, index) => (
      <div key={index} className="text-xs text-gray-600 flex items-center gap-1">
        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
        {reason}
      </div>
    ))}
  </div>
);

const EtapaFacturaCard: React.FC<{
  candidat: EtapaFacturaCandidat;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ candidat, onSelect, isSelected }) => {
  // ✅ Folosim helper-ele globale formatDate și formatCurrency
  return (
    <div 
      onClick={onSelect}
      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Header cu Score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <ScoreBadge score={candidat.matching_score} />
          <div className="text-sm">
            <span className="font-medium text-gray-900">
              {candidat.factura_serie} {candidat.factura_numar}
            </span>
            <span className="text-gray-500 ml-1">
              din {formatDate(candidat.factura_data)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">
            {formatCurrency(candidat.suma_ramasa)}
          </div>
          <div className="text-xs text-gray-500">
            {candidat.diferenta_procent.toFixed(1)}% diferență
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="mb-3">
        <div className="text-sm font-medium text-gray-900">
          {candidat.factura_client_nume}
        </div>
        {candidat.factura_client_cui && (
          <div className="text-xs text-gray-500">
            CUI: {candidat.factura_client_cui}
          </div>
        )}
      </div>

      {/* Proiect Info */}
      <div className="mb-3">
        <div className="text-sm text-gray-700">
          📁 {candidat.proiect_denumire}
          {candidat.subproiect_denumire && (
            <span className="text-gray-500"> → {candidat.subproiect_denumire}</span>
          )}
        </div>
      </div>

      {/* Detalii financiare */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
        <div>
          <span className="text-gray-500">Valoare totală:</span>
          <div className="font-medium">{formatCurrency(candidat.valoare_ron)}</div>
        </div>
        <div>
          <span className="text-gray-500">Status:</span>
          <div className={`font-medium ${
            candidat.status_incasare === 'Neincasat' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {candidat.status_incasare}
          </div>
        </div>
      </div>

      {/* Matching Reasons */}
      <div className="border-t border-gray-100 pt-3">
        <div className="text-xs text-gray-500 mb-2">Motive matching:</div>
        <ReasonsList reasons={candidat.matching_reasons} />
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="mt-3 flex items-center justify-center py-2 bg-blue-100 rounded-md">
          <span className="text-blue-800 text-sm font-medium">✓ Selectat pentru matching</span>
        </div>
      )}
    </div>
  );
};

const CheltuialaCard: React.FC<{
  candidat: CheltuialaCandidat;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ candidat, onSelect, isSelected }) => {
  // ✅ Folosim helper-ul global formatCurrency
  return (
    <div 
      onClick={onSelect}
      className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Header cu Score */}
      <div className="flex items-center justify-between mb-3">
        <ScoreBadge score={candidat.matching_score} />
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">
            {formatCurrency(candidat.valoare_ron)}
          </div>
          <div className="text-xs text-gray-500">
            {candidat.diferenta_procent.toFixed(1)}% diferență
          </div>
        </div>
      </div>

      {/* Furnizor Info */}
      <div className="mb-3">
        <div className="text-sm font-medium text-gray-900">
          {candidat.furnizor_nume}
        </div>
        {candidat.furnizor_cui && (
          <div className="text-xs text-gray-500">
            CUI: {candidat.furnizor_cui}
          </div>
        )}
      </div>

      {/* Descriere */}
      <div className="mb-3">
        <div className="text-sm text-gray-700">
          {candidat.descriere}
        </div>
      </div>

      {/* Proiect Info */}
      <div className="mb-3">
        <div className="text-sm text-gray-600">
          📁 {candidat.proiect_denumire}
          {candidat.subproiect_denumire && (
            <span className="text-gray-500"> → {candidat.subproiect_denumire}</span>
          )}
        </div>
      </div>

      {/* Detalii */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
        <div>
          <span className="text-gray-500">Tip:</span>
          <div className="font-medium">{candidat.tip_cheltuiala}</div>
        </div>
        <div>
          <span className="text-gray-500">Status:</span>
          <div className={`font-medium ${
            candidat.status_achitare === 'Neincasat' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {candidat.status_achitare}
          </div>
        </div>
      </div>

      {/* Matching Reasons */}
      <div className="border-t border-gray-100 pt-3">
        <div className="text-xs text-gray-500 mb-2">Motive matching:</div>
        <ReasonsList reasons={candidat.matching_reasons} />
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="mt-3 flex items-center justify-center py-2 bg-blue-100 rounded-md">
          <span className="text-blue-800 text-sm font-medium">✓ Selectat pentru matching</span>
        </div>
      )}
    </div>
  );
};

// =================================================================
// COMPONENTA PRINCIPALĂ
// =================================================================

const ManualMatchingModal: React.FC<ManualMatchingModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onMatchApplied
}) => {
  const [candidati, setCandidati] = useState<Candidati>({});
  const [selectedCandidat, setSelectedCandidat] = useState<{
    type: 'etapa_factura' | 'cheltuiala';
    id: string;
    data: EtapaFacturaCandidat | CheltuialaCandidat;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'etape' | 'cheltuieli'>('etape');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [confidence, setConfidence] = useState(85);
  const [notes, setNotes] = useState('');
  const [forceMatch, setForceMatch] = useState(false);

  // =================================================================
  // LOAD CANDIDATI
  // =================================================================

  const loadCandidati = useCallback(async () => {
    if (!transaction) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tranzactii/manual-match?tranzactie_id=${transaction.id}&tolerance=10`);
      const data = await response.json();

      if (data.success) {
        setCandidati(data.candidati || {});
        
        // Setează tab-ul activ pe baza direcției tranzacției
        if (transaction.directie === 'intrare') {
          setActiveTab('etape');
        } else {
          setActiveTab('cheltuieli');
        }
      } else {
        toast.error(data.error || 'Eroare la căutarea candidaților');
      }
    } catch (error) {
      console.error('❌ Eroare load candidați:', error);
      toast.error('Eroare la căutarea candidaților');
    } finally {
      setIsLoading(false);
    }
  }, [transaction]);

  // =================================================================
  // APPLY MATCHING
  // =================================================================

  const applyMatching = async () => {
    if (!selectedCandidat || !transaction) {
      toast.error('Selectează un candidat pentru matching');
      return;
    }

    // Verificare diferență mare
    const candidatData = selectedCandidat.data;
    if ('diferenta_procent' in candidatData && candidatData.diferenta_procent > 10 && !forceMatch) {
      toast.error('Diferența de sumă este prea mare (>10%). Bifează "Forțează matching-ul" pentru a continua.');
      return;
    }

    setIsApplying(true);
    const toastId = toast.loading('Se aplică matching-ul...');

    try {
      const response = await fetch('/api/tranzactii/manual-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tranzactie_id: transaction.id,
          target_type: selectedCandidat.type,
          target_id: selectedCandidat.id,
          confidence_manual: confidence,
          notes: notes.trim() || undefined,
          force_match: forceMatch
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Matching aplicat cu succes!', { id: toastId });
        onMatchApplied(); // Refresh dashboard
        onClose(); // Închide modal-ul
      } else {
        toast.error(result.error || 'Eroare la aplicarea matching-ului', { id: toastId });
      }
    } catch (error) {
      console.error('❌ Eroare apply matching:', error);
      toast.error('Eroare la aplicarea matching-ului', { id: toastId });
    } finally {
      setIsApplying(false);
    }
  };

  // =================================================================
  // EFFECTS
  // =================================================================

  useEffect(() => {
    if (isOpen && transaction) {
      loadCandidati();
      // Reset form
      setSelectedCandidat(null);
      setConfidence(85);
      setNotes('');
      setForceMatch(false);
    }
  }, [isOpen, transaction, loadCandidati]);

  // =================================================================
  // HANDLERS
  // =================================================================

  const handleSelectEtapa = (etapa: EtapaFacturaCandidat) => {
    setSelectedCandidat({
      type: 'etapa_factura',
      id: etapa.id,
      data: etapa
    });
    // Auto-ajustare confidence pe baza score-ului
    setConfidence(Math.max(60, Math.min(95, etapa.matching_score)));
  };

  const handleSelectCheltuiala = (cheltuiala: CheltuialaCandidat) => {
    setSelectedCandidat({
      type: 'cheltuiala',
      id: cheltuiala.id,
      data: cheltuiala
    });
    // Auto-ajustare confidence pe baza score-ului
    setConfidence(Math.max(60, Math.min(95, cheltuiala.matching_score)));
  };

  // =================================================================
  // RENDER
  // =================================================================

  if (!isOpen || !transaction) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  const etapeCandidati = candidati.etape_facturi || [];
  const cheltuieliCandidati = candidati.cheltuieli || [];
  const hasEtape = etapeCandidati.length > 0;
  const hasCheltuieli = cheltuieliCandidati.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                🔧 Matching Manual
              </h2>
              <p className="text-gray-600 mt-1">
                Selectează candidatul potrivit pentru tranzacția de {formatCurrency(transaction.suma)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Transaction Info */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Data:</span>
                <div className="font-medium">{formatDate(transaction.data_procesare)}</div>
              </div>
              <div>
                <span className="text-gray-500">Sumă:</span>
                <div className={`font-medium ${transaction.directie === 'intrare' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(transaction.suma)}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Contrapartidă:</span>
                <div className="font-medium">{transaction.nume_contrapartida || 'N/A'}</div>
              </div>
              <div>
                <span className="text-gray-500">CUI:</span>
                <div className="font-medium">{transaction.cui_contrapartida || 'N/A'}</div>
              </div>
            </div>
            {transaction.detalii_tranzactie && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-500 text-xs">Detalii:</span>
                <div className="text-xs text-gray-700 mt-1">{transaction.detalii_tranzactie}</div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            {hasEtape && (
              <button
                onClick={() => setActiveTab('etape')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'etape'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 Etape Facturi ({etapeCandidati.length})
              </button>
            )}
            {hasCheltuieli && (
              <button
                onClick={() => setActiveTab('cheltuieli')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'cheltuieli'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                💰 Cheltuieli ({cheltuieliCandidati.length})
              </button>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          
          {/* Candidati List */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-gray-600">Se caută candidați...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTab === 'etape' && hasEtape && (
                  <>
                    <div className="text-sm text-gray-600 mb-4">
                      Găsite {etapeCandidati.length} etape de factură potrivite:
                    </div>
                    {etapeCandidati.map((etapa) => (
                      <EtapaFacturaCard
                        key={etapa.id}
                        candidat={etapa}
                        onSelect={() => handleSelectEtapa(etapa)}
                        isSelected={selectedCandidat?.type === 'etapa_factura' && selectedCandidat.id === etapa.id}
                      />
                    ))}
                  </>
                )}

                {activeTab === 'cheltuieli' && hasCheltuieli && (
                  <>
                    <div className="text-sm text-gray-600 mb-4">
                      Găsite {cheltuieliCandidati.length} cheltuieli potrivite:
                    </div>
                    {cheltuieliCandidati.map((cheltuiala) => (
                      <CheltuialaCard
                        key={cheltuiala.id}
                        candidat={cheltuiala}
                        onSelect={() => handleSelectCheltuiala(cheltuiala)}
                        isSelected={selectedCandidat?.type === 'cheltuiala' && selectedCandidat.id === cheltuiala.id}
                      />
                    ))}
                  </>
                )}

                {/* No candidates found */}
                {!hasEtape && !hasCheltuieli && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nu au fost găsiți candidați</h3>
                    <p className="text-gray-500">
                      Încearcă să ajustezi toleranța sau să creezi manual facturile/cheltuielile.
                    </p>
                  </div>
                )}

                {activeTab === 'etape' && !hasEtape && hasCheltuieli && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nu există etape de factură potrivite.</p>
                    <p className="mt-2">Comută la tab-ul "Cheltuieli" pentru alte opțiuni.</p>
                  </div>
                )}

                {activeTab === 'cheltuieli' && !hasCheltuieli && hasEtape && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nu există cheltuieli potrivite.</p>
                    <p className="mt-2">Comută la tab-ul "Etape Facturi" pentru alte opțiuni.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - Matching Form */}
          {selectedCandidat && (
            <div className="w-80 border-l border-gray-200 p-6 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                ⚙️ Aplicare Matching
              </h3>

              {/* Preview */}
              <div className="mb-6 p-4 bg-white rounded-lg border">
                <div className="text-sm text-gray-600 mb-2">Preview:</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tranzacție:</span>
                    <span className="font-medium">{formatCurrency(transaction.suma)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target:</span>
                    <span className="font-medium">
                      {selectedCandidat.type === 'etapa_factura' 
                        ? formatCurrency((selectedCandidat.data as EtapaFacturaCandidat).suma_ramasa)
                        : formatCurrency((selectedCandidat.data as CheltuialaCandidat).valoare_ron)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Diferență:</span>
                    <span className={`font-medium ${
                      selectedCandidat.data.diferenta_procent > 5 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {selectedCandidat.data.diferenta_procent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Confidence Slider */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confidence Manual: {confidence}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notițe (opțional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Motivul pentru acest matching manual..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Force Match Checkbox */}
              {selectedCandidat.data.diferenta_procent > 10 && (
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={forceMatch}
                      onChange={(e) => setForceMatch(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                    />
                    <span className="text-sm text-red-600">
                      Forțează matching-ul (diferența &gt; 10%)
                    </span>
                  </label>
                </div>
              )}

              {/* Apply Button */}
              <button
                onClick={applyMatching}
                disabled={isApplying || (selectedCandidat.data.diferenta_procent > 10 && !forceMatch)}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  isApplying || (selectedCandidat.data.diferenta_procent > 10 && !forceMatch)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isApplying ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Se aplică...
                  </span>
                ) : (
                  '✅ Aplică Matching-ul'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualMatchingModal;
