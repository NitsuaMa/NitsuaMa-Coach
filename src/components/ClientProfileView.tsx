
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Activity, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Edit3, 
  Plus, 
  Trash2, 
  Save,
  Clock,
  Dumbbell,
  TrendingUp,
  AlertCircle,
  Play,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MachineInsightsModal } from './MachineInsightsModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROUTINE_TEMPLATES, RoutineTemplateType } from '../constants';
import { Client, Machine, WorkoutSession, ExerciseLog, Routine, View, ClientMachineSetting, TrainerFocus, Trainer, ScheduleEntry, ProgressReport } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { WorkoutChartGrid } from './WorkoutChartGrid';

export function ClientProfileView({ 
  clientId, 
  clients, 
  machines, 
  authTrainer,
  onDelete,
  onSelectReport,
  setView 
}: { 
  clientId: string | null, 
  clients: Client[], 
  machines: Machine[], 
  authTrainer?: Trainer | null,
  onDelete: (id: string) => void,
  onSelectReport: (id: string) => void,
  setView: (v: View) => void 
}) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [allLogs, setAllLogs] = useState<ExerciseLog[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [clientSettings, setClientSettings] = useState<Record<string, ClientMachineSetting>>({});
  const [trainerFocuses, setTrainerFocuses] = useState<TrainerFocus[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduleEntry[]>([]);
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [focusForm, setFocusForm] = useState<Partial<TrainerFocus>>({
    category: 'Path',
    notes: ''
  });
  const [selectedTimingSessionId, setSelectedTimingSessionId] = useState<string | null>(null);
  const [isSavingFocus, setIsSavingFocus] = useState(false);
  const [isEditingRoutine, setIsEditingRoutine] = useState<string | null>(null);
  const [routineEditData, setRoutineEditData] = useState<{name: string, machineIds: string[]}>({ name: '', machineIds: [] });
  const [highlightRoutine, setHighlightRoutine] = useState<'A' | 'B' | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [showFullChart, setShowFullChart] = useState(false);
  const [sessionLimit, setSessionLimit] = useState(10);
  const [activeTab, setActiveTab] = useState('overview');
  const [infoForm, setInfoForm] = useState<Partial<Client>>({});
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [stagedMachineIds, setStagedMachineIds] = useState<Record<string, string[]>>({});
  const [isSavingRoutine, setIsSavingRoutine] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [isAddingHistorical, setIsAddingHistorical] = useState(false);
  const [historicalSessionDate, setHistoricalSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [historicalRoutineName, setHistoricalRoutineName] = useState('A');
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [editingLogs, setEditingLogs] = useState<ExerciseLog[]>([]);
  const [selectedInsightMachine, setSelectedInsightMachine] = useState<Machine | null>(null);
  const SESSIONS_PER_PAGE = 3;

  useEffect(() => {
    if (editingSession) {
      const logs = allLogs.filter(l => l.sessionId === editingSession.id);
      // Ensure we have machine names or something for display
      setEditingLogs(logs);
    }
  }, [editingSession, allLogs]);

  const handleUpdateLog = async (logId: string, data: Partial<ExerciseLog>) => {
    try {
      await updateDoc(doc(db, 'exerciseLogs', logId), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exerciseLogs/${logId}`);
    }
  };

  const handleAddLogToSession = async (machineId: string) => {
    if (!editingSession || !clientId) return;
    try {
      await addDoc(collection(db, 'exerciseLogs'), {
        sessionId: editingSession.id,
        clientId,
        machineId,
        weight: '0',
        reps: 0,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'exerciseLogs');
    }
  };

  const handleCreateHistoricalSession = async () => {
    if (!clientId) return;
    setIsSavingHistory(true);
    try {
      // Create a date object that matches the historical date at noon to avoid timezone shifts
      const dateObj = new Date(historicalSessionDate + 'T12:00:00');
      const ts = Timestamp.fromDate(dateObj);
      
      const sessionRef = await addDoc(collection(db, 'sessions'), {
        clientId,
        trainerId: auth.currentUser?.uid || 'manual-entry',
        trainerInitials: '---',
        sessionType: 'Standard',
        sessionNumber: sessions.length + 1,
        date: historicalSessionDate,
        routineName: historicalRoutineName,
        status: 'Completed',
        createdAt: ts,
        startTime: ts,
        endTime: ts,
      });

      // Automatically add machines from selected routine if it exists
      const routine = routines.find(r => r.name === historicalRoutineName);
      if (routine && routine.machineIds.length > 0) {
        const logPromises = routine.machineIds.map(mId => 
          addDoc(collection(db, 'exerciseLogs'), {
            sessionId: sessionRef.id,
            clientId,
            machineId: mId,
            weight: '0',
            reps: '0',
            createdAt: ts
          })
        );
        await Promise.all(logPromises);
      }

      setEditingSession({ 
        id: sessionRef.id, 
        clientId, 
        trainerId: auth.currentUser?.uid || 'manual-entry', 
        date: historicalSessionDate, 
        routineName: historicalRoutineName, 
        status: 'Completed',
        startTime: ts,
        endTime: ts,
        createdAt: ts
      } as unknown as WorkoutSession);
      
      setIsAddingHistorical(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sessions');
    } finally {
      setIsSavingHistory(false);
    }
  };

  const client = clients.find(c => c.id === clientId);

  useEffect(() => {
    if (client) {
      setInfoForm({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email || '',
        phone: client.phone || '',
        height: client.height || '',
        weight: client.weight || '',
        age: client.age || '',
        occupation: client.occupation || '',
        emergencyContactName: client.emergencyContactName || '',
        emergencyContactPhone: client.emergencyContactPhone || '',
        globalNotes: client.globalNotes || '',
        isActive: client.isActive ?? true,
        isRoutineBActive: client.isRoutineBActive ?? false
      });
    }
  }, [client]);

  const handleSaveInfo = async () => {
    if (!clientId) return;
    setIsSavingInfo(true);
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        ...infoForm,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleToggleRoutineB = async (checked: boolean) => {
    if (!clientId) return;
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        isRoutineBActive: checked,
        updatedAt: serverTimestamp()
      });
      setInfoForm(prev => ({ ...prev, isRoutineBActive: checked }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
    }
  };

  const toggleMachineInRoutine = (routineName: string, machineId: string) => {
    const current = stagedMachineIds[routineName] || [];
    const next = current.includes(machineId)
      ? current.filter(id => id !== machineId)
      : [...current, machineId];
    
    setStagedMachineIds(prev => ({ ...prev, [routineName]: next }));
  };

  const handleSaveRoutineConfig = async (routineName: string) => {
    if (!clientId) return;
    const machineIds = stagedMachineIds[routineName] || [];
    
    setIsSavingRoutine(prev => ({ ...prev, [routineName]: true }));
    try {
      const existing = routines.find(r => r.name === routineName);
      if (existing) {
        await updateDoc(doc(db, 'routines', existing.id!), {
          machineIds,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'routines'), {
          clientId,
          name: routineName,
          machineIds,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'routines');
    } finally {
      setIsSavingRoutine(prev => ({ ...prev, [routineName]: false }));
    }
  };

  const handleApplyTemplate = (templateType: RoutineTemplateType, routineName: string) => {
    if (!clientId) return;
    
    const templateNames = ROUTINE_TEMPLATES[templateType];
    const machineIds = templateNames
      .map(name => machines.find(m => m.name === name || m.fullName === name)?.id)
      .filter((id): id is string => !!id);

    setStagedMachineIds(prev => ({ ...prev, [routineName]: machineIds }));
    
    if (routineName?.includes('Routine B')) {
      handleToggleRoutineB(true);
    }
  };

  useEffect(() => {
    if (!clientId) return;

    // Fetch Routines
    const routinesQuery = query(collection(db, 'routines'), where('clientId', '==', clientId));
    const unsubscribeRoutines = onSnapshot(routinesQuery, (snapshot) => {
      const routinesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(routinesData);
      
      // Initialize staged IDs if not already modified
      const initialStaged: Record<string, string[]> = {};
      routinesData.forEach(r => {
        initialStaged[r.name] = r.machineIds;
      });
      setStagedMachineIds(prev => ({ ...initialStaged, ...prev }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'routines');
    });

    // Fetch All Sessions for this client with limit
    const sessionsQuery = query(
      collection(db, 'sessions'), 
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      limit(sessionLimit)
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutSession));
      setSessions(sessData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sessions');
    });

    // Fetch logs for the visible sessions - this is more complex but saves a lot of reads
    // For now, we'll fetch the most recent N logs for this client
    const logsQuery = query(
      collection(db, 'exerciseLogs'), 
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc'),
      limit(sessionLimit * 20) // Assuming avg 20 machines per session
    );
    const unsubscribeLogs = onSnapshot(logsQuery, (logSnap) => {
      setAllLogs(logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'exerciseLogs');
    });

    return () => {
      unsubscribeRoutines();
      unsubscribeSessions();
      unsubscribeLogs();
    };
  }, [clientId, sessionLimit]);

  useEffect(() => {
    if (!clientId) return;

    const settingsQ = query(
      collection(db, 'clientMachineSettings'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(settingsQ, (snap) => {
      const settingsMap: Record<string, ClientMachineSetting> = {};
      snap.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() } as ClientMachineSetting;
        settingsMap[data.machineId] = data;
      });
      setClientSettings(settingsMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clientMachineSettings');
    });

    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;

    // Fetch Focuses for this client
    const focusQ = query(
      collection(db, 'trainerFocuses'),
      where('clientId', '==', clientId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribeFocus = onSnapshot(focusQ, (snap) => {
      setTrainerFocuses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainerFocus)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'trainerFocuses');
    });

    return () => unsubscribeFocus();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    const q = query(
      collection(db, 'progressReports'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setProgressReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgressReport)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'progressReports');
    });
    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    const q = query(
      collection(db, 'schedules'),
      where('clientId', '==', clientId),
      where('startTime', '>=', Timestamp.now()),
      orderBy('startTime', 'asc'),
      limit(2)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setScheduledSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEntry)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'schedules');
    });
    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    const myFocus = trainerFocuses.find(f => f.trainerId === authTrainer?.id);
    if (myFocus) {
      setFocusForm({
        category: myFocus.category,
        notes: myFocus.notes
      });
    }
  }, [trainerFocuses, authTrainer]);

  const handleSaveFocus = async () => {
    if (!clientId || !authTrainer) return;
    setIsSavingFocus(true);
    try {
      const myFocus = trainerFocuses.find(f => f.trainerId === authTrainer.id);
      const focusData = {
        clientId,
        trainerId: authTrainer.id,
        trainerName: authTrainer.fullName,
        category: focusForm.category,
        notes: focusForm.notes,
        updatedAt: serverTimestamp()
      };

      if (myFocus) {
        await updateDoc(doc(db, 'trainerFocuses', myFocus.id!), focusData);
      } else {
        await addDoc(collection(db, 'trainerFocuses'), focusData);
      }
      setIsEditingFocus(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'trainerFocuses');
    } finally {
      setIsSavingFocus(false);
    }
  };

  const handleSaveRoutine = async () => {
    if (!clientId || !isEditingRoutine) return;
    
    const original = routines.find(r => r.id === isEditingRoutine);
    if (!original) return;

    try {
      // 1. Update existing routine
      await updateDoc(doc(db, 'routines', isEditingRoutine), {
        name: routineEditData.name,
        machineIds: routineEditData.machineIds,
        updatedAt: serverTimestamp()
      });

      // 2. Log adjustment in backend for history
      await addDoc(collection(db, 'routineAdjustments'), {
        routineId: isEditingRoutine,
        clientId,
        previousMachineIds: original.machineIds,
        newMachineIds: routineEditData.machineIds,
        trainerId: authTrainer?.id || 'unknown',
        createdAt: serverTimestamp()
      });

      setIsEditingRoutine(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `routines/${isEditingRoutine}`);
    }
  };

  const startEditRoutine = (routine: Routine) => {
    setIsEditingRoutine(routine.id!);
    setRoutineEditData({ name: routine.name, machineIds: [...routine.machineIds] });
  };

  if (!client) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground opacity-20" />
      <p className="text-muted-foreground font-medium">Select a client to view their profile.</p>
      <Button onClick={() => setView('clients')}>Back to Clients</Button>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-[1400px] mx-auto space-y-2 pb-8 px-2 sm:px-4"
    >
      {/* Alerts / Notifications */}
      {(() => {
        if (progressReports.length === 0) {
          // Only show "Report Required" if client is older than 3 months
          const clientCreatedAt = client.createdAt?.toDate?.() || (client.createdAt ? new Date(client.createdAt) : new Date());
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

          if (clientCreatedAt > threeMonthsAgo) {
            return null;
          }

          return (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <div className="bg-red-500/10 border-2 border-red-500/20 rounded-3xl p-4 flex items-center gap-4 text-red-600">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">Report Required</p>
                  <p className="text-[10px] font-bold opacity-80">This client has no progress report on file. Please perform an evaluation.</p>
                </div>
                <Button variant="ghost" className="ml-auto text-[10px] font-black uppercase hover:bg-red-500/10" onClick={() => setView('progress-report')}>Start Now</Button>
              </div>
            </motion.div>
          );
        }
        
        const lastDate = new Date(progressReports[0].date + 'T12:00:00');
        const nextDueDate = new Date(lastDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 3);
        
        const today = new Date();
        const diffTime = nextDueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 21) {
          const isOverdue = diffDays < 0;
          return (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <div className={`${isOverdue ? 'bg-red-500/10 border-red-200 text-red-600' : 'bg-amber-500/10 border-amber-200 text-amber-600'} border-2 rounded-3xl p-4 flex items-center gap-4`}>
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">Report Due {isOverdue ? 'Yesterday' : `Soon`}</p>
                  <p className="text-[10px] font-bold opacity-80">
                    {isOverdue 
                      ? `The 3-month progress report was due on ${nextDueDate.toLocaleDateString()}.` 
                      : `The next progress report is due on ${nextDueDate.toLocaleDateString()} (in ${diffDays} days).`}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  className={`ml-auto text-[10px] font-black uppercase ${isOverdue ? 'hover:bg-red-500/10' : 'hover:bg-amber-500/10'}`} 
                  onClick={() => setView('progress-report')}
                >
                  Schedule Report
                </Button>
              </div>
            </motion.div>
          );
        }
        return null;
      })()}

      {/* Compact Header */}
      <div className="bg-gradient-to-br from-[#115E8D] to-slate-900 rounded-[16px] px-3 sm:px-4 py-3 mb-2 shadow-md relative overflow-hidden text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 z-10 shrink-[2] min-w-0">
          <Button onClick={() => setView('clients')} variant="ghost" size="icon" className="shrink-0 text-white/70 hover:text-white hover:bg-white/10 -ml-1 sm:-ml-2 h-8 w-8 sm:h-10 sm:w-10 rounded-full">
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20 hidden sm:flex">
            <User className="w-5 h-5 text-white/50" />
          </div>
          <div className="flex flex-col min-w-0">
             <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
               <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tighter leading-none m-0 truncate">
                 {client.firstName} {client.lastName}
               </h2>
               <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/80">
                 <div className="flex items-center gap-1 bg-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-white/5 whitespace-nowrap">
                   <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                   <span>LAST: <span className="text-white">{sessions[0]?.date ? new Date(sessions[0].date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'NONE'}</span></span>
                 </div>
                 {(() => {
                   if (!scheduledSessions[0]) {
                     return (
                       <div className="flex items-center gap-1 bg-white/5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-white/40 border border-white/10 whitespace-nowrap">
                         <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                         <span>NEXT: UNSCHEDULED</span>
                       </div>
                     );
                   }

                   const firstSessionDate = scheduledSessions[0].startTime.toDate();
                   const today = new Date();
                   const isFirstSessionToday = firstSessionDate.getDate() === today.getDate() && firstSessionDate.getMonth() === today.getMonth() && firstSessionDate.getFullYear() === today.getFullYear();
                   
                   if (isFirstSessionToday) {
                     const timeStr = firstSessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                     let nextStr = '';
                     if (scheduledSessions[1]) {
                       const nextDate = scheduledSessions[1].startTime.toDate();
                       nextStr = ` | Next: ${nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
                     }
                     return (
                       <div className="flex items-center gap-1 bg-[#F06C22]/20 text-[#F06C22] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-[#F06C22]/30 shadow-[0_0_10px_rgba(240,108,34,0.3)] whitespace-nowrap">
                         <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                         <span>Today @ {timeStr} <span className="font-black text-white">{nextStr}</span></span>
                       </div>
                     );
                   }

                   return (
                     <div className="flex items-center gap-1 bg-[#F06C22]/20 text-[#F06C22] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-[#F06C22]/30 shadow-[0_0_10px_rgba(240,108,34,0.3)] whitespace-nowrap">
                       <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                       <span>NEXT: <span className="font-black text-white">{firstSessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span></span>
                     </div>
                   );
                 })()}
               </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2 z-10 shrink-0 ml-auto">
          <Button onClick={() => setView('workouts')} className="bg-[#F06C22] hover:bg-[#F06C22]/90 text-white rounded-lg font-black uppercase text-xs sm:text-sm tracking-widest h-9 sm:h-10 px-4 sm:px-6 shadow-[0_0_15px_rgba(240,108,34,0.5)] border-none shrink-0">
             START SESSION
          </Button>
        </div>

        <div className="absolute -right-20 -top-20 opacity-[0.03] pointer-events-none">
          <Dumbbell className="w-[300px] h-[300px]" />
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col min-h-0" onValueChange={setActiveTab}>
        <div className="mb-2">
          <TabsList className="bg-transparent p-0 flex flex-wrap gap-1 w-full h-auto">
            <TabsTrigger value="overview" className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm">
              Matrix
            </TabsTrigger>
            <TabsTrigger value="routines" className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm">
              Routines
            </TabsTrigger>
            <TabsTrigger value="focus" className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm">
              Focus
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm">
              History
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm">
              Reports
            </TabsTrigger>
            <TabsTrigger value="timing" className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm">
              Timing
            </TabsTrigger>
            <TabsTrigger value="details" className="flex-1 min-w-[80px] rounded-full border border-slate-200 h-[26px] px-3 font-black uppercase text-[9px] tracking-widest text-[#68717A] bg-transparent data-[state=active]:border-transparent data-[state=active]:bg-[#115E8D] data-[state=active]:text-white transition-all data-[state=active]:shadow-sm">
              Profile
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 flex-1 overflow-hidden min-h-0 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="w-full h-full overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed select-none min-w-full">
              <thead>
                <tr className="bg-[#115E8D] text-white uppercase text-[9px] font-black tracking-widest leading-none h-[32px]">
                  <th className="p-1.5 pl-4 w-[28%] border-r border-[#115E8D]/20 truncate">Equipment & Settings</th>
                  {sessions.slice(0, 6).reverse().map((s) => (
                    <th key={s.id} className="p-1.5 text-center border-r border-[#115E8D]/20 truncate w-[10%] opacity-90">
                      {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </th>
                  ))}
                  <th className="p-1.5 text-center bg-[#F06C22] text-white truncate w-[12%] border-l shadow-inner border-[#F06C22]/80">
                    TARGET
                  </th>
                </tr>
              </thead>
              <tbody className="text-[#115E8D] border-t border-slate-200">
                {machines.sort((a,b) => (a.order||0) - (b.order||0)).map((machine, idx) => {
                  const machineLogs = allLogs.filter(l => l.machineId === machine.id);
                  const displaySessions = sessions.slice(0, 6).reverse();
                  const targetLog = displaySessions.length > 0 ? machineLogs.find(l => l.sessionId === displaySessions[displaySessions.length - 1].id) : null;
                  
                  return (
                    <tr 
                      key={machine.id} 
                      onClick={() => setSelectedInsightMachine(machine)}
                      className="even:bg-[#F9FAFB] odd:bg-white hover:bg-slate-100 hover:brightness-95 cursor-pointer transition-all h-[32px] group border-b border-slate-100 last:border-b-0"
                    >
                      <td className="p-1 pl-4 border-r border-slate-200/60 truncate align-middle relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#115E8D]/0 group-hover:bg-[#115E8D] transition-colors" />
                        <div className="flex flex-col justify-center translate-y-[1px]">
                          <div className="flex items-center gap-1 mb-0.5 max-w-full">
                            <span className="font-bold text-[11px] text-[#115E8D] leading-none truncate">
                              {machine.name}
                            </span>
                            {clientSettings[machine.id!]?.machineNotes?.some(n => n.isImportant) && (
                              <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                            )}
                          </div>
                          <span className="text-[7.5px] font-bold text-[#68717A] opacity-70 tracking-widest truncate leading-none uppercase">
                            {clientSettings[machine.id!]?.settings ? Object.entries(clientSettings[machine.id!].settings).map(([k,v]) => `${k}:${v}`).join(' ') : '---'}
                          </span>
                        </div>
                      </td>
                      {displaySessions.map((s, sIdx) => {
                        const log = machineLogs.find(l => l.sessionId === s.id);
                        const isLast = sIdx === displaySessions.length - 1;
                        const promptIncrease = isLast && log?.repQuality === 3;
                        
                        return (
                          <td key={s.id} className="p-0 border-r border-slate-200/60 align-middle px-1">
                            {log ? (
                              <div className="flex flex-col items-center justify-center leading-none tracking-tighter">
                                <div className="flex items-center gap-0.5 mb-[2px]">
                                  <span className={`font-black text-[11px] sm:text-[12px] ${isLast ? 'text-black' : 'text-slate-700'}`}>{log.weight}</span>
                                  {promptIncrease && <span className="text-[8px] text-[#F06C22] shrink-0 font-black ml-0.5 mt-[1px]">▲</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={`font-extrabold text-[9px] ${isLast ? 'text-[#115E8D]' : 'text-slate-500'}`}>
                                    {log.isStaticHold ? `${log.seconds}s` : log.reps}
                                  </span>
                                  {/* Quality Dot */}
                                  {log.repQuality === 3 && <div className="w-[4px] h-[4px] rounded-full bg-emerald-500" />}
                                  {log.repQuality === 2 && <div className="w-[4px] h-[4px] rounded-full bg-amber-500" />}
                                  {log.repQuality === 1 && <div className="w-[4px] h-[4px] rounded-full bg-red-500" />}
                                  {(log.repQuality === 0 || log.repQuality === undefined) && <div className="w-[3px] h-[3px] rounded-full bg-slate-300" />}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center w-full">
                                <span className="text-[9px] text-slate-300 font-medium">--</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-0 text-center bg-[#F06C22]/[0.03] align-middle px-1 group-hover:bg-[#F06C22]/10 transition-colors">
                        {targetLog ? (
                          <div className="flex flex-col items-center opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                             <div className="flex items-center gap-0.5 mb-[2px]">
                                <span className="font-black text-[11px] sm:text-[12px] text-[#F06C22]">{targetLog.repQuality === 3 ? Number(targetLog.weight) + 5 : targetLog.weight}</span>
                             </div>
                             <span className="font-extrabold text-[9px] text-[#F06C22]/70">
                               {targetLog.isStaticHold ? `${targetLog.seconds}s` : targetLog.reps}
                             </span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-[#F06C22]/40 font-bold uppercase">---</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="routines">
          <div className="grid gap-6 lg:grid-cols-2">
            {['Routine A', 'Routine B'].map((routineName) => {
              const routine = routines.find(r => r.name === routineName);
              const isActiveB = routineName === 'Routine B' && (client?.isRoutineBActive);
              const isDisabled = routineName === 'Routine B' && (!client?.isRoutineBActive);

              if (isDisabled) {
                return (
                  <Card key={routineName} className="rounded-[40px] border-2 border-dashed border-muted flex items-center justify-center p-12 opacity-50">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                        <Settings className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Routine B Inactive</p>
                      <Button variant="outline" size="sm" className="rounded-xl font-bold text-xs" onClick={() => handleToggleRoutineB(true)}>Enable Optional Protocol</Button>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={routineName} className={`rounded-[40px] border-2 shadow-xl overflow-hidden ${routineName === 'Routine B' ? 'border-amber-500/20 bg-amber-500/[0.02]' : ''}`}>
                  <CardHeader className="p-8 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black italic shadow-lg ${routineName === 'Routine B' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-primary text-white shadow-primary/20'}`}>
                          {routineName.split(' ')[1]}
                        </div>
                        <div>
                          <CardTitle className="text-xl font-black uppercase italic tracking-tighter">{routineName}</CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Protocol Definition</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="h-8 rounded-xl font-black uppercase text-[9px] border-dashed"
                           onClick={() => handleApplyTemplate('STANDARD_MALE', routineName)}
                         >Apply Template</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 max-h-[500px] sm:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar py-2">
                      {machines.sort((a,b) => (a.order||0) - (b.order||0)).map(machine => {
                        const routineMachineIds = stagedMachineIds[routineName] || [];
                        const isIn = routineMachineIds.includes(machine.id!);
                        const seqPosition = isIn ? routineMachineIds.indexOf(machine.id!) + 1 : null;

                        return (
                          <button
                            key={machine.id}
                            onClick={() => toggleMachineInRoutine(routineName, machine.id!)}
                            className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all text-left relative group
                              ${isIn 
                                ? 'bg-primary/5 border-primary shadow-md z-10' 
                                : 'bg-muted/10 border-transparent opacity-40 hover:opacity-100 hover:border-muted'}`}
                          >
                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-all
                              ${isIn 
                                ? 'bg-primary text-white shadow-lg' 
                                : 'bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/10'}`}>
                              {isIn ? (
                                <span className="font-black text-[10px] sm:text-xs">{seqPosition}</span>
                              ) : (
                                <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-tight truncate block ${isIn ? 'text-primary' : 'text-muted-foreground'}`}>
                                {machine.name}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                  <CardFooter className="p-8 pt-0 border-t border-border/10 mt-4 flex items-center justify-between">
                     <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{stagedMachineIds[routineName]?.length || 0} Units Assigned</p>
                        {JSON.stringify(stagedMachineIds[routineName]) !== JSON.stringify(routines.find(r => r.name === routineName)?.machineIds || []) && (
                          <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest animate-pulse">Pending Changes</p>
                        )}
                     </div>
                     <div className="flex items-center gap-3">
                        {routineName === 'Routine B' && <Button variant="ghost" size="sm" className="text-red-500 font-bold text-[10px] uppercase" onClick={() => handleToggleRoutineB(false)}>Disable</Button>}
                        <Button 
                          onClick={() => handleSaveRoutineConfig(routineName)}
                          disabled={isSavingRoutine[routineName]}
                          className="h-10 rounded-xl font-black uppercase italic text-[10px] tracking-widest px-6 bg-primary shadow-lg shadow-primary/20"
                        >
                          {isSavingRoutine[routineName] ? 'Saving...' : 'Apply Routine'}
                        </Button>
                     </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="focus">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-[40px] border-2 shadow-xl overflow-hidden">
                <CardHeader className="p-8 border-b bg-muted/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Trainer Focus Matrix</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">Cross-trainer coaching directives</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black bg-primary/10 text-primary border-primary/20">4 P's Logic</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {trainerFocuses.length > 0 ? trainerFocuses.map((focus) => (
                      <div key={focus.id} className="p-8 flex flex-col sm:flex-row gap-6 hover:bg-muted/10 transition-colors">
                        <div className="shrink-0 space-y-2 w-full sm:w-32">
                          <Badge className={`w-full h-8 flex items-center justify-center font-black uppercase tracking-tighter text-[10px] rounded-xl italic
                            ${focus.category === 'Path' ? 'bg-indigo-500' : 
                              focus.category === 'Pace' ? 'bg-emerald-500' : 
                              focus.category === 'Posture' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                            {focus.category}
                          </Badge>
                          <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none">{focus.trainerName}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1 opacity-50">
                              {focus.updatedAt?.toDate?.() ? focus.updatedAt.toDate().toLocaleDateString() : 'Recent'}
                            </p>
                          </div>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="p-6 rounded-3xl bg-muted/20 border border-transparent hover:border-primary/20 transition-all">
                             <p className="text-sm font-bold text-foreground leading-relaxed italic">"{focus.notes}"</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-20 text-center space-y-4 opacity-30">
                        <Activity className="w-12 h-12 mx-auto" />
                        <p className="text-xs font-black uppercase tracking-widest">No trainer focuses set for this client yet.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-[40px] border-2 shadow-xl bg-zinc-900 text-white">
                <CardHeader className="p-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                      <Edit3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase italic tracking-tighter leading-tight">Your Focus</h3>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Define your coaching priority</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Pillar Selection</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Path', 'Pace', 'Posture', 'Purpose'].map((p) => (
                        <button
                          key={p}
                          onClick={() => setFocusForm(f => ({ ...f, category: p as any }))}
                          className={`h-11 rounded-xl font-black uppercase italic text-[10px] transition-all border-2
                            ${focusForm.category === p 
                              ? 'bg-white text-zinc-900 border-white shadow-lg' 
                              : 'bg-transparent border-white/10 text-white/40 hover:border-white/30'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-1">Directive Details</Label>
                    <Textarea 
                      value={focusForm.notes}
                      onChange={e => setFocusForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g., Focus on explosive turnaround on Leg Press while maintaining neutral spine..."
                      className="min-h-[140px] rounded-2xl bg-white/5 border-transparent focus:bg-white/10 transition-all font-bold text-white placeholder:text-white/20 p-4"
                    />
                  </div>

                  <Button 
                    disabled={isSavingFocus || !focusForm.notes}
                    onClick={handleSaveFocus}
                    className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20"
                  >
                    {isSavingFocus ? 'Processing...' : 'Set Focal Point'}
                  </Button>
                </CardContent>
              </Card>

              <div className="p-6 rounded-[32px] bg-muted/50 border-2 border-dashed border-muted flex items-start gap-4">
                 <AlertCircle className="w-5 h-5 text-muted-foreground mt-1" />
                 <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase">
                    Focuses are individual to each trainer. Other trainers will see your focus here and in the pre-session briefing when they start a session with this client.
                 </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-[40px] border-2 shadow-xl overflow-hidden min-h-[400px]">
            <CardHeader className="p-8 border-b">
               <div className="flex justify-between items-center">
                 <div>
                   <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Session Archive</CardTitle>
                   <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Lifetime Workout Logs</CardDescription>
                 </div>
                 <Button 
                   onClick={() => setIsAddingHistorical(true)} 
                   variant="outline" 
                   size="sm" 
                   className="rounded-xl font-black uppercase text-[10px] tracking-widest border-2"
                 >
                   <Plus className="w-4 h-4 mr-2" /> Add Manual History
                 </Button>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y">
                 {sessions.length > 0 ? sessions.map(session => (
                   <div key={session.id} className="p-6 hover:bg-muted/30 transition-colors group flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-muted/50 flex flex-col items-center justify-center border group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                           <span className="text-[10px] font-black uppercase text-muted-foreground leading-none">{session.date.split('-')[1]}/{session.date.split('-')[2]}</span>
                           <span className="text-[8px] font-bold opacity-30 mt-1">{session.date.split('-')[0]}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-black italic uppercase tracking-tight ${session.routineName?.includes('B') ? 'text-amber-600' : 'text-primary'}`}>{session.routineName || 'Free Session'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border-none">Completed</Badge>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">{allLogs.filter(l => l.sessionId === session.id).length} Sets Logged</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditingSession(session)}
                        className="rounded-xl font-black uppercase italic text-[10px] tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Edit Details
                      </Button>
                   </div>
                 )) : (
                   <div className="p-20 text-center space-y-4">
                     <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                     <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No entries found in archive</p>
                   </div>
                 )}
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="rounded-[40px] border-2 shadow-xl overflow-hidden min-h-[400px]">
            <CardHeader className="p-8 border-b">
               <div className="flex justify-between items-center">
                 <div>
                   <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Progress Report Archive</CardTitle>
                   <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">Evaluations, Goals & Outcomes</CardDescription>
                 </div>
                 <Button 
                   onClick={() => setView('progress-report')} 
                   variant="default" 
                   size="sm" 
                   className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 bg-primary"
                 >
                   <Plus className="w-4 h-4 mr-2" /> New Evaluation
                 </Button>
               </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y">
                 {progressReports.length > 0 ? progressReports.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(report => (
                   <div key={report.id} className="p-6 hover:bg-muted/30 transition-colors group flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-muted/50 flex flex-col items-center justify-center border group-hover:bg-primary/5 group-hover:border-primary/20 transition-all font-black uppercase italic text-primary">
                           <span className="text-[10px] leading-none">{report.date.split('-')[1]}/{report.date.split('-')[2]}</span>
                           <span className="text-[8px] opacity-30 mt-1">{report.date.split('-')[0]}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <p className="text-sm font-black italic uppercase tracking-tight text-foreground">Client Progress Evaluation</p>
                             <Badge variant={report.status === 'Finalized' ? 'default' : 'secondary'} className={`px-1.5 py-0 h-4 text-[8px] font-black uppercase border-none ${report.status === 'Finalized' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                               {report.status || 'Finalized'}
                             </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">Trainer: {report.trainerName || 'Team'}</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">Matrix Avg: {report.performanceMatrix ? Math.round(((report.performanceMatrix.posture?.score || 0) + (report.performanceMatrix.pace?.score || 0) + (report.performanceMatrix.path?.score || 0) + (report.performanceMatrix.purpose?.score || 0)) / 4) : 0}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onSelectReport(report.id!)}
                          className="rounded-xl font-black uppercase italic text-[10px] tracking-widest text-primary"
                        >
                          {report.status === 'Draft' ? 'Resume Draft' : 'View / Present'}
                        </Button>
                      </div>
                   </div>
                 )) : (
                   <div className="p-24 text-center space-y-4">
                     <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                     <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No progress reports registered in archive</p>
                     <Button 
                       variant="outline" 
                       className="rounded-xl font-black uppercase text-[10px] tracking-widest border-2 mt-4"
                       onClick={() => setView('progress-report')}
                     >
                       Perform First Evaluation
                     </Button>
                   </div>
                 )}
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing">
           <Card className="rounded-[40px] border-2 shadow-xl overflow-hidden min-h-[400px]">
             <CardHeader className="p-8 border-b bg-muted/20">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Time Spent on Machines</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">Efficiency & Pace Analytics</CardDescription>
                  </div>
                  <div className="flex gap-4">
                    {(() => {
                      const completedSessions = sessions.filter(s => s.status === 'Completed' && s.startTime && s.endTime);
                      if (completedSessions.length === 0) return null;
                      
                      const totalMins = completedSessions.reduce((acc, s) => {
                        return acc + (s.endTime!.toMillis() - s.startTime!.toMillis());
                      }, 0);
                      const avgMins = Math.round((totalMins / completedSessions.length) / 60000);
                      
                      return (
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Avg Session</p>
                          <p className="text-sm font-black italic text-primary">{avgMins}m</p>
                        </div>
                      );
                    })()}
                    <Badge variant="outline" className="text-[9px] font-black bg-primary/10 text-primary border-primary/20">Efficiency</Badge>
                  </div>
                </div>
             </CardHeader>
             <CardContent className="p-0 flex flex-col md:flex-row h-[600px]">
               {/* Sidebar: Session List */}
               <div className="w-full md:w-64 border-r overflow-y-auto bg-muted/5 divide-y">
                 {sessions.filter(s => s.status === 'Completed').map(s => (
                   <button
                     key={s.id}
                     onClick={() => setSelectedTimingSessionId(s.id!)}
                     className={`w-full p-4 text-left hover:bg-white transition-all group ${selectedTimingSessionId === s.id ? 'bg-white shadow-sm ring-1 ring-primary/5' : ''}`}
                   >
                     <p className={`text-[10px] font-black uppercase tracking-tighter ${selectedTimingSessionId === s.id ? 'text-primary' : 'text-muted-foreground'}`}>{s.date}</p>
                     <p className="text-xs font-bold truncate mt-1">{s.routineName || 'Free Session'}</p>
                     {s.startTime && s.endTime && (
                       <p className="text-[9px] font-bold text-muted-foreground/60 uppercase mt-1">
                         {Math.round((s.endTime.toMillis() - s.startTime.toMillis()) / 60000)} mins
                       </p>
                     )}
                   </button>
                 ))}
                 {sessions.filter(s => s.status === 'Completed').length === 0 && (
                   <div className="p-8 text-center opacity-20">
                     <Clock className="w-8 h-8 mx-auto mb-2" />
                     <p className="text-[10px] font-black uppercase tracking-widest leading-tight">No data</p>
                   </div>
                 )}
               </div>

               {/* Main Content: Detailed Analysis */}
               <div className="flex-1 overflow-y-auto p-8">
                 {(() => {
                   const focusSession = sessions.find(s => s.id === selectedTimingSessionId) || sessions[0];
                   
                   if (!focusSession) {
                     return (
                       <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-4">
                         <Activity className="w-16 h-16" />
                         <p className="text-xs font-black uppercase tracking-widest">Select a session for analysis</p>
                       </div>
                     );
                   }

                   const sessionLogs = allLogs
                     .filter(l => l.sessionId === focusSession.id)
                     .sort((a, b) => {
                       const timeA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
                       const timeB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
                       return timeA - timeB;
                     });

                   const startTime = focusSession.startTime?.toMillis?.() || focusSession.createdAt?.toMillis?.();
                   
                   return (
                     <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                       <div className="flex items-center justify-between border-b pb-4">
                         <div>
                           <h4 className="text-lg font-black uppercase italic text-primary">{focusSession.date}</h4>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase">{focusSession.routineName || 'Free Protocol'}</p>
                         </div>
                         {focusSession.startTime && focusSession.endTime && (
                           <div className="text-right">
                             <p className="text-xl font-black italic text-foreground leading-none">
                               {Math.round((focusSession.endTime.toMillis() - focusSession.startTime.toMillis()) / 60000)}m
                             </p>
                             <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Total Duration</p>
                           </div>
                         )}
                       </div>

                       <div className="grid gap-3">
                         {sessionLogs.map((log, idx) => {
                           const machine = machines.find(m => m.id === log.machineId);
                           const logTime = log.updatedAt?.toMillis?.() || log.createdAt?.toMillis?.();
                           const prevTime = idx === 0 ? startTime : (sessionLogs[idx-1].updatedAt?.toMillis?.() || sessionLogs[idx-1].createdAt?.toMillis?.());
                           
                           let durationMs = 0;
                           let durationStr = "---";
                           if (logTime && prevTime) {
                             durationMs = logTime - prevTime;
                             const mins = Math.floor(durationMs / 60000);
                             const secs = Math.floor((durationMs % 60000) / 1000);
                             durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                           }

                           return (
                             <div key={log.id} className="flex items-center justify-between p-6 rounded-3xl bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-white transition-all shadow-sm">
                               <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                                   <Dumbbell className="w-5 h-5 text-primary" />
                                 </div>
                                 <div>
                                   <p className="text-sm font-black uppercase tracking-tight">{machine?.name || 'Unknown'}</p>
                                   <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                        {idx === 0 ? 'Since Start' : 'From Prev Unit'}
                                      </p>
                                   </div>
                                 </div>
                               </div>
                               <div className="text-right">
                                 <p className="text-lg font-black italic text-primary leading-none">{durationStr}</p>
                               </div>
                             </div>
                           );
                         })}

                         {sessionLogs.length === 0 && (
                           <div className="p-12 text-center opacity-30">
                             <Clock className="w-10 h-10 mx-auto mb-3" />
                             <p className="text-xs font-black uppercase tracking-widest">No timing logs for this session</p>
                           </div>
                         )}
                       </div>

                       {/* Machine Averages Summary */}
                       <div className="pt-8 border-t">
                          <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Historical Machine Averages</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {machines.map(m => {
                              const machineLogs = allLogs.filter(l => l.machineId === m.id);
                              if (machineLogs.length < 2) return null;

                              let totalDiffMs = 0;
                              let count = 0;

                              machineLogs.forEach(l => {
                                const s = sessions.find(sess => sess.id === l.sessionId);
                                if (!s) return;
                                
                                const sLogs = allLogs.filter(log => log.sessionId === s.id).sort((a,b) => {
                                  return (a.updatedAt?.toMillis() || a.createdAt?.toMillis()) - (b.updatedAt?.toMillis() || b.createdAt?.toMillis());
                                });
                                
                                const idx = sLogs.findIndex(log => log.id === l.id);
                                if (idx === -1) return;

                                const lTime = l.updatedAt?.toMillis() || l.createdAt?.toMillis();
                                const pTime = idx === 0 
                                  ? (s.startTime?.toMillis() || s.createdAt?.toMillis()) 
                                  : (sLogs[idx-1].updatedAt?.toMillis() || sLogs[idx-1].createdAt?.toMillis());

                                if (lTime && pTime) {
                                  totalDiffMs += (lTime - pTime);
                                  count++;
                                }
                              });

                              if (count === 0) return null;
                              const avgMins = Math.floor(totalDiffMs / count / 60000);
                              const avgSecs = Math.round((totalDiffMs / count % 60000) / 1000);

                              return (
                                <div key={m.id} className="p-4 rounded-2xl bg-muted/10 border border-muted flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-muted-foreground truncate mr-2">{m.name}</span>
                                  <span className="text-[10px] font-black italic text-foreground whitespace-nowrap">{avgMins}m {avgSecs}s</span>
                                </div>
                              );
                            })}
                          </div>
                       </div>
                     </div>
                   );
                 })()}
               </div>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="details">
          <div className="grid gap-6 lg:grid-cols-3">
             <div className="lg:col-span-2 space-y-6">
                <Card className="rounded-[40px] border-2 shadow-xl">
                   <CardHeader className="p-8 border-b">
                      <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Client Information</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Identity & Vital Statistics</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8 grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">First Name</Label>
                        <Input value={infoForm.firstName} onChange={e => setInfoForm(f => ({ ...f, firstName: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Last Name</Label>
                        <Input value={infoForm.lastName} onChange={e => setInfoForm(f => ({ ...f, lastName: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                        <Input value={infoForm.email} onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                        <Input value={infoForm.phone} onChange={e => setInfoForm(f => ({ ...f, phone: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Height</Label>
                        <Input value={infoForm.height} onChange={e => setInfoForm(f => ({ ...f, height: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Current Weight (lbs)</Label>
                        <Input value={infoForm.weight} onChange={e => setInfoForm(f => ({ ...f, weight: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                      </div>
                   </CardContent>
                </Card>

                <Card className="rounded-[40px] border-2 shadow-xl">
                    <CardHeader className="p-8 border-b">
                      <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Safety & Records</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Medical Notes & Emergencies</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Global Coaching Notes</Label>
                        <Textarea 
                          value={infoForm.globalNotes} 
                          onChange={e => setInfoForm(f => ({ ...f, globalNotes: e.target.value }))} 
                          className="min-h-[120px] rounded-3xl font-bold p-6 bg-muted/20 border-transparent focus:bg-background focus:border-primary transition-all" 
                          placeholder="Document medical history, limitations, or special considerations..."
                        />
                      </div>
                      <div className="grid gap-6 sm:grid-cols-2 pt-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Emergency Contact Name</Label>
                          <Input value={infoForm.emergencyContactName} onChange={e => setInfoForm(f => ({ ...f, emergencyContactName: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Emergency Contact Phone</Label>
                          <Input value={infoForm.emergencyContactPhone} onChange={e => setInfoForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} className="h-12 rounded-2xl font-black px-4" />
                        </div>
                      </div>
                    </CardContent>
                </Card>
             </div>

             <div className="space-y-6">
                <Card className="rounded-[40px] border-2 shadow-sm bg-neutral-900 text-white">
                   <CardHeader className="p-8">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">System State</h3>
                   </CardHeader>
                   <CardContent className="px-8 pb-8 space-y-6">
                      <div className="flex items-center justify-between">
                         <Label className="text-[10px] font-black uppercase tracking-widest">Active Client</Label>
                         <Switch checked={infoForm.isActive} onCheckedChange={v => setInfoForm(f => ({ ...f, isActive: v }))} className="data-[state=checked]:bg-emerald-500" />
                      </div>
                      <div className="flex items-center justify-between">
                         <Label className="text-[10px] font-black uppercase tracking-widest">Enable Routine B</Label>
                         <Switch checked={infoForm.isRoutineBActive} onCheckedChange={v => setInfoForm(f => ({ ...f, isRoutineBActive: v }))} className="data-[state=checked]:bg-amber-500" />
                      </div>
                      <div className="pt-6 border-t border-white/10 mt-6 pb-2">
                         <Button 
                           variant="outline"
                           className="w-full h-12 rounded-2xl border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400 font-black uppercase tracking-widest text-[10px] transition-all bg-transparent"
                           onClick={() => setIsDeleting(true)}
                         >
                           <Trash2 className="w-4 h-4 mr-2" />
                           Delete Client Account
                         </Button>
                      </div>
                      <div className="pt-2">
                         <Button 
                           disabled={isSavingInfo}
                           onClick={handleSaveInfo}
                           className="w-full h-16 rounded-3xl bg-action hover:bg-action/90 text-action-foreground font-black uppercase italic text-xs tracking-widest shadow-xl shadow-action/20"
                         >
                           {isSavingInfo ? 'Processing...' : 'Save All Changes'}
                         </Button>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </div>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {showFullChart && clientId && (
          <WorkoutChartGrid
            clientId={clientId}
            clients={clients}
            machines={machines}
            onBack={() => setShowFullChart(false)}
          />
        )}
      </AnimatePresence>

      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent className="rounded-[40px] border-none shadow-2xl p-0 overflow-hidden max-w-sm">
          <div className="bg-red-600 p-8 flex flex-col items-center gap-4 text-white">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Confirm Deletion</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-80">This action is permanent</p>
            </div>
          </div>
          <div className="p-8 space-y-6 text-center bg-white">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Are you absolutely sure you want to delete <span className="font-black text-foreground"> {client.firstName} {client.lastName}'s</span> profile? All historical session data and machine settings will be lost.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                variant="destructive" 
                className="h-14 rounded-2xl font-black uppercase italic tracking-widest text-xs shadow-xl shadow-red-200"
                onClick={() => {
                  if (client.id) onDelete(client.id);
                  setIsDeleting(false);
                }}
              >
                Delete Everything
              </Button>
              <Button 
                variant="ghost" 
                className="h-12 rounded-2xl font-bold text-muted-foreground"
                onClick={() => setIsDeleting(false)}
              >
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual session creation */}
      <Dialog open={isAddingHistorical} onOpenChange={setIsAddingHistorical}>
        <DialogContent className="rounded-[40px] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">New Historical Entry</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Select a date and protocol to backfill history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Date</Label>
              <Input 
                type="date" 
                value={historicalSessionDate} 
                onChange={(e) => setHistoricalSessionDate(e.target.value)} 
                className="h-14 rounded-2xl font-black bg-muted/20 border-none px-6"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Protocol</Label>
              <div className="flex gap-2">
                {['A', 'B', 'Other'].map(r => (
                  <Button
                    key={r}
                    variant={historicalRoutineName === r ? 'default' : 'outline'}
                    onClick={() => setHistoricalRoutineName(r)}
                    className="flex-1 rounded-xl font-black uppercase italic h-12"
                  >
                    Routine {r}
                  </Button>
                ))}
              </div>
            </div>
            <Button 
              disabled={isSavingHistory}
              onClick={handleCreateHistoricalSession}
              className="w-full h-16 rounded-3xl bg-primary hover:bg-primary/90 font-black uppercase italic text-xs tracking-widest shadow-xl shadow-primary/20"
            >
              {isSavingHistory ? 'Creating...' : 'Create & Add Logs'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Logger / Editor */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="rounded-[40px] p-0 border-none shadow-2xl max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div className="p-8 border-b bg-muted/20 shrink-0">
             <div className="flex justify-between items-center">
               <div>
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter">Edit Session Logs</h2>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{editingSession?.date} • {editingSession?.routineName}</p>
               </div>
               <Badge className="bg-emerald-500/10 text-emerald-500 font-black uppercase tracking-widest border-none">Historical Entry</Badge>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
             {editingLogs.length > 0 ? (
               <div className="space-y-4">
                 {editingLogs.map((log) => {
                   const machine = machines.find(m => m.id === log.machineId);
                   return (
                     <div key={log.id} className="flex items-center gap-4 p-4 rounded-3xl bg-muted/10 border border-border/50 group">
                        <div className="shrink-0 w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                           <Dumbbell className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black uppercase tracking-tight truncate">{machine?.name || 'Unknown Unit'}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">ID: {log.id?.slice(-4)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block text-center">Weight</span>
                              <Input 
                                value={log.weight} 
                                type="number" 
                                pattern="\d*"
								inputMode="numeric"
                                onChange={(e) => handleUpdateLog(log.id!, { weight: e.target.value })}
                                className="w-20 h-10 rounded-xl text-center font-black bg-white border-2 border-primary/10 focus:border-primary transition-all" 
                              />
                           </div>
                           <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block text-center">{log.isStaticHold ? 'Seconds' : 'Reps'}</span>
                              <Input 
                                value={log.isStaticHold ? (log.seconds || '0') : (log.reps || '0')} 
                                type="number" 
                                inputMode="numeric"
                                onChange={(e) => {
                                  if (log.isStaticHold) {
                                    handleUpdateLog(log.id!, { seconds: e.target.value });
                                  } else {
                                    handleUpdateLog(log.id!, { reps: e.target.value });
                                  }
                                }}
                                className="w-20 h-10 rounded-xl text-center font-black bg-white border-2 border-primary/10 focus:border-primary transition-all" 
                              />
                           </div>
                           <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block text-center">Quality</span>
                              <div className="flex gap-1">
                                {[1, 2, 3].map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => handleUpdateLog(log.id!, { repQuality: v })}
                                    className={`w-6 h-6 rounded-full transition-all ${
                                      log.repQuality === v 
                                        ? (v === 1 ? 'bg-red-500 ring-2 ring-red-200' : v === 2 ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-emerald-500 ring-2 ring-emerald-200') 
                                        : 'bg-muted hover:bg-muted-foreground/20'
                                    }`}
                                  />
                                ))}
                              </div>
                           </div>
                        </div>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="text-center py-10 opacity-30">
                 <History className="w-12 h-12 mx-auto mb-2" />
                 <p className="text-xs font-black uppercase tracking-widest">No logs recorded yet.</p>
               </div>
             )}

             <div className="pt-4 space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add Unit to this session</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                   {machines.filter(m => !editingLogs.find(l => l.machineId === m.id)).map(m => (
                     <Button 
                       key={m.id} 
                       variant="outline" 
                       size="sm" 
                       onClick={() => handleAddLogToSession(m.id!)}
                       className="rounded-xl h-12 text-[9px] font-black uppercase px-3 shadow-none border-dashed hover:border-primary hover:text-primary transition-all"
                     >
                       <Plus className="w-3 h-3 mr-1" /> {m.name}
                     </Button>
                   ))}
                </div>
             </div>
          </div>
          <div className="p-8 border-t shrink-0">
             <Button onClick={() => setEditingSession(null)} className="w-full h-14 rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-primary/20">
               Done Editing
             </Button>
          </div>
        </DialogContent>
      </Dialog>
      <MachineInsightsModal 
        client={client} 
        machine={selectedInsightMachine} 
        onClose={() => setSelectedInsightMachine(null)} 
      />
    </motion.div>
  );
}
