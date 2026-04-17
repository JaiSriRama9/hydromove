import { useState, useEffect, useRef } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy, OperationType, handleFirestoreError } from '../firebase';
import { Brain, Play, Pause, RotateCcw, Wind, CloudRain, Waves, Trees, Timer, CheckCircle2, Music, Volume2, Trophy, Star, Zap, Calendar, Info, ExternalLink, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, subDays, isSameDay } from 'date-fns';

import { cn } from '../lib/utils';

const breathingPatterns = {
  box: {
    label: 'Box Breathing',
    desc: '4-4-4-4 pattern for stress relief',
    phases: [
      { type: 'Inhale', duration: 4, scale: 1.5 },
      { type: 'Hold', duration: 4, scale: 1.5 },
      { type: 'Exhale', duration: 4, scale: 1 },
      { type: 'Hold', duration: 4, scale: 1 },
    ],
    color: 'bg-blue-500',
    theme: 'from-blue-500 to-indigo-600'
  },
  relax: {
    label: '4-7-8 Relax',
    desc: 'Deep relaxation and sleep aid',
    phases: [
      { type: 'Inhale', duration: 4, scale: 1.5 },
      { type: 'Hold', duration: 7, scale: 1.5 },
      { type: 'Exhale', duration: 8, scale: 1 },
    ],
    color: 'bg-purple-500',
    theme: 'from-purple-500 to-pink-600'
  },
  equal: {
    label: 'Equal Breathing',
    desc: 'Balance and focus',
    phases: [
      { type: 'Inhale', duration: 4, scale: 1.5 },
      { type: 'Exhale', duration: 4, scale: 1 },
    ],
    color: 'bg-teal-500',
    theme: 'from-brand to-emerald-600'
  }
};

