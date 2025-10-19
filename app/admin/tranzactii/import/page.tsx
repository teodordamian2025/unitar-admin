// ==================================================================
// CALEA: app/admin/tranzactii/import/page.tsx
// DATA: 19.09.2025 23:45 (ora României)
// DESCRIERE: Pagina modernă pentru import CSV tranzacții bancare
// FUNCȚIONALITATE: Upload drag&drop cu preview și validare avansată
// ==================================================================

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, Alert, LoadingSpinner } from '@/app/components/ui';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';

// ==================================================================
// TIPURI TYPESCRIPT
// ==================================================================

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

// ==================================================================
// COMPONENTE MODERNE
// ==================================================================

const ModernImportStats: React.FC<{ stats: ImportStats }> = ({ stats }) => (
  <Card variant="default" className="p-6">
    <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
      📊 Rezultate Import
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalRows}</div>
        <div className="text-sm text-gray-500">Total linii</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-green-600 mb-2">{stats.newTransactions}</div>
        <div className="text-sm text-gray-500">Noi importate</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-yellow-600 mb-2">{stats.duplicatesFound}</div>
        <div className="text-sm text-gray-500">Duplicate</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-red-600 mb-2">{stats.errorRows}</div>
        <div className="text-sm text-gray-500">Erori</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-purple-600 mb-2">
          {Math.round(stats.processingTimeMs / 1000)}s
        </div>
        <div className="text-sm text-gray-500">Timp procesare</div>
      </div>
      <div className="text-center">
        <div className="text-3xl font-bold text-indigo-600 mb-2">
          {stats.totalRows > 0 ? Math.round((stats.newTransactions / stats.totalRows) * 100) : 0}%
        </div>
        <div className="text-sm text-gray-500">Rata succes</div>
      </div>
    </div>
  </Card>
);

