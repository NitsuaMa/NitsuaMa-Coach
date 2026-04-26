
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, Lock, UserCircle, AlertCircle, Loader2, RefreshCw, Check, Users, LogIn, LogOut } from 'lucide-react';
import { Trainer } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { comparePin } from '../lib/auth-utils';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import { signOut } from 'firebase/auth';
import axios from 'axios';

interface PinLoginViewProps {
  trainers: Trainer[];
  user: any;
  onLogin: (trainer: Trainer) => void;
  isLoading?: boolean;
}

export function PinLoginView({ trainers, user, onLogin, isLoading: initialLoading }: PinLoginViewProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const sortedTrainers = [...trainers].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div 
      className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background focus:outline-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6 relative">
            <Users className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Training Hub</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs mt-2">
            Select your name to start training
          </p>
        </div>

        <div className="grid gap-3">
          {trainers.length > 0 ? (
            sortedTrainers.map((t) => (
              <motion.button
                key={t.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onLogin(t)}
                className={`group relative bg-card/40 backdrop-blur-xl border-2 ${t.isOwner ? 'border-amber-500/20' : 'border-border/10'} hover:border-primary/50 p-6 rounded-[32px] flex items-center justify-between transition-all shadow-sm`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${t.isOwner ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'} flex items-center justify-center font-black uppercase italic text-lg`}>
                    {t.initials}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-black uppercase italic tracking-tight text-lg leading-none">{t.fullName}</p>
                      {t.isOwner && (
                        <div className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[8px] font-black text-amber-600 uppercase tracking-widest">
                          Owner
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {t.isOwner ? 'System Administrator' : 'Performance Trainer'}
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="w-5 h-5 text-primary" />
                </div>
              </motion.button>
            ))
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 px-6 bg-muted/20 rounded-[32px] border-2 border-dashed">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/30" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-center">
                Syncing Team Data...
              </p>
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={user ? handleSignOut : handleGoogleLogin}
            disabled={isLoggingIn}
            className="flex flex-col items-center gap-1 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all h-auto py-2 group"
          >
            {isLoggingIn ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : user ? (
              <LogOut className="w-6 h-6 text-rose-500" />
            ) : (
              <LogIn className="w-6 h-6 text-primary" />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {isLoggingIn ? 'Connecting...' : user ? 'Sign Out' : 'Google Admin Sign In'}
            </span>
          </Button>
          
          {user && (
            <p className="text-[8px] font-bold text-zinc-400 lowercase tracking-widest">{user.email}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
