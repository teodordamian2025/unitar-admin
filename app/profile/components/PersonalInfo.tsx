// ==================================================================
// CALEA: app/profile/components/PersonalInfo.tsx
// DATA: 21.09.2025 19:00 (ora României)
// DESCRIERE: Component informații personale pentru utilizatori normali
// FUNCȚIONALITATE: Afișare și editare informații de bază utilizator
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { updateProfile } from 'firebase/auth';
import { toast } from 'react-hot-toast';

interface PersonalInfoProps {
  user: User;
  displayName: string;
}

interface UserProfile {
  displayName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  startDate: string;
  bio: string;
}

export default function PersonalInfo({ user, displayName }: PersonalInfoProps) {
  const [profile, setProfile] = useState<UserProfile>({
    displayName: displayName || user.displayName || '',
    email: user.email || '',
    phone: '',
    department: '',
    position: '',
    startDate: '',
    bio: ''
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    try {
      // Încearcă să încarce profilul din BigQuery sau localStorage
      const savedProfile = localStorage.getItem(`userProfile_${user.uid}`);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setProfile(prev => ({ ...prev, ...parsed }));
        setInitialProfile(parsed);
      }
    } catch (error) {
      console.error('Eroare la încărcarea profilului:', error);
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Validări de bază
      if (!profile.displayName.trim()) {
        toast.error('Numele este obligatoriu');
        return;
      }

      // Actualizează profilul Firebase dacă s-a schimbat numele
      if (profile.displayName !== user.displayName) {
        await updateProfile(user, {
          displayName: profile.displayName
        });
      }

      // Salvează în localStorage (în producție ar fi BigQuery)
      const profileToSave = {
        displayName: profile.displayName,
        email: profile.email,
        phone: profile.phone,
        department: profile.department,
        position: profile.position,
        startDate: profile.startDate,
        bio: profile.bio
      };

      localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(profileToSave));
      setInitialProfile(profileToSave);

      setEditing(false);
      toast.success('Profilul a fost actualizat cu succes!');

    } catch (error) {
      console.error('Eroare la salvarea profilului:', error);
      toast.error('Eroare la actualizarea profilului');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (initialProfile) {
      setProfile(prev => ({ ...prev, ...initialProfile }));
    }
    setEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Nu este setată';
    try {
      return new Date(dateString).toLocaleDateString('ro-RO');
    } catch {
      return 'Dată invalidă';
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      padding: '2rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: 0
        }}>
          Informații Personale
        </h2>

        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ✏️ Editează
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleCancel}
              disabled={loading}
              style={{
                background: 'rgba(107, 114, 128, 0.1)',
                color: '#374151',
                border: '1px solid rgba(107, 114, 128, 0.2)',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Anulează
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                background: loading ?
                  'rgba(34, 197, 94, 0.5)' :
                  'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvează...
                </>
              ) : (
                <>
                  💾 Salvează
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Nume complet */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Nume complet *
          </label>
          {editing ? (
            <input
              type="text"
              value={profile.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            />
          ) : (
            <p style={{
              padding: '0.75rem',
              background: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '8px',
              margin: 0,
              color: '#1f2937',
              fontSize: '0.875rem'
            }}>
              {profile.displayName || 'Nu este setat'}
            </p>
          )}
        </div>

        {/* Email (read-only) */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Email (nu poate fi modificat)
          </label>
          <p style={{
            padding: '0.75rem',
            background: 'rgba(243, 244, 246, 0.8)',
            borderRadius: '8px',
            margin: 0,
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            {profile.email}
          </p>
        </div>

        {/* Telefon */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Telefon
          </label>
          {editing ? (
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+40 700 000 000"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            />
          ) : (
            <p style={{
              padding: '0.75rem',
              background: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '8px',
              margin: 0,
              color: '#1f2937',
              fontSize: '0.875rem'
            }}>
              {profile.phone || 'Nu este setat'}
            </p>
          )}
        </div>

        {/* Departament */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Departament
          </label>
          {editing ? (
            <input
              type="text"
              value={profile.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              placeholder="ex: IT, Marketing, Vânzări"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            />
          ) : (
            <p style={{
              padding: '0.75rem',
              background: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '8px',
              margin: 0,
              color: '#1f2937',
              fontSize: '0.875rem'
            }}>
              {profile.department || 'Nu este setat'}
            </p>
          )}
        </div>

        {/* Poziție */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Poziție
          </label>
          {editing ? (
            <input
              type="text"
              value={profile.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              placeholder="ex: Developer, Manager, Consultant"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            />
          ) : (
            <p style={{
              padding: '0.75rem',
              background: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '8px',
              margin: 0,
              color: '#1f2937',
              fontSize: '0.875rem'
            }}>
              {profile.position || 'Nu este setat'}
            </p>
          )}
        </div>

        {/* Data angajării */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Data angajării
          </label>
          {editing ? (
            <input
              type="date"
              value={profile.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                e.target.style.boxShadow = 'none';
              }}
            />
          ) : (
            <p style={{
              padding: '0.75rem',
              background: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '8px',
              margin: 0,
              color: '#1f2937',
              fontSize: '0.875rem'
            }}>
              {formatDate(profile.startDate)}
            </p>
          )}
        </div>
      </div>

      {/* Bio (pe toată lățimea) */}
      <div style={{ marginTop: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Despre mine
        </label>
        {editing ? (
          <textarea
            value={profile.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="Scrie câteva cuvinte despre tine, experiența ta, hobby-uri..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(209, 213, 219, 0.8)',
              fontSize: '0.875rem',
              background: 'rgba(255, 255, 255, 0.9)',
              transition: 'all 0.2s ease',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
              e.target.style.boxShadow = 'none';
            }}
          />
        ) : (
          <p style={{
            padding: '0.75rem',
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '8px',
            margin: 0,
            color: '#1f2937',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            minHeight: '4rem'
          }}>
            {profile.bio || 'Nu ai adăugat încă informații despre tine'}
          </p>
        )}
      </div>
    </div>
  );
}