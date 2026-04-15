import { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc, OperationType, handleFirestoreError } from '../firebase';
import { Bell, Plus, Trash2, CheckCircle2, Circle, Calendar, CreditCard, Droplets, Footprints, AlertCircle, ChevronDown, ChevronUp, Clock, Tag, Heart, Zap, Star, Coffee, Utensils, Briefcase, Home, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';

import { cn } from '../lib/utils';

export default function Reminders() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<string>('custom');
  const [newRecurrence, setNewRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [newIcon, setNewIcon] = useState<string>('Bell');
  const [isAdding, setIsAdding] = useState(false);
  const [sortBy, setSortBy] = useState<'dueDate' | 'createdAt' | 'type'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const availableIcons = [
    { name: 'Bell', icon: Bell },
    { name: 'Heart', icon: Heart },
    { name: 'Zap', icon: Zap },
    { name: 'Star', icon: Star },
    { name: 'Coffee', icon: Coffee },
    { name: 'Utensils', icon: Utensils },
    { name: 'Briefcase', icon: Briefcase },
    { name: 'Home', icon: Home },
    { name: 'Droplets', icon: Droplets },
    { name: 'Footprints', icon: Footprints },
    { name: 'CreditCard', icon: CreditCard },
  ];

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/reminders`);
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
        icon: newIcon,
        isPaid: false,
        recurring: newRecurrence !== 'none',
        recurrence: newRecurrence,
        dueDate: newDueDate || (newType === 'bill' ? addDays(new Date(), 30).toISOString() : null),
        createdAt: new Date().toISOString()
      });
      setNewTitle('');
      setNewDueDate('');
      setNewRecurrence('none');
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to add reminder', error);
    }
  };

  const getIconByName = (name: string) => {
    const iconObj = availableIcons.find(i => i.name === name);
    return iconObj ? <iconObj.icon size={20} /> : <Bell size={20} />;
  };

  const getTypeIcon = (type: string, iconName?: string) => {
    if (iconName) return getIconByName(iconName);
    switch (type) {
      case 'water': return <Droplets className="text-blue-500" size={20} />;
      case 'walking': return <Footprints className="text-green-500" size={20} />;
      case 'bill': return <CreditCard className="text-orange-500" size={20} />;
      default: return <Bell className="text-purple-500" size={20} />;
    }
  };

  const sortedReminders = [...reminders].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'dueDate') {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      comparison = dateA - dateB;
    } else if (sortBy === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === 'type') {
      comparison = a.type.localeCompare(b.type);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const isOverdue = (dueDate: string | null, isPaid: boolean) => {
    if (!dueDate || isPaid) return false;
    return isBefore(new Date(dueDate), startOfDay(new Date()));
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

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alerts & Reminders</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Stay on top of your discipline.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400"
          >
            {sortOrder === 'asc' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="h-12 w-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-500/20 hover:scale-105 transition-all active:scale-95"
          >
            {isAdding ? <Plus size={24} className="rotate-45" /> : <Plus size={24} />}
          </button>
        </div>
      </div>

      {/* Sorting Controls */}
      <div className="flex items-center gap-2 px-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'createdAt', label: 'Recent', icon: Clock },
          { id: 'dueDate', label: 'Due Date', icon: Calendar },
          { id: 'type', label: 'Type', icon: Tag },
        ].map((option) => (
          <button
            key={option.id}
            onClick={() => setSortBy(option.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
              sortBy === option.id 
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                : "bg-white text-slate-500 border border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
            )}
          >
            <option.icon size={14} />
            {option.label}
          </button>
        ))}
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
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Type & Icon</label>
                <div className="grid grid-cols-2 gap-2">
                  {['water', 'walking', 'bill', 'custom'].map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setNewType(type);
                        if (type === 'water') setNewIcon('Droplets');
                        else if (type === 'walking') setNewIcon('Footprints');
                        else if (type === 'bill') setNewIcon('CreditCard');
                        else setNewIcon('Bell');
                      }}
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
                {newType === 'custom' && (
                  <div className="flex flex-wrap gap-2 mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    {availableIcons.map((icon) => (
                      <button
                        key={icon.name}
                        onClick={() => setNewIcon(icon.name)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          newIcon === icon.name ? "bg-green-500 text-white" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        )}
                      >
                        <icon.icon size={18} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Due Date</label>
                  <input 
                    type="date" 
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Recurrence</label>
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 transition-all"
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
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
          {sortedReminders.length === 0 ? (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
              <div className="h-20 w-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-300">
                <Bell size={40} />
              </div>
              <p className="text-sm italic">No reminders yet. Add one to get started!</p>
            </div>
          ) : (
            sortedReminders.map((reminder) => (
              <motion.div
                key={reminder.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "bg-white dark:bg-slate-900 p-5 rounded-3xl border flex items-center justify-between shadow-sm transition-all",
                  reminder.isPaid ? "opacity-60 border-slate-100 dark:border-slate-800" : 
                  isOverdue(reminder.dueDate, reminder.isPaid) ? "border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10" : "border-slate-100 dark:border-slate-800"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center relative",
                    reminder.type === 'bill' ? "bg-orange-50 dark:bg-orange-900/30" : 
                    reminder.type === 'water' ? "bg-blue-50 dark:bg-blue-900/30" : 
                    reminder.type === 'walking' ? "bg-green-50 dark:bg-green-900/30" : "bg-purple-50 dark:bg-purple-900/30",
                    isOverdue(reminder.dueDate, reminder.isPaid) && "bg-red-100 dark:bg-red-900/40"
                  )}>
                    {getTypeIcon(reminder.type, reminder.icon)}
                    {isOverdue(reminder.dueDate, reminder.isPaid) && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                        <AlertCircle size={10} className="text-white" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h5 className={cn(
                      "font-bold text-slate-900 dark:text-white",
                      reminder.isPaid && "line-through",
                      isOverdue(reminder.dueDate, reminder.isPaid) && "text-red-600 dark:text-red-400"
                    )}>{reminder.title}</h5>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reminder.type}</span>
                      {reminder.dueDate && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest",
                          isOverdue(reminder.dueDate, reminder.isPaid) ? "text-red-500" : "text-orange-500"
                        )}>
                          <Calendar size={10} />
                          {format(new Date(reminder.dueDate), 'MMM d')}
                        </div>
                      )}
                      {reminder.recurrence && reminder.recurrence !== 'none' && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                          <RotateCcw size={10} />
                          {reminder.recurrence}
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