const ModernRecentImports: React.FC<{ imports: RecentImport[] }> = ({ imports }) => (
  <Card variant="default" className="p-6">
    <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
      🕒 Import-uri Recente
    </h3>
    {imports.length === 0 ? (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-gray-500">Nu există import-uri recente</p>
      </div>
    ) : (
      <div className="space-y-4">
        {imports.slice(0, 5).map((imp, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/60 transition-all duration-200"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  imp.operation_status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {imp.operation_status === 'success' ? '✅ Succes' : '❌ Eșuat'}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {imp.file_name}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>📄 {imp.records_processed} procesate</span>
                <span>✅ {imp.records_success} succes</span>
                <span>🔄 {imp.records_duplicates} duplicate</span>
                <span>⏱️ {Math.round(imp.processing_time_ms / 1000)}s</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {new Date(imp.data_creare).toLocaleDateString('ro-RO')}
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const ModernDropzone: React.FC<{
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}> = ({ onFileSelect, isProcessing }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        onFileSelect(file);
      } else {
        toast.error('Vă rugăm să selectați un fișier CSV valid');
      }
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  return (
    <Card variant="default" className="p-8">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer
          transition-all duration-300 hover:border-blue-400 hover:bg-blue-50/30
          ${isDragActive ? 'border-blue-500 bg-blue-50/50' : ''}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="text-6xl mb-4">
          {isProcessing ? '⏳' : isDragActive ? '📂' : '📄'}
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {isProcessing
            ? 'Se procesează fișierul...'
            : isDragActive
            ? 'Eliberează fișierul aici'
            : 'Drag & Drop fișier CSV'
          }
        </h3>

        <p className="text-gray-600 mb-6">
          {isProcessing
            ? 'Vă rugăm să așteptați...'
            : 'sau faceți clic pentru a selecta un fișier CSV cu tranzacții ING România'
          }
        </p>

        {!isProcessing && (
          <Button variant="primary" size="lg">
            📤 Selectează Fișier CSV
          </Button>
        )}
      </div>
    </Card>
  );
};

const FormatGuide: React.FC = () => (
  <Card variant="info" className="p-6">
    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
      📋 Format CSV Acceptat
    </h3>
    <div className="grid grid-cols-2 gap-6 text-sm">
      <div>
        <h4 className="font-medium text-blue-800 mb-2">Coloane necesare (ordine exactă):</h4>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Data tranzacției (format: DD.MM.YYYY)</li>
          <li>Detalii tranzacție</li>
          <li>Debit (suma negativă)</li>
          <li>Credit (suma pozitivă)</li>
          <li>Sold</li>
        </ul>
      </div>

      <div>
        <h4 className="font-medium text-blue-800 mb-2">Observații importante:</h4>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Fișierul trebuie să fie în format CSV cu separatorul ","</li>
          <li>Prima linie poate conține header-ele (vor fi ignorate)</li>
          <li>Encoding recomandat: UTF-8</li>
          <li>Duplicatele vor fi detectate automat</li>
        </ul>
      </div>
    </div>
  </Card>
);

// ==================================================================
// COMPONENTA PRINCIPALĂ
// ==================================================================

const ModernImportPage: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');

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
    loadRecentImports();
  }, [user, loading, router]);

  // ==================================================================
  // DATA LOADING
  // ==================================================================

  const loadRecentImports = async () => {
    try {
      const response = await fetch('/api/tranzactii/import-csv?action=recent');
      const data = await response.json();

      if (data.success) {
        setRecentImports(data.imports || []);
      }
    } catch (error) {
      console.error('❌ Eroare la încărcarea import-urilor recente:', error);
    }
  };

  // ==================================================================
  // HANDLERS
  // ==================================================================

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setImportResult(null);
  };

  const processImport = async () => {
    if (!selectedFile) {
      toast.error('Vă rugăm să selectați un fișier CSV');
      return;
    }

    setIsProcessing(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);

      const response = await fetch('/api/tranzactii/import-csv', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setImportResult(result);
        toast.success(result.message);
        loadRecentImports(); // Refresh recent imports
      } else {
        toast.error(result.error || 'Eroare la procesarea fișierului');
        setImportResult(result);
      }
    } catch (error) {
      console.error('❌ Eroare import CSV:', error);
      toast.error('Eroare la upload-ul fișierului');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setImportResult(null);
  };

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
              📤 Import CSV Tranzacții
            </h1>
            <p className="text-gray-600 text-lg">
              Import automat tranzacții bancare din fișiere CSV ING România
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/admin/tranzactii/dashboard')}
          >
            ← Înapoi la Dashboard
          </Button>
        </div>
      </div>

      {/* Format Guide */}
      <div className="mb-8">
        <FormatGuide />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          <ModernDropzone
            onFileSelect={handleFileSelect}
            isProcessing={isProcessing}
          />

          {selectedFile && !isProcessing && (
            <Card variant="success" className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📄</div>
                  <div>
                    <div className="font-medium text-green-800">
                      {selectedFile.name}
                    </div>
                    <div className="text-sm text-green-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={processImport}
                    loading={isProcessing}
                  >
                    🚀 Procesează
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetImport}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {isProcessing && (
            <Card variant="warning" className="p-6 text-center">
              <LoadingSpinner />
              <p className="mt-4 text-lg font-medium text-yellow-800">
                Se procesează fișierul CSV...
              </p>
              <p className="text-sm text-yellow-600">
                Vă rugăm să nu închideți această pagină.
              </p>
            </Card>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              {importResult.success ? (
                <Alert type="success" title="Import finalizat cu succes!">
                  {importResult.message}
                </Alert>
              ) : (
                <Alert type="error" title="Eroare la import">
                  {importResult.error || 'Eroare necunoscută'}
                </Alert>
              )}

              {importResult.stats && (
                <ModernImportStats stats={importResult.stats} />
              )}

              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  onClick={() => router.push('/admin/tranzactii/dashboard')}
                >
                  📊 Vezi Tranzacții
                </Button>
                <Button
                  variant="outline"
                  onClick={resetImport}
                >
                  📤 Importă Alt Fișier
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Imports */}
        <div>
          <ModernRecentImports imports={recentImports} />
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-12">
        <Card variant="default" className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            ❓ Ajutor și Suport
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">🔧 Probleme tehnice</h4>
              <p className="text-gray-600">
                Dacă întâmpinați probleme la import, verificați formatul fișierului și încercați din nou.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">📊 Duplicate</h4>
              <p className="text-gray-600">
                Sistemul detectează automat tranzacțiile duplicate pe baza datei și sumei.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">⚡ Performance</h4>
              <p className="text-gray-600">
                Fișierele mari (&gt;10MB) pot dura câteva minute pentru procesare.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </ModernLayout>
  );
};

export default ModernImportPage;