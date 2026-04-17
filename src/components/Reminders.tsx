import { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc, OperationType, handleFirestoreError, getDoc, getDocs } from '../firebase';
import { Bell, Plus, Trash2, CheckCircle2, Circle, Calendar, CreditCard, Droplets, Footprints, AlertCircle, ChevronDown, ChevronUp, Clock, Tag, Heart, Zap, Star, Coffee, Utensils, Briefcase, Home, RotateCcw, Mic, Square, Play, Volume2, Music, Pause, Upload, FileAudio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { GoogleGenAI, Modality } from "@google/genai";

import { cn } from '../lib/utils';

export default function Reminders() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<string>('custom');
  const [newRecurrence, setNewRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekday' | 'monthly_specific'>('none');
  const [newDaysOfMonth, setNewDaysOfMonth] = useState<number[]>([]);
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [newScheduledTime, setNewScheduledTime] = useState<string>('');
  const [newIcon, setNewIcon] = useState<string>('Bell');
  const [newAmount, setNewAmount] = useState<number>(250);
  const [isAdding, setIsAdding] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'voiceNote' | 'alertTone' | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceNoteBase64, setVoiceNoteBase64] = useState<string | null>(null);
  const [isDefaultVoice, setIsDefaultVoice] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [alertToneBase64, setAlertToneBase64] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'dueDate' | 'createdAt' | 'type'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionErrorType, setPermissionErrorType] = useState<'denied' | 'unsupported' | null>(null);
  const [showToneLibrary, setShowToneLibrary] = useState(false);

  // Audio Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingType, setPlayingType] = useState<'voice' | 'tone' | null>(null);
  const [audioInstance, setAudioInstance] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  // Success animation state
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Proactive permission check
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        if (result.state === 'denied') {
          setPermissionErrorType('denied');
        }
        result.onchange = () => {
          if (result.state === 'denied') setPermissionErrorType('denied');
          else if (result.state === 'granted') setShowPermissionModal(false);
        };
      }).catch(err => console.warn('Permissions API not supported for microphone', err));
    }

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

  const generateWaterSchedule = async () => {
    if (!auth.currentUser) return;
    setIsGeneratingSchedule(true);

    try {
      // Clear existing daily water reminders first to avoid duplicates
      const existingQuery = query(
        collection(db, `users/${auth.currentUser.uid}/reminders`), 
        where('type', '==', 'water'),
        where('recurrence', '==', 'daily')
      );
      const existingSnap = await getDocs(existingQuery);
      const deletePromises = existingSnap.docs.map(d => deleteDoc(doc(db, `users/${auth.currentUser.uid}/reminders`, d.id)));
      await Promise.all(deletePromises);

      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userDocRef);
      const data = userSnap.data();
      const waterGoal = data?.dailyWaterGoal || 3000;
      
      // Wake hours: 07:00 to 22:00 (15 hours = 900 minutes)
      const wakeTime = 7 * 60; 
      const sleepTime = 22 * 60;
      const totalAvailableMins = sleepTime - wakeTime;
      
      // Standardize on 250ml glasses
      const glassSize = 250;
      const numGlasses = Math.ceil(waterGoal / glassSize);
      
      // Calculate interval (e.g. if 8 glasses, we want 7 gaps)
      const interval = Math.floor(totalAvailableMins / (numGlasses - 1));

      // Batch create reminders
      const promises = [];
      for (let i = 0; i < numGlasses; i++) {
        const timeInMins = wakeTime + (i * interval);
        const hours = Math.floor(timeInMins / 60);
        const mins = timeInMins % 60;
        const scheduledTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        
        promises.push(addDoc(collection(db, `users/${auth.currentUser.uid}/reminders`), {
          uid: auth.currentUser.uid,
          title: `Drink Water (${glassSize}ml)`,
          type: 'water',
          icon: 'Droplets',
          amount: glassSize,
          isPaid: false,
          recurring: true,
          recurrence: 'daily',
          scheduledTime,
          createdAt: new Date().toISOString()
        }));
      }

      await Promise.all(promises);
      alert(`Success! Generated ${numGlasses} hydration alerts spaced every ${interval} minutes from 07:00 to 22:00.`);
    } catch (error) {
      console.error("Failed to generate schedule", error);
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const generateDefaultVoice = async (type: string) => {
    // Don't overwrite if user has already recorded something manually
    if (voiceNoteBase64 && !isDefaultVoice) return;

    const messages: Record<string, string> = {
      water: "Time to drink some water! Stay hydrated.",
      walking: "Let's get those steps in! Time for a quick walk.",
      bill: "Don't forget to check your bills. Keep your finances in order.",
      habit: "Time for your habit! Consistency is key.",
      custom: "Here is your scheduled reminder. Stay on track!"
    };

    const prompt = messages[type] || messages.custom;
    setIsGeneratingVoice(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say cheerfully: ${prompt}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const pcmBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (pcmBase64) {
        const wavDataUrl = await pcmToWav(pcmBase64);
        setVoiceNoteBase64(wavDataUrl);
        setIsDefaultVoice(true);
      }
    } catch (error) {
      console.error('Failed to generate default voice note', error);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const pcmToWav = (pcmBase64: string, sampleRate: number = 24000): Promise<string> => {
    const binaryString = atob(pcmBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + bytes.length, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // FMT sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 for mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // Data sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, bytes.length, true);

    const blob = new Blob([wavHeader, bytes], { type: 'audio/wav' });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const addReminder = async () => {
    if (!auth.currentUser || !newTitle) return;

    // Enforce time gaps for water alerts
    if (newType === 'water' && newScheduledTime) {
      const [newHours, newMinutes] = newScheduledTime.split(':').map(Number);
      const newTimeInMinutes = newHours * 60 + newMinutes;
      const newGap = newAmount === 250 ? 30 : 60;

      const conflict = reminders.find(r => {
        if (r.type !== 'water' || !r.scheduledTime) return false;
        
        const [rHours, rMinutes] = r.scheduledTime.split(':').map(Number);
        const rTimeInMinutes = rHours * 60 + rMinutes;
        const rGap = r.amount === 250 ? 30 : 60;
        
        // The gap must be respected for both the existing and the new alert
        const requiredGap = Math.max(newGap, rGap);
        return Math.abs(newTimeInMinutes - rTimeInMinutes) < requiredGap;
      });

      if (conflict) {
        const conflictGap = conflict.amount === 250 ? 30 : 60;
        const maxGap = Math.max(newGap, conflictGap);
        alert(`To avoid alert repetition, please allow a ${maxGap === 30 ? '30-minute' : '1-hour'} gap between water alerts. There is an existing ${conflict.amount}ml alert at ${conflict.scheduledTime}.`);
        return;
      }
    }

    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/reminders`), {
        uid: auth.currentUser.uid,
        title: newTitle,
        type: newType,
        icon: newIcon,
        amount: newType === 'water' ? newAmount : null,
        isPaid: false,
        completedDates: newType === 'habit' ? [] : null,
        recurring: newType === 'habit' || newRecurrence !== 'none',
        recurrence: newType === 'habit' && newRecurrence === 'none' ? 'daily' : newRecurrence,
        daysOfMonth: newRecurrence === 'monthly_specific' ? newDaysOfMonth : null,
        scheduledTime: newScheduledTime || null,
        voiceNoteUrl: voiceNoteBase64,
        customAlertToneUrl: alertToneBase64,
        dueDate: newDueDate || (newType === 'bill' ? addDays(new Date(), 30).toISOString() : null),
        createdAt: new Date().toISOString()
      });
      setNewTitle('');
      setNewDueDate('');
      setNewScheduledTime('');
      setNewRecurrence('none');
      setNewDaysOfMonth([]);
      setNewAmount(250);
      setVoiceNoteBase64(null);
      setAlertToneBase64(null);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}/reminders`);
    }
  };

  const startRecording = async (type: 'voiceNote' | 'alertTone') => {
    // Check for iframe context early
    const isIframe = window.self !== window.top;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setPermissionErrorType('unsupported');
      setShowPermissionModal(true);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(device => device.kind === 'audioinput');
      if (!hasMic) {
        setPermissionErrorType('unsupported');
        setShowPermissionModal(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mime type
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac'
      ].find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          if (type === 'voiceNote') {
            setVoiceNoteBase64(base64data);
            setIsDefaultVoice(false);
          }
          else setAlertToneBase64(base64data);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingType(type);
      setShowPermissionModal(false);
    } catch (err) {
      console.error('Failed to start recording', err);
      const errorName = err instanceof Error ? err.name : '';
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Specifically check for OS-level or browser blocks
      if (
        errorName === 'NotAllowedError' || 
        errorName === 'PermissionDeniedError' || 
        errorMessage.toLowerCase().includes('permission denied') ||
        errorMessage.toLowerCase().includes('not allowed') ||
        errorMessage.toLowerCase().includes('system')
      ) {
        setPermissionErrorType('denied');
      } else {
        setPermissionErrorType('unsupported');
      }
      setShowPermissionModal(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setRecordingType(null);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'voiceNote' | 'alertTone') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size too large. Please select an audio file under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'voiceNote') {
        setVoiceNoteBase64(base64);
        setIsDefaultVoice(false);
      } else {
        setAlertToneBase64(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const predefinedTones = [
    { name: 'Success Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
    { name: 'Crystal Bell', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
    { name: 'Gentle Ping', url: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3' },
    { name: 'Digital Alert', url: 'https://assets.mixkit.co/active_storage/sfx/2566/2566-preview.mp3' },
  ];

  const handleSelectPredefinedTone = (url: string) => {
    if (!url) return;
    setAlertToneBase64(url);
    setShowToneLibrary(false);
    
    // Preview the tone using the main player logic
    toggleAudio('preview', url, 'tone');
  };

  const toggleAudio = (id: string, base64: string, type: 'voice' | 'tone') => {
    if (playingId === id && playingType === type && audioInstance) {
      if (audioInstance.paused) {
        audioInstance.play();
        setPlayingId(id);
      } else {
        audioInstance.pause();
        setPlayingId(null);
      }
      return;
    }

    // Stop existing audio
    if (audioInstance) {
      audioInstance.pause();
      audioInstance.removeEventListener('timeupdate', handleTimeUpdate);
      audioInstance.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioInstance.removeEventListener('ended', handleEnded);
    }

    const audio = new Audio();
    
    audio.onerror = (e) => {
      console.error("Audio failed to load:", e);
      setPlayingId(null);
      setPlayingType(null);
      
      // Provide more specific error info
      const error = (e as any).target?.error;
      let message = "Failed to play audio. The source might be broken or unsupported.";
      if (error?.code === 1) message = "Audio playback aborted.";
      if (error?.code === 2) message = "Network error while loading audio.";
      if (error?.code === 3) message = "Audio decoding failed. Unsupported format.";
      if (error?.code === 4) message = "Audio source not found or format not supported.";
      
      alert(message);
    };

    if (!base64 || base64.trim() === "") {
      console.error("Audio source is empty");
      return;
    }

    // Set crossOrigin for external URLs
    if (base64.startsWith('http')) {
      audio.crossOrigin = "anonymous";
    }

    audio.src = base64;
    setAudioInstance(audio);
    setPlayingId(id);
    setPlayingType(type);

    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('ended', () => {
      setPlayingId(null);
      setPlayingType(null);
      setCurrentTime(0);
    });

    audio.play().catch(err => {
      console.error("Playback failed:", err);
      setPlayingId(null);
      setPlayingType(null);
    });
  };

  const handleTimeUpdate = () => {
    if (audioInstance) setCurrentTime(audioInstance.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioInstance) setDuration(audioInstance.duration);
  };

  const handleEnded = () => {
    setPlayingId(null);
    setPlayingType(null);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioInstance) {
      audioInstance.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAudio = (base64: string) => {
    const audio = new Audio(base64);
    audio.play();
  };

  const getIconByName = (name: string) => {
    const iconObj = availableIcons.find(i => i.name === name);
    return iconObj ? <iconObj.icon size={20} /> : <Bell size={20} />;
  };

  const getTypeIcon = (type: string, iconName?: string) => {
    if (iconName) return getIconByName(iconName);
    switch (type) {
      case 'water': return <Droplets className="text-blue-500" size={20} />;
      case 'walking': return <Footprints className="text-brand transition-colors duration-500" size={20} />;
      case 'bill': return <CreditCard className="text-orange-500" size={20} />;
      case 'habit': return <Zap className="text-yellow-500" size={20} />;
      default: return <Bell className="text-brand transition-colors duration-500" size={20} />;
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
    const path = `users/${auth.currentUser.uid}/reminders/${id}`;
    try {
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/reminders`, id), {
        isPaid: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };
  
  const toggleHabit = async (id: string, completedDates: string[]) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/reminders/${id}`;
    const today = startOfDay(new Date()).toISOString();
    const isCompletedToday = completedDates.includes(today);
    
    let updatedDates = [...completedDates];
    if (isCompletedToday) {
      updatedDates = updatedDates.filter(d => d !== today);
    } else {
      updatedDates.push(today);
    }

    try {
      if (!isCompletedToday) {
        setJustCompletedId(id);
        setTimeout(() => setJustCompletedId(null), 1000);
      }
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/reminders`, id), {
        completedDates: updatedDates
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteReminder = async (id: string) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/reminders/${id}`;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/reminders`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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
            onClick={() => setIsAdding(!isAdding)}
            className="h-12 w-12 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20 hover:scale-105 transition-all active:scale-95 duration-500"
          >
            {isAdding ? <Plus size={24} className="rotate-45" /> : <Plus size={24} />}
          </button>
        </div>
      </div>

      {/* Sorting Controls */}
      <div className="px-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort by</span>
          <button 
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'createdAt', label: 'Recent', icon: Clock },
            { id: 'dueDate', label: 'Due Date', icon: Calendar },
            { id: 'type', label: 'Type', icon: Tag },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setSortBy(option.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                sortBy === option.id 
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-md" 
                  : "bg-white text-slate-500 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
              )}
            >
              <option.icon size={14} />
              {option.label}
            </button>
          ))}
        </div>
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
                  {['water', 'walking', 'bill', 'habit', 'custom'].map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setNewType(type);
                        if (type === 'water') {
                          setNewIcon('Droplets');
                          setNewTitle('Drink Water');
                        }
                        else if (type === 'walking') setNewIcon('Footprints');
                        else if (type === 'bill') setNewIcon('CreditCard');
                        else if (type === 'habit') {
                          setNewIcon('Zap');
                          setNewRecurrence('daily');
                        }
                        else setNewIcon('Bell');
                        generateDefaultVoice(type);
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
                
                {newType === 'water' && (
                  <div className="space-y-2 mt-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Intake Amount</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[250, 500, 750].map((ml) => (
                        <button
                          key={ml}
                          onClick={() => {
                            setNewAmount(ml);
                            setNewTitle(`Drink ${ml}ml Water`);
                          }}
                          className={cn(
                            "py-2 rounded-xl text-xs font-bold border transition-all",
                            newAmount === ml
                              ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                              : "bg-white text-slate-500 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                          )}
                        >
                          {ml}ml
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {newType === 'custom' && (
                  <div className="flex flex-wrap gap-2 mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    {availableIcons.map((icon) => (
                      <button
                        key={icon.name}
                        onClick={() => setNewIcon(icon.name)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          newIcon === icon.name ? "bg-brand text-white transition-colors duration-500" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Alert Time</label>
                  <input 
                    type="time" 
                    value={newScheduledTime}
                    onChange={(e) => setNewScheduledTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Recurrence</label>
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 transition-all"
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekday">Every Weekday</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="monthly_specific">Monthly (Specific Days)</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Attachments</label>
                    {window.self !== window.top && (
                      <span className="text-[9px] text-blue-500 font-bold uppercase animate-pulse flex items-center gap-1">
                        <AlertCircle size={10} />
                        Iframe Mode
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative group">
                      <div className="flex gap-1">
                        <button
                          onClick={() => isRecording && recordingType === 'voiceNote' ? stopRecording() : startRecording('voiceNote')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                            voiceNoteBase64 ? "bg-blue-500 text-white border-blue-500" : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-transparent",
                            isGeneratingVoice && "animate-pulse opacity-70",
                            isRecording && recordingType === 'voiceNote' && "bg-red-500 text-white border-red-500 animate-pulse"
                          )}
                        >
                          {isGeneratingVoice ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            isRecording && recordingType === 'voiceNote' ? <Square size={16} className="animate-pulse" /> : <Mic size={16} />
                          )}
                          <span className="text-[10px] font-bold uppercase whitespace-nowrap hidden sm:inline">
                            {isRecording && recordingType === 'voiceNote' ? 'Rec...' : 
                             isGeneratingVoice ? 'Gen...' : 
                             (voiceNoteBase64 ? 'Voice' : 'Voice')}
                          </span>
                        </button>
                        <label className="flex items-center justify-center p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors">
                          <Upload size={14} />
                          <input 
                            type="file" 
                            accept="audio/*" 
                            className="hidden" 
                            onChange={(e) => handleAudioUpload(e, 'voiceNote')}
                          />
                        </label>
                      </div>
                      {voiceNoteBase64 && !isRecording && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setVoiceNoteBase64(null); }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md border border-white dark:border-slate-900 hover:scale-110 transition-transform z-10"
                        >
                          <Plus size={10} className="rotate-45" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 relative group">
                      <div className="flex gap-1">
                        <div className="flex-1 flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                          <button
                            onClick={() => isRecording && recordingType === 'alertTone' ? stopRecording() : startRecording('alertTone')}
                            className={cn(
                              "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
                              alertToneBase64 ? "bg-purple-500 text-white" : "text-slate-500",
                              isRecording && recordingType === 'alertTone' && "bg-red-500 text-white animate-pulse"
                            )}
                            title="Record Tone"
                          >
                            {isRecording && recordingType === 'alertTone' ? <Square size={14} /> : <Mic size={14} />}
                          </button>
                          <button
                            onClick={() => setShowToneLibrary(true)}
                            className={cn(
                              "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
                              alertToneBase64 && !isRecording ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "text-slate-500"
                            )}
                            title="Tone Library"
                          >
                            <Music size={14} />
                          </button>
                          <label className="flex-1 flex items-center justify-center p-2 rounded-lg text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors">
                            <Upload size={14} />
                            <input 
                              type="file" 
                              accept="audio/*" 
                              className="hidden" 
                              onChange={(e) => handleAudioUpload(e, 'alertTone')}
                            />
                          </label>
                        </div>
                      </div>
                      {alertToneBase64 && !isRecording && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setAlertToneBase64(null); }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md border border-white dark:border-slate-900 hover:scale-110 transition-transform z-10"
                        >
                          <Plus size={10} className="rotate-45" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {newRecurrence === 'monthly_specific' && (
                <div className="space-y-2 mt-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-2">Select Days of Month</label>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <button
                        key={day}
                        onClick={() => {
                          if (newDaysOfMonth.includes(day)) {
                            setNewDaysOfMonth(newDaysOfMonth.filter(d => d !== day));
                          } else {
                            setNewDaysOfMonth([...newDaysOfMonth, day].sort((a, b) => a - b));
                          }
                        }}
                        className={cn(
                          "h-8 w-8 rounded-lg text-xs font-bold transition-all",
                          newDaysOfMonth.includes(day)
                            ? "bg-brand text-white shadow-sm shadow-brand/20 transition-colors duration-500"
                            : "bg-white dark:bg-slate-700 text-slate-500 border border-slate-100 dark:border-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={addReminder}
                className="w-full bg-brand text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand/20 hover:opacity-90 transition-all duration-500"
              >
                Add Reminder
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminders List */}
      <div className="space-y-8">
        {/* Habits Section */}
        {sortedReminders.some(r => r.type === 'habit') && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-4">Daily Habits</h3>
            <div className="grid grid-cols-1 gap-3">
              {sortedReminders.filter(r => r.type === 'habit').map(habit => {
                const today = startOfDay(new Date()).toISOString();
                const isCompletedToday = habit.completedDates?.includes(today);
                
                return (
                  <motion.div
                    key={habit.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0,
                      backgroundColor: justCompletedId === habit.id ? ['#ffffff', '#f0fdf4', '#ffffff'] : undefined,
                    }}
                    className={cn(
                      "p-5 rounded-3xl border flex items-center justify-between shadow-sm transition-all",
                      isCompletedToday 
                        ? "bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-800" 
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all relative overflow-hidden",
                        isCompletedToday ? "bg-brand text-white shadow-lg shadow-brand/20 transition-colors duration-500" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600"
                      )}>
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={isCompletedToday ? 'done' : 'undone'}
                            initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
                            transition={{ type: "spring", stiffness: 400, damping: 15 }}
                          >
                            {isCompletedToday ? <CheckCircle2 size={24} /> : getTypeIcon('habit')}
                          </motion.div>
                        </AnimatePresence>
                        
                        {justCompletedId === habit.id && (
                          <motion.div
                            initial={{ scale: 0, opacity: 1 }}
                            animate={{ scale: 4, opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="absolute inset-0 bg-white/30 rounded-full"
                          />
                        )}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white">{habit.title}</h5>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {habit.recurrence === 'daily' ? 'Repeat Daily' : `Every ${habit.recurrence}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleHabit(habit.id, habit.completedDates || [])}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                          isCompletedToday 
                            ? "bg-green-50 text-green-600 dark:bg-green-900/20" 
                            : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-yellow-50 hover:text-yellow-600"
                        )}
                      >
                        {isCompletedToday ? 'Done for today' : 'Mark as done'}
                      </button>
                      <button 
                        onClick={() => deleteReminder(habit.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular Reminders Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-4">Scheduled Alerts</h3>
          <AnimatePresence initial={false}>
            {sortedReminders.filter(r => r.type !== 'habit').length === 0 ? (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
                <div className="h-20 w-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-300">
                  <Bell size={40} />
                </div>
                <p className="text-sm italic">No scheduled alerts yet.</p>
              </div>
            ) : (
              sortedReminders.filter(r => r.type !== 'habit').map((reminder) => (
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
                <div className="flex items-center gap-4 cursor-pointer group/item" onClick={() => {
                  if (reminder.voiceNoteUrl) toggleAudio(reminder.id, reminder.voiceNoteUrl, 'voice');
                  else if (reminder.customAlertToneUrl) toggleAudio(reminder.id, reminder.customAlertToneUrl, 'tone');
                }}>
                  <div 
                    className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center relative transition-all active:scale-95",
                      reminder.type === 'bill' ? "bg-orange-50 dark:bg-orange-900/30" : 
                      reminder.type === 'water' ? "bg-blue-50 dark:bg-blue-900/30" : 
                      reminder.type === 'walking' ? "bg-green-50 dark:bg-green-900/30" : "bg-purple-50 dark:bg-purple-900/30",
                      isOverdue(reminder.dueDate, reminder.isPaid) && "bg-red-100 dark:bg-red-900/40",
                      (reminder.voiceNoteUrl || reminder.customAlertToneUrl) && "group-hover/item:ring-2 group-hover/item:ring-green-500/50"
                    )}
                  >
                    {getTypeIcon(reminder.type, reminder.icon)}
                    {isOverdue(reminder.dueDate, reminder.isPaid) && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                        <AlertCircle size={10} className="text-white" />
                      </span>
                    )}
                    {(reminder.voiceNoteUrl || reminder.customAlertToneUrl) && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-green-500">
                        {playingId === reminder.id ? (
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                          >
                            <Pause size={10} fill="currentColor" />
                          </motion.div>
                        ) : (
                          <Play size={10} fill="currentColor" />
                        )}
                      </div>
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
                      {reminder.amount && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                          <Droplets size={10} />
                          {reminder.amount}ml
                        </div>
                      )}
                      {reminder.dueDate && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest",
                          isOverdue(reminder.dueDate, reminder.isPaid) ? "text-red-500" : "text-orange-500"
                        )}>
                          <Calendar size={10} />
                          {format(new Date(reminder.dueDate), 'MMM d')}
                        </div>
                      )}
                      {reminder.scheduledTime && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <Clock size={10} />
                          {reminder.scheduledTime}
                        </div>
                      )}
                      {reminder.recurrence && reminder.recurrence !== 'none' && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                          <RotateCcw size={10} />
                          {reminder.recurrence === 'weekday' ? 'Mon-Fri' : 
                           reminder.recurrence === 'monthly_specific' ? `Days: ${reminder.daysOfMonth?.join(', ')}` : 
                           reminder.recurrence}
                        </div>
                      )}
                    </div>
                    {(reminder.voiceNoteUrl || reminder.customAlertToneUrl) && (
                      <div className="space-y-2 mt-2">
                        <div className="flex gap-2">
                          {reminder.voiceNoteUrl && (
                            <button 
                              onClick={() => toggleAudio(reminder.id, reminder.voiceNoteUrl, 'voice')}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                                playingId === reminder.id && playingType === 'voice'
                                  ? "bg-blue-500 text-white"
                                  : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                              )}
                            >
                              {playingId === reminder.id && playingType === 'voice' ? <Pause size={12} /> : <Volume2 size={12} />}
                              Voice Note
                            </button>
                          )}
                          {reminder.customAlertToneUrl && (
                            <button 
                              onClick={() => toggleAudio(reminder.id, reminder.customAlertToneUrl, 'tone')}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                                playingId === reminder.id && playingType === 'tone'
                                  ? "bg-purple-500 text-white"
                                  : "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100"
                              )}
                            >
                              {playingId === reminder.id && playingType === 'tone' ? <Pause size={12} /> : <Music size={12} />}
                              Alert Tone
                            </button>
                          )}
                        </div>
                        
                        {playingId === reminder.id && (
                          <motion.div 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl space-y-1"
                          >
                            <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(duration)}</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max={duration || 0}
                              step="0.1"
                              value={currentTime}
                              onChange={handleSeek}
                              className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                          </motion.div>
                        )}
                      </div>
                    )}
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
    </div>

    {/* Smart Alerts Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[32px] border border-blue-100 dark:border-blue-800/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-blue-500" size={20} />
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-widest">Smart Alerts</h4>
          </div>
          <button 
            onClick={generateWaterSchedule}
            disabled={isGeneratingSchedule}
            className="px-4 py-2 bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isGeneratingSchedule ? 'Syncing...' : 'Sync Hydration Schedule'}
          </button>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Based on your daily goal, HydroMove can intelligently split your intake into equal intervals to ensure you stay hydrated all day.
        </p>
      </div>

      {/* Permission Error Modal */}
      <AnimatePresence>
        {showPermissionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="h-16 w-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
                <Mic className="text-red-500" size={32} />
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {permissionErrorType === 'denied' ? 'Permission Required' : 'Recording Not Supported'}
              </h3>
              
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                {permissionErrorType === 'denied' 
                  ? "We couldn't access your microphone. This is often caused by the browser's security policy for embedded apps or a block in your System Settings (OS level)." 
                  : "Your browser or device doesn't seem to support audio recording. Please try using a modern browser like Chrome or Safari in a new tab."}
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  <Plus className="rotate-45" size={20} />
                  Open in New Tab (Recommended)
                </button>
                
                <button 
                  onClick={() => setShowPermissionModal(false)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Troubleshooting</h4>
                <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <div className="h-1 w-1 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <span><b>Permission Blocked:</b> Check your browser's address bar for a "blocked microphone" icon and click it to allow access.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1 w-1 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <span><b>System Settings:</b> Ensure your OS (Windows/macOS) settings allow your browser to use the microphone.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1 w-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <span><b>AI Studio Preview:</b> If you are in the unified preview, click <b>"Open in New Tab"</b> above. Microphone access is often restricted in iframes for security.</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToneLibrary && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowToneLibrary(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Music className="text-purple-500" />
                Tone Library
              </h3>
              <div className="space-y-2">
                {predefinedTones.map((tone) => (
                  <button
                    key={tone.name}
                    onClick={() => handleSelectPredefinedTone(tone.url)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl transition-all border",
                      alertToneBase64 === tone.url 
                        ? "bg-purple-100 dark:bg-purple-900/30 border-purple-200" 
                        : "bg-slate-50 dark:bg-slate-800 border-transparent hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    )}
                  >
                    <span className="font-bold text-sm tracking-tight">{tone.name}</span>
                    {playingId === 'preview' && playingType === 'tone' && audioInstance?.src === tone.url ? (
                      <Pause size={14} className="text-purple-600" />
                    ) : (
                      <Play size={14} className="text-purple-500" />
                    )}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowToneLibrary(false)}
                className="w-full mt-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-400"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

