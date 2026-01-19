// ==================================================================
// CALEA: app/gantt/page.tsx
// DATA: 23.09.2025 18:30 (ora României)
// DESCRIERE: Gantt Chart COMPLET pentru utilizatori normali - IDENTIC CU ADMIN
// FUNCȚIONALITATE: Click pe capetele barelor pentru editare dată precisă cu DatePickerPopup
// ==================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import UserLayout from '@/app/components/user/UserLayout';
import { Card, Button, Alert, LoadingSpinner, Modal } from '@/app/components/ui';
import { toast } from 'react-toastify';
import DatePickerPopup from '@/app/components/user/DatePickerPopup';
import SarciniProiectModal from '@/app/admin/rapoarte/proiecte/components/SarciniProiectModal';

interface GanttTask {
  id: string;
  name: string;
  startDate: string | { value: string };
  endDate: string | { value: string };
  progress: number;
  type: 'proiect' | 'subproiect' | 'sarcina';
  parentId?: string;
  dependencies: string[];
  resources: string[];
  priority: 'normala' | 'ridicata' | 'urgent';
  status: 'to_do' | 'in_progress' | 'finalizata' | 'anulata';
  estimatedHours?: number;
  workedHours?: number;
  isCollapsed: boolean;
  level: number;
  // Comentarii info
  comentarii_count?: number;
  ultim_comentariu?: {
    autor_nume: string;
    comentariu: string;
    data_comentariu: string | { value: string };
  };
  // ✅ 18.01.2026: Câmpuri timp economic (doar pentru proiecte)
  economicHoursAllocated?: number;
  economicHoursRemaining?: number;
  economicProgress?: number;
  valoare_proiect?: number;
  moneda_proiect?: string;
  cheltuieli_in_moneda_proiect?: number;
  marja_bruta?: number;
  cost_ora_setat?: number;
  ore_pe_zi?: number;
}

interface TimelineSettings {
  viewMode: 'days' | 'weeks' | 'months';
  startDate: Date;
  endDate: Date;
  timelineUnit: number;
}

interface DateEditState {
  isOpen: boolean;
  taskId: string;
  dateType: 'start' | 'end';
  currentDate: string;
  taskName: string;
  position: { x: number; y: number };
}

// Constantă pentru înălțimea fiecărui rând - CHEIA PENTRU ALINIERE
const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 60;

