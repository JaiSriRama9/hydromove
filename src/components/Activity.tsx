import { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy, limit } from '../firebase';
import { Footprints, Flame, TrendingUp, Timer, Wind, Heart, MapPin, Activity as ActivityIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfDay } from 'date-fns';
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

  const progress = Math.min((steps / goal) * 100, 100);

  return (
    <div className="space-y-6 pb-8">
      {/* Progress Header */}
      <div className="relative h-64 w-full bg-green-500 rounded-[40px] overflow-hidden shadow-2xl shadow-green-500/30 flex flex-col items-center justify-center text-white">
        {/* Animated Background */}
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="absolute inset-0 bg-green-400/30 rounded-full blur-3xl -m-20"
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

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="h-10 w-10 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-red-500 mb-4">
            <Heart size={20} />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Heart Rate</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{heartRate}</span>
            <span className="text-xs font-medium text-slate-400">bpm</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="h-10 w-10 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-500 mb-4">
            <ActivityIcon size={20} />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distance</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">4.2</span>
            <span className="text-xs font-medium text-slate-400">km</span>
          </div>
        </div>
      </div>

      {/* Google Fit Integration Card */}
      <div className="bg-slate-900 dark:bg-slate-800 p-6 rounded-[32px] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <TrendingUp size={80} />
        </div>
        <div className="relative z-10">
          <h4 className="text-lg font-bold mb-2">Google Fit Sync</h4>
          <p className="text-sm text-slate-400 mb-6">Connect your Google Fit account to automatically sync steps, heart rate, and activity data.</p>
          <button className="w-full bg-white text-slate-900 py-4 rounded-2xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
            <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
            Connect Google Fit
          </button>
        </div>
      </div>

      {/* Weekly Goal Progress */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Weekly Progress</h4>
        <div className="flex justify-between items-end h-32 gap-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
            const h = [40, 60, 80, 50, 90, 30, 20][i];
            return (
              <div key={`${day}-${i}`} className="flex-1 flex flex-col items-center gap-3">
                <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-full h-full relative overflow-hidden">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    className={cn(
                      "absolute bottom-0 left-0 right-0 rounded-full",
                      h > 70 ? "bg-green-500" : "bg-green-300 dark:bg-green-700"
                    )}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400">{day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
