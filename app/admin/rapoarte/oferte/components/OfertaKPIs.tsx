// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OfertaKPIs.tsx
// DATA: 04.04.2026
// DESCRIERE: Carduri KPI pentru dashboard oferte
// ==================================================================

'use client';

interface KPIData {
  total: number;
  acceptate: number;
  refuzate: number;
  in_asteptare: number;
  trimise: number;
  expirate: number;
  valoare_medie: number;
  valoare_totala_acceptate: number;
  valoare_pipeline: number;
  rata_conversie: number;
}

interface OfertaKPIsProps {
  data: KPIData | null;
}

export default function OfertaKPIs({ data }: OfertaKPIsProps) {
  const kpi = data || {
    total: 0, acceptate: 0, refuzate: 0, in_asteptare: 0, trimise: 0,
    expirate: 0, valoare_medie: 0, valoare_totala_acceptate: 0, valoare_pipeline: 0, rata_conversie: 0
  };

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  const cards = [
    {
      label: 'Total Oferte',
      value: kpi.total,
      format: (v: number) => v.toString(),
      color: '#3498db',
      gradient: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
      subtitle: `${kpi.trimise} trimise`
    },
    {
      label: 'Rata Conversie',
      value: kpi.rata_conversie,
      format: (v: number) => `${v}%`,
      color: '#27ae60',
      gradient: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
      subtitle: `${kpi.acceptate} acceptate`
    },
    {
      label: 'In Asteptare',
      value: kpi.in_asteptare,
      format: (v: number) => v.toString(),
      color: '#f39c12',
      gradient: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
      subtitle: `Pipeline: ${formatValue(kpi.valoare_pipeline)} RON`
    },
    {
      label: 'Valoare Acceptate',
      value: kpi.valoare_totala_acceptate,
      format: (v: number) => `${formatValue(v)} RON`,
      color: '#8e44ad',
      gradient: 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
      subtitle: `Media: ${formatValue(kpi.valoare_medie)} RON`
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem'
    }}>
      {cards.map((card, index) => (
        <div key={index} style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          padding: '1.5rem',
          position: 'relative' as const,
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: card.gradient
          }} />
          <div style={{ fontSize: '13px', color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
            {card.label}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: card.color, lineHeight: 1.2 }}>
            {card.format(card.value)}
          </div>
          <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '0.25rem' }}>
            {card.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
}
