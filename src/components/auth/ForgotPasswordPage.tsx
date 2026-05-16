'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Phone, KeyRound, Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useGameStore } from '@/store';
import { toast } from '@/hooks/use-toast';
import { robustFetch, safeJsonParse, getFetchErrorMessage } from '@/lib/fetch';

type ForgotStep = 'enter-mobile' | 'verify-otp' | 'reset-password' | 'success';

export default function ForgotPasswordPage() {
  const navigate = useGameStore((s) => s.navigate);
  const [step, setStep] = useState<ForgotStep>('enter-mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleSendOTP = async () => {
    if (!mobile) {
      toast({ title: 'Missing Mobile', description: 'Please enter your mobile number', variant: 'destructive' });
      return;
    }
    if (!/^\d{10,15}$/.test(mobile)) {
      toast({ title: 'Invalid Mobile', description: 'Please enter a valid 10-digit mobile number', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await robustFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, purpose: 'forgot-password' }),
        timeout: 15000,
        retries: 0,
        noRetryStatuses: [],
      });
      const json = await safeJsonParse<{ success: boolean; error?: string }>(res);
      if (json.success) {
        setStep('verify-otp');
        setOtpTimer(60);
        toast({ title: 'OTP Sent!', description: 'Check your SMS for the OTP' });
      } else {
        toast({ title: 'Failed', description: json.error || 'Failed to send OTP', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 6) {
      toast({ title: 'Invalid OTP', description: 'Please enter the 6-digit OTP', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await robustFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp, step: 'verify-otp' }),
        timeout: 10000,
        retries: 0,
        noRetryStatuses: [],
      });
      const json = await safeJsonParse<{ success: boolean; error?: string }>(res);
      if (json.success) {
        setStep('reset-password');
        toast({ title: 'OTP Verified!', description: 'Now set your new password' });
      } else {
        toast({ title: 'Verification Failed', description: json.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Invalid Password', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Password Mismatch', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await robustFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, newPassword, step: 'reset-password' }),
        timeout: 10000,
        retries: 0,
        noRetryStatuses: [],
      });
      const json = await safeJsonParse<{ success: boolean; error?: string }>(res);
      if (json.success) {
        setStep('success');
        toast({ title: 'Password Reset!', description: 'You can now login with your new password' });
      } else {
        toast({ title: 'Reset Failed', description: json.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'enter-mobile': return 'Forgot Password';
      case 'verify-otp': return 'Verify OTP';
      case 'reset-password': return 'Reset Password';
      case 'success': return 'Password Reset!';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'enter-mobile': return 'Enter your registered mobile number';
      case 'verify-otp': return 'Enter the OTP sent to your mobile via SMS';
      case 'reset-password': return 'Create a new password for your account';
      case 'success': return 'Your password has been reset successfully';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950/30" />

      {/* Decorative glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 mb-4">
            {step === 'success' ? (
              <CheckCircle2 className="w-8 h-8 text-white" />
            ) : (
              <Crown className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Matka<span className="text-emerald-400">King</span>
          </h1>
        </motion.div>

        {/* Forgot Password Card */}
        <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-800/50 shadow-2xl shadow-black/20">
          <CardHeader className="pb-2">
            {/* Back button */}
            {step !== 'success' && (
              <button
                onClick={() => {
                  if (step === 'verify-otp') setStep('enter-mobile');
                  else if (step === 'reset-password') setStep('verify-otp');
                  else navigate('auth');
                }}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-300 text-sm mb-2 transition-colors self-start"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <h2 className="text-xl font-semibold text-white text-center">{getStepTitle()}</h2>
            <p className="text-gray-400 text-sm text-center">{getStepSubtitle()}</p>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {['enter-mobile', 'verify-otp', 'reset-password'].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === s
                      ? 'bg-emerald-500 text-white'
                      : ['enter-mobile', 'verify-otp', 'reset-password'].indexOf(step) > i
                        ? 'bg-emerald-500/30 text-emerald-400'
                        : 'bg-gray-800 text-gray-500'
                  }`}>
                    {['enter-mobile', 'verify-otp', 'reset-password'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  {i < 2 && (
                    <div className={`w-8 h-0.5 ${
                      ['enter-mobile', 'verify-otp', 'reset-password'].indexOf(step) > i
                        ? 'bg-emerald-500/50'
                        : 'bg-gray-800'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Enter Mobile */}
            {step === 'enter-mobile' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-mobile" className="text-gray-300 text-sm">
                    Registered Mobile Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="fp-mobile"
                      type="tel"
                      placeholder="Enter your mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSendOTP}
                  disabled={loading || !mobile}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending OTP...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Send OTP via SMS
                    </span>
                  )}
                </Button>
              </div>
            )}

            {/* Step 2: Verify OTP */}
            {step === 'verify-otp' && (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                  <p className="text-emerald-400 text-sm">
                    OTP sent to: <span className="font-mono font-bold">{mobile}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fp-otp" className="text-gray-300 text-sm">
                    Enter 6-digit OTP
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="fp-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg tracking-[0.3em] text-center font-mono text-lg"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-500 text-xs">OTP sent to your mobile via SMS</p>
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={otpTimer > 0 || loading}
                      className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length < 6}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    'Verify OTP'
                  )}
                </Button>
              </div>
            )}

            {/* Step 3: Reset Password */}
            {step === 'reset-password' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-new-password" className="text-gray-300 text-sm">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="fp-new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fp-confirm-password" className="text-gray-300 text-sm">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="fp-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-red-400 text-xs">Passwords do not match</p>
                  )}
                </div>

                <Button
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting...
                    </span>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </div>
            )}

            {/* Step 4: Success */}
            {step === 'success' && (
              <div className="space-y-4 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>
                <p className="text-gray-300">
                  Your password has been reset successfully!
                </p>
                <p className="text-gray-500 text-sm">
                  You can now sign in with your new password.
                </p>
                <Button
                  onClick={() => navigate('auth')}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200"
                >
                  Go to Login
                </Button>
              </div>
            )}

            {/* Back to login link */}
            {step !== 'success' && (
              <div className="mt-5 text-center">
                <button
                  onClick={() => navigate('auth')}
                  className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
                >
                  ← Back to Login
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-gray-600 text-xs mt-4"
        >
          Play responsibly. For entertainment only.
        </motion.p>
      </motion.div>
    </div>
  );
}
