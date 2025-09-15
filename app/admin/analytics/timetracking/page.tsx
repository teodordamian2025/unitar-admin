import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// ==================================================================
// CALEA: app/admin/analytics/timetracking/page.tsx  
// CREAT: 14.09.2025 12:45 (ora României)
// DESCRIERE: Dashboard principal pentru analiza time tracking
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

export default function TimeTrackingDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');
  
  // State pentru diferite tipuri de date
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [projectData, setProjectData] = useState<ProjectBreakdown[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Fetch parallel pentru toate tipurile de date
      const [overviewResponse, dailyResponse, teamResponse, projectResponse] = await Promise.all([
        fetch(`/api/analytics/time-tracking?type=overview&period=${period}`),
        fetch(`/api/analytics/time-tracking?type=daily-trend&period=${period}`),
        fetch(`/api/analytics/time-tracking?type=team-performance&period=${period}`),
        fetch(`/api/analytics/time-tracking?type=project-breakdown&period=${period}`)
      ]);

      const [overviewData, dailyData, teamMemberData, projectBreakdownData] = await Promise.all([
        overviewResponse.json(),
        dailyResponse.json(),
        teamResponse.json(),
        projectResponse.json()
      ]);

      if (overviewData.success && overviewData.data.length > 0) {
        setOverviewStats(overviewData.data[0]);
      }

      if (dailyData.success) {
        setDailyTrend(dailyData.data);
      }

      if (teamMemberData.success) {
        setTeamData(teamMemberData.data);
      }

      if (projectBreakdownData.success) {
        setProjectData(projectBreakdownData.data);
      }

    } catch (error) {
      console.error('Eroare la încărcarea datelor:', error);
    } finally {
      setLoading(false);
    }
  };

  // Preparare date pentru grafice
  const weeklyPatternData = overviewStats ? [
    { zi: 'Luni', ore: overviewStats.media_luni || 0 },
    { zi: 'Marți', ore: overviewStats.media_marti || 0 },
    { zi: 'Miercuri', ore: overviewStats.media_miercuri || 0 },
    { zi: 'Joi', ore: overviewStats.media_joi || 0 },
    { zi: 'Vineri', ore: overviewStats.media_vineri || 0 },
    { zi: 'Sâmbătă', ore: overviewStats.media_sambata || 0 },
    { zi: 'Duminică', ore: overviewStats.media_duminica || 0 }
  ] : [];

  const priorityDistribution = teamData.length > 0 ? [
    { name: 'Urgent', value: teamData.reduce((sum, member) => sum + member.ore_urgent, 0), color: '#ff4444' },
    { name: 'Ridicată', value: teamData.reduce((sum, member) => sum + member.ore_ridicata, 0), color: '#ff8800' },
    { name: 'Normală', value: teamData.reduce((sum, member) => sum + member.ore_normala, 0), color: '#4CAF50' },
    { name: 'Scăzută', value: teamData.reduce((sum, member) => sum + member.ore_scazuta, 0), color: '#2196F3' }
  ] : [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh' 
      }}>
        <div>Se încarcă analytics...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      {/* Header cu controale */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{ margin: 0, color: '#2c3e50' }}>
          ⏱️ Time Tracking Analytics
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="7">Ultimele 7 zile</option>
            <option value="30">Ultimele 30 zile</option>
            <option value="90">Ultimele 90 zile</option>
            <option value="365">Ultimul an</option>
          </select>
          
          <button
            onClick={fetchAnalyticsData}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        borderBottom: '1px solid #ddd',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'team', label: '👥 Echipa' },
            { id: 'projects', label: '📋 Proiecte' },
            { id: 'trends', label: '📈 Tendințe' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #007bff' : '3px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: activeTab === tab.id ? '#007bff' : '#666'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* KPI Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '14px' }}>Total Ore Lucrate</h3>
              <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#2c3e50' }}>
                {overviewStats?.total_ore_lucrate || 0}h
              </p>
            </div>

            <div style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '14px' }}>Utilizatori Activi</h3>
              <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>
                {overviewStats?.total_utilizatori || 0}
              </p>
            </div>

            <div style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '14px' }}>Media Ore/Zi</h3>
              <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
                {overviewStats?.media_ore_pe_zi || 0}h
              </p>
            </div>

            <div style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '14px' }}>Eficiență</h3>
              <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>
                {overviewStats?.eficienta_procent || 0}%
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: '2rem'
          }}>
            {/* Weekly Pattern */}
            <div style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>📅 Pattern Săptămânal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyPatternData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="zi" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}h`, 'Ore medii']} />
                  <Bar dataKey="ore" fill="#3498db" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Priority Distribution */}
            <div style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>🎯 Distribuție Priorități</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={priorityDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  >
                    {priorityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}h`, 'Ore lucrate']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Team Performance Tab */}
      {activeTab === 'team' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>👥 Performance Echipă</h2>
          
          <div style={{ 
            background: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Utilizator</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Total Ore</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Media/Zi</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Eficiență</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Proiecte</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Sarcini</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Zile Active</th>
                  </tr>
                </thead>
                <tbody>
                  {teamData.map((member, index) => (
                    <tr key={member.utilizator_uid} style={{ 
                      borderBottom: '1px solid #f0f0f0',
                      background: index % 2 === 0 ? 'white' : '#f9f9f9'
                    }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                        {member.utilizator_nume}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {member.total_ore}h
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {member.media_ore_zilnic}h
                      </td>
                      <td style={{ 
                        padding: '1rem', 
                        textAlign: 'center',
                        color: member.eficienta_procent >= 100 ? '#27ae60' : member.eficienta_procent >= 80 ? '#f39c12' : '#e74c3c'
                      }}>
                        {member.eficienta_procent}%
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {member.proiecte_lucrate}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {member.sarcini_lucrate}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {member.zile_active}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>📋 Analiza Proiecte</h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '1.5rem'
          }}>
            {projectData.map((project) => (
              <div key={project.proiect_id} style={{ 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #e0e0e0'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '16px' }}>
                  {project.proiect_nume}
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#666' }}>Status:</span>
                  <span style={{ 
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: project.proiect_status === 'Activ' ? '#d4edda' : '#f8d7da',
                    color: project.proiect_status === 'Activ' ? '#155724' : '#721c24'
                  }}>
                    {project.proiect_status}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#666' }}>Total ore:</span>
                  <span style={{ fontWeight: 'bold' }}>{project.total_ore}h</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#666' }}>Echipă:</span>
                  <span>{project.utilizatori_implicati} persoane</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#666' }}>Progres:</span>
                  <span style={{ 
                    color: project.progres_procent >= 100 ? '#27ae60' : project.progres_procent >= 75 ? '#f39c12' : '#e74c3c',
                    fontWeight: 'bold'
                  }}>
                    {project.progres_procent}%
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>Sarcini:</span>
                  <span>{project.sarcini_lucrate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>📈 Tendințe Temporale</h2>
          
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>Evoluția Zilnică</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="data_lucru" 
                  tickFormatter={formatDate}
                />
                <YAxis yAxisId="ore" orientation="left" />
                <YAxis yAxisId="persoane" orientation="right" />
                <Tooltip 
                  labelFormatter={(label) => `Data: ${label}`}
                  formatter={(value, name) => {
                    if (name === 'total_ore') return [`${value}h`, 'Total ore'];
                    if (name === 'utilizatori_activi') return [`${value}`, 'Utilizatori activi'];
                    if (name === 'proiecte_active') return [`${value}`, 'Proiecte active'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="ore"
                  type="monotone" 
                  dataKey="total_ore" 
                  stroke="#3498db" 
                  strokeWidth={2}
                  name="Total ore"
                />
                <Line 
                  yAxisId="persoane"
                  type="monotone" 
                  dataKey="utilizatori_activi" 
                  stroke="#27ae60" 
                  strokeWidth={2}
                  name="Utilizatori activi"
                />
                <Line 
                  yAxisId="persoane"
                  type="monotone" 
                  dataKey="proiecte_active" 
                  stroke="#f39c12" 
                  strokeWidth={2}
                  name="Proiecte active"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
