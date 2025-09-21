// ==================================================================
// CALEA: app/profile/components/AccountSettings.tsx
// DATA: 21.09.2025 19:05 (ora României)
// DESCRIERE: Component setări cont pentru utilizatori normali
// FUNCȚIONALITATE: Setări de securitate și preferințe cont
// ==================================================================

'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'react-hot-toast';

interface AccountSettingsProps {
  user: User;
}

interface AccountSettings {
  emailNotifications: boolean;
  projectUpdates: boolean;
  weeklyReports: boolean;
  taskReminders: boolean;
  language: string;
  timezone: string;
  theme: string;
  autoLogout: string;
}

export default function AccountSettings({ user }: AccountSettingsProps) {
  const [settings, setSettings] = useState<AccountSettings>({
    emailNotifications: true,
    projectUpdates: true,
    weeklyReports: false,
    taskReminders: true,
    language: 'ro',
    timezone: 'Europe/Bucharest',
    theme: 'light',
    autoLogout: '8h'
  });
  const [loading, setLoading] = useState(false);
  const [lastLogin, setLastLogin] = useState<string>('');

  useEffect(() => {
    loadAccountSettings();
    setLastLogin(user.metadata.lastSignInTime || '');
  }, [user]);

  const loadAccountSettings = () => {
    try {
      const saved = localStorage.getItem(`accountSettings_${user.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Eroare la încărcarea setărilor:', error);
    }
  };

  const handleSettingChange = (key: keyof AccountSettings, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Salvează în localStorage (în producție ar fi BigQuery)
      localStorage.setItem(`accountSettings_${user.uid}`, JSON.stringify(settings));

      toast.success('Setările au fost salvate cu succes!');
    } catch (error) {
      console.error('Eroare la salvarea setărilor:', error);
      toast.error('Eroare la salvarea setărilor');
    } finally {
      setLoading(false);
    }
  };

  const formatLastLogin = (timestamp: string) => {
    if (!timestamp) return 'Nu este disponibil';
    try {
      return new Date(timestamp).toLocaleString('ro-RO');
    } catch {
      return 'Format invalid';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Informații Cont */}
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
          Informații Cont
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            padding: '1rem',
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '8px',
            border: '1px solid rgba(226, 232, 240, 0.5)'
          }}>
            <p style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              margin: '0 0 0.25rem 0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '600'
            }}>
              UID Utilizator
            </p>
            <p style={{
              fontSize: '0.875rem',
              color: '#1f2937',
              margin: 0,
              fontFamily: 'monospace'
            }}>
              {user.uid}
            </p>
          </div>

          <div style={{
            padding: '1rem',
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '8px',
            border: '1px solid rgba(226, 232, 240, 0.5)'
          }}>
            <p style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              margin: '0 0 0.25rem 0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '600'
            }}>
              Ultima Autentificare
            </p>
            <p style={{
              fontSize: '0.875rem',
              color: '#1f2937',
              margin: 0
            }}>
              {formatLastLogin(lastLogin)}
            </p>
          </div>

          <div style={{
            padding: '1rem',
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '8px',
            border: '1px solid rgba(226, 232, 240, 0.5)'
          }}>
            <p style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              margin: '0 0 0.25rem 0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '600'
            }}>
              Status Verificare Email
            </p>
            <p style={{
              fontSize: '0.875rem',
              color: user.emailVerified ? '#22c55e' : '#f59e0b',
              margin: 0,
              fontWeight: '600'
            }}>
              {user.emailVerified ? '✅ Verificat' : '⚠️ Neverificat'}
            </p>
          </div>
        </div>
      </div>

      {/* Notificări */}
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
          Preferințe Notificări
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            {
              key: 'emailNotifications' as keyof AccountSettings,
              label: 'Notificări prin email',
              description: 'Primește notificări importante prin email'
            },
            {
              key: 'projectUpdates' as keyof AccountSettings,
              label: 'Actualizări proiecte',
              description: 'Notificări când se actualizează proiectele tale'
            },
            {
              key: 'weeklyReports' as keyof AccountSettings,
              label: 'Rapoarte săptămânale',
              description: 'Rezumat săptămânal al activității tale'
            },
            {
              key: 'taskReminders' as keyof AccountSettings,
              label: 'Reminder-uri sarcini',
              description: 'Notificări pentru sarcini care expiră'
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
                  checked={settings[option.key] as boolean}
                  onChange={(e) => handleSettingChange(option.key, e.target.checked)}
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
                  backgroundColor: settings[option.key] ? '#3b82f6' : '#cbd5e1',
                  borderRadius: '24px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: settings[option.key] ? '23px' : '3px',
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

      {/* Setări Generale */}
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
          Setări Generale
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Limbă */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Limbă
            </label>
            <select
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
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
              <option value="ro">Română</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Fus orar */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Fus orar
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => handleSettingChange('timezone', e.target.value)}
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
              <option value="Europe/Bucharest">România (GMT+2)</option>
              <option value="Europe/London">Londra (GMT+0)</option>
              <option value="America/New_York">New York (GMT-5)</option>
            </select>
          </div>

          {/* Temă */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Temă
            </label>
            <select
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value)}
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
              <option value="light">Luminoasă</option>
              <option value="dark">Întunecată</option>
              <option value="auto">Automată</option>
            </select>
          </div>

          {/* Auto logout */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Deconectare automată
            </label>
            <select
              value={settings.autoLogout}
              onChange={(e) => handleSettingChange('autoLogout', e.target.value)}
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
              <option value="1h">1 oră</option>
              <option value="4h">4 ore</option>
              <option value="8h">8 ore</option>
              <option value="24h">24 ore</option>
              <option value="never">Niciodată</option>
            </select>
          </div>
        </div>
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
              💾 Salvează Toate Setările
            </>
          )}
        </button>
      </div>
    </div>
  );
}