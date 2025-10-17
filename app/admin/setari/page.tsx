// ==================================================================
// CALEA: app/admin/setari/page.tsx
// DATA: 19.09.2025 23:50 (ora României)
// DESCRIERE: Settings Hub modern cu glassmorphism design
// FUNCȚIONALITATE: Dashboard central pentru toate setările sistemului
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, LoadingSpinner } from '@/app/components/ui';

interface SystemStats {
  tabeleExistente: number;
  versiuneApp: string;
  ultimaActualizare: string;
  backupAutomat: boolean;
}

interface SettingCard {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  stats?: { label: string; value: string }[];
}

const ModernSettingsPage: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    loadSystemStats();
  }, [user, loading, router]);

  // ==================================================================
  // DATA LOADING
  // ==================================================================

  const loadSystemStats = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStats({
        tabeleExistente: 16,
        versiuneApp: '2.1.0',
        ultimaActualizare: new Date().toLocaleDateString('ro-RO'),
        backupAutomat: true
      });
    } catch (error) {
      console.error('Eroare la încărcarea statisticilor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ==================================================================
  // SETTINGS CONFIGURATION
  // ==================================================================

  const settingsCards: SettingCard[] = [
    {
      title: 'Utilizatori',
      description: 'Management utilizatori, roluri și permisiuni Firebase + BigQuery',
      icon: '👥',
      href: '/admin/setari/utilizatori',
      color: 'bg-gradient-to-br from-indigo-500/20 to-indigo-600/30 border-indigo-200',
      stats: [
        { label: 'Utilizatori activi', value: '2' },
        { label: 'Administratori', value: '1' },
        { label: 'Permisiuni', value: '5 categorii' }
      ]
    },
    {
      title: 'Facturare',
      description: 'Configurare numerotare, serii și parametri facturi',
      icon: '📄',
      href: '/admin/setari/facturare',
      color: 'bg-gradient-to-br from-blue-500/20 to-blue-600/30 border-blue-200',
      stats: [
        { label: 'Serie curentă', value: 'INV-{proiectId}' },
        { label: 'Proforme', value: 'PRF' },
        { label: 'Delay e-factura', value: '30 min' }
      ]
    },
    {
      title: 'e-Factura',
      description: 'Configurare metodă transmitere ANAF: iapp.ro sau OAuth direct',
      icon: '📤',
      href: '/admin/setari/efactura',
      color: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border-emerald-200',
      stats: [
        { label: 'Metodă', value: 'iapp.ro' },
        { label: 'Serie default', value: 'SERIE_TEST' },
        { label: 'Auto-transmitere', value: 'Activă' }
      ]
    },
    {
      title: 'Date Firmă',
      description: 'Informații complete despre companie și date legale',
      icon: '🏢',
      href: '/admin/setari/firma',
      color: 'bg-gradient-to-br from-green-500/20 to-green-600/30 border-green-200',
      stats: [
        { label: 'Firma', value: 'UNITAR PROIECT TDA SRL' },
        { label: 'CUI', value: 'RO35639210' },
        { label: 'Reg. Com.', value: 'J2016002024405' }
      ]
    },
    {
      title: 'Contracte',
      description: 'Configurare numerotare și format pentru contracte, PV-uri și anexe',
      icon: '📋',
      href: '/admin/setari/contracte',
      color: 'bg-gradient-to-br from-purple-500/20 to-purple-600/30 border-purple-200',
      stats: [
        { label: 'Contracte', value: 'CONTR' },
        { label: 'Procese Verbale', value: 'PV' },
        { label: 'Anexe', value: 'ANX' }
      ]
    },
    {
      title: 'Conturi Bancare',
      description: 'Management conturi bancare și configurare tranzacții',
      icon: '🏦',
      href: '/admin/setari/banca',
      color: 'bg-gradient-to-br from-indigo-500/20 to-indigo-600/30 border-indigo-200',
      stats: [
        { label: 'ING Bank', value: 'RO82INGB***7533' },
        { label: 'Trezorerie', value: 'RO29TREZ***8857' }
      ]
    }
  ];

  const systemActions = [
    {
      title: 'Export Setări',
      description: 'Exportă toate configurațiile sistemului',
      icon: '📤',
      action: 'export',
      color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
    },
    {
      title: 'Import Setări',
      description: 'Importă configurații dintr-un backup',
      icon: '📥',
      action: 'import',
      color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
    },
    {
      title: 'Reset Default',
      description: 'Resetează toate setările la valorile implicite',
      icon: '🔄',
      action: 'reset',
      color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
    },
    {
      title: 'Curăță Cache',
      description: 'Șterge cache-ul și datele temporare',
      icon: '🧹',
      action: 'cache',
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
    },
    {
      title: 'Diagnosticare',
      description: 'Verifică starea sistemului și conexiunile',
      icon: '📊',
      action: 'diagnostic',
      color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
    },
    {
      title: 'ANAF Monitoring',
      description: 'Monitorizare și erori ANAF e-factura',
      icon: '📈',
      action: 'anaf',
      color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
    }
  ];

  // ==================================================================
  // HANDLERS
  // ==================================================================

  const handleSystemAction = (action: string) => {
    switch (action) {
      case 'export':
        // TODO: Implement export
        break;
      case 'import':
        // TODO: Implement import
        break;
      case 'reset':
        // TODO: Implement reset
        break;
      case 'cache':
        // TODO: Implement cache clear
        break;
      case 'diagnostic':
        // TODO: Implement diagnostic
        break;
      case 'anaf':
        router.push('/admin/anaf/monitoring');
        break;
    }
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              ⚙️ Settings Hub
            </h1>
            <p className="text-gray-600 text-lg">
              Configurare completă pentru UNITAR PROIECT - Numerotare, date firmă și parametri sistem
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
          >
            ← Înapoi la Dashboard
          </Button>
        </div>
      </div>

      {/* System Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} variant="default" className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card variant="default" className="p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Tabele Sistem</p>
                <p className="text-3xl font-bold text-blue-600">{stats.tabeleExistente}</p>
              </div>
              <div className="text-4xl opacity-80">🗃️</div>
            </div>
          </Card>

          <Card variant="default" className="p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Versiune App</p>
                <p className="text-3xl font-bold text-green-600">{stats.versiuneApp}</p>
              </div>
              <div className="text-4xl opacity-80">🚀</div>
            </div>
          </Card>

          <Card variant="default" className="p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Ultima Actualizare</p>
                <p className="text-lg font-bold text-purple-600">{stats.ultimaActualizare}</p>
              </div>
              <div className="text-4xl opacity-80">📅</div>
            </div>
          </Card>

          <Card variant="default" className="p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Backup Automat</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.backupAutomat ? 'Activ' : 'Inactiv'}
                </p>
              </div>
              <div className="text-4xl opacity-80">
                {stats.backupAutomat ? '✅' : '❌'}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {settingsCards.map((setting, index) => (
          <Card
            key={index}
            variant="default"
            className={`p-6 cursor-pointer transition-all duration-300 hover:scale-105 ${setting.color}`}
            onClick={() => router.push(setting.href)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  {setting.icon} {setting.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {setting.description}
                </p>
              </div>
            </div>

            {setting.stats && (
              <div className="space-y-3 mb-6">
                {setting.stats.map((stat, statIndex) => (
                  <div
                    key={statIndex}
                    className="flex justify-between items-center p-3 bg-white/30 backdrop-blur-sm rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {stat.label}
                    </span>
                    <span className="text-sm text-gray-600 font-mono">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={() => router.push(setting.href)}
            >
              ⚙️ Configurează
            </Button>
          </Card>
        ))}
      </div>

      {/* System Actions */}
      <Card variant="default" className="p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          🔧 Unelte Sistem
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleSystemAction(action.action)}
              className={`p-4 rounded-xl border transition-all duration-200 hover:scale-105 ${action.color}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{action.icon}</div>
                <div className="text-left">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-xs opacity-80">{action.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Important Notice */}
      <Card variant="warning" className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              ⚠️ Notă Importantă
            </h4>
            <p className="text-sm text-yellow-800">
              Modificările la setări vor afecta generarea documentelor viitoare.
              Documentele existente nu vor fi modificate.
            </p>
          </div>
        </div>
      </Card>
    </ModernLayout>
  );
};

export default ModernSettingsPage;