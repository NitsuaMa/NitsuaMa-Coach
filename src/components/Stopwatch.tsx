
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Stopwatch({ 
  initialValue = 0, 
  onSave 
}: { 
  initialValue?: number, 
  onSave: (seconds: number) => void 
}) {
  const [time, setTime] = useState(initialValue);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  const toggle = () => setIsActive(!isActive);

  const reset = () => {
    setIsActive(false);
    setTime(0);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-muted/30 rounded-2xl border-2 border-dashed border-primary/20">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center">
             <span className="text-[8px] font-black uppercase text-primary/60 tracking-widest leading-none mb-1">Duration</span>
             <span className="text-2xl font-black italic tracking-tighter text-primary font-mono tabular-nums">
                {formatTime(time)}
             </span>
        </div>
        <div className="flex gap-1">
          <Button 
            size="icon" 
            variant={isActive ? "destructive" : "default"} 
            className="h-10 w-10 rounded-xl"
            onClick={toggle}
          >
            {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          </Button>
          <Button 
            size="icon" 
            variant="outline" 
            className="h-10 w-10 rounded-xl"
            onClick={reset}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="outline" 
            className="h-10 w-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white border-none"
            onClick={() => onSave(time)}
          >
            <Timer className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
