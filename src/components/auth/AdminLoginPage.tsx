'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Phone, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useGameStore } from '@/store';
import { toast } from '@/hooks/use-toast';
import { robustFetch, getFetchErrorMessage } from '@/lib/fetch';

export default function AdminLoginPage() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || !password) {
      toast({ title: 'Missing Fields', description: 'Please enter mobile number and password', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await robustFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, password }),
        timeout: 15000,
        retries: 0,
      });
      const json = await res.json();

      if (!json.success) {
        toast({ title: 'Login Failed', description: json.error, variant: 'destructive' });
        return;
      }

      const { token, ...user } = json.data;

      // Verify this is an admin account
      if (user.role !== 'admin') {
        toast({ title: 'Access Denied', description: 'This login is for admin accounts only.', variant: 'destructive' });
        return;
      }

      // Set admin state
      useGameStore.setState({
        user,
        authToken: token,
        isAuthenticated: true,
        isLoading: false,
        adminMode: true,
        currentView: 'admin-dashboard',
      });

      try {
        localStorage.setItem('mk_auth', JSON.stringify({ user, authToken: token, adminMode: true }));
      } catch {}

      toast({ title: 'Welcome, Admin!', description: `Logged in as ${user.name}` });

      const store = useGameStore.getState();
      store.fetchGames();
    } catch (error) {
      toast({ title: 'Error', description: getFetchErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-amber-950/20" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-600/5 rounded-full blur-3xl" />

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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 shadow-lg shadow-amber-500/25 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Matka<span className="text-amber-400">King</span>
          </h1>
          <p className="text-amber-400/80 text-sm font-medium mt-1">Admin Panel</p>
        </motion.div>

        {/* Login Card */}
        <Card className="bg-gray-900/80 backdrop-blur-xl border-amber-500/20 shadow-2xl shadow-black/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-semibold text-white">Admin Login</h2>
                <p className="text-gray-400 text-xs">Enter your credentials</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-mobile" className="text-gray-300 text-sm">
                  Mobile Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="admin-mobile"
                    type="tel"
                    placeholder="Enter admin mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:ring-amber-500/20 h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-gray-300 text-sm">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:ring-amber-500/20 h-11 rounded-lg"
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
                className="w-full h-11 bg-gradient-to-r from-amber-600 to-red-500 hover:from-amber-500 hover:to-red-400 text-white font-semibold rounded-lg shadow-lg shadow-amber-600/20 transition-all duration-200 disabled:opacity-50"
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
          </CardContent>
        </Card>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-gray-600 text-xs mt-6"
        >
          🔒 Secure admin access
        </motion.p>
      </motion.div>
    </div>
  );
}
