import { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy, limit, deleteDoc, doc, OperationType, handleFirestoreError } from '../firebase';
import { Droplets, Plus, Trash2, History, Info, Wind, Thermometer, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay } from 'date-fns';

import { cn } from '../lib/utils';

export default function Hydration() {
  const [amount, setAmount] = useState<number>(250);
  const [logs, setLogs] = useState<any[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [goal, setGoal] = useState(3000);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const today = startOfDay(new Date());
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/hydration`),
      where('timestamp', '>=', today.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hydrationLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(hydrationLogs);
      setTotalToday(hydrationLogs.reduce((acc, curr: any) => acc + curr.amount, 0));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/hydration`);
    });

    // Fetch goal
    const userDocRef = doc(db, 'users', auth.currentUser?.uid || 'unknown');
    const unsubscribeGoal = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.dailyWaterGoal) setGoal(data.dailyWaterGoal);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    return () => {
      unsubscribe();
      unsubscribeGoal();
    };
  }, []);

  const logWater = async (ml: number) => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/hydration`), {
        uid: auth.currentUser.uid,
        amount: ml,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log water', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteLog = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/hydration`, id));
    } catch (error) {
      console.error('Failed to delete log', error);
    }
  };

  const quickAmounts = [250, 500, 750];
  const progress = Math.min((totalToday / goal) * 100, 100);

  return (
    <div className="space-y-6 pb-8">
      {/* Progress Header */}
      <div className="relative h-64 w-full bg-blue-500 rounded-[40px] overflow-hidden shadow-2xl shadow-blue-500/30 flex flex-col items-center justify-center text-white">
        {/* Animated Water Background */}
        <motion.div 
          animate={{ 
            y: [0, -10, 0],
            rotate: [0, 1, 0]
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="absolute bottom-0 left-0 right-0 bg-blue-400/30 h-1/2 rounded-t-[100%]"
        />
        
        <div className="relative z-10 flex flex-col items-center">
          <Droplets size={48} className="mb-2 opacity-80" />
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black">{totalToday}</span>
            <span className="text-xl font-medium opacity-60">ml</span>
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

      {/* Smart Calculation Info */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
        <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-500">
          <Info size={20} />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Smart Goal</h4>
          <p className="text-sm font-medium">Increased by 500ml due to 30°C weather</p>
        </div>
        <div className="flex gap-2">
          <Thermometer size={16} className="text-orange-500" />
          <Wind size={16} className="text-blue-400" />
        </div>
      </div>

      {/* Quick Log Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {quickAmounts.map((ml) => (
          <motion.button
            key={ml}
            whileTap={{ scale: 0.95 }}
            onClick={() => logWater(ml)}
            disabled={loading}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-500 transition-all group"
          >
            <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Droplets size={20} />
            </div>
            <span className="text-sm font-black text-slate-900 dark:text-white">{ml}ml</span>
          </motion.button>
        ))}
      </div>

      {/* Custom Log */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl px-6 py-4 text-lg font-bold focus:outline-none focus:border-blue-500 transition-all"
            placeholder="Custom amount..."
          />
          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ml</span>
        </div>
        <button 
          onClick={() => logWater(amount)}
          disabled={loading || !amount}
          className="bg-blue-500 text-white p-4 rounded-3xl shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center aspect-square"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      </div>

      {/* History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <History size={16} />
            Today's Logs
          </h4>
        </div>
        
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic text-sm">
                No water logged yet today. Stay hydrated!
              </div>
            ) : (
              logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-500">
                      <Droplets size={18} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white">{log.amount}ml</h5>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        {format(new Date(log.timestamp), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteLog(log.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
