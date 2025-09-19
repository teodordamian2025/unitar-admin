"use client";
import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import ModernLayout from '@/app/components/ModernLayout';
import { Card, Button, LoadingSpinner } from '@/app/components/ui';
import { AdvancedLineChart, AdvancedBarChart, AdvancedPieChart } from '@/app/components/charts';
import { toast } from 'react-toastify';

// ==================================================================
// CALEA: app/admin/analytics/timetracking/enhanced-page.tsx
// DATA: 19.09.2025 22:50 (ora României)
// DESCRIERE: Time Tracking Dashboard cu Victory.js advanced charts
// FUNCȚIONALITATE: Analytics modernizat cu glassmorphism și charts avansate
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
  data_lucru: string;
  total_ore: number;
  utilizatori_activi: number;
  proiecte_active: number;
  media_ore_per_utilizator: number;
}

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
  total_ore: number;
  utilizatori_implicati: number;
  sarcini_lucrate: number;
  media_ore_pe_sesiune: number;
  progres_procent: number;
}

export default function EnhancedTimeTrackingDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

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

  useEffect(() => {
    if (isAuthorized) {
      fetchAnalyticsData();
    }
  }, [isAuthorized, period]);

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
      // Mock data - în realitate va fi fetch din API BigQuery
      const mockOverview: OverviewStats = {
        total_utilizatori: 8,
        total_proiecte: 12,
        total_ore_lucrate: 1247,
        media_ore_pe_zi: 6.8,
        eficienta_procent: 87,
        media_luni: 8.2,
        media_marti: 8.5,
        media_miercuri: 7.8,
        media_joi: 8.1,
        media_vineri: 7.5,
        media_sambata: 4.2,
        media_duminica: 2.1
      };

      const mockDailyTrend: DailyTrend[] = [
        { data_lucru: '2025-09-13', total_ore: 45, utilizatori_activi: 6, proiecte_active: 8, media_ore_per_utilizator: 7.5 },
        { data_lucru: '2025-09-14', total_ore: 52, utilizatori_activi: 7, proiecte_active: 10, media_ore_per_utilizator: 7.4 },
        { data_lucru: '2025-09-15', total_ore: 38, utilizatori_activi: 5, proiecte_active: 7, media_ore_per_utilizator: 7.6 },
        { data_lucru: '2025-09-16', total_ore: 47, utilizatori_activi: 6, proiecte_active: 9, media_ore_per_utilizator: 7.8 },
        { data_lucru: '2025-09-17', total_ore: 41, utilizatori_activi: 6, proiecte_active: 8, media_ore_per_utilizator: 6.8 },
        { data_lucru: '2025-09-18', total_ore: 35, utilizatori_activi: 5, proiecte_active: 6, media_ore_per_utilizator: 7.0 },
        { data_lucru: '2025-09-19', total_ore: 28, utilizatori_activi: 4, proiecte_active: 5, media_ore_per_utilizator: 7.0 }
      ];

      const mockTeamData: TeamMember[] = [
        { utilizator_uid: '1', utilizator_nume: 'Maria Popescu', total_ore: 167, media_ore_zilnic: 8.2, zile_active: 22, proiecte_lucrate: 3, sarcini_lucrate: 18, eficienta_procent: 92, ore_urgent: 25, ore_ridicata: 45, ore_normala: 87, ore_scazuta: 10 },
        { utilizator_uid: '2', utilizator_nume: 'Ion Vasile', total_ore: 152, media_ore_zilnic: 7.8, zile_active: 21, proiecte_lucrate: 2, sarcini_lucrate: 15, eficienta_procent: 88, ore_urgent: 20, ore_ridicata: 38, ore_normala: 82, ore_scazuta: 12 },
        { utilizator_uid: '3', utilizator_nume: 'Ana Georgescu', total_ore: 145, media_ore_zilnic: 7.5, zile_active: 20, proiecte_lucrate: 4, sarcini_lucrate: 22, eficienta_procent: 95, ore_urgent: 30, ore_ridicata: 42, ore_normala: 65, ore_scazuta: 8 }
      ];

      const mockProjectData: ProjectBreakdown[] = [
        { proiect_id: '1', proiect_nume: 'Website E-commerce', proiect_status: 'Activ', valoare_estimata: 15000, moneda: 'EUR', total_ore: 284, utilizatori_implicati: 4, sarcini_lucrate: 28, media_ore_pe_sesiune: 5.2, progres_procent: 75 },
        { proiect_id: '2', proiect_nume: 'API Development', proiect_status: 'Activ', valoare_estimata: 8500, moneda: 'EUR', total_ore: 156, utilizatori_implicati: 2, sarcini_lucrate: 15, media_ore_pe_sesiune: 6.8, progres_procent: 45 },
        { proiect_id: '3', proiect_nume: 'Mobile App', proiect_status: 'Întârziat', valoare_estimata: 22000, moneda: 'EUR', total_ore: 378, utilizatori_implicati: 5, sarcini_lucrate: 42, media_ore_pe_sesiune: 4.9, progres_procent: 60 }
      ];

      setOverviewStats(mockOverview);
      setDailyTrend(mockDailyTrend);
      setTeamData(mockTeamData);
      setProjectData(mockProjectData);

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'team', label: '👥 Echipa' },
            { id: 'projects', label: '📋 Proiecte' },
            { id: 'trends', label: '📈 Tendințe' }
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
                  {overviewStats?.total_ore_lucrate || 0}h
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                  Total Ore Lucrate
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {overviewStats?.media_ore_pe_zi || 0}h media zilnică
                </div>
              </div>
            </Card>

            <Card variant="success">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
                  {overviewStats?.total_utilizatori || 0}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                  Utilizatori Activi
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {overviewStats?.total_proiecte || 0} proiecte în lucru
                </div>
              </div>
            </Card>

            <Card variant="warning">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
                  {overviewStats?.eficienta_procent || 0}%
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
                    { x: 'Luni', y: overviewStats?.media_luni || 0 },
                    { x: 'Marți', y: overviewStats?.media_marti || 0 },
                    { x: 'Miercuri', y: overviewStats?.media_miercuri || 0 },
                    { x: 'Joi', y: overviewStats?.media_joi || 0 },
                    { x: 'Vineri', y: overviewStats?.media_vineri || 0 },
                    { x: 'Sâmbătă', y: overviewStats?.media_sambata || 0 },
                    { x: 'Duminică', y: overviewStats?.media_duminica || 0 }
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
                  { x: 'Urgent', y: teamData.reduce((sum, member) => sum + member.ore_urgent, 0), fill: '#ef4444' },
                  { x: 'Ridicată', y: teamData.reduce((sum, member) => sum + member.ore_ridicata, 0), fill: '#f59e0b' },
                  { x: 'Normală', y: teamData.reduce((sum, member) => sum + member.ore_normala, 0), fill: '#10b981' },
                  { x: 'Scăzută', y: teamData.reduce((sum, member) => sum + member.ore_scazuta, 0), fill: '#3b82f6' }
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
                  data: dailyTrend.map(item => ({
                    x: new Date(item.data_lucru).getDate() + '/' + (new Date(item.data_lucru).getMonth() + 1),
                    y: item.total_ore
                  })),
                  color: '#3b82f6',
                  area: true
                },
                {
                  name: 'Utilizatori Activi',
                  data: dailyTrend.map(item => ({
                    x: new Date(item.data_lucru).getDate() + '/' + (new Date(item.data_lucru).getMonth() + 1),
                    y: item.utilizatori_activi * 8 // Scalare pentru vizibilitate
                  })),
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
              <Card key={member.utilizator_uid} variant="primary">
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
                    👤 {member.utilizator_nume}
                  </h3>
                  <div style={{
                    background: member.eficienta_procent >= 90
                      ? 'rgba(16, 185, 129, 0.1)'
                      : member.eficienta_procent >= 80
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    color: member.eficienta_procent >= 90
                      ? '#10b981'
                      : member.eficienta_procent >= 80
                        ? '#f59e0b'
                        : '#ef4444',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {member.eficienta_procent}% eficiență
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
                      {member.total_ore}h
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Total ore
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {member.media_ore_zilnic}h
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Media zilnică
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {member.proiecte_lucrate}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Proiecte
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {member.sarcini_lucrate}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Sarcini
                    </div>
                  </div>
                </div>

                {/* Individual Priority Chart */}
                <AdvancedPieChart
                  data={[
                    { x: 'Urgent', y: member.ore_urgent, fill: '#ef4444' },
                    { x: 'Ridicată', y: member.ore_ridicata, fill: '#f59e0b' },
                    { x: 'Normală', y: member.ore_normala, fill: '#10b981' },
                    { x: 'Scăzută', y: member.ore_scazuta, fill: '#3b82f6' }
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {projectData.map((project) => (
              <Card key={project.proiect_id} variant={
                project.proiect_status === 'Activ' ? 'success' :
                project.proiect_status === 'Întârziat' ? 'warning' : 'primary'
              }>
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
                    📋 {project.proiect_nume}
                  </h3>
                  <div style={{
                    background: project.proiect_status === 'Activ'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(245, 158, 11, 0.1)',
                    color: project.proiect_status === 'Activ'
                      ? '#10b981'
                      : '#f59e0b',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {project.proiect_status}
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
                      {project.total_ore}h
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Total ore
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {project.progres_procent}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Progres
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {project.utilizatori_implicati}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Echipă
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      {project.valoare_estimata.toLocaleString()}€
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Valoare
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                  background: 'rgba(156, 163, 175, 0.2)',
                  borderRadius: '8px',
                  height: '8px',
                  overflow: 'hidden',
                  marginTop: '1rem'
                }}>
                  <div style={{
                    background: project.progres_procent >= 80
                      ? '#10b981'
                      : project.progres_procent >= 50
                        ? '#f59e0b'
                        : '#ef4444',
                    height: '100%',
                    width: `${project.progres_procent}%`,
                    borderRadius: '8px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </Card>
            ))}
          </div>

          {/* Project Performance Chart */}
          <Card>
            <AdvancedBarChart
              data={[
                {
                  name: 'Ore Lucrate',
                  data: projectData.map(project => ({
                    x: project.proiect_nume.length > 15
                      ? project.proiect_nume.substring(0, 15) + '...'
                      : project.proiect_nume,
                    y: project.total_ore
                  })),
                  color: '#3b82f6'
                },
                {
                  name: 'Progres %',
                  data: projectData.map(project => ({
                    x: project.proiect_nume.length > 15
                      ? project.proiect_nume.substring(0, 15) + '...'
                      : project.proiect_nume,
                    y: project.progres_procent
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
                  data: dailyTrend.map(item => ({
                    x: new Date(item.data_lucru).getDate() + '/' + (new Date(item.data_lucru).getMonth() + 1),
                    y: item.total_ore
                  })),
                  color: '#3b82f6',
                  area: true
                },
                {
                  name: 'Utilizatori Activi',
                  data: dailyTrend.map(item => ({
                    x: new Date(item.data_lucru).getDate() + '/' + (new Date(item.data_lucru).getMonth() + 1),
                    y: item.utilizatori_activi * 8
                  })),
                  color: '#10b981'
                },
                {
                  name: 'Proiecte Active',
                  data: dailyTrend.map(item => ({
                    x: new Date(item.data_lucru).getDate() + '/' + (new Date(item.data_lucru).getMonth() + 1),
                    y: item.proiecte_active * 5
                  })),
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
    </ModernLayout>
  );
}