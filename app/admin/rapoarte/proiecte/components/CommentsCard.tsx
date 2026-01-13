// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/components/CommentsCard.tsx
// DATA: 12.01.2026 (ora României)
// DESCRIERE: Card pentru afișarea comentariilor proiect cu modal răspuns
// FUNCȚIONALITATE: Afișează ultimele comentarii, permite răspuns rapid
// ==================================================================

'use client';

import { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { toast } from 'react-toastify';

interface CommentsCardProps {
  proiectId: string;
  tipProiect?: 'proiect' | 'subproiect';
  proiectDenumire?: string;
  maxComments?: number;
  showAddButton?: boolean;
}

interface Comentariu {
  id: string;
  proiect_id: string;
  autor_uid: string;
  autor_nume: string;
  comentariu: string;
  data_comentariu: string | { value: string };
  tip_comentariu: string;
}

interface UtilizatorCurent {
  uid: string;
  email: string;
  nume: string;
  prenume: string;
  nume_complet: string;
  rol: string;
}

// FIX 13.01.2026: Wrap cu React.memo pentru a preveni re-render-uri inutile (input lent)
function CommentsCardComponent({
  proiectId,
  tipProiect = 'proiect',
  proiectDenumire = '',
  maxComments = 5,
  showAddButton = true
}: CommentsCardProps) {
  const [firebaseUser] = useAuthState(auth);
  const [comentarii, setComentarii] = useState<Comentariu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [newComentariu, setNewComentariu] = useState('');
  const [tipComentariu, setTipComentariu] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [utilizatorCurent, setUtilizatorCurent] = useState<UtilizatorCurent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (proiectId) {
      loadComentarii();
    }
  }, [proiectId, tipProiect]);

  useEffect(() => {
    if (firebaseUser) {
      loadUtilizatorCurent();
    }
  }, [firebaseUser]);

  const loadUtilizatorCurent = async () => {
    if (!firebaseUser) return;

    try {
      const response = await fetch('/api/utilizatori/curent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: firebaseUser.uid })
      });

      const data = await response.json();

      if (data.success && data.data) {
        const user = data.data;
        setUtilizatorCurent({
          uid: user.uid,
          email: user.email,
          nume: user.nume,
          prenume: user.prenume,
          nume_complet: user.nume_complet || `${user.nume} ${user.prenume}`,
          rol: user.rol
        });
      }
    } catch (error) {
      console.error('Eroare la încărcarea utilizatorului curent:', error);
    }
  };

  const loadComentarii = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        proiect_id: proiectId,
        tip_proiect: tipProiect,
        limit: String(maxComments + 5)
      });

      const response = await fetch(`/api/rapoarte/comentarii?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setComentarii(data.data || []);
      } else {
        console.error('Eroare la încărcarea comentariilor:', data.error);
        setComentarii([]);
      }
    } catch (error) {
      console.error('Eroare la încărcarea comentariilor:', error);
      setComentarii([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComentariu = async () => {
    if (!newComentariu.trim() || !utilizatorCurent) {
      toast.error('Completați comentariul');
      return;
    }

    setSubmitting(true);
    try {
      const comentariuId = `com_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = await fetch('/api/rapoarte/comentarii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: comentariuId,
          proiect_id: proiectId,
          tip_proiect: tipProiect,
          autor_uid: utilizatorCurent.uid,
          autor_nume: utilizatorCurent.nume_complet,
          comentariu: newComentariu.trim(),
          tip_comentariu: tipComentariu
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Comentariu adăugat cu succes!');
        setNewComentariu('');
        setShowReplyModal(false);
        loadComentarii();
      } else {
        throw new Error(data.error || 'Eroare la adăugarea comentariului');
      }
    } catch (error) {
      console.error('Eroare la adăugarea comentariului:', error);
      toast.error(error instanceof Error ? error.message : 'Eroare la adăugarea comentariului');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateValue: string | { value: string }) => {
    const dateStr = typeof dateValue === 'object' && dateValue.value
      ? dateValue.value
      : dateValue.toString();

    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Bucharest'
      });
    } catch {
      return dateStr;
    }
  };

  const getTipComentariuColor = (tip: string) => {
    switch (tip) {
      case 'Progres': return '#10b981';
      case 'Problemă': return '#ef4444';
      case 'Întrebare': return '#f59e0b';
      case 'General': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const displayedComments = comentarii.slice(0, maxComments);
  const hasMoreComments = comentarii.length > maxComments;

  // Modal pentru răspuns
  const ReplyModal = () => {
    if (!mounted) return null;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60000,
          padding: '1rem'
        }}
        onClick={() => setShowReplyModal(false)}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            width: '100%',
            maxWidth: '500px',
            maxHeight: 'calc(100vh - 4rem)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(16, 185, 129, 0.05))'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>
              💬 Adaugă Comentariu
            </h3>
            <button
              onClick={() => setShowReplyModal(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '0.25rem'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '1.5rem' }}>
            {proiectDenumire && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(59, 130, 246, 0.08)',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: '#1f2937'
              }}>
                <strong>Proiect:</strong> {proiectDenumire}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Tip Comentariu
              </label>
              <select
                value={tipComentariu}
                onChange={(e) => setTipComentariu(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="General">💬 General</option>
                <option value="Progres">📈 Progres</option>
                <option value="Problemă">⚠️ Problemă</option>
                <option value="Întrebare">❓ Întrebare</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '500', color: '#374151', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Comentariu
              </label>
              <textarea
                value={newComentariu}
                onChange={(e) => setNewComentariu(e.target.value)}
                placeholder="Scrieți comentariul dvs..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowReplyModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Anulează
              </button>
              <button
                onClick={handleSubmitComentariu}
                disabled={submitting || !newComentariu.trim()}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: submitting ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}
              >
                {submitting ? 'Se salvează...' : '💬 Trimite'}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '1.25rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💬 Comentarii {comentarii.length > 0 && `(${comentarii.length})`}
        </h3>
        {showAddButton && (
          <button
            onClick={() => setShowReplyModal(true)}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            + Adaugă
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
          Se încarcă comentariile...
        </div>
      ) : displayedComments.length === 0 ? (
        <div style={{
          color: '#9ca3af',
          fontSize: '0.875rem',
          textAlign: 'center',
          padding: '1.5rem',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px dashed #e5e7eb'
        }}>
          Nu există comentarii
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayedComments.map((comentariu) => (
            <div
              key={comentariu.id}
              style={{
                padding: '0.75rem',
                background: '#f9fafb',
                borderRadius: '8px',
                borderLeft: `3px solid ${getTipComentariuColor(comentariu.tip_comentariu)}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    color: '#374151'
                  }}>
                    {comentariu.autor_nume}
                  </span>
                  <span style={{
                    padding: '0.15rem 0.4rem',
                    background: `${getTipComentariuColor(comentariu.tip_comentariu)}15`,
                    color: getTipComentariuColor(comentariu.tip_comentariu),
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '500'
                  }}>
                    {comentariu.tip_comentariu}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                  {formatDate(comentariu.data_comentariu)}
                </span>
              </div>
              <p style={{
                margin: 0,
                fontSize: '0.825rem',
                color: '#4b5563',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                {comentariu.comentariu.length > 150
                  ? `${comentariu.comentariu.substring(0, 150)}...`
                  : comentariu.comentariu}
              </p>
            </div>
          ))}

          {hasMoreComments && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <span style={{
                fontSize: '0.8rem',
                color: '#3b82f6',
                cursor: 'pointer'
              }}>
                + {comentarii.length - maxComments} comentarii
              </span>
            </div>
          )}
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && <ReplyModal />}
    </div>
  );
}

// FIX 13.01.2026: Export cu React.memo pentru optimizare
export default memo(CommentsCardComponent);
