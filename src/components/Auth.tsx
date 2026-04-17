import { useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInAnonymously } from '../firebase';
import { motion } from 'motion/react';
import { Droplets, LogIn, Mail, Phone, User as UserIcon } from 'lucide-react';

interface AuthProps {
  onLogin: () => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'otp' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [otpCode, setOtpCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      onLogin();
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInAnonymously(auth);
      onLogin();
    } catch (error) {
      console.error('Guest login failed', error);
    }
  };

  const handleSendOtp = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      setOtpStep('code');
    } else {
      alert('Please enter a valid 10-digit phone number');
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode === '123456') {
      setIsLoggingIn(true);
      try {
        await signInAnonymously(auth);
        onLogin();
      } catch (error) {
        console.error('Login failed', error);
        alert('Login failed. Please try again.');
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      alert('Invalid code. For testing, use: 123456');
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-brand rounded-3xl flex items-center justify-center text-white shadow-xl shadow-brand/20">
            <Droplets size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">HydroMove</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Health Discipline Coach</p>
          </div>
        </div>

        <div className="space-y-4 pt-8">
          {mode === 'login' && (
            <div className="space-y-4">
              <button 
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-4 font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                Continue with Google
              </button>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="mx-4 flex-shrink text-xs font-medium uppercase tracking-widest text-slate-400">or</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setMode('otp')}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-4 text-slate-600 hover:bg-slate-200 transition-all dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <Phone size={20} />
                  <span className="text-xs font-semibold">Phone</span>
                </button>
                <button 
                  onClick={() => setMode('guest')}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-4 text-slate-600 hover:bg-slate-200 transition-all dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <UserIcon size={20} />
                  <span className="text-xs font-semibold">Guest</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'otp' && (
            <div className="space-y-4 text-left">
              {otpStep === 'phone' ? (
                <>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="Enter 10 digit number"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900 focus:border-brand focus:outline-none dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <button 
                    className="w-full rounded-2xl bg-brand py-4 font-bold text-white shadow-lg shadow-brand/30 hover:opacity-90 transition-all"
                    onClick={handleSendOtp}
                  >
                    Send OTP
                  </button>
                </>
              ) : (
                <>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Verification Code</label>
                  <input 
                    type="text" 
                    placeholder="Enter 123456"
                    maxLength={6}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900 focus:border-brand focus:outline-none dark:bg-slate-900 dark:border-slate-800 dark:text-white text-center text-2xl tracking-[0.5em] font-bold"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                  <button 
                    disabled={isLoggingIn}
                    className="w-full rounded-2xl bg-brand py-4 font-bold text-white shadow-lg shadow-brand/30 hover:opacity-90 transition-all disabled:opacity-50"
                    onClick={handleVerifyOtp}
                  >
                    {isLoggingIn ? 'Verifying...' : 'Verify & Login'}
                  </button>
                  <button 
                    onClick={() => setOtpStep('phone')}
                    className="w-full text-center text-xs font-medium text-slate-500 hover:text-brand transition-colors"
                  >
                    Change Phone Number
                  </button>
                </>
              )}
              <button 
                onClick={() => {
                  setMode('login');
                  setOtpStep('phone');
                }}
                className="w-full text-center text-sm font-medium text-slate-500 hover:text-green-500 transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}

          {mode === 'guest' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-amber-50 p-4 text-left dark:bg-amber-900/20">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Guest mode has limited features. Your data will not be synced to the cloud and may be lost if you clear your browser data.
                </p>
              </div>
              <button 
                onClick={handleGuestLogin}
                className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white hover:bg-slate-800 transition-all dark:bg-white dark:text-slate-900"
              >
                Continue as Guest
              </button>
              <button 
                onClick={() => setMode('login')}
                className="w-full text-center text-sm font-medium text-slate-500 hover:text-brand transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 pt-8">
          By continuing, you agree to our <span className="underline">Terms of Service</span> and <span className="underline">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}
