import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'status' | 'condition' | 'priority';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'status' }) => {
  const getStyles = () => {
    switch (status.toUpperCase()) {
      // Statuses
      case 'AVAILABLE':
      case 'IN_STOCK':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 ring-emerald-200/60 dark:ring-emerald-800/60';
      case 'ASSIGNED':
      case 'IN_USE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 ring-blue-200/60 dark:ring-blue-800/60';
      case 'UNDER_MAINTENANCE':
      case 'REPAIR':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 ring-amber-200/60 dark:ring-amber-800/60';
      case 'LOST':
      case 'STOLEN':
      case 'DAMAGED':
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 ring-rose-200/60 dark:ring-rose-800/60';
      case 'RETIRED':
      case 'DISPOSED':
      case 'CLOSED':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 ring-slate-200/60 dark:ring-slate-700/60';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 ring-orange-200/60 dark:ring-orange-800/60';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 ring-amber-200/60 dark:ring-amber-800/60';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 ring-blue-200/60 dark:ring-blue-800/60';
      case 'NEW':
      case 'EXCELLENT':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 ring-teal-200/60 dark:ring-teal-800/60';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 ring-slate-200/60 dark:ring-slate-700/60';
    }
  };

  const formatText = (text: string) => {
    return text.replace(/_/g, ' ').toLowerCase();
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap h-6 px-2.5 rounded-full text-[11px] font-semibold capitalize ring-1 ring-inset border-0 ${getStyles()}`}
      data-status={status}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"></span>
      {formatText(status)}
    </span>
  );
};
