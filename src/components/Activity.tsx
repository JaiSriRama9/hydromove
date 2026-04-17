import { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy, limit, doc, OperationType, handleFirestoreError } from '../firebase';
import { Footprints, Flame, TrendingUp, Timer, Wind, Heart, MapPin, Activity as ActivityIcon, Plus, X, History, Dumbbell, Zap, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { format, startOfDay, subDays, isSameDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { cn } from '../lib/utils';

export default function Activity() {
  const [steps, setSteps] = useState(6432);
  const [goal, setGoal] = useState(10000);
  const [calories, setCalories] = useState(245);
  const [activeMinutes, setActiveMinutes] = useState(42);
  const [heartRate, setHeartRate] = useState(72);
  const [inactivityTime, setInactivityTime] = useState(45); // minutes
  
  const [showLibrary, setShowLibrary] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [exerciseLogs, setExerciseLogs] = useState<any[]>([]);
  const [weeklySteps, setWeeklySteps] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleFitToken, setGoogleFitToken] = useState<string | null>(localStorage.getItem('google_fit_token'));

  // Calculate stats
  const totalCaloriesToday = exerciseLogs
    .filter(log => isSameDay(new Date(log.timestamp), new Date()))
    .reduce((acc, log) => acc + (log.caloriesBurned || 0), 0) + calories;

  const lastExercise = exerciseLogs[0];

  const [customExercise, setCustomExercise] = useState({
    name: '',
    duration: 30,
    intensity: 'moderate' as 'low' | 'moderate' | 'high',
    calories: 240
  });

  const calculateCalories = (duration: number, intensity: string) => {
    const calPerMin = intensity === 'high' ? 12 : intensity === 'moderate' ? 8 : 4;
    return duration * calPerMin;
  };

  const exerciseLibrary = [
    { name: 'Weightlifting', desc: 'Build strength and muscle mass', icon: Dumbbell, color: 'bg-blue-500', animation: 'pulse' },
    { name: 'Yoga', desc: 'Flexibility and mindfulness', icon: Wind, color: 'bg-teal-500', animation: 'float' },
    { name: 'HIIT', desc: 'High intensity interval training', icon: Zap, color: 'bg-orange-500', animation: 'shake' },
    { name: 'Running', desc: 'Cardiovascular endurance', icon: Footprints, color: 'bg-brand', animation: 'slide' },
  ];

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch goal
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeGoal = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.dailyStepGoal) setGoal(data.dailyStepGoal);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    // Fetch exercise logs
    const exerciseQ = query(
      collection(db, `users/${auth.currentUser?.uid}/exercises`),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribeExercises = onSnapshot(exerciseQ, (snapshot) => {
      setExerciseLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/exercises`);
    });

    // Fetch weekly steps (last 7 days)
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 7);
    const activityQ = query(
      collection(db, `users/${auth.currentUser?.uid}/activity`),
      where('timestamp', '>=', sevenDaysAgo.toISOString()),
      orderBy('timestamp', 'asc')
    );
    const unsubscribeActivity = onSnapshot(activityQ, (snapshot) => {
      const logs = snapshot.docs.map(doc => doc.data());
      const dailySteps = [];
      for (let i = 0; i < 7; i++) {
        const date = subDays(today, 6 - i);
        const log = logs.find(l => isSameDay(new Date(l.timestamp), date));
        dailySteps.push({
          day: format(date, 'EEE'),
          steps: log ? log.steps : 0,
          goal: goal
        });
      }
      setWeeklySteps(dailySteps);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/activity`);
    });

    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.tokens?.access_token) {
        setGoogleFitToken(event.data.tokens.access_token);
        localStorage.setItem('google_fit_token', event.data.tokens.access_token);
        syncGoogleFitData(event.data.tokens.access_token);
      }
    };
    window.addEventListener('message', handleOAuthMessage);

    if (googleFitToken) {
      syncGoogleFitData(googleFitToken);
    }

    return () => {
      unsubscribeGoal();
      unsubscribeExercises();
      unsubscribeActivity();
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, [goal, googleFitToken]);

  const syncGoogleFitData = async (token: string) => {
    setIsSyncing(true);
    const now = new Date();
    const startTimeMillis = startOfDay(now).getTime();
    const endTimeMillis = now.getTime();

    try {
      const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [
            { dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps" },
            { dataSourceId: "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended" },
            { dataSourceId: "derived:com.google.active_minutes:com.google.android.gms:merge_active_minutes" }
          ],
          bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
          startTimeMillis,
          endTimeMillis
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('google_fit_token');
          setGoogleFitToken(null);
        }
        throw new Error('Failed to fetch fitness data');
      }

      const data = await response.json();
      
      if (data.bucket && data.bucket[0]) {
        const datasets = data.bucket[0].dataset;
        
        // Steps
        const stepDataset = datasets.find((d: any) => d.dataSourceId.includes('step_count'));
        const totalSteps = stepDataset?.point?.[0]?.value?.[0]?.intVal || 0;
        if (totalSteps > 0) setSteps(totalSteps);

        // Calories
        const calDataset = datasets.find((d: any) => d.dataSourceId.includes('calories'));
        const totalCals = Math.round(calDataset?.point?.[0]?.value?.[0]?.fpVal || 0);
        if (totalCals > 0) setCalories(totalCals);

        // Active Minutes
        const activeMinDataset = datasets.find((d: any) => d.dataSourceId.includes('active_minutes'));
        const totalActive = Math.round(activeMinDataset?.point?.[0]?.value?.[0]?.intVal || 0);
        if (totalActive > 0) setActiveMinutes(totalActive);
      }
    } catch (error) {
      console.error('Error syncing Google Fit data:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogExercise = async () => {
    if (!auth.currentUser || !customExercise.name) return;
    
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/exercises`), {
        uid: auth.currentUser.uid,
        exerciseName: customExercise.name,
        duration: customExercise.duration,
        intensity: customExercise.intensity,
        caloriesBurned: customExercise.calories,
        timestamp: new Date().toISOString()
      });

      setShowLogModal(false);
      setCustomExercise({ name: '', duration: 30, intensity: 'moderate', calories: 240 });
    } catch (error) {
      console.error('Failed to log exercise', error);
    }
  };

  const handleConnectGoogleFit = async () => {
    setIsSyncing(true);
    try {
      if (googleFitToken) {
        await syncGoogleFitData(googleFitToken);
        return;
      }

      const response = await fetch('/api/auth/google-fit/url');
      const { url } = await response.json();
      
      window.open(url, 'google_fit_oauth', 'width=600,height=700');
    } catch (error) {
      console.error('Google Fit connection error:', error);
      setIsSyncing(false);
    }
  };

  const progress = Math.min((steps / goal) * 100, 100);

  return (
    <div className="space-y-6 pb-24">
      {/* Dynamic Summary Section */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-glass p-5 rounded-[32px] shadow-sm flex flex-col justify-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 bg-brand/10 rounded-lg flex items-center justify-center text-brand">
              <History size={14} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Session</span>
          </div>
          {lastExercise ? (
            <div className="space-y-1">
              <h5 className="text-sm font-black truncate">{lastExercise.exerciseName}</h5>
              <p className="text-[10px] font-bold text-brand uppercase">{lastExercise.duration} mins • {lastExercise.caloriesBurned} kcal</p>
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-300 italic">No logs today</p>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-glass p-5 rounded-[32px] shadow-sm flex flex-col justify-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 bg-orange-50 dark:bg-orange-900/30 rounded-lg flex items-center justify-center text-orange-500">
              <Flame size={14} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Burned Today</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalCaloriesToday}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">kcal</span>
          </div>
        </motion.div>
      </div>

      {/* Progress Header */}
      <div className="relative h-64 w-full bg-brand rounded-[40px] overflow-hidden shadow-2xl shadow-brand/30 flex flex-col items-center justify-center text-white transition-colors duration-500">
        {/* Animated Background */}
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="absolute inset-0 bg-brand/30 rounded-full blur-3xl -m-20"
        />
        
        <div className="relative z-10 flex flex-col items-center">
          <Footprints size={48} className="mb-2 opacity-80" />
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black">{steps}</span>
            <span className="text-xl font-medium opacity-60">steps</span>
          </div>
          <p className="text-sm font-bold uppercase tracking-widest mt-2 opacity-80">Daily Progress: {Math.round(progress)}%</p>
          <div className="mt-6 w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-white"
            />
          </div>
        </div>
      </div>

      {/* Inactivity Alert Card */}
      <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-3xl border border-orange-100 dark:border-orange-800/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Timer size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-orange-900 dark:text-orange-100">Inactivity Alert</h4>
            <p className="text-xs text-orange-700 dark:text-orange-400">Inactive for {inactivityTime} mins. Walk 500 steps to unlock.</p>
          </div>
        </div>
        <div className="h-10 w-10 border-2 border-orange-500/30 rounded-full flex items-center justify-center">
          <span className="text-xs font-black text-orange-600 dark:text-orange-400">15m</span>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="h-10 w-10 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-500 mb-4">
            <Flame size={20} />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calories</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{calories}</span>
            <span className="text-xs font-medium text-slate-400">kcal</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-500 mb-4">
            <Timer size={20} />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Time</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{activeMinutes}</span>
            <span className="text-xs font-medium text-slate-400">mins</span>
          </div>
        </div>
      </div>

      {/* Exercise Library & Logging */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setShowLibrary(true)}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-2 hover:border-green-500 transition-all"
        >
          <div className="h-10 w-10 bg-brand/10 dark:bg-brand/20 rounded-xl flex items-center justify-center text-brand transition-colors duration-500">
            <Dumbbell size={20} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Library</span>
        </button>

        <button 
          onClick={() => setShowLogModal(true)}
          className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-2 hover:border-green-500 transition-all"
        >
          <div className="h-10 w-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand/20 transition-colors duration-500">
            <Plus size={20} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Log Activity</span>
        </button>
      </div>

      {/* Google Fit Integration Card */}
      <div className="bg-slate-900 dark:bg-slate-800 p-6 rounded-[32px] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <TrendingUp size={80} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold">Google Fit Sync</h4>
            {googleFitToken && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-brand/20 rounded-lg">
                <CheckCircle2 size={12} className="text-brand" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-brand">Connected</span>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-6">Connect your Google Fit account to automatically sync steps, heart rate, and activity data.</p>
          <button 
            onClick={handleConnectGoogleFit}
            disabled={isSyncing}
            className={cn(
              "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50",
              googleFitToken ? "bg-slate-800 text-white border border-slate-700" : "bg-white text-slate-900 shadow-xl"
            )}
          >
            {isSyncing ? (
              <div className="h-5 w-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                {googleFitToken ? 'Sync Data Now' : 'Connect Google Fit'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Weekly Progress Visualization */}
      <div className="bg-glass p-6 rounded-[40px] shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Weekly Progress</h4>
            <p className="text-[10px] font-bold text-brand uppercase mt-1">Goal: {goal.toLocaleString()} steps/day</p>
          </div>
          <TrendingUp size={20} className="text-brand shadow-glow" />
        </div>
        
        <div className="h-48 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklySteps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                dy={10}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{payload[0].payload.day}</p>
                        <p className="text-sm font-black">{payload[0].value.toLocaleString()} <span className="text-[10px] font-bold opacity-60">steps</span></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="steps" radius={[10, 10, 10, 10]} barSize={20}>
                {weeklySteps.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.steps >= goal ? 'var(--color-brand)' : 'var(--brand-glow)'} 
                    className="transition-all duration-500"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <History size={16} />
            Recent Activity
          </h4>
        </div>
        
        <div className="space-y-3">
          {exerciseLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic text-sm bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800">
              No activities logged yet.
            </div>
          ) : (
            exerciseLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand transition-colors duration-500">
                    <ActivityIcon size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">{log.exerciseName}</h5>
                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      <span>{log.duration} min</span>
                      <span>•</span>
                      <span>{log.intensity}</span>
                      <span>•</span>
                      <span>{format(new Date(log.timestamp), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-orange-500">+{log.caloriesBurned}</span>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">kcal</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Exercise Library Modal */}
      <AnimatePresence>
        {showLibrary && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLibrary(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black">Exercise Library</h3>
                <button onClick={() => setShowLibrary(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                {exerciseLibrary.map((ex) => (
                  <motion.div 
                    key={ex.name}
                    whileHover={{ scale: 1.02 }}
                    className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-5"
                  >
                    <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg", ex.color)}>
                      <ex.icon size={28} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{ex.name}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{ex.desc}</p>
                    </div>
                    <button 
                      onClick={() => {
                        const cal = calculateCalories(customExercise.duration, customExercise.intensity);
                        setCustomExercise({ ...customExercise, name: ex.name, calories: cal });
                        setShowLibrary(false);
                        setShowLogModal(true);
                      }}
                      className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm"
                    >
                      <Plus size={20} className="text-green-500" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Activity Modal */}
      <AnimatePresence>
        {showLogModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black">Log Activity</h3>
                <button onClick={() => setShowLogModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Exercise Name</label>
                  <input 
                    type="text" 
                    value={customExercise.name}
                    onChange={(e) => setCustomExercise({ ...customExercise, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold focus:ring-2 focus:ring-brand transition-all duration-500"
                    placeholder="e.g. Swimming, Cycling..."
                  />
                </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Duration (min)</label>
                      <input 
                        type="number" 
                        value={customExercise.duration}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCustomExercise({ 
                            ...customExercise, 
                            duration: val,
                            calories: calculateCalories(val, customExercise.intensity)
                          });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold focus:ring-2 focus:ring-brand transition-all duration-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Intensity</label>
                      <select 
                        value={customExercise.intensity}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setCustomExercise({ 
                            ...customExercise, 
                            intensity: val,
                            calories: calculateCalories(customExercise.duration, val)
                          });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold focus:ring-2 focus:ring-brand appearance-none transition-all"
                      >
                        <option value="low">Low</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Estimated Calories Burned</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={customExercise.calories}
                        onChange={(e) => setCustomExercise({ ...customExercise, calories: Number(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold focus:ring-2 focus:ring-brand transition-all duration-500"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                        kcal
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 ml-2">Calculated based on duration and intensity, but you can override it.</p>
                  </div>

                <button 
                  onClick={handleLogExercise}
                  className="w-full bg-brand text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-brand/20 hover:opacity-90 transition-all active:scale-95 mt-4 duration-500"
                >
                  Log Exercise
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
