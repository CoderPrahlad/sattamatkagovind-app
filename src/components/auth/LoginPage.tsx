'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Phone, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useGameStore } from '@/store';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const login = useGameStore((s) => s.login);
  const navigate = useGameStore((s) => s.navigate);
  const siteConfig = useGameStore((s) => s.siteConfig);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !password) {
      toast({ title: 'Missing Fields', description: 'Please enter mobile number and password', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await login(mobile, password);
    } finally {
      setLoading(false);
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
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Matka<span className="text-emerald-400">King</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Number Game Platform</p>
        </motion.div>

        {/* Login card */}
        <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-800/50 shadow-2xl shadow-black/20">
          <CardHeader className="pb-2">
            <h2 className="text-xl font-semibold text-white text-center">Welcome Back</h2>
            <p className="text-gray-400 text-sm text-center">Sign in to your account</p>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-gray-300 text-sm">
                  Mobile Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="Enter mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-gray-300 text-sm">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => navigate('forgot-password')}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
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

              <Button
                type="submit"
                disabled={loading || !mobile || !password}
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-gray-400 text-sm">
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => navigate('register')}
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Register
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
