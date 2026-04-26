import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  ArrowLeft,
  Calendar,
  Zap,
  Target,
  History,
  Info,
  Settings,
  Search,
  Check,
  Printer,
  Mail,
  ChevronRight,
  TrendingDown,
  Award,
  ChevronDown,
  ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Client, 
  Trainer, 
  Machine, 
  ProgressReport 
} from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { calculateHighlightedMovements, calculateAttendanceStats } from '../lib/progress-utils';

interface ClientProgressReportViewProps {
  client: Client;
  trainer: Trainer;
  machines: Machine[];
  onBack: () => void;
  existingReportId?: string;
}

export function ClientProgressReportView({ client, trainer, machines, onBack, existingReportId }: ClientProgressReportViewProps) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'selection' | 'editing' | 'view'>('selection');
  const [saving, setSaving] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  
  // Entire Report State
  const [report, setReport] = useState<ProgressReport>({
    clientId: client.id!,
    trainerId: trainer.id!,
    trainerName: trainer.fullName,
    date: new Date().toISOString().split('T')[0],
    isManual: false,
    status: 'Draft',
    
    // Step 1: Attendance
    attendance: {
      score: 0,
      totalSessions: 0,
      avgDuration: 0,
      punctuality: '',
      narrative: ''
    },

    // Step 2: Highlights
    highlights: [
      { label: '', startValue: '', currentValue: '', featuredMetric: 'weight' },
      { label: '', startValue: '', currentValue: '', featuredMetric: 'weight' },
      { label: '', startValue: '', currentValue: '', featuredMetric: 'weight' }
    ],

    // Step 3: Performance Matrix
    performanceMatrix: {
      posture: { 
        score: 80, 
        note: '', 
        talkingPoints: [
          { id: 'pos-1', text: 'Head Alignment', status: 'black' },
          { id: 'pos-2', text: 'Shoulder Stabilization', status: 'black' },
          { id: 'pos-3', text: 'Spinal Neutrality', status: 'black' }
        ]
      },
      pace: { 
        score: 75, 
        note: '', 
        talkingPoints: [
          { id: 'pac-1', text: 'Negative Control', status: 'black' },
          { id: 'pac-2', text: 'Smooth Turnaround', status: 'black' },
          { id: 'pac-3', text: 'Constant Tension', status: 'black' }
        ]
      },
      path: { 
        score: 85, 
        note: '', 
        talkingPoints: [
          { id: 'pat-1', text: 'Active ROM', status: 'black' },
          { id: 'pat-2', text: 'No Momentum', status: 'black' },
          { id: 'pat-3', text: 'Leverage optimization', status: 'black' }
        ]
      },
      purpose: { 
        score: 90, 
        note: '', 
        talkingPoints: [
          { id: 'pur-1', text: 'Muscle Recruitment', status: 'black' },
          { id: 'pur-2', text: 'Reaching Inroad', status: 'black' },
          { id: 'pur-3', text: 'Mind-Muscle Connection', status: 'black' }
        ]
      }
    },

    // Step 4: The Past
    milestones: {
      originalWhy: client.globalNotes || '',
      smartGoal: ''
    },

    // Step 5: The Future
    strategy: {
      primaryPlan: 'Routine Mastery',
      focusAreas: ''
    },
    createdAt: null
  });

  const [selectingHighlightIdx, setSelectingHighlightIdx] = useState<number | null>(null);
  const [machineHistory, setMachineHistory] = useState<Record<string, any>>({});

  // Load existing report if ID provided
  useEffect(() => {
    async function fetchExisting() {
      if (!existingReportId) return;
      setLoading(true);
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'progressReports', existingReportId));
        if (snap.exists()) {
          const data = snap.data() as ProgressReport;
          
          setReport(prev => {
            const mergedPerformanceMatrix = {
              posture: { ...(prev.performanceMatrix.posture || {}), ...(data.performanceMatrix?.posture || {}) },
              pace: { ...(prev.performanceMatrix.pace || {}), ...(data.performanceMatrix?.pace || {}) },
              path: { ...(prev.performanceMatrix.path || {}), ...(data.performanceMatrix?.path || {}) },
              purpose: { ...(prev.performanceMatrix.purpose || {}), ...(data.performanceMatrix?.purpose || {}) }
            };
            return { 
              ...prev, 
              ...data,
              performanceMatrix: (data.performanceMatrix ? mergedPerformanceMatrix : prev.performanceMatrix) as any,
              id: snap.id 
            };
          });
          setMode(data.status === 'Finalized' ? 'view' : 'editing');
        }
      } catch (err) {
        console.error("Failed to fetch report:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchExisting();
  }, [existingReportId]);

  // Load backend data if available, but allow manual overwrite
  useEffect(() => {
    async function loadData() {
      if (mode !== 'editing' || report.isManual || existingReportId) return;
      setLoading(true);
      try {
        const stats = await calculateAttendanceStats(client.id!);
        const defaultHighlights = machines
          .filter(m => m.name.toLowerCase().includes('leg press') || m.name.toLowerCase().includes('row') || m.name.toLowerCase().includes('chest'))
          .slice(0, 3)
          .map(m => m.id!);
        
        const deltas = await calculateHighlightedMovements(client.id!, defaultHighlights);

        setReport(prev => ({
          ...prev,
          attendance: {
            score: stats.attendanceScore,
            totalSessions: stats.totalSessionsCompleted,
            avgDuration: stats.avgDuration,
            punctuality: stats.punctualityNarrative,
            narrative: stats.attendanceScore >= 90 
              ? `Incredible commitment! ${client.firstName} is showing model consistency.` 
              : `Showing up regularly. ${stats.punctualityNarrative}`
          },
          highlights: deltas.map(d => ({
            machineId: d.machineId,
            label: d.machineName,
            featuredMetric: 'weight' as const,
            startValue: `${d.startingWeight} lbs`,
            currentValue: `${d.currentWeight} lbs`
          })).concat(Array(3 - deltas.length).fill({ label: '', startValue: '', currentValue: '', featuredMetric: 'weight' })).slice(0, 3)
        }));
      } catch (err) {
        console.error("Historical data fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }
    if (mode === 'editing' && !report.isManual) {
      loadData();
    }
  }, [client, machines, mode, report.isManual]);

  // Load history for selection menu
  useEffect(() => {
    async function loadAllHistory() {
      if (!client.id || mode !== 'editing') return;
      const allIds = machines.map(m => m.id!);
      try {
        const deltas = await calculateHighlightedMovements(client.id, allIds);
        const historyMap: Record<string, any> = {};
        deltas.forEach(d => {
          historyMap[d.machineId] = d;
        });
        setMachineHistory(historyMap);
      } catch (err) {
        console.error("Failed to load machine history for selector:", err);
      }
    }
    loadAllHistory();
  }, [client.id, machines, mode]);

  const handleMachineSelect = async (machine: Machine) => {
    if (selectingHighlightIdx === null) return;
    
    const deltas = await calculateHighlightedMovements(client.id!, [machine.id!]);
    const d = deltas[0];
    
    const newHighlights = [...report.highlights];
    newHighlights[selectingHighlightIdx] = {
      machineId: machine.id,
      label: machine.name,
      featuredMetric: 'weight',
      startValue: d ? `${d.startingWeight} lbs` : '—',
      currentValue: d ? `${d.currentWeight} lbs` : '—'
    };
    
    setReport({ ...report, highlights: newHighlights });
    setSelectingHighlightIdx(null);
  };

  const startAuto = () => {
    setReport(prev => ({ ...prev, isManual: false }));
    setMode('editing');
  };

  const startManual = () => {
    setReport(prev => ({ ...prev, isManual: true }));
    setMode('editing');
    setLoading(false);
  };

  const handleSave = async (status: 'Draft' | 'Finalized' = 'Finalized') => {
    setSaving(true);
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      
      // Deep sanity check for numeric fields to prevent Firestore "undefined" errors
      const sanitizedReport = JSON.parse(JSON.stringify({
        ...report,
        status,
        updatedAt: serverTimestamp()
      }));
      
      // Sanitization to prevent Firestore "undefined" errors
      Object.keys(sanitizedReport.performanceMatrix).forEach((key) => {
        if (sanitizedReport.performanceMatrix[key as keyof typeof sanitizedReport.performanceMatrix].score === undefined) {
          (sanitizedReport.performanceMatrix[key as keyof typeof sanitizedReport.performanceMatrix] as any).score = 0;
        }
      });

      sanitizedReport.highlights.forEach((h: any) => {
        if (!h.featuredMetric) h.featuredMetric = 'weight';
        if (h.agePercentile === undefined) delete h.agePercentile;
        if (!h.subjectiveImprovement) delete h.subjectiveImprovement;
      });

      if (report.id) {
        // Update existing
        await updateDoc(doc(db, 'progressReports', report.id), sanitizedReport);
      } else {
        // Create new
        const docRef = await addDoc(collection(db, 'progressReports'), {
          ...sanitizedReport,
          createdAt: serverTimestamp()
        });
        setReport(prev => ({ ...prev, id: docRef.id }));
      }
      
      if (status === 'Finalized') {
        setShowExportOptions(true);
        setMode('view');
      } else {
        alert("Draft saved successfully.");
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert(`Save Error: ${err instanceof Error ? err.message : 'Unknown Error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    alert(`Report ready! Emailing as PDF to ${client.email || 'the client'}...`);
  };

  if (mode === 'selection') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 space-y-8 max-w-2xl mx-auto text-center">
        <div className="space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Award className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">Initialize Report</h2>
          <p className="text-muted-foreground font-medium">Choose your documentation methodology for {client.firstName} {client.lastName}.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <button 
            onClick={startAuto}
            className="flex flex-col items-center p-8 bg-card border-2 border-primary/20 rounded-[40px] hover:border-primary transition-all group hover:shadow-2xl hover:shadow-primary/5 text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-black uppercase italic mb-2">Auto-Populate</h3>
            <p className="text-xs text-muted-foreground font-medium">Scan database for sessions, lift deltas, and punctuality patterns.</p>
          </button>

          <button 
            onClick={startManual}
            className="flex flex-col items-center p-8 bg-card border-2 border-dashed border-muted rounded-[40px] hover:border-primary transition-all group hover:shadow-2xl text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-black uppercase italic mb-2">Manual Entry</h3>
            <p className="text-xs text-muted-foreground font-medium">Start with a blank canvas. Ideal if client data is stored on external platforms.</p>
          </button>
        </div>

        <Button variant="ghost" onClick={onBack} className="rounded-xl font-bold uppercase text-[10px] tracking-widest no-print">
          <ArrowLeft className="w-4 h-4 mr-2" /> Cancel
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <TrendingUp className="w-16 h-16 text-primary opacity-20" />
        </motion.div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Scanning Bio-Metrics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A2E46] w-full relative sm:py-8 lg:py-12 -m-4 p-4 sm:m-0 sm:p-0">
      {/* Dynamic Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            padding: 40px;
            background: white !important;
            color: black !important;
          }
          .no-print { display: none !important; }
          .rounded-[40px] { border-radius: 12px !important; }
          .shadow-xl, .shadow-2xl { box-shadow: none !important; }
          .bg-muted/20, .bg-primary/5 { background-color: #f9f9f9 !important; border: 1px solid #eee; }
          .text-primary { color: #000 !important; }
          button { display: none !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-6 pb-32">
        {/* Navigation & Actions */}
        <div className="flex justify-between items-center no-print bg-[#FAF9F6]/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-slate-200/50 shadow-lg shadow-black/10 shrink-0 sticky top-4 z-50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full w-8 h-8 text-[#68717A] hover:bg-slate-200/50">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-base font-black uppercase tracking-tight text-[#115E8D] leading-none">Report Creator</h1>
              <p className="text-[10px] font-bold text-[#68717A] uppercase tracking-widest mt-1 leading-none">Phase: Documentation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'editing' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSave('Draft')} 
                disabled={saving}
                className="h-8 md:h-9 text-[10px] font-bold uppercase tracking-wider border-slate-300 text-slate-600 hover:bg-slate-100 bg-transparent"
              >
                Save Draft
              </Button>
            )}
            {mode === 'view' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMode('editing')} 
                className="h-8 md:h-9 text-[10px] font-bold uppercase tracking-wider border-slate-300 text-slate-600 hover:bg-slate-100 bg-transparent"
              >
                Resume Editing
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 md:h-9 text-[10px] font-bold uppercase tracking-wider border-slate-300 text-slate-600 hover:bg-slate-100 bg-transparent">
               Print Preview
            </Button>
            {mode === 'editing' && (
              <Button 
                disabled={saving} 
                onClick={() => handleSave('Finalized')}
                className="h-8 md:h-9 px-4 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-b from-[#F06C22] to-[#D95B16] hover:from-[#F27E3B] hover:to-[#F06C22] text-white shadow-[0_4px_15px_rgba(240,108,34,0.4)] border border-[#F06C22]/50 transition-all"
              >
                {saving ? 'Saving...' : 'Finalize & Present'}
              </Button>
            )}
          </div>
        </div>

        {/* --- PHYSICAL REPORT START --- */}
        <div className={`print-area space-y-5 ${mode === 'view' ? 'pointer-events-none' : ''}`}>
          
          {/* Header Card */}
          <div className="bg-[#FAF9F6] p-4 rounded-xl border border-white/40 shadow-xl shadow-black/20 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-[#115E8D]">CLIENT PROGRESS REPORT</h2>
              <div className="flex items-baseline gap-4 mt-2">
                <p className="text-[11px] font-bold uppercase text-[#115E8D]"><span className="text-[#68717A] text-[9px] tracking-widest mr-1">TRAINER:</span> {trainer.fullName}</p>
                <p className="text-[11px] font-bold uppercase text-[#115E8D]"><span className="text-[#68717A] text-[9px] tracking-widest mr-1">CLIENT:</span> {client.firstName} {client.lastName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase text-[#68717A]">
                {new Date(report.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* STEP 1: Attendance & Consistency */}
          <div className="bg-[#FAF9F6] p-5 md:p-6 rounded-2xl border border-white/60 shadow-xl shadow-black/20 relative">
            <h3 className="text-lg font-black uppercase tracking-tight text-[#115E8D] mb-4">Attendance & Dedication</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-200/40 rounded-xl p-3 border border-slate-300/60 flex flex-col justify-center">
                  <span className="text-[9px] font-black uppercase text-[#68717A] tracking-wider mb-1 block">TOTAL SESSIONS</span>
                  <Input 
                    type="number" 
                    className="h-9 text-sm font-medium border-slate-300/80 bg-slate-100/80 placeholder:text-slate-400 focus-visible:ring-[#115E8D]" 
                    value={report.attendance.totalSessions} 
                    onChange={(e) => setReport({ ...report, attendance: { ...report.attendance, totalSessions: parseInt(e.target.value) || 0 }})} 
                  />
                </div>
                <div className="flex-1 bg-slate-200/40 rounded-xl p-3 border border-slate-300/60 flex flex-col justify-center">
                  <span className="text-[9px] font-black uppercase text-[#68717A] tracking-wider mb-1 block">CONSISTENCY %</span>
                  <Input 
                    type="number" 
                    className="h-9 text-sm font-medium border-slate-300/80 bg-slate-100/80 placeholder:text-slate-400 focus-visible:ring-[#115E8D]" 
                    value={report.attendance.score} 
                    onChange={(e) => setReport({ ...report, attendance: { ...report.attendance, score: parseInt(e.target.value) || 0 }})} 
                  />
                </div>
                <div className="flex-1 bg-slate-200/40 rounded-xl p-3 border border-slate-300/60 flex flex-col justify-center">
                  <span className="text-[9px] font-black uppercase text-[#68717A] tracking-wider mb-1 block">AVG DURATION</span>
                  <Input 
                    type="number" 
                    className="h-9 text-sm font-medium border-slate-300/80 bg-slate-100/80 placeholder:text-slate-400 focus-visible:ring-[#115E8D]" 
                    value={report.attendance.avgDuration} 
                    onChange={(e) => setReport({ ...report, attendance: { ...report.attendance, avgDuration: parseInt(e.target.value) || 0 }})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <Label className="text-[9px] font-black uppercase text-[#68717A] tracking-wider ml-1 block">Punctuality Pattern (e.g., consistently 5 mins early)</Label>
                   <Input 
                     className="h-9 text-sm font-medium border-slate-300/80 bg-slate-200/60 placeholder:text-[#68717A]/60 focus-visible:ring-[#115E8D]" 
                     placeholder="Consistently early..."
                     value={report.attendance.punctuality} 
                     onChange={(e) => setReport({ ...report, attendance: { ...report.attendance, punctuality: e.target.value }})} 
                   />
                </div>
                <div className="space-y-1">
                   <Label className="text-[9px] font-black uppercase text-[#68717A] tracking-wider ml-1 block">Trainer Narrative (Overall dedication notes)</Label>
                   <Input 
                     className="h-9 text-sm font-medium border-slate-300/80 bg-slate-200/60 placeholder:text-[#68717A]/60 focus-visible:ring-[#115E8D]" 
                     placeholder="Overall notes on dedication..."
                     value={report.attendance.narrative} 
                     onChange={(e) => setReport({ ...report, attendance: { ...report.attendance, narrative: e.target.value }})} 
                   />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Highlighted Movements */}
          <div className="bg-[#FAF9F6] p-5 md:p-6 rounded-2xl border border-white/60 shadow-xl shadow-black/20 relative">
            <h3 className="text-lg font-black uppercase tracking-tight text-[#115E8D] mb-4">HIGHLIGHTED MOVEMENTS</h3>
            <div className="space-y-3">
               {report.highlights.map((highlight, idx) => (
                 <div key={idx} className="flex flex-col md:flex-row items-center gap-3 bg-slate-200/30 border border-slate-300/40 rounded-xl p-3">
                    <div className="w-full md:w-[220px] shrink-0 relative">
                       <Label className="text-[9px] font-black uppercase tracking-wider text-[#68717A] block ml-1 mb-1">Target Machine</Label>
                       <div className="relative">
                         <select 
                           className="w-full h-9 text-xs font-black uppercase bg-slate-200/80 border border-slate-300/80 rounded-lg pl-3 pr-8 text-[#68717A] appearance-none focus:outline-none focus:ring-1 focus:ring-[#115E8D]" 
                           value={highlight.machineId || ""} 
                           onChange={(e) => {
                             const m = machines.find(x => x.id === e.target.value);
                             if (m) {
                                const newH = [...report.highlights];
                                newH[idx] = { ...newH[idx], machineId: m.id, label: m.name };
                                setReport({ ...report, highlights: newH });
                             }
                           }}
                         >
                            <option value="" disabled className="text-slate-400">Select Machine...</option>
                            {machines.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                         </select>
                         <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[#115E8D]" />
                       </div>
                    </div>
                    <div className="w-full md:w-[180px] shrink-0 relative">
                       <Label className="text-[9px] font-black uppercase tracking-wider text-[#68717A] block ml-1 mb-1">Metric Type</Label>
                       <div className="relative">
                         <select 
                           className="w-full h-9 text-xs font-bold uppercase bg-slate-200/80 border border-slate-300/80 rounded-lg pl-3 pr-8 text-[#68717A] appearance-none focus:outline-none focus:ring-1 focus:ring-[#115E8D]" 
                           value={highlight.featuredMetric} 
                           onChange={(e) => {
                               const newH = [...report.highlights];
                               newH[idx].featuredMetric = e.target.value as any;
                               setReport({ ...report, highlights: newH });
                           }}
                         >
                           <option value="weight">Strength/Weight Stats</option>
                           <option value="percentile">Age Group Comparison</option>
                           <option value="subjective">Subjective Technique</option>
                         </select>
                         <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[#68717A]" />
                       </div>
                    </div>
                    
                    <div className="flex-1 w-full relative self-end">
                       {highlight.featuredMetric === 'weight' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                               <span className="text-[9px] font-black uppercase tracking-wider text-[#68717A] block ml-1">Starting Weight</span>
                               <Input 
                                 className="h-9 text-sm font-medium border-slate-300/80 bg-slate-200/60 placeholder:text-[#68717A]/60 focus-visible:ring-[#115E8D]" 
                                 placeholder="e.g. 100 lbs" 
                                 value={highlight.startValue} 
                                 onChange={(e) => {
                                    const newH = [...report.highlights];
                                    newH[idx].startValue = e.target.value;
                                    setReport({ ...report, highlights: newH });
                                 }} 
                               />
                            </div>
                            <div className="space-y-1">
                               <span className="text-[9px] font-black uppercase tracking-wider text-[#68717A] block ml-1">Current Weight</span>
                               <Input 
                                 className="h-9 text-sm font-bold border-slate-300/80 bg-slate-200/60 text-[#68717A] placeholder:text-[#68717A]/60 focus-visible:ring-[#115E8D]" 
                                 placeholder="e.g. 120 lbs" 
                                 value={highlight.currentValue} 
                                 onChange={(e) => {
                                    const newH = [...report.highlights];
                                    newH[idx].currentValue = e.target.value;
                                    setReport({ ...report, highlights: newH });
                                 }} 
                               />
                            </div>
                          </div>
                       )}
                       {highlight.featuredMetric === 'percentile' && (
                          <div className="flex items-center gap-3 w-full border border-slate-300/60 bg-slate-200/40 rounded-lg p-2 px-3 mt-4">
                             <Label className="text-[9px] font-black uppercase text-[#68717A] whitespace-nowrap">Percentile Rank</Label>
                             <Slider 
                               value={[highlight.agePercentile || 0]} 
                               max={100} 
                               onValueChange={(v) => {
                                 const newH = [...report.highlights];
                                 newH[idx].agePercentile = v[0];
                                 setReport({ ...report, highlights: newH });
                               }}
                               className="flex-1 cursor-pointer"
                             />
                             <span className="text-[10px] font-black text-[#115E8D] w-8 text-right bg-white px-1 py-0.5 rounded shadow-sm">{highlight.agePercentile || 0}%</span>
                          </div>
                       )}
                       {highlight.featuredMetric === 'subjective' && (
                          <div className="flex gap-2 w-full pt-4">
                            <div className="relative w-1/3">
                              <select 
                                 className="w-full h-9 text-[#68717A] text-xs font-bold uppercase bg-slate-200/80 border border-slate-300/80 rounded-lg pl-2 pr-7 appearance-none focus:outline-none focus:ring-1 focus:ring-[#115E8D]"
                                 value={highlight.subjectiveImprovement?.p || ''}
                                 onChange={(e) => {
                                    const newH = [...report.highlights];
                                    newH[idx].subjectiveImprovement = { 
                                      p: e.target.value as any, 
                                      note: newH[idx].subjectiveImprovement?.note || '' 
                                    };
                                    setReport({ ...report, highlights: newH });
                                 }}
                              >
                                 <option value="" disabled>Select Pillar...</option>
                                 <option value="Posture">Posture</option>
                                 <option value="Pace">Pace</option>
                                 <option value="Path">Path</option>
                                 <option value="Purpose">Purpose</option>
                              </select>
                              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[#115E8D]" />
                            </div>
                            <Input 
                               placeholder="Observation notes..." 
                               className="h-9 flex-1 text-sm font-medium border-slate-300/80 bg-slate-200/60 placeholder:text-[#68717A]/60 focus-visible:ring-[#115E8D]"
                               value={highlight.subjectiveImprovement?.note || ''}
                               onChange={(e) => {
                                  const newH = [...report.highlights];
                                  if (!newH[idx].subjectiveImprovement) {
                                     newH[idx].subjectiveImprovement = { p: 'Posture', note: '' };
                                  }
                                  newH[idx].subjectiveImprovement!.note = e.target.value;
                                  setReport({ ...report, highlights: newH });
                               }}
                            />
                          </div>
                       )}
                    </div>
                 </div>
               ))}
            </div>
          </div>

          {/* STEP 3: The 4 P's */}
          <div className="bg-[#FAF9F6] p-5 md:p-6 rounded-2xl border border-white/60 shadow-xl shadow-black/20 relative">
            <h3 className="text-lg font-black uppercase tracking-tight text-[#115E8D] mb-4">THE 4 P'S: TECHNICAL PROFICIENCY</h3>
            <div className="flex flex-col divide-y divide-slate-200">
              {(['posture', 'pace', 'path', 'purpose'] as const).map((p, idx) => (
                <div key={p} className={`py-4 ${idx === 0 ? 'pt-0' : ''} ${idx === 3 ? 'pb-0' : ''} flex flex-col gap-2 relative`}>
                  <h4 className="text-[10px] font-black uppercase text-[#115E8D] tracking-widest flex justify-between items-center mb-1">
                    {p}
                    <span className="text-[10px] text-[#F06C22] bg-[#F06C22]/10 px-1.5 py-0.5 rounded">{report.performanceMatrix[p].score}%</span>
                  </h4>
                  <div className="px-1 py-1">
                    <Slider 
                      value={[report.performanceMatrix[p].score]} 
                      max={100} 
                      onValueChange={(v) => {
                        const val = Array.isArray(v) ? v[0] : v;
                        const newScore = typeof val === 'number' ? val : 0;
                        setReport(prev => ({
                          ...prev,
                          performanceMatrix: {
                            ...prev.performanceMatrix,
                            [p]: { ...prev.performanceMatrix[p], score: newScore }
                          }
                        }));
                      }}
                      className="cursor-pointer mb-2" 
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-1">
                    {report.performanceMatrix[p].talkingPoints.map((tp, tpIdx) => (
                      <button 
                        key={tp.id} 
                        onClick={() => {
                          const statuses: ('red' | 'black' | 'green')[] = ['black', 'green', 'red'];
                          const nextStatus = statuses[(statuses.indexOf(tp.status) + 1) % 3];
                          const newTPs = [...report.performanceMatrix[p].talkingPoints];
                          newTPs[tpIdx].status = nextStatus;
                          setReport({
                            ...report,
                            performanceMatrix: {
                              ...report.performanceMatrix,
                              [p]: { ...report.performanceMatrix[p], talkingPoints: newTPs }
                            }
                          });
                        }}
                        className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-colors ${
                          tp.status === 'green' 
                            ? 'bg-[#115E8D] text-white border-[#115E8D] shadow-sm'
                            : tp.status === 'red'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-slate-200/50 text-slate-500 border-slate-300 hover:border-slate-400 focus:outline-[#115E8D]'
                        }`}
                      >
                        {tp.text}
                      </button>
                    ))}
                  </div>
                  <Input 
                    placeholder="Additional technical notes..." 
                    className="h-9 text-[11px] mt-2 bg-slate-200/60 border-slate-300/80 placeholder:text-[#68717A]/60 text-[#68717A] font-medium focus-visible:ring-[#115E8D]" 
                    value={report.performanceMatrix[p].note} 
                    onChange={(e) => setReport({
                      ...report,
                      performanceMatrix: {
                        ...report.performanceMatrix,
                        [p]: { ...report.performanceMatrix[p], note: e.target.value }
                      }
                    })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* STEP 4 & 5: FUTURE STRATEGY WRAPPER */}
          <div className="bg-[#031525]/30 p-5 md:p-6 rounded-3xl border border-white/5 relative flex flex-col items-center shadow-inner">
            
            {/* Section 4 Card (THE GOAL) */}
            <div className="bg-[#FAF9F6] p-5 md:p-6 rounded-2xl border border-white/60 shadow-xl shadow-black/20 w-full relative z-10">
              <h3 className="text-lg font-black uppercase tracking-tight text-[#115E8D] mb-4">THE GOAL</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-[#68717A] ml-1 block">Original Reason for Training</Label>
                  <Textarea 
                    className="min-h-[60px] text-sm font-medium border-slate-300/80 bg-slate-200/60 placeholder:text-[#68717A]/60 focus-visible:ring-[#115E8D]" 
                    placeholder="Auto-populated or typed here..."
                    value={report.milestones.originalWhy} 
                    onChange={(e) => setReport({ ...report, milestones: { ...report.milestones, originalWhy: e.target.value }})}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-[#68717A] ml-1 block">Next Live-Event Milestone (SMART Goal)</Label>
                  <Input 
                    className="h-10 text-sm font-black border-[#F06C22] bg-orange-50/50 text-[#F06C22] placeholder:text-orange-300/80 focus-visible:ring-[#F06C22] focus-visible:ring-offset-0 focus-visible:border-[#F06C22]" 
                    placeholder="e.g. Ski trip ready"
                    value={report.milestones.smartGoal} 
                    onChange={(e) => setReport({ ...report, milestones: { ...report.milestones, smartGoal: e.target.value }})}
                  />
                  <p className="text-[7.5px] font-bold uppercase tracking-widest text-[#68717A]/70 ml-1 pt-1">Specific • Measurable • Achievable • Relevant • Time-Bound</p>
                </div>
              </div>
            </div>

            {/* Visual Connector */}
            <div className="flex flex-col items-center justify-center my-3 relative z-0">
               <div className="w-[2px] h-4 bg-white/20"></div>
               <ArrowDown className="text-white/40 w-5 h-5 -mt-1" strokeWidth={3} />
            </div>

            {/* Section 5 Card (THE PLAN) */}
            <div className="bg-[#FAF9F6] p-5 md:p-6 rounded-2xl border border-white/60 shadow-xl shadow-black/20 w-full relative z-10">
              <h3 className="text-lg font-black uppercase tracking-tight text-[#115E8D] mb-4">THE PLAN</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1 relative">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-[#68717A] ml-1 block">Next Operational Plan</Label>
                  <div className="relative">
                    <select 
                      className="w-full h-10 text-xs font-black uppercase bg-slate-200/80 border border-slate-300/80 rounded-lg pl-3 pr-8 text-[#68717A] appearance-none focus:outline-none focus:ring-1 focus:ring-[#115E8D]" 
                      value={report.strategy.primaryPlan}
                      onChange={(e) => setReport({ ...report, strategy: { ...report.strategy, primaryPlan: e.target.value }})}
                    >
                        <option value="Routine Mastery">Routine Mastery</option>
                        <option value="Advanced Load Optimization">Advanced Load Optimization</option>
                        <option value="Hyper-Frequency Mode">Hyper-Frequency Mode</option>
                        <option value="Protocol Reset / Onboarding">Protocol Reset / Onboarding</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[#115E8D]/60 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-wider text-[#68717A] ml-1 block">Immediate Focus Areas (Next 12 Sessions)</Label>
                  <Textarea 
                    className="min-h-[80px] text-sm font-medium border-slate-300/80 bg-slate-200/60 placeholder:text-[#68717A]/60 focus-visible:ring-[#115E8D]" 
                    placeholder="List focus areas..."
                    value={report.strategy.focusAreas} 
                    onChange={(e) => setReport({ ...report, strategy: { ...report.strategy, focusAreas: e.target.value }})}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* --- PHYSICAL REPORT END --- */}
      </div>

      {/* Success Dialog */}
      <Dialog open={showExportOptions} onOpenChange={setShowExportOptions}>
        <DialogContent className="max-w-md rounded-[40px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-zinc-950 p-10 text-center text-white space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500 mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-10 h-10 stroke-[3px]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Report Finalized</h2>
              <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed">
                Progress evaluation for {client.firstName} has been stored securely in their digital profile.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-4">
              <Button onClick={handlePrint} className="h-14 rounded-2xl font-black uppercase italic tracking-widest gap-2 bg-white text-zinc-950 hover:bg-zinc-200">
                <Printer className="w-5 h-5" /> Print Physical Copy
              </Button>
              {client.email && (
                <Button onClick={handleEmail} variant="outline" className="h-14 rounded-2xl font-black uppercase italic tracking-widest gap-2 bg-transparent border-2 border-white/20 text-white hover:bg-white/5">
                  <Mail className="w-5 h-5" /> Email Digital PDF
                </Button>
              )}
              <Button variant="ghost" onClick={onBack} className="h-12 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] text-zinc-500 hover:text-white">
                Back to Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Machine Selection Dialog */}
      <Dialog open={selectingHighlightIdx !== null} onOpenChange={() => setSelectingHighlightIdx(null)}>
        <DialogContent className="max-w-md rounded-[40px] p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[80vh]">
          <DialogHeader className="bg-primary p-8 text-white shrink-0">
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Select Highlighted Movement</DialogTitle>
            <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest">
              Choose the machine to display in slot #{selectingHighlightIdx !== null ? selectingHighlightIdx + 1 : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {machines.map((m) => {
              const history = machineHistory[m.id!];
              
              return (
                <button
                  key={m.id}
                  onClick={() => handleMachineSelect(m)}
                  className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-muted transition-all text-left border-2 border-transparent hover:border-primary/20 group"
                >
                  <div>
                    <p className="font-black uppercase italic tracking-tight">{m.name}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{m.order} • Standard Protocol</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {history && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Zap className="w-3 h-3 text-primary" />
                          <p className="text-xs font-black italic">{history.currentWeight} lbs</p>
                        </div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">
                          {history.currentReps} reps • Q{history.currentQuality}
                        </p>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
