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
          action: () => {
            const val = prompt('Enter new water goal (ml):', waterGoal.toString());
            if (val) {
              const num = parseInt(val);
              setWaterGoal(num);
              updateSetting('dailyWaterGoal', num);
            }
          }
        },
        { 
          id: 'stepGoal', 
          icon: Footprints, 
          label: 'Daily Step Goal', 
          value: `${stepGoal}`, 
          color: 'text-green-500',
          action: () => {
            const val = prompt('Enter new step goal:', stepGoal.toString());
            if (val) {
              const num = parseInt(val);
              setStepGoal(num);
              updateSetting('dailyStepGoal', num);
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
        {sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-4">{section.title}</h4>
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {section.items.map((item, idx) => (
                <button
                  key={item.id}
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

