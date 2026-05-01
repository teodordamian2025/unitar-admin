// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/components/tabs/ComentariiTab.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Tab "Comentarii" — slim mobile-first.
// FUNCȚIONALITATE: GET + POST /api/rapoarte/comentarii. Optimistic UI update.
// NOTĂ: NU reutilizăm CommentsCard.tsx (515 linii cu portal admin desktop).
//       Pattern minim, refolosește același endpoint API.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { toast } from 'react-toastify';
import { bqDateString } from '../../../../lib/format';

interface Comentariu {
  id: string;
  proiect_id: string;
  autor_uid: string;
  autor_nume: string;
  comentariu: string;
  data_comentariu: string | { value: string };
  tip_comentariu?: string;
  __optimistic?: boolean;
}

interface ComentariiTabProps {
  proiectId: string;
}

function formatTimestamp(input: unknown): string {
  const iso = bqDateString(input);
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ComentariiTab({ proiectId }: ComentariiTabProps) {
  const [user] = useAuthState(auth);
  const [items, setItems] = useState<Comentariu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [authorName, setAuthorName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/rapoarte/comentarii?proiect_id=${encodeURIComponent(proiectId)}&tip_proiect=proiect&limit=100`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        if (!cancelled) setItems(json.data || []);
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

  // Identifică numele autor pentru afișare
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/utilizatori/curent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid }),
        });
        const json = await res.json();
        const u = json?.utilizator || json?.data;
        const nume = u?.nume_complet || `${u?.prenume || ''} ${u?.nume || ''}`.trim();
        setAuthorName(nume || user.displayName || user.email || 'Utilizator');
      } catch {
        setAuthorName(user.displayName || user.email || 'Utilizator');
      }
    })();
  }, [user]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!user || !text || sending) return;
    if (text.length < 3) {
      toast.warn('Comentariul trebuie să aibă minim 3 caractere.');
      return;
    }

    const tempId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? (crypto as any).randomUUID()
        : `temp_${Date.now()}_${Math.random()}`;

    const optimistic: Comentariu = {
      id: tempId,
      proiect_id: proiectId,
      autor_uid: user.uid,
      autor_nume: authorName || 'Tu',
      comentariu: text,
      data_comentariu: new Date().toISOString(),
      tip_comentariu: 'General',
      __optimistic: true,
    };

    setItems((prev) => [optimistic, ...prev]);
    setDraft('');
    setSending(true);

    try {
      const res = await fetch('/api/rapoarte/comentarii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tempId,
          proiect_id: proiectId,
          tip_proiect: 'proiect',
          autor_uid: user.uid,
          autor_nume: authorName || user.displayName || user.email || 'Utilizator',
          comentariu: text,
          tip_comentariu: 'General',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Eroare la salvare');
      // Marchează ca persistat (scoate flagul optimistic)
      setItems((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, __optimistic: false } : c))
      );
    } catch (e: any) {
      // Rollback
      setItems((prev) => prev.filter((c) => c.id !== tempId));
      setDraft(text); // restaurează draftul
      toast.error(`Nu s-a putut adăuga comentariul: ${e?.message || 'eroare'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Compose */}
      <section
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 12,
          marginBottom: 12,
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Scrie un comentariu nou…"
          style={{
            width: '100%',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: 10,
            fontSize: 14,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {draft.trim().length}/3+ caractere
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || draft.trim().length < 3 || !user}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 8,
              background:
                sending || draft.trim().length < 3 || !user ? '#94a3b8' : '#2563eb',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor:
                sending || draft.trim().length < 3 || !user ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Se trimite…' : 'Adaugă'}
          </button>
        </div>
      </section>

      {/* List */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 16, color: '#64748b', fontSize: 13 }}>
          Se încarcă comentariile…
        </div>
      )}
      {error && (
        <div style={{ color: '#b91c1c', fontSize: 13, padding: 12 }}>{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: '#64748b', fontSize: 14 }}>
          Niciun comentariu. Fii primul!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((c) => (
          <article
            key={c.id}
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: 12,
              opacity: c.__optimistic ? 0.7 : 1,
            }}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                {c.autor_nume}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {c.__optimistic ? 'Se trimite…' : formatTimestamp(c.data_comentariu)}
              </span>
            </header>
            <p
              style={{
                fontSize: 14,
                color: '#334155',
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.4,
              }}
            >
              {c.comentariu}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
