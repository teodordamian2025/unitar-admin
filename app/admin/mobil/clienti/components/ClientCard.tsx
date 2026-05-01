// ==================================================================
// CALEA: app/admin/mobil/clienti/components/ClientCard.tsx
// DATA: 01.05.2026 (Faza 3)
// DESCRIERE: Card mobil pentru un client — nume, CUI, oraș, contact.
// ==================================================================

'use client';

export interface ClientMinimal {
  id: string;
  nume?: string | null;
  tip_client?: string | null;
  cui?: string | null;
  nr_reg_com?: string | null;
  oras?: string | null;
  judet?: string | null;
  telefon?: string | null;
  email?: string | null;
}

interface ClientCardProps {
  client: ClientMinimal;
  onSelect?: (c: ClientMinimal) => void;
}

export default function ClientCard({ client, onSelect }: ClientCardProps) {
  const isJuridic =
    client.tip_client === 'Juridic' ||
    client.tip_client === 'Juridic_TVA' ||
    client.tip_client === 'persoana_juridica';

  const content = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
            {client.nume || '—'}
          </div>
          {(client.cui || client.nr_reg_com) && (
            <div
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 2,
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {[client.cui, client.nr_reg_com].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            background: isJuridic ? '#dbeafe' : '#e2e8f0',
            color: isJuridic ? '#1e40af' : '#475569',
            padding: '2px 8px',
            borderRadius: 999,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {isJuridic ? 'Juridic' : client.tip_client || 'Fizic'}
        </span>
      </div>

      {(client.oras || client.judet) && (
        <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>
          📍 {[client.oras, client.judet].filter(Boolean).join(', ')}
        </div>
      )}

      {(client.telefon || client.email) && (
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {client.telefon && <span>📞 {client.telefon}</span>}
          {client.email && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ✉️ {client.email}
            </span>
          )}
        </div>
      )}
    </>
  );

  const baseStyle: React.CSSProperties = {
    display: 'block',
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: 12,
    color: 'inherit',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    width: '100%',
    textAlign: 'left',
    cursor: onSelect ? 'pointer' : 'default',
  };

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(client)} style={{ ...baseStyle, font: 'inherit' }}>
        {content}
      </button>
    );
  }
  return <div style={baseStyle}>{content}</div>;
}
