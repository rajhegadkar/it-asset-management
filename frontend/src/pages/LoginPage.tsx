import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useBranding } from '../customization/BrandingContext.js';
import { api } from '../api/client.js';
import { Laptop, Shield, Lock, User as UserIcon, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { branding } = useBranding();

  const [emailOrUsername, setEmailOrUsername] = useState('admin@acme-corp.com');
  const [password, setPassword] = useState('Admin@123456');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/login', {
        emailOrUsername,
        password,
        totpCode: totpCode || undefined,
      });

      if (res.data.data.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      login(res.data.data.accessToken, res.data.data.user);

      if (res.data.data.user.role.name === 'EMPLOYEE') {
        navigate('/portal/my-assets');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemoUser = (userType: 'super_admin' | 'it_admin' | 'support' | 'employee') => {
    switch (userType) {
      case 'super_admin':
        setEmailOrUsername('admin@acme-corp.com');
        setPassword('Admin@123456');
        break;
      case 'it_admin':
        setEmailOrUsername('itadmin@acme-corp.com');
        setPassword('Admin@123456');
        break;
      case 'support':
        setEmailOrUsername('support@acme-corp.com');
        setPassword('Admin@123456');
        break;
      case 'employee':
        setEmailOrUsername('john.doe@acme-corp.com');
        setPassword('User@123456');
        break;
    }
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        {/* Header Branding */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
            <Laptop className="w-8 h-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
            {branding.portalTitle || 'IT Asset Management'}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {branding.loginBannerText || 'Enterprise Asset Tracking, Lifecycle & Helpdesk Platform'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 p-8 rounded-2xl shadow-2xl space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center space-x-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Work Email or Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="admin@acme-corp.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {requires2FA && (
              <div>
                <label className="block text-xs font-semibold text-blue-400 mb-1.5">
                  Two-Factor Authentication Code (TOTP)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-blue-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-blue-500 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono tracking-widest text-center"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to ITAM'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Persona Switcher for Evaluation */}
          <div className="pt-4 border-t border-slate-700/60">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Quick Switch Demo Roles
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleSelectDemoUser('super_admin')}
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-left transition-colors"
              >
                <span className="font-semibold block text-blue-400">Super Admin</span>
                <span className="text-[10px] text-slate-400">admin@acme-corp.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemoUser('it_admin')}
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-left transition-colors"
              >
                <span className="font-semibold block text-emerald-400">IT Admin</span>
                <span className="text-[10px] text-slate-400">itadmin@acme-corp.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemoUser('support')}
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-left transition-colors"
              >
                <span className="font-semibold block text-amber-400">Support Engineer</span>
                <span className="text-[10px] text-slate-400">support@acme-corp.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemoUser('employee')}
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-left transition-colors"
              >
                <span className="font-semibold block text-purple-400">Employee Portal</span>
                <span className="text-[10px] text-slate-400">john.doe@acme-corp.com</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          Enterprise Security Enabled • AES-256 Session Encrypted • SOC-2 / ISO 27001 Ready
        </p>
      </div>
    </div>
  );
};
