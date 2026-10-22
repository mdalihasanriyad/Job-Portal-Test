import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api, type FieldErrors } from './api';
import ConfirmDialog from './ConfirmDialog';
import type { CategoryOption } from './types';
import { formatDate } from '../lib/format';
import { useSeo } from '../lib/seo';

interface Source {
  id: string;
  name: string;
  type: 'rss' | 'json';
  url: string;
  defaultOrganization: string;
  defaultCategorySlug: string;
  authorizationNote: string;
  termsUrl?: string;
  enabled: boolean;
  lastRunAt?: string;
  lastRunOk?: boolean;
  lastRunSummary?: string | { fetched: number; created: number; skippedKnown: number; skippedInvalid: number; possibleDuplicates: number };
}

interface Run {
  id: string;
  trigger: 'manual' | 'cron';
  startedAt?: string;
  ok: boolean;
  summary?: { fetched: number; created: number; skippedKnown: number; skippedInvalid: number; possibleDuplicates: number };
  error?: string;
}

interface FormState {
  name: string;
  type: 'rss' | 'json';
  url: string;
  defaultOrganization: string;
  defaultCategorySlug: string;
  authorizationNote: string;
  termsUrl: string;
  authorized: boolean;
  enabled: boolean;
}

const EMPTY: FormState = { name: '', type: 'rss', url: '', defaultOrganization: '', defaultCategorySlug: '', authorizationNote: '', termsUrl: '', authorized: false, enabled: true };

function summaryText(summary: Run['summary']): string {
  if (!summary) return '';
  return `ফিডে ${summary.fetched}টি · নতুন ${summary.created}টি · আগেই আনা ${summary.skippedKnown}টি · অবৈধ ${summary.skippedInvalid}টি · সম্ভাব্য ডুপ্লিকেট ${summary.possibleDuplicates}টি`;
}

