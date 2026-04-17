import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Droplets, Footprints, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

import { cn } from '../lib/utils';

interface DisciplineLockProps {
  reason: 'hydration' | 'walking' | null;
  onUnlock: () => void;
}

export default function DisciplineLock({ reason, onUnlock }: DisciplineLockProps) {
  const [steps, setSteps] = useState(0);
  const [waterLogged, setWaterLogged] = useState(false);
  const [isHardMode, setIsHardMode] = useState(true);

  useEffect(() => {
    if (reason === 'walking') {
      const interval = setInterval(() => {
        setSteps(prev => {
          if (prev >= 500) {
            clearInterval(interval);
            return 500;
          }
          return prev + Math.floor(Math.random() * 20) + 5;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [reason]);

  const handleWaterLog = () => {
    setWaterLogged(true);
    setTimeout(onUnlock, 1500);
  };

  useEffect(() => {
    if (steps >= 500) {
      setTimeout(onUnlock, 1500);
    }
  }, [steps, onUnlock]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center px-8 text-center"
    >
      {/* Background Glow */}
      <div className={cn(
        "absolute inset-0 opacity-20 blur-[120px] -z-10",
        reason === 'hydration' ? "bg-blue-500" : "bg-orange-500"
      )} />

      <motion.div 
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="space-y-8 w-full max-w-xs"
      >
        <div className="flex flex-col items-center gap-6">
          <div className={cn(
            "h-24 w-24 rounded-[32px] flex items-center justify-center text-white shadow-2xl",
            reason === 'hydration' ? "bg-blue-500 shadow-blue-500/40" : "bg-orange-500 shadow-orange-500/40"
          )}>
            {reason === 'hydration' ? <Droplets size={48} /> : <Footprints size={48} />}
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-white uppercase">Discipline Lock</h2>
            <p className="text-slate-400 font-medium">
              {reason === 'hydration' 
                ? "Time to hydrate! Drink 250ml to unlock." 
                : "Inactivity detected! Complete 500 steps to unlock."}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[40px] backdrop-blur-xl">
          {reason === 'hydration' ? (
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {waterLogged ? (
                  <motion.div 
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <CheckCircle2 size={64} className="text-brand transition-colors duration-500" />
                    <span className="text-lg font-bold text-brand">Hydrated!</span>
                  </motion.div>
                ) : (
                  <motion.button
                    key="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={handleWaterLog}
                    className="w-full h-20 bg-blue-500 text-white rounded-3xl font-black text-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3"
                  >
                    <Droplets size={24} />
                    LOG 250ML
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative h-32 w-32 mx-auto flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="rgba(255,255,255,0.1)" 
                    strokeWidth="8" 
                  />
                  <motion.circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="#f97316" 
                    strokeWidth="8" 
                    strokeDasharray="282.7"
                    strokeDashoffset={282.7 * (1 - steps / 500)}
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-black text-white">{steps}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">/ 500</span>
                </div>
              </div>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest animate-pulse">Walking detected...</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-500">
          <ShieldAlert size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {isHardMode ? "Hard Mode Active: No Snooze" : "Soft Mode Active"}
          </span>
        </div>

        {!isHardMode && (
          <button 
            onClick={onUnlock}
            className="text-sm font-bold text-slate-600 hover:text-white transition-colors"
          >
            Snooze for 10 mins
          </button>
        )}
      </motion.div>

      {/* Emergency Call Button */}
      <button className="absolute bottom-12 text-xs font-bold text-red-500 uppercase tracking-widest border border-red-500/30 px-6 py-3 rounded-full hover:bg-red-500/10 transition-all">
        Emergency Call Only
      </button>
    </motion.div>
  );
}

