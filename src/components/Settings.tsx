import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, updateDoc, signOut } from '../firebase';
import { 
  User as UserIcon, 
  Settings as SettingsIcon, 
  Lock, 
  Bell, 
  Moon, 
  Sun, 
  LogOut, 
  Shield, 
  MapPin, 
  Smartphone, 
  HelpCircle,
  ChevronRight,
  Droplets,
  Footprints
} from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '../lib/utils';

interface SettingsProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function Settings({ isDarkMode, setIsDarkMode }: SettingsProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lockMode, setLockMode] = useState<'soft' | 'hard'>('soft');
  const [homeMode, setHomeMode] = useState(false);
  const [waterGoal, setWaterGoal] = useState(3000);
  const [stepGoal, setStepGoal] = useState(10000);
  const [reminderInterval, setReminderInterval] = useState(60);
  const [reminderStart, setReminderStart] = useState('08:00');
  const [reminderEnd, setReminderEnd] = useState('22:00');
  const [editingGoal, setEditingGoal] = useState<'water' | 'step' | null>(null);
  const [tempGoal, setTempGoal] = useState<string>('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', auth.currentUser!.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(data);
          setLockMode(data.lockMode || 'soft');
          setHomeMode(data.homeMode || false);
          setWaterGoal(data.dailyWaterGoal || 3000);
          setStepGoal(data.dailyStepGoal || 10000);
          setReminderInterval(data.reminderInterval || 60);
          setReminderStart(data.reminderStart || '08:00');
          setReminderEnd(data.reminderEnd || '22:00');
        }
      } catch (error) {
        console.error('Failed to fetch profile', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const updateSetting = async (key: string, value: any) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        [key]: value
      });
    } catch (error) {
      console.error('Failed to update setting', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const sections = [
    {
      title: 'Goals',
      items: [
        { 
          id: 'waterGoal', 
          icon: Droplets, 
          label: 'Daily Water Goal', 
          value: `${waterGoal}ml`, 
          color: 'text-blue-500',
          isEditing: editingGoal === 'water',
          action: () => {
            setEditingGoal('water');
            setTempGoal(waterGoal.toString());
          },
          save: () => {
            const num = parseInt(tempGoal);
            if (!isNaN(num) && num > 0) {
              setWaterGoal(num);
              updateSetting('dailyWaterGoal', num);
              setEditingGoal(null);
            }
          }
        },
        { 
          id: 'stepGoal', 
          icon: Footprints, 
          label: 'Daily Step Goal', 
          value: `${stepGoal}`, 
          color: 'text-green-500',
          isEditing: editingGoal === 'step',
          action: () => {
            setEditingGoal('step');
            setTempGoal(stepGoal.toString());
          },
          save: () => {
            const num = parseInt(tempGoal);
            if (!isNaN(num) && num > 0) {
              setStepGoal(num);
              updateSetting('dailyStepGoal', num);
              setEditingGoal(null);
            }
          }
        },
      ]
    },
    {
      title: 'Reminders',
      items: [
        { 
          id: 'reminderInterval', 
          icon: Bell, 
          label: 'Reminder Interval', 
          value: `${reminderInterval} mins`, 
          color: 'text-blue-500',
          action: () => {
            const val = prompt('Enter reminder interval in minutes (e.g., 30, 60, 120):', reminderInterval.toString());
            if (val) {
              const num = parseInt(val);
              if (!isNaN(num) && num > 0) {
                setReminderInterval(num);
                updateSetting('reminderInterval', num);
              }
            }
          }
        },
        { 
          id: 'reminderStart', 
          icon: Sun, 
          label: 'Start Time', 
          value: reminderStart, 
          color: 'text-amber-500',
          action: () => {
            const val = prompt('Enter start time (HH:mm):', reminderStart);
            if (val && /^([01]\d|2[0-3]):([0-5]\d)$/.test(val)) {
              setReminderStart(val);
              updateSetting('reminderStart', val);
            } else if (val) {
              alert('Please enter time in HH:mm format');
            }
          }
        },
        { 
          id: 'reminderEnd', 
          icon: Moon, 
          label: 'End Time', 
          value: reminderEnd, 
          color: 'text-indigo-500',
          action: () => {
            const val = prompt('Enter end time (HH:mm):', reminderEnd);
            if (val && /^([01]\d|2[0-3]):([0-5]\d)$/.test(val)) {
              setReminderEnd(val);
              updateSetting('reminderEnd', val);
            } else if (val) {
              alert('Please enter time in HH:mm format');
            }
          }
        },
      ]
    },
    {
      title: 'Discipline',
      items: [
        { 
          id: 'lockMode', 
          icon: Lock, 
          label: 'Lock Strictness', 
          value: lockMode === 'soft' ? 'Soft Mode' : 'Hard Mode', 
          color: 'text-orange-500',
          action: () => {
            const next = lockMode === 'soft' ? 'hard' : 'soft';
            setLockMode(next);
            updateSetting('lockMode', next);
          }
        },
        { 
          id: 'homeMode', 
          icon: MapPin, 
          label: 'Smart Home Mode', 
          value: homeMode ? 'Active' : 'Inactive', 
          color: 'text-purple-500',
          action: () => {
            const next = !homeMode;
            setHomeMode(next);
            updateSetting('homeMode', next);
          }
        },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { 
          id: 'darkMode', 
          icon: isDarkMode ? Sun : Moon, 
          label: 'Dark Mode', 
          value: isDarkMode ? 'On' : 'Off', 
          color: 'text-slate-500',
          action: () => setIsDarkMode(!isDarkMode)
        },
        { 
          id: 'notifications', 
          icon: Bell, 
          label: 'Notifications', 
          value: 'Enabled', 
          color: 'text-blue-500',
          action: () => alert('Notification settings are managed by your device.')
        },
      ]
    },
    {
      title: 'Account',
      items: [
        { 
          id: 'onboarding', 
          icon: HelpCircle, 
          label: 'Restart Onboarding', 
          value: '', 
          color: 'text-indigo-500',
          action: () => {
            if (confirm('Are you sure you want to restart the onboarding flow?')) {
              updateSetting('onboardingCompleted', false);
              alert('Onboarding will restart on your next visit or refresh.');
            }
          }
        },
        { 
          id: 'profile', 
          icon: UserIcon, 
          label: 'Edit Profile', 
          value: profile?.name || 'User', 
          color: 'text-slate-500',
          action: () => alert('Profile editing is coming soon!')
        },
        { 
          id: 'logout', 
          icon: LogOut, 
          label: 'Sign Out', 
          value: '', 
          color: 'text-red-500',
          action: handleLogout
        },
      ]
    }
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 pt-4">
        <div className="relative">
          <div className="h-24 w-24 rounded-[32px] bg-green-500 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-green-500/20">
            {profile?.name?.[0] || auth.currentUser?.displayName?.[0] || 'U'}
          </div>
          <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center text-green-500 shadow-lg">
            <Shield size={20} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">{profile?.name || auth.currentUser?.displayName || 'User'}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{auth.currentUser?.email}</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-8">
        {/* Daily Goals - More prominent section */}
        <div className="space-y-4 px-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Daily Health Goals</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Water Goal Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-500">
                  <Droplets size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-bold">Water Goal</h5>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tight">Daily Intake</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="number" 
                    value={waterGoal}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        setWaterGoal(val);
                        updateSetting('dailyWaterGoal', val);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-3 text-lg font-black focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ml</span>
                </div>
              </div>
            </div>

            {/* Step Goal Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-500">
                  <Footprints size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-bold">Step Goal</h5>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tight">Activity Target</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="number" 
                    value={stepGoal}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        setStepGoal(val);
                        updateSetting('dailyStepGoal', val);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-5 py-3 text-lg font-black focus:ring-2 focus:ring-green-500 transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">steps</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {sections.filter(s => s.title !== 'Goals').map((section) => (
          <div key={section.title} className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-4">{section.title}</h4>
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {section.items.map((item: any, idx) => (
                <div key={item.id}>
                  {item.isEditing ? (
                    <div className="p-5 space-y-3 bg-slate-50 dark:bg-slate-800/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800", item.color)}>
                            <item.icon size={20} />
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</span>
                        </div>
                        <button 
                          onClick={() => setEditingGoal(null)}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          value={tempGoal}
                          onChange={(e) => setTempGoal(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-green-500"
                          autoFocus
                        />
                        <button 
                          onClick={item.save}
                          className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-green-500/20"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={item.action}
                      className={cn(
                        "w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                        idx !== section.items.length - 1 && "border-b border-slate-50 dark:border-slate-800/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800",
                          item.color
                        )}>
                          <item.icon size={20} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">{item.value}</span>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* App Info */}
      <div className="text-center space-y-2 pt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HydroMove v1.0.0</p>
        <p className="text-[10px] font-medium text-slate-400">Made with ❤️ for Health Discipline</p>
      </div>
    </div>
  );
}

