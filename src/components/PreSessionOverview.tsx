
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  History, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  ChevronRight,
  Activity,
  Dumbbell,
  Settings2,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Client, Machine, ExerciseLog, Routine, WorkoutSession, TrainerFocus, SessionNote } from '../types';

interface PreSessionOverviewProps {
  client: Client;
  targetRoutine: Routine | null;
  lastSession: WorkoutSession | null;
  historicalLifts: Record<string, { last: ExerciseLog; previous: ExerciseLog | null }>;
  onStart: (routineType: 'A' | 'B' | 'Free', customMachines?: string[], note?: string) => void;
  onCancel: () => void;
  routines: Routine[];
  trainerFocuses: TrainerFocus[];
  sessionNotes: SessionNote[];
}

export function PreSessionOverview({ 
  client, 
  targetRoutine, 
  lastSession, 
  historicalLifts, 
  onStart,
  onCancel,
  machines,
  routines,
  trainerFocuses,
  sessionNotes
}: PreSessionOverviewProps & { machines: Machine[] }) {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [selectedRoutineType, setSelectedRoutineType] = useState<'A' | 'B' | 'Free' | 'Create_B'>('A');
  const [adjustedMachineIds, setAdjustedMachineIds] = useState<string[]>([]);
  const [adjustmentNote, setAdjustmentNote] = useState('');

  const routineA = routines.find(r => r.name.includes('Routine A'));
  const routineB = routines.find(r => r.name.includes('Routine B'));
  
  React.useEffect(() => {
    let type: 'A' | 'B' | 'Free' | 'Create_B' = 'Free';
    if (targetRoutine) {
      if (targetRoutine.name.includes('Routine A')) type = 'A';
      else if (targetRoutine.name.includes('Routine B')) type = 'B';
    } else if (routineA) {
      type = 'A';
    }
    
    // If target is B, but B doesn't exist, we must be creating B
    if (type === 'B' && !routineB) {
      type = 'Create_B';
    }

    setSelectedRoutineType(type);
    if (type === 'Create_B' || type === 'Free') setAdjustedMachineIds([]);
    else setAdjustedMachineIds(targetRoutine?.machineIds || routineA?.machineIds || []);
  }, [targetRoutine, routineA, routineB]);

  const handleStart = () => {
    if (selectedRoutineType === 'Create_B') {
      onStart('B', adjustedMachineIds, adjustmentNote);
    } else {
      onStart(selectedRoutineType, adjustedMachineIds, adjustmentNote);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 h-full overflow-y-auto bg-muted/30 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter">Pre-Session Briefing</h2>
            <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest">{client.firstName} {client.lastName} • Audit Mode</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-6">
            Cancel
          </Button>
          <Button 
            onClick={handleStart}
            className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 bg-primary shadow-lg shadow-primary/20 gap-2 h-11"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isAdjusting ? 'Start Adjusted Session' : 'Start Session'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Focus & Strategy */}
        <div className="lg:col-span-4 space-y-6">
          {/* Trainer Focus Section */}
          <Card className="rounded-[32px] border-2 shadow-sm border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Trainer Directives</span>
              <CardTitle className="text-xl font-black leading-none">Coaching Focus</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {trainerFocuses.length > 0 ? (
                <div className="space-y-3">
                  {trainerFocuses.slice(0, 3).map((focus) => (
                    <div key={focus.id} className="p-3 rounded-2xl bg-white border border-primary/10 space-y-1 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-muted-foreground">{focus.trainerName}</span>
                        <Badge variant="outline" className={`text-[8px] font-black px-1.5 h-4 border-none
                          ${focus.category === 'Path' ? 'bg-indigo-100 text-indigo-700' : 
                            focus.category === 'Pace' ? 'bg-emerald-100 text-emerald-700' : 
                            focus.category === 'Posture' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                          {focus.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-bold italic leading-tight text-foreground">"{focus.notes}"</p>
                    </div>
                  ))}
                  {trainerFocuses.length > 3 && (
                    <p className="text-[9px] font-bold text-center text-muted-foreground uppercase opacity-50">+{trainerFocuses.length - 3} more trainer focuses</p>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground/30 border-2 border-dashed rounded-2xl">
                   <p className="text-[10px] font-black uppercase">No specific focus set</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-2 shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Sequence Intelligence</span>
              <CardTitle className="text-xl font-black leading-none">Today's Routine</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-3">
                {/* Option 1: A Routine */}
                <button 
                  onClick={() => { setSelectedRoutineType('A'); setAdjustedMachineIds(routineA?.machineIds || []); }}
                  className={`relative flex flex-col text-left p-4 rounded-2xl border-2 transition-all ${
                    selectedRoutineType === 'A' ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20' : 'border-border/50 hover:border-primary/30 hover:bg-muted/50'
                  }`}
                >
                   <div className="flex justify-between items-center w-full">
                     <span className={`font-black italic uppercase tracking-tight text-lg ${selectedRoutineType === 'A' ? 'text-primary' : 'text-foreground'}`}>A Routine</span>
                     {lastSession?.routineId === routineA?.id && (
                       <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-primary/50 text-primary">Last: {lastSession.date}</Badge>
                     )}
                   </div>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed mt-2 line-clamp-2">
                     {routineA ? routineA.machineIds.map(id => machines.find(m => m.id === id)?.name || id).join(' • ') : 'No machines assigned'}
                   </p>
                </button>

                {/* Option 2: B Routine or Create B Routine */}
                {routineB || client.isRoutineBActive ? (
                  <button 
                    onClick={() => { setSelectedRoutineType('B'); setAdjustedMachineIds(routineB?.machineIds || []); }}
                    className={`relative flex flex-col text-left p-4 rounded-2xl border-2 transition-all ${
                      selectedRoutineType === 'B' ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20' : 'border-border/50 hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                     <div className="flex justify-between items-center w-full">
                       <span className={`font-black italic uppercase tracking-tight text-lg ${selectedRoutineType === 'B' ? 'text-primary' : 'text-foreground'}`}>B Routine</span>
                       {lastSession?.routineId === routineB?.id && (
                         <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-primary/50 text-primary">Last: {lastSession.date}</Badge>
                       )}
                     </div>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed mt-2 line-clamp-2">
                       {routineB ? routineB.machineIds.map(id => machines.find(m => m.id === id)?.name || id).join(' • ') : 'No machines assigned'}
                     </p>
                  </button>
                ) : (
                  <button 
                    onClick={() => { setSelectedRoutineType('Create_B'); setAdjustedMachineIds([]); }}
                    className={`relative flex flex-col items-center justify-center text-center p-4 rounded-2xl border-2 transition-all border-dashed ${
                      selectedRoutineType === 'Create_B' ? 'border-primary bg-primary/5 shadow-md' : 'border-border/50 hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                     <span className="font-black italic uppercase tracking-tight text-primary">Create B Routine</span>
                  </button>
                )}

                {/* Option 3: Open Session */}
                <button 
                  onClick={() => { setSelectedRoutineType('Free'); setAdjustedMachineIds([]); }}
                  className={`relative flex flex-col text-left p-4 rounded-2xl border-2 transition-all ${
                    selectedRoutineType === 'Free' ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20' : 'border-border/50 hover:border-primary/30 hover:bg-muted/50'
                  }`}
                >
                   <div className="flex justify-between items-center w-full">
                     <span className={`font-black italic uppercase tracking-tight text-lg ${selectedRoutineType === 'Free' ? 'text-primary' : 'text-foreground'}`}>Open Session</span>
                     {lastSession && !lastSession.routineId && (
                       <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-primary/50 text-primary">Last: {lastSession.date}</Badge>
                     )}
                   </div>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed mt-2">
                     Manual selection for this session only.
                   </p>
                </button>
              </div>

              {/* Machine selector if Create_B or Free is selected */}
              {(selectedRoutineType === 'Create_B' || selectedRoutineType === 'Free') && (
                <div className="space-y-4 mt-6 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      {selectedRoutineType === 'Create_B' ? 'Select Machines for Routine B' : 'Select Machines for Open Session'}
                    </Label>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 bg-white rounded-2xl p-4 border shadow-inner">
                      {machines.map(m => {
                        const isSelected = adjustedMachineIds.includes(m.id);
                        const lifts = historicalLifts[m.id];
                        
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setAdjustedMachineIds(prev => 
                                prev.includes(m.id) 
                                  ? prev.filter(id => id !== m.id)
                                  : [...prev, m.id]
                              );
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border-2 ${
                              isSelected 
                                ? 'bg-primary/5 border-primary/20' 
                                : 'border-transparent opacity-40 hover:opacity-100 hover:bg-muted'
                            }`}
                          >
                            <div className="flex flex-col items-start gap-0.5">
                              <span className={`text-[11px] font-black uppercase tracking-tight ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                {m.name}
                              </span>
                              {lifts?.last ? (
                                <span className="text-[9px] font-bold text-muted-foreground/60">
                                  Last: {lifts.last.weight}lbs x {lifts.last.isStaticHold ? `${lifts.last.seconds}s` : `${lifts.last.reps}`}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-muted-foreground/30 italic">No history</span>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-primary border-primary shadow-lg shadow-primary/20' 
                                : 'border-muted-foreground/20'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Adjustment Note (Optional)</Label>
                    <Textarea 
                      placeholder="Add a note for this session..."
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                      className="rounded-2xl text-xs min-h-[80px]"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-2 shadow-sm">
            <CardHeader className="pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tactical Audit</span>
              <CardTitle className="text-xl font-black leading-none">Last Session Stats</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
               <div className="space-y-3">
                  <div className="flex justify-between items-end border-b pb-2 px-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Total Machines</span>
                    <span className="text-lg font-black">{Object.keys(historicalLifts).length || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-end border-b pb-2 px-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Duration</span>
                    <span className="text-lg font-black">
                      {lastSession?.startTime && lastSession?.endTime 
                        ? `${Math.round((lastSession.endTime.toDate().getTime() - lastSession.startTime.toDate().getTime()) / 60000)} min`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end border-b pb-2 px-1">
                   <span className="text-[10px] font-black uppercase text-muted-foreground">Total Volume</span>
                   <span className="text-lg font-black">
                     {Object.values(historicalLifts).reduce((acc, { last }) => acc + (parseFloat(last.weight || '0') * parseInt(last.reps || '0')), 0).toLocaleString()} 
                     <span className="text-xs font-normal ml-1">lbs</span>
                   </span>
                 </div>
               </div>
            </CardContent>
          </Card>

          {/* New Communication Feed Section */}
          <Card className="rounded-[32px] border-2 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trainer Intelligence</span>
              </div>
              <CardTitle className="text-xl font-black leading-none">Important Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[300px] overflow-y-auto">
              {sessionNotes.length > 0 ? (
                <div className="divide-y">
                  {sessionNotes.slice(0, 5).map((note) => (
                    <div key={note.id} className="p-4 space-y-2 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-primary uppercase">Trainer {note.trainerInitials}</span>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">
                          {note.createdAt?.toDate?.() ? note.createdAt.toDate().toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed italic text-foreground/80">"{note.content}"</p>
                    </div>
                  ))}
                  {sessionNotes.length > 5 && (
                    <div className="p-3 text-center">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-50">+{sessionNotes.length - 5} more historical notes</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground/20 italic">
                  <p className="text-xs font-bold uppercase tracking-widest">No communication logs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Historical Audit */}
        <div className="lg:col-span-8">
           <Card className="rounded-[32px] border-2 shadow-sm h-full flex flex-col overflow-hidden">
             <CardHeader className="bg-card border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black italic uppercase">Historical Audit</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em]">Latest metrics & performance deltas</CardDescription>
                  </div>
                  <Badge className="bg-indigo-600 uppercase font-black tracking-widest text-[9px]">Audit View</Badge>
                </div>
             </CardHeader>
             <CardContent className="p-0 overflow-y-auto flex-1">
                <div className="divide-y">
                   <div className="grid grid-cols-[1fr_80px_80px_100px] gap-px bg-muted text-[9px] font-black uppercase tracking-widest text-muted-foreground sticky top-0 z-10">
                      <div className="bg-card p-3">Machine</div>
                      <div className="bg-card p-3 text-center">Prev (S-1)</div>
                      <div className="bg-card p-3 text-center">Last (S-0)</div>
                      <div className="bg-card p-3 text-center">Delta Audit</div>
                   </div>
                   
                   {Object.entries(historicalLifts).length === 0 ? (
                     <div className="p-12 text-center text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold">No historical lift data found for this protocol.</p>
                     </div>
                   ) : (
                     Object.entries(historicalLifts).map(([mId, { last, previous }]) => {
                        const machine = machines.find(m => m.id === mId);
                        const machineName = machine?.name || mId;
                        const weightLast = parseFloat(last.weight || '0');
                        const weightPrev = previous ? parseFloat(previous.weight || '0') : weightLast;
                        const weightDiff = weightLast - weightPrev;
                        
                        const repsLast = parseInt(last.reps || '0');
                        const repsPrev = previous ? parseInt(previous.reps || '0') : repsLast;
                        const repsDiff = repsLast - repsPrev;

                        const isPlateau = weightDiff === 0 && repsDiff === 0;
                        const isSignificantLoss = weightDiff < 0 || (weightDiff === 0 && repsDiff < 0);
                        const isGain = weightDiff > 0 || (weightDiff === 0 && repsDiff > 0);

                        return (
                          <div key={mId} className={`grid grid-cols-[1fr_80px_80px_100px] items-center gap-px bg-muted group ${isSignificantLoss ? 'bg-red-50/50' : ''}`}>
                             <div className="bg-card p-4 flex flex-col justify-center min-w-0">
                                <span className="font-black text-xs uppercase truncate leading-tight group-hover:text-primary transition-colors">{machineName}</span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-50">Last session logged</span>
                             </div>
                             
                             <div className="bg-card p-4 flex flex-col items-center justify-center border-l opacity-40">
                                <span className="text-xs font-black leading-none">{weightPrev}</span>
                                <span className="text-[7px] font-bold uppercase">lbs</span>
                             </div>

                             <div className="bg-card p-4 flex flex-col items-center justify-center border-l bg-muted/5">
                                <span className="text-sm font-black leading-none">{weightLast}</span>
                                <span className="text-[7px] font-bold uppercase">lbs</span>
                             </div>

                             <div className={`bg-card p-4 flex flex-col items-center justify-center border-l ${isSignificantLoss ? 'bg-red-50 text-red-600' : isGain ? 'bg-emerald-50 text-emerald-600' : ''}`}>
                                {isGain ? (
                                  <div className="flex items-center gap-1 font-black leading-none">
                                    <TrendingUp className="w-3 h-3" />
                                    <span className="text-sm">+{weightDiff || repsDiff}</span>
                                  </div>
                                ) : isSignificantLoss ? (
                                  <div className="flex items-center gap-1 font-black leading-none">
                                    <TrendingDown className="w-3 h-3" />
                                    <span className="text-sm">{weightDiff || repsDiff}</span>
                                    <AlertTriangle className="w-2.5 h-2.5 ml-1 animate-pulse" />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 font-black leading-none text-muted-foreground">
                                    <span className="text-[10px]">FIXED</span>
                                  </div>
                                )}
                                <span className="text-[7px] font-bold uppercase mt-1">{isGain ? 'Progress' : isSignificantLoss ? 'Audit Alert' : 'Consistent'}</span>
                             </div>
                          </div>
                        );
                     })
                   )}
                </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

const Zap = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    stroke="none" 
    className={className}
  >
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);
