import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

// ==================================================================
// CALEA: app/admin/analytics/components/AdvancedAnalytics.tsx
// CREAT: 14.09.2025 19:30 (ora României)
// DESCRIERE: Dashboard avansat cu predictive analytics și business insights
// ==================================================================

interface PredictiveData {
  period: string;
  actual_hours?: number;
  predicted_hours: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  trend: 'up' | 'down' | 'stable';
  accuracy_score?: number;
}

interface ROIAnalysis {
  proiect_id: string;
  proiect_nume: string;
  total_investment: number;
  estimated_value: number;
  actual_revenue?: number;
  roi_percentage: number;
  hours_invested: number;
  cost_per_hour: number;
  efficiency_score: number;
  risk_level: 'low' | 'medium' | 'high';
  completion_probability: number;
}

interface BurnoutRisk {
  utilizator_uid: string;
  utilizator_nume: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  contributing_factors: string[];
  recommended_actions: string[];
  workload_trend: number[];
  stress_indicators: {
    overtime_frequency: number;
    task_switching: number;
    deadline_pressure: number;
    weekend_work: number;
  };
}

interface ResourceOptimization {
  resource_type: 'utilizator' | 'skill' | 'proiect';
  resource_name: string;
  current_allocation: number;
  optimal_allocation: number;
  utilization_rate: number;
  bottleneck_risk: number;
  reallocation_suggestion: string;
  expected_improvement: number;
}

interface MarketTrend {
  skill_category: string;
  demand_trend: 'rising' | 'stable' | 'declining';
  market_value: number;
  team_expertise: number;
  investment_priority: 'high' | 'medium' | 'low';
  recommended_actions: string[];
}

interface AdvancedAnalyticsProps {
  selectedPeriod?: number;
  showPredictions?: boolean;
  includeROI?: boolean;
  includeBurnoutAnalysis?: boolean;
  onInsightSelect?: (insight: any) => void;
}

