// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/page.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Pagină detalii proiect mobil cu taburi (Info | Etape | Facturi | Contracte | Comentarii).
// FUNCȚIONALITATE: Fetch proiect prin /api/rapoarte/proiecte?search=ID, găsește exact match.
//                  FAB acțiuni rapide deschide ActiuniSheet.
// ==================================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../components/MobileTopBar';
import ProiectDetailTabs, { DetailTabKey } from './components/ProiectDetailTabs';
import InfoTab from './components/tabs/InfoTab';
import EtapeTab from './components/tabs/EtapeTab';
import FacturiTab from './components/tabs/FacturiTab';
import ContracteTab from './components/tabs/ContracteTab';
import ComentariiTab from './components/tabs/ComentariiTab';
import ActiuniSheet from './components/ActiuniSheet';

export default function ProiectDetailPage() {
  const params = useParams();
  const idParam = params?.id;
  const proiectId = decodeURIComponent(Array.isArray(idParam) ? idParam[0] : idParam || '');

  const [user] = useAuthState(auth);
  const [proiect, setProiect] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTabKey>('info');
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (!proiectId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ search: proiectId, limit: '20' });
        const res = await fetch(`/api/rapoarte/proiecte?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        // Găsește match exact pe ID_Proiect (search e LIKE)
        const exact = (json.data || []).find((p: any) => p.ID_Proiect === proiectId);
        if (cancelled) return;
        if (!exact) {
          setError('Proiectul nu a fost găsit.');
          setProiect(null);
        } else {
          setProiect(exact);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare necunoscută');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proiectId]);

  const counts = useMemo(() => {
    if (!proiect) return {};
    let facturiCount = 0;
    if (Array.isArray(proiect.contracte)) {
      for (const c of proiect.contracte) {
        if (Array.isArray(c.facturi_contract)) facturiCount += c.facturi_contract.length;
      }
    }
    if (Array.isArray(proiect.facturi_directe)) facturiCount += proiect.facturi_directe.length;
    return {
      facturi: facturiCount,
      contracte: Array.isArray(proiect.contracte) ? proiect.contracte.length : 0,
    };
  }, [proiect]);

  const title = proiect?.Denumire || proiectId || 'Proiect';

  return (
    <>
      <MobileTopBar title={title} showBack userId={user?.uid} />

      <ProiectDetailTabs active={activeTab} onChange={setActiveTab} counts={counts} />

      <div style={{ padding: 12, maxWidth: 720, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Se încarcă proiectul…</div>
        )}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        {!loading && !error && proiect && (
          <>
            {activeTab === 'info' && <InfoTab proiect={proiect} />}
            {activeTab === 'etape' && <EtapeTab proiectId={proiectId} />}
            {activeTab === 'facturi' && <FacturiTab proiect={proiect} />}
            {activeTab === 'contracte' && <ContracteTab proiect={proiect} />}
            {activeTab === 'comentarii' && <ComentariiTab proiectId={proiectId} />}
          </>
        )}
      </div>

      {/* FAB Acțiuni — la stânga FAB-ului Chatbot pentru a nu se suprapune */}
      <button
        type="button"
        onClick={() => setActionsOpen(true)}
        aria-label="Acțiuni rapide"
        style={{
          position: 'fixed',
          right: 'calc(16px + 56px + 12px)', // 16 (chatbot offset) + 56 (chatbot width) + 12 spacing
          bottom: 80,
          zIndex: 40,
          width: 52,
          height: 52,
          borderRadius: 26,
          border: 'none',
          background: '#0f172a',
          color: '#fff',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.3)',
        }}
      >
        +
      </button>

      <ActiuniSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        proiectId={proiectId}
        onAddComment={() => setActiveTab('comentarii')}
      />
    </>
  );
}
