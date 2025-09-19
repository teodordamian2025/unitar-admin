// ==================================================================
// CALEA: app/components/charts/AdvancedBarChart.tsx
// DATA: 19.09.2025 22:30 (ora României)
// DESCRIERE: Grafic bare avansat cu Victory.js pentru analytics
// FUNCȚIONALITATE: Stacked bars, grouped bars, horizontal/vertical, animații
// ==================================================================

'use client';

import React from 'react';
import {
  VictoryChart,
  VictoryBar,
  VictoryAxis,
  VictoryTooltip,
  VictoryTheme,
  VictoryContainer,
  VictoryLabel,
  VictoryLegend,
  VictoryGroup,
  VictoryStack
} from 'victory';

interface DataPoint {
  x: string | number;
  y: number;
  label?: string;
  fill?: string;
}

interface SeriesData {
  name: string;
  data: DataPoint[];
  color?: string;
}

interface AdvancedBarChartProps {
  data: SeriesData[];
  width?: number;
  height?: number;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  animate?: boolean;
  theme?: 'light' | 'dark';
  orientation?: 'vertical' | 'horizontal';
  groupType?: 'grouped' | 'stacked' | 'single';
  className?: string;
  colorScheme?: string[];
}

const AdvancedBarChart: React.FC<AdvancedBarChartProps> = ({
  data,
  width = 600,
  height = 400,
  title,
  xAxisLabel,
  yAxisLabel,
  showLegend = true,
  animate = true,
  theme = 'light',
  orientation = 'vertical',
  groupType = 'grouped',
  className = '',
  colorScheme
}) => {
  const chartTheme = theme === 'dark' ? VictoryTheme.grayscale : VictoryTheme.material;

  const defaultColors = colorScheme || [
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

  const renderBars = () => {
    if (groupType === 'single' || data.length === 1) {
      const series = data[0];
      return (
        <VictoryBar
          data={series.data}
          horizontal={orientation === 'horizontal'}
          style={{
            data: {
              fill: ({ datum, index }: { datum: any; index: number }) =>
                datum.fill || series.color || defaultColors[index % defaultColors.length],
              stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              strokeWidth: 1
            }
          }}
          animate={animate ? { duration: 1000, onLoad: { duration: 500 } } : false}
          labelComponent={
            <VictoryTooltip
              style={{
                fill: theme === 'dark' ? '#f9fafb' : '#1f2937',
                fontSize: 12
              }}
              flyoutStyle={{
                stroke: series.color || defaultColors[0],
                strokeWidth: 1,
                fill: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
              }}
            />
          }
        />
      );
    }

    if (groupType === 'stacked') {
      return (
        <VictoryStack
          horizontal={orientation === 'horizontal'}
          animate={animate ? { duration: 1000, onLoad: { duration: 500 } } : false}
        >
          {data.map((series, index) => (
            <VictoryBar
              key={`stack-${index}`}
              data={series.data}
              style={{
                data: {
                  fill: series.color || defaultColors[index % defaultColors.length],
                  stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  strokeWidth: 1
                }
              }}
              labelComponent={
                <VictoryTooltip
                  style={{
                    fill: theme === 'dark' ? '#f9fafb' : '#1f2937',
                    fontSize: 12
                  }}
                  flyoutStyle={{
                    stroke: series.color || defaultColors[index % defaultColors.length],
                    strokeWidth: 1,
                    fill: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
                  }}
                />
              }
            />
          ))}
        </VictoryStack>
      );
    }

    // Grouped bars
    return (
      <VictoryGroup
        offset={20}
        colorScale={defaultColors}
        horizontal={orientation === 'horizontal'}
        animate={animate ? { duration: 1000, onLoad: { duration: 500 } } : false}
      >
        {data.map((series, index) => (
          <VictoryBar
            key={`group-${index}`}
            data={series.data}
            style={{
              data: {
                fill: series.color || defaultColors[index % defaultColors.length],
                stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                strokeWidth: 1
              }
            }}
            labelComponent={
              <VictoryTooltip
                style={{
                  fill: theme === 'dark' ? '#f9fafb' : '#1f2937',
                  fontSize: 12
                }}
                flyoutStyle={{
                  stroke: series.color || defaultColors[index % defaultColors.length],
                  strokeWidth: 1,
                  fill: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
                }}
              />
            }
          />
        ))}
      </VictoryGroup>
    );
  };

  const getPadding = () => {
    if (orientation === 'horizontal') {
      return { left: 100, top: 50, right: 50, bottom: 50 };
    }
    return { left: 80, top: 20, right: 50, bottom: 80 };
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
        domainPadding={groupType === 'grouped' ? 20 : 10}
        containerComponent={
          <VictoryContainer
            responsive={true}
            style={{
              background: 'transparent'
            }}
          />
        }
        padding={getPadding()}
      >
        {/* X Axis */}
        <VictoryAxis
          dependentAxis={orientation === 'horizontal'}
          style={{
            tickLabels: {
              fontSize: 12,
              padding: 5,
              fill: theme === 'dark' ? '#d1d5db' : '#374151',
              angle: orientation === 'vertical' ? -45 : 0
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
          dependentAxis={orientation === 'vertical'}
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
          tickFormat={(value) => {
            if (typeof value === 'number' && value >= 1000) {
              return `${(value / 1000).toFixed(1)}k`;
            }
            return value;
          }}
        />

        {/* Bars */}
        {renderBars()}

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

export default AdvancedBarChart;