import type { ScriptFormat, ScriptStatus } from './types';

export const FORMAT_LABEL: Record<ScriptFormat, string> = {
  short: 'শর্ট (৬০–৯০ সেকেন্ড)',
  full: 'পূর্ণ (৩–৫ মিনিট)',
};

export function ScriptStatusPill({ status }: { status: ScriptStatus }) {
  const map: Record<ScriptStatus, { label: string; className: string }> = {
    prompt: { label: 'শুধু প্রম্পট', className: 'bg-slate-100 text-slate-700' },
    draft: { label: 'খসড়া', className: 'bg-amber-100 text-amber-800' },
    final: { label: 'চূড়ান্ত', className: 'bg-accent-100 text-accent-700' },
  };
  return <span className={`badge ${map[status].className}`}>{map[status].label}</span>;
}
