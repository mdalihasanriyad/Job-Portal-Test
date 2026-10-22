import { Link } from 'react-router-dom';
import type { Job } from '../types/job';
import { NOT_SPECIFIED, formatDate, formatNumber } from '../lib/format';
import StatusBadge from './StatusBadge';

export default function JobCard({ job }: { job: Job }) {
  return (
    <article className="card flex h-full flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge job={job} />
        <span className="badge bg-brand-50 text-brand-700">{job.category}</span>
      </div>

      <p className="mt-3 text-sm font-medium text-slate-600">{job.organization}</p>
      <h3 className="mt-1 text-lg font-bold leading-snug text-slate-900">
        <Link to={`/jobs/${job.slug}`} className="hover:text-brand-700">
          {job.title}
        </Link>
      </h3>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">পদসংখ্যা</dt>
          <dd className="font-medium text-slate-800">
            {job.totalVacancies !== undefined ? formatNumber(job.totalVacancies) : NOT_SPECIFIED}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">আবেদনের শেষ তারিখ</dt>
          <dd className="font-medium text-slate-800">{formatDate(job.deadline)}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-4">
        <Link to={`/jobs/${job.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">
          বিস্তারিত দেখুন →
        </Link>
      </div>
    </article>
  );
}
