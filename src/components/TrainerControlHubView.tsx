import React, { useState } from 'react';
import Papa from 'papaparse';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, CheckCircle2, AlertCircle, Loader2, Database, Link, RefreshCcw, ShieldCheck, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { Machine, Client, Trainer, WorkoutSession, ScheduleEntry } from '../types';
import { findMatchingTrainer, normalizeName } from '../lib/sync-utils';

export function TrainerControlHubView({ 
  trainers, 
  machines, 
  clients,
  authTrainer, 
  isAdmin, 
  onAppCleanse,
  onSeedDemoClient,
  onRestoreMachines,
  onLogout,
  onReorderTrainers
}: { 
  trainers: Trainer[], 
  machines: Machine[], 
  clients: Client[],
  authTrainer: Trainer | null, 
  isAdmin: boolean,
  onAppCleanse: () => void,
  onSeedDemoClient: () => void,
  onRestoreMachines: () => void,
  onLogout?: () => void,
  onReorderTrainers?: () => void
}) {
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingTrainerId, setSyncingTrainerId] = useState<string | null>(null);
  const [isRestoringMachines, setIsRestoringMachines] = useState(false);
  const [isCleansingApp, setIsCleansingApp] = useState(false);

  // iCal Edit State
  const [editingIcalId, setEditingIcalId] = useState<string | null>(null);
  const [newIcalUrl, setNewIcalUrl] = useState('');
  const [isUpdatingIcal, setIsUpdatingIcal] = useState(false);

  const visibleTrainers = isAdmin 
    ? trainers 
    : trainers.filter(t => t.id === authTrainer?.id);

  const handleAllTrainersSync = async () => {
    setIsSyncingAll(true);
    try {
      const resp = await fetch('/api/trigger-master-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Failed to trigger sync');
      }
      
      const result = await resp.json();
      alert(result.message || "Master Sync completed successfully.");
    } catch (err: any) {
      alert("Mass sync failed: " + err.message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleTrainerSync = async (trainerId: string) => {
    setSyncingTrainerId(trainerId);
    try {
      const resp = await fetch('/api/trigger-master-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainerId })
      });
      
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Sync failed');
      alert(result.message || "Trainer schedule sync completed.");
    } catch (err: any) {
      alert("Sync failed: " + err.message);
    } finally {
      setSyncingTrainerId(null);
    }
  };

  const handleUpdateIcalUrl = async (trainerId: string, url: string | null) => {
    setIsUpdatingIcal(true);
    try {
      await updateDoc(doc(db, 'trainers', trainerId), {
        mindbody_ical_url: url,
        updatedAt: serverTimestamp()
      });
      setEditingIcalId(null);
      setNewIcalUrl('');
    } catch (err: any) {
      alert("Failed to update URL: " + err.message);
    } finally {
      setIsUpdatingIcal(false);
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const [isLegacyImporting, setIsLegacyImporting] = useState(false);
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null);
  const [legacyStats, setLegacyStats] = useState<{ clients: number; sessions: number; logs: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setImportStats(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          const importId = `import_${Date.now()}`;
          
          const [clientsSnap] = await Promise.all([
            getDocs(collection(db, 'clients'))
          ]);

          const clientMap: Record<string, string> = {};
          clientsSnap.forEach(d => {
            const c = d.data() as Client;
            clientMap[normalizeName(`${c.firstName} ${c.lastName}`)] = d.id;
          });

          let successCount = 0;
          let failedCount = 0;

          for (const row of data) {
            const clientName = row['Client Name'] || row['Client'] || row['Student'] || '';
            const mbTrainerName = row['Trainer'] || row['Staff'] || row['Teacher'] || '';
            const startTimeStr = row['Start Time'] || row['Start'] || '';
            const endTimeStr = row['End Time'] || row['End'] || '';
            const status = row['Status'] || 'Scheduled';
            const serviceName = row['Service'] || row['Class'] || 'Personal Training';

            if (!clientName || !startTimeStr) {
              failedCount++;
              continue;
            }

            const startTime = new Date(startTimeStr);
            const endTime = endTimeStr ? new Date(endTimeStr) : new Date(startTime.getTime() + 60 * 60 * 1000);

            if (isNaN(startTime.getTime())) {
              failedCount++;
              continue;
            }

            const clientId = clientMap[normalizeName(clientName)];
            const matchingTrainer = findMatchingTrainer(mbTrainerName, trainers);
            const trainerId = matchingTrainer?.id || null;

            await addDoc(collection(db, 'schedules'), {
              clientName,
              trainerName: mbTrainerName,
              clientId: clientId || null,
              trainerId,
              startTime: Timestamp.fromDate(startTime),
              endTime: Timestamp.fromDate(endTime),
              status,
              serviceName,
              source: 'MindBody',
              importId,
              createdAt: serverTimestamp(),
            });
            successCount++;
          }

          setImportStats({ success: successCount, failed: failedCount });
        } catch (err: any) {
          console.error('Import error:', err);
          setError(err.message || 'Failed to import schedule');
        } finally {
          setIsImporting(false);
          event.target.value = '';
        }
      },
      error: (err) => {
        setError(err.message);
        setIsImporting(false);
        event.target.value = '';
      }
    });
  };

  const handleLegacyFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLegacyImporting(true);
    setLegacyError(null);
    setLegacyStats(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          let clientCount = 0;
          let sessionCount = 0;
          let logCount = 0;
          let failedCount = 0;

          const clientCache: Record<string, string> = {}; 
          const machineCache: Record<string, string> = {}; 

          const machinesSnap = await getDocs(collection(db, 'machines'));
          machinesSnap.forEach(doc => {
            const m = doc.data() as Machine;
            machineCache[m.name.toLowerCase()] = doc.id;
            if (m.fullName) machineCache[m.fullName.toLowerCase()] = doc.id;
          });

          const clientsSnap = await getDocs(collection(db, 'clients'));
          clientsSnap.forEach(doc => {
            const c = doc.data() as Client;
            clientCache[`${c.firstName} ${c.lastName}`.toLowerCase()] = doc.id;
          });

          for (const row of data) {
            const firstName = row['First Name'] || row['FirstName'] || '';
            const lastName = row['Last Name'] || row['LastName'] || '';
            const fullName = row['Client Name'] || row['Client'] || row['Full Name'] || `${firstName} ${lastName}`.trim();
            
            const machineName = row['Machine'] || row['Exercise'] || row['Equipment'] || '';
            const weight = row['Weight'] || row['Resistance'] || '';
            const reps = row['Reps'] || row['Repetitions'] || '';
            const dateStr = row['Date'] || row['Timestamp'] || row['Workout Date'] || '';
            const trainerInitials = (row['Trainer'] || row['Staff'] || row['Initials'] || 'FM').toUpperCase();
            const notes = row['Notes'] || row['Comments'] || '';
            const settingsStr = row['Settings'] || row['Machine Settings'] || '';

            if (!fullName || !machineName || !dateStr) {
              failedCount++;
              continue;
            }

            let clientId = clientCache[fullName.toLowerCase()];
            if (!clientId) {
              const nameParts = fullName.split(' ');
              const fName = nameParts[0] || 'Imported';
              const lName = nameParts.slice(1).join(' ') || 'Client';
              
              const clientDoc = await addDoc(collection(db, 'clients'), {
                firstName: fName,
                lastName: lName,
                gender: 'Other',
                height: row['Height'] || 'N/A',
                isActive: true,
                remainingSessions: 0,
                globalNotes: row['Client Notes'] || '',
                createdAt: serverTimestamp()
              });
              clientId = clientDoc.id;
              clientCache[fullName.toLowerCase()] = clientId;
              clientCount++;
            }

            const machineId = machineCache[machineName.toLowerCase()];
            if (!machineId) {
              failedCount++;
              continue;
            }

            const sessionDate = new Date(dateStr);
            if (isNaN(sessionDate.getTime())) {
              failedCount++;
              continue;
            }

            const q = query(
              collection(db, 'sessions'), 
              where('clientId', '==', clientId),
              where('date', '==', sessionDate.toISOString().split('T')[0])
            );
            const existingSessions = await getDocs(q);
            let sessionId: string;

            if (existingSessions.empty) {
              const sessionDoc = await addDoc(collection(db, 'sessions'), {
                clientId,
                sessionType: 'Standard',
                sessionNumber: 0, 
                date: sessionDate.toISOString().split('T')[0],
                trainerInitials,
                notes: row['Session Notes'] || '',
                createdAt: Timestamp.fromDate(sessionDate)
              });
              sessionId = sessionDoc.id;
              sessionCount++;
            } else {
              sessionId = existingSessions.docs[0].id;
            }

            await addDoc(collection(db, 'exerciseLogs'), {
              sessionId,
              clientId,
              machineId,
              weight,
              reps,
              notes,
              createdAt: Timestamp.fromDate(sessionDate)
            });
            logCount++;

            if (settingsStr) {
              const settings: Record<string, string> = {};
              if (settingsStr.includes(':')) {
                settingsStr.split(',').forEach(s => {
                  const [k, v] = s.split(':').map(x => x.trim());
                  if (k && v) settings[k] = v;
                });
              } else {
                settings['General'] = settingsStr;
              }

              await setDoc(doc(db, 'clientMachineSettings', `${clientId}_${machineId}`), {
                clientId,
                machineId,
                settings,
                updatedBy: trainerInitials,
                updatedAt: Timestamp.fromDate(sessionDate)
              }, { merge: true });
            }
          }

          setLegacyStats({ clients: clientCount, sessions: sessionCount, logs: logCount, failed: failedCount });
        } catch (err: any) {
          console.error('Legacy import error:', err);
          setLegacyError(err.message || 'Failed to import legacy data');
        } finally {
          setIsLegacyImporting(false);
          event.target.value = '';
        }
      },
      error: (err) => {
        setLegacyError(err.message);
        setIsLegacyImporting(false);
        event.target.value = '';
      }
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-4xl mx-auto space-y-8 w-full overflow-x-hidden px-4 sm:px-0"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tight uppercase italic text-foreground">Hub Settings</h2>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-widest leading-relaxed">
            Manage your schedule sync and standard studio settings.
          </p>
        </div>
        
        {onLogout && (
          <Button 
            variant="outline" 
            onClick={onLogout}
            className="rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 h-12 px-6 font-black uppercase text-[10px] tracking-widest"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Switch Trainer
          </Button>
        )}
      </div>

      <Card className="border-2 shadow-xl rounded-3xl overflow-hidden border-orange-200">
        <CardHeader className="bg-orange-50/50 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-orange-950 italic">Team Management</CardTitle>
              <CardDescription className="text-orange-800/70 font-medium uppercase text-xs">Manage individual Schedule Sync URLs.</CardDescription>
            </div>
          </div>
          {isAdmin && onReorderTrainers && (
            <Button 
              variant="outline" 
              onClick={onReorderTrainers}
              className="rounded-2xl border-orange-300 text-orange-700 hover:bg-orange-100 h-10 px-4 font-black uppercase text-[10px] tracking-widest gap-2"
            >
              <RefreshCcw className="w-3 h-3" />
              Sort Display Order
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-6">
            {visibleTrainers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-medium italic">No matching trainer records found.</p>
            ) : (
              <div className="grid gap-6">
                {visibleTrainers.map((t) => (
                  <div key={t.id} className="p-6 bg-orange-50/30 rounded-3xl border border-orange-100/50 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl ${t.isOwner ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'} flex items-center justify-center font-black text-xl italic`}>
                          {t.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-black text-orange-950 uppercase italic">{t.fullName}</p>
                            {t.isOwner && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Owner</span>}
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-600/60 leading-none mt-1">
                            {t.isOwner ? 'System Admin' : 'Performance Trainer'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mindbody Schedule Sync Section */}
                    <div className="pt-6 border-t border-orange-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <RefreshCcw className="w-4 h-4 text-orange-600" />
                          <h4 className="font-black text-orange-950 uppercase text-xs tracking-widest leading-none">Personal MindBody Feed</h4>
                        </div>
                        {t.mindbody_ical_url && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            disabled={syncingTrainerId === t.id}
                            onClick={() => handleTrainerSync(t.id!)}
                            className="h-8 text-[10px] font-black uppercase text-orange-600 hover:text-orange-700 hover:bg-orange-100/50 rounded-lg"
                          >
                            {syncingTrainerId === t.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCcw className="w-3 h-3 mr-2" />}
                            Sync Now
                          </Button>
                        )}
                      </div>

                      {editingIcalId === t.id ? (
                        <div className="flex gap-2">
                          <Input 
                            placeholder="https://mindbody.com/export/..." 
                            value={newIcalUrl}
                            onChange={e => setNewIcalUrl(e.target.value)}
                            className="h-11 rounded-xl bg-white border-orange-200 text-xs"
                          />
                          <Button 
                            onClick={() => handleUpdateIcalUrl(t.id!, newIcalUrl)}
                            disabled={isUpdatingIcal}
                            className="bg-orange-600 h-11 px-4 rounded-xl font-black uppercase text-[10px]"
                          >
                            {isUpdatingIcal ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                          </Button>
                          <Button variant="ghost" onClick={() => setEditingIcalId(null)} className="h-11 px-4 font-bold rounded-xl">Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 bg-white/50 border border-orange-100 rounded-2xl">
                          {t.mindbody_ical_url ? (
                            <>
                              <div className="flex items-center gap-3 overflow-hidden">
                                <Link className="w-4 h-4 text-orange-400 shrink-0" />
                                <span className="text-xs font-medium text-orange-800 truncate">{t.mindbody_ical_url}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-4">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    setEditingIcalId(t.id!);
                                    setNewIcalUrl(t.mindbody_ical_url || '');
                                  }}
                                  className="h-8 w-8 p-0 text-orange-600 hover:bg-orange-100 rounded-lg"
                                >
                                  <RefreshCcw className="w-3 h-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    if(confirm("Stop syncing this trainer's schedule?")) {
                                      handleUpdateIcalUrl(t.id!, null);
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-bold text-orange-600/50 uppercase tracking-widest italic">No Link Provided</span>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setEditingIcalId(t.id!);
                                  setNewIcalUrl('');
                                }}
                                className="h-9 border-orange-200 text-orange-700 hover:bg-orange-100 rounded-xl px-4 font-black uppercase text-[10px] gap-2"
                              >
                                Add Link
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-xl rounded-3xl overflow-hidden border-indigo-200">
        <CardHeader className="bg-indigo-50/50 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <RefreshCcw className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black italic">Batch Sync</CardTitle>
              <CardDescription className="text-indigo-800 font-medium">Manually trigger a master refresh for all active team links.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-4">
          <div className="flex items-center justify-between p-6 bg-indigo-50/30 border border-indigo-100 rounded-3xl gap-6">
            <div className="space-y-1">
              <p className="font-black text-indigo-950 uppercase italic tracking-tight">Full Team Sync</p>
              <p className="text-[10px] font-black text-indigo-600/70 uppercase italic">Refresh all trainer calendars at once.</p>
            </div>
            <Button 
              onClick={handleAllTrainersSync} 
              disabled={isSyncingAll}
              className="h-14 px-8 rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 shrink-0 text-xs uppercase tracking-widest"
            >
              {isSyncingAll ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <RefreshCcw className="w-5 h-5 mr-2" />}
              Execute Sync
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/30 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black italic text-foreground">Import Data</CardTitle>
              <CardDescription className="text-muted-foreground font-medium uppercase text-xs">Import historical data from CSV files.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid gap-4">
            <Label htmlFor="legacy-upload" className="text-xs font-black uppercase tracking-widest">Historical Workout Data (CSV)</Label>
            <div className="relative">
              <Input 
                id="legacy-upload" 
                type="file" 
                accept=".csv" 
                onChange={handleLegacyFileUpload}
                disabled={isLegacyImporting}
                className="h-24 border-2 border-dashed border-muted-foreground/20 rounded-2xl cursor-pointer file:hidden flex items-center justify-center text-center font-bold text-muted-foreground hover:border-amber-400/50 transition-all"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {isLegacyImporting ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                    <span className="text-lg font-black uppercase italic">Processing...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-black text-foreground uppercase tracking-tight">Click to select CSV</span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase opacity-50">Legacy/FileMaker Format</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {legacyStats && (
            <div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-1" />
              <div>
                <p className="font-black text-emerald-900 text-lg">Import Success</p>
                <div className="text-emerald-700 font-medium grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-xs">
                  <p>Clients: <span className="font-black">{legacyStats.clients}</span></p>
                  <p>Sessions: <span className="font-black">{legacyStats.sessions}</span></p>
                  <p>Logs: <span className="font-black">{legacyStats.logs}</span></p>
                  <p>Skipped: <span className="font-black">{legacyStats.failed}</span></p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-2 shadow-xl rounded-3xl overflow-hidden border-rose-200">
          <CardHeader className="bg-rose-50/50 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center">
                <Database className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black italic">System Cleanse</CardTitle>
                <CardDescription className="text-rose-800 font-medium">Critical database maintenance and factory resets.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-rose-50/30 border border-rose-100 rounded-3xl gap-6">
                <div className="space-y-1">
                  <p className="font-black text-rose-950 uppercase italic tracking-tight">Factory Reset</p>
                  <p className="text-[10px] font-black text-rose-600/70 uppercase italic">
                    Wipe session data or re-push standard equipment defaults.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={async () => {
                      setIsRestoringMachines(true);
                      try {
                        await onRestoreMachines();
                      } finally {
                        setIsRestoringMachines(false);
                      }
                    }}
                    disabled={isRestoringMachines}
                    variant="outline"
                    className="h-14 px-8 rounded-2xl font-black border-orange-200 text-orange-700 hover:bg-white text-xs uppercase tracking-widest"
                  >
                    Re-Sync Standard Units
                  </Button>
                  <Button 
                    onClick={() => onSeedDemoClient()} 
                    variant="outline"
                    className="h-14 px-8 rounded-2xl font-black border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs uppercase tracking-widest"
                  >
                    Generate Demo Client
                  </Button>
                  <Button 
                    onClick={async () => {
                      setIsCleansingApp(true);
                      try {
                        await onAppCleanse();
                      } finally {
                        setIsCleansingApp(false);
                      }
                    }}
                    disabled={isCleansingApp}
                    className="h-14 px-8 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 text-xs uppercase tracking-widest"
                  >
                    {isCleansingApp ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Database className="w-5 h-5 mr-2" />}
                    Total Cleanse
                  </Button>
                </div>
             </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
