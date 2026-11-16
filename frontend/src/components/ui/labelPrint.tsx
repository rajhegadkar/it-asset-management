import React, { useEffect, useRef, useState } from 'react';
import { Printer, UserCheck, UserX } from 'lucide-react';
import { api } from '../../api/client.js';

/**
 * One place for every "print label" button.
 *
 *   await downloadAssetLabels({ assetIds: [id] }, `asset-label-${tag}.pdf`);
 *
 * Whether the assigned user's name goes on the label follows the Customization Centre setting
 * (PDF Templates → "User name on labels"):
 *   SHOW → always printed, HIDE → never printed, ASK → a small dialog asks each time.
 */
export type LabelUserNameMode = 'SHOW' | 'HIDE' | 'ASK';

let cachedMode: { mode: LabelUserNameMode; at: number } | null = null;
let lastChoice = true; // pre-selects the previous answer within this session

/** Call after the setting is saved so the next print uses it straight away. */
export function invalidateLabelSettings() {
  cachedMode = null;
}

async function getMode(): Promise<LabelUserNameMode> {
  if (cachedMode && Date.now() - cachedMode.at < 30_000) return cachedMode.mode;
  try {
    const res = await api.get('/customization/pdf-templates');
    const m = res.data?.data?.userNameOnLabel;
    const mode: LabelUserNameMode = m === 'SHOW' || m === 'HIDE' ? m : 'ASK';
    cachedMode = { mode, at: Date.now() };
    return mode;
  } catch {
    return 'ASK';
  }
}

interface Pending {
  count: number;
  resolve: (v: boolean | null) => void;
}
let openImpl: ((count: number) => Promise<boolean | null>) | null = null;

/** Resolves true (include name), false (leave it off) or null (cancelled). */
export async function chooseLabelUserName(count = 1): Promise<boolean | null> {
  const mode = await getMode();
  if (mode === 'SHOW') return true;
  if (mode === 'HIDE') return false;
  if (!openImpl) return true;
  return openImpl(count);
}

/** Asks (if needed), generates the PDF and downloads it. Returns false if the user cancelled. */
export async function downloadAssetLabels(
  payload: { assetIds?: string[]; all?: boolean },
  filename: string,
  count = payload.assetIds?.length || 1
): Promise<boolean> {
  const showUserName = await chooseLabelUserName(payload.all ? 2 : count);
  if (showUserName === null) return false;
  const res = await api.post('/assets/labels/pdf', { ...payload, showUserName }, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  return true;
}

/** Mount once (Layout does this). Renders the "with / without user name" choice. */
export const LabelOptionsHost: React.FC = () => {
  const [pending, setPending] = useState<Pending | null>(null);
  const [withName, setWithName] = useState(true);
  const printBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    openImpl = (count) =>
      new Promise<boolean | null>((resolve) => {
        setWithName(lastChoice);
        setPending({ count, resolve });
      });
    return () => {
      openImpl = null;
    };
  }, []);

  const close = (v: boolean | null) => {
    if (v !== null) lastChoice = v;
    pending?.resolve(v);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => printBtn.current?.focus(), 30);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!pending) return null;
  const plural = pending.count > 1;

  const Option = ({ value, icon: Icon, title, hint }: { value: boolean; icon: any; title: string; hint: string }) => {
    const active = withName === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => setWithName(value)}
        data-testid={value ? 'label-with-user' : 'label-without-user'}
        className={`w-full flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
          active
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/40'
            : 'border-line hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="label-opt-title">
      <div className="absolute inset-0 bg-slate-950/50 animate-fade-in" onClick={() => close(null)} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-surface rounded-t-3xl sm:rounded-2xl shadow-pop border border-line p-6 pb-safe animate-sheet-up sm:animate-pop-in">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center">
            <Printer className="w-5 h-5" />
          </span>
          <div>
            <h3 id="label-opt-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Print {plural ? 'asset labels' : 'asset label'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Show the assigned user's name on the {plural ? 'labels' : 'label'}?</p>
          </div>
        </div>

        <div className="mt-5 space-y-2" role="radiogroup" aria-label="User name on label">
          <Option value={true} icon={UserCheck} title="With user name" hint="Adds “User: Jane Doe” (or “Unassigned” for stock items)." />
          <Option value={false} icon={UserX} title="Without user name" hint="Leaves the name off — handy for shared or re-issued devices." />
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          Admins can set a fixed default in Customization Centre → PDF Templates.
        </p>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => close(null)} data-testid="label-cancel">
            Cancel
          </button>
          <button ref={printBtn} type="button" className="btn-primary w-full sm:w-auto" onClick={() => close(withName)} data-testid="label-print">
            <Printer className="w-4 h-4" />
            Print {plural ? 'labels' : 'label'}
          </button>
        </div>
      </div>
    </div>
  );
};
