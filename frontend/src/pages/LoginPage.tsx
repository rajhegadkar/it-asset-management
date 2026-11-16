import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useBranding } from '../customization/BrandingContext.js';
import { api } from '../api/client.js';
import { Laptop, Lock, User as UserIcon, AlertCircle, ArrowRight, KeyRound, Eye, EyeOff, Loader2, ShieldCheck, QrCode, LifeBuoy, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

// Demo role switcher and pre-filled demo credentials appear only in local development
// (or when VITE_DEMO_MODE=true is set for a sandbox build) — never in a production build.
const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { branding } = useBranding();
  const { theme, toggleTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  const [emailOrUsername, setEmailOrUsername] = useState(DEMO_MODE ? 'admin@acme-corp.com' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'Admin@123456' : '');
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
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

      login(res.data.data.accessToken, res.data.data.user, res.data.data.refreshToken);

      if (res.data.data.user.mustChangePassword) {
        // Default / temporary password: force a new one before entering the app
        setPendingUser(res.data.data.user);
        setMustChange(true);
        return;
      }
      goHome(res.data.data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const goHome = (u: any) => {
    navigate(u?.role?.name === 'EMPLOYEE' ? '/portal/my-assets' : '/');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword: password, newPassword });
      const updatedUser = { ...pendingUser, mustChangePassword: false };
      login(res.data.data.accessToken, updatedUser, res.data.data.refreshToken);
      goHome(updatedUser);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not change password');
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

  const demoUsers: Array<{ key: 'super_admin' | 'it_admin' | 'support' | 'employee'; label: string; email: string }> = [
    { key: 'super_admin', label: 'Super admin', email: 'admin@acme-corp.com' },
    { key: 'it_admin', label: 'IT admin', email: 'itadmin@acme-corp.com' },
    { key: 'support', label: 'Support engineer', email: 'support@acme-corp.com' },
    { key: 'employee', label: 'Employee', email: 'john.doe@acme-corp.com' },
  ];

  const inputCls =
    'w-full h-12 pl-11 pr-3 rounded-xl bg-white dark:bg-surface-muted border border-line text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition';

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr] bg-surface-canvas">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-gradient-to-br from-blue-600 via-blue-800 to-[rgb(var(--sidebar))]">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-blue-400/20 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="w-11 h-11 rounded-xl bg-white/10 p-1.5 object-contain" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
              <Laptop className="w-6 h-6" />
            </div>
          )}
          <div>
            <p className="font-semibold">{branding.portalTitle || 'IT Asset Management'}</p>
            <p className="text-sm text-blue-100/80">{branding.companyName}</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Every device, licence and request in one place.</h2>
          <p className="mt-4 text-blue-100/90">{branding.loginBannerText || 'Track hardware from purchase to disposal, hand over equipment with digital signatures, and resolve support tickets on time.'}</p>
          <ul className="mt-8 space-y-3 text-sm text-blue-50/90">
            <li className="flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><QrCode className="w-4 h-4" /></span>Scan a tag to find any asset in seconds</li>
            <li className="flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span>Signed custody records and a tamper-evident audit trail</li>
            <li className="flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><LifeBuoy className="w-4 h-4" /></span>Helpdesk with SLA tracking built in</li>
          </ul>
        </div>
        <p className="relative text-xs text-blue-100/60">© {new Date().getFullYear()} {branding.companyName}</p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        <button onClick={toggleTheme} className="icon-btn absolute top-4 right-4" aria-label="Toggle dark mode">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <div className="w-full max-w-sm mx-auto animate-fade-up">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{branding.portalTitle || 'IT Asset Management'}</p>
              <p className="text-sm text-slate-500">{branding.companyName}</p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {mustChange ? 'Choose a new password' : requires2FA ? 'Two-step verification' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {mustChange
              ? 'Your account uses a temporary password. Set your own to continue.'
              : requires2FA
                ? 'Enter the 6-digit code from your authenticator app, or a recovery code.'
                : 'Sign in with your work e-mail or username.'}
          </p>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-sm text-rose-700 dark:text-rose-300 animate-pop-in" data-testid="login-error">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mustChange ? (
            <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
              <div>
                <label htmlFor="new-password" className="label">New password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input id="new-password" type="password" required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className={inputCls} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">At least 10 characters, with upper- and lower-case letters and a number.</p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="label">Confirm new password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input id="confirm-password" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className={inputCls} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-[15px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" data-testid="login-form">
              <div>
                <label htmlFor="login-id" className="label">Work e-mail or username</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-id"
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    placeholder="name@company.com"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="login-password" className="label">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className={`${inputCls} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="tap-compact absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {requires2FA && (
                <div className="animate-pop-in">
                  <label htmlFor="login-totp" className="label">Verification code</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-totp"
                      type="text"
                      inputMode="text"
                      required
                      maxLength={11}
                      autoComplete="one-time-code"
                      autoFocus
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="6-digit code or recovery code"
                      className={`${inputCls} font-mono tracking-widest`}
                    />
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-[15px]" data-testid="login-submit">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {DEMO_MODE && !mustChange && (
            <div className="mt-8">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-line" />
                Demo accounts (development only)
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {demoUsers.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => handleSelectDemoUser(d.key)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${emailOrUsername === d.email ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-line hover:bg-white dark:hover:bg-surface-muted'}`}
                  >
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{d.label}</span>
                    <span className="block text-[11px] text-slate-500 truncate">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-10 text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Accounts lock after repeated failed attempts. Two-factor authentication supported.
          </p>
        </div>
      </main>
    </div>
  );
};
