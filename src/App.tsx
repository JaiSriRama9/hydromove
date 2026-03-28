import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, FirebaseUser } from './firebase';
import { 
  Droplets, 
  Footprints, 
  Brain, 
  Bell, 
  Settings as SettingsIcon, 
  LayoutDashboard,
  Moon,
  Sun,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { cn } from './lib/utils';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Hydration from './components/Hydration';
import Activity from './components/Activity';
import Mindfulness from './components/Mindfulness';
import Reminders from './components/Reminders';
import Settings from './components/Settings';
import DisciplineLock from './components/DisciplineLock';

type Tab = 'dashboard' | 'hydration' | 'activity' | 'mindfulness' | 'reminders' | 'settings';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [streak, setStreak] = useState(5);
  const [lockActive, setLockActive] = useState(false);
  const [lockReason, setLockReason] = useState<'hydration' | 'walking' | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={() => setActiveTab('dashboard')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />;
      case 'hydration': return <Hydration />;
      case 'activity': return <Activity />;
      case 'mindfulness': return <Mindfulness />;
      case 'reminders': return <Reminders />;
      case 'settings': return <Settings isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
      default: return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'hydration', icon: Droplets, label: 'Water' },
    { id: 'activity', icon: Footprints, label: 'Steps' },
    { id: 'mindfulness', icon: Brain, label: 'Zen' },
    { id: 'reminders', icon: Bell, label: 'Alerts' },
  ];

  return (
    <div className={cn(
      "flex h-screen w-full flex-col bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100",
      "max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-slate-200 dark:border-slate-800"
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
            <Droplets size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">HydroMove</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg border border-orange-100 dark:border-orange-800/30">
            <Flame size={16} className="text-orange-500" />
            <span className="text-xs font-bold text-orange-700 dark:text-orange-400">{streak}</span>
          </div>
          <button 
            onClick={() => setActiveTab('reminders')}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          >
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-orange-500 rounded-full border-2 border-white dark:border-slate-900"></span>
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "p-2 rounded-full transition-colors",
              activeTab === 'settings' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-3 z-40">
        <div className="flex justify-around items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all duration-300",
                activeTab === tab.id 
                  ? "text-green-600 dark:text-green-400 scale-110" 
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="h-1 w-1 bg-green-500 rounded-full mt-1"
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Discipline Lock Overlay */}
      <AnimatePresence>
        {lockActive && (
          <DisciplineLock 
            reason={lockReason} 
            onUnlock={() => setLockActive(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