export default function GanttView() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [ganttData, setGanttData] = useState<GanttTask[]>([]);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('user');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Gantt settings
  const [timelineSettings, setTimelineSettings] = useState<TimelineSettings>({
    viewMode: 'weeks',
    startDate: new Date(),
    endDate: new Date(),
    timelineUnit: 7
  });

  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);

  // Date edit state - ÎNLOCUIEȘTE LOGICA DE RESIZE
  const [dateEditState, setDateEditState] = useState<DateEditState>({
    isOpen: false,
    taskId: '',
    dateType: 'start',
    currentDate: '',
    taskName: '',
    position: { x: 0, y: 0 }
  });
  const [savingChanges, setSavingChanges] = useState(false);

  // State pentru Comentarii Modal
  const [showComentariiModal, setShowComentariiModal] = useState(false);
  const [comentariiProiect, setComentariiProiect] = useState<any>(null);
  const [comentariiDefaultTab, setComentariiDefaultTab] = useState<'sarcini' | 'comentarii' | 'timetracking'>('comentarii');

  // ✅ 18.01.2026: State pentru Alocări Zilnice
  const [showAllocationForm, setShowAllocationForm] = useState(false);
  const [allocationData, setAllocationData] = useState({
    data_planificare: new Date().toISOString().split('T')[0],
    utilizator_uid: '',
    utilizator_nume: '',
    ore_planificate: 8,
    prioritate: 'normala',
    observatii: '',
    sync_planificator_personal: true
  });
  const [savingAllocation, setSavingAllocation] = useState(false);
  const [existingAllocations, setExistingAllocations] = useState<any[]>([]);

  // Filters - Default status is 'in_progress' to show only active projects on page load
  const [filters, setFilters] = useState({
    proiect_id: '',
    responsabil_nume: '',
    proiect_nume: '',
    client_nume: '',
    tip_task: '', // 'proiect', 'subproiect', 'sarcina'
    status: 'in_progress', // DEFAULT: 'in_progress' - 'to_do', 'in_progress', 'finalizata', 'anulata'
    prioritate: '', // 'normala', 'ridicata', 'urgent'
    start_date: '',
    end_date: ''
  });

  // Data for filter options
  const [utilizatori, setUtilizatori] = useState<any[]>([]);
  const [proiecte, setProiecte] = useState<any[]>([]);

  // Funcție centralizată pentru normalizarea datelor BigQuery
  const normalizeDate = (date: string | { value: string }): string => {
    return typeof date === 'object' ? date.value : date;
  };

  // Funcție centralizată pentru parsarea datelor de task
  const parseTaskDate = (dateValue: string | { value: string }): Date => {
    const normalizedDate = normalizeDate(dateValue);
    return new Date(normalizedDate);
  };

  // Funcție pentru generare inițiale din nume complet
  const getInitials = (numeComplet: string): string => {
    if (!numeComplet) return '';
    const parts = numeComplet.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    // Ia prima literă din fiecare cuvânt (max 2)
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  // Funcție pentru generare culoare consistentă per responsabil
  const getResponsabilColor = (nume: string): { bg: string; text: string; border: string } => {
    if (!nume) return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: '#3b82f6' };

    // Hash simplu pentru a genera un index consistent bazat pe nume
    let hash = 0;
    for (let i = 0; i < nume.length; i++) {
      hash = nume.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }

    // Paletă de culori distincte pentru responsabili
    const colors = [
      { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: '#3b82f6' }, // Albastru
      { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', border: '#8b5cf6' }, // Violet
      { bg: 'rgba(236, 72, 153, 0.1)', text: '#ec4899', border: '#ec4899' }, // Roz
      { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: '#f59e0b' }, // Portocaliu
      { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: '#10b981' }, // Verde
      { bg: 'rgba(6, 182, 212, 0.1)', text: '#06b6d4', border: '#06b6d4' }, // Cyan
      { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: '#ef4444' }, // Roșu
      { bg: 'rgba(168, 85, 247, 0.1)', text: '#a855f7', border: '#a855f7' }, // Purple
      { bg: 'rgba(20, 184, 166, 0.1)', text: '#14b8a6', border: '#14b8a6' }, // Teal
      { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c', border: '#fb923c' }, // Amber
    ];

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    checkUserRole();
  }, [user, loading, router]);

  useEffect(() => {
    if (isAuthorized) {
      loadGanttData();
      loadFilterData();
    }
  }, [isAuthorized, timelineSettings.viewMode, filters]);

  const loadFilterData = async () => {
    try {
      // Load utilizatori for user filter
      const utilizatoriResponse = await fetch('/api/rapoarte/utilizatori');
      if (utilizatoriResponse.ok) {
        const utilizatoriData = await utilizatoriResponse.json();
        if (utilizatoriData.success) {
          setUtilizatori(utilizatoriData.data);
        }
      }

      // Load proiecte for project filter
      const proiecteResponse = await fetch('/api/rapoarte/proiecte');
      if (proiecteResponse.ok) {
        const proiecteData = await proiecteResponse.json();
        if (proiecteData.success) {
          setProiecte(proiecteData.data);
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea datelor pentru filtre:', error);
    }
  };

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();

      if (data.success) {
        setUserRole(data.role);

        // For admin users, redirect to admin gantt
        if (data.role === 'admin') {
          router.push('/admin/analytics/gantt');
          return;
        }

        setDisplayName(localStorage.getItem('displayName') || user.displayName || 'Utilizator');
        setIsAuthorized(true);
      } else {
        toast.error('Nu ai permisiunea să accesezi Gantt Chart!');
        router.push('/');
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      router.push('/');
    }
  };

  const loadGanttData = async () => {
    try {
      setLoadingData(true);

      console.log('[USER GANTT DEBUG] Starting gantt data load...');

      // FIX: Use the same API as admin to get all responsabili
      // This API does JOIN with ProiecteResponsabili, SubproiecteResponsabili, SarciniResponsabili
      const params = new URLSearchParams({
        view_mode: timelineSettings.viewMode,
        include_dependencies: 'true',
        include_resources: 'true',
        user_id: user?.uid || ''
      });

      const response = await fetch(`/api/analytics/gantt-data?${params}`);
      const result = await response.json();

      if (result.success) {
        const tasks = result.data.map((task: any) => ({
          ...task,
          // Handle BigQuery DATE objects {value: "2025-08-16"} or direct strings
          startDate: normalizeDate(task.startDate),
          endDate: normalizeDate(task.endDate),
          isCollapsed: false
        }));

        setGanttData(tasks);
        calculateTimelineRange(tasks);
      } else {
        toast.error('Eroare la încărcarea datelor Gantt!');
      }

    } catch (error) {
      console.error('Eroare la încărcarea datelor Gantt:', error);
      toast.error('Eroare la încărcarea datelor!');
    } finally {
      setLoadingData(false);
    }
  };

  // ✅ 18.01.2026: Funcții pentru Alocări Zilnice

  // Încarcă alocările existente pentru task-ul selectat
  const loadExistingAllocations = async (taskId: string, taskType: string) => {
    try {
      const params = new URLSearchParams({ proiect_id: taskId });
      const response = await fetch(`/api/planificari-zilnice?${params}`);
      const result = await response.json();

      if (result.success) {
        setExistingAllocations(result.data);
      }
    } catch (error) {
      console.error('Eroare la încărcarea alocărilor:', error);
    }
  };

  // Salvează o nouă alocare zilnică
  const handleSaveAllocation = async () => {
    if (!selectedTask) return;

    if (!allocationData.utilizator_uid || !allocationData.data_planificare) {
      toast.error('Selectează un lucrător și o dată!');
      return;
    }

    try {
      setSavingAllocation(true);

      // Determinare denumiri bazat pe tipul elementului selectat
      let proiect_denumire = '';
      let subproiect_denumire = '';
      let sarcina_titlu = '';

      if (selectedTask.type === 'proiect') {
        proiect_denumire = selectedTask.name;
      } else if (selectedTask.type === 'subproiect') {
        // Pentru subproiecte, trebuie să găsim denumirea proiectului părinte
        const parentProject = ganttData.find(t => t.id === selectedTask.parentId);
        proiect_denumire = parentProject?.name || '';
        subproiect_denumire = selectedTask.name;
      } else if (selectedTask.type === 'sarcina') {
        // Pentru sarcini, trebuie să găsim denumirile părinte
        const parentTask = ganttData.find(t => t.id === selectedTask.parentId);
        if (parentTask?.type === 'subproiect') {
          const grandParent = ganttData.find(t => t.id === parentTask.parentId);
          proiect_denumire = grandParent?.name || '';
          subproiect_denumire = parentTask.name;
        } else {
          proiect_denumire = parentTask?.name || '';
        }
        sarcina_titlu = selectedTask.name;
      }

      const payload = {
        ...allocationData,
        proiect_id: selectedTask.type === 'proiect' ? selectedTask.id : selectedTask.parentId,
        subproiect_id: selectedTask.type === 'subproiect' ? selectedTask.id : undefined,
        sarcina_id: selectedTask.type === 'sarcina' ? selectedTask.id : undefined,
        proiect_denumire,
        subproiect_denumire: subproiect_denumire || undefined,
        sarcina_titlu: sarcina_titlu || undefined,
        creat_de: user?.uid,
        creat_de_nume: displayName
      };

      const response = await fetch('/api/planificari-zilnice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${allocationData.utilizator_nume} alocat pentru ${allocationData.data_planificare}`);
        setShowAllocationForm(false);
        setAllocationData({
          data_planificare: new Date().toISOString().split('T')[0],
          utilizator_uid: '',
          utilizator_nume: '',
          ore_planificate: 8,
          prioritate: 'normala',
          observatii: '',
          sync_planificator_personal: true
        });
        // Reîncarcă alocările
        loadExistingAllocations(selectedTask.id, selectedTask.type);
      } else {
        toast.error(result.error || 'Eroare la salvarea alocării');
      }
    } catch (error) {
      console.error('Eroare salvare alocare:', error);
      toast.error('Eroare la salvarea alocării');
    } finally {
      setSavingAllocation(false);
    }
  };

  // Șterge o alocare
  const handleDeleteAllocation = async (allocationId: string) => {
    if (!confirm('Ștergi această alocare?')) return;

    try {
      const response = await fetch(`/api/planificari-zilnice/${allocationId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Alocare ștearsă');
        if (selectedTask) {
          loadExistingAllocations(selectedTask.id, selectedTask.type);
        }
      } else {
        toast.error(result.error || 'Eroare la ștergerea alocării');
      }
    } catch (error) {
      console.error('Eroare ștergere alocare:', error);
      toast.error('Eroare la ștergere');
    }
  };

  // NOUA FUNCȚIE PENTRU CLICK PE CAPETELE BARELOR
  const handleDateClick = (taskId: string, dateType: 'start' | 'end', event: React.MouseEvent) => {
    event.stopPropagation();

    const task = ganttData.find(t => t.id === taskId);
    if (!task) return;

    const currentDate = dateType === 'start'
      ? normalizeDate(task.startDate)
      : normalizeDate(task.endDate);

    setDateEditState({
      isOpen: true,
      taskId,
      dateType,
      currentDate,
      taskName: task.name,
      position: { x: event.clientX, y: event.clientY }
    });
  };

  // FUNCȚIA PENTRU SALVAREA DATEI NOI - IDENTICAL TO ADMIN
  const handleDateSave = async (newDate: string) => {
    const task = ganttData.find(t => t.id === dateEditState.taskId);
    if (!task) {
      toast.error('Task nu a fost găsit!');
      setDateEditState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    // Validare: start date < end date
    const currentStartDate = normalizeDate(task.startDate);
    const currentEndDate = normalizeDate(task.endDate);

    let newStartDate = currentStartDate;
    let newEndDate = currentEndDate;

    if (dateEditState.dateType === 'start') {
      newStartDate = newDate;
      if (new Date(newStartDate) >= new Date(currentEndDate)) {
        toast.error('Data de început trebuie să fie înainte de data de sfârșit!');
        return;
      }
    } else {
      newEndDate = newDate;
      if (new Date(newEndDate) <= new Date(currentStartDate)) {
        toast.error('Data de sfârșit trebuie să fie după data de început!');
        return;
      }
    }

    try {
      setSavingChanges(true);

      console.log('[USER GANTT] Sending API request:', {
        taskId: dateEditState.taskId,
        taskType: task.type,
        startDate: newStartDate,
        endDate: newEndDate
      });

      // Determine the API endpoint based on task type - SAME AS ADMIN
      let apiEndpoint = '';
      let updateData = {};

      if (task.id.startsWith('proj_')) {
        apiEndpoint = '/api/rapoarte/proiecte';
        updateData = {
          id: task.id.replace('proj_', ''),
          Data_Start: newStartDate,
          Data_Final: newEndDate
        };
      } else if (task.id.startsWith('subproj_')) {
        apiEndpoint = '/api/rapoarte/subproiecte';
        updateData = {
          id: task.id.replace('subproj_', ''),
          Data_Start: newStartDate,
          Data_Final: newEndDate
        };
      } else if (task.id.startsWith('task_')) {
        apiEndpoint = '/api/rapoarte/sarcini';
        updateData = {
          id: task.id.replace('task_', ''),
          data_creare: newStartDate,
          data_scadenta: newEndDate
        };
      } else {
        throw new Error('Tip task nesuportat pentru editare');
      }

      const response = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        setGanttData(prev => prev.map(task =>
          task.id === dateEditState.taskId
            ? { ...task, startDate: newStartDate, endDate: newEndDate }
            : task
        ));
        toast.success('Data a fost actualizată cu succes!');

        // Închide popup-ul
        setDateEditState(prev => ({ ...prev, isOpen: false }));
      } else {
        toast.error(result.error || 'Eroare la actualizarea datelor!');
      }
    } catch (error) {
      console.error('Eroare la actualizarea task-ului:', error);
      toast.error('Eroare la salvarea modificărilor!');
    } finally {
      setSavingChanges(false);
    }
  };

  // FUNCȚIA PENTRU ANULAREA EDITĂRII
  const handleDateCancel = () => {
    setDateEditState(prev => ({ ...prev, isOpen: false }));
  };

  // Handler pentru deschiderea modalului de comentarii
  const handleShowComentariiModal = (task: GanttTask) => {
    // Determină ID-ul proiectului sau subproiectului
    let proiectId = task.id;
    let proiectDenumire = task.name;
    let tipProiect: 'proiect' | 'subproiect' = 'proiect';

    if (task.type === 'subproiect') {
      tipProiect = 'subproiect';
    } else if (task.type === 'sarcina') {
      // Pentru sarcini, folosim parentId (care poate fi proiect sau subproiect)
      proiectId = task.parentId || task.id;
      tipProiect = 'proiect'; // sau subproiect, depinde de structura
    }

    setComentariiProiect({
      ID_Proiect: proiectId,
      Denumire: proiectDenumire,
      Client: '',
      Status: task.status,
      tip: tipProiect
    });
    setComentariiDefaultTab('comentarii');
    setShowComentariiModal(true);
  };

  const handleCloseComentariiModal = () => {
    setShowComentariiModal(false);
    setComentariiProiect(null);
  };

  const calculateTimelineRange = (tasks: GanttTask[]) => {
    if (tasks.length === 0) return;

    const dates = tasks.flatMap(task => {
      const startDateValue = normalizeDate(task.startDate);
      const endDateValue = normalizeDate(task.endDate);
      return [
        new Date(startDateValue),
        new Date(endDateValue)
      ];
    });

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    setTimelineSettings(prev => ({
      ...prev,
      startDate: minDate,
      endDate: maxDate
    }));
  };

  const generateTimelineHeaders = () => {
    const headers: { date: Date; leftPercent: number; widthPercent: number }[] = [];
    const current = new Date(timelineSettings.startDate);
    const end = timelineSettings.endDate;
    const totalDuration = end.getTime() - timelineSettings.startDate.getTime();

    if (totalDuration <= 0) return headers;

    // Pentru modul ZILE: afisam doar lunile fiecarei saptamani (pentru lizibilitate)
    if (timelineSettings.viewMode === 'days') {
      // Gaseste prima zi de luni din interval (sau prima zi daca nu e luni)
      const firstMonday = new Date(current);
      const dayOfWeek = firstMonday.getDay();
      // Daca nu e luni (0=duminica, 1=luni), mergi la urmatoarea luni
      if (dayOfWeek !== 1) {
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        firstMonday.setDate(firstMonday.getDate() + daysUntilMonday);
      }

      // Genereaza header pentru fiecare luni
      const mondayCurrent = new Date(firstMonday);
      while (mondayCurrent <= end) {
        const headerStart = new Date(mondayCurrent);
        const headerEnd = new Date(mondayCurrent);
        headerEnd.setDate(headerEnd.getDate() + 7); // Saptamana intreaga

        const leftPercent = Math.max(0, ((headerStart.getTime() - timelineSettings.startDate.getTime()) / totalDuration) * 100);
        const effectiveEnd = headerEnd.getTime() > end.getTime() ? end.getTime() : headerEnd.getTime();
        const widthPercent = Math.max(0, ((effectiveEnd - headerStart.getTime()) / totalDuration) * 100);

        headers.push({
          date: headerStart,
          leftPercent,
          widthPercent
        });

        mondayCurrent.setDate(mondayCurrent.getDate() + 7);
      }

      return headers;
    }

    // Pentru SAPTAMANI si LUNI: comportament standard
    while (current <= end) {
      const headerStart = new Date(current);

      // Calculăm data de sfârșit a acestui header
      let headerEnd: Date;
      switch (timelineSettings.viewMode) {
        case 'weeks':
          headerEnd = new Date(current);
          headerEnd.setDate(headerEnd.getDate() + 7);
          current.setDate(current.getDate() + 7);
          break;
        case 'months':
          headerEnd = new Date(current);
          headerEnd.setMonth(headerEnd.getMonth() + 1);
          current.setMonth(current.getMonth() + 1);
          break;
        default:
          headerEnd = new Date(current);
          headerEnd.setDate(headerEnd.getDate() + 1);
          current.setDate(current.getDate() + 1);
      }

      // Calculăm poziția și lățimea ca procente (exact ca barele de task)
      const leftPercent = Math.max(0, ((headerStart.getTime() - timelineSettings.startDate.getTime()) / totalDuration) * 100);

      // Limităm sfârșitul la end date pentru ultimul header
      const effectiveEnd = headerEnd.getTime() > end.getTime() ? end.getTime() : headerEnd.getTime();
      const widthPercent = Math.max(0, ((effectiveEnd - headerStart.getTime()) / totalDuration) * 100);

      headers.push({
        date: headerStart,
        leftPercent,
        widthPercent
      });
    }

    return headers;
  };

  const calculateTaskPosition = (task: GanttTask) => {
    const startDateValue = normalizeDate(task.startDate);
    const endDateValue = normalizeDate(task.endDate);
    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);
    const timelineStart = timelineSettings.startDate;
    const timelineEnd = timelineSettings.endDate;

    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const taskStart = startDate.getTime() - timelineStart.getTime();
    const taskDuration = endDate.getTime() - startDate.getTime();

    const left = Math.max(0, (taskStart / totalDuration) * 100);
    const width = Math.max(0.5, (taskDuration / totalDuration) * 100);

    return { left: `${left}%`, width: `${width}%` };
  };

  const getTaskColor = (task: GanttTask) => {
    if (task.status === 'finalizata') return '#10b981';
    if (task.status === 'anulata') return '#6b7280';
    if (task.priority === 'urgent') return '#ef4444';
    if (task.priority === 'ridicata') return '#f59e0b';

    switch (task.type) {
      case 'proiect': return '#3b82f6';
      case 'subproiect': return '#8b5cf6';
      case 'sarcina': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'proiect': return '📁';
      case 'subproiect': return '📂';
      case 'sarcina': return '📋';
      default: return '📄';
    }
  };

  const toggleTaskCollapse = (taskId: string) => {
    setGanttData(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, isCollapsed: !task.isCollapsed }
        : task
    ));
  };

  const getVisibleTasks = () => {
    let filteredTasks = ganttData;

    // Apply filters
    if (filters.proiect_id) {
      filteredTasks = filteredTasks.filter(task => {
        // For tasks, look for proiect_id in the ID or name
        return task.id.includes(filters.proiect_id) || task.name.includes(filters.proiect_id);
      });
    }
    if (filters.proiect_nume) {
      const searchTerm = filters.proiect_nume.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.id.toLowerCase().includes(searchTerm) ||
        task.name.toLowerCase().includes(searchTerm) ||
        (task as any).proiect_id?.toLowerCase().includes(searchTerm) ||
        (task as any).Adresa?.toLowerCase().includes(searchTerm) ||
        (task as any).client_nume?.toLowerCase().includes(searchTerm)
      );
    }
    if (filters.responsabil_nume) {
      filteredTasks = filteredTasks.filter(task =>
        task.resources.some(resource =>
          resource.toLowerCase().includes(filters.responsabil_nume.toLowerCase())
        )
      );
    }
    if (filters.tip_task) {
      filteredTasks = filteredTasks.filter(task => task.type === filters.tip_task);
    }
    if (filters.status) {
      filteredTasks = filteredTasks.filter(task => task.status === filters.status);
    }
    if (filters.prioritate) {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.prioritate);
    }
    if (filters.start_date) {
      filteredTasks = filteredTasks.filter(task => {
        const taskEndDate = normalizeDate(task.endDate);
        return new Date(taskEndDate) >= new Date(filters.start_date);
      });
    }
    if (filters.end_date) {
      filteredTasks = filteredTasks.filter(task => {
        const taskStartDate = normalizeDate(task.startDate);
        return new Date(taskStartDate) <= new Date(filters.end_date);
      });
    }

    const visible: GanttTask[] = [];
    const collapsedParents = new Set<string>();

    filteredTasks.forEach(task => {
      if (task.isCollapsed) {
        collapsedParents.add(task.id);
      }

      // Show task if it's not hidden under a collapsed parent
      const isHidden = task.parentId && collapsedParents.has(task.parentId);
      if (!isHidden) {
        visible.push(task);
      }
    });

    // FIXED: Sort tasks hierarchically - projects first, then their subprojects, then their tasks
    const sortTasksHierarchically = (tasks: GanttTask[]) => {
      const sorted: GanttTask[] = [];
      const taskMap = new Map<string, GanttTask>();

      // Build a map for quick lookup
      tasks.forEach(task => taskMap.set(task.id, task));

      // First, add all projects (level 0)
      const projects = tasks.filter(task => task.type === 'proiect');
      projects.sort((a, b) => a.name.localeCompare(b.name));

      projects.forEach(project => {
        sorted.push(project);

        // Then add subprojects for this project (level 1)
        const subprojects = tasks.filter(task => task.parentId === project.id);
        subprojects.sort((a, b) => a.name.localeCompare(b.name));

        subprojects.forEach(subproject => {
          sorted.push(subproject);

          // Then add tasks for this subproject (level 2)
          const subprojectTasks = tasks.filter(task => task.parentId === subproject.id);
          subprojectTasks.sort((a, b) => a.name.localeCompare(b.name));
          sorted.push(...subprojectTasks);
        });

        // Also add direct tasks for this project (not under subprojects)
        const directTasks = tasks.filter(task =>
          task.parentId === project.id && task.type === 'sarcina'
        );
        directTasks.sort((a, b) => a.name.localeCompare(b.name));
        sorted.push(...directTasks);
      });

      return sorted;
    };

    return sortTasksHierarchically(visible);
  };

  const formatDate = (date: Date) => {
    const dateYear = date.getFullYear();

    // Helper pentru prescurtare luna cu prima litera mare
    const getShortMonth = (d: Date) => {
      const month = d.toLocaleDateString('ro-RO', { month: 'short' });
      return month.charAt(0).toUpperCase() + month.slice(1);
    };

    switch (timelineSettings.viewMode) {
      case 'days':
        // Format: "01 Ian. 2025" - doar pentru luni (afisate in generateTimelineHeaders)
        const day = date.getDate().toString().padStart(2, '0');
        return `${day} ${getShortMonth(date)} ${dateYear}`;
      case 'weeks':
        // Format: "S1 ian. 2026" - MEREU cu an
        const weekNum = Math.ceil(date.getDate() / 7);
        const monthShort = date.toLocaleDateString('ro-RO', { month: 'short' });
        return `S${weekNum} ${monthShort} ${dateYear}`;
      case 'months':
        // Format: "Ian. 2026" - prescurtat, orizontal
        return `${getShortMonth(date)} ${dateYear}`;
      default:
        return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  };

  if (loading || !isAuthorized) {
    return <LoadingSpinner overlay message="Se încarcă Gantt Chart..." />;
  }

  const timelineHeaders = generateTimelineHeaders();
  const visibleTasks = getVisibleTasks();

  return (
    <UserLayout user={user} displayName={displayName} userRole={userRole}>
      {/* Controls - IDENTICAL TO ADMIN */}
      <Card style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📊 Gantt
          </h2>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button
              variant={timelineSettings.viewMode === 'days' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimelineSettings(prev => ({ ...prev, viewMode: 'days' }))}
            >
              Zile
            </Button>
            <Button
              variant={timelineSettings.viewMode === 'weeks' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimelineSettings(prev => ({ ...prev, viewMode: 'weeks' }))}
            >
              Săptămâni
            </Button>
            <Button
              variant={timelineSettings.viewMode === 'months' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTimelineSettings(prev => ({ ...prev, viewMode: 'months' }))}
            >
              Luni
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon="🔄"
              onClick={loadGanttData}
              loading={loadingData}
            >
              Actualizează
            </Button>
          </div>
        </div>

        {/* Period Filter - IDENTICAL TO ADMIN */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem',
          padding: '1rem',
          background: 'rgba(243, 244, 246, 0.5)',
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151'
          }}>
            📅 Perioadă afișare:
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>De la:</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.75rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Până la:</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.75rem'
              }}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Găsește cea mai avansată dată din proiecte
              const dates = ganttData.flatMap(task => {
                const endDateValue = normalizeDate(task.endDate);
                return [new Date(endDateValue)];
              });
              const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
              const startDate = new Date(maxDate);
              startDate.setMonth(startDate.getMonth() - 1);

              setFilters(prev => ({
                ...prev,
                start_date: startDate.toISOString().split('T')[0],
                end_date: maxDate.toISOString().split('T')[0]
              }));
            }}
          >
            1 lună
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dates = ganttData.flatMap(task => {
                const endDateValue = normalizeDate(task.endDate);
                return [new Date(endDateValue)];
              });
              const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
              const startDate = new Date(maxDate);
              startDate.setMonth(startDate.getMonth() - 3);

              setFilters(prev => ({
                ...prev,
                start_date: startDate.toISOString().split('T')[0],
                end_date: maxDate.toISOString().split('T')[0]
              }));
            }}
          >
            3 luni
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dates = ganttData.flatMap(task => {
                const endDateValue = normalizeDate(task.endDate);
                return [new Date(endDateValue)];
              });
              const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
              const startDate = new Date(maxDate);
              startDate.setMonth(startDate.getMonth() - 6);

              setFilters(prev => ({
                ...prev,
                start_date: startDate.toISOString().split('T')[0],
                end_date: maxDate.toISOString().split('T')[0]
              }));
            }}
          >
            6 luni
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dates = ganttData.flatMap(task => {
                const endDateValue = normalizeDate(task.endDate);
                return [new Date(endDateValue)];
              });
              const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
              const startDate = new Date(maxDate);
              startDate.setFullYear(startDate.getFullYear() - 1);

              setFilters(prev => ({
                ...prev,
                start_date: startDate.toISOString().split('T')[0],
                end_date: maxDate.toISOString().split('T')[0]
              }));
            }}
          >
            1 an
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters(prev => ({ ...prev, start_date: '', end_date: '' }));
            }}
          >
            Resetează
          </Button>
        </div>

        {/* Stats - IDENTICAL TO ADMIN */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          padding: '1rem',
          background: 'rgba(249, 250, 251, 0.5)',
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
              {ganttData.filter(t => t.type === 'proiect').length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Proiectele Mele</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' }}>
              {ganttData.filter(t => t.type === 'subproiect').length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Subproiectele Mele</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#06b6d4' }}>
              {ganttData.filter(t => t.type === 'sarcina').length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Sarcinile Mele</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
              {Math.round(ganttData.reduce((acc, t) => acc + t.progress, 0) / ganttData.length) || 0}%
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Progres Mediu</div>
          </div>
        </div>

        {/* Filters - IDENTICAL TO ADMIN */}
        <div style={{
          padding: '1rem',
          background: 'rgba(249, 250, 251, 0.5)',
          borderRadius: '8px',
          marginTop: '1rem'
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151'
          }}>
            🔍 Filtrare Date
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end'
          }}>
            {/* User Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                👤 Responsabil
              </label>
              <select
                value={filters.responsabil_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, responsabil_nume: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toți responsabilii</option>
                {utilizatori.map((user) => (
                  <option key={user.uid} value={user.nume_complet}>
                    {user.nume_complet}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                📁 Proiect
              </label>
              <select
                value={filters.proiect_id}
                onChange={(e) => setFilters(prev => ({ ...prev, proiect_id: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate proiectele</option>
                {proiecte.map((project) => (
                  <option key={project.ID_Proiect} value={project.ID_Proiect}>
                    {project.ID_Proiect} - {project.Denumire}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Search */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                🔍 Căutare generală
              </label>
              <input
                type="text"
                value={filters.proiect_nume}
                onChange={(e) => setFilters(prev => ({ ...prev, proiect_nume: e.target.value }))}
                placeholder="ID proiect, nume, adresă..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Task Type Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                📋 Tip Task
              </label>
              <select
                value={filters.tip_task}
                onChange={(e) => setFilters(prev => ({ ...prev, tip_task: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate tipurile</option>
                <option value="proiect">📁 Proiect</option>
                <option value="subproiect">📂 Subproiect</option>
                <option value="sarcina">📋 Sarcina</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                📄 Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate statusurile</option>
                <option value="to_do">⏳ De facut</option>
                <option value="in_progress">📄 In progres</option>
                <option value="finalizata">✅ Finalizata</option>
                <option value="anulata">❌ Anulata</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                ⚡ Prioritate
              </label>
              <select
                value={filters.prioritate}
                onChange={(e) => setFilters(prev => ({ ...prev, prioritate: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="">Toate prioritatile</option>
                <option value="normala">🔵 Normala</option>
                <option value="ridicata">🟡 Ridicata</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({
                  proiect_id: '',
                  responsabil_nume: '',
                  proiect_nume: '',
                  client_nume: '',
                  tip_task: '',
                  status: '',
                  prioritate: '',
                  start_date: '',
                  end_date: ''
                })}
                style={{ width: '100%' }}
              >
                🔄 Reset filtre
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Gantt Chart - LAYOUT CU CLICK HANDLERS PENTRU DATE EDITING - IDENTICAL TO ADMIN */}
      <Card>
        {savingChanges && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            color: '#92400e',
            marginBottom: '1rem'
          }}>
            🔄 Se salveaza modificarile...
          </div>
        )}

        <div style={{ overflow: 'auto', position: 'relative' }}>
          <div
            ref={ganttRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: '1200px',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            {/* HEADER SINCRONIZAT */}
            <div style={{
              display: 'flex',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'white',
              borderBottom: '2px solid #e5e7eb'
            }}>
              {/* Comentarii Header */}
              <div style={{
                width: '80px',
                minWidth: '80px',
                maxWidth: '80px',
                height: `${HEADER_HEIGHT}px`,
                padding: '0.5rem',
                fontWeight: '600',
                color: '#374151',
                background: 'rgba(243, 244, 246, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: '1px solid #e5e7eb',
                fontSize: '0.75rem'
              }}>
                💬
              </div>
              {/* Task List Header */}
              <div style={{
                width: '350px',
                minWidth: '350px',
                maxWidth: '350px',
                height: `${HEADER_HEIGHT}px`,
                padding: '1rem',
                fontWeight: '600',
                color: '#374151',
                background: 'rgba(243, 244, 246, 0.9)',
                display: 'flex',
                alignItems: 'center',
                borderRight: '2px solid #e5e7eb'
              }}>
                Proiectele și Sarcinile Mele
              </div>

              {/* Timeline Header - Text vertical pentru săptămâni/zile, orizontal pentru luni */}
              <div style={{
                flex: 1,
                height: `${HEADER_HEIGHT}px`,
                background: 'rgba(243, 244, 246, 0.9)',
                position: 'relative'
              }}>
                {timelineHeaders.map((header, index) => {
                  const isVertical = timelineSettings.viewMode === 'weeks' || timelineSettings.viewMode === 'days';
                  return (
                    <div
                      key={index}
                      style={{
                        position: 'absolute',
                        left: `${header.leftPercent}%`,
                        width: `${header.widthPercent}%`,
                        height: '100%',
                        padding: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#374151',
                        textAlign: 'center',
                        borderRight: index < timelineHeaders.length - 1 ? '1px solid rgba(229, 231, 235, 0.5)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      }}
                    >
                      <span style={{
                        fontSize: isVertical ? '0.65rem' : '0.75rem',
                        lineHeight: '1.2',
                        whiteSpace: 'nowrap',
                        ...(isVertical ? {
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          maxHeight: '55px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        } : {})
                      }}>
                        {formatDate(header.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BODY CONTENT CU CLICK HANDLERS PENTRU EDITARE DATE */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleTasks.map((task, index) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    height: `${ROW_HEIGHT}px`,
                    borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
                    background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(249, 250, 251, 0.5)'
                  }}
                >
                  {/* Coloana Comentarii */}
                  <div
                    style={{
                      width: '80px',
                      minWidth: '80px',
                      maxWidth: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRight: '1px solid #e5e7eb'
                    }}
                  >
                    {(task.type === 'proiect' || task.type === 'subproiect') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowComentariiModal(task);
                        }}
                        style={{
                          background: task.comentarii_count && task.comentarii_count > 0
                            ? 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.05) 100%)'
                            : 'transparent',
                          border: task.comentarii_count && task.comentarii_count > 0
                            ? '1px solid rgba(52, 152, 219, 0.3)'
                            : '1px dashed #bdc3c7',
                          borderRadius: '8px',
                          padding: '0.35rem 0.5rem',
                          cursor: 'pointer',
                          color: task.comentarii_count && task.comentarii_count > 0 ? '#3498db' : '#95a5a6',
                          fontSize: '11px',
                          fontWeight: '600',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title={task.comentarii_count && task.comentarii_count > 0
                          ? `${task.comentarii_count} comentarii`
                          : 'Adaugă comentariu'}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = '#3498db';
                          e.currentTarget.style.color = '#3498db';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = task.comentarii_count && task.comentarii_count > 0
                            ? 'rgba(52, 152, 219, 0.3)'
                            : '#bdc3c7';
                          e.currentTarget.style.color = task.comentarii_count && task.comentarii_count > 0
                            ? '#3498db'
                            : '#95a5a6';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        💬
                        {task.comentarii_count && task.comentarii_count > 0 && (
                          <span>{task.comentarii_count}</span>
                        )}
                      </button>
                    )}
                  </div>
                  {/* Task Info */}
                  <div
                    style={{
                      width: '350px',
                      minWidth: '350px',
                      maxWidth: '350px',
                      padding: '0.75rem',
                      paddingLeft: `${1 + task.level * 1.5}rem`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      borderRight: '2px solid #e5e7eb'
                    }}
                    onClick={() => {
                      setSelectedTask(task);
                      setShowTaskModal(true);
                    }}
                  >
                    {task.type !== 'sarcina' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskCollapse(task.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          color: '#6b7280'
                        }}
                      >
                        {task.isCollapsed ? '▶' : '▼'}
                      </button>
                    )}

                    <span style={{ fontSize: '1rem' }}>
                      {getTaskIcon(task.type)}
                    </span>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: task.type === 'proiect' ? '600' : '400',
                        color: '#374151',
                        marginBottom: '0.25rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textDecoration: (task.status === 'finalizata' || (task.type === 'sarcina' && task.progress === 100)) ? 'line-through' : 'none',
                        opacity: (task.status === 'finalizata' || (task.type === 'sarcina' && task.progress === 100)) ? 0.7 : 1
                      }}>
                        {task.name}
                      </div>

                      {task.resources.length > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                          color: '#6b7280'
                        }}>
                          <span>👥</span>
                          {task.resources.slice(0, 3).map((resource, idx) => {
                            const colors = getResponsabilColor(resource);
                            return (
                              <span
                                key={idx}
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  background: colors.bg,
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: '600',
                                  color: colors.text
                                }}
                                title={resource}
                              >
                                {getInitials(resource)}
                              </span>
                            );
                          })}
                          {task.resources.length > 3 && (
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                              +{task.resources.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: getTaskColor(task),
                      color: 'white',
                      fontWeight: '500',
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {task.progress}%
                    </div>
                  </div>

                  {/* Timeline Content cu CLICK HANDLERS - IDENTICAL TO ADMIN */}
                  <div
                    data-timeline-body
                    style={{
                      flex: 1,
                      position: 'relative',
                      background: 'white'
                    }}
                  >
                    {/* Grid lines - sincronizate cu header-urile */}
                    {timelineHeaders.map((header, headerIndex) => (
                      <div
                        key={`grid-${headerIndex}`}
                        style={{
                          position: 'absolute',
                          left: `${header.leftPercent}%`,
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          background: 'rgba(229, 231, 235, 0.5)',
                          pointerEvents: 'none',
                          zIndex: 0
                        }}
                      />
                    ))}

                    {/* Start Date Label */}
                    {(() => {
                      const position = calculateTaskPosition(task);
                      const widthPercent = parseFloat(position.width.replace('%', ''));

                      return widthPercent > 8 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(${position.left} - 65px)`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.65rem',
                            color: '#6b7280',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none'
                          }}
                        >
                          {(() => {
                            const startDate = parseTaskDate(task.startDate);
                            return startDate.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
                          })()}
                        </div>
                      );
                    })()}

                    {/* Task Bar cu CLICK HANDLERS pe capete - IDENTICAL TO ADMIN */}
                    {(() => {
                      const position = calculateTaskPosition(task);
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            left: position.left,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: position.width,
                            height: '24px',
                            background: getTaskColor(task),
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            opacity: task.status === 'anulata' ? 0.5 : 1,
                            overflow: 'hidden'
                          }}
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskModal(true);
                          }}
                        >
                          {/* LEFT CLICK HANDLER - START DATE - IDENTICAL TO ADMIN */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '-4px',
                              top: '-4px',
                              bottom: '-4px',
                              width: '12px',
                              cursor: 'pointer',
                              background: 'rgba(59, 130, 246, 0.1)',
                              borderRadius: '4px 0 0 4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease',
                              zIndex: 2
                            }}
                            onClick={(e) => handleDateClick(task.id, 'start', e)}
                            onMouseEnter={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.background = 'rgba(59, 130, 246, 0.3)';
                              target.style.width = '16px';
                              target.style.left = '-6px';
                            }}
                            onMouseLeave={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.background = 'rgba(59, 130, 246, 0.1)';
                              target.style.width = '12px';
                              target.style.left = '-4px';
                            }}
                            title="Click pentru a edita data de început"
                          >
                            <div style={{
                              width: '4px',
                              height: '16px',
                              background: 'rgba(59, 130, 246, 0.8)',
                              borderRadius: '2px'
                            }} />
                          </div>

                          {/* RIGHT CLICK HANDLER - END DATE - IDENTICAL TO ADMIN */}
                          <div
                            style={{
                              position: 'absolute',
                              right: '-4px',
                              top: '-4px',
                              bottom: '-4px',
                              width: '12px',
                              cursor: 'pointer',
                              background: 'rgba(59, 130, 246, 0.1)',
                              borderRadius: '0 4px 4px 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease',
                              zIndex: 2
                            }}
                            onClick={(e) => handleDateClick(task.id, 'end', e)}
                            onMouseEnter={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.background = 'rgba(59, 130, 246, 0.3)';
                              target.style.width = '16px';
                              target.style.right = '-6px';
                            }}
                            onMouseLeave={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.background = 'rgba(59, 130, 246, 0.1)';
                              target.style.width = '12px';
                              target.style.right = '-4px';
                            }}
                            title="Click pentru a edita data de sfârșit"
                          >
                            <div style={{
                              width: '4px',
                              height: '16px',
                              background: 'rgba(59, 130, 246, 0.8)',
                              borderRadius: '2px'
                            }} />
                          </div>

                          {/* Progress Bar */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${task.progress}%`,
                              background: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: '4px 0 0 4px',
                              pointerEvents: 'none'
                            }}
                          />

                          {/* Progress Percentage */}
                          <span style={{
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            position: 'relative',
                            zIndex: 1,
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                            pointerEvents: 'none'
                          }}>
                            {task.progress}%
                          </span>
                        </div>
                      );
                    })()}

                    {/* End Date Label */}
                    {(() => {
                      const position = calculateTaskPosition(task);
                      const widthPercent = parseFloat(position.width.replace('%', ''));

                      return widthPercent > 8 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `calc(${position.left} + ${position.width} + 8px)`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.65rem',
                            color: '#6b7280',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none'
                          }}
                        >
                          {(() => {
                            const endDate = parseTaskDate(task.endDate);
                            return endDate.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
                          })()}
                        </div>
                      );
                    })()}

                    {/* Today Line - DOAR PE PRIMUL RAND */}
                    {index === 0 && (() => {
                      const today = new Date();
                      const timelineStart = timelineSettings.startDate;
                      const timelineEnd = timelineSettings.endDate;

                      if (today >= timelineStart && today <= timelineEnd) {
                        const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
                        const todayPosition = (today.getTime() - timelineStart.getTime()) / totalDuration * 100;

                        return (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${todayPosition}%`,
                              top: `-${HEADER_HEIGHT}px`,
                              bottom: `-${visibleTasks.length * ROW_HEIGHT}px`,
                              width: '2px',
                              background: '#ef4444',
                              zIndex: 5,
                              boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)',
                              pointerEvents: 'none'
                            }}
                          />
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* DatePickerPopup Integration - IDENTICAL TO ADMIN */}
      <DatePickerPopup
        isOpen={dateEditState.isOpen}
        position={dateEditState.position}
        currentDate={dateEditState.currentDate}
        dateType={dateEditState.dateType}
        taskName={dateEditState.taskName}
        onSave={handleDateSave}
        onCancel={handleDateCancel}
      />

      {/* Task Details Modal - IDENTICAL TO ADMIN */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Detalii Sarcina"
        size="lg"
      >
        {selectedTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              background: `${getTaskColor(selectedTask)}20`,
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '2rem' }}>
                {getTaskIcon(selectedTask.type)}
              </span>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>
                  {selectedTask.name}
                </h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  <span>Tip: {selectedTask.type}</span>
                  <span>Status: {selectedTask.status}</span>
                  <span>Prioritate: {selectedTask.priority}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Timeline</h4>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  <div>Start: {(() => {
                    const dateValue = normalizeDate(selectedTask.startDate);
                    return dateValue && !isNaN(new Date(dateValue).getTime()) ? new Date(dateValue).toLocaleDateString('ro-RO') : 'Data neprecizata';
                  })()}</div>
                  <div>Final: {(() => {
                    const dateValue = normalizeDate(selectedTask.endDate);
                    return dateValue && !isNaN(new Date(dateValue).getTime()) ? new Date(dateValue).toLocaleDateString('ro-RO') : 'Data neprecizata';
                  })()}</div>
                  <div>Progres: {selectedTask.progress}%</div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Responsabili</h4>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedTask.resources.length > 0 ? (
                    selectedTask.resources.map((resource, index) => (
                      <div key={index}>👤 {resource}</div>
                    ))
                  ) : (
                    <div>Niciun responsabil atribuit</div>
                  )}
                </div>
              </div>
            </div>

            {(selectedTask.estimatedHours || selectedTask.workedHours) && (
              <div style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Time Tracking</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <strong>Estimat:</strong><br />
                    {selectedTask.estimatedHours || 0}h
                  </div>
                  <div>
                    <strong>Lucrat:</strong><br />
                    {selectedTask.workedHours || 0}h
                  </div>
                  <div>
                    <strong>Rămâne:</strong><br />
                    {Math.max(0, (selectedTask.estimatedHours || 0) - (selectedTask.workedHours || 0))}h
                  </div>
                </div>
              </div>
            )}

            {/* ✅ 18.01.2026: Secțiune Timp Economic (pentru proiecte și subproiecte) */}
            {(selectedTask.type === 'proiect' || selectedTask.type === 'subproiect') && selectedTask.economicHoursAllocated !== undefined && (
              <div style={{
                padding: '1rem',
                background: (selectedTask.economicHoursRemaining || 0) < 0
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(34, 197, 94, 0.1)',
                borderRadius: '8px',
                border: (selectedTask.economicHoursRemaining || 0) < 0
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px solid rgba(34, 197, 94, 0.3)'
              }}>
                <h4 style={{
                  margin: '0 0 0.5rem 0',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>💰</span>
                  <span>Timp Economic (din Buget)</span>
                  {(selectedTask.economicHoursRemaining || 0) < 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      DEPĂȘIRE!
                    </span>
                  )}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <strong>Alocat:</strong><br />
                    <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#059669' }}>
                      {Number(selectedTask.economicHoursAllocated || 0).toFixed(1)}h
                    </span>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      ({(Number(selectedTask.economicHoursAllocated || 0) / Number(selectedTask.ore_pe_zi || 8)).toFixed(1)} zile)
                    </span>
                  </div>
                  <div>
                    <strong>Consumat:</strong><br />
                    <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#3b82f6' }}>
                      {Number(selectedTask.workedHours || 0).toFixed(1)}h
                    </span>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      ({(Number(selectedTask.workedHours || 0) / Number(selectedTask.ore_pe_zi || 8)).toFixed(1)} zile)
                    </span>
                  </div>
                  <div>
                    <strong>Rămas:</strong><br />
                    <span style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: Number(selectedTask.economicHoursRemaining || 0) < 0 ? '#ef4444' : '#059669'
                    }}>
                      {Number(selectedTask.economicHoursRemaining || 0).toFixed(1)}h
                    </span>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      ({(Number(selectedTask.economicHoursRemaining || 0) / Number(selectedTask.ore_pe_zi || 8)).toFixed(1)} zile)
                    </span>
                  </div>
                </div>

                {/* Progres bar economic */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    marginBottom: '4px'
                  }}>
                    <span>Progres Economic</span>
                    <span style={{
                      fontWeight: '600',
                      color: Number(selectedTask.economicProgress || 0) > 100 ? '#ef4444' : '#059669'
                    }}>
                      {Math.min(Number(selectedTask.economicProgress || 0), 999).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    background: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(Number(selectedTask.economicProgress || 0), 100)}%`,
                      height: '100%',
                      background: Number(selectedTask.economicProgress || 0) > 100
                        ? '#ef4444'
                        : Number(selectedTask.economicProgress || 0) > 80
                          ? '#f59e0b'
                          : '#22c55e',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

              </div>
            )}

            {/* ✅ 18.01.2026: Secțiune Alocare Lucrători */}
            <div style={{
              padding: '1rem',
              background: 'rgba(139, 92, 246, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h4 style={{
                  margin: 0,
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>👥</span>
                  <span>Alocări Zilnice</span>
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const willShow = !showAllocationForm;
                    setShowAllocationForm(willShow);
                    if (willShow) {
                      // Reset allocation data cu data curentă când deschidem formularul
                      setAllocationData({
                        data_planificare: new Date().toISOString().split('T')[0],
                        utilizator_uid: '',
                        utilizator_nume: '',
                        ore_planificate: 8,
                        prioritate: 'normala',
                        observatii: '',
                        sync_planificator_personal: true
                      });
                      loadExistingAllocations(selectedTask.id, selectedTask.type);
                    }
                  }}
                  style={{
                    background: showAllocationForm ? '#8b5cf6' : 'transparent',
                    color: showAllocationForm ? 'white' : '#8b5cf6',
                    borderColor: '#8b5cf6'
                  }}
                >
                  {showAllocationForm ? '✕ Închide' : '+ Alocă Lucrător'}
                </Button>
              </div>

              {showAllocationForm && (
                <div style={{
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    {/* Selector Lucrător */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                        Lucrător *
                      </label>
                      <select
                        value={allocationData.utilizator_uid}
                        onChange={(e) => {
                          const selectedUser = utilizatori.find(u => u.uid === e.target.value);
                          setAllocationData({
                            ...allocationData,
                            utilizator_uid: e.target.value,
                            utilizator_nume: selectedUser ? `${selectedUser.prenume || ''} ${selectedUser.nume || ''}`.trim() : ''
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.9rem'
                        }}
                      >
                        <option value="">-- Selectează --</option>
                        {utilizatori.map(u => (
                          <option key={u.uid} value={u.uid}>
                            {u.prenume} {u.nume}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selector Data */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                        Data *
                      </label>
                      <input
                        type="date"
                        value={allocationData.data_planificare}
                        onChange={(e) => setAllocationData({ ...allocationData, data_planificare: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>

                    {/* Ore planificate */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                        Ore planificate
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        max="12"
                        step="0.5"
                        value={allocationData.ore_planificate}
                        onChange={(e) => setAllocationData({ ...allocationData, ore_planificate: parseFloat(e.target.value) || 8 })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>

                    {/* Prioritate */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '4px', color: '#374151' }}>
                        Prioritate
                      </label>
                      <select
                        value={allocationData.prioritate}
                        onChange={(e) => setAllocationData({ ...allocationData, prioritate: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.9rem'
                        }}
                      >
                        <option value="normala">Normală</option>
                        <option value="ridicata">Ridicată</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkbox sync planificator */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={allocationData.sync_planificator_personal}
                        onChange={(e) => setAllocationData({ ...allocationData, sync_planificator_personal: e.target.checked })}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                        Adaugă automat în Planificatorul Personal al lucrătorului
                      </span>
                    </label>
                  </div>

                  {/* Buton salvare */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveAllocation}
                    loading={savingAllocation}
                    disabled={!allocationData.utilizator_uid || !allocationData.data_planificare}
                    style={{ width: '100%' }}
                  >
                    Salvează Alocare
                  </Button>
                </div>
              )}

              {/* Lista alocări existente */}
              {existingAllocations.length > 0 && (
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '500', marginBottom: '0.5rem', color: '#6b7280' }}>
                    Alocări existente ({existingAllocations.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {existingAllocations.slice(0, 5).map((alloc: any) => (
                      <div
                        key={alloc.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: '500' }}>{alloc.utilizator_nume}</span>
                          <span style={{ color: '#6b7280', margin: '0 8px' }}>•</span>
                          <span style={{ color: '#6b7280' }}>{alloc.data_planificare}</span>
                          <span style={{ color: '#6b7280', margin: '0 8px' }}>•</span>
                          <span style={{ color: '#3b82f6' }}>{alloc.ore_planificate}h</span>
                        </div>
                        <button
                          onClick={() => handleDeleteAllocation(alloc.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px'
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = '#fef2f2')}
                          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    {existingAllocations.length > 5 && (
                      <div style={{ color: '#6b7280', textAlign: 'center', fontSize: '0.8rem' }}>
                        ... și încă {existingAllocations.length - 5} alocări
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/projects`)}
              >
                Vezi Proiectele Mele
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowTaskModal(false)}
              >
                Închide
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal pentru Comentarii - deschide direct pe tab-ul comentarii */}
      {showComentariiModal && comentariiProiect && (
        <div style={{ zIndex: 50000 }}>
          <SarciniProiectModal
            proiect={comentariiProiect}
            isOpen={showComentariiModal}
            onClose={handleCloseComentariiModal}
            defaultTab={comentariiDefaultTab}
          />
        </div>
      )}
    </UserLayout>
  );
}