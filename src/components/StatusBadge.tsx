import type { Job } from '../types/job';
import { getDaysLeft, getJobState } from '../lib/jobs';
import { formatNumber } from '../lib/format';

export default function StatusBadge({ job }: { job: Job }) {
  const state = getJobState(job);
  const left = getDaysLeft(job);

  if (state === 'expired') {
    return <span className="badge bg-slate-200 text-slate-700">মেয়াদোত্তীর্ণ</span>;
  }
  if (state === 'closing-soon' && left !== null) {
    const label = left === 0 ? 'আজই শেষ দিন' : `আর ${formatNumber(left)} দিন বাকি`;
    return <span className="badge bg-red-100 text-red-700">{label}</span>;
  }
  if (state === 'open') {
    return <span className="badge bg-accent-100 text-accent-700">আবেদন চলছে</span>;
  }
  return <span className="badge bg-slate-100 text-slate-600">শেষ তারিখ উল্লেখ নেই</span>;
}
