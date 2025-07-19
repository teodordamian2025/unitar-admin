'use client';

import { ReactNode, useState } from 'react';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => ReactNode;
  width?: string;
}

export interface BaseTableProps {
  data: any[];
  columns: Column[];
  loading?: boolean;
  onRowClick?: (row: any) => void;
  actions?: (row: any) => ReactNode;
  emptyMessage?: string;
}

export default function BaseTable({ 
  data, 
  columns, 
  loading = false, 
  onRowClick,
  actions,
  emptyMessage = "Nu sunt date disponibile"
}: BaseTableProps) {
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div>Se încarcă...</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    borderBottom: '1px solid #dee2e6',
                    fontWeight: 600,
                    color: '#495057',
                    cursor: column.sortable ? 'pointer' : 'default',
                    width: column.width,
                    userSelect: 'none'
                  }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {column.label}
                    {column.sortable && (
                      <span style={{ opacity: sortColumn === column.key ? 1 : 0.3 }}>
                        {sortColumn === column.key && sortDirection === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions && (
                <th style={{
                  padding: '1rem',
                  textAlign: 'center',
                  borderBottom: '1px solid #dee2e6',
                  fontWeight: 600,
                  color: '#495057',
                  width: '120px'
                }}>
                  Acțiuni
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length + (actions ? 1 : 0)}
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: '#6c757d'
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default'
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) {
                      e.currentTarget.style.background = '#f8f9fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onRowClick) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #dee2e6',
                        color: '#495057'
                      }}
                    >
                      {column.render 
                        ? column.render(row[column.key], row)
                        : row[column.key]
                      }
                    </td>
                  ))}
                  {actions && (
                    <td style={{
                      padding: '1rem',
                      borderBottom: '1px solid #dee2e6',
                      textAlign: 'center'
                    }}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

