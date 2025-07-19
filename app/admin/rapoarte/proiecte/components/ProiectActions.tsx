'use client';

import ActionDropdown, { ActionItem } from '../../components/ActionDropdown';

interface ProiectActionsProps {
  proiect: any;
  onAction: (actionKey: string, proiect: any) => void;
}

export default function ProiectActions({ proiect, onAction }: ProiectActionsProps) {
  const actions: ActionItem[] = [
    {
      key: 'view',
      label: 'Vezi Detalii',
      icon: '👁️',
      color: 'primary'
    },
    {
      key: 'edit',
      label: 'Editează',
      icon: '✏️',
      color: 'secondary'
    },
    {
      key: 'duplicate',
      label: 'Duplică Proiect',
      icon: '📋',
      color: 'secondary'
    },
    {
      key: 'divider1',
      label: '',
      divider: true
    },
    {
      key: 'generate_contract',
      label: 'Generează Contract',
      icon: '📄',
      color: 'success',
      disabled: proiect.Status === 'Anulat'
    },
    {
      key: 'generate_invoice',
      label: 'Creează Factură',
      icon: '💰',
      color: 'warning',
      disabled: proiect.Status !== 'Activ' && proiect.Status !== 'Finalizat'
    },
    {
      key: 'send_email',
      label: 'Trimite Email Client',
      icon: '📧',
      color: 'primary'
    },
    {
      key: 'divider2',
      label: '',
      divider: true
    },
    {
      key: 'mark_completed',
      label: 'Marchează Finalizat',
      icon: '✅',
      color: 'success',
      disabled: proiect.Status === 'Finalizat' || proiect.Status === 'Anulat'
    },
    {
      key: 'suspend',
      label: 'Suspendă Proiect',
      icon: '⏸️',
      color: 'warning',
      disabled: proiect.Status === 'Suspendat' || proiect.Status === 'Finalizat'
    },
    {
      key: 'divider3',
      label: '',
      divider: true
    },
    {
      key: 'delete',
      label: 'Șterge Proiect',
      icon: '🗑️',
      color: 'danger'
    }
  ];

  return (
    <ActionDropdown
      actions={actions}
      onAction={onAction}
      data={proiect}
    />
  );
}

