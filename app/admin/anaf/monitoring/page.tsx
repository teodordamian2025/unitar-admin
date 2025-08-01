// ==================================================================
// CALEA: app/admin/anaf/monitoring/page.tsx
// DESCRIERE: Dashboard complet pentru ANAF Monitoring cu real-time updates
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ✅ Interfaces pentru data types
interface SystemHealth {
  oauth: {
    status: 'healthy' | 'warning' | 'critical';
    tokenValid: boolean;
    expiresInDays: number;
    expiresAt: string;
    lastRefresh: string;
  };
  anafApi: {
    status: 'healthy' | 'warning' | 'critical';
    connected: boolean;
    responseTime: number;
    lastSuccessfulCall: string;
    uptime: number;
  };
  database: {
    status: 'healthy' | 'warning' | 'critical';
    connected: boolean;
    responseTime: number;
    errorCount: number;
  };
  notifications: {
    status: 'healthy' | 'warning' | 'critical';
    enabled: boolean;
    lastSent: string;
    totalSent24h: number;
  };
}

interface PerformanceMetrics {
  successRate: number;
  successRateTrend: number;
  totalInvoices: number;
  successfulInvoices: number;
  failedInvoices: number;
  averageResponseTime: number;
  errorRate: number;
  errorRateTrend: number;
  peakHour: string;
  slowestOperation: string;
}

interface ErrorInfo {
  category: string;
  count: number;
  severity: string;
  trend: 'up' | 'down' | 'stable';
  lastOccurrence: string;
}

interface Alert {
  id: string;
  category: string;
  severity: string;
  message: string;
  timestamp: string;
  facturaId?: string;
  status: string;
}

// ✅ Color schemes pentru charts
const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  critical: '#DC2626'
};

