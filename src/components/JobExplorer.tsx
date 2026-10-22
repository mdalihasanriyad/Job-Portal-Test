import { FormEvent, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import JobGrid from './JobGrid';
import Loading from './Loading';
import { formatNumber } from '../lib/format';
import { useFetch } from '../lib/publicApi';
import type { Category, JobListResponse, Organization } from '../types/job';

interface Props {
  /** Server scope: latest | closing-soon | expired | featured (default: all). */
  scope?: string;
  /** Parameters always applied (e.g. { category: 'bank' }); their filter controls are hidden. */
  fixed?: Record<string, string>;
  showFilters?: boolean;
  emptyTitle: string;
  emptyText?: string;
  /** When set, nothing is fetched until the visitor searches or filters. */
  idleMessage?: string;
}

const FILTER_KEYS = ['q', 'category', 'org', 'state', 'pubFrom', 'pubTo', 'dlFrom', 'dlTo'] as const;

export default function JobExplorer({ scope, fixed = {}, showFilters = false, emptyTitle, emptyText, idleMessage }: Props) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const hasActiveFilter = FILTER_KEYS.some((key) => (params.get(key) ?? '') !== '');

  const path = useMemo(() => {
    if (idleMessage && !hasActiveFilter) return null;
    const query = new URLSearchParams();
    if (scope) query.set('scope', scope);
    if (showFilters) for (const key of FILTER_KEYS) {
      const value = params.get(key);
      if (value) query.set(key, value);
    }
    for (const [key, value] of Object.entries(fixed)) query.set(key, value);
    query.set('page', String(page));
    query.set('pageSize', '12');
    return `/api/public/jobs?${query.toString()}`;
  }, [scope, fixed, showFilters, params, page, idleMessage, hasActiveFilter]);

  const { data, error, loading, reload } = useFetch<JobListResponse>(path);
  const categories = useFetch<{ categories: Category[] }>(showFilters && !fixed.category ? '/api/public/categories' : null);
  const organizations = useFetch<{ organizations: Organization[] }>(showFilters && !fixed.org ? '/api/public/organizations' : null);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    setParams(next);
  }

  function goToPage(target: number) {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete('page');
    else next.set('page', String(target));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      {showFilters && (
        <form key={params.toString()} onSubmit={applyFilters} role="search" className="card mb-6 space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="f-q" className="sr-only">পদ বা প্রতিষ্ঠানের নাম</label>
              <input id="f-q" name="q" type="search" maxLength={100} defaultValue={params.get('q') ?? ''} placeholder="পদের নাম বা প্রতিষ্ঠানের নাম লিখুন" className="input" />
            </div>
            <button type="submit" className="btn btn-primary">খুঁজুন</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {!fixed.category && (
              <div>
                <label htmlFor="f-category" className="mb-1 block text-xs font-medium text-slate-600">ক্যাটাগরি</label>
                <select id="f-category" name="category" defaultValue={params.get('category') ?? ''} className="input">
                  <option value="">সব ক্যাটাগরি</option>
                  {categories.data?.categories.map((item) => (
                    <option key={item.slug} value={item.slug}>{item.name}</option>
                  ))}
                </select>
              </div>
            )}
            {!fixed.org && (
              <div>
                <label htmlFor="f-org" className="mb-1 block text-xs font-medium text-slate-600">প্রতিষ্ঠান</label>
                <select id="f-org" name="org" defaultValue={params.get('org') ?? ''} className="input">
                  <option value="">সব প্রতিষ্ঠান</option>
                  {organizations.data?.organizations.map((item) => (
                    <option key={item.slug} value={item.slug}>{item.name}</option>
                  ))}
                </select>
              </div>
            )}
            {!scope && (
              <div>
                <label htmlFor="f-state" className="mb-1 block text-xs font-medium text-slate-600">অবস্থা</label>
                <select id="f-state" name="state" defaultValue={params.get('state') ?? ''} className="input">
                  <option value="">সব</option>
                  <option value="active">চলমান</option>
                  <option value="expired">মেয়াদোত্তীর্ণ</option>
                </select>
              </div>
            )}
          </div>

          <details className="text-sm" open={Boolean(params.get('pubFrom') || params.get('pubTo') || params.get('dlFrom') || params.get('dlTo'))}>
            <summary className="cursor-pointer font-medium text-brand-700">তারিখ অনুযায়ী ফিল্টার</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="f-pubFrom" className="mb-1 block text-xs font-medium text-slate-600">প্রকাশ: থেকে</label>
                <input id="f-pubFrom" name="pubFrom" type="date" defaultValue={params.get('pubFrom') ?? ''} className="input" />
              </div>
              <div>
                <label htmlFor="f-pubTo" className="mb-1 block text-xs font-medium text-slate-600">প্রকাশ: পর্যন্ত</label>
                <input id="f-pubTo" name="pubTo" type="date" defaultValue={params.get('pubTo') ?? ''} className="input" />
              </div>
              <div>
                <label htmlFor="f-dlFrom" className="mb-1 block text-xs font-medium text-slate-600">শেষ তারিখ: থেকে</label>
                <input id="f-dlFrom" name="dlFrom" type="date" defaultValue={params.get('dlFrom') ?? ''} className="input" />
              </div>
              <div>
                <label htmlFor="f-dlTo" className="mb-1 block text-xs font-medium text-slate-600">শেষ তারিখ: পর্যন্ত</label>
                <input id="f-dlTo" name="dlTo" type="date" defaultValue={params.get('dlTo') ?? ''} className="input" />
              </div>
            </div>
          </details>

          {hasActiveFilter && (
            <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setParams(new URLSearchParams())}>
              সব ফিল্টার মুছুন
            </button>
          )}
        </form>
      )}

      <div aria-live="polite">
        {path === null ? (
          <EmptyState title={idleMessage ?? ''} text="পদের নাম, প্রতিষ্ঠান বা ক্যাটাগরি লিখে অনুসন্ধান করুন।" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <EmptyState title={emptyTitle} text={emptyText} />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <p className="mb-4 text-sm text-slate-500">মোট {formatNumber(data.total)}টি বিজ্ঞপ্তি</p>
            <JobGrid jobs={data.items} />
            {data.totalPages > 1 && (
              <nav aria-label="পৃষ্ঠা" className="mt-8 flex items-center justify-between gap-3 text-sm text-slate-600">
                <button type="button" className="btn btn-outline" disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>← আগের</button>
                <span>পৃষ্ঠা {formatNumber(data.page)} / {formatNumber(data.totalPages)}</span>
                <button type="button" className="btn btn-outline" disabled={data.page >= data.totalPages} onClick={() => goToPage(data.page + 1)}>পরের →</button>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
