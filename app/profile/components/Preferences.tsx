// ==================================================================
// CALEA: app/profile/components/Preferences.tsx
// DATA: 21.09.2025 19:10 (ora României)
// DESCRIERE: Component preferințe avansate pentru utilizatori normali
// FUNCȚIONALITATE: Preferințe UI, shortcut-uri, setări productivitate
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-hot-toast';

interface PreferencesProps {
  user: User;
}

interface UserPreferences {
  dashboardLayout: string;
  defaultView: string;
  itemsPerPage: number;
  autoSave: boolean;
  compactMode: boolean;
  showTooltips: boolean;
  enableShortcuts: boolean;
  workingHours: {
    start: string;
    end: string;
  };
  breakReminders: boolean;
  focusMode: boolean;
  soundNotifications: boolean;
}

export default function Preferences({ user }: PreferencesProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    dashboardLayout: 'grid',
    defaultView: 'overview',
    itemsPerPage: 10,
    autoSave: true,
    compactMode: false,
    showTooltips: true,
    enableShortcuts: true,
    workingHours: {
      start: '09:00',
      end: '17:00'
    },
    breakReminders: true,
    focusMode: false,
    soundNotifications: true
  });
  const [loading, setLoading] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem(`userPreferences_${user.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPreferences(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Eroare la încărcarea preferințelor:', error);
    }
  };

  const handlePreferenceChange = (key: string, value: any) => {
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      setPreferences(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value
        }
      }));
    } else {
      setPreferences(prev => ({
        ...prev,
        [key]: value
      }));
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Salvează în localStorage (în producție ar fi BigQuery)
      localStorage.setItem(`userPreferences_${user.uid}`, JSON.stringify(preferences));

      toast.success('Preferințele au fost salvate cu succes!');
    } catch (error) {
      console.error('Eroare la salvarea preferințelor:', error);
      toast.error('Eroare la salvarea preferințelor');
    } finally {
      setLoading(false);
    }
  };

  const shortcuts = [
    { key: 'Ctrl + D', action: 'Deschide Dashboard' },
    { key: 'Ctrl + R', action: 'Deschide Rapoarte' },
    { key: 'Ctrl + P', action: 'Deschide Profil' },
    { key: 'Ctrl + /', action: 'Afișează ajutor' },
    { key: 'Ctrl + S', action: 'Salvează modificările' },
    { key: 'Esc', action: 'Închide modal/dialog' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Preferințe Interfață */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 1.5rem 0'
        }}>
          Preferințe Interfață
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Layout Dashboard */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Layout Dashboard
            </label>
            <select
              value={preferences.dashboardLayout}
              onChange={(e) => handlePreferenceChange('dashboardLayout', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer'
              }}
            >
              <option value="grid">Grid (carduri)</option>
              <option value="list">Listă</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          {/* Vizualizare implicită */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Pagină implicită
            </label>
            <select
              value={preferences.defaultView}
              onChange={(e) => handlePreferenceChange('defaultView', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer'
              }}
            >
              <option value="overview">Overview</option>
              <option value="projects">Proiecte</option>
              <option value="time">Time Tracking</option>
              <option value="reports">Rapoarte</option>
            </select>
          </div>

          {/* Elemente per pagină */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Elemente per pagină
            </label>
            <select
              value={preferences.itemsPerPage}
              onChange={(e) => handlePreferenceChange('itemsPerPage', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(209, 213, 219, 0.8)',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer'
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Toggle Options */}
        <div style={{
          marginTop: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {[
            {
              key: 'autoSave',
              label: 'Auto-salvare',
              description: 'Salvează automat modificările în timp real'
            },
            {
              key: 'compactMode',
              label: 'Mod compact',
              description: 'Reduce spațierea pentru mai multe informații pe ecran'
            },
            {
              key: 'showTooltips',
              label: 'Afișează tooltip-uri',
              description: 'Mostrează hint-uri la hover peste elemente'
            },
            {
              key: 'enableShortcuts',
              label: 'Activează shortcut-uri',
              description: 'Permite utilizarea scurtăturilor de tastatură'
            }
          ].map((option) => (
            <div
              key={option.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: 'rgba(248, 250, 252, 0.5)',
                borderRadius: '8px',
                border: '1px solid rgba(226, 232, 240, 0.3)'
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: '0 0 0.25rem 0'
                }}>
                  {option.label}
                </p>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  margin: 0
                }}>
                  {option.description}
                </p>
              </div>

              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '24px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={preferences[option.key as keyof UserPreferences] as boolean}
                  onChange={(e) => handlePreferenceChange(option.key, e.target.checked)}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0
                  }}
                />
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: preferences[option.key as keyof UserPreferences] ? '#3b82f6' : '#cbd5e1',
                  borderRadius: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: preferences[option.key as keyof UserPreferences] ? '23px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }} />
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Preferințe Productivitate */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 1.5rem 0'
        }}>
          Preferințe Productivitate
        </h3>

        {/* Program de lucru */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          background: 'rgba(248, 250, 252, 0.5)',
          borderRadius: '8px',
          border: '1px solid rgba(226, 232, 240, 0.3)'
        }}>
          <h4 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 1rem 0'
          }}>
            Program de lucru
          </h4>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Ora Start
              </label>
              <input
                type="time"
                value={preferences.workingHours.start}
                onChange={(e) => handlePreferenceChange('workingHours.start', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(209, 213, 219, 0.8)',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.9)'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Ora Sfârșit
              </label>
              <input
                type="time"
                value={preferences.workingHours.end}
                onChange={(e) => handlePreferenceChange('workingHours.end', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(209, 213, 219, 0.8)',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.9)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Opțiuni productivitate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            {
              key: 'breakReminders',
              label: 'Reminder-uri pauză',
              description: 'Primește notificări pentru a lua pauze regulate'
            },
            {
              key: 'focusMode',
              label: 'Mod focalizare',
              description: 'Ascunde distracțiile și notificările non-esențiale'
            },
            {
              key: 'soundNotifications',
              label: 'Notificări sonore',
              description: 'Redă sunete pentru notificări importante'
            }
          ].map((option) => (
            <div
              key={option.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: 'rgba(248, 250, 252, 0.5)',
                borderRadius: '8px',
                border: '1px solid rgba(226, 232, 240, 0.3)'
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: '0 0 0.25rem 0'
                }}>
                  {option.label}
                </p>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  margin: 0
                }}>
                  {option.description}
                </p>
              </div>

              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '24px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={preferences[option.key as keyof UserPreferences] as boolean}
                  onChange={(e) => handlePreferenceChange(option.key, e.target.checked)}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0
                  }}
                />
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: preferences[option.key as keyof UserPreferences] ? '#3b82f6' : '#cbd5e1',
                  borderRadius: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: preferences[option.key as keyof UserPreferences] ? '23px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }} />
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Shortcut-uri de tastatură */}
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
          marginBottom: '1rem'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#1f2937',
            margin: 0
          }}>
            Shortcut-uri de Tastatură
          </h3>

          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#2563eb',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {showShortcuts ? '🙈 Ascunde' : '👁️ Afișează'}
          </button>
        </div>

        {showShortcuts && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '0.5rem',
            padding: '1rem',
            background: 'rgba(248, 250, 252, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(226, 232, 240, 0.3)'
          }}>
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  fontSize: '0.75rem'
                }}
              >
                <span style={{
                  fontFamily: 'monospace',
                  background: 'rgba(255, 255, 255, 0.8)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(209, 213, 219, 0.5)',
                  color: '#1f2937',
                  fontWeight: '600'
                }}>
                  {shortcut.key}
                </span>
                <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                  {shortcut.action}
                </span>
              </div>
            ))}
          </div>
        )}

        <p style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          margin: '1rem 0 0 0',
          fontStyle: 'italic'
        }}>
          Shortcut-urile funcționează doar dacă sunt activate în setările de mai sus.
        </p>
      </div>

      {/* Buton Salvare */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
            padding: '0.75rem 1.5rem',
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
              Se salvează...
            </>
          ) : (
            <>
              💾 Salvează Preferințele
            </>
          )}
        </button>
      </div>
    </div>
  );
}