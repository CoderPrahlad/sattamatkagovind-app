'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Crown, Phone, Lock, User, Gift, Eye, EyeOff, Loader2, MessageSquare, KeyRound, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useGameStore } from '@/store';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { toast } from '@/hooks/use-toast';
import { robustFetch, getFetchErrorMessage } from '@/lib/fetch';

type RegisterStep = 'fill-details' | 'verify-otp' | 'success';

function RegisterPageInner() {
  const { navigate, siteConfig } = useGameStore();
  const searchParams = useSearchParams();
  const refParam = searchParams.get('ref');

  const [step, setStep] = useState<RegisterStep>('fill-details');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(refParam ? refParam.toUpperCase() : '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);

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

    setOtpSending(true);
    try {
      const res = await robustFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, purpose: 'register' }),
        timeout: 15000,
        retries: 0,
      });
      const json = await res.json();
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
      setOtpSending(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast({ title: 'Invalid OTP', description: 'Please enter the 6-digit OTP', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await robustFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, password, referralCode: referralCode || undefined, otp }),
        timeout: 15000,
        retries: 0,
      });
      const json = await res.json();
      if (json.success) {
        const { token, ...user } = json.data;
        setOtpVerified(true);
        setStep('success');
        // Directly set auth state (same as login action in store)
        useGameStore.setState({
          user,
          authToken: token,
          isAuthenticated: true,
          isLoading: false,
          adminMode: false,
          currentView: 'home',
        });
        // Persist auth
        try {
          localStorage.setItem('mk_auth', JSON.stringify({ user, authToken: token, adminMode: false }));
        } catch {}
        toast({ title: 'Welcome!', description: 'Account created successfully' });
        useGameStore.getState().fetchGames();
        useGameStore.getState().fetchBanners();
        useGameStore.getState().fetchNotifications();
      } else {
        toast({ title: 'Registration Failed', description: json.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (otpTimer > 0) return;
    setOtpSending(true);
    try {
      const res = await robustFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, purpose: 'register' }),
        timeout: 15000,
        retries: 0,
      });
      const json = await res.json();
      if (json.success) {
        setOtpTimer(60);
        toast({ title: 'OTP Resent!', description: 'Check your SMS for the new OTP' });
      } else {
        toast({ title: 'Failed', description: json.error || 'Failed to resend OTP', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    } finally {
      setOtpSending(false);
    }
  };

  const canSendOTP = name && mobile && password && mobile.length >= 10 && password.length >= 6;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950/30" />

      {/* Decorative glowing circles */}
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-1/3 w-56 h-56 bg-emerald-600/5 rounded-full blur-3xl" />

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
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Matka<span className="text-emerald-400">King</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create your account</p>
        </motion.div>

        {/* Register card */}
        <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-800/50 shadow-2xl shadow-black/20">
          <CardHeader className="pb-2">
            <h2 className="text-xl font-semibold text-white text-center">
              {step === 'fill-details' ? 'Get Started' : step === 'verify-otp' ? 'Verify OTP' : 'Welcome!'}
            </h2>
            <p className="text-gray-400 text-sm text-center">
              {step === 'fill-details'
                ? 'Fill in your details to register'
                : step === 'verify-otp'
                  ? 'Enter the OTP sent to your mobile'
                  : 'Your account has been created'}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {['fill-details', 'verify-otp'].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === s
                      ? 'bg-emerald-500 text-white'
                      : ['fill-details', 'verify-otp'].indexOf(step) > i
                        ? 'bg-emerald-500/30 text-emerald-400'
                        : 'bg-gray-800 text-gray-500'
                  }`}>
                    {['fill-details', 'verify-otp'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  {i < 1 && (
                    <div className={`w-12 h-0.5 ${
                      ['fill-details', 'verify-otp'].indexOf(step) > i
                        ? 'bg-emerald-500/50'
                        : 'bg-gray-800'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Fill Details */}
            {step === 'fill-details' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-300 text-sm">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-mobile" className="text-gray-300 text-sm">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="reg-mobile"
                      type="tel"
                      placeholder="Enter mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-gray-300 text-sm">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password (min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  <Label htmlFor="referral" className="text-gray-300 text-sm">
                    Referral Code <span className="text-gray-500">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="referral"
                      type="text"
                      placeholder="Enter referral code"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={otpSending || !canSendOTP}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200 disabled:opacity-50"
                >
                  {otpSending ? (
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
              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                  <p className="text-emerald-400 text-sm">
                    OTP sent to: <span className="font-mono font-bold">{mobile}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-otp" className="text-gray-300 text-sm">
                    Enter 6-digit OTP
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="reg-otp"
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
                      onClick={handleResendOTP}
                      disabled={otpTimer > 0 || otpSending}
                      className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying & Creating Account...
                    </span>
                  ) : (
                    'Verify OTP & Register'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep('fill-details'); setOtp(''); setOtpTimer(0); }}
                  className="w-full text-center text-gray-400 hover:text-gray-300 text-sm transition-colors"
                >
                  ← Back to details
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('auth')}
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Sign In
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Support Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="mt-6"
        >
          <a
            href={`https://wa.me/${siteConfig.whatsappNumber}?text=Hi%20I%20need%20help%20with%20MatkaKing`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 font-medium text-sm transition-all duration-200"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Need Help? Chat on WhatsApp
          </a>
        </motion.div>

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

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    }>
      <RegisterPageInner />
    </Suspense>
  );
}