export default function ImportsPage() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runs, setRuns] = useState<{ id: string; items: Run[] } | null>(null);
  const [toDelete, setToDelete] = useState<Source | null>(null);

  useSeo({ title: 'জব আমদানি — অ্যাডমিন', description: 'অনুমোদিত সোর্স থেকে আমদানি', path: '/admin/imports', noindex: true });

  const load = useCallback(() => {
    api<{ sources: Source[] }>('GET', '/api/admin/import-sources')
      .then((response) => setSources(response.sources))
      .catch((caught: unknown) => setBanner({ kind: 'error', text: caught instanceof ApiError ? caught.message : 'সোর্স লোড করা যায়নি।' }));
  }, []);

  useEffect(() => {
    load();
    api<{ categories: CategoryOption[] }>('GET', '/api/admin/categories')
      .then((response) => setCategories(response.categories))
      .catch(() => setCategories([]));
  }, [load]);

  const field = (key: keyof FormState) => ({
    id: `src-${key}`,
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value })),
    'aria-invalid': errors[key] ? true : undefined,
  });
  const err = (key: string) => errors[key] && <p className="mt-1 text-xs font-medium text-red-700">{errors[key]}</p>;

  function startEdit(source: Source) {
    setEditingId(source.id);
    setForm({ name: source.name, type: source.type, url: source.url, defaultOrganization: source.defaultOrganization, defaultCategorySlug: source.defaultCategorySlug, authorizationNote: source.authorizationNote, termsUrl: source.termsUrl ?? '', authorized: true, enabled: source.enabled });
    setErrors({});
    setShowForm(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setBanner(null);
    try {
      if (editingId) await api('PUT', `/api/admin/import-sources/${editingId}`, form);
      else await api('POST', '/api/admin/import-sources', form);
      setBanner({ kind: 'ok', text: 'সোর্স সংরক্ষিত হয়েছে।' });
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
      load();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.details);
        setBanner({ kind: 'error', text: caught.message });
      } else setBanner({ kind: 'error', text: 'সংরক্ষণ করা যায়নি।' });
    } finally {
      setBusy(false);
    }
  }

  async function run(source: Source) {
    setRunningId(source.id);
    setBanner(null);
    try {
      const result = await api<{ ok: boolean; summary: Run['summary']; error?: string }>('POST', `/api/admin/import-sources/${source.id}/run`);
      setBanner(result.ok ? { kind: 'ok', text: `সম্পন্ন: ${summaryText(result.summary)}` } : { kind: 'error', text: `আমদানি ব্যর্থ: ${result.error ?? 'অজানা ত্রুটি'}` });
      load();
      if (runs?.id === source.id) await loadRuns(source.id);
    } catch (caught) {
      setBanner({ kind: 'error', text: caught instanceof ApiError ? caught.message : 'আমদানি চালানো যায়নি।' });
    } finally {
      setRunningId(null);
    }
  }

  async function loadRuns(id: string) {
    try {
      const response = await api<{ runs: Run[] }>('GET', `/api/admin/import-sources/${id}/runs`);
      setRuns({ id, items: response.runs });
    } catch {
      setRuns({ id, items: [] });
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api('DELETE', `/api/admin/import-sources/${toDelete.id}`);
      setBanner({ kind: 'ok', text: 'সোর্স মুছে ফেলা হয়েছে। আগে আনা চাকরিগুলো থেকে যাবে।' });
      load();
    } catch (caught) {
      setBanner({ kind: 'error', text: caught instanceof ApiError ? caught.message : 'মুছে ফেলা যায়নি।' });
    } finally {
      setToDelete(null);
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">জব আমদানি</h1>
        <div className="flex gap-2">
          <Link to="/admin/jobs?status=pending_review" className="btn btn-outline">রিভিউ অপেক্ষমাণ চাকরি দেখুন</Link>
          <button type="button" className="btn btn-primary" onClick={() => { setEditingId(null); setForm(EMPTY); setErrors({}); setShowForm((v) => !v); }}>
            {showForm && !editingId ? 'বন্ধ করুন' : '+ নতুন সোর্স'}
          </button>
        </div>
      </div>

      <div role="note" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">শুধু অনুমোদিত সোর্স ব্যবহার করুন</p>
        <ul className="mt-1 list-disc pl-5">
          <li>শুধু প্রকাশ্য RSS/Atom ফিড বা অনুমোদিত API যোগ করুন। লগইন, ক্যাপচা বা সীমাবদ্ধ পেজ এড়িয়ে চলবেন না।</li>
          <li>সাইটের robots.txt মানা হয়; নিষেধ থাকলে ফিড আনা হবে না।</li>
          <li>শুধু শিরোনাম, লিংক ও একটি ছোট রেফারেন্স অংশ নেওয়া হয়। আমদানিকৃত চাকরি সবসময় "রিভিউ অপেক্ষমাণ" থাকে এবং অফিসিয়াল বিজ্ঞপ্তি দেখে আপনাকেই তথ্য লিখে যাচাই করতে হবে।</li>
          <li>সার্কুলার ফাইল বা তৃতীয় পক্ষের লেখা কপি করা হয় না।</li>
        </ul>
      </div>

      <div aria-live="polite">
        {banner && (
          <div role={banner.kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border p-3 text-sm ${banner.kind === 'ok' ? 'border-accent-100 bg-accent-50 text-accent-700' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {banner.text}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="card mt-6 space-y-4 p-5" noValidate>
          <h2 className="text-lg font-bold text-slate-900">{editingId ? 'সোর্স সম্পাদনা' : 'নতুন সোর্স'}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="src-name" className="mb-1 block text-sm font-medium text-slate-700">সোর্সের নাম *</label>
              <input className="input" maxLength={80} {...field('name')} />
              {err('name')}
            </div>
            <div>
              <label htmlFor="src-type" className="mb-1 block text-sm font-medium text-slate-700">ফিডের ধরন *</label>
              <select className="input" {...field('type')}>
                <option value="rss">RSS / Atom</option>
                <option value="json">JSON (items বা তালিকা)</option>
              </select>
              {err('type')}
            </div>
          </div>
          <div>
            <label htmlFor="src-url" className="mb-1 block text-sm font-medium text-slate-700">ফিডের URL (https) *</label>
            <input className="input" type="url" maxLength={500} placeholder="https://" {...field('url')} />
            {err('url')}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="src-defaultOrganization" className="mb-1 block text-sm font-medium text-slate-700">ডিফল্ট প্রতিষ্ঠানের নাম *</label>
              <input className="input" maxLength={150} {...field('defaultOrganization')} />
              <p className="mt-1 text-xs text-slate-500">ফিডে প্রতিষ্ঠান থাকে না, তাই আমদানিকৃত সব আইটেমে এই নাম বসবে (পরে বদলানো যাবে)।</p>
              {err('defaultOrganization')}
            </div>
            <div>
              <label htmlFor="src-defaultCategorySlug" className="mb-1 block text-sm font-medium text-slate-700">ডিফল্ট ক্যাটাগরি *</label>
              <select className="input" {...field('defaultCategorySlug')}>
                <option value="">নির্বাচন করুন</option>
                {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
              </select>
              {err('defaultCategorySlug')}
            </div>
          </div>
          <div>
            <label htmlFor="src-authorizationNote" className="mb-1 block text-sm font-medium text-slate-700">অনুমতির বিবরণ *</label>
            <textarea className="input min-h-[80px]" maxLength={500} placeholder="যেমন: প্রতিষ্ঠানের নিজস্ব প্রকাশ্য RSS ফিড, পুনঃব্যবহারের জন্য উন্মুক্ত।" {...field('authorizationNote')} />
            {err('authorizationNote')}
          </div>
          <div>
            <label htmlFor="src-termsUrl" className="mb-1 block text-sm font-medium text-slate-700">শর্তাবলি/নীতির লিংক (ঐচ্ছিক)</label>
            <input className="input" type="url" maxLength={500} placeholder="https://" {...field('termsUrl')} />
            {err('termsUrl')}
          </div>
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={form.authorized} onChange={(e) => setForm({ ...form, authorized: e.target.checked })} />
              আমি নিশ্চিত করছি যে এই সোর্স স্বয়ংক্রিয়ভাবে আনার অনুমতি/বৈধতা আছে এবং আমি এর শর্তাবলি মেনে চলব।
            </label>
            {err('authorized')}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              সক্রিয় (নির্ধারিত স্বয়ংক্রিয় রানে অন্তর্ভুক্ত হবে)
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ'}</button>
            <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setEditingId(null); }}>বাতিল</button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {!sources ? (
          <p className="text-slate-600">লোড হচ্ছে…</p>
        ) : sources.length === 0 ? (
          <p className="card p-6 text-slate-600">এখনো কোনো সোর্স নেই। অনুমোদিত কোনো ফিড পেলে "নতুন সোর্স" দিয়ে যোগ করুন।</p>
        ) : (
          sources.map((source) => (
            <section key={source.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">{source.name} <span className={`badge ${source.enabled ? 'bg-accent-100 text-accent-700' : 'bg-slate-200 text-slate-700'}`}>{source.enabled ? 'সক্রিয়' : 'বন্ধ'}</span></h2>
                  <p className="break-all text-sm text-slate-600">{source.url}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {source.type === 'rss' ? 'RSS/Atom' : 'JSON'} · {source.defaultOrganization}
                    {source.lastRunAt && ` · শেষ রান: ${formatDate(source.lastRunAt.slice(0, 10))} ${source.lastRunOk ? '✔' : '✘'}`}
                  </p>
                  {source.lastRunSummary && (
                    <p className={`mt-1 text-xs ${source.lastRunOk ? 'text-slate-600' : 'text-red-700'}`}>
                      {typeof source.lastRunSummary === 'string' ? source.lastRunSummary : summaryText(source.lastRunSummary)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-accent !px-3 !py-1.5" disabled={runningId !== null} onClick={() => run(source)}>
                    {runningId === source.id ? 'আনা হচ্ছে…' : 'এখনই আনুন'}
                  </button>
                  <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => (runs?.id === source.id ? setRuns(null) : loadRuns(source.id))}>
                    {runs?.id === source.id ? 'ইতিহাস লুকান' : 'রানের ইতিহাস'}
                  </button>
                  <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => startEdit(source)}>সম্পাদনা</button>
                  <button type="button" className="btn btn-outline !px-3 !py-1.5 !text-red-700" onClick={() => setToDelete(source)}>মুছুন</button>
                </div>
              </div>

              {runs?.id === source.id && (
                <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {runs.items.length === 0 ? (
                    <li className="p-3 text-slate-600">কোনো রান নেই।</li>
                  ) : (
                    runs.items.map((item) => (
                      <li key={item.id} className="p-3">
                        <span className={item.ok ? 'text-accent-700' : 'text-red-700'}>{item.ok ? '✔' : '✘'}</span>{' '}
                        {item.startedAt && formatDate(item.startedAt.slice(0, 10))} · {item.trigger === 'cron' ? 'স্বয়ংক্রিয়' : 'হাতে'} ·{' '}
                        {item.ok ? summaryText(item.summary) : item.error}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </section>
          ))
        )}
      </div>

      <ConfirmDialog open={toDelete !== null} title="সোর্স মুছে ফেলবেন?" message={toDelete ? `"${toDelete.name}" মুছে যাবে। এই সোর্স থেকে আগে আনা চাকরিগুলো মুছবে না।` : ''} confirmLabel="হ্যাঁ, মুছে ফেলুন" busy={busy} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
