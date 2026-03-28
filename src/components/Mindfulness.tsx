import { useState, useEffect, useRef } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy } from '../firebase';
import { Brain, Play, Pause, RotateCcw, Wind, CloudRain, Waves, Trees, Timer, CheckCircle2, Music, Volume2, Trophy, Star, Zap, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, subDays, isSameDay } from 'date-fns';

import { cn } from '../lib/utils';

export default function Mindfulness() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionType, setSessionType] = useState<'rain' | 'ocean' | 'forest' | 'breathing'>('breathing');
  const [duration, setDuration] = useState(5); // minutes
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [completed, setCompleted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [stats, setStats] = useState({ sessions: 0, totalMinutes: 0, streak: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, `users/${auth.currentUser.uid}/meditation`),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => doc.data());
      const sessions = logs.length;
      const totalMinutes = logs.reduce((acc, curr) => acc + (curr.duration || 0), 0);

      // Calculate streak
      let streak = 0;
      if (logs.length > 0) {
        const uniqueDates = Array.from(new Set(logs.map(log => 
          format(new Date(log.timestamp), 'yyyy-MM-dd')
        ))).map(d => new Date(d));

        const today = startOfDay(new Date());
        let currentCheck = today;
        
        // If no log today, check if there was one yesterday to continue a streak
        const hasLogToday = uniqueDates.some(d => isSameDay(d, today));
        if (!hasLogToday) {
          currentCheck = subDays(today, 1);
        }

        for (let i = 0; i < uniqueDates.length; i++) {
          const hasLog = uniqueDates.some(d => isSameDay(d, currentCheck));
          if (hasLog) {
            streak++;
            currentCheck = subDays(currentCheck, 1);
          } else {
            break;
          }
        }
      }

      setStats({ sessions, totalMinutes, streak });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying && sessionType !== 'breathing') {
      const sounds: Record<string, string> = {
        rain: 'https://actions.google.com/sounds/v1/water/rain_on_roof.ogg',
        ocean: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_shore.ogg',
        forest: 'https://actions.google.com/sounds/v1/ambient/morning_birds.ogg'
      };
      
      const src = sounds[sessionType];
      if (src && audioRef.current.src !== src) {
        audioRef.current.src = src;
        audioRef.current.loop = true;
      }
      
      if (src) {
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, sessionType]);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, timeLeft]);

  const handleComplete = async () => {
    setIsPlaying(false);
    setCompleted(true);
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/meditation`), {
        uid: auth.currentUser.uid,
        duration,
        type: sessionType,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log meditation', error);
    }
  };

  const resetSession = () => {
    setIsPlaying(false);
    setTimeLeft(duration * 60);
    setCompleted(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sessionOptions = [
    { id: 'breathing', icon: Wind, label: 'Breathing', color: 'bg-blue-500' },
    { id: 'rain', icon: CloudRain, label: 'Rain', color: 'bg-indigo-500' },
    { id: 'ocean', icon: Waves, label: 'Ocean', color: 'bg-cyan-500' },
    { id: 'forest', icon: Trees, label: 'Forest', color: 'bg-green-500' },
  ];

  const durations = [5, 10, 15];

  return (
    <div className="space-y-6 pb-8">
      {/* Session Header */}
      <audio ref={audioRef} />
      <div className={cn(
        "relative h-80 w-full rounded-[40px] overflow-hidden shadow-2xl transition-colors duration-1000 flex flex-col items-center justify-center text-white",
        sessionType === 'breathing' ? "bg-blue-500" : 
        sessionType === 'rain' ? "bg-indigo-500" : 
        sessionType === 'ocean' ? "bg-cyan-500" : "bg-green-600"
      )}>
        {/* Animated Background */}
        <motion.div 
          animate={{ 
            scale: isPlaying ? [1, 1.2, 1] : 1,
            opacity: isPlaying ? [0.3, 0.5, 0.3] : 0.2
          }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          className="absolute inset-0 bg-white/20 rounded-full blur-3xl -m-20"
        />
        
        <div className="relative z-10 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {completed ? (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center"
              >
                <CheckCircle2 size={80} className="mb-4" />
                <h3 className="text-3xl font-black uppercase tracking-widest">Completed</h3>
                <p className="text-sm font-bold opacity-80 mt-2">You feel more centered now.</p>
                <button 
                  onClick={resetSession}
                  className="mt-8 bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  Start New
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="timer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="h-48 w-48 rounded-full border-4 border-white/20 flex items-center justify-center relative">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                    <circle 
                      cx="50" cy="50" r="48" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="4" 
                      strokeDasharray="301.59"
                      strokeDashoffset={301.59 * (timeLeft / (duration * 60))}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <span className="text-5xl font-black font-mono">{formatTime(timeLeft)}</span>
                </div>
                
                <div className="mt-8 flex items-center gap-6">
                  <button 
                    onClick={resetSession}
                    className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"
                  >
                    <RotateCcw size={24} />
                  </button>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="h-20 w-20 bg-white text-slate-900 rounded-3xl flex items-center justify-center shadow-xl hover:scale-105 transition-all active:scale-95"
                  >
                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                  </button>
                  <div className="p-4 bg-white/10 rounded-2xl opacity-50">
                    <Volume2 size={24} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Session Settings & Volume */}
      {!completed && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Volume Slider - Always visible when not completed */}
          <div className="space-y-3 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-slate-400" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Volume</h4>
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{volume}%</span>
            </div>
            <div className="flex items-center gap-4 px-2">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>
          </div>

          {!isPlaying && (
            <>
              {/* Duration Selection */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Duration</h4>
                <div className="grid grid-cols-3 gap-3">
                  {durations.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDuration(d);
                        setTimeLeft(d * 60);
                      }}
                      className={cn(
                        "py-4 rounded-2xl font-bold transition-all border",
                        duration === d 
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" 
                          : "bg-white text-slate-500 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                      )}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Selection */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Calming Sound</h4>
                <div className="grid grid-cols-2 gap-3">
                  {sessionOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSessionType(opt.id as any)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-3xl border transition-all",
                        sessionType === opt.id 
                          ? "bg-white dark:bg-slate-900 border-slate-900 dark:border-white shadow-lg" 
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center text-white",
                        opt.color
                      )}>
                        <opt.icon size={20} />
                      </div>
                      <span className={cn(
                        "text-sm font-bold",
                        sessionType === opt.id ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                      )}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Mindfulness Integration */}
      <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-[32px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Music size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold">Spotify Integration</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Play your favorite focus playlist</p>
          </div>
        </div>
        <button className="text-xs font-bold text-green-500 uppercase tracking-widest">Connect</button>
      </div>

      {/* Achievements Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Achievements</h4>
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Milestones</span>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {[
            { 
              id: 'sessions', 
              title: 'Zen Master', 
              desc: 'Complete 10 sessions', 
              target: 10, 
              current: stats.sessions, 
              icon: Trophy, 
              color: 'text-amber-500', 
              bg: 'bg-amber-50' 
            },
            { 
              id: 'minutes', 
              title: 'Deep Focus', 
              desc: '100 minutes of meditation', 
              target: 100, 
              current: stats.totalMinutes, 
              icon: Star, 
              color: 'text-blue-500', 
              bg: 'bg-blue-50' 
            },
            { 
              id: 'streak', 
              title: 'Consistent Soul', 
              desc: '7 day meditation streak', 
              target: 7, 
              current: stats.streak, 
              icon: Zap, 
              color: 'text-orange-500', 
              bg: 'bg-orange-50' 
            }
          ].map((badge) => {
            const isUnlocked = badge.current >= badge.target;
            const progress = Math.min((badge.current / badge.target) * 100, 100);
            
            return (
              <motion.div 
                key={badge.id}
                whileHover={{ scale: 1.01 }}
                className={cn(
                  "p-5 rounded-3xl border flex items-center gap-5 transition-all",
                  isUnlocked 
                    ? "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm" 
                    : "bg-slate-50/50 dark:bg-slate-800/20 border-dashed border-slate-200 dark:border-slate-700 opacity-70"
                )}
              >
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm",
                  isUnlocked ? badge.bg : "bg-slate-100 dark:bg-slate-800"
                )}>
                  <badge.icon size={28} className={isUnlocked ? badge.color : "text-slate-300"} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className={cn(
                      "text-sm font-bold",
                      isUnlocked ? "text-slate-900 dark:text-white" : "text-slate-400"
                    )}>{badge.title}</h5>
                    {isUnlocked && <CheckCircle2 size={14} className="text-green-500" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">{badge.desc}</p>
                  
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className={cn(
                        "h-full transition-all",
                        isUnlocked ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                      )}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      {badge.current} / {badge.target}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

