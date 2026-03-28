import { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from '../firebase';
import { Bell, Plus, Trash2, CheckCircle2, Circle, Calendar, CreditCard, Droplets, Footprints, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays } from 'date-fns';

import { cn } from '../lib/utils';

export default function Reminders() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'water' | 'walking' | 'bill' | 'custom'>('custom');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, `users/${auth.currentUser.uid}/reminders`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reminderList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReminders(reminderList);
    });

    return () => unsubscribe();
  }, []);

  const addReminder = async () => {
    if (!auth.currentUser || !newTitle) return;
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/reminders`), {
        uid: auth.currentUser.uid,
        title: newTitle,
        type: newType,
        isPaid: false,
        recurring: newType === 'bill',
        dueDate: newType === 'bill' ? addDays(new Date(), 30).toISOString() : null,
        createdAt: new Date().toISOString()
      });
      setNewTitle('');
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to add reminder', error);
    }
  };

  const togglePaid = async (id: string, currentStatus: boolean) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/reminders`, id), {
        isPaid: !currentStatus
      });
    } catch (error) {
      console.error('Failed to update reminder', error);
    }
  };

  const deleteReminder = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/reminders`, id));
    } catch (error) {
      console.error('Failed to delete reminder', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'water': return <Droplets className="text-blue-500" size={20} />;
      case 'walking': return <Footprints className="text-green-500" size={20} />;
      case 'bill': return <CreditCard className="text-orange-500" size={20} />;
      default: return <Bell className="text-purple-500" size={20} />;
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alerts & Reminders</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Stay on top of your discipline.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="h-12 w-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-500/20 hover:scale-105 transition-all active:scale-95"
        >
          {isAdding ? <Plus size={24} className="rotate-45" /> : <Plus size={24} />}
        </button>
      </div>

      {/* Add Reminder Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Title</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 transition-all"
                  placeholder="What should I remind you?"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {['water', 'walking', 'bill', 'custom'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewType(type as any)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all",
                        newType === type 
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white" 
                          : "bg-white text-slate-500 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                      )}
                    >
                      {getTypeIcon(type)}
                      <span className="text-xs font-bold capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={addReminder}
                className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all"
              >
                Add Reminder
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminders List */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {reminders.length === 0 ? (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
              <div className="h-20 w-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-300">
                <Bell size={40} />
              </div>
              <p className="text-sm italic">No reminders yet. Add one to get started!</p>
            </div>
          ) : (
            reminders.map((reminder) => (
              <motion.div
                key={reminder.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm transition-all",
                  reminder.isPaid && "opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center",
                    reminder.type === 'bill' ? "bg-orange-50 dark:bg-orange-900/30" : 
                    reminder.type === 'water' ? "bg-blue-50 dark:bg-blue-900/30" : 
                    reminder.type === 'walking' ? "bg-green-50 dark:bg-green-900/30" : "bg-purple-50 dark:bg-purple-900/30"
                  )}>
                    {getTypeIcon(reminder.type)}
                  </div>
                  <div>
                    <h5 className={cn(
                      "font-bold text-slate-900 dark:text-white",
                      reminder.isPaid && "line-through"
                    )}>{reminder.title}</h5>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reminder.type}</span>
                      {reminder.dueDate && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                          <Calendar size={10} />
                          {format(new Date(reminder.dueDate), 'MMM d')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {reminder.type === 'bill' && (
                    <button 
                      onClick={() => togglePaid(reminder.id, reminder.isPaid)}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        reminder.isPaid ? "text-green-500 bg-green-50 dark:bg-green-900/20" : "text-slate-300 hover:text-green-500"
                      )}
                    >
                      {reminder.isPaid ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                  )}
                  <button 
                    onClick={() => deleteReminder(reminder.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Smart Alerts Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[32px] border border-blue-100 dark:border-blue-800/30">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="text-blue-500" size={20} />
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-widest">Smart Alerts</h4>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          HydroMove automatically adjusts your hydration and walking alerts based on your current weather, activity level, and time of day.
        </p>
      </div>
    </div>
  );
}

