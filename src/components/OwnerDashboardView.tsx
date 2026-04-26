
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Dumbbell, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  UserCircle, 
  Calendar,
  Search,
  ChevronRight,
  ChevronDown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import axios from 'axios';
import { Client, Trainer, Machine, WorkoutSession, ExerciseLog } from '../types';

export function OwnerDashboardView({ 
  clients, 
  trainers, 
  machines, 
  sessions,
  newClientsCount,
  onShowNewClients
}: { 
  clients: Client[], 
  trainers: Trainer[], 
  machines: Machine[], 
  sessions: WorkoutSession[],
  newClientsCount?: number,
  onShowNewClients?: () => void
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);

  // Fetch all exercise logs for analysis (limited to last 1000 for performance)
  useEffect(() => {
    const q = query(collection(db, 'exerciseLogs'), orderBy('createdAt', 'desc'), limit(1000));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseLog));
      setExerciseLogs(logs);
    });
    return () => unsubscribe();
  }, []);

  const getClientPerformance = (clientId: string) => {
    const clientSessions = sessions.filter(s => s.clientId === clientId && s.status === 'Completed');
    const clientLogs = exerciseLogs.filter(log => clientSessions.some(s => s.id === log.sessionId));
    
    const machineProgress: any[] = [];
    machines.forEach(machine => {
      const logsForMachine = clientLogs.filter(l => l.machineId === machine.id).sort((a, b) => a.createdAt?.toDate().getTime() - b.createdAt?.toDate().getTime());
      if (logsForMachine.length >= 2) {
        const first = logsForMachine[0];
        const last = logsForMachine[logsForMachine.length - 1];
        const isStaticHoldFirst = first.isStaticHold;
        const isStaticHoldLast = last.isStaticHold;

        const valFirst = isStaticHoldFirst ? parseFloat(first.seconds || '0') : parseFloat(first.reps || '0');
        const valLast = isStaticHoldLast ? parseFloat(last.seconds || '0') : parseFloat(last.reps || '0');
        
        const weightDiff = parseFloat(last.weight || '0') - parseFloat(first.weight || '0');
        const repsDiff = valLast - valFirst; // Note: Mixing seconds and reps conceptually is a bit weird, but we only have one trend metric for now.
        
        if (weightDiff !== 0 || repsDiff !== 0) {
          machineProgress.push({
            name: machine.name,
            weightDiff,
            repsDiff,
            currentWeight: last.weight,
            currentReps: valLast,
            isStaticHold: isStaticHoldLast
          });
        }
      }
    });

    return {
      totalSessions: clientSessions.length,
      progress: machineProgress
    };
  };

  const filteredClients = clients.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-4 pb-8 w-full max-w-full overflow-x-hidden px-4 sm:px-2"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black tracking-tight leading-tight">Franchise Analytics</h2>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">High-level capacity & performance metrics.</p>
        </div>
        
        {newClientsCount !== undefined && onShowNewClients && (
          <div 
            className="bg-primary/5 px-4 py-2 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-primary/10 transition-all border border-primary/20 group h-12"
            onClick={onShowNewClients}
          >
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-primary/60 uppercase leading-none tracking-tighter">New This Month</span>
              <span className="text-sm font-black text-primary leading-tight">{newClientsCount} Clients</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="rounded-3xl border-2 shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary">Active Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black">{clients.filter(c => c.isActive).length}</p>
              <p className="text-sm font-bold text-muted-foreground mb-1">Active Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Equipment Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black">{machines.length}</p>
              <p className="text-sm font-bold text-muted-foreground mb-1">Configured Units</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">System Velocity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black">{sessions.filter(s => s.status === 'Completed').length}</p>
              <p className="text-sm font-bold text-muted-foreground mb-1">Completed Sessions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px] border-2 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-black leading-tight">Client Performance Audit</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase">Strength gains and consistency metrics.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input 
                placeholder="Find client..." 
                className="pl-9 h-9 rounded-xl text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredClients.map(client => {
              const performance = getClientPerformance(client.id!);
              const totalGains = performance.progress.filter(p => p.weightDiff > 0).length;
              const isSelected = selectedClientId === client.id;

              return (
                <div key={client.id} className="group">
                  <div 
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-muted/50' : ''}`}
                    onClick={() => setSelectedClientId(isSelected ? null : client.id!)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {client.firstName[0]}{client.lastName[0]}
                      </div>
                      <div>
                        <p className="font-black text-sm">{client.firstName} {client.lastName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">{performance.totalSessions} sessions completed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] uppercase font-black text-muted-foreground">Strength Units</p>
                        <div className="flex items-center gap-1 text-emerald-600 font-black text-sm justify-end">
                          <TrendingUp className="w-3 h-3" />
                          <span>{totalGains} Increase</span>
                        </div>
                      </div>
                      {isSelected ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t bg-muted/20"
                      >
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {performance.progress.map((prog, i) => (
                              <div key={i} className="bg-card p-3 rounded-2xl border shadow-sm flex flex-col justify-between">
                                <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">{prog.name}</p>
                                <div className="flex items-end justify-between">
                                  <div>
                                    <p className="text-lg font-black">{prog.currentWeight} lbs</p>
                                    <p className="text-[10px] text-muted-foreground font-bold">{prog.currentReps} {prog.isStaticHold ? 'Sec' : 'Reps'}</p>
                                  </div>
                                  <div className={`flex flex-col items-end ${prog.weightDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    <div className="flex items-center gap-0.5 text-xs font-black">
                                      {prog.weightDiff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                      {Math.abs(prog.weightDiff)} lbs
                                    </div>
                                    <p className="text-[9px] font-bold">LIFETIME DELTA</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {performance.progress.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                              <p className="text-sm font-medium">Insufficient historical data to calculate trends.</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[32px] border-2 shadow-sm overflow-hidden">
        <CardHeader className="bg-primary/5 border-b py-3 px-4">
          <CardTitle className="text-lg font-black leading-tight">Machine Load Analysis</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase">Poundage and volume processed (last 1000 logs).</CardDescription>
        </CardHeader>
        <CardContent className="p-3">
           <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
             {machines.map(machine => {
               const machineLogs = exerciseLogs.filter(l => l.machineId === machine.id);
               const totalWeight = machineLogs.reduce((acc, current) => acc + (parseFloat(current.weight || '0') * parseFloat(current.reps || '0')), 0);
               return (
                 <div key={machine.id} className="p-3 border rounded-2xl flex flex-col justify-between h-20 bg-muted/10">
                   <p className="text-[9px] font-black uppercase text-muted-foreground truncate">{machine.name}</p>
                   <div>
                     <p className="text-base font-black leading-none">{Math.round(totalWeight / 1000)}k <span className="text-[10px] font-normal italic">lbs</span></p>
                     <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">Total Volume</p>
                   </div>
                 </div>
               );
             })}
           </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