export default function AdvancedAnalytics({
  selectedPeriod = 90,
  showPredictions = true,
  includeROI = true,
  includeBurnoutAnalysis = true,
  onInsightSelect
}: AdvancedAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'predictions' | 'roi' | 'burnout' | 'optimization' | 'market'>('predictions');
  
  // Analytics data states
  const [predictiveData, setPredictiveData] = useState<PredictiveData[]>([]);
  const [roiAnalysis, setROIAnalysis] = useState<ROIAnalysis[]>([]);
  const [burnoutRisks, setBurnoutRisks] = useState<BurnoutRisk[]>([]);
  const [resourceOptimization, setResourceOptimization] = useState<ResourceOptimization[]>([]);
  const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
  
  // Executive insights
  const [executiveInsights, setExecutiveInsights] = useState<any[]>([]);
  const [keyMetrics, setKeyMetrics] = useState<any>({});

  useEffect(() => {
    fetchAdvancedAnalytics();
  }, [selectedPeriod]);

  const fetchAdvancedAnalytics = async () => {
    setLoading(true);
    try {
      const [
        predictiveResponse,
        roiResponse,
        burnoutResponse,
        optimizationResponse,
        marketResponse
      ] = await Promise.all([
        fetch(`/api/analytics/predictions?period=${selectedPeriod}`),
        fetch(`/api/analytics/roi-analysis?period=${selectedPeriod}`),
        fetch(`/api/analytics/burnout-analysis?period=${selectedPeriod}`),
        fetch(`/api/analytics/resource-optimization?period=${selectedPeriod}`),
        fetch(`/api/analytics/market-trends?period=${selectedPeriod}`)
      ]);

      const [
        predictiveData,
        roiData,
        burnoutData,
        optimizationData,
        marketData
      ] = await Promise.all([
        predictiveResponse.json(),
        roiResponse.json(),
        burnoutResponse.json(),
        optimizationResponse.json(),
        marketResponse.json()
      ]);

      if (predictiveData.success) setPredictiveData(predictiveData.data);
      if (roiData.success) setROIAnalysis(roiData.data);
      if (burnoutData.success) setBurnoutRisks(burnoutData.data);
      if (optimizationData.success) setResourceOptimization(optimizationData.data);
      if (marketData.success) setMarketTrends(marketData.data);

      // Generate executive insights
      generateExecutiveInsights(roiData.data, burnoutData.data, optimizationData.data);

    } catch (error) {
      console.error('Eroare la încărcarea analytics avansate:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateExecutiveInsights = (roi: ROIAnalysis[], burnout: BurnoutRisk[], optimization: ResourceOptimization[]) => {
    const insights = [];

    // ROI Insights
    const highROIProjects = roi.filter(p => p.roi_percentage > 150);
    const lowROIProjects = roi.filter(p => p.roi_percentage < 80);
    
    if (highROIProjects.length > 0) {
      insights.push({
        type: 'success',
        priority: 'high',
        title: 'High-Performing Projects',
        description: `${highROIProjects.length} proiecte cu ROI > 150%`,
        value: `${highROIProjects.reduce((sum, p) => sum + p.roi_percentage, 0) / highROIProjects.length}%`,
        action: 'Scale successful methodologies to other projects'
      });
    }

    if (lowROIProjects.length > 0) {
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'Underperforming Projects',
        description: `${lowROIProjects.length} proiecte cu ROI < 80%`,
        value: `${lowROIProjects.reduce((sum, p) => sum + p.roi_percentage, 0) / lowROIProjects.length}%`,
        action: 'Review project strategy and resource allocation'
      });
    }

    // Burnout Insights
    const criticalBurnout = burnout.filter(b => b.risk_level === 'critical');
    const highBurnout = burnout.filter(b => b.risk_level === 'high');
    
    if (criticalBurnout.length > 0) {
      insights.push({
        type: 'danger',
        priority: 'urgent',
        title: 'Critical Burnout Risk',
        description: `${criticalBurnout.length} membri cu risc critic de burnout`,
        value: criticalBurnout.map(b => b.utilizator_nume).join(', '),
        action: 'Immediate workload redistribution required'
      });
    }

    // Resource Optimization
    const bottlenecks = optimization.filter(r => r.bottleneck_risk > 70);
    if (bottlenecks.length > 0) {
      insights.push({
        type: 'info',
        priority: 'medium',
        title: 'Resource Bottlenecks',
        description: `${bottlenecks.length} resurse cu risc de bottleneck`,
        value: `${bottlenecks.reduce((sum, r) => sum + r.expected_improvement, 0)}% îmbunătățire potențială`,
        action: 'Implement resource reallocation strategy'
      });
    }

    setExecutiveInsights(insights);

    // Key metrics calculation
    setKeyMetrics({
      avg_roi: roi.length > 0 ? roi.reduce((sum, p) => sum + p.roi_percentage, 0) / roi.length : 0,
      high_risk_team_members: burnout.filter(b => b.risk_level === 'high' || b.risk_level === 'critical').length,
      optimization_potential: optimization.reduce((sum, r) => sum + r.expected_improvement, 0),
      total_team_members: burnout.length
    });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return '#27ae60';
      case 'medium': return '#f39c12';
      case 'high': return '#e74c3c';
      case 'critical': return '#8e44ad';
      default: return '#95a5a6';
    }
  };

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'success': return '#27ae60';
      case 'warning': return '#f39c12';
      case 'danger': return '#e74c3c';
      case 'info': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px' 
      }}>
        <div>Se încarcă analytics avansate...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      {/* Header cu Key Metrics */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
          🧠 Advanced Analytics Dashboard
        </h1>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {keyMetrics.avg_roi?.toFixed(1)}%
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>ROI Mediu</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {keyMetrics.high_risk_team_members}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Risc Burnout</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {keyMetrics.optimization_potential?.toFixed(1)}%
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Potențial Optimizare</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {executiveInsights.length}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Insights Active</div>
          </div>
        </div>
      </div>

      {/* Executive Insights */}
      {executiveInsights.length > 0 && (
        <div style={{ 
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
            💡 Executive Insights
          </h3>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem'
          }}>
            {executiveInsights.map((insight, index) => (
              <div
                key={index}
                onClick={() => onInsightSelect?.(insight)}
                style={{
                  padding: '1rem',
                  border: '1px solid #e0e0e0',
                  borderLeft: `4px solid ${getInsightTypeColor(insight.type)}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  background: 'white'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <strong style={{ color: '#2c3e50' }}>{insight.title}</strong>
                  <span style={{ 
                    padding: '0.25rem 0.5rem',
                    backgroundColor: getInsightTypeColor(insight.type),
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    {insight.priority.toUpperCase()}
                  </span>
                </div>
                
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '0.5rem' }}>
                  {insight.description}
                </div>
                
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: getInsightTypeColor(insight.type),
                  marginBottom: '0.5rem'
                }}>
                  {insight.value}
                </div>
                
                <div style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                  💡 {insight.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ 
        borderBottom: '1px solid #ddd',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            { id: 'predictions', label: '📈 Predictive Analytics', icon: '🔮' },
            { id: 'roi', label: '💰 ROI Analysis', icon: '📊' },
            { id: 'burnout', label: '🔥 Burnout Analysis', icon: '⚠️' },
            { id: 'optimization', label: '⚙️ Resource Optimization', icon: '🎯' },
            { id: 'market', label: '📊 Market Trends', icon: '📈' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #007bff' : '3px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: activeTab === tab.id ? '#007bff' : '#666',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Predictions Tab */}
      {activeTab === 'predictions' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>🔮 Predictive Analytics</h2>
          
          <div style={{ 
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50' }}>
              📈 Workforce Productivity Forecast
            </h3>
            
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={predictiveData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'predicted_hours') return [`${value}h`, 'Predicție'];
                    if (name === 'actual_hours') return [`${value}h`, 'Actual'];
                    return [value, name];
                  }}
                />
                <Legend />
                
                {/* Confidence interval */}
                <Area 
                  dataKey="confidence_interval.upper" 
                  stackId="1"
                  stroke="none" 
                  fill="#e3f2fd" 
                  fillOpacity={0.3}
                />
                <Area 
                  dataKey="confidence_interval.lower" 
                  stackId="1"
                  stroke="none" 
                  fill="white" 
                  fillOpacity={1}
                />
                
                {/* Actual data */}
                <Line 
                  type="monotone" 
                  dataKey="actual_hours" 
                  stroke="#2196F3" 
                  strokeWidth={3}
                  name="Ore Actual"
                  dot={{ fill: '#2196F3', strokeWidth: 2 }}
                />
                
                {/* Prediction line */}
                <Line 
                  type="monotone" 
                  dataKey="predicted_hours" 
                  stroke="#ff6b6b" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Predicție"
                  dot={{ fill: '#ff6b6b', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginTop: '1rem'
            }}>
              {predictiveData.slice(-3).map((prediction, index) => (
                <div key={index} style={{
                  textAlign: 'center',
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>{prediction.period}</div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold',
                    color: prediction.trend === 'up' ? '#27ae60' : prediction.trend === 'down' ? '#e74c3c' : '#f39c12'
                  }}>
                    {prediction.predicted_hours}h
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {prediction.trend === 'up' ? '📈' : prediction.trend === 'down' ? '📉' : '➡️'} 
                    {prediction.accuracy_score && ` ${prediction.accuracy_score}% acuracy`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ROI Analysis Tab */}
      {activeTab === 'roi' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>💰 ROI Analysis</h2>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '1.5rem'
          }}>
            {roiAnalysis.map((project) => (
              <div key={project.proiect_id} style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid #e0e0e0',
                borderLeft: `4px solid ${project.roi_percentage > 150 ? '#27ae60' : project.roi_percentage > 100 ? '#f39c12' : '#e74c3c'}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>
                    {project.proiect_nume}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: getRiskColor(project.risk_level),
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {project.risk_level.toUpperCase()}
                  </span>
                </div>

                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>ROI</div>
                    <div style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold',
                      color: project.roi_percentage > 100 ? '#27ae60' : '#e74c3c'
                    }}>
                      {project.roi_percentage.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Probabilitate finalizare</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>
                      {project.completion_probability}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Investiție</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#666' }}>
                      {formatCurrency(project.total_investment)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Valoare estimată</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#27ae60' }}>
                      {formatCurrency(project.estimated_value)}
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}>
                  <strong>Eficiență:</strong> {project.efficiency_score.toFixed(1)}/10 • 
                  <strong> Ore:</strong> {project.hours_invested}h • 
                  <strong> Cost/h:</strong> {formatCurrency(project.cost_per_hour)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Burnout Analysis Tab */}
      {activeTab === 'burnout' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>🔥 Burnout Risk Analysis</h2>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '1.5rem'
          }}>
            {burnoutRisks.map((member) => (
              <div key={member.utilizator_uid} style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid #e0e0e0',
                borderLeft: `4px solid ${getRiskColor(member.risk_level)}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ margin: 0, color: '#2c3e50' }}>
                    {member.utilizator_nume}
                  </h3>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold',
                      color: getRiskColor(member.risk_level)
                    }}>
                      {member.risk_score}/100
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Risk Score
                    </div>
                  </div>
                </div>

                {/* Stress Indicators Radar */}
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={[
                    { indicator: 'Overtime', value: member.stress_indicators.overtime_frequency },
                    { indicator: 'Task Switch', value: member.stress_indicators.task_switching },
                    { indicator: 'Deadline Press', value: member.stress_indicators.deadline_pressure },
                    { indicator: 'Weekend Work', value: member.stress_indicators.weekend_work }
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="indicator" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Stress Level"
                      dataKey="value"
                      stroke={getRiskColor(member.risk_level)}
                      fill={getRiskColor(member.risk_level)}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>

                {/* Contributing Factors */}
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ fontSize: '14px', color: '#666' }}>Factori de risc:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {member.contributing_factors.map((factor, index) => (
                      <span 
                        key={index}
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          margin: '0.25rem 0.25rem 0 0',
                          backgroundColor: '#ffebee',
                          color: '#c62828',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recommended Actions */}
                <div>
                  <strong style={{ fontSize: '14px', color: '#666' }}>Acțiuni recomandate:</strong>
                  <ul style={{ 
                    fontSize: '12px', 
                    color: '#666',
                    paddingLeft: '1rem',
                    margin: '0.5rem 0 0 0'
                  }}>
                    {member.recommended_actions.map((action, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource Optimization Tab */}
      {activeTab === 'optimization' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>⚙️ Resource Optimization</h2>
          
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
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Resursă</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Tip</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Utilizare Curentă</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Utilizare Optimă</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Risc Bottleneck</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Îmbunătățire</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Recomandare</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceOptimization.map((resource, index) => (
                    <tr key={index} style={{ 
                      borderBottom: '1px solid #f0f0f0',
                      background: index % 2 === 0 ? 'white' : '#f9f9f9'
                    }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                        {resource.resource_name}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          {resource.resource_type}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {resource.current_allocation}%
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: '#27ae60' }}>
                        {resource.optimal_allocation}%
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          color: resource.bottleneck_risk > 70 ? '#e74c3c' : resource.bottleneck_risk > 40 ? '#f39c12' : '#27ae60',
                          fontWeight: 'bold'
                        }}>
                          {resource.bottleneck_risk}%
                        </span>
                      </td>
                      <td style={{ 
                        padding: '1rem', 
                        textAlign: 'center',
                        color: '#27ae60',
                        fontWeight: 'bold'
                      }}>
                        +{resource.expected_improvement}%
                      </td>
                      <td style={{ padding: '1rem', fontSize: '14px', color: '#666' }}>
                        {resource.reallocation_suggestion}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Market Trends Tab */}
      {activeTab === 'market' && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>📊 Market Trends & Skills Investment</h2>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {marketTrends.map((trend, index) => (
              <div key={index} style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>
                    {trend.skill_category}
                  </h3>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: '12px',
                      color: trend.demand_trend === 'rising' ? '#27ae60' : 
                            trend.demand_trend === 'declining' ? '#e74c3c' : '#f39c12'
                    }}>
                      {trend.demand_trend === 'rising' ? '📈 Rising' : 
                       trend.demand_trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                    </div>
                  </div>
                </div>

                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Market Value</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>
                      {formatCurrency(trend.market_value)}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Team Expertise</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#27ae60' }}>
                      {trend.team_expertise}/10
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: trend.investment_priority === 'high' ? '#e8f5e8' : 
                                  trend.investment_priority === 'medium' ? '#fff3cd' : '#f8d7da',
                  borderRadius: '4px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    color: trend.investment_priority === 'high' ? '#155724' : 
                           trend.investment_priority === 'medium' ? '#856404' : '#721c24'
                  }}>
                    Investment Priority: {trend.investment_priority.toUpperCase()}
                  </div>
                </div>

                <div>
                  <strong style={{ fontSize: '14px', color: '#666' }}>Acțiuni recomandate:</strong>
                  <ul style={{ 
                    fontSize: '12px', 
                    color: '#666',
                    paddingLeft: '1rem',
                    margin: '0.5rem 0 0 0'
                  }}>
                    {trend.recommended_actions.map((action, actionIndex) => (
                      <li key={actionIndex} style={{ marginBottom: '0.25rem' }}>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
