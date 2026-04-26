
import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Dumbbell, 
  Settings,
  X,
  Plus,
  ArrowRight,
  TrendingUp,
  History,
  Activity,
  UserCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  setDoc,
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Client, Machine, WorkoutSession, ExerciseLog, ClientMachineSetting } from '../types';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';

interface WorkoutChartGridProps {
  clientId: string;
  clients: Client[];
  machines: Machine[];
  onBack: () => void;
}

export function WorkoutChartGrid({ 
  clientId, 
  clients, 
  machines, 
  onBack 
}: WorkoutChartGridProps) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [clientSettings, setClientSettings] = useState<ClientMachineSetting[]>([]);
  const [editingSettings, setEditingSettings] = useState<{machineId: string, settings: Record<string, string>} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const client = clients.find(c => c.id === clientId);
  if (!client) return null;

  // Real-time Data Fetching for this specific client
  useEffect(() => {
    if (!clientId) return;

    // Last 11 Sessions
    const sessionsQ = query(
      collection(db, 'sessions'),
      where('clientId', '==', clientId),
      where('status', '==', 'Completed'),
      orderBy('date', 'desc'),
      limit(11)
    );

    const unsubscribeSessions = onSnapshot(sessionsQ, (snap) => {
      const sessData = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutSession));
      // Reverse to chronological for the grid (Left -> Right: Oldest -> Newest)
      setSessions(sessData.reverse());
    });

    // Client Settings (Master Reference)
    const settingsQ = query(
      collection(db, 'clientMachineSettings'),
      where('clientId', '==', clientId)
    );

    const unsubscribeSettings = onSnapshot(settingsQ, (snap) => {
      setClientSettings(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientMachineSetting)));
    });

    return () => {
      unsubscribeSessions();
      unsubscribeSettings();
    };
  }, [clientId]);

  // Fetch logs for the visible sessions
  useEffect(() => {
    if (sessions.length === 0) return;

    const sessionIds = sessions.map(s => s.id!);
    // Firestore "in" query limited to 10 elements usually, but for 11 we might need to batch or just filter client-side
    // For performance and quota, we'll fetch all client logs from last 60 days
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const logsQ = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', clientId),
      where('createdAt', '>=', sixtyDaysAgo)
    );

    const unsubscribeLogs = onSnapshot(logsQ, (snap) => {
      const logsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExerciseLog));
      setExerciseLogs(logsData);
    });

    return () => unsubscribeLogs();
  }, [clientId, sessions]);

  const handleUpdateSettings = async () => {
    if (!editingSettings || !clientId) return;
    setIsSaving(true);
    try {
      const settingId = `${clientId}_${editingSettings.machineId}`;
      await setDoc(doc(db, 'clientMachineSettings', settingId), {
        clientId,
        machineId: editingSettings.machineId,
        settings: editingSettings.settings,
        updatedBy: auth.currentUser?.email || 'Unknown',
        updatedAt: serverTimestamp()
      }, { merge: true });
      setEditingSettings(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clientMachineSettings/${editingSettings.machineId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getLog = (machineId: string, sessionId: string) => {
    return exerciseLogs.find(l => l.machineId === machineId && l.sessionId === sessionId);
  };

  const getSetting = (machineId: string) => {
    return clientSettings.find(s => s.machineId === machineId)?.settings || {};
  };

  const sortedMachines = [...machines].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden font-sans">
      {/* High-Impact Header - Optimized for iPad Contrast */}
      <header className="h-20 bg-zinc-950 px-6 sm:px-8 flex items-center justify-between shrink-0 border-b-4 border-rose-600">
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-xl h-10 w-10 sm:h-12 sm:w-12 bg-zinc-900 border-2 border-zinc-800 text-white hover:bg-zinc-800 transition-all active:scale-95"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </Button>
          
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter uppercase text-white leading-none">
              {client.firstName} {client.lastName}
            </h1>
            <div className="flex items-center gap-3">
              <Badge className="bg-rose-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2 h-4 border-none">
                Performance Matrix
              </Badge>
              <span className="hidden sm:inline text-zinc-500 font-black uppercase text-[8px] tracking-widest italic leading-none">Imagine Strength • Precision Tuning</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
           <div className="text-right">
              <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest leading-none mb-1">Historical Span</p>
              <p className="text-lg sm:text-2xl font-black italic text-white tracking-tighter leading-none">Last 11 Sessions</p>
           </div>
           <Activity className="w-8 h-8 text-rose-500 opacity-50" />
        </div>
      </header>

      {/* Grid Container with Sticky logic */}
      <div className="flex-1 overflow-auto relative bg-[#fcfcfc]">
        <table className="border-collapse table-fixed min-w-max w-full">
          <thead>
            <tr className="sticky top-0 z-50">
              {/* Sticky Corner Corner */}
              <th className="sticky left-0 z-50 w-[240px] sm:w-[320px] h-24 bg-zinc-950 border-r-4 border-b-2 border-rose-600/20 px-6 sm:px-8 text-left">
                 <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-rose-500 italic">Equipment Matrix</span>
                    <h3 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-white">Machine & Setup</h3>
                 </div>
              </th>

              {/* Session Column Headers */}
              {sessions.map((session, idx) => (
                <th 
                  key={session.id || idx} 
                  className="w-[120px] sm:w-[150px] h-24 bg-zinc-900 border-r border-b border-zinc-800 px-3 text-center group transition-colors hover:bg-zinc-800"
                >
                  <div className="space-y-1.5">
                     <Badge variant="outline" className="border-rose-600/30 text-rose-500 font-black italic text-[9px] px-2 h-4 rounded-md">
                        S#{session.sessionNumber || sessions.length - idx}
                     </Badge>
                     <div className="space-y-0.5">
                        <p className="text-sm sm:text-base font-black tracking-tighter text-white tabular-nums">
                          {new Date(session.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                           {session.trainerInitials}
                        </p>
                     </div>
                  </div>
                </th>
              ))}
              {/* Fillers to ensure 11 columns if less exist */}
              {Array.from({ length: Math.max(0, 11 - sessions.length) }).map((_, i) => (
                <th key={`empty-h-${i}`} className="w-[120px] sm:w-[150px] h-24 bg-zinc-950/50 border-r border-b border-zinc-800 opacity-20" />
              ))}
            </tr>
          </thead>

          <tbody className="divide-y-2 divide-zinc-200">
            {sortedMachines.map((machine) => {
              const currentSettings = getSetting(machine.id!);
              
              return (
                <tr key={machine.id} className="group hover:bg-zinc-50 transition-colors">
                  {/* Sticky Machine Name & Settings (The Master Reference) */}
                  <th className="sticky left-0 z-30 w-[240px] sm:w-[320px] bg-white border-r-4 border-zinc-100 px-6 sm:px-8 py-6 text-left group-hover:bg-zinc-50 transition-colors shadow-[10px_0_30px_rgba(0,0,0,0.02)]">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0 shadow-lg shadow-zinc-200">
                            <Dumbbell className="w-4 h-4 text-white" />
                         </div>
                         <h4 className="text-base sm:text-lg font-black italic uppercase tracking-tighter text-zinc-900 leading-tight truncate">
                            {machine.name}
                         </h4>
                      </div>

                      {/* Settings Component - TAP TO EDIT */}
                      <div 
                        onClick={() => setEditingSettings({ machineId: machine.id!, settings: { ...currentSettings } })}
                        className="grid grid-cols-2 gap-3 bg-zinc-50 p-4 rounded-2xl border-2 border-zinc-100 hover:border-rose-600/40 hover:bg-white transition-all cursor-pointer group/settings"
                      >
                         {machine.settingOptions?.map(opt => (
                           <div key={opt} className="flex flex-col">
                              <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-zinc-400 group-hover/settings:text-rose-500 transition-colors">
                                {opt}
                              </span>
                              <span className="text-sm sm:text-base font-black text-zinc-900 tabular-nums leading-tight">
                                {currentSettings[opt] || '---'}
                              </span>
                           </div>
                         ))}
                         {(!machine.settingOptions || machine.settingOptions.length === 0) && (
                            <p className="col-span-2 text-[8px] font-black uppercase text-zinc-300 italic">No settings</p>
                         )}
                      </div>
                    </div>
                  </th>

                  {/* Weight / Reps History Cells */}
                  {sessions.map((session) => {
                    const log = getLog(machine.id!, session.id!);
                    return (
                      <td key={session.id} className="w-[120px] sm:w-[150px] px-4 py-8 border-r border-zinc-100 text-center">
                         {log ? (
                           <div className="space-y-2.5">
                              <div className="flex flex-col items-center">
                                 <span className="text-xl sm:text-2xl font-black italic tracking-tighter text-zinc-950 tabular-nums leading-none">
                                   {log.weight}
                                 </span>
                                 <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest mt-0.5">LBS</span>
                              </div>
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-950 rounded-xl shadow-md border border-zinc-800">
                                 <span className={`text-xs sm:text-sm font-black tabular-nums ${
                                    log.repQuality === 3 ? 'text-emerald-400' : 
                                    log.repQuality === 2 ? 'text-amber-400' : 
                                    log.repQuality === 1 ? 'text-red-400' : 
                                    'text-white'
                                 }`}>{log.isStaticHold ? (log.seconds || '--') : (log.reps || '--')}</span>
                                 <span className="text-[8px] font-black uppercase text-zinc-500 italic tracking-tighter">{log.isStaticHold ? 'S' : 'R'}</span>
                              </div>
                           </div>
                         ) : (
                           <div className="flex items-center justify-center opacity-5">
                              <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                           </div>
                         )}
                      </td>
                    );
                  })}
                  {/* Fillers for empty sessions */}
                  {Array.from({ length: Math.max(0, 11 - sessions.length) }).map((_, i) => (
                    <td key={`empty-c-${i}`} className="w-[120px] sm:w-[150px] bg-zinc-950/25 opacity-10" />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER / STATUS BAR */}
      <footer className="h-16 bg-white border-t-2 border-zinc-100 px-8 flex items-center justify-between text-zinc-400 text-[10px] font-black uppercase tracking-widest shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-rose-600" />
               <span>Live Studio Sync Active</span>
            </div>
            <div className="w-px h-6 bg-zinc-100" />
            <span>iPad Native Layout Optimized</span>
         </div>
         <p>© 2026 Imagine Strength Analytics</p>
      </footer>

      {/* SETTINGS EDITOR DIALOG */}
      <Dialog open={!!editingSettings} onOpenChange={() => setEditingSettings(null)}>
        <DialogContent className="max-w-2xl rounded-[40px] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-zinc-950 p-10 flex items-center justify-between text-white">
             <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter truncate max-w-[400px]">
                   {sortedMachines.find(m => m.id === editingSettings?.machineId)?.name}
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mt-2">Physical Configuration Mode</p>
             </div>
             <Settings className="w-10 h-10 text-white/20 animate-spin-slow" />
          </div>

          <div className="p-12 space-y-10 bg-white">
             <div className="grid grid-cols-2 gap-8">
                {editingSettings && sortedMachines.find(m => m.id === editingSettings.machineId)?.settingOptions?.map(opt => (
                   <div key={opt} className="space-y-4">
                      <label className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">{opt}</label>
                      <Input 
                        value={editingSettings.settings[opt] || ''}
                        onChange={(e) => setEditingSettings({
                          ...editingSettings,
                          settings: { ...editingSettings.settings, [opt]: e.target.value }
                        })}
                        placeholder="--"
                        className="h-20 rounded-3xl border-2 border-zinc-100 focus:border-rose-600 focus:ring-rose-600 text-2xl font-black text-zinc-900 px-6 tabular-nums transition-all shadow-sm"
                      />
                   </div>
                ))}
             </div>

             <div className="flex items-center gap-4 pt-6">
                <Button 
                  disabled={isSaving}
                  onClick={handleUpdateSettings}
                  className="flex-1 h-24 rounded-[32px] bg-zinc-950 text-white font-black uppercase italic tracking-widest text-lg shadow-2xl active:scale-95 transition-all hover:bg-rose-600"
                >
                  {isSaving ? 'Synchronizing...' : 'Update Master Settings'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingSettings(null)}
                  className="h-24 px-10 rounded-[32px] border-2 font-black uppercase text-xs"
                >
                  Discard
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
