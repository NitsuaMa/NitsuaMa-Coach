import React from 'react';
import { 
  UserCircle, 
  Calendar, 
  History, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScheduleEntry, WorkoutSession, Client, Trainer } from '../types';

interface TrainerProfileViewProps {
  trainer: Trainer;
  schedules: ScheduleEntry[];
  sessions: WorkoutSession[];
  clients: Client[];
  onSelectClient: (clientId: string) => void;
  setView: (view: any) => void;
}

export function TrainerProfileView({ 
  trainer, 
  schedules, 
  sessions, 
  clients, 
  onSelectClient, 
  setView 
}: TrainerProfileViewProps) {
  const now = new Date();

  // Filter schedules for this trainer
  const upcomingSchedules = schedules.filter(s => {
    const sDate = s.startTime.toDate();
    const isTrainerMatch = s.trainerId === trainer.id || 
                          (s.trainerName && s.trainerName.toLowerCase().includes(trainer.fullName.toLowerCase()));
    return isTrainerMatch && sDate >= now && s.status !== 'Cancelled' && s.status !== 'Completed';
  }).sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime());

  // Filter completed sessions for this trainer
  const recentSessions = sessions.filter(s => 
    s.trainerInitials === trainer.initials && s.status === 'Completed'
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-4xl mx-auto space-y-8 pb-20"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 shadow-xl shadow-primary/5">
            <UserCircle className="w-12 h-12" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 italic leading-none">Studio Professional</p>
            <h2 className="text-4xl font-black tracking-tighter uppercase italic text-foreground">{trainer.fullName}</h2>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className="rounded-md border-primary/20 text-primary font-black uppercase text-[9px] h-5">
                {trainer.initials}
              </Badge>
              {trainer.isOwner && (
                <Badge className="rounded-md bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[9px] h-5">
                  Owner
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Upcoming Schedule */}
        <Card className="border-2 shadow-xl rounded-[40px] overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-3xl bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black italic uppercase">Training Next</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Upcoming clients from MindBody</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {upcomingSchedules.length > 0 ? (
                upcomingSchedules.slice(0, 10).map((s, i) => {
                  const sTime = s.startTime.toDate();
                  const isToday = sTime.toDateString() === now.toDateString();
                  
                  return (
                    <motion.div 
                      key={s.id || i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-5 bg-card border-2 border-muted hover:border-primary/30 transition-all rounded-3xl group cursor-pointer"
                      onClick={() => {
                        if (s.clientId) {
                          onSelectClient(s.clientId);
                          setView('workouts');
                        }
                      }}
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-lg uppercase italic tracking-tight truncate">{s.clientName}</p>
                          {isToday && (
                            <Badge className="bg-rose-500 text-white font-black uppercase text-[8px] h-4 py-0">Today</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase">
                              {sTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase">
                              {sTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-[32px] flex flex-col items-center gap-4 opacity-50">
                  <Calendar className="w-12 h-12 text-muted-foreground" />
                  <p className="text-xs font-black uppercase tracking-widest leading-relaxed">No upcoming sessions<br/>found in schedule.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recently Trained */}
        <Card className="border-2 shadow-xl rounded-[40px] overflow-hidden border-emerald-200">
          <CardHeader className="bg-emerald-50/50 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-3xl bg-emerald-100 flex items-center justify-center">
                <History className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black italic uppercase text-emerald-950">Recently Trained</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Sessions logged recently</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {recentSessions.length > 0 ? (
                recentSessions.slice(0, 10).map((s, i) => {
                  const client = clients.find(c => c.id === s.clientId);
                  const sessionDate = new Date(s.date + 'T00:00:00');
                  
                  return (
                    <motion.div 
                      key={s.id || i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-5 bg-card border-2 border-emerald-100 hover:border-emerald-300 transition-all rounded-3xl group cursor-pointer"
                      onClick={() => {
                        if (s.clientId) {
                          onSelectClient(s.clientId);
                          setView('history');
                        }
                      }}
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-lg uppercase italic tracking-tight truncate">
                            {client ? `${client.firstName} ${client.lastName}` : 'System Log'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-emerald-600/60">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase">
                              {sessionDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className="bg-emerald-100 text-emerald-700 font-black uppercase text-[8px] h-5 py-0 px-2 tracking-widest border border-emerald-200">
                          LOGGED
                        </Badge>
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-20 bg-emerald-50/30 border-2 border-dashed border-emerald-200 rounded-[32px] flex flex-col items-center gap-4 opacity-50">
                  <TrendingDown className="w-12 h-12 text-emerald-600" />
                  <p className="text-xs font-black uppercase tracking-widest leading-relaxed text-emerald-950/60">No recent activity<br/>recorded yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={() => setView('calendar')}
          className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs border-2 hover:bg-primary/5 hover:text-primary transition-all"
        >
          View Full Studio Calendar
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}
