
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2,
  CalendarDays,
  Users,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ScheduleEntry, Trainer } from '../types';
import { cn } from '../lib/utils';

export function CalendarView({ 
  schedules, 
  trainers,
  authTrainer,
  isAdmin,
  onSelectClient,
  setView,
  clients
}: { 
  schedules: ScheduleEntry[], 
  trainers: Trainer[],
  authTrainer: Trainer | null,
  isAdmin: boolean,
  onSelectClient?: (id: string) => void,
  setView?: (view: any) => void,
  clients?: any[]
}) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>(
    isAdmin ? 'all' : (authTrainer?.id || 'all')
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await axios.post('/api/trigger-master-sync', { hardReset: false });
      setTimeout(() => setIsSyncing(false), 2000);
    } catch (err) {
      console.error('Sync failed:', err);
      setIsSyncing(false);
    }
  };

  // Optimization: Group trainers by name for faster lookup
  const trainerMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    trainers.forEach(t => {
      map[t.fullName] = t.id!;
    });
    return map;
  }, [trainers]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const safeToDate = (time: any) => {
    if (!time) return new Date();
    if (typeof time.toDate === 'function') return time.toDate();
    const d = new Date(time);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const getSlotHeader = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const handlePrev = () => {
    const prev = new Date(selectedDate);
    if (viewMode === 'month') prev.setMonth(selectedDate.getMonth() - 1);
    else if (viewMode === 'week') prev.setDate(selectedDate.getDate() - 7);
    else if (viewMode === 'day') prev.setDate(selectedDate.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNext = () => {
    const next = new Date(selectedDate);
    if (viewMode === 'month') next.setMonth(selectedDate.getMonth() + 1);
    else if (viewMode === 'week') next.setDate(selectedDate.getDate() + 7);
    else if (viewMode === 'day') next.setDate(selectedDate.getDate() + 1);
    setSelectedDate(next);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  };

  const AM_SLOTS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
  const PM_SLOTS = ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'];

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const handleClientClick = (session: ScheduleEntry) => {
    if (onSelectClient && setView) {
      const clientName = session.clientName || '';
      const client = clients?.find(c => 
        c.id === session.clientId || 
        c.mindbody_name?.toLowerCase() === clientName.toLowerCase() ||
        `${c.firstName} ${c.lastName}`.toLowerCase() === clientName.toLowerCase()
      );
      if (client) {
        onSelectClient(client.id!);
        setView('profile');
      }
    }
  };

  const renderMonth = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = firstDayOfMonth(year, month);
    const totalDays = daysInMonth(year, month);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const prevMonthDays = daysInMonth(year, month - 1);
    const matrix: { num: number, current: boolean, date: Date }[] = [];

    for (let i = 0; i < 42; i++) {
        const dayNum = i - firstDay + 1;
        if (dayNum <= 0) {
            matrix.push({ num: prevMonthDays + dayNum, current: false, date: new Date(year, month - 1, prevMonthDays + dayNum) });
        } else if (dayNum > totalDays) {
            matrix.push({ num: dayNum - totalDays, current: false, date: new Date(year, month + 1, dayNum - totalDays) });
        } else {
            matrix.push({ num: dayNum, current: true, date: new Date(year, month, dayNum) });
        }
    }

    const filteredSchedules = schedules.filter(s => {
      const tId = trainerMap[s.trainerName];
      const trainerMatches = selectedTrainerId === 'all' || tId === selectedTrainerId;
      return s.status !== 'Cancelled' && trainerMatches;
    });

    return (
      <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-px bg-border border rounded-3xl overflow-hidden shadow-xl">
        <div className="bg-muted/30 border-r border-b" />
        {dayNames.map(d => (
          <div key={d} className="bg-muted/50 p-4 text-center border-b">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{d}</span>
          </div>
        ))}
        {matrix.map((day, idx) => {
          const today = isToday(day.date);
          const daySessions = filteredSchedules.filter(s => {
            const d = safeToDate(s.startTime);
            return isSameDay(d, day.date);
          });

          const isRowStart = idx % 7 === 0;

          return (
            <React.Fragment key={idx}>
              {isRowStart && (
                <div 
                  className="bg-muted/5 border-r flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors group/week"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate(day.date);
                    setViewMode('week');
                  }}
                >
                  <span className="text-[8px] font-black uppercase -rotate-90 text-muted-foreground/30 group-hover/week:text-primary transition-colors">Week</span>
                </div>
              )}
              <div 
                className={cn(
                  "min-h-[110px] p-2 bg-background transition-all group relative cursor-pointer",
                  !day.current ? 'opacity-20 grayscale' : 'hover:bg-primary/[0.02]',
                  today && 'bg-primary/[0.01]'
                )}
                onClick={() => {
                  if (day.current) {
                    setSelectedDate(day.date);
                    setViewMode('day');
                  }
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-xs font-black w-6 h-6 flex items-center justify-center rounded-full transition-all",
                    today ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground'
                  )}>
                    {day.num}
                  </span>
                </div>
                
                {day.current && (
                  <div className="space-y-1 mt-2">
                    {daySessions.length > 0 ? (
                      <Badge variant="secondary" className="w-full justify-center text-[9px] font-black uppercase tracking-tighter bg-primary/10 text-primary border-none py-1">
                        {daySessions.length} sessions
                      </Badge>
                    ) : (
                      <span className="text-[8px] text-muted-foreground/20 font-bold uppercase block text-center mt-4 italic">Empty</span>
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderWeek = () => {
    const weekDays = getWeekDays(selectedDate);
    const allSlots = [...AM_SLOTS, ...PM_SLOTS];

    // Pre-filter sessions for this week to improve performance
    const weekStart = weekDays[0];
    const weekEnd = new Date(weekDays[6]);
    weekEnd.setHours(23, 59, 59, 999);

    const activeSessions = schedules.filter(s => {
      const d = safeToDate(s.startTime);
      return d >= weekStart && d <= weekEnd && s.status !== 'Cancelled';
    });

    return (
      <div className="bg-card border-2 rounded-[32px] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r w-24 sticky left-0 bg-background z-10 text-center">Time</th>
                {weekDays.map((date, idx) => {
                  const active = isToday(date);
                  return (
                    <th key={`week-day-${idx}`} className={cn("p-4 text-center min-w-[140px]", active && 'bg-primary/5')}>
                      <p className={cn("text-[10px] font-black uppercase tracking-widest", active ? 'text-primary' : 'text-muted-foreground')}>
                        {date.toLocaleDateString(undefined, { weekday: 'short' })}
                      </p>
                      <p className={cn("text-lg font-black", active ? 'text-primary' : 'text-foreground')}>{date.getDate()}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allSlots.map((slot, sIdx) => {
                const isGap = slot === '15:00' && sIdx > 0;
                return (
                  <React.Fragment key={`week-slot-${slot}`}>
                    {isGap && (
                      <tr className="bg-muted/10 h-8 border-y">
                        <td colSpan={8} className="text-center">
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">Midday Gap</span>
                        </td>
                      </tr>
                    )}
                    <tr className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                      <td className="p-3 text-center border-r sticky left-0 bg-background z-10">
                        <span className="text-[10px] font-black tracking-tighter text-muted-foreground">{slot}</span>
                      </td>
                      {weekDays.map((date, dIdx) => {
                        const daySessions = activeSessions.filter(s => {
                          const d = safeToDate(s.startTime);
                          const tStr = getSlotHeader(d);
                          const tId = trainerMap[s.trainerName];
                          const trainerMatches = selectedTrainerId === 'all' || tId === selectedTrainerId;
                          return isSameDay(d, date) && tStr === slot && trainerMatches;
                        });

                        return (
                          <td 
                            key={`week-cell-${dIdx}-${slot}`} 
                            className="p-1 border-r last:border-r-0 min-h-[44px] cursor-pointer"
                            onClick={() => {
                                setSelectedDate(date);
                                setViewMode('day');
                            }}
                          >
                            <div className="flex flex-col gap-1">
                              {daySessions.map((session, sessIdx) => (
                                <div
                                  key={session.id || `sess-${sessIdx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClientClick(session);
                                  }}
                                  className={cn(
                                    "px-2 py-1 rounded-lg border text-[9px] font-bold flex flex-col gap-0.5 transition-all shadow-sm",
                                    session.status === 'Completed' 
                                      ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-700/60' 
                                      : 'bg-primary/5 border-primary/20 text-primary hover:border-primary-foreground hover:bg-primary'
                                  )}
                                >
                                  <span className="truncate">{session.clientName || 'Unknown Client'}</span>
                                  {selectedTrainerId === 'all' && (
                                    <span className="text-[7px] opacity-60 italic">{(session.trainerName || 'Unassigned').split(' ')[0]}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDay = () => {
    const allSlots = [...AM_SLOTS, ...PM_SLOTS];
    const filteredTrainers = selectedTrainerId === 'all' 
      ? trainers 
      : trainers.filter(t => t.id === selectedTrainerId);

    return (
      <div className="bg-card border-2 rounded-[32px] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r w-24 sticky left-0 bg-background z-10">Time</th>
                {filteredTrainers.map((trainer) => (
                  <th key={trainer.id} className="p-4 border-r last:border-r-0 text-center">
                    <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                          {trainer.initials}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider">{trainer.fullName}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSlots.map((slot, sIdx) => {
                const isGap = slot === '15:00' && sIdx > 0;
                return (
                  <React.Fragment key={slot}>
                    {isGap && (
                      <tr className="bg-muted/5 h-8 border-y">
                        <td colSpan={filteredTrainers.length + 1} className="text-center">
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">Break</span>
                        </td>
                      </tr>
                    )}
                    <tr className="border-b last:border-0">
                      <td className="p-3 text-center border-r sticky left-0 bg-background z-10 text-muted-foreground">
                        <span className="text-[10px] font-black tracking-tighter">{slot}</span>
                      </td>
                      {filteredTrainers.map((trainer) => {
                        const session = schedules.find(s => {
                          const d = safeToDate(s.startTime);
                          const tStr = getSlotHeader(d);
                          return isSameDay(d, selectedDate) && tStr === slot && s.trainerName === trainer.fullName && s.status !== 'Cancelled';
                        });

                        return (
                          <td 
                            key={`${trainer.id}-${slot}`} 
                            className="p-2 border-r last:border-r-0 min-h-[60px]"
                          >
                            {session ? (
                              <div
                                onClick={() => handleClientClick(session)}
                                className={cn(
                                  "p-3 rounded-xl border flex flex-col justify-between transition-all cursor-pointer shadow-sm h-full min-h-[60px]",
                                  session.status === 'Completed'
                                    ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-700/60'
                                    : 'bg-primary/5 border-primary/20 hover:border-primary/40'
                                )}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[11px] font-black truncate">{session.clientName}</span>
                                    {session.status === 'Completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                  </div>
                                  <span className="text-[9px] font-bold opacity-60 block truncate">{session.serviceName}</span>
                                </div>
                                <div className="mt-2 flex justify-end">
                                    <Badge variant="outline" className="text-[8px] font-black h-4 px-1 border-current/20">
                                        {session.status.toUpperCase()}
                                    </Badge>
                                </div>
                              </div>
                            ) : (
                                <div className="h-full min-h-[60px] flex items-center justify-center opacity-[0.05]">
                                    <Clock className="w-4 h-4" />
                                </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 w-full overflow-x-hidden px-4 sm:px-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
            <CalendarIcon className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight uppercase italic">
                {viewMode === 'month' ? 'Month View' : viewMode === 'week' ? 'Week View' : 'Day View'}
            </h2>
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em] mt-1 border-l-2 border-primary pl-2">
                {viewMode === 'month' 
                  ? selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                  : viewMode === 'week'
                    ? `${getWeekDays(selectedDate)[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${getWeekDays(selectedDate)[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })
                }
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-muted/30 p-1 rounded-xl border">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSync}
              disabled={isSyncing}
              className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 h-8 gap-2"
            >
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {isSyncing ? 'Syncing' : 'Sync'}
            </Button>
            <div className="w-px h-4 bg-border/40 mx-1 my-auto" />
            <Button 
              variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('month')}
              className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 h-8"
            >
              Month
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('week')}
              className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 h-8"
            >
              Week
            </Button>
            <Button 
              variant={viewMode === 'day' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('day')}
              className="rounded-lg font-black uppercase text-[9px] tracking-widest px-4 h-8"
            >
              Day
            </Button>
          </div>

          <div className="flex items-center bg-muted/30 px-3 py-1 rounded-xl border gap-2">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
              <SelectTrigger className="h-6 border-none bg-transparent focus:ring-0 text-[10px] font-black uppercase tracking-widest min-w-[120px] p-0 shadow-none">
                <SelectValue placeholder="Team Filter" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2">
                {isAdmin && <SelectItem value="all" className="font-bold">Entire Team</SelectItem>}
                {trainers.filter(t => isAdmin || t.id === authTrainer?.id).map(t => (
                  <SelectItem key={t.id} value={t.id!} className="font-bold">{t.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" onClick={handlePrev} className="rounded-xl h-8 w-8 border-2"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" onClick={() => setSelectedDate(new Date())} className="rounded-xl font-black uppercase text-[9px] tracking-widest px-4 h-8 border-2">Today</Button>
            <Button variant="outline" size="icon" onClick={handleNext} className="rounded-xl h-8 w-8 border-2"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode + selectedDate.toISOString() + selectedTrainerId}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
        >
          {viewMode === 'month' && renderMonth()}
          {viewMode === 'week' && renderWeek()}
          {viewMode === 'day' && renderDay()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
