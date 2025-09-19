// ==================================================================
// CALEA: app/components/charts/AdvancedPieChart.tsx
// DATA: 19.09.2025 22:35 (ora României)
// DESCRIERE: Grafic pie/donut avansat cu Victory.js pentru analytics
// FUNCȚIONALITATE: Pie/Donut charts, animații, tooltips, responsive
// ==================================================================

'use client';

import React from 'react';
import {
  VictoryPie,
  VictoryContainer,
  VictoryTooltip,
  VictoryLegend,
  VictoryLabel
} from 'victory';

interface DataPoint {
  x: string;
  y: number;
  label?: string;
  fill?: string;
}

interface AdvancedPieChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  showLegend?: boolean;
  animate?: boolean;
  theme?: 'light' | 'dark';
  innerRadius?: number;
  padAngle?: number;
  labelRadius?: number;
  showLabels?: boolean;
  showValues?: boolean;
  colorScheme?: string[];
  className?: string;
}

const AdvancedPieChart: React.FC<AdvancedPieChartProps> = ({
  data,
  width = 400,
  height = 400,
  title,
  showLegend = true,
  animate = true,
  theme = 'light',
  innerRadius = 0,
  padAngle = 2,
  labelRadius,
  showLabels = true,
  showValues = true,
  colorScheme,
  className = ''
}) => {
  const defaultColors = colorScheme || [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#14b8a6'  // teal
  ];

  const containerStyle = {
    background: theme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '1rem',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center'
  };

  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: theme === 'dark' ? '#f9fafb' : '#1f2937',
    textAlign: 'center' as const,
    marginBottom: '1rem'
  };

  const contentStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2rem',
    flexWrap: 'wrap' as const
  };

  // Calculate total for percentage display
  const total = data.reduce((sum, item) => sum + item.y, 0);

  // Prepare data with colors
  const processedData = data.map((item, index) => ({
    ...item,
    fill: item.fill || defaultColors[index % defaultColors.length]
  }));

  const formatTooltipLabel = (datum: any) => {
    const percentage = ((datum.y / total) * 100).toFixed(1);
    return `${datum.x}: ${datum.y} (${percentage}%)`;
  };

  const formatPieLabel = (datum: any) => {
    if (!showLabels && !showValues) return '';

    const percentage = ((datum.y / total) * 100).toFixed(1);

    if (showLabels && showValues) {
      return `${datum.x}\n${percentage}%`;
    } else if (showValues) {
      return `${percentage}%`;
    } else {
      return datum.x;
    }
  };

  return (
    <div className={className} style={containerStyle}>
      {title && (
        <div style={titleStyle}>
          {title}
        </div>
      )}

      <div style={contentStyle}>
        {/* Pie Chart */}
        <div>
          <VictoryPie
            data={processedData}
            width={width}
            height={height}
            innerRadius={innerRadius}
            padAngle={padAngle}
            labelRadius={labelRadius}
            containerComponent={
              <VictoryContainer
                responsive={true}
                style={{
                  background: 'transparent'
                }}
              />
            }
            animate={animate ? {
              duration: 1000,
              onLoad: { duration: 500 }
            } : false}
            labelComponent={
              showLabels || showValues ? (
                <VictoryLabel
                  style={{
                    fill: theme === 'dark' ? '#f9fafb' : '#1f2937',
                    fontSize: 11,
                    fontWeight: '500'
                  }}
                />
              ) : undefined
            }
            labels={formatPieLabel}
            style={{
              data: {
                fillOpacity: 0.9,
                stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                strokeWidth: 1
              }
            }}
          />

          {/* Center Label for Donut Charts */}
          {innerRadius > 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: theme === 'dark' ? '#f9fafb' : '#1f2937'
              }}>
                {total}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: theme === 'dark' ? '#9ca3af' : '#6b7280'
              }}>
                Total
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {showLegend && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxWidth: '200px'
          }}>
            {processedData.map((item, index) => {
              const percentage = ((item.y / total) * 100).toFixed(1);
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: item.fill,
                      flexShrink: 0
                    }}
                  />
                  <div style={{
                    color: theme === 'dark' ? '#f9fafb' : '#1f2937',
                    flex: 1
                  }}>
                    {item.x}
                  </div>
                  <div style={{
                    color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                    fontWeight: '500'
                  }}>
                    {percentage}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        background: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 0.8)',
        borderRadius: '8px',
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '0.875rem',
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          marginBottom: '0.25rem'
        }}>
          Total Elemente: {data.length} | Valoare Totală: {total.toLocaleString()}
        </div>
        <div style={{
          fontSize: '0.75rem',
          color: theme === 'dark' ? '#6b7280' : '#9ca3af'
        }}>
          Cel mai mare: {Math.max(...data.map(d => d.y)).toLocaleString()} |
          Cel mai mic: {Math.min(...data.map(d => d.y)).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default AdvancedPieChart;