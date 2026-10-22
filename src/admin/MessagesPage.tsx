import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, api } from './api';
import ConfirmDialog from './ConfirmDialog';
import { formatDate, formatNumber } from '../lib/format';
import { useSeo } from '../lib/seo';

interface Message {
  id: string;
  name: string;
  email?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  createdAt?: string;
}

interface ListResponse {
  items: Message[];
  total: number;
  page: number;
  totalPages: number;
}

export default function MessagesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'new';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [toDelete, setToDelete] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  useSeo({ title: 'বার্তা — অ্যাডমিন', description: 'যোগাযোগ বার্তা', path: '/admin/messages', noindex: true });

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (status !== 'all') query.set('status', status);
    api<ListResponse>('GET', `/api/admin/messages?${query.toString()}`)
      .then((response) => active && (setData(response), setError('')))
      .catch((caught: unknown) => active && setError(caught instanceof ApiError ? caught.message : 'তালিকা লোড করা যায়নি।'));
    return () => {
      active = false;
    };
  }, [status, page, reloadKey]);

  async function setMessageStatus(message: Message, next: Message['status']) {
    try {
      await api('POST', `/api/admin/messages/${message.id}/status`, { status: next });
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'স্ট্যাটাস পরিবর্তন করা যায়নি।');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api('DELETE', `/api/admin/messages/${toDelete.id}`);
      setToDelete(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'মুছে ফেলা যায়নি।');
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { value: 'new', label: 'নতুন' },
    { value: 'read', label: 'পড়া হয়েছে' },
    { value: 'archived', label: 'আর্কাইভ' },
    { value: 'all', label: 'সব' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">যোগাযোগ বার্তা</h1>
      <div role="tablist" aria-label="বার্তার স্ট্যাটাস" className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab.value} role="tab" type="button" aria-selected={status === tab.value} className={`btn ${status === tab.value ? 'btn-primary' : 'btn-outline'}`} onClick={() => setParams(tab.value === 'new' ? {} : { status: tab.value })}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {!data ? (
        !error && <p className="mt-6 text-slate-600">লোড হচ্ছে…</p>
      ) : data.items.length === 0 ? (
        <p className="card mt-6 p-6 text-slate-600">কোনো বার্তা নেই।</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {data.items.map((item) => (
            <li key={item.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{item.subject}</p>
                {item.status === 'new' && <span className="badge bg-brand-100 text-brand-800">নতুন</span>}
              </div>
              <p className="text-sm text-slate-500">
                {item.name}
                {item.email ? ` · ${item.email}` : ' · ইমেইল দেননি'}
                {item.createdAt && ` · ${formatDate(item.createdAt.slice(0, 10))}`}
              </p>
              <p className="mt-2 whitespace-pre-line text-slate-700">{item.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status !== 'read' && <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => setMessageStatus(item, 'read')}>পড়া হয়েছে</button>}
                {item.status !== 'new' && <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => setMessageStatus(item, 'new')}>নতুন চিহ্নিত করুন</button>}
                {item.status !== 'archived' && <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => setMessageStatus(item, 'archived')}>আর্কাইভ</button>}
                <button type="button" className="btn btn-outline !px-3 !py-1.5 !text-red-700" onClick={() => setToDelete(item)}>মুছুন</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label="পৃষ্ঠা" className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <p>মোট {formatNumber(data.total)}টি · পৃষ্ঠা {formatNumber(data.page)} / {formatNumber(data.totalPages)}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" disabled={data.page <= 1} onClick={() => setParams({ ...(status !== 'new' ? { status } : {}), page: String(data.page - 1) })}>← আগের</button>
            <button type="button" className="btn btn-outline" disabled={data.page >= data.totalPages} onClick={() => setParams({ ...(status !== 'new' ? { status } : {}), page: String(data.page + 1) })}>পরের →</button>
          </div>
        </nav>
      )}

      <ConfirmDialog open={toDelete !== null} title="বার্তা মুছে ফেলবেন?" message="এই বার্তা স্থায়ীভাবে মুছে যাবে।" confirmLabel="হ্যাঁ, মুছে ফেলুন" busy={busy} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
