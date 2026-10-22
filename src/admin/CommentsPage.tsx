import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from './api';
import ConfirmDialog from './ConfirmDialog';
import { formatDate, formatNumber } from '../lib/format';
import { useSeo } from '../lib/seo';

interface AdminComment {
  id: string;
  jobSlug: string;
  jobTitle: string;
  name: string;
  comment: string;
  status: 'pending' | 'approved' | 'hidden';
  createdAt?: string;
}

interface ListResponse {
  items: AdminComment[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_LABEL: Record<AdminComment['status'], { label: string; className: string }> = {
  pending: { label: 'অনুমোদনের অপেক্ষায়', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'প্রকাশিত', className: 'bg-accent-100 text-accent-700' },
  hidden: { label: 'লুকানো', className: 'bg-slate-200 text-slate-700' },
};

export default function CommentsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<{ id: string; name: string; comment: string } | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<AdminComment | null>(null);
  const [busy, setBusy] = useState(false);

  useSeo({ title: 'মন্তব্য — অ্যাডমিন', description: 'মন্তব্য মডারেশন', path: '/admin/comments', noindex: true });

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (status !== 'all') query.set('status', status);
    api<ListResponse>('GET', `/api/admin/comments?${query.toString()}`)
      .then((response) => active && (setData(response), setError('')))
      .catch((caught: unknown) => active && setError(caught instanceof ApiError ? caught.message : 'তালিকা লোড করা যায়নি।'));
    return () => {
      active = false;
    };
  }, [status, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  async function setStatus(comment: AdminComment, next: AdminComment['status']) {
    setNotice('');
    try {
      await api('POST', `/api/admin/comments/${comment.id}/status`, { status: next });
      setNotice(next === 'approved' ? 'মন্তব্য অনুমোদন করা হয়েছে।' : next === 'hidden' ? 'মন্তব্য লুকানো হয়েছে।' : 'মন্তব্য অপেক্ষমাণ করা হয়েছে।');
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'স্ট্যাটাস পরিবর্তন করা যায়নি।');
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setEditErrors({});
    try {
      await api('PUT', `/api/admin/comments/${editing.id}`, { name: editing.name, comment: editing.comment });
      setEditing(null);
      setNotice('মন্তব্য সংশোধন করা হয়েছে।');
      reload();
    } catch (caught) {
      if (caught instanceof ApiError) setEditErrors(caught.details);
      setError(caught instanceof ApiError ? caught.message : 'সংশোধন করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api('DELETE', `/api/admin/comments/${toDelete.id}`);
      setNotice('মন্তব্য মুছে ফেলা হয়েছে।');
      setToDelete(null);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'মুছে ফেলা যায়নি।');
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { value: 'pending', label: 'অপেক্ষমাণ' },
    { value: 'approved', label: 'প্রকাশিত' },
    { value: 'hidden', label: 'লুকানো' },
    { value: 'all', label: 'সব' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">মন্তব্য মডারেশন</h1>
      <div role="tablist" aria-label="মন্তব্যের স্ট্যাটাস" className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab.value} role="tab" type="button" aria-selected={status === tab.value} className={`btn ${status === tab.value ? 'btn-primary' : 'btn-outline'}`} onClick={() => setParams(tab.value === 'pending' ? {} : { status: tab.value })}>
            {tab.label}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {notice && <div className="mt-4 rounded-lg border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{notice}</div>}
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      </div>

      {!data ? (
        !error && <p className="mt-6 text-slate-600">লোড হচ্ছে…</p>
      ) : data.items.length === 0 ? (
        <p className="card mt-6 p-6 text-slate-600">এই তালিকায় কোনো মন্তব্য নেই।</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {data.items.map((item) => (
            <li key={item.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                  <Link to={`/jobs/${item.jobSlug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">{item.jobTitle}</Link>
                  {item.createdAt && ` · ${formatDate(item.createdAt.slice(0, 10))}`}
                </p>
                <span className={`badge ${STATUS_LABEL[item.status].className}`}>{STATUS_LABEL[item.status].label}</span>
              </div>

              {editing?.id === item.id ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="edit-name" className="mb-1 block text-xs font-medium text-slate-600">নাম</label>
                    <input id="edit-name" className="input" maxLength={60} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    {editErrors.name && <p className="mt-1 text-xs font-medium text-red-700">{editErrors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="edit-comment" className="mb-1 block text-xs font-medium text-slate-600">মন্তব্য</label>
                    <textarea id="edit-comment" className="input min-h-[90px]" maxLength={1000} value={editing.comment} onChange={(e) => setEditing({ ...editing, comment: e.target.value })} />
                    {editErrors.comment && <p className="mt-1 text-xs font-medium text-red-700">{editErrors.comment}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy}>সংরক্ষণ</button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditing(null)} disabled={busy}>বাতিল</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{item.comment}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status !== 'approved' && <button type="button" className="btn btn-accent !px-3 !py-1.5" onClick={() => setStatus(item, 'approved')}>অনুমোদন</button>}
                    {item.status !== 'hidden' && <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => setStatus(item, 'hidden')}>লুকান</button>}
                    <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => { setEditErrors({}); setEditing({ id: item.id, name: item.name, comment: item.comment }); }}>সম্পাদনা</button>
                    <button type="button" className="btn btn-outline !px-3 !py-1.5 !text-red-700" onClick={() => setToDelete(item)}>মুছুন</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label="পৃষ্ঠা" className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <p>মোট {formatNumber(data.total)}টি · পৃষ্ঠা {formatNumber(data.page)} / {formatNumber(data.totalPages)}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" disabled={data.page <= 1} onClick={() => setParams({ ...(status !== 'pending' ? { status } : {}), page: String(data.page - 1) })}>← আগের</button>
            <button type="button" className="btn btn-outline" disabled={data.page >= data.totalPages} onClick={() => setParams({ ...(status !== 'pending' ? { status } : {}), page: String(data.page + 1) })}>পরের →</button>
          </div>
        </nav>
      )}

      <ConfirmDialog open={toDelete !== null} title="মন্তব্য মুছে ফেলবেন?" message="এই মন্তব্য স্থায়ীভাবে মুছে যাবে।" confirmLabel="হ্যাঁ, মুছে ফেলুন" busy={busy} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
