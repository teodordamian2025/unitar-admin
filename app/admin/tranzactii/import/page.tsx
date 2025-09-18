// =================================================================
// PAGINA IMPORT CSV TRANZACTII ING ROMANIA
// Generat: 18 septembrie 2025, 00:05 (Romania)
// Cale: app/admin/tranzactii/import/page.tsx
// =================================================================

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

// =================================================================
// TIPURI TYPESCRIPT
// =================================================================

interface ImportStats {
  totalRows: number;
  processedRows: number;
  newTransactions: number;
  duplicatesFound: number;
  errorRows: number;
  processingTimeMs: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  stats?: ImportStats;
  accountId?: string;
  error?: string;
}

interface RecentImport {
  operation_status: string;
  records_processed: number;
  records_success: number;
  records_duplicates: number;
  file_name: string;
  processing_time_ms: number;
  summary_message: string;
  data_creare: string;
}

// =================================================================
// COMPONENTE HELPER
// =================================================================

const ImportStatsCard: React.FC<{ stats: ImportStats }> = ({ stats }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Rezultate Import</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{stats.totalRows}</div>
        <div className="text-sm text-gray-500">Total linii</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">{stats.newTransactions}</div>
        <div className="text-sm text-gray-500">Noi importate</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-600">{stats.duplicatesFound}</div>
        <div className="text-sm text-gray-500">Duplicate</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-600">{stats.errorRows}</div>
        <div className="text-sm text-gray-500">Erori</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">{Math.round(stats.processingTimeMs / 1000)}s</div>
        <div className="text-sm text-gray-500">Timp procesare</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-indigo-600">
          {stats.totalRows > 0 ? Math.round((stats.newTransactions / stats.totalRows) * 100) : 0}%
        </div>
        <div className="text-sm text-gray-500">Rata succes</div>
      </div>
    </div>
  </div>
);