const STATUS_COLORS = {
  healthy: '#10B981',
  warning: '#F59E0B',
  critical: '#EF4444'
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ANAFMonitoringDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Data states
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [flowData, setFlowData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [timeRange, autoRefresh]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load data based on active tab
      if (activeTab === 'overview') {
        await loadOverviewData();
      } else {
        await loadSpecificTabData(activeTab);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      showToast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewData = async () => {
    const response = await fetch(`/api/anaf/monitoring?endpoint=overview&timeRange=${timeRange}`);
    const data = await response.json();
    
    if (data.success) {
      setSystemHealth(data.data.health);
      setPerformance(data.data.performance);
      setErrors(data.data.errors);
    }
  };

  const loadSpecificTabData = async (tab: string) => {
    const response = await fetch(`/api/anaf/monitoring?endpoint=${tab}&timeRange=${timeRange}`);
    const data = await response.json();
    
    if (data.success) {
      switch (tab) {
        case 'health':
          setSystemHealth(data.health);
          break;
        case 'performance':
          setPerformance(data.performance);
          break;
        case 'errors':
          setErrors(data.errors.recentErrors);
          break;
        case 'flow':
          setFlowData(data.flow.flowByHour);
          setStatusDistribution(data.flow.statusDistribution);
          break;
        case 'alerts':
          setAlerts(data.alerts);
          break;
      }
    }
  };

  const handleAction = async (action: string, data?: any) => {
    try {
      const response = await fetch('/api/anaf/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(`Action "${action}" completed successfully`, 'success');
        loadDashboardData(); // Refresh data
      } else {
        showToast(`Action "${action}" failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`Error executing action: ${error}`, 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Simple toast implementation
    const toastEl = document.createElement('div');
    toastEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 350px;
    `;
    toastEl.textContent = message;
    document.body.appendChild(toastEl);
    
    setTimeout(() => {
      if (document.body.contains(toastEl)) {
        document.body.removeChild(toastEl);
      }
    }, 4000);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('ro-RO');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🔴';
      default: return '❓';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '📈';
    if (trend < 0) return '📉';
    return '➡️';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📊 ANAF e-Factura Monitoring</h1>
              <p className="text-sm text-gray-500 mt-1">
                Last update: {formatDate(lastUpdate.toISOString())} 
                {loading && <span className="ml-2">🔄 Updating...</span>}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>

              {/* Auto Refresh Toggle */}
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm"
                />
                <span className="ml-2 text-sm text-gray-700">Auto-refresh</span>
              </label>

              {/* Manual Refresh */}
              <button
                onClick={loadDashboardData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'health', label: '🏥 System Health', icon: '🏥' },
              { id: 'performance', label: '📈 Performance', icon: '📈' },
              { id: 'errors', label: '❌ Errors', icon: '❌' },
              { id: 'flow', label: '🔄 Invoice Flow', icon: '🔄' },
              { id: 'alerts', label: '🚨 Alerts', icon: '🚨' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-lg text-gray-600">Loading dashboard data...</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* System Health Cards */}
                {systemHealth && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <HealthCard
                      title="OAuth Token"
                      status={systemHealth.oauth.status}
                      value={systemHealth.oauth.tokenValid ? 'Valid' : 'Invalid'}
                      subtitle={`Expires in ${systemHealth.oauth.expiresInDays} days`}
                      icon="🔑"
                      onAction={() => handleAction('refresh_token')}
                      actionLabel="Refresh Token"
                    />
                    <HealthCard
                      title="ANAF API"
                      status={systemHealth.anafApi.status}
                      value={systemHealth.anafApi.connected ? 'Connected' : 'Disconnected'}
                      subtitle={`${systemHealth.anafApi.responseTime}ms response`}
                      icon="📡"
                      onAction={() => handleAction('test_connection')}
                      actionLabel="Test Connection"
                    />
                    <HealthCard
                      title="Database"
                      status={systemHealth.database.status}
                      value={systemHealth.database.connected ? 'Healthy' : 'Error'}
                      subtitle={`${systemHealth.database.responseTime}ms query time`}
                      icon="💾"
                    />
                    <HealthCard
                      title="Notifications"
                      status={systemHealth.notifications.status}
                      value={systemHealth.notifications.enabled ? 'Enabled' : 'Disabled'}
                      subtitle={`${systemHealth.notifications.totalSent24h} sent today`}
                      icon="📧"
                      onAction={() => handleAction('send_test_notification')}
                      actionLabel="Send Test"
                    />
                  </div>
                )}

                {/* Performance Overview */}
                {performance && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <MetricCard
                      title="Success Rate"
                      value={`${performance.successRate.toFixed(1)}%`}
                      trend={performance.successRateTrend}
                      color={performance.successRate > 90 ? COLORS.success : performance.successRate > 80 ? COLORS.warning : COLORS.error}
                      icon="✅"
                    />
                    <MetricCard
                      title="Total Invoices"
                      value={performance.totalInvoices.toString()}
                      subtitle={`${performance.successfulInvoices} successful, ${performance.failedInvoices} failed`}
                      color={COLORS.primary}
                      icon="📄"
                    />
                    <MetricCard
                      title="Error Rate"
                      value={`${performance.errorRate.toFixed(1)}%`}
                      trend={-performance.errorRateTrend} // Invert trend for error rate
                      color={performance.errorRate < 5 ? COLORS.success : performance.errorRate < 10 ? COLORS.warning : COLORS.error}
                      icon="❌"
                    />
                  </div>
                )}

                {/* Recent Errors */}
                {errors.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900">⚠️ Recent Issues</h3>
                    </div>
                    <div className="p-6">
                      <div className="space-y-4">
                        {errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className={`w-3 h-3 rounded-full ${
                                error.severity === 'critical' ? 'bg-red-500' :
                                error.severity === 'high' ? 'bg-orange-500' :
                                error.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}></span>
                              <div>
                                <div className="font-medium text-gray-900">{error.category}</div>
                                <div className="text-sm text-gray-500">
                                  {error.count} occurrences • Last: {formatDate(error.lastOccurrence)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">{getTrendIcon(0)} {error.trend}</span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                error.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                error.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {error.severity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Performance Tab */}
            {activeTab === 'performance' && performance && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <MetricCard
                    title="Success Rate"
                    value={`${performance.successRate.toFixed(1)}%`}
                    trend={performance.successRateTrend}
                    color={COLORS.success}
                    icon="✅"
                  />
                  <MetricCard
                    title="Avg Response Time"
                    value={`${performance.averageResponseTime}s`}
                    color={COLORS.primary}
                    icon="⏱️"
                  />
                  <MetricCard
                    title="Peak Hour"
                    value={performance.peakHour}
                    color={COLORS.warning}
                    icon="📊"
                  />
                  <MetricCard
                    title="Slowest Operation"
                    value={performance.slowestOperation}
                    color={COLORS.error}
                    icon="🐌"
                  />
                </div>

                {/* Performance Chart */}
                {flowData.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Invoice Processing by Hour</h3>
                    <div style={{ width: '100%', height: 400 }}>
                      <ResponsiveContainer>
                        <LineChart data={flowData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="successful" stroke={COLORS.success} strokeWidth={2} name="Successful" />
                          <Line type="monotone" dataKey="failed" stroke={COLORS.error} strokeWidth={2} name="Failed" />
                          <Line type="monotone" dataKey="total" stroke={COLORS.primary} strokeWidth={2} name="Total" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Errors Tab */}
            {activeTab === 'errors' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">❌ Error Analysis</h3>
                  </div>
                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Count
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Severity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Trend
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Last Occurrence
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {errors.map((error, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {error.category}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {error.count}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  error.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                  error.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                  error.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {error.severity}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {getTrendIcon(0)} {error.trend}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(error.lastOccurrence)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Flow Tab */}
            {activeTab === 'flow' && (
              <div className="space-y-6">
                {/* Status Distribution Pie Chart */}
                {statusDistribution.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">📊 Status Distribution</h3>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={statusDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="count"
                            >
                              {statusDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Hourly Flow Bar Chart */}
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">🔄 Hourly Processing Volume</h3>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <BarChart data={flowData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="successful" fill={COLORS.success} name="Successful" />
                            <Bar dataKey="failed" fill={COLORS.error} name="Failed" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">🚨 Active Alerts</h3>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">
                      {alerts.length} active
                    </span>
                  </div>
                  <div className="p-6">
                    {alerts.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">✅</div>
                        <div className="text-xl text-gray-600">No active alerts</div>
                        <div className="text-sm text-gray-500 mt-2">System is running smoothly</div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {alerts.map((alert) => (
                          <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                            alert.severity === 'critical' ? 'bg-red-50 border-red-400' :
                            alert.severity === 'high' ? 'bg-orange-50 border-orange-400' :
                            'bg-yellow-50 border-yellow-400'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">{alert.category}</div>
                                <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                                <div className="text-xs text-gray-500 mt-2">
                                  {formatDate(alert.timestamp)}
                                  {alert.facturaId && <span className="ml-2">• Invoice: {alert.facturaId}</span>}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                  alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {alert.severity}
                                </span>
                                <button
                                  onClick={() => handleAction('clear_alerts', { alertIds: [alert.id] })}
                                  className="text-gray-400 hover:text-gray-600"
                                  title="Dismiss alert"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Health Tab */}
            {activeTab === 'health' && systemHealth && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SystemHealthCard
                    title="🔑 OAuth Token"
                    status={systemHealth.oauth.status}
                    details={{
                      'Token Valid': systemHealth.oauth.tokenValid ? 'Yes' : 'No',
                      'Expires In': `${systemHealth.oauth.expiresInDays} days`,
                      'Expires At': formatDate(systemHealth.oauth.expiresAt),
                      'Last Refresh': formatDate(systemHealth.oauth.lastRefresh)
                    }}
                    actions={[
                      { label: 'Refresh Token', action: () => handleAction('refresh_token') }
                    ]}
                  />
                  
                  <SystemHealthCard
                    title="📡 ANAF API"
                    status={systemHealth.anafApi.status}
                    details={{
                      'Connected': systemHealth.anafApi.connected ? 'Yes' : 'No',
                      'Response Time': `${systemHealth.anafApi.responseTime}ms`,
                      'Uptime': `${systemHealth.anafApi.uptime}%`,
                      'Last Successful Call': formatDate(systemHealth.anafApi.lastSuccessfulCall)
                    }}
                    actions={[
                      { label: 'Test Connection', action: () => handleAction('test_connection') }
                    ]}
                  />
                  
                  <SystemHealthCard
                    title="💾 Database"
                    status={systemHealth.database.status}
                    details={{
                      'Connected': systemHealth.database.connected ? 'Yes' : 'No',
                      'Response Time': `${systemHealth.database.responseTime}ms`,
                      'Recent Errors': systemHealth.database.errorCount.toString()
                    }}
                    actions={[
                      { label: 'Run Health Check', action: () => handleAction('force_health_check') }
                    ]}
                  />
                  
                  <SystemHealthCard
                    title="📧 Notifications"
                    status={systemHealth.notifications.status}
                    details={{
                      'Enabled': systemHealth.notifications.enabled ? 'Yes' : 'No',
                      'Sent Today': systemHealth.notifications.totalSent24h.toString(),
                      'Last Sent': formatDate(systemHealth.notifications.lastSent)
                    }}
                    actions={[
                      { label: 'Send Test Email', action: () => handleAction('send_test_notification') }
                    ]}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ✅ Component pentru Health Cards
const HealthCard: React.FC<{
  title: string;
  status: string;
  value: string;
  subtitle: string;
  icon: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ title, status, value, subtitle, icon, onAction, actionLabel }) => (
  <div className="bg-white rounded-lg shadow-sm border p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">{getStatusIcon(status)}</span>
            <span className={`text-sm font-medium ${
              status === 'healthy' ? 'text-green-600' :
              status === 'warning' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div className="mb-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{subtitle}</div>
    </div>
    {onAction && actionLabel && (
      <button
        onClick={onAction}
        className="w-full bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm hover:bg-blue-100 transition-colors"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

// ✅ Component pentru Metric Cards
const MetricCard: React.FC<{
  title: string;
  value: string;
  trend?: number;
  subtitle?: string;
  color: string;
  icon: string;
}> = ({ title, value, trend, subtitle, color, icon }) => (
  <div className="bg-white rounded-lg shadow-sm border p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center text-sm font-medium ${
          trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
        }`}>
          {getTrendIcon(trend)}
          <span className="ml-1">{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
    <div className="mb-2">
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  </div>
);

// ✅ Component pentru System Health Cards
const SystemHealthCard: React.FC<{
  title: string;
  status: string;
  details: Record<string, string>;
  actions?: Array<{ label: string; action: () => void }>;
}> = ({ title, status, details, actions }) => (
  <div className="bg-white rounded-lg shadow-sm border">
    <div className="px-6 py-4 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon(status)}</span>
          <span className={`px-2 py-1 rounded text-sm font-medium ${
            status === 'healthy' ? 'bg-green-100 text-green-800' :
            status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>
    </div>
    <div className="p-6">
      <dl className="space-y-3">
        {Object.entries(details).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <dt className="text-sm font-medium text-gray-500">{key}:</dt>
            <dd className="text-sm text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
      {actions && actions.length > 0 && (
        <div className="mt-6 space-y-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="w-full bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm hover:bg-blue-100 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);
