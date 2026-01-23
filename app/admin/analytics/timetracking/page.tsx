"use client";
import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, LoadingSpinner } from '@/app/components/ui';
import { AdvancedLineChart, AdvancedBarChart, AdvancedPieChart } from '@/app/components/charts';
import { toast } from 'react-toastify';
import { useTimer } from '@/app/contexts/TimerContext';
import { analyticsCache } from '@/app/lib/analyticsCache';
import AdminTimeTrackingHistory from './components/AdminTimeTrackingHistory';

// ==================================================================
// CALEA: app/admin/analytics/timetracking/page.tsx
// DATA: 19.01.2026 (ora României) - UPDATED: Adăugat tab Istoric
// DESCRIERE: Time Tracking Dashboard cu Victory.js advanced charts + Istoric
// FUNCȚIONALITATE: Analytics modernizat - cache 5min, ZERO polling, lazy load tabs + Istoric admin
// ==================================================================

interface OverviewStats {
  total_utilizatori: number;
  total_proiecte: number;
  total_ore_lucrate: number;
  media_ore_pe_zi: number;
  eficienta_procent: number;
  media_luni: number;
  media_marti: number;
  media_miercuri: number;
  media_joi: number;
  media_vineri: number;
  media_sambata: number;
  media_duminica: number;
}

interface DailyTrend {
  data_lucru: string | { value: string };
  total_ore: number;
  utilizatori_activi: number;
  proiecte_active: number;
  media_ore_per_utilizator: number;
}

// Helper function to parse BigQuery DATE fields (returns {value: "date"} or string)
const parseBigQueryDate = (dateField: any): Date => {
  const dateValue = dateField?.value || dateField;
  return new Date(dateValue);
};

// Helper function to parse BigQuery NUMERIC fields (returns string, BigDecimal object, or number)
// BigQuery NUMERIC/FLOAT64 fields can come as: "123.45", {value: "123.45"}, or actual numbers
const parseBigQueryNumeric = (numericField: any): number => {
  if (numericField === null || numericField === undefined) return 0;
  // Handle object with .value property
  const value = numericField?.value !== undefined ? numericField.value : numericField;
  // Convert to number
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  // Return 0 if NaN
  return isNaN(parsed) ? 0 : parsed;
};

interface TeamMember {
  utilizator_uid: string;
  utilizator_nume: string;
  total_ore: number;
  media_ore_zilnic: number;
  zile_active: number;
  proiecte_lucrate: number;
  sarcini_lucrate: number;
  eficienta_procent: number;
  ore_urgent: number;
  ore_ridicata: number;
  ore_normala: number;
  ore_scazuta: number;
}

interface ProjectBreakdown {
  proiect_id: string;
  proiect_nume: string;
  proiect_status: string;
  valoare_estimata: number;
  moneda: string;
  valoare_ron: number;
  curs_valutar: number;
  total_ore: number;
  utilizatori_implicati: number;
  sarcini_lucrate: number;
  media_ore_pe_sesiune: number;
  progres_procent: number;
  // ✅ 23.01.2026: Date financiare extinse pentru admin
  progres_economic: number;
  cheltuieli_directe: number;
  cheltuieli_directe_ron: number;
  cost_timp_lucrat: number;
  cost_total: number;
  profit_pierdere: number;
  este_profitabil: boolean;
  ore_alocate_disponibile: number;
  cost_ora: number;
  moneda_cost: string;
}

export default function EnhancedTimeTrackingDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [period, setPeriod] = useState('30');
  const [debouncedPeriod, setDebouncedPeriod] = useState('30'); // ✅ Debounced value
  const [activeTab, setActiveTab] = useState('overview');
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // ✅ CONSUMĂ DATE DIN TIMERCONTEXT (ZERO DUPLICATE REQUESTS)
  const { activeSession: contextSession, hasActiveSession: contextHasActiveSession } = useTimer();

  // State pentru diferite tipuri de date
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [projectData, setProjectData] = useState<ProjectBreakdown[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    checkUserRole();
  }, [user, loading, router]);

  // ✅ DEBOUNCE: Delay 500ms pentru schimbare perioadă (reduce API calls la typing rapid)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPeriod(period);
    }, 500);

    return () => clearTimeout(timer);
  }, [period]);

  // ✅ OPTIMIZED: Load data DOAR la mount și când se schimbă perioada debounced - FĂRĂ polling
  useEffect(() => {
    if (isAuthorized) {
      fetchAnalyticsData();
      console.log('✅ Analytics data loaded - NO POLLING (refresh doar la schimbare perioadă debounced)');
    }
  }, [isAuthorized, debouncedPeriod]);

  // ✅ Refresh automat când se schimbă starea timer-ului (opțional - doar dacă vrei live updates)
  useEffect(() => {
    if (isAuthorized && contextHasActiveSession !== null) {
      // Opțional: refresh analytics când timer-ul se schimbă
      // fetchAnalyticsData();
      console.log('Timer state changed:', { hasActiveSession: contextHasActiveSession });
    }
  }, [contextHasActiveSession]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();

      if (data.success && data.role === 'admin') {
        setUserRole(data.role);
        setDisplayName(localStorage.getItem('displayName') || 'Admin');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi Time Tracking!');
        router.push('/admin');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/admin');
    }
  };

  const fetchAnalyticsData = async () => {
    setLoadingData(true);
    try {
      // ✅ CHECK CACHE FIRST (reducere 80-90% API calls) - folosește debouncedPeriod
      const cachedOverview = analyticsCache.get<any>('overview', debouncedPeriod, user?.uid);
      const cachedDailyTrend = analyticsCache.get<any[]>('daily-trend', debouncedPeriod, user?.uid);
      const cachedTeam = analyticsCache.get<any[]>('team-performance', debouncedPeriod, user?.uid);
      const cachedProject = analyticsCache.get<any[]>('project-breakdown', debouncedPeriod, user?.uid);

      // Dacă toate sunt în cache, folosește cache-ul
      if (cachedOverview && cachedDailyTrend && cachedTeam && cachedProject) {
        console.log('✅ ALL DATA FROM CACHE - ZERO API CALLS');
        setOverviewStats(cachedOverview.data?.[0] || null);
        setDailyTrend(cachedDailyTrend);
        setTeamData(cachedTeam);
        setProjectData(cachedProject);
        setLoadingData(false);
        return;
      }

      // ✅ FETCH doar ce lipsește din cache
      const promises: Promise<Response>[] = [];
      const types: string[] = [];

      if (!cachedOverview) {
        promises.push(fetch(`/api/analytics/time-tracking?type=overview&period=${debouncedPeriod}`));
        types.push('overview');
      }
      if (!cachedDailyTrend) {
        promises.push(fetch(`/api/analytics/time-tracking?type=daily-trend&period=${debouncedPeriod}`));
        types.push('daily-trend');
      }
      if (!cachedTeam) {
        promises.push(fetch(`/api/analytics/time-tracking?type=team-performance&period=${debouncedPeriod}`));
        types.push('team-performance');
      }
      if (!cachedProject) {
        promises.push(fetch(`/api/analytics/time-tracking?type=project-breakdown&period=${debouncedPeriod}`));
        types.push('project-breakdown');
      }

      const responses = await Promise.all(promises);
      const dataResults = await Promise.all(responses.map(r => r.json()));

      // Procesează și cache-ază rezultatele
      let overviewData = cachedOverview;
      let dailyTrendData = cachedDailyTrend;
      let teamData = cachedTeam;
      let projectData = cachedProject;

      dataResults.forEach((data, index) => {
        const type = types[index];
        if (type === 'overview') {
          overviewData = data;
          analyticsCache.set('overview', debouncedPeriod, data, user?.uid);
        } else if (type === 'daily-trend') {
          dailyTrendData = data.data || [];
          analyticsCache.set('daily-trend', debouncedPeriod, data.data || [], user?.uid);
        } else if (type === 'team-performance') {
          teamData = data.data || [];
          analyticsCache.set('team-performance', debouncedPeriod, data.data || [], user?.uid);
        } else if (type === 'project-breakdown') {
          projectData = data.data || [];
          analyticsCache.set('project-breakdown', debouncedPeriod, data.data || [], user?.uid);
        }
      });

      // Process overview data (dacă e din API, nu din cache)
      if (overviewData && !cachedOverview) {
        if (overviewData.success && overviewData.data?.length > 0) {
          const stats = overviewData.data[0];
          setOverviewStats({
            total_utilizatori: stats.total_utilizatori || 0,
            total_proiecte: stats.total_proiecte || 0,
            total_ore_lucrate: stats.total_ore_lucrate || 0,
            media_ore_pe_zi: stats.media_ore_pe_zi || 0,
            eficienta_procent: stats.eficienta_procent || 0,
            media_luni: stats.media_luni || 0,
            media_marti: stats.media_marti || 0,
            media_miercuri: stats.media_miercuri || 0,
            media_joi: stats.media_joi || 0,
            media_vineri: stats.media_vineri || 0,
            media_sambata: stats.media_sambata || 0,
            media_duminica: stats.media_duminica || 0
          });
        } else {
          setOverviewStats(null);
        }
      } else if (cachedOverview) {
        // Din cache - deja setat mai sus
        if (cachedOverview.data?.[0]) {
          setOverviewStats(cachedOverview.data[0]);
        }
      }

      // Process daily trend data
      if (!cachedDailyTrend && dailyTrendData) {
        setDailyTrend(dailyTrendData);
      }

      // Process team data
      if (!cachedTeam && teamData) {
        setTeamData(teamData);
      }

      // Process project data
      if (!cachedProject && projectData) {
        setProjectData(projectData);
      }

      console.log('📊 TimeTracking data loaded:', {
        overview: cachedOverview ? 'from cache' : 'from API',
        dailyTrend: (cachedDailyTrend || dailyTrendData)?.length || 0,
        team: (cachedTeam || teamData)?.length || 0,
        projects: (cachedProject || projectData)?.length || 0
      });

    } catch (error) {
      console.error('Eroare la încărcarea datelor:', error);
      toast.error('Eroare la încărcarea datelor analytics!');
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || !isAuthorized) {
    return <LoadingSpinner overlay message="Se încarcă Time Tracking Analytics..." />;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Header cu controale */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
            ⏱️ Time Tracking Analytics
          </h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Analiză detaliată activitate echipă și time tracking
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              fontSize: '14px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              color: '#1f2937'
            }}
          >
            <option value="7">Ultimele 7 zile</option>
            <option value="30">Ultimele 30 zile</option>
            <option value="90">Ultimele 90 zile</option>
            <option value="365">Ultimul an</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            icon="🔄"
            onClick={fetchAnalyticsData}
            loading={loadingData}
          >
            Actualizează
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Card style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'team', label: '👥 Echipa' },
            { id: 'projects', label: '📋 Proiecte' },
            { id: 'trends', label: '📈 Tendințe' },
            { id: 'istoric', label: '📋 Istoric' }
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <Card variant="primary">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏱️</div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
                  {parseBigQueryNumeric(overviewStats?.total_ore_lucrate)}h
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                  Total Ore Lucrate
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {parseBigQueryNumeric(overviewStats?.media_ore_pe_zi)}h media zilnică
                </div>
              </div>
            </Card>

            <Card variant="success">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
                  {parseBigQueryNumeric(overviewStats?.total_utilizatori)}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                  Utilizatori Activi
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {parseBigQueryNumeric(overviewStats?.total_proiecte)} proiecte în lucru
                </div>
              </div>
            </Card>

            <Card variant="warning">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
                  {parseBigQueryNumeric(overviewStats?.eficienta_procent)}%
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                  Eficiență Echipă
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  față de obiectivele setate
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '2rem',
            marginBottom: '2rem'
          }}>
            {/* Weekly Pattern Chart */}
            <Card>
              <AdvancedBarChart
                data={[{
                  name: 'Ore Medii',
                  data: [
                    { x: 'Luni', y: parseBigQueryNumeric(overviewStats?.media_luni) },
                    { x: 'Marți', y: parseBigQueryNumeric(overviewStats?.media_marti) },
                    { x: 'Miercuri', y: parseBigQueryNumeric(overviewStats?.media_miercuri) },
                    { x: 'Joi', y: parseBigQueryNumeric(overviewStats?.media_joi) },
                    { x: 'Vineri', y: parseBigQueryNumeric(overviewStats?.media_vineri) },
                    { x: 'Sâmbătă', y: parseBigQueryNumeric(overviewStats?.media_sambata) },
                    { x: 'Duminică', y: parseBigQueryNumeric(overviewStats?.media_duminica) }
                  ],
                  color: '#3b82f6'
                }]}
                title="📅 Pattern Săptămânal - Ore Medii"
                width={480}
                height={300}
                xAxisLabel="Ziua Săptămânii"
                yAxisLabel="Ore"
                showLegend={false}
                animate={true}
              />
            </Card>

            {/* Priority Distribution */}
            <Card>
              <AdvancedPieChart
                data={teamData.length > 0 ? [
                  { x: 'Urgent', y: teamData.reduce((sum, member) => sum + parseBigQueryNumeric(member.ore_urgent), 0), fill: '#ef4444' },
                  { x: 'Ridicată', y: teamData.reduce((sum, member) => sum + parseBigQueryNumeric(member.ore_ridicata), 0), fill: '#f59e0b' },
                  { x: 'Normală', y: teamData.reduce((sum, member) => sum + parseBigQueryNumeric(member.ore_normala), 0), fill: '#10b981' },
                  { x: 'Scăzută', y: teamData.reduce((sum, member) => sum + parseBigQueryNumeric(member.ore_scazuta), 0), fill: '#3b82f6' }
                ] : []}
                title="🎯 Distribuție Priorități Sarcini"
                width={480}
                height={300}
                innerRadius={70}
                showLegend={true}
                animate={true}
              />
            </Card>
          </div>

          {/* Daily Trends */}
          <Card>
            <AdvancedLineChart
              data={[
                {
                  name: 'Total Ore',
                  data: dailyTrend.map(item => {
                    const date = parseBigQueryDate(item.data_lucru);
                    return {
                      x: date.getDate() + '/' + (date.getMonth() + 1),
                      y: parseBigQueryNumeric(item.total_ore)
                    };
                  }),
                  color: '#3b82f6',
                  area: true
                },
                {
                  name: 'Utilizatori Activi',
                  data: dailyTrend.map(item => {
                    const date = parseBigQueryDate(item.data_lucru);
                    return {
                      x: date.getDate() + '/' + (date.getMonth() + 1),
                      y: parseBigQueryNumeric(item.utilizatori_activi) * 8 // Scalare pentru vizibilitate
                    };
                  }),
                  color: '#10b981'
                }
              ]}
              title="📈 Tendințe Zilnice - Ultimele 7 Zile"
              width={800}
              height={400}
              xAxisLabel="Data"
              yAxisLabel="Valoare"
              showLegend={true}
              animate={true}
            />
          </Card>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div>
          {/* Team Performance Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {teamData.map((member) => (
              <Card
                key={member.utilizator_uid}
                variant="primary"
                style={{
                  // ✅ 23.01.2026: Îmbunătățire contrast card - fundal mai vizibil
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: '#1f2937'
                  }}>
                    👤 {member.utilizator_nume || 'Utilizator necunoscut'}
                  </h3>
                  <div style={{
                    background: parseBigQueryNumeric(member.eficienta_procent) >= 90
                      ? 'rgba(16, 185, 129, 0.15)'
                      : parseBigQueryNumeric(member.eficienta_procent) >= 80
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    color: parseBigQueryNumeric(member.eficienta_procent) >= 90
                      ? '#059669'
                      : parseBigQueryNumeric(member.eficienta_procent) >= 80
                        ? '#d97706'
                        : '#dc2626',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {parseBigQueryNumeric(member.eficienta_procent)}% eficiență
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {parseBigQueryNumeric(member.total_ore)}h
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Total ore
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {parseBigQueryNumeric(member.media_ore_zilnic)}h
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Media zilnică
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {parseBigQueryNumeric(member.proiecte_lucrate)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Proiecte
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {parseBigQueryNumeric(member.sarcini_lucrate)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Sarcini
                    </div>
                  </div>
                </div>

                {/* Individual Priority Chart */}
                <AdvancedPieChart
                  data={[
                    { x: 'Urgent', y: parseBigQueryNumeric(member.ore_urgent), fill: '#ef4444' },
                    { x: 'Ridicată', y: parseBigQueryNumeric(member.ore_ridicata), fill: '#f59e0b' },
                    { x: 'Normală', y: parseBigQueryNumeric(member.ore_normala), fill: '#10b981' },
                    { x: 'Scăzută', y: parseBigQueryNumeric(member.ore_scazuta), fill: '#3b82f6' }
                  ]}
                  width={280}
                  height={200}
                  innerRadius={40}
                  showLegend={false}
                  showLabels={false}
                  showValues={true}
                  animate={true}
                />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {projectData.map((project) => {
              // ✅ 23.01.2026: Funcții helper pentru culori progres
              const progresGeneral = parseBigQueryNumeric(project.progres_procent);
              const progresEconomic = parseBigQueryNumeric(project.progres_economic);
              const esteProfitabil = project.este_profitabil;

              // Culori progres general: gri → albastru → portocaliu → verde
              const getGeneralColor = (p: number) => {
                if (p >= 100) return '#22c55e'; // verde - finalizat
                if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                if (p >= 50) return '#3b82f6';  // albastru - în progres
                return '#6b7280';               // gri - început
              };

              // Culori progres economic: gri → verde → portocaliu → roșu (depășire)
              const getEconomicColor = (p: number) => {
                if (p >= 100) return '#ef4444'; // roșu - depășire
                if (p >= 80) return '#f59e0b';  // portocaliu - aproape
                if (p >= 50) return '#22c55e';  // verde - zona optimă
                return '#6b7280';               // gri - început
              };

              // ✅ 23.01.2026: Culori pentru bordură în funcție de status
              const getStatusBorderColor = () => {
                if (project.proiect_status === 'Activ') return 'rgba(16, 185, 129, 0.3)';
                if (project.proiect_status === 'Întârziat') return 'rgba(245, 158, 11, 0.3)';
                return 'rgba(59, 130, 246, 0.25)';
              };

              const getStatusShadow = () => {
                if (project.proiect_status === 'Activ') return '0 4px 20px rgba(16, 185, 129, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08)';
                if (project.proiect_status === 'Întârziat') return '0 4px 20px rgba(245, 158, 11, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08)';
                return '0 4px 20px rgba(59, 130, 246, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)';
              };

              return (
                <Card
                  key={project.proiect_id}
                  variant={
                    project.proiect_status === 'Activ' ? 'success' :
                    project.proiect_status === 'Întârziat' ? 'warning' : 'primary'
                  }
                  style={{
                    // ✅ 23.01.2026: Îmbunătățire contrast card - fundal mai vizibil
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: `1px solid ${getStatusBorderColor()}`,
                    boxShadow: getStatusShadow()
                  }}
                >
                  {/* Header cu nume și status */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.15rem',
                      fontWeight: '700',
                      color: '#1f2937',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingRight: '0.5rem'
                    }}>
                      📋 {project.proiect_nume || 'Proiect necunoscut'}
                    </h3>
                    <div style={{
                      background: (project.proiect_status || 'Necunoscut') === 'Activ'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                      color: (project.proiect_status || 'Necunoscut') === 'Activ'
                        ? '#059669'
                        : '#d97706',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>
                      {project.proiect_status || 'Necunoscut'}
                    </div>
                  </div>

                  {/* ✅ Bare de progres Gen/Eco - ca în ProiecteTable */}
                  <div style={{
                    background: 'rgba(241, 245, 249, 0.8)',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    border: '1px solid rgba(203, 213, 225, 0.5)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {/* Progres General */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280', minWidth: '70px', fontWeight: '500' }}>Gen (ore)</span>
                        <div style={{
                          flex: 1,
                          height: '8px',
                          backgroundColor: 'rgba(203, 213, 225, 0.6)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(progresGeneral, 100)}%`,
                            height: '100%',
                            backgroundColor: getGeneralColor(progresGeneral),
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: getGeneralColor(progresGeneral),
                          minWidth: '45px',
                          textAlign: 'right'
                        }}>
                          {progresGeneral.toFixed(0)}%
                        </span>
                      </div>
                      {/* Progres Economic */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280', minWidth: '70px', fontWeight: '500' }}>Eco (buget)</span>
                        <div style={{
                          flex: 1,
                          height: '8px',
                          backgroundColor: 'rgba(203, 213, 225, 0.6)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(progresEconomic, 100)}%`,
                            height: '100%',
                            backgroundColor: getEconomicColor(progresEconomic),
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: getEconomicColor(progresEconomic),
                          minWidth: '45px',
                          textAlign: 'right'
                        }}>
                          {progresEconomic > 100 ? Math.round(progresEconomic) : progresEconomic.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statistici principale */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#3b82f6' }}>
                        {parseBigQueryNumeric(project.total_ore)}h
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Ore lucrate
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                        {parseBigQueryNumeric(project.utilizatori_implicati)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Echipă
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                        {parseBigQueryNumeric(project.sarcini_lucrate)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Sarcini
                      </div>
                    </div>
                  </div>

                  {/* ✅ Informații financiare - ca în FinancialStatsCard */}
                  <div style={{
                    background: 'rgba(241, 245, 249, 0.8)',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    border: '1px solid rgba(203, 213, 225, 0.5)'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      fontSize: '12px'
                    }}>
                      {/* Valoare proiect */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.375rem 0.5rem',
                        background: 'rgba(59, 130, 246, 0.12)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #3b82f6'
                      }}>
                        <span style={{ color: '#475569' }}>Valoare</span>
                        <span style={{ fontWeight: '600', color: '#2563eb' }}>
                          {parseBigQueryNumeric(project.valoare_estimata).toLocaleString('ro-RO')} {project.moneda || 'EUR'}
                        </span>
                      </div>

                      {/* Cheltuieli directe */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.375rem 0.5rem',
                        background: 'rgba(239, 68, 68, 0.12)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #ef4444'
                      }}>
                        <span style={{ color: '#475569' }}>Cheltuieli</span>
                        <span style={{ fontWeight: '600', color: '#dc2626' }}>
                          -{parseBigQueryNumeric(project.cheltuieli_directe).toLocaleString('ro-RO')} {project.moneda || 'EUR'}
                        </span>
                      </div>

                      {/* Cost timp lucrat */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.375rem 0.5rem',
                        background: 'rgba(245, 158, 11, 0.12)',
                        borderRadius: '6px',
                        borderLeft: '3px solid #f59e0b'
                      }}>
                        <span style={{ color: '#475569' }}>Cost timp</span>
                        <span style={{ fontWeight: '600', color: '#d97706' }}>
                          -{parseBigQueryNumeric(project.cost_timp_lucrat).toLocaleString('ro-RO')} {project.moneda_cost || 'EUR'}
                        </span>
                      </div>

                      {/* Profit/Pierdere */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.375rem 0.5rem',
                        background: esteProfitabil ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                        borderRadius: '6px',
                        borderLeft: `3px solid ${esteProfitabil ? '#059669' : '#dc2626'}`
                      }}>
                        <span style={{ color: '#475569' }}>{esteProfitabil ? 'Profit' : 'Pierdere'}</span>
                        <span style={{ fontWeight: '700', color: esteProfitabil ? '#059669' : '#dc2626' }}>
                          {esteProfitabil ? '+' : ''}{parseBigQueryNumeric(project.profit_pierdere).toLocaleString('ro-RO')} {project.moneda || 'EUR'}
                        </span>
                      </div>
                    </div>

                    {/* Info cost orar */}
                    <div style={{
                      marginTop: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(148, 163, 184, 0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '10px',
                      color: '#64748b'
                    }}>
                      <span>
                        Cost: {parseBigQueryNumeric(project.cost_ora)} {project.moneda_cost || 'EUR'}/oră
                      </span>
                      <span>
                        Ore disponibile: {parseBigQueryNumeric(project.ore_alocate_disponibile).toFixed(0)}h
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Project Performance Chart */}
          <Card>
            <AdvancedBarChart
              data={[
                {
                  name: 'Ore Lucrate',
                  data: projectData.map(project => ({
                    x: (project.proiect_nume || 'Proiect necunoscut').length > 15
                      ? (project.proiect_nume || 'Proiect necunoscut').substring(0, 15) + '...'
                      : (project.proiect_nume || 'Proiect necunoscut'),
                    y: parseBigQueryNumeric(project.total_ore)
                  })),
                  color: '#3b82f6'
                },
                {
                  name: 'Progres %',
                  data: projectData.map(project => ({
                    x: (project.proiect_nume || 'Proiect necunoscut').length > 15
                      ? (project.proiect_nume || 'Proiect necunoscut').substring(0, 15) + '...'
                      : (project.proiect_nume || 'Proiect necunoscut'),
                    y: parseBigQueryNumeric(project.progres_procent)
                  })),
                  color: '#10b981'
                }
              ]}
              title="📊 Performanță Proiecte - Ore vs Progres"
              width={800}
              height={400}
              xAxisLabel="Proiecte"
              yAxisLabel="Valoare"
              groupType="grouped"
              showLegend={true}
              animate={true}
            />
          </Card>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div>
          <Card>
            <AdvancedLineChart
              data={[
                {
                  name: 'Total Ore',
                  data: dailyTrend.map(item => {
                    const date = parseBigQueryDate(item.data_lucru);
                    return {
                      x: date.getDate() + '/' + (date.getMonth() + 1),
                      y: parseBigQueryNumeric(item.total_ore)
                    };
                  }),
                  color: '#3b82f6',
                  area: true
                },
                {
                  name: 'Utilizatori Activi',
                  data: dailyTrend.map(item => {
                    const date = parseBigQueryDate(item.data_lucru);
                    return {
                      x: date.getDate() + '/' + (date.getMonth() + 1),
                      y: parseBigQueryNumeric(item.utilizatori_activi) * 8
                    };
                  }),
                  color: '#10b981'
                },
                {
                  name: 'Proiecte Active',
                  data: dailyTrend.map(item => {
                    const date = parseBigQueryDate(item.data_lucru);
                    return {
                      x: date.getDate() + '/' + (date.getMonth() + 1),
                      y: parseBigQueryNumeric(item.proiecte_active) * 5
                    };
                  }),
                  color: '#f59e0b'
                }
              ]}
              title="📈 Evoluția Zilnică Completă"
              width={900}
              height={500}
              xAxisLabel="Data"
              yAxisLabel="Valoare (scalată pentru vizibilitate)"
              showLegend={true}
              animate={true}
            />
          </Card>
        </div>
      )}

      {/* Istoric Tab */}
      {activeTab === 'istoric' && user && (
        <AdminTimeTrackingHistory user={user} />
      )}
    </ModernLayout>
  );
}