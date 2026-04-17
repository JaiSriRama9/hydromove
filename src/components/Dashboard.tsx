import { useState, useEffect } from 'react';
import { auth, db, collection, query, where, onSnapshot, orderBy, limit, doc, OperationType, handleFirestoreError } from '../firebase';
import { Droplets, Footprints, Brain, Bell, Flame, TrendingUp, Wind, Sun, CloudRain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

import { cn } from '../lib/utils';

interface DashboardProps {
  onNavigate: (tab: any) => void;
  streak: number;
}

export default function Dashboard({ onNavigate, streak }: DashboardProps) {
  const [hydrationProgress, setHydrationProgress] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [hydrationScore, setHydrationScore] = useState<'Low' | 'Normal' | 'Optimal'>('Normal');
  const [weather, setWeather] = useState({ temp: 28, condition: 'Sunny' });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [upcomingAlerts, setUpcomingAlerts] = useState<any[]>([]);
  const [waterGoal, setWaterGoal] = useState(3000);
  const [stepGoal, setStepGoal] = useState(10000);

  const healthTips = [
    "Drinking water before meals can help with digestion.",
    "A 10-minute walk after lunch boosts your energy for the afternoon.",
    "Mindful breathing for just 2 minutes can significantly reduce stress.",
    "Consistency is key: try to hit your step goal 3 days in a row!",
    "Your body is your temple, keep it hydrated.",
    "Small steps every day lead to big results.",
    "Discipline is choosing between what you want now and what you want most.",
    "Success is the sum of small efforts, repeated day in and day out.",
  ];
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [activeInsightTab, setActiveInsightTab] = useState<'tips' | 'alerts'>('tips');

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % healthTips.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const today = startOfDay(new Date());
    
    // Hydration logs
    const hydrationQuery = query(
      collection(db, `users/${auth.currentUser.uid}/hydration`),
      where('timestamp', '>=', today.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeHydration = onSnapshot(hydrationQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => doc.data());
      const total = logs.reduce((acc, curr) => acc + curr.amount, 0);
      setHydrationProgress(total);
      setRecentLogs(logs);
      
      if (total < 1000) setHydrationScore('Low');
      else if (total < 2500) setHydrationScore('Normal');
      else setHydrationScore('Optimal');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/hydration`);
    });

    // Upcoming reminders
    const remindersQuery = query(
      collection(db, `users/${auth.currentUser?.uid}/reminders`),
      where('isPaid', '==', false),
      limit(3)
    );

    const unsubscribeReminders = onSnapshot(remindersQuery, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUpcomingAlerts(alerts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/reminders`);
    });

    // Fetch goals
    const userDocRef = doc(db, 'users', auth.currentUser?.uid || 'unknown');
    const unsubscribeGoals = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.dailyWaterGoal) setWaterGoal(data.dailyWaterGoal);
        if (data.dailyStepGoal) setStepGoal(data.dailyStepGoal);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    return () => {
      unsubscribeHydration();
      unsubscribeReminders();
      unsubscribeGoals();
    };
  }, []);

  const currentSteps = 6432;

  const chartData = [
    { name: '6am', water: 250, steps: 0 },
    { name: '9am', water: 750, steps: 1200 },
    { name: '12pm', water: 1250, steps: 3400 },
    { name: '3pm', water: 1750, steps: 4500 },
    { name: '6pm', water: 2250, steps: 5800 },
    { name: '9pm', water: 2500, steps: 6432 },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome & Weather */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Hello, {auth.currentUser?.displayName?.split(' ')[0] || 'User'}!</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ready for a disciplined day?</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <Flame className="text-orange-500" size={18} />
            <span className="text-sm font-bold">{streak}</span>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            {weather.condition === 'Sunny' ? <Sun className="text-amber-500" size={18} /> : <CloudRain className="text-blue-500" size={18} />}
            <span className="text-sm font-bold">{weather.temp}°C</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Hydration Card */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('hydration')}
          className="flex flex-col items-start p-5 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/30 text-left relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Droplets size={64} />
          </div>
          <div className="h-10 w-10 bg-blue-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/20">
            <Droplets size={20} />
          </div>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Hydration</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-900 dark:text-blue-100">{hydrationProgress}</span>
            <span className="text-xs font-medium text-blue-600/60 dark:text-blue-400/60">/ {waterGoal}ml</span>
          </div>
          <div className="mt-4 w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((hydrationProgress / waterGoal) * 100, 100)}%` }}
              className="h-full bg-blue-500"
            />
          </div>
          <div className="mt-3 flex items-center gap-1">
            <TrendingUp size={12} className="text-blue-500" />
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-tighter">Score: {hydrationScore}</span>
          </div>
        </motion.button>

        {/* Activity Card */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('activity')}
          className="flex flex-col items-start p-5 bg-green-50 dark:bg-green-900/20 rounded-3xl border border-green-100 dark:border-green-800/30 text-left relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Footprints size={64} />
          </div>
          <div className="h-10 w-10 bg-green-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-green-500/20">
            <Footprints size={20} />
          </div>
          <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Activity</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-green-900 dark:text-green-100">{currentSteps}</span>
            <span className="text-xs font-medium text-green-600/60 dark:text-green-400/60">/ {stepGoal}</span>
          </div>
          <div className="mt-4 w-full h-2 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((currentSteps / stepGoal) * 100, 100)}%` }}
              className="h-full bg-green-500"
            />
          </div>
          <div className="mt-3 flex items-center gap-1">
            <Flame size={12} className="text-orange-500" />
            <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-tighter">245 CAL BURNED</span>
          </div>
        </motion.button>
      </div>

      {/* Daily Insights Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Daily Insights</h4>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setActiveInsightTab('tips')}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all",
                  activeInsightTab === 'tips' 
                    ? "bg-white dark:bg-slate-700 text-green-500 shadow-sm" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                Tips
              </button>
              <button 
                onClick={() => setActiveInsightTab('alerts')}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all",
                  activeInsightTab === 'alerts' 
                    ? "bg-white dark:bg-slate-700 text-orange-500 shadow-sm" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                Alerts
              </button>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Smaller Chart */}
            <div className="flex-1 h-24 w-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 bg-blue-500 rounded-full"></div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Water</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Steps</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSteps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" strokeOpacity={0.5} />
                  <XAxis dataKey="name" hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  />
                  <Area type="monotone" dataKey="water" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorWater)" />
                  <Area type="monotone" dataKey="steps" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorSteps)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Tabbed Content on the right */}
            <div className="w-full md:w-64 min-h-[80px] flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-50 dark:border-slate-800/50 pt-4 md:pt-0 md:pl-6">
              <AnimatePresence mode="wait">
                {activeInsightTab === 'tips' ? (
                  <motion.div 
                    key="tips"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="relative"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Brain size={12} className="text-green-500" />
                      <h5 className="text-[9px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Daily Tip</h5>
                    </div>
                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                      "{healthTips[currentTipIndex]}"
                    </p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="alerts"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Bell size={12} className="text-orange-500" />
                        <h5 className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Upcoming</h5>
                      </div>
                      <button onClick={() => onNavigate('reminders')} className="text-[8px] font-bold text-green-500 uppercase tracking-widest">View All</button>
                    </div>
                    <div className="space-y-1.5">
                      {upcomingAlerts.slice(0, 1).map((alert) => (
                        <div key={alert.id} className="flex items-center gap-2 bg-orange-50/50 dark:bg-orange-900/10 p-1.5 rounded-lg border border-orange-100/50 dark:border-orange-800/20">
                          <div className="h-1 w-1 rounded-full bg-orange-400"></div>
                          <p className="text-[9px] font-bold text-slate-700 dark:text-slate-200 truncate flex-1">{alert.title}</p>
                        </div>
                      ))}
                      {upcomingAlerts.length === 0 && (
                        <p className="text-[9px] text-slate-400 italic">No pending alerts</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={() => onNavigate('mindfulness')}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-3xl border border-purple-100 dark:border-purple-800/30 transition-all active:scale-95"
        >
          <Brain className="text-purple-500" size={24} />
          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Zen</span>
        </button>
        <button 
          onClick={() => onNavigate('reminders')}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-3xl border border-orange-100 dark:border-orange-800/30 transition-all active:scale-95"
        >
          <Bell className="text-orange-500" size={24} />
          <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase">Alerts</span>
        </button>
        <button 
          onClick={() => onNavigate('hydration')}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/30 transition-all active:scale-95"
        >
          <Droplets className="text-blue-500" size={24} />
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">Logs</span>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Recent Activity</h4>
          <button 
            onClick={() => onNavigate('hydration')}
            className="text-[10px] font-bold text-blue-500 uppercase tracking-widest"
          >
            History
          </button>
        </div>
        
        <div className="space-y-2">
          {recentLogs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-400 italic">No activity logged yet today.</p>
            </div>
          ) : (
            recentLogs.slice(0, 3).map((log, idx) => (
              <div 
                key={idx}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-500">
                    <Droplets size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{log.amount}ml Water</p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {format(new Date(log.timestamp), 'h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
