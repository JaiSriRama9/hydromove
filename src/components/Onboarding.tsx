import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Droplets, Footprints, Brain, Bell, ChevronRight, Check } from 'lucide-react';
import { auth, db, doc, setDoc } from '../firebase';

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to HydroMove",
    description: "Your personal companion for health discipline. Let's get you started with a few quick settings.",
    icon: Brain,
    color: "bg-purple-500",
  },
  {
    title: "Stay Hydrated",
    description: "We'll help you track your water intake and send smart reminders to keep you hydrated.",
    icon: Droplets,
    color: "bg-blue-500",
    field: "dailyWaterGoal",
    defaultValue: 3000,
    unit: "ml",
  },
  {
    title: "Keep Moving",
    description: "Track your steps and log your exercises to maintain peak physical activity.",
    icon: Footprints,
    color: "bg-green-500",
    field: "dailyStepGoal",
    defaultValue: 10000,
    unit: "steps",
  },
  {
    title: "Mindful Moments",
    description: "Take a break with guided breathing exercises to reduce stress and improve focus.",
    icon: Brain,
    color: "bg-indigo-500",
  },
  {
    title: "Smart Reminders",
    description: "Never miss a task. Set custom alerts for bills, habits, and health goals.",
    icon: Bell,
    color: "bg-orange-500",
  }
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [goals, setGoals] = useState({
    dailyWaterGoal: 3000,
    dailyStepGoal: 10000,
  });

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'users', auth.currentUser.uid), {
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName || 'User',
            ...goals,
            onboardingCompleted: true,
            createdAt: new Date().toISOString()
          }, { merge: true });
          onComplete();
        } catch (error) {
          console.error("Failed to complete onboarding", error);
        }
      }
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-slate-900 dark:bg-white' : 'w-2 bg-slate-200 dark:bg-slate-800'}`} 
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 text-center"
          >
            <div className={`mx-auto h-24 w-24 ${step.color} rounded-[32px] flex items-center justify-center text-white shadow-xl shadow-current/20`}>
              <step.icon size={48} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{step.title}</h2>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
            </div>

            {step.field && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <input 
                    type="number" 
                    value={goals[step.field as keyof typeof goals]}
                    onChange={(e) => setGoals({...goals, [step.field!]: parseInt(e.target.value) || 0})}
                    className="w-32 text-4xl font-black text-center bg-transparent border-b-4 border-slate-900 dark:border-white focus:outline-none"
                  />
                  <span className="text-xl font-bold text-slate-400">{step.unit}</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <button 
          onClick={handleNext}
          className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-[24px] font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {currentStep === steps.length - 1 ? (
            <>Get Started <Check size={20} /></>
          ) : (
            <>Continue <ChevronRight size={20} /></>
          )}
        </button>
      </div>
    </div>
  );
}
