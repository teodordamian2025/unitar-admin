'use client';

import { useState, useEffect } from 'react';
import BaseTable, { Column } from '../../components/BaseTable';
import ProiectActions from './ProiectActions';

interface ProiecteTableProps {
  filters: any;
  onRowClick?: (proiect: any) => void;
}

export default function ProiecteTable({ filters, onRowClick }: ProiecteTableProps) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProiecte();
  }, [filters]);

  const fetchProiecte = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value as string);
      });

      const response = await fetch(`/api/rapoarte/proiecte?${queryParams}`);
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea proiectelor:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionKey: string, proiect: any) => {
    switch (actionKey) {
      case 'view':
        window.open(`/admin/rapoarte/proiecte/${proiect.ID_Proiect}`, '_blank');
        break;
      
      case 'edit':
        // TODO: Implementare modal editare
        alert(`Editare proiect: ${proiect.ID_Proiect}`);
        break;
      
      case 'generate_contract':
        try {
          const response = await fetch('/api/actions/genereaza-contract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proiectId: proiect.ID_Proiect })
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Contract_${proiect.ID_Proiect}.pdf`;
            a.click();
            alert('Contract generat cu succes!');
          }
        } catch (error) {
          alert('Eroare la generarea contractului');
        }
        break;
      
      case 'generate_invoice':
        alert(`Generare factură pentru: ${proiect.ID_Proiect}`);
        break;
      
      case 'send_email':
        alert(`Trimitere email pentru: ${proiect.ID_Proiect}`);
        break;
      
      case 'mark_completed':
        if (confirm('Sigur vrei să marchezi acest proiect ca finalizat?')) {
          await updateProiectStatus(proiect.ID_Proiect, 'Finalizat');
        }
        break;
      
      case 'suspend':
        if (confirm('Sigur vrei să suspenzi acest proiect?')) {
          await updateProiectStatus(proiect.ID_Proiect, 'Suspendat');
        }
        break;
      
      case 'delete':
        if (confirm('Sigur vrei să ștergi acest proiect? Această acțiune nu poate fi anulată!')) {
          await deleteProiect(proiect.ID_Proiect);
        }
        break;
    }
  };

  const updateProiectStatus = async (proiectId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/rapoarte/proiecte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proiectId, status: newStatus })
      });
      
      if (response.ok) {
        await fetchProiecte(); // Refresh data
        alert(`Status actualizat la: ${newStatus}`);
      }
    } catch (error) {
      alert('Eroare la actualizarea statusului');
    }
  };

  const deleteProiect = async (proiectId: string) => {
    try {
      const response = await fetch(`/api/rapoarte/proiecte?id=${proiectId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchProiecte(); // Refresh data
        alert('Proiect șters cu succes');
      }
    } catch (error) {
      alert('Eroare la ștergerea proiectului');
    }
  };

  const renderStatus = (status: string) => {
    const statusConfig = {
      'Activ': { color: '#28a745', icon: '🟢' },
      'În lucru': { color: '#ffc107', icon: '🟡' },
      'Suspendat': { color: '#fd7e14', icon: '🟠' },
      'Finalizat': { color: '#6f42c1', icon: '✅' },
      'Anulat': { color: '#dc3545', icon: '🔴' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { color: '#6c757d', icon: '⚪' };

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 500,
        background: `${config.color}20`,
        color: config.color,
        border: `1px solid ${config.color}40`
      }}>
        {config.icon} {status}
      </span>
    );
  };

  const renderValoare = (valoare: any) => {
    if (!valoare) return '-';
    const amount = typeof valoare === 'string' ? parseFloat(valoare) : valoare;
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON'
    }).format(amount);
  };

  const renderData = (data: any) => {
    if (!data) return '-';
    if (typeof data === 'object' && data.value) {
      return new Date(data.value).toLocaleDateString('ro-RO');
    }
    return new Date(data).toLocaleDateString('ro-RO');
  };

  const columns: Column[] = [
    {
      key: 'ID_Proiect',
      label: 'ID Proiect',
      sortable: true,
      width: '150px',
      render: (value) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{value}</span>
      )
    },
    {
      key: 'Denumire',
      label: 'Denumire Proiect',
      sortable: true,
      render: (value) => (
        <div style={{ maxWidth: '300px' }}>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
            {value?.length > 50 ? `${value.substring(0, 50)}...` : value}
          </div>
        </div>
      )
    },
    {
      key: 'Client',
      label: 'Client',
      sortable: true,
      width: '200px'
    },
    {
      key: 'Status',
      label: 'Status',
      sortable: true,
      width: '130px',
      render: renderStatus
    },
    {
      key: 'Data_Start',
      label: 'Data Început',
      sortable: true,
      width: '120px',
      render: renderData
    },
    {
      key: 'Data_Final',
      label: 'Data Final',
      sortable: true,
      width: '120px',
      render: renderData
    },
    {
      key: 'Valoare_Estimata',
      label: 'Valoare',
      sortable: true,
      width: '120px',
      render: renderValoare
    }
  ];

  return (
    <BaseTable
      data={data}
      columns={columns}
      loading={loading}
      onRowClick={onRowClick}
      actions={(row) => (
        <ProiectActions
          proiect={row}
          onAction={handleAction}
        />
      )}
      emptyMessage="Nu sunt proiecte disponibile cu filtrele selectate."
    />
  );
}

