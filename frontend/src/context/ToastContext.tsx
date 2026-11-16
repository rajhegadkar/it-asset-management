import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { registerNotify, inferType } from '../components/ui/dialogs.js';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  showToast: () => {},
  showSuccess: () => {},
  showError: () => {},
  showWarning: () => {},
  showInfo: () => {},
  removeToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { id, type, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback((msg: string, d?: number) => showToast(msg, 'success', d), [showToast]);
  const showError = useCallback((msg: string, d?: number) => showToast(msg, 'error', d || 5000), [showToast]);
  const showWarning = useCallback((msg: string, d?: number) => showToast(msg, 'warning', d), [showToast]);
  const showInfo = useCallback((msg: string, d?: number) => showToast(msg, 'info', d), [showToast]);

  React.useEffect(() => {
    const originalAlert = window.alert;
    // Any leftover alert() becomes a toast with the right tone (success / error / warning)
    window.alert = (message?: any) => {
      const text = String(message ?? '');
      showToast(text, inferType(text), 5000);
    };
    registerNotify((msg, type) => showToast(msg, type, type === 'error' ? 6000 : 4000));
    return () => {
      window.alert = originalAlert;
      registerNotify(null);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        removeToast,
      }}
    >
      {children}
      {/* Toasts: bottom-centre on phones (above the bottom nav), bottom-right on desktop */}
      <div
        className="fixed z-[9999] left-0 right-0 bottom-[calc(var(--bottom-nav-h)+12px)] lg:bottom-6 lg:left-auto lg:right-6 flex flex-col items-center lg:items-end gap-2 px-3 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const tone = {
            success: { icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, bar: 'bg-emerald-500' },
            error: { icon: <AlertCircle className="w-5 h-5 text-rose-500" />, bar: 'bg-rose-500' },
            warning: { icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, bar: 'bg-amber-500' },
            info: { icon: <Info className="w-5 h-5 text-blue-500" />, bar: 'bg-blue-500' },
          }[toast.type];
          return (
            <div
              key={toast.id}
              data-testid={`toast-${toast.type}`}
              className="pointer-events-auto relative overflow-hidden w-full max-w-sm flex items-start gap-3 rounded-2xl border border-line bg-white/95 dark:bg-surface/95 backdrop-blur-md shadow-pop p-3.5 pl-4 text-sm animate-slide-in-right"
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar}`} />
              <span className="shrink-0 mt-0.5">{tone.icon}</span>
              <p className="flex-1 text-slate-700 dark:text-slate-200 leading-snug break-words">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss"
                className="tap-compact shrink-0 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
