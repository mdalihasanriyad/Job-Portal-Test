import { todayISO } from '../lib/date';
import type { AdminJobStatus } from './types';

export function statusInfo(status: AdminJobStatus, deadline?: string): { label: string; className: string } {
  if (status === 'published' && deadline && deadline < todayISO()) {
    return { label: 'মেয়াদোত্তীর্ণ', className: 'bg-slate-200 text-slate-700' };
  }
  if (status === 'published') return { label: 'প্রকাশিত', className: 'bg-accent-100 text-accent-700' };
  if (status === 'pending_review') return { label: 'রিভিউ অপেক্ষমাণ', className: 'bg-amber-100 text-amber-800' };
  return { label: 'খসড়া', className: 'bg-slate-100 text-slate-700' };
}

export function StatusPill({ status, deadline }: { status: AdminJobStatus; deadline?: string }) {
  const info = statusInfo(status, deadline);
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}
