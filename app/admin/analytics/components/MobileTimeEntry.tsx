// ==================================================================
// CALEA: app/admin/analytics/components/MobileTimeEntry.tsx
// CREAT: 15.09.2025 16:00 (ora României)
// DESCRIERE: PWA-optimized mobile component pentru time tracking cu voice notes și offline capability
// ==================================================================

import React, { useState, useEffect, useRef } from 'react';

interface MobileTimeEntryProps {
  onTimeEntryAdded?: (entry: any) => void;
  currentUser?: {
    uid: string;
    nume_complet: string;
  } | null;
  isOfflineMode?: boolean;
  showVoiceNotes?: boolean;
}

interface TimeEntry {
  id: string;
  proiect_id: string;
  sarcina_id?: string;
  ore_lucrate: number;
  descriere_activitate: string;
  voice_note?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: string;
  sync_status: 'pending' | 'synced' | 'failed';
}

interface Project {
  ID_Proiect: string;
  Denumire: string;
  Client: string;
  Status: string;
}

interface Task {
  id: string;
  titlu: string;
  prioritate: string;
  status: string;
}

export default function MobileTimeEntry({
  onTimeEntryAdded,
  currentUser,
  isOfflineMode = false,
  showVoiceNotes = true
}: MobileTimeEntryProps) {
  // State management
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [description, setDescription] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [isManualEntry, setIsManualEntry] = useState(false);
  
  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<TimeEntry[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [showProjectSearch, setShowProjectSearch] = useState(false);
  const [showTaskSearch, setShowTaskSearch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: string}>>([]);
  
  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize component
  useEffect(() => {
    initializeComponent();
    loadOfflineQueue();
    setupServiceWorker();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer effect
  useEffect(() => {
    if (isTimerActive && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerActive, startTime]);

  const initializeComponent = async () => {
    try {
      await Promise.all([
        loadProjects(),
        loadRecentEntries(),
        requestNotificationPermission()
      ]);
    } catch (error) {
      console.error('Error initializing mobile time entry:', error);
      showNotification('Eroare la inițializarea componentei', 'error');
    }
  };

  const setupServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  };

  const loadProjects = async () => {
    try {
      if (isOfflineMode) {
        const cached = localStorage.getItem('cached_projects');
        if (cached) setProjects(JSON.parse(cached));
        return;
      }

      const response = await fetch('/api/rapoarte/proiecte?limit=50&status=Activ');
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.data);
        localStorage.setItem('cached_projects', JSON.stringify(data.data));
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      showNotification('Nu s-au putut încărca proiectele', 'error');
    }
  };

  const loadTasksForProject = async (projectId: string) => {
    try {
      if (isOfflineMode) {
        const cached = localStorage.getItem(`cached_tasks_${projectId}`);
        if (cached) setTasks(JSON.parse(cached));
        return;
      }

      const response = await fetch(`/api/rapoarte/sarcini?proiect_id=${projectId}`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.data);
        localStorage.setItem(`cached_tasks_${projectId}`, JSON.stringify(data.data));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      showNotification('Nu s-au putut încărca sarcinile', 'error');
    }
  };

  const loadRecentEntries = () => {
    try {
      const stored = localStorage.getItem('recent_time_entries');
      if (stored) {
        setRecentEntries(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent entries:', error);
    }
  };

  const loadOfflineQueue = () => {
    try {
      const stored = localStorage.getItem('offline_time_entries');
      if (stored) {
        setOfflineQueue(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
  };

  const startTimer = () => {
    if (!selectedProject) {
      showNotification('Selectează un proiect pentru a începe', 'warning');
      return;
    }

    const now = new Date();
    setStartTime(now);
    setElapsedTime(0);
    setIsTimerActive(true);
    
    // Vibration feedback pe mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
    
    showNotification(`Timer pornit pentru ${selectedProject.Denumire}`, 'success');
    
    // Set wake lock pentru a preveni sleep-ul
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').catch(console.error);
    }
  };

  const stopTimer = async () => {
    if (!isTimerActive || !startTime) return;
    
    setIsTimerActive(false);
    const finalTime = Math.floor((Date.now() - startTime.getTime()) / 1000) / 3600; // Convert to hours
    
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    
    await saveTimeEntry(finalTime);
    
    // Reset state
    setElapsedTime(0);
    setStartTime(null);
    setDescription('');
    setVoiceNote('');
  };

  const saveTimeEntry = async (hours: number) => {
    if (!selectedProject || !currentUser) return;
    
    const entry: TimeEntry = {
      id: `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      proiect_id: selectedProject.ID_Proiect,
      sarcina_id: selectedTask?.id,
      ore_lucrate: Number(hours.toFixed(2)),
      descriere_activitate: description || 'Mobile time entry',
      voice_note: voiceNote,
      timestamp: new Date().toISOString(),
      sync_status: isOfflineMode ? 'pending' : 'pending'
    };

    // Add location if available
    if ('geolocation' in navigator) {
      try {
        const position = await getCurrentPosition();
        entry.location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (error) {
        console.log('Location not available:', error);
      }
    }

    try {
      if (isOfflineMode || !navigator.onLine) {
        // Save to offline queue
        const newQueue = [...offlineQueue, entry];
        setOfflineQueue(newQueue);
        localStorage.setItem('offline_time_entries', JSON.stringify(newQueue));
        showNotification('Intrare salvată offline', 'info');
      } else {
        // Try to sync immediately
        await syncTimeEntry(entry);
      }
      
      // Update recent entries
      const newRecent = [entry, ...recentEntries.slice(0, 9)];
      setRecentEntries(newRecent);
      localStorage.setItem('recent_time_entries', JSON.stringify(newRecent));
      
      onTimeEntryAdded?.(entry);
      
    } catch (error) {
      console.error('Error saving time entry:', error);
      showNotification('Eroare la salvarea intrării', 'error');
    }
  };

  const syncTimeEntry = async (entry: TimeEntry) => {
    setLoading(true);
    
    try {
      const payload = {
        proiect_id: entry.proiect_id,
        sarcina_id: entry.sarcina_id || null,
        utilizator_uid: currentUser?.uid,
        utilizator_nume: currentUser?.nume_complet,
        data_lucru: entry.timestamp.split('T')[0],
        ore_lucrate: entry.ore_lucrate,
        descriere_lucru: entry.descriere_activitate,
        tip_inregistrare: 'mobile_timer',
        voice_note: entry.voice_note,
        location: entry.location
      };

      const response = await fetch('/api/rapoarte/timetracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.success) {
        entry.sync_status = 'synced';
        showNotification('Intrare sincronizată cu succes', 'success');
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      entry.sync_status = 'failed';
      showNotification('Eroare la sincronizare', 'error');
    } finally {
      setLoading(false);
    }
  };

  const syncOfflineEntries = async () => {
    if (offlineQueue.length === 0 || !navigator.onLine) return;
    
    setLoading(true);
    let syncedCount = 0;
    
    try {
      for (const entry of offlineQueue) {
        if (entry.sync_status === 'pending') {
          await syncTimeEntry(entry);
          // Folosim type assertion pentru a evita eroarea TypeScript
          const currentEntry = entry as TimeEntry;
          if (currentEntry.sync_status === 'synced') {
            syncedCount++;
          }
        }
      }
      
      // Remove synced entries
      const remaining = offlineQueue.filter(e => e.sync_status !== 'synced');
      setOfflineQueue(remaining);
      localStorage.setItem('offline_time_entries', JSON.stringify(remaining));
      
      if (syncedCount > 0) {
        showNotification(`${syncedCount} intrări sincronizate`, 'success');
      }
      
    } catch (error) {
      console.error('Bulk sync error:', error);
      showNotification('Eroare la sincronizarea bulk', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startVoiceRecording = async () => {
    if (!showVoiceNotes) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setVoiceNote(audioUrl);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
    } catch (error) {
      console.error('Error starting voice recording:', error);
      showNotification('Nu s-a putut porni înregistrarea', 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 300000 // 5 minutes
      });
    });
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString();
    const notification = { id, message, type };
    
    setNotifications(prev => [...prev, notification]);
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Time Tracking', {
        body: message,
        icon: '/icon-192x192.png',
        tag: 'time-tracking'
      });
    }
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const quickActionProjects = projects.slice(0, 3);

  return (
    <div style={{
      padding: '1rem',
      maxWidth: '100vw',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#333',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
            📱 Mobile Time Tracker
          </h2>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {offlineQueue.length > 0 && (
              <button
                onClick={syncOfflineEntries}
                disabled={loading || !navigator.onLine}
                style={{
                  padding: '0.5rem 1rem',
                  background: navigator.onLine ? '#27ae60' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                🔄 Sync ({offlineQueue.length})
              </button>
            )}
            
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: navigator.onLine ? '#27ae60' : '#e74c3c'
            }} />
          </div>
        </div>
        
        <div style={{ fontSize: '14px', color: '#666' }}>
          {currentUser?.nume_complet || 'Utilizator necunoscut'}
          {isOfflineMode && ' • Mod offline'}
        </div>
      </div>

      {/* Timer Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '1rem',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          fontSize: '3rem',
          fontWeight: '700',
          color: isTimerActive ? '#27ae60' : '#2c3e50',
          marginBottom: '1rem',
          fontFamily: 'monospace'
        }}>
          {formatTime(elapsedTime)}
        </div>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          marginBottom: '1rem'
        }}>
          <button
            onClick={isTimerActive ? stopTimer : startTimer}
            disabled={loading || (!selectedProject && !isTimerActive)}
            style={{
              padding: '1rem 2rem',
              background: isTimerActive ? '#e74c3c' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              fontSize: '16px',
              fontWeight: '700',
              minWidth: '120px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '⏳' : isTimerActive ? '⏹️ Stop' : '▶️ Start'}
          </button>
          
          <button
            onClick={() => setIsManualEntry(!isManualEntry)}
            style={{
              padding: '1rem',
              background: 'rgba(108, 117, 125, 0.1)',
              color: '#6c757d',
              border: '1px solid #dee2e6',
              borderRadius: '50px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            ⏰ Manual
          </button>
        </div>
        
        {isManualEntry && (
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="number"
              step="0.25"
              placeholder="Ore (ex: 2.5)"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              style={{
                width: '120px',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                fontSize: '16px',
                textAlign: 'center'
              }}
            />
            <button
              onClick={() => saveTimeEntry(parseFloat(manualTime) || 0)}
              disabled={!manualTime || !selectedProject}
              style={{
                marginLeft: '0.5rem',
                padding: '0.75rem 1rem',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              Salvează
            </button>
          </div>
        )}
      </div>

      {/* Project Selection */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Proiect</h3>
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            style={{
              padding: '0.5rem',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ⚡
          </button>
        </div>
        
        {showQuickActions && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}>
            {quickActionProjects.map(project => (
              <button
                key={project.ID_Proiect}
                onClick={() => {
                  setSelectedProject(project);
                  loadTasksForProject(project.ID_Proiect);
                  setShowQuickActions(false);
                }}
                style={{
                  padding: '0.75rem',
                  background: selectedProject?.ID_Proiect === project.ID_Proiect ? '#007bff' : 'rgba(0,123,255,0.1)',
                  color: selectedProject?.ID_Proiect === project.ID_Proiect ? 'white' : '#007bff',
                  border: '1px solid #007bff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  textAlign: 'left'
                }}
              >
                <div>{project.Denumire}</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                  {project.Client}
                </div>
              </button>
            ))}
          </div>
        )}
        
        <div
          onClick={() => setShowProjectSearch(true)}
          style={{
            padding: '1rem',
            background: selectedProject ? '#e8f4fd' : '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          {selectedProject ? (
            <div>
              <div style={{ fontWeight: '600', color: '#007bff' }}>
                {selectedProject.Denumire}
              </div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                {selectedProject.Client}
              </div>
            </div>
          ) : (
            <div style={{ color: '#6c757d' }}>
              📁 Selectează proiect...
            </div>
          )}
        </div>
        
        {selectedProject && (
          <div
            onClick={() => setShowTaskSearch(true)}
            style={{
              padding: '1rem',
              background: selectedTask ? '#e8f4fd' : '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              marginTop: '0.5rem'
            }}
          >
            {selectedTask ? (
              <div>
                <div style={{ fontWeight: '600', color: '#007bff' }}>
                  {selectedTask.titlu}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  {selectedTask.prioritate} • {selectedTask.status}
                </div>
              </div>
            ) : (
              <div style={{ color: '#6c757d' }}>
                📋 Selectează sarcină (opțional)...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description & Voice Notes */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Descriere</h3>
        
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrie activitatea..."
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            fontSize: '16px',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        
        {showVoiceNotes && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center'
            }}>
              <button
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                style={{
                  padding: '0.75rem',
                  background: isRecording ? '#e74c3c' : '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '50px',
                  height: '50px',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                {isRecording ? '⏹️' : '🎤'}
              </button>
              
              <div style={{ flex: 1, fontSize: '14px', color: '#6c757d' }}>
                {isRecording ? 'Înregistrare în curs...' : 
                 voiceNote ? 'Notă vocală înregistrată' : 'Adaugă notă vocală'}
              </div>
              
              {voiceNote && (
                <audio controls style={{ width: '200px' }}>
                  <source src={voiceNote} type="audio/wav" />
                </audio>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent Entries */}
      {recentEntries.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '1rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>
            Intrări recente
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentEntries.slice(0, 5).map(entry => (
              <div
                key={entry.id}
                style={{
                  padding: '0.75rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${
                    entry.sync_status === 'synced' ? '#27ae60' :
                    entry.sync_status === 'failed' ? '#e74c3c' : '#f39c12'
                  }`
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.25rem'
                }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>
                    {entry.ore_lucrate}h
                  </span>
                  <span style={{ fontSize: '12px', color: '#6c757d' }}>
                    {new Date(entry.timestamp).toLocaleDateString('ro-RO')}
                  </span>
                </div>
                
                <div style={{ fontSize: '13px', color: '#495057' }}>
                  {entry.descriere_activitate}
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.25rem'
                }}>
                  <span style={{ fontSize: '12px', color: '#6c757d' }}>
                    {entry.proiect_id}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    background: entry.sync_status === 'synced' ? '#d4edda' :
                               entry.sync_status === 'failed' ? '#f8d7da' : '#fff3cd',
                    color: entry.sync_status === 'synced' ? '#155724' :
                           entry.sync_status === 'failed' ? '#721c24' : '#856404'
                  }}>
                    {entry.sync_status === 'synced' ? '✓ Sync' :
                     entry.sync_status === 'failed' ? '✗ Failed' : '⏳ Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {notifications.map(notification => (
          <div
            key={notification.id}
            style={{
              background: notification.type === 'success' ? '#d4edda' :
                         notification.type === 'error' ? '#f8d7da' :
                         notification.type === 'warning' ? '#fff3cd' : '#d1ecf1',
              color: notification.type === 'success' ? '#155724' :
                     notification.type === 'error' ? '#721c24' :
                     notification.type === 'warning' ? '#856404' : '#0c5460',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              maxWidth: '250px',
              wordWrap: 'break-word'
            }}
          >
            {notification.message}
          </div>
        ))}
      </div>

      {/* Project Search Modal */}
      {showProjectSearch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0 }}>Selectează Proiect</h3>
              <button
                onClick={() => setShowProjectSearch(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {projects.map(project => (
                <button
                  key={project.ID_Proiect}
                  onClick={() => {
                    setSelectedProject(project);
                    loadTasksForProject(project.ID_Proiect);
                    setShowProjectSearch(false);
                  }}
                  style={{
                    padding: '1rem',
                    background: 'none',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: '600' }}>{project.Denumire}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>
                    {project.Client} • {project.Status}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Task Search Modal */}
      {showTaskSearch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: 0 }}>Selectează Sarcină</h3>
              <button
                onClick={() => setShowTaskSearch(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
            
            <button
              onClick={() => {
                setSelectedTask(null);
                setShowTaskSearch(false);
              }}
              style={{
                width: '100%',
                padding: '1rem',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                marginBottom: '0.5rem'
              }}
            >
              <div style={{ fontStyle: 'italic', color: '#6c757d' }}>
                Fără sarcină specifică
              </div>
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task);
                    setShowTaskSearch(false);
                  }}
                  style={{
                    padding: '1rem',
                    background: 'none',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: '600' }}>{task.titlu}</div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>
                    {task.prioritate} • {task.status}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
