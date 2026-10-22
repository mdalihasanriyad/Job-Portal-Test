import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from './api';
import { StatusPill } from './labels';
import type { StatsResponse } from './types';
import { formatDate, formatNumber } from '../lib/format';
import { useSeo } from '../lib/seo';

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState('');
  useSeo({ title: 'ড্যাশবোর্ড — অ্যাডমিন', description: 'অ্যাডমিন ড্যাশবোর্ড', path: '/admin', noindex: true });

  useEffect(() => {
    let active = true;
    api<StatsResponse>('GET', '/api/admin/stats')
      .then((data) => active && setStats(data))
      .catch((caught: unknown) => active && setError(caught instanceof ApiError ? caught.message : 'তথ্য লোড করা যায়নি।'));
    return () => {
      active = false;
    };
  }, []);

  const cards = stats
    ? [
        { label: 'মোট চাকরি', value: stats.counts.total, to: '/admin/jobs' },
        { label: 'প্রকাশিত', value: stats.counts.published, to: '/admin/jobs?status=published' },
        { label: 'খসড়া', value: stats.counts.draft, to: '/admin/jobs?status=draft' },
        { label: 'রিভিউ অপেক্ষমাণ', value: stats.counts.pendingReview, to: '/admin/jobs?status=pending_review' },
        { label: 'মেয়াদোত্তীর্ণ', value: stats.counts.expired, to: '/admin/jobs?status=expired' },
        { label: 'অনুমোদনের অপেক্ষায় মন্তব্য', value: stats.counts.pendingComments, to: '/admin/comments' },
        { label: 'নতুন বার্তা', value: stats.counts.newMessages, to: '/admin/messages' },
      ]
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">ড্যাশবোর্ড</h1>
        <Link to="/admin/jobs/new" className="btn btn-primary">+ নতুন চাকরি যোগ করুন</Link>
      </div>

      {error && <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
      {!stats && !error && <p className="mt-6 text-slate-600">লোড হচ্ছে…</p>}

      {stats && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.label} to={card.to} className="card p-5 transition-shadow hover:shadow-md">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-3xl font-bold text-brand-800">{formatNumber(card.value)}</p>
              </Link>
            ))}
          </div>

          {stats.analytics && (
            <section className="mt-10" aria-labelledby="analytics-heading">
              <h2 id="analytics-heading" className="text-lg font-bold text-slate-900">পেজ ভিউ (চাকরির পেজ)</h2>
              <p className="text-xs text-slate-500">কুকি বা ব্যক্তিগত তথ্য ছাড়া গণনা; বট বাদ দেওয়া হয়।</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="card p-5">
                  <p className="text-sm text-slate-500">আজ: <strong className="text-slate-900">{formatNumber(stats.analytics.today)}</strong> · গত ৭ দিন: <strong className="text-slate-900">{formatNumber(stats.analytics.last7Days)}</strong></p>
                  <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label="গত ৭ দিনের দৈনিক ভিউ">
                    {stats.analytics.daily.map((day) => {
                      const max = Math.max(1, ...(stats.analytics?.daily.map((d) => d.views) ?? [1]));
                      return (
                        <div key={day.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                          <div className="w-full rounded-t bg-brand-600" style={{ height: `${Math.max(4, (day.views / max) * 100)}%` }} title={`${day.date}: ${day.views}`} />
                          <span className="text-[10px] text-slate-500">{day.date.slice(8)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-700">সর্বাধিক দেখা চাকরি (৭ দিন)</h3>
                  {stats.analytics.topJobs.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">এখনো কোনো ভিউ নেই।</p>
                  ) : (
                    <ol className="mt-3 space-y-2 text-sm">
                      {stats.analytics.topJobs.map((job) => (
                        <li key={job.id} className="flex items-start justify-between gap-3">
                          {job.slug ? <Link to={`/admin/jobs/${job.id}/edit`} className="text-slate-900 hover:text-brand-700">{job.title}</Link> : <span className="text-slate-500">{job.title}</span>}
                          <span className="shrink-0 font-semibold text-brand-800">{formatNumber(job.views)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-lg font-bold text-slate-900">সাম্প্রতিক পরিবর্তন</h2>
            {stats.recent.length === 0 ? (
              <p className="card mt-3 p-6 text-slate-600">এখনো কোনো চাকরি যোগ করা হয়নি।</p>
            ) : (
              <ul className="card mt-3 divide-y divide-slate-100">
                {stats.recent.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <Link to={`/admin/jobs/${job.id}/edit`} className="font-semibold text-slate-900 hover:text-brand-700">{job.title}</Link>
                      <p className="text-sm text-slate-500">{job.organization} · শেষ তারিখ: {formatDate(job.deadline)}</p>
                    </div>
                    <StatusPill status={job.status} deadline={job.deadline} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
