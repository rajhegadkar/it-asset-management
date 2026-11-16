import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  description?: string;
}

let openModals = 0;

/**
 * Dialog that is a centred card on desktop and a full-width bottom sheet on phones.
 * Locks page scroll, closes on Esc / backdrop, moves focus into the dialog and back afterwards.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'lg', description }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openModals++;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panelRef.current) {
        // keep keyboard focus inside the dialog
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const firstField = panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea');
      (firstField && window.matchMedia('(pointer: fine)').matches ? firstField : panelRef.current)?.focus();
    }, 40);
    return () => {
      clearTimeout(t);
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
    '4xl': 'sm:max-w-4xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-slate-950/50 animate-fade-in" onClick={onClose} />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex flex-col w-full ${widthClasses} max-h-[92dvh] sm:max-h-[88vh] bg-white dark:bg-surface text-left
          rounded-t-3xl sm:rounded-2xl shadow-pop border border-line outline-none animate-sheet-up sm:animate-pop-in`}
      >
        {/* drag handle (phones) */}
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <h3 id={titleId} className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
              {title}
            </h3>
            {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="icon-btn -mr-2 -mt-1 shrink-0" data-testid="modal-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 pb-safe">{children}</div>
      </div>
    </div>
  );
};