const RecentImportsCard: React.FC<{ imports: RecentImport[] }> = ({ imports }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Import-uri Recente</h3>
    {imports.length === 0 ? (
      <p className="text-gray-500 text-center py-4">Nu există import-uri recente</p>
    ) : (
      <div className="space-y-3">
        {imports.slice(0, 5).map((imp, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  imp.operation_status === 'success' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {imp.operation_status === 'success' ? '✅ Succes' : '❌ Eșuat'}
                </span>
                <span className="text-sm font-medium text-gray-900">{imp.file_name}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {imp.records_success} noi, {imp.records_duplicates} duplicate
                • {Math.round(imp.processing_time_ms / 1000)}s
                • {new Date(imp.data_creare).toLocaleDateString('ro-RO')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{imp.records_processed}</div>
              <div className="text-xs text-gray-500">procesate</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const UploadInstructions: React.FC = () => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-blue-900 mb-3">
      📋 Instrucțiuni Import CSV ING România
    </h3>
    <div className="space-y-3 text-sm text-blue-800">
      <div className="flex items-start gap-2">
        <span className="font-semibold">1.</span>
        <span>Accesează <strong>ING Homebank</strong> → Contul tău → Export tranzacții</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="font-semibold">2.</span>
        <span>Selectează perioada dorită (max 12 luni)</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="font-semibold">3.</span>
        <span>Alege format <strong>CSV</strong> și descarcă fișierul</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="font-semibold">4.</span>
        <span>Trage fișierul CSV în zona de mai jos sau click pentru a-l selecta</span>
      </div>
    </div>
    <div className="mt-4 p-3 bg-blue-100 rounded-md">
      <p className="text-xs text-blue-700">
        <strong>💡 Tip:</strong> Sistemul detectează automat duplicate și nu le va re-importa. 
        Poți importa în siguranță același fișier de mai multe ori.
      </p>
    </div>
  </div>
);

// =================================================================
// COMPONENTA PRINCIPALĂ
// =================================================================

const TranzactiiImportPage: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // =================================================================
  // DROPZONE CONFIGURATION
  // =================================================================

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validare fișier
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Te rog selectează un fișier CSV valid');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('Fișierul este prea mare. Dimensiunea maximă este 10MB');
      return;
    }

    setSelectedFile(file);
    setImportResult(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/csv': ['.csv']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  // =================================================================
  // UPLOAD HANDLER
  // =================================================================

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Te rog selectează un fișier CSV');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Se importă ${selectedFile.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/tranzactii/import-csv', {
        method: 'POST',
        body: formData
      });

      const result: ImportResult = await response.json();

      if (result.success) {
        toast.success(result.message, { id: toastId });
        setImportResult(result);
        setSelectedFile(null);
        
        // Reload recent imports
        await loadRecentImports();
      } else {
        toast.error(result.error || 'Eroare la import', { id: toastId });
        setImportResult(result);
      }

    } catch (error: any) {
      console.error('❌ Eroare upload:', error);
      toast.error('Eroare la încărcarea fișierului', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  // =================================================================
  // LOAD RECENT IMPORTS
  // =================================================================

  const loadRecentImports = async () => {
    try {
      const response = await fetch('/api/tranzactii/import-csv');
      const data = await response.json();
      
      if (data.success) {
        setRecentImports(data.recentImports || []);
      }
    } catch (error) {
      console.error('❌ Eroare loading recent imports:', error);
    }
  };

  // =================================================================
  // EFFECTS
  // =================================================================

  useEffect(() => {
    loadRecentImports();
  }, []);

  // =================================================================
  // RENDER
  // =================================================================

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            💳 Import Tranzacții Bancare
          </h1>
          <p className="mt-2 text-gray-600">
            Importă extractele CSV de la ING România pentru reconciliation automat
          </p>
        </div>

        {/* Instructions */}
        <div className="mb-8">
          <UploadInstructions />
        </div>

        {/* Upload Zone */}
        <div className="mb-8">
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
              ${isDragActive 
                ? 'border-blue-400 bg-blue-50' 
                : isDragReject
                ? 'border-red-400 bg-red-50'
                : selectedFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <input {...getInputProps()} />
            
            {/* Upload Icon */}
            <div className="mb-4">
              {selectedFile ? (
                <div className="mx-auto w-16 h-16 text-green-500">
                  📄
                </div>
              ) : (
                <div className="mx-auto w-16 h-16 text-gray-400">
                  📁
                </div>
              )}
            </div>

            {/* Upload Text */}
            <div className="text-lg font-semibold text-gray-900 mb-2">
              {selectedFile ? (
                `✅ ${selectedFile.name}`
              ) : isDragActive ? (
                'Eliberează fișierul aici...'
              ) : (
                'Trage CSV-ul aici sau click pentru a selecta'
              )}
            </div>
            
            {selectedFile ? (
              <div className="text-sm text-gray-600">
                Dimensiune: {Math.round(selectedFile.size / 1024)} KB
                <br />
                <span className="text-green-600 font-medium">Gata pentru import!</span>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Doar fișiere CSV, max 10MB
                <br />
                Format acceptat: Export ING România
              </div>
            )}

            {/* Upload Button */}
            {selectedFile && (
              <div className="mt-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload();
                  }}
                  disabled={isUploading}
                  className={`
                    inline-flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200
                    ${isUploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                    }
                  `}
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Se procesează...
                    </>
                  ) : (
                    <>
                      🚀 Importă Tranzacțiile
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Remove File Button */}
          {selectedFile && !isUploading && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setImportResult(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                🗑️ Elimină fișierul selectat
              </button>
            </div>
          )}
        </div>

        {/* Import Results */}
        {importResult && importResult.success && importResult.stats && (
          <div className="mb-8">
            <ImportStatsCard stats={importResult.stats} />
            
            {/* Action Buttons After Successful Import */}
            <div className="mt-6 flex flex-wrap gap-4 justify-center">
              <a
                href="/admin/tranzactii/dashboard"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📊 Vezi Dashboard-ul
              </a>
              <button
                onClick={async () => {
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
                    } else {
                      toast.error(result.error || 'Eroare auto-matching', { id: toastId });
                    }
                  } catch (error) {
                    toast.error('Eroare la auto-matching', { id: toastId });
                  }
                }}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🤖 Rulează Auto-Matching
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {importResult && !importResult.success && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">❌ Eroare Import</h3>
            <p className="text-red-800">{importResult.error}</p>
            
            {importResult.stats && (
              <div className="mt-4 text-sm text-red-700">
                <p>Linii procesate: {importResult.stats.processedRows} din {importResult.stats.totalRows}</p>
                <p>Erori: {importResult.stats.errorRows}</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Imports */}
        <div className="mb-8">
          <RecentImportsCard imports={recentImports} />
        </div>

        {/* Help Section */}
        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🆘 Ajutor</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Probleme frecvente:</h4>
              <ul className="space-y-1">
                <li>• Verifică că fișierul este exportat din ING Homebank</li>
                <li>• Formatul trebuie să fie CSV (nu Excel)</li>
                <li>• Fișierul nu trebuie modificat manual</li>
                <li>• Verifică că perioada nu depășește 12 luni</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">După import:</h4>
              <ul className="space-y-1">
                <li>• Tranzacțiile sunt automat deduplicate</li>
                <li>• Se încearcă matching automat cu facturile</li>
                <li>• Matching-urile cu confidence &gt; 70% sunt aplicate</li>
                <li>• Restul pot fi procesate manual în Dashboard</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              💡 Pentru suport tehnic: <a href="mailto:contact@unitarproiect.eu" className="text-blue-600 hover:underline">contact@unitarproiect.eu</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranzactiiImportPage;
