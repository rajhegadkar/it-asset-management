import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

/**
 * App-wide replacements for window.confirm / window.alert.
 *   if (!await confirmDialog('Delete this item?', { danger: true })) return;
 *   notify('Saved', 'success');
 * Native browser dialogs block the page, look different on every device and cannot be styled.
 */
export type NotifyType = 'success' | 'error' | 'warning' | 'info';

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmImpl = (message: string, opts?: ConfirmOptions) => Promise<boolean>;
type NotifyImpl = (message: string, type: NotifyType) => void;

let confirmImpl: ConfirmImpl | null = null;
let notifyImpl: NotifyImpl | null = null;

export function registerNotify(fn: NotifyImpl | null) {
  notifyImpl = fn;
}

/** Guesses the tone of legacy alert() messages so success messages are not shown as warnings. */
export function inferType(message: string): NotifyType {
  const m = message.toLowerCase();
  if (/(fail|error|unable|could not|cannot|can't|invalid|denied|not found|forbidden|expired|exhausted|insufficient)/.test(m)) return 'error';
  if (/(success|created|saved|updated|deleted|removed|assigned|revoked|completed|recorded|imported|exported|sent|restored|acknowledged|✓|✅)/.test(m)) return 'success';
  if (/(warning|please|required|must|select|choose)/.test(m)) return 'warning';
  return 'info';
}

export function notify(message: string, type?: NotifyType) {
  const t = type || inferType(String(message));
  if (notifyImpl) notifyImpl(String(message), t);
  else console.log(`[${t}] ${message}`);
}

export function confirmDialog(message: string, opts?: ConfirmOptions): Promise<boolean> {
  if (confirmImpl) return confirmImpl(message, opts);
  return Promise.resolve(window.confirm(message));
}

interface PendingConfirm extends ConfirmOptions {
  message: string;
  resolve: (v: boolean) => void;
}

export const DialogHost: React.FC = () => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmImpl = (message, opts) =>
      new Promise<boolean>((resolve) => setPending({ message, resolve, ...opts }));
    return () => {
      confirmImpl = null;
    };
  }, []);

  const close = useCallback(
    (v: boolean) => {
      pending?.resolve(v);
      setPending(null);
    },
    [pending]
  );

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => confirmBtn.current?.focus(), 30);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  if (!pending) return null;
  const danger = pending.danger ?? /delete|remove|revoke|restore|reset|overwrite|cannot be undone/i.test(pending.message);
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-slate-950/50 animate-fade-in" onClick={() => close(false)} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-surface rounded-t-3xl sm:rounded-2xl shadow-pop border border-line p-6 pb-safe animate-sheet-up sm:animate-pop-in">
        <div className="flex gap-4">
          <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${danger ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {pending.title || (danger ? 'Please confirm' : 'Are you sure?')}
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{pending.message}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => close(false)} data-testid="confirm-cancel">
            {pending.cancelText || 'Cancel'}
          </button>
          <button
            ref={confirmBtn}
            type="button"
            className={`${danger ? 'btn-danger' : 'btn-primary'} w-full sm:w-auto`}
            onClick={() => close(true)}
            data-testid="confirm-ok"
          >
            {pending.confirmText || (danger ? 'Yes, continue' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