export default function Mindfulness() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionType, setSessionType] = useState<'rain' | 'ocean' | 'forest' | 'breathing'>('breathing');
  const [breathingPattern, setBreathingPattern] = useState<keyof typeof breathingPatterns>('box');
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(breathingPatterns.box.phases[0].duration);
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/meditation`);
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
        
        if (sessionType === 'breathing') {
          setPhaseTimeLeft(prevPhase => {
            if (prevPhase <= 1) {
              // Move to next phase
              const pattern = breathingPatterns[breathingPattern];
              const nextIndex = (currentPhaseIndex + 1) % pattern.phases.length;
              setCurrentPhaseIndex(nextIndex);
              
              // Play phase transition sound
              const beep = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
              beep.volume = volume / 200; // Quieter beep
              beep.play().catch(() => {});
              
              return pattern.phases[nextIndex].duration;
            }
            return prevPhase - 1;
          });
        }
      }, 1000);
    } else if (timeLeft === 0) {
      handleComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, timeLeft, sessionType, breathingPattern, currentPhaseIndex, volume]);

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
    setCurrentPhaseIndex(0);
    setPhaseTimeLeft(breathingPatterns[breathingPattern].phases[0].duration);
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
    { id: 'forest', icon: Trees, label: 'Forest', color: 'bg-brand' },
  ];

  const durations = [5, 10, 15];
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState('');

  // Spotify State
  const [spotifyToken, setSpotifyToken] = useState<string | null>(localStorage.getItem('spotify_token'));
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [isFetchingPlaylists, setIsFetchingPlaylists] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        const token = event.data.tokens.access_token;
        setSpotifyToken(token);
        localStorage.setItem('spotify_token', token);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (spotifyToken) {
      fetchPlaylists();
    }
  }, [spotifyToken]);

  const fetchPlaylists = async () => {
    setIsFetchingPlaylists(true);
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: { 'Authorization': `Bearer ${spotifyToken}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          setSpotifyToken(null);
          localStorage.removeItem('spotify_token');
        }
        throw new Error('Failed to fetch playlists');
      }
      const data = await response.json();
      // Filter for "focus" or "relax" or just show top playlists
      setPlaylists(data.items);
    } catch (error) {
      console.error('Error fetching Spotify playlists:', error);
    } finally {
      setIsFetchingPlaylists(false);
    }
  };

  const handleSpotifyConnect = async () => {
    try {
      const response = await fetch('/api/auth/spotify/url');
      const { url } = await response.json();
      window.open(url, 'spotify_pivot', 'width=600,height=800');
    } catch (error) {
      console.error('Failed to connect Spotify:', error);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Session Header */}
      <audio ref={audioRef} />
      <div className={cn(
        "relative h-80 w-full rounded-[40px] overflow-hidden shadow-2xl transition-colors duration-1000 flex flex-col items-center justify-center text-white",
        sessionType === 'breathing' 
          ? `bg-gradient-to-br ${breathingPatterns[breathingPattern].theme}` 
          : sessionType === 'rain' ? "bg-indigo-500" : 
            sessionType === 'ocean' ? "bg-cyan-500" : "bg-brand"
      )}>
        {/* Animated Breathing Circle */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <AnimatePresence>
            {isPlaying && sessionType === 'breathing' && (
              <motion.div
                key={`${breathingPattern}-${currentPhaseIndex}`}
                initial={{ scale: currentPhaseIndex === 0 ? 0.8 : breathingPatterns[breathingPattern].phases[(currentPhaseIndex - 1 + breathingPatterns[breathingPattern].phases.length) % breathingPatterns[breathingPattern].phases.length].scale }}
                animate={{ 
                  scale: breathingPatterns[breathingPattern].phases[currentPhaseIndex].scale,
                  backgroundColor: breathingPatterns[breathingPattern].phases[currentPhaseIndex].type === 'Hold' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'
                }}
                transition={{ 
                  duration: breathingPatterns[breathingPattern].phases[currentPhaseIndex].duration,
                  ease: "easeInOut"
                }}
                className="w-64 h-64 rounded-full blur-2xl"
              />
            )}
          </AnimatePresence>

          <motion.div 
            animate={{ 
              scale: isPlaying 
                ? (sessionType === 'breathing' 
                    ? breathingPatterns[breathingPattern].phases[currentPhaseIndex].scale 
                    : [1, 1.1, 1]) 
                : 1,
              opacity: isPlaying ? [0.2, 0.4, 0.2] : 0.15
            }}
            transition={{ 
              duration: sessionType === 'breathing' 
                ? breathingPatterns[breathingPattern].phases[currentPhaseIndex].duration 
                : 10, 
              ease: "easeInOut",
              repeat: sessionType === 'breathing' ? 0 : Infinity
            }}
            className="absolute h-[150%] w-[150%] bg-white rounded-full blur-[100px] opacity-10"
          />
        </div>
        
        <div className="relative z-10 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {completed ? (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="h-24 w-24 bg-white/20 rounded-[32px] flex items-center justify-center mb-6">
                  <CheckCircle2 size={48} />
                </div>
                <h3 className="text-3xl font-black uppercase tracking-widest text-center">Session<br/>Complete</h3>
                <p className="text-sm font-bold opacity-80 mt-4">Mindfulness goal achieved.</p>
                <button 
                  onClick={resetSession}
                  className="mt-8 bg-white text-slate-900 px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl"
                >
                  End Session
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="timer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="h-56 w-56 rounded-full flex items-center justify-center relative">
                  {/* Subtle outer rings */}
                  <motion.div 
                    animate={{ scale: isPlaying ? [1, 1.05, 1] : 1 }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border border-white/10" 
                  />
                  <div className="absolute inset-4 rounded-full border border-white/5" />

                  <svg className="absolute inset-0 -rotate-90 p-2" viewBox="0 0 100 100">
                    <circle 
                      cx="50" cy="50" r="46" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="2" 
                      strokeDasharray="289.02" // 2 * PI * 46
                      strokeDashoffset={289.02 * (timeLeft / (duration * 60))}
                      className="transition-all duration-1000 ease-linear opacity-20"
                    />
                    {sessionType === 'breathing' && isPlaying && (
                       <motion.circle 
                        cx="50" cy="50" r="46" 
                        fill="none" 
                        stroke="white" 
                        strokeWidth="4" 
                        strokeDasharray="289.02"
                        initial={{ strokeDashoffset: 289.02 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ 
                          duration: breathingPatterns[breathingPattern].phases[currentPhaseIndex].duration,
                          ease: "linear"
                        }}
                        key={`${breathingPattern}-${currentPhaseIndex}`}
                        className="opacity-60"
                      />
                    )}
                  </svg>

                  <div className="flex flex-col items-center relative z-10">
                    <motion.div
                      animate={{ 
                        scale: isPlaying && sessionType === 'breathing' 
                          ? breathingPatterns[breathingPattern].phases[currentPhaseIndex].scale 
                          : 1
                      }}
                      transition={{ 
                        duration: isPlaying && sessionType === 'breathing' 
                          ? breathingPatterns[breathingPattern].phases[currentPhaseIndex].duration 
                          : 2,
                        ease: "easeInOut"
                      }}
                      className="flex flex-col items-center"
                    >
                      <span className="text-5xl font-black font-mono tracking-tighter">{formatTime(timeLeft)}</span>
                      {isPlaying && sessionType === 'breathing' && (
                        <div className="h-6 flex flex-col items-center justify-center">
                          <motion.span 
                            key={currentPhaseIndex}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 text-white/90"
                          >
                            {breathingPatterns[breathingPattern].phases[currentPhaseIndex].type}
                          </motion.span>
                          <span className="text-[14px] font-black mt-1">{phaseTimeLeft}s</span>
                        </div>
                      )}
                    </motion.div>
                  </div>
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
          <div className="space-y-3 bg-glass p-5 rounded-[32px] shadow-sm">
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
                className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand"
              />
            </div>
          </div>

          {!isPlaying && (
            <>
              {/* Duration Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Duration</h4>
                  <button 
                    onClick={() => setShowCustomDuration(!showCustomDuration)}
                    className="text-[10px] font-bold text-brand uppercase tracking-widest"
                  >
                    {showCustomDuration ? 'Quick Select' : 'Custom'}
                  </button>
                </div>
                
                {showCustomDuration ? (
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input 
                        type="number" 
                        value={customDuration}
                        onChange={(e) => setCustomDuration(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-6 py-4 text-lg font-bold focus:outline-none focus:border-brand transition-all"
                        placeholder="Enter minutes..."
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">min</span>
                    </div>
                    <button 
                      onClick={() => {
                        const mins = parseInt(customDuration);
                        if (mins > 0) {
                          setDuration(mins);
                          setTimeLeft(mins * 60);
                          setShowCustomDuration(false);
                        }
                      }}
                      className="bg-brand text-white px-6 rounded-2xl font-bold shadow-lg shadow-brand/30 hover:opacity-90 transition-all active:scale-95 duration-500"
                    >
                      Set
                    </button>
                  </div>
                ) : (
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
                )}
              </div>

              {/* Sound Selection */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Calming Sound</h4>
                <div className="grid grid-cols-2 gap-3">
                  {sessionOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSessionType(opt.id as any);
                        if (opt.id !== 'breathing') setIsPlaying(false);
                      }}
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

              {/* Breathing Patterns - Only visible when breathing is selected */}
              {sessionType === 'breathing' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Breathing Technique</h4>
                  <div className="space-y-3">
                    {Object.entries(breathingPatterns).map(([id, pattern]) => (
                      <button
                        key={id}
                        onClick={() => {
                          setBreathingPattern(id as any);
                          setCurrentPhaseIndex(0);
                          setPhaseTimeLeft(pattern.phases[0].duration);
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-3xl border transition-all text-left",
                          breathingPattern === id 
                            ? "bg-white dark:bg-slate-900 border-slate-900 dark:border-white shadow-lg" 
                            : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br",
                          pattern.theme
                        )}>
                          <Wind size={20} />
                        </div>
                        <div className="flex-1">
                          <h5 className={cn(
                            "text-sm font-bold",
                            breathingPattern === id ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                          )}>{pattern.label}</h5>
                          <p className="text-[10px] text-slate-400">{pattern.desc}</p>
                        </div>
                        <div className="flex gap-1">
                          {pattern.phases.map((p, i) => (
                            <div key={i} className="h-1 w-3 rounded-full bg-slate-100 dark:bg-slate-800" />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Spotify Integration Section */}
      <div className="space-y-4">
        <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-[32px] flex flex-col gap-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20 transition-colors duration-500">
                <Music size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Focus Playlists</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {spotifyToken ? 'Connected to Spotify' : 'Play your favorite focus sounds'}
                </p>
              </div>
            </div>
            {!spotifyToken ? (
              <button 
                onClick={handleSpotifyConnect}
                className="text-xs font-bold text-brand bg-brand/10 px-4 py-2 rounded-xl uppercase tracking-widest hover:bg-brand/20 transition-all duration-500"
              >
                Connect
              </button>
            ) : (
              <button 
                onClick={() => {
                  setSpotifyToken(null);
                  localStorage.removeItem('spotify_token');
                  setSelectedPlaylist(null);
                }}
                className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-500 transition-all"
              >
                Disconnect
              </button>
            )}
          </div>

          {spotifyToken && (
            <div className="space-y-4">
              {selectedPlaylist ? (
                <div className="relative group rounded-3xl overflow-hidden shadow-2xl bg-black aspect-video flex flex-col">
                   <button 
                     onClick={() => setSelectedPlaylist(null)}
                     className="absolute top-4 right-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all"
                   >
                     <X size={16} />
                   </button>
                   <iframe 
                     src={`https://open.spotify.com/embed/playlist/${selectedPlaylist}?utm_source=generator&theme=0`} 
                     width="100%" 
                     height="100%" 
                     frameBorder="0" 
                     allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                     loading="lazy"
                     className="flex-1"
                   />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {isFetchingPlaylists ? (
                    [1, 2, 3, 4].map(i => (
                      <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
                    ))
                  ) : (
                    playlists.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlaylist(p.id)}
                        className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-brand transition-all text-left flex items-center gap-3 group"
                      >
                        <img 
                          src={p.images?.[0]?.url || 'https://picsum.photos/seed/spotify/100/100'} 
                          alt={p.name} 
                          className="h-12 w-12 rounded-xl object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 overflow-hidden">
                          <h5 className="text-[11px] font-bold truncate group-hover:text-brand transition-colors">{p.name}</h5>
                          <p className="text-[9px] text-slate-400 truncate tracking-tight">Playlist</p>
                        </div>
                        <ChevronRight size={12} className="text-slate-300" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Achievements Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Achievements</h4>
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest transition-colors duration-500">Milestones</span>
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
                    {isUnlocked && <CheckCircle2 size={14} className="text-brand transition-colors duration-500" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">{badge.desc}</p>
                  
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className={cn(
                        "h-full transition-all duration-500",
                        isUnlocked ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
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

      {/* Recent Sessions History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Recent Sessions</h4>
          <Calendar size={14} className="text-slate-400" />
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          {stats.sessions === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-400 italic">No sessions recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {/* This would ideally be fetched from a separate state, but for now we'll show a placeholder or use the existing stats if we had the logs */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                    <Wind size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Breathing Session</p>
                    <p className="text-[10px] text-slate-400">Today, {format(new Date(), 'h:mm a')}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">5 min</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

