import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

// ==================================================================
// CALEA: app/admin/analytics/components/TeamPerformanceDetail.tsx
// CREAT: 14.09.2025 16:30 (ora României)
// DESCRIERE: Analiza detaliată performance echipă cu heatmap și insights
// ==================================================================

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
  sarcini_la_timp: number;
  sarcini_intarziate: number;
  media_echipa: number;
  trend_saptamanal: 'up' | 'down' | 'stable';
  skill_categories: { [key: string]: number };
  workload_status: 'under' | 'optimal' | 'over';
  burnout_risk: 'low' | 'medium' | 'high';
}

interface DailyActivity {
  data: string;
  utilizator_uid: string;
  ore_lucrate: number;
  sarcini_complete: number;
  eficienta: number;
}

interface SkillAnalysis {
  skill_name: string;
  total_hours: number;
  avg_efficiency: number;
  team_members: number;
  growth_trend: 'up' | 'down' | 'stable';
}

interface TeamPerformanceDetailProps {
  selectedTeamMember?: string;
  period?: number;
  showComparison?: boolean;
  onMemberSelect?: (memberId: string) => void;
}

export default function TeamPerformanceDetail({
  selectedTeamMember,
  period = 30,
  showComparison = true,
  onMemberSelect
}: TeamPerformanceDetailProps) {
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [skillsAnalysis, setSkillsAnalysis] = useState<SkillAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(selectedTeamMember || '');
  const [viewMode, setViewMode] = useState<'overview' | 'individual' | 'comparison' | 'skills'>('overview');

  useEffect(() => {
    fetchTeamPerformanceData();
  }, [period, selectedMember]);

  const fetchTeamPerformanceData = async () => {
    setLoading(true);
    try {
      const [teamResponse, activityResponse, skillsResponse] = await Promise.all([
        fetch(`/api/analytics/team-performance?period=${period}&detailed=true`),
        fetch(`/api/analytics/daily-activity?period=${period}${selectedMember ? `&user_id=${selectedMember}` : ''}`),
        fetch(`/api/analytics/skills-analysis?period=${period}`)
      ]);

      const [teamResult, activityResult, skillsResult] = await Promise.all([
        teamResponse.json(),
        activityResponse.json(),
        skillsResponse.json()
      ]);

      if (teamResult.success) setTeamData(teamResult.data);
      if (activityResult.success) setDailyActivity(activityResult.data);
      if (skillsResult.success) setSkillsAnalysis(skillsResult.data);

    } catch (error) {
      console.error('Eroare la încărcarea datelor performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateHeatmapData = () => {
    const heatmapData: { [key: string]: { [key: string]: number } } = {};
    
    dailyActivity.forEach(activity => {
      const date = new Date(activity.data);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const weekOfYear = Math.ceil(date.getDate() / 7);
      
      const memberName = teamData.find(m => m.utilizator_uid === activity.utilizator_uid)?.utilizator_nume || 'Unknown';
      
      if (!heatmapData[memberName]) {
        heatmapData[memberName] = {};
      }
      
      const key = `${weekOfYear}-${dayOfWeek}`;
      heatmapData[memberName][key] = (heatmapData[memberName][key] || 0) + activity.ore_lucrate;
    });

    return heatmapData;
  };

  const getWorkloadColor = (status: string) => {
    switch (status) {
      case 'under': return '#3498db';
      case 'optimal': return '#27ae60';
      case 'over': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getBurnoutColor = (risk: string) => {
    switch (risk) {
      case 'low': return '#27ae60';
      case 'medium': return '#f39c12';
      case 'high': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '❓';
    }
  };

  const getSelectedMemberData = () => {
    return teamData.find(member => member.utilizator_uid === selectedMember);
  };

  const generateRadarData = (member: TeamMember) => {
    return [
      { skill: 'Eficiență', value: member.eficienta_procent, fullMark: 150 },
      { skill: 'Productivitate', value: (member.total_ore / member.zile_active) * 10, fullMark: 100 },
      { skill: 'Consistență', value: member.zile_active / period * 100, fullMark: 100 },
      { skill: 'Calitate', value: (member.sarcini_la_timp / (member.sarcini_la_timp + member.sarcini_intarziate)) * 100, fullMark: 100 },
      { skill: 'Diversitate', value: member.proiecte_lucrate * 10, fullMark: 100 },
      { skill: 'Focus', value: Math.max(member.ore_urgent, member.ore_ridicata) / member.total_ore * 100, fullMark: 100 }
    ];
  };

  const heatmapData = generateHeatmapData();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px' 
      }}>
        <div>Se încarcă analiza performance...</div>
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
          👥 Team Performance Analysis
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            value={selectedMember}
            onChange={(e) => {
              setSelectedMember(e.target.value);
              onMemberSelect?.(e.target.value);
            }}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Toată echipa</option>
            {teamData.map(member => (
              <option key={member.utilizator_uid} value={member.utilizator_uid}>
                {member.utilizator_nume}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => window.location.reload()}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="7">7 zile</option>
            <option value="30">30 zile</option>
            <option value="90">90 zile</option>
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        borderBottom: '1px solid #ddd',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[
            { id: 'overview', label: '📊 Overview Echipă' },
            { id: 'individual', label: '👤 Analiza Individuală' },
            { id: 'comparison', label: '⚖️ Comparații' },
            { id: 'skills', label: '🎯 Skills & Growth' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as any)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderBottom: viewMode === tab.id ? '3px solid #007bff' : '3px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: viewMode === tab.id ? '#007bff' : '#666'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {viewMode === 'overview' && (
        <div>
          {/* Team Summary Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {teamData.map((member) => (
              <div
                key={member.utilizator_uid}
                onClick={() => {
                  setSelectedMember(member.utilizator_uid);
                  setViewMode('individual');
                }}
                style={{
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  border: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  position: 'relative'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Member Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>
                    {member.utilizator_nume}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem',
                      backgroundColor: getWorkloadColor(member.workload_status),
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {member.workload_status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '16px' }}>
                      {getTrendIcon(member.trend_saptamanal)}
                    </span>
                  </div>
                </div>

                {/* Key Metrics */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total Ore</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
                      {member.total_ore}h
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Eficiență</div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold',
                      color: member.eficienta_procent >= 100 ? '#27ae60' : member.eficienta_procent >= 80 ? '#f39c12' : '#e74c3c'
                    }}>
                      {member.eficienta_procent}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Proiecte</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3498db' }}>
                      {member.proiecte_lucrate}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>La timp</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#27ae60' }}>
                      {member.sarcini_la_timp}
                    </div>
                  </div>
                </div>

                {/* Burnout Risk Indicator */}
                <div style={{ 
                  padding: '0.5rem',
                  backgroundColor: getBurnoutColor(member.burnout_risk),
                  color: 'white',
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  Risk Burnout: {member.burnout_risk.toUpperCase()}
                </div>

                {/* Comparison cu media echipei */}
                <div style={{ 
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  fontSize: '10px',
                  color: '#666'
                }}>
                  vs Team: {member.eficienta_procent > member.media_echipa ? '+' : ''}{(member.eficienta_procent - member.media_echipa).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          {/* Team Heatmap */}
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>🔥 Activity Heatmap</h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {/* Header zile săptămâna */}
              {['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map(day => (
                <div key={day} style={{
                  padding: '0.5rem',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#666'
                }}>
                  {day}
                </div>
              ))}

              {/* Heatmap cells pentru fiecare membru */}
              {Object.entries(heatmapData).map(([memberName, activities]) => (
                <React.Fragment key={memberName}>
                  {[0, 1, 2, 3, 4, 5, 6].map(day => {
                    const totalHours = Object.entries(activities)
                      .filter(([key]) => key.endsWith(`-${day}`))
                      .reduce((sum, [, hours]) => sum + hours, 0);
                    
                    const intensity = Math.min(totalHours / 8, 1); // Max 8 ore = full intensity
                    
                    return (
                      <div
                        key={`${memberName}-${day}`}
                        style={{
                          width: '30px',
                          height: '20px',
                          backgroundColor: totalHours > 0 
                            ? `rgba(34, 139, 34, ${intensity})` 
                            : '#f0f0f0',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          color: intensity > 0.5 ? 'white' : '#333'
                        }}
                        title={`${memberName}: ${totalHours.toFixed(1)}h`}
                      >
                        {totalHours > 0 ? totalHours.toFixed(0) : ''}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Individual Analysis Tab */}
      {viewMode === 'individual' && selectedMember && (
        <div>
          {(() => {
            const memberData = getSelectedMemberData();
            if (!memberData) return <div>Selectează un membru al echipei</div>;

            return (
              <div>
                {/* Member Header */}
                <div style={{ 
                  background: 'white', 
                  padding: '2rem', 
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: '1px solid #e0e0e0',
                  marginBottom: '2rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>
                        👤 {memberData.utilizator_nume}
                      </h2>
                      <div style={{ display: 'flex', gap: '2rem', fontSize: '14px', color: '#666' }}>
                        <span>📅 {memberData.zile_active} zile active</span>
                        <span>📋 {memberData.sarcini_lucrate} sarcini</span>
                        <span>📁 {memberData.proiecte_lucrate} proiecte</span>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: '2rem', 
                        fontWeight: 'bold',
                        color: memberData.eficienta_procent >= 100 ? '#27ae60' : '#f39c12'
                      }}>
                        {memberData.eficienta_procent}%
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>Eficiență generală</div>
                    </div>
                  </div>
                </div>

                {/* Charts Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                  gap: '2rem'
                }}>
                  {/* Radar Chart Skills */}
                  <div style={{ 
                    background: 'white', 
                    padding: '1.5rem', 
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    border: '1px solid #e0e0e0'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>🎯 Skills Analysis</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={generateRadarData(memberData)}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="skill" />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} />
                        <Radar
                          name={memberData.utilizator_nume}
                          dataKey="value"
                          stroke="#007bff"
                          fill="#007bff"
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                      </RadarChart>
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
                    <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>🎯 Focus pe Priorități</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        { priority: 'Urgent', ore: memberData.ore_urgent, color: '#e74c3c' },
                        { priority: 'Ridicată', ore: memberData.ore_ridicata, color: '#f39c12' },
                        { priority: 'Normală', ore: memberData.ore_normala, color: '#27ae60' },
                        { priority: 'Scăzută', ore: memberData.ore_scazuta, color: '#3498db' }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="priority" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value}h`, 'Ore lucrate']} />
                        <Bar dataKey="ore">
                          {[
                            { priority: 'Urgent', ore: memberData.ore_urgent, color: '#e74c3c' },
                            { priority: 'Ridicată', ore: memberData.ore_ridicata, color: '#f39c12' },
                            { priority: 'Normală', ore: memberData.ore_normala, color: '#27ae60' },
                            { priority: 'Scăzută', ore: memberData.ore_scazuta, color: '#3498db' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Performance Insights */}
                <div style={{ 
                  background: 'white', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: '1px solid #e0e0e0',
                  marginTop: '2rem'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>💡 Performance Insights</h3>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                  }}>
                    <div style={{ 
                      padding: '1rem',
                      backgroundColor: '#e8f4f8',
                      borderRadius: '6px',
                      borderLeft: '4px solid #3498db'
                    }}>
                      <strong>📊 Productivitate</strong>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', color: '#666' }}>
                        Media {memberData.media_ore_zilnic}h/zi vs {memberData.media_echipa}h echipa
                      </p>
                    </div>

                    <div style={{ 
                      padding: '1rem',
                      backgroundColor: memberData.workload_status === 'optimal' ? '#e8f5e8' : '#fff3cd',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${getWorkloadColor(memberData.workload_status)}`
                    }}>
                      <strong>⚖️ Workload</strong>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', color: '#666' }}>
                        Status: {memberData.workload_status.toUpperCase()}
                      </p>
                    </div>

                    <div style={{ 
                      padding: '1rem',
                      backgroundColor: memberData.burnout_risk === 'low' ? '#e8f5e8' : '#f8d7da',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${getBurnoutColor(memberData.burnout_risk)}`
                    }}>
                      <strong>🔥 Burnout Risk</strong>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', color: '#666' }}>
                        Nivel: {memberData.burnout_risk.toUpperCase()}
                      </p>
                    </div>

                    <div style={{ 
                      padding: '1rem',
                      backgroundColor: '#f0f8ff',
                      borderRadius: '6px',
                      borderLeft: '4px solid #007bff'
                    }}>
                      <strong>🎯 Accuratețe</strong>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', color: '#666' }}>
                        {((memberData.sarcini_la_timp / (memberData.sarcini_la_timp + memberData.sarcini_intarziate)) * 100).toFixed(1)}% la timp
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Comparison Tab */}
      {viewMode === 'comparison' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>⚖️ Team Comparison</h2>
          
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={teamData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="utilizator_nume" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="eficienta_procent" fill="#3498db" name="Eficiență %" />
                <Bar dataKey="total_ore" fill="#27ae60" name="Total Ore" />
                <Bar dataKey="sarcini_la_timp" fill="#f39c12" name="Sarcini la timp" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Skills Tab */}
      {viewMode === 'skills' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>🎯 Skills & Growth Analysis</h2>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            {skillsAnalysis.map((skill) => (
              <div key={skill.skill_name} style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>
                    {skill.skill_name}
                  </h3>
                  <span style={{ fontSize: '16px' }}>
                    {getTrendIcon(skill.growth_trend)}
                  </span>
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Total ore investite</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
                    {skill.total_hours}h
                  </div>
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Eficiență medie</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3498db' }}>
                    {skill.avg_efficiency}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Membri echipă</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#27ae60' }}>
                    {skill.team_members}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
