// ==================================================================
// CALEA: app/components/charts/AdvancedLineChart.tsx
// DATA: 19.09.2025 22:25 (ora României)
// DESCRIERE: Grafic linie avansat cu Victory.js pentru analytics
// FUNCȚIONALITATE: Multi-series, zoom, tooltip, responsive design
// ==================================================================

'use client';

import React from 'react';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryTooltip,
  VictoryTheme,
  VictoryContainer,
  VictoryArea,
  VictoryLabel,
  VictoryLegend
} from 'victory';

interface DataPoint {
  x: string | number;
  y: number;
  label?: string;
}

interface SeriesData {
  name: string;
  data: DataPoint[];
  color?: string;
  strokeWidth?: number;
  area?: boolean;
}

interface AdvancedLineChartProps {
  data: SeriesData[];
  width?: number;
  height?: number;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  animate?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

const AdvancedLineChart: React.FC<AdvancedLineChartProps> = ({
  data,
  width = 600,
  height = 400,
  title,
  xAxisLabel,
  yAxisLabel,
  showLegend = true,
  animate = true,
  theme = 'light',
  className = ''
}) => {
  const chartTheme = theme === 'dark' ? VictoryTheme.grayscale : VictoryTheme.material;

  const defaultColors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316'  // orange
  ];

  const containerStyle = {
    background: theme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '1rem',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
  };

  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: theme === 'dark' ? '#f9fafb' : '#1f2937',
    textAlign: 'center' as const,
    marginBottom: '1rem'
  };

  return (
    <div className={className} style={containerStyle}>
      {title && (
        <div style={titleStyle}>
          {title}
        </div>
      )}

      <VictoryChart
        theme={chartTheme}
        width={width}
        height={height}
        containerComponent={
          <VictoryContainer
            responsive={true}
            style={{
              background: 'transparent'
            }}
          />
        }
        padding={{ left: 80, top: 20, right: 50, bottom: 80 }}
        animate={animate ? { duration: 1000, onLoad: { duration: 500 } } : false}
      >
        {/* X Axis */}
        <VictoryAxis
          dependentAxis={false}
          style={{
            tickLabels: {
              fontSize: 12,
              padding: 5,
              fill: theme === 'dark' ? '#d1d5db' : '#374151'
            },
            grid: {
              stroke: theme === 'dark' ? 'rgba(209, 213, 219, 0.1)' : 'rgba(156, 163, 175, 0.2)',
              strokeWidth: 1
            }
          }}
          fixLabelOverlap={true}
        />

        {/* Y Axis */}
        <VictoryAxis
          dependentAxis={true}
          style={{
            tickLabels: {
              fontSize: 12,
              padding: 5,
              fill: theme === 'dark' ? '#d1d5db' : '#374151'
            },
            grid: {
              stroke: theme === 'dark' ? 'rgba(209, 213, 219, 0.1)' : 'rgba(156, 163, 175, 0.2)',
              strokeWidth: 1
            }
          }}
        />

        {/* Data Series */}
        {data.map((series, index) => {
          const seriesColor = series.color || defaultColors[index % defaultColors.length];

          if (series.area) {
            return (
              <VictoryArea
                key={`area-${index}`}
                data={series.data}
                style={{
                  data: {
                    fill: seriesColor,
                    fillOpacity: 0.2,
                    stroke: seriesColor,
                    strokeWidth: series.strokeWidth || 2
                  }
                }}
                animate={animate ? { duration: 1000 } : false}
                labelComponent={
                  <VictoryTooltip
                    style={{
                      fill: theme === 'dark' ? '#f9fafb' : '#1f2937',
                      fontSize: 12
                    }}
                    flyoutStyle={{
                      stroke: seriesColor,
                      strokeWidth: 1,
                      fill: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
                    }}
                  />
                }
              />
            );
          }

          return (
            <VictoryLine
              key={`line-${index}`}
              data={series.data}
              style={{
                data: {
                  stroke: seriesColor,
                  strokeWidth: series.strokeWidth || 2
                }
              }}
              animate={animate ? { duration: 1000 } : false}
              labelComponent={
                <VictoryTooltip
                  style={{
                    fill: theme === 'dark' ? '#f9fafb' : '#1f2937',
                    fontSize: 12
                  }}
                  flyoutStyle={{
                    stroke: seriesColor,
                    strokeWidth: 1,
                    fill: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
                  }}
                />
              }
            />
          );
        })}

        {/* Legend */}
        {showLegend && data.length > 1 && (
          <VictoryLegend
            x={width - 200}
            y={20}
            orientation="vertical"
            gutter={10}
            style={{
              border: {
                stroke: theme === 'dark' ? 'rgba(209, 213, 219, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                fill: theme === 'dark' ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)'
              },
              title: {
                fontSize: 12,
                fill: theme === 'dark' ? '#f9fafb' : '#1f2937'
              }
            }}
            data={data.map((series, index) => ({
              name: series.name,
              symbol: {
                fill: series.color || defaultColors[index % defaultColors.length]
              }
            }))}
          />
        )}

        {/* Axis Labels */}
        {xAxisLabel && (
          <VictoryLabel
            text={xAxisLabel}
            x={width / 2}
            y={height - 10}
            textAnchor="middle"
            style={{
              fontSize: 12,
              fill: theme === 'dark' ? '#d1d5db' : '#374151'
            }}
          />
        )}

        {yAxisLabel && (
          <VictoryLabel
            text={yAxisLabel}
            x={20}
            y={height / 2}
            textAnchor="middle"
            angle={-90}
            style={{
              fontSize: 12,
              fill: theme === 'dark' ? '#d1d5db' : '#374151'
            }}
          />
        )}
      </VictoryChart>
    </div>
  );
};

export default AdvancedLineChart;