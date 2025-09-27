// ==================================================================
// CALEA: app/components/realtime/LiveMetrics.tsx
// DATA: 19.09.2025 23:15 (ora României)
// DESCRIERE: Componenta pentru afișarea KPI-urilor live în timp real
// FUNCȚIONALITATE: Live metrics dashboard cu animații și indicatori trend
// ==================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRealtime } from './RealtimeProvider';

interface MetricProps {
  title: string;
  value: number | string;
  previousValue?: number;
  icon: string;
  color: string;
  format?: 'number' | 'currency' | 'percentage' | 'time';
  trend?: 'up' | 'down' | 'stable';
  className?: string;
}

interface LiveMetricsProps {
  className?: string;
  showTrends?: boolean;
  animated?: boolean;
  refreshInterval?: number;
}

const LiveMetric: React.FC<MetricProps> = ({
  title,
  value,
  previousValue,
  icon,
  color,
  format = 'number',
  trend,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setIsAnimating(true);

      // Animate value change
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return `${val.toLocaleString('ro-RO')} RON`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'time':
        return `${val}h`;
      default:
        return val.toLocaleString('ro-RO');
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return '#10b981';
      case 'down': return '#ef4444';
      case 'stable': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const calculatePercentageChange = () => {
    if (typeof value === 'string' || typeof previousValue !== 'number' || previousValue === 0) {
      return 0;
    }
    return (((value as number) - previousValue) / previousValue) * 100;
  };

  const containerStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '1.5rem',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s ease',
    transform: isAnimating ? 'scale(1.02)' : 'scale(1)',
    position: 'relative' as const,
    overflow: 'hidden'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem'
  };

  const titleStyle = {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: '500'
  };

  const iconStyle = {
    fontSize: '1.5rem',
    padding: '0.5rem',
    borderRadius: '12px',
    background: `${color}15`,
    border: `1px solid ${color}30`
  };

  const valueStyle = {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '0.5rem',
    transition: 'all 0.3s ease'
  };

  const trendStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: getTrendColor()
  };

  const pulseStyle = {
    position: 'absolute' as const,
    top: '0.5rem',
    right: '0.5rem',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    animation: 'pulse 2s infinite'
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Live indicator */}
      <div style={pulseStyle} />

      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>{title}</span>
        <div style={iconStyle}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div style={valueStyle}>
        {formatValue(displayValue)}
      </div>

      {/* Trend */}
      {trend && (
        <div style={trendStyle}>
          <span>{getTrendIcon()}</span>
          <span>
            {previousValue !== undefined && (
              `${calculatePercentageChange() > 0 ? '+' : ''}${calculatePercentageChange().toFixed(1)}%`
            )}
          </span>
        </div>
      )}

      {/* Pulse animation CSS */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export const LiveMetrics: React.FC<LiveMetricsProps> = ({
  className = '',
  showTrends = true,
  animated = true,
  refreshInterval = 180000 // 3 minutes instead of 30s
}) => {
  const { data, isConnected } = useRealtime();
  const [metricsData, setMetricsData] = useState<any>(null);
  const [previousMetrics, setPreviousMetrics] = useState<any>(null);

  useEffect(() => {
    if (data.dashboardStats && data.analyticsData) {
      setPreviousMetrics(metricsData);
      setMetricsData({
        dashboard: data.dashboardStats,
        analytics: data.analyticsData,
        lastUpdate: data.lastUpdate
      });
    }
  }, [data]);

  if (!metricsData) {
    return (
      <div className={className} style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        opacity: 0.6
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '1.5rem',
            height: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280'
          }}>
            ⏳ Loading...
          </div>
        ))}
      </div>
    );
  }

  const getTrend = (current: number, previous: number) => {
    if (!previous) return 'stable';
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  };

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
    padding: '0 0.5rem'
  };

  const statusStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: isConnected ? '#10b981' : '#ef4444'
  };

  return (
    <div className={className}>
      {/* Header with status */}
      <div style={headerStyle}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#1f2937',
          margin: 0
        }}>
          📊 Metrici Live
        </h3>

        <div style={statusStyle}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#10b981' : '#ef4444',
            animation: isConnected ? 'pulse 2s infinite' : 'none'
          }} />
          <span>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={containerStyle}>
        {/* Active Users */}
        <LiveMetric
          title="Utilizatori Activi"
          value={data.activeUsers}
          previousValue={previousMetrics?.activeUsers}
          icon="👥"
          color="#3b82f6"
          trend={showTrends ? getTrend(data.activeUsers, previousMetrics?.activeUsers) : undefined}
        />

        {/* Total Projects */}
        {metricsData.dashboard?.proiecte && (
          <LiveMetric
            title="Proiecte Active"
            value={metricsData.dashboard.proiecte.active || 0}
            previousValue={previousMetrics?.dashboard?.proiecte?.active}
            icon="🚀"
            color="#10b981"
            trend={showTrends ? getTrend(
              metricsData.dashboard.proiecte.active || 0,
              previousMetrics?.dashboard?.proiecte?.active || 0
            ) : undefined}
          />
        )}

        {/* Total Invoices */}
        {metricsData.dashboard?.facturi && (
          <LiveMetric
            title="Facturi Generate"
            value={metricsData.dashboard.facturi.total || 0}
            previousValue={previousMetrics?.dashboard?.facturi?.total}
            icon="📄"
            color="#f59e0b"
            trend={showTrends ? getTrend(
              metricsData.dashboard.facturi.total || 0,
              previousMetrics?.dashboard?.facturi?.total || 0
            ) : undefined}
          />
        )}

        {/* Time Tracking */}
        {metricsData.analytics?.timeTracking && (
          <LiveMetric
            title="Ore Săptămâna Aceasta"
            value={metricsData.analytics.timeTracking.thisWeek || 0}
            previousValue={previousMetrics?.analytics?.timeTracking?.thisWeek}
            icon="⏱️"
            color="#8b5cf6"
            format="time"
            trend={showTrends ? getTrend(
              metricsData.analytics.timeTracking.thisWeek || 0,
              previousMetrics?.analytics?.timeTracking?.thisWeek || 0
            ) : undefined}
          />
        )}
      </div>

      {/* Last Update */}
      <div style={{
        textAlign: 'center',
        fontSize: '0.75rem',
        color: '#6b7280',
        marginTop: '1rem'
      }}>
        Ultima actualizare: {data.lastUpdate.toLocaleTimeString('ro-RO')}
      </div>

      {/* Pulse animation CSS */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default LiveMetrics;