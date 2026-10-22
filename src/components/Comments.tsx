import { FormEvent, useState } from 'react';
import { PublicApiError, request, useFetch } from '../lib/publicApi';
import { formatDate } from '../lib/format';
import type { PublicComment } from '../types/job';

export default function Comments({ slug }: { slug: string }) {
  const { data, error, loading, reload } = useFetch<{ comments: PublicComment[] }>(`/api/public/jobs/${encodeURIComponent(slug)}/comments`);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: real visitors never see or fill this
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setStatus(null);
    try {
      const response = await request<{ message: string }>('POST', `/api/public/jobs/${encodeURIComponent(slug)}/comments`, { name, comment, website });
      setStatus({ kind: 'ok', text: response.message });
      setName('');
      setComment('');
    } catch (caught) {
      if (caught instanceof PublicApiError) {
        setErrors(caught.details);
        setStatus({ kind: 'error', text: caught.message });
      } else {
        setStatus({ kind: 'error', text: 'মন্তব্য পাঠানো যায়নি।' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-14" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-xl font-bold text-slate-900">মন্তব্য</h2>

      <div className="mt-4">
        {error ? (
          <p className="text-sm text-red-700">
            মন্তব্য লোড করা যায়নি। <button type="button" className="font-semibold underline" onClick={reload}>আবার চেষ্টা করুন</button>
          </p>
        ) : loading && !data ? (
          <p className="text-sm text-slate-500">লোড হচ্ছে…</p>
        ) : data && data.comments.length === 0 ? (
          <p className="text-sm text-slate-600">এখনো কোনো মন্তব্য নেই। আপনিই প্রথম মন্তব্য করুন।</p>
        ) : (
          <ul className="space-y-3">
            {data?.comments.map((item) => (
              <li key={item.id} className="card p-4">
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                {item.createdAt && <p className="text-xs text-slate-500">{formatDate(item.createdAt.slice(0, 10))}</p>}
                <p className="mt-2 whitespace-pre-line text-slate-700">{item.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-5" noValidate>
        <h3 className="font-bold text-slate-900">মন্তব্য করুন</h3>
        <p className="text-sm text-slate-600">আপনার মন্তব্য অ্যাডমিনের অনুমোদনের পর প্রকাশিত হবে। ব্যক্তিগত তথ্য বা অপ্রাসঙ্গিক লিংক দেবেন না।</p>

        <div aria-live="polite">
          {status && (
            <div role={status.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${status.kind === 'ok' ? 'border-accent-100 bg-accent-50 text-accent-700' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {status.text}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="c-name" className="mb-1 block text-sm font-medium text-slate-700">আপনার নাম</label>
          <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" aria-invalid={errors.name ? true : undefined} />
          {errors.name && <p className="mt-1 text-xs font-medium text-red-700">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="c-comment" className="mb-1 block text-sm font-medium text-slate-700">মন্তব্য</label>
          <textarea id="c-comment" className="input min-h-[100px]" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} aria-invalid={errors.comment ? true : undefined} />
          {errors.comment && <p className="mt-1 text-xs font-medium text-red-700">{errors.comment}</p>}
        </div>

        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="c-website">ওয়েবসাইট (এটি খালি রাখুন)</label>
          <input id="c-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'পাঠানো হচ্ছে…' : 'মন্তব্য পাঠান'}
        </button>
      </form>
    </section>
  );
}
