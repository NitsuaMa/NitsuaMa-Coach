import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Activity, TrendingUp, Save, Clock, Dumbbell, AlertCircle, History } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Machine, Client, ExerciseLog, ClientMachineSetting, MachineNote } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  client: Client;
  machine: Machine | null;
  onClose: () => void;
}

// Helper for concise time formatting
function formatTime(seconds: number) {
  if (!seconds) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Shorthand mapper
function getSettingShorthand(settingName: string) {
  const map: Record<string, string> = {
    'gap': 'G',
    'seat': 'S',
    'back pad': 'B',
    'back height': 'BH',
    'back angle': 'BA',
    'weight': 'W',
    'pin': 'P',
    'setting': 'SET'
  };
  return map[settingName.toLowerCase()] || settingName.substring(0, 2).toUpperCase();
}

export function MachineInsightsModal({ client, machine, onClose }: Props) {
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [settingsDetail, setSettingsDetail] = useState<ClientMachineSetting | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isImportantNote, setIsImportantNote] = useState(false);

  useEffect(() => {
    if (!client.id || !machine?.id) return;

    // Fetch logs specifically for THIS client AND THIS machine, limited to most recent 6, then ordered asc chronologically
    const qLogs = query(
      collection(db, 'exerciseLogs'),
      where('clientId', '==', client.id),
      where('machineId', '==', machine.id),
      orderBy('createdAt', 'desc'),
      limit(6)
    );
    
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const fetchedLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExerciseLog));
      // Filter out empty data (where both reps and staticHoldTime/seconds are 0 or undefined)
      const validLogs = fetchedLogs.filter(l => {
        const reps = parseInt(l.reps || '0');
        const hold = parseInt(l.seconds || '0');
        return reps > 0 || hold > 0;
      });
      validLogs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeA - timeB; // sort asc
      });
      setLogs(validLogs);
    });

    const settingsDocId = `${client.id}_${machine.id}`;
    const unsubSettings = onSnapshot(doc(db, 'clientMachineSettings', settingsDocId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as ClientMachineSetting;
        setSettingsDetail(data);
      } else {
        setSettingsDetail(null);
      }
    });

    return () => {
      unsubLogs();
      unsubSettings();
    };
  }, [client.id, machine?.id]);

  const handleSaveNote = async () => {
    if (!client.id || !machine?.id || !newNoteContent.trim()) return;
    setIsSavingNote(true);
    try {
      const settingsDocId = `${client.id}_${machine.id}`;
      const docRef = doc(db, 'clientMachineSettings', settingsDocId);
      const docSnap = await getDoc(docRef);
      
      const newNote: MachineNote = {
        id: crypto.randomUUID(),
        content: newNoteContent.trim(),
        authorName: 'Trainer Workspace', // Defaulting to this as we might not have the user's name right in this scope
        timestamp: new Date(),
        isImportant: isImportantNote
      };

      if (docSnap.exists()) {
        const existingData = docSnap.data() as ClientMachineSetting;
        const updatedNotes = [...(existingData.machineNotes || []), newNote];
        await updateDoc(docRef, { machineNotes: updatedNotes });
      } else {
        await setDoc(docRef, {
          clientId: client.id,
          machineId: machine.id,
          settings: {},
          updatedBy: 'Trainer',
          updatedAt: new Date(),
          machineNotes: [newNote]
        });
      }
      setNewNoteContent('');
      setIsImportantNote(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const chartData = logs
    .filter(l => l.repQuality !== undefined && l.repQuality !== null)
    .slice(-10) // show up to last 10
    .map((l, i) => {
      return {
        name: `S${i+1}`,
        quality: l.repQuality // e.g., 1-5 or 0-100
      };
    });

  const totalTimeSeconds = logs.reduce((acc, l) => acc + (parseInt(l.seconds || '0') || 0), 0);
  const formattedTime = formatTime(totalTimeSeconds);
  
  const normalLogs = logs.filter(l => !l.isStaticHold);
  const staticHoldLogs = logs.filter(l => l.isStaticHold);
  
  const totalReps = normalLogs.reduce((acc, l) => acc + (parseInt(l.reps || '0') || 0), 0);
  
  // Volume: for normal logs = weight * reps. For static holds, it's weight * 1 (or just omitted; let's say weight * 1 to reflect weight moved)
  const totalVolumeNormal = normalLogs.reduce((acc, l) => acc + ((parseInt(l.weight || '0') || 0) * (parseInt(l.reps || '0') || 1)), 0);
  const totalVolumeStatic = staticHoldLogs.reduce((acc, l) => acc + (parseInt(l.weight || '0') || 0), 0);
  const totalVolume = totalVolumeNormal + totalVolumeStatic;

  // In MSF, trainers enter the duration in seconds into the 'reps' field for static holds
  const totalStaticHoldTime = staticHoldLogs.reduce((acc, l) => acc + (parseInt(l.reps || '0') || 0), 0);
  
  const sortedNotes = [...(settingsDetail?.machineNotes || [])].sort((a, b) => {
    const timeA = a.timestamp?.toMillis?.() || 0;
    const timeB = b.timestamp?.toMillis?.() || 0;
    return timeB - timeA; // sort desc
  });

  const sortedSettingsHistory = [...(settingsDetail?.settingsHistory || [])].sort((a, b) => {
    const timeA = a.updatedAt?.toMillis?.() || 0;
    const timeB = b.updatedAt?.toMillis?.() || 0;
    return timeB - timeA; // sort desc
  });

  return (
    <Dialog open={!!machine} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-50 p-0 overflow-hidden border-none rounded-3xl flex flex-col" aria-describedby="dialog-description">
        <DialogTitle className="sr-only">Machine Insights</DialogTitle>
        <DialogDescription id="dialog-description" className="sr-only">Detailed insights for this machine mapping</DialogDescription>
        
        {machine && (
          <>
            {/* Fixed Header */}
            <div className="bg-white p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none uppercase">{machine.name}</h2>
                  <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">Client Machine Insights</p>
                </div>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 max-h-[80vh] overflow-y-auto p-6 space-y-6 custom-scrollbar pr-4">
               {/* Top Stats */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white">
                    <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 text-center">Total Time</span>
                       <div className="flex items-baseline gap-1">
                         <span className="text-xl font-black text-[#115E8D]">{formattedTime}</span>
                       </div>
                    </CardContent>
                 </Card>
                 
                 <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white">
                    <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 text-center">Total Reps</span>
                       <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-black text-[#115E8D]">{totalReps.toLocaleString()}</span>
                       </div>
                    </CardContent>
                 </Card>
                 
                 <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white col-span-2 md:col-span-1">
                    <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 text-center">Total Volume</span>
                       <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-black text-[#115E8D]">{totalVolume.toLocaleString()}</span>
                         <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lbs</span>
                       </div>
                    </CardContent>
                 </Card>

                 {totalStaticHoldTime > 0 ? (
                   <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white col-span-2 md:col-span-1 border-2 border-emerald-500/20">
                      <CardContent className="p-4 flex flex-col justify-center items-center h-full bg-emerald-50/50 rounded-2xl">
                         <span className="text-[9px] font-black uppercase text-emerald-600 tracking-widest mb-1 text-center">Static Hold</span>
                         <div className="flex items-baseline gap-1 text-emerald-600">
                           <span className="text-2xl font-black">{totalStaticHoldTime}</span>
                           <span className="text-[10px] font-bold uppercase ml-1">Secs</span>
                         </div>
                      </CardContent>
                   </Card>
                 ) : (
                    <div className="hidden md:block col-span-1" />
                 )}
               </div>

               {/* Recent Session History Grid */}
               <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white overflow-hidden">
                 <CardContent className="p-0 overflow-x-auto">
                   <table className="w-full text-left border-collapse min-w-[500px]">
                     <thead className="bg-[#f8fafc]">
                       <tr>
                         {logs.map((log, idx) => (
                           <th key={log.id} className="p-3 text-center border-b border-r border-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                             S{idx + 1}
                           </th>
                         ))}
                         {logs.length > 0 && (
                           <th className="p-3 text-center border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-800 tracking-widest whitespace-nowrap">
                             Next Target Weight
                           </th>
                         )}
                       </tr>
                     </thead>
                     <tbody>
                       <tr>
                         {logs.map((log) => {
                           let qualityColor = 'text-slate-700'; // Default
                           if (log.repQuality === 3) qualityColor = 'text-emerald-700';
                           else if (log.repQuality === 2) qualityColor = 'text-amber-700';
                           else if (log.repQuality === 1) qualityColor = 'text-rose-700';

                           return (
                             <td key={log.id} className="p-4 border-r border-slate-100 text-center align-middle">
                               <div className="flex flex-col items-center justify-center">
                                 <div className="flex items-center gap-0.5 mb-1">
                                   <span className="font-black text-lg text-slate-900">{log.weight}</span>
                                 </div>
                                 <span className={`font-extrabold text-sm ${qualityColor}`}>
                                   {log.isStaticHold ? `${log.seconds}s` : log.reps}
                                 </span>
                               </div>
                             </td>
                           );
                         })}
                         {logs.length > 0 && (() => {
                           const targetLog = logs[logs.length - 1];
                           const targetWeight = targetLog.repQuality === 3 ? Number(targetLog.weight || 0) + 5 : targetLog.weight;
                           return (
                             <td className="p-4 text-center bg-slate-50 align-middle">
                               <div className="flex flex-col items-center">
                                 <span className="font-black text-xl text-slate-900">
                                   {targetWeight}
                                 </span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LBS</span>
                               </div>
                             </td>
                           );
                         })()}
                       </tr>
                     </tbody>
                   </table>
                 </CardContent>
               </Card>

               {/* Quality Trend Chart (Recharts) */}
               <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white">
                 <CardContent className="p-4">
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Repetition Quality Trend</span>
                   </div>
                   <div className="h-48 w-full">
                     {chartData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                         <LineChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                           <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                           <Tooltip 
                             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                             labelStyle={{ fontWeight: 'bold', color: '#64748b' }}
                           />
                           <Line 
                             type="monotone" 
                             dataKey="quality" 
                             stroke="#10b981" 
                             strokeWidth={3}
                             dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#10b981' }}
                             activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                           />
                         </LineChart>
                       </ResponsiveContainer>
                     ) : (
                       <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                         No Quality Data Available
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>

               {/* Settings History */}
               <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white">
                 <CardContent className="p-4">
                   <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-4">Settings & Config</span>
                   
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                     <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-3 block border-b border-slate-200 pb-2">Current Setup</span>
                     <div className="flex flex-wrap gap-2">
                       {settingsDetail?.settings && Object.keys(settingsDetail.settings).length > 0 ? (
                         Object.entries(settingsDetail.settings).map(([k,v]) => (
                           <Badge key={k} variant="secondary" className="bg-[#115E8D]/10 text-[#115E8D] hover:bg-[#115E8D]/10 text-xs py-1 px-3 font-bold tracking-widest uppercase rounded-lg">
                             <span className="opacity-60 mr-1">{getSettingShorthand(k)}</span> {v}
                           </Badge>
                         ))
                       ) : (
                         <span className="text-[10px] font-bold text-slate-400 italic">No specific settings saved.</span>
                       )}
                     </div>
                   </div>

                   {sortedSettingsHistory.length > 0 && (
                     <div className="space-y-4 relative before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 ml-1">
                        {sortedSettingsHistory.slice(0, 5).map((historyEntry, idx) => (
                          <div key={idx} className="flex gap-4 relative">
                            <div className="w-6 h-6 rounded-full bg-white border-4 border-slate-200 z-10 shrink-0 flex items-center justify-center">
                              <History className="w-3 h-3 text-slate-400" />
                            </div>
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#F06C22]">
                                {historyEntry.updatedAt?.toDate ? historyEntry.updatedAt.toDate().toLocaleDateString() : 'Unknown Date'} • {historyEntry.updatedBy}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Object.entries(historyEntry.settings).map(([k, v]) => (
                                  <span key={k} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded leading-none">
                                    {getSettingShorthand(k)}:{v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                     </div>
                   )}
                 </CardContent>
               </Card>

               {/* Internal Trainer Notes */}
               <Card className="rounded-2xl border-none shadow-sm shadow-slate-200/50 bg-white">
                 <CardContent className="p-4">
                   <div className="flex items-center justify-between mb-4">
                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Internal Trainer Notes</span>
                     <Badge variant="outline" className="text-[9px] font-bold tracking-widest uppercase border-slate-200 text-slate-400">Practical Alignment</Badge>
                   </div>
                   
                   <div className="space-y-4 mb-6">
                     {sortedNotes.length > 0 ? (
                       sortedNotes.map(note => (
                         <div key={note.id} className={`p-4 rounded-xl border ${note.isImportant ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex justify-between flex-wrap gap-2 items-start mb-2">
                              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">
                                {note.authorName} • {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleDateString() : ''}
                              </span>
                              {note.isImportant && (
                                <Badge variant="secondary" className="bg-red-100 text-red-600 hover:bg-red-100 border-none font-bold text-[8px] uppercase tracking-widest py-0 px-1.5 leading-tight rounded flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Important
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                         </div>
                       ))
                     ) : (
                       <p className="text-xs font-bold text-slate-400 italic text-center py-4">No notes recorded yet.</p>
                     )}
                   </div>

                   <div className="pt-4 border-t border-slate-100">
                     <Textarea
                       placeholder="Add a new assessment or practical alignment note..."
                       value={newNoteContent}
                       onChange={(e) => setNewNoteContent(e.target.value)}
                       className="resize-none h-24 mb-3 border-slate-200 focus-visible:ring-[#115E8D]"
                     />
                     <div className="flex items-center justify-between flex-wrap gap-4">
                       <div className="flex items-center space-x-2">
                         <Switch 
                           id="important-note" 
                           checked={isImportantNote} 
                           onCheckedChange={setIsImportantNote}
                           className="data-[state=checked]:bg-red-500"
                         />
                         <Label htmlFor="important-note" className="text-[10px] font-black uppercase tracking-widest text-slate-600 cursor-pointer flex items-center gap-1">
                           <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                           Mark as Important
                         </Label>
                       </div>
                       <Button 
                         onClick={handleSaveNote} 
                         disabled={isSavingNote || !newNoteContent.trim()}
                         className="bg-[#115E8D] hover:bg-[#115E8D]/90 text-white font-bold text-[10px] uppercase tracking-widest px-6 ml-auto"
                       >
                         {isSavingNote ? 'Saving...' : 'Save Note'}
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>

            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
