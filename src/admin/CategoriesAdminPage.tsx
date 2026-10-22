import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, api, type FieldErrors } from './api';
import ConfirmDialog from './ConfirmDialog';
import type { CategoryOption } from './types';
import { formatNumber } from '../lib/format';
import { useSeo } from '../lib/seo';

export default function CategoriesAdminPage() {
  const [items, setItems] = useState<CategoryOption[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ slug: '', name: '', description: '' });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<CategoryOption | null>(null);

  useSeo({ title: 'ক্যাটাগরি — অ্যাডমিন', description: 'ক্যাটাগরি ব্যবস্থাপনা', path: '/admin/categories', noindex: true });

  const load = useCallback(() => {
    api<{ categories: CategoryOption[] }>('GET', '/api/admin/categories')
      .then((response) => setItems(response.categories))
      .catch((caught: unknown) => setError(caught instanceof ApiError ? caught.message : 'তালিকা লোড করা যায়নি।'));
  }, []);

  useEffect(load, [load]);

  function startEdit(category: CategoryOption) {
    setEditingSlug(category.slug);
    setForm({ slug: category.slug, name: category.name, description: category.description ?? '' });
    setErrors({});
    setNotice('');
  }

  function reset() {
    setEditingSlug(null);
    setForm({ slug: '', name: '', description: '' });
    setErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    setNotice('');
    try {
      if (editingSlug) {
        await api('PUT', `/api/admin/categories/${editingSlug}`, { name: form.name, description: form.description });
        setNotice('ক্যাটাগরি হালনাগাদ হয়েছে।');
      } else {
        await api('POST', '/api/admin/categories', form);
        setNotice('নতুন ক্যাটাগরি যোগ হয়েছে।');
      }
      reset();
      load();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.details);
        setError(caught.message);
      } else setError('সংরক্ষণ করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api('DELETE', `/api/admin/categories/${toDelete.slug}`);
      setNotice('ক্যাটাগরি মুছে ফেলা হয়েছে।');
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'মুছে ফেলা যায়নি।');
    } finally {
      setToDelete(null);
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">ক্যাটাগরি ব্যবস্থাপনা</h1>
      <p className="mt-1 text-sm text-slate-600">স্লাগ একবার তৈরির পর বদলানো যায় না, কারণ পাবলিক লিংক (/category/স্লাগ) এর ওপর নির্ভর করে।</p>

      <div aria-live="polite">
        {notice && <div className="mt-4 rounded-lg border border-accent-100 bg-accent-50 p-3 text-sm text-accent-700">{notice}</div>}
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      </div>

      <form onSubmit={submit} className="card mt-6 grid gap-4 p-5 md:grid-cols-3" noValidate>
        <div>
          <label htmlFor="cat-slug" className="mb-1 block text-sm font-medium text-slate-700">স্লাগ (ইংরেজি) *</label>
          <input id="cat-slug" className="input" value={form.slug} disabled={editingSlug !== null} maxLength={40} placeholder="যেমন: railway" onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          {errors.slug && <p className="mt-1 text-xs font-medium text-red-700">{errors.slug}</p>}
        </div>
        <div>
          <label htmlFor="cat-name" className="mb-1 block text-sm font-medium text-slate-700">নাম *</label>
          <input id="cat-name" className="input" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {errors.name && <p className="mt-1 text-xs font-medium text-red-700">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="cat-desc" className="mb-1 block text-sm font-medium text-slate-700">সংক্ষিপ্ত বিবরণ</label>
          <input id="cat-desc" className="input" value={form.description} maxLength={200} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {errors.description && <p className="mt-1 text-xs font-medium text-red-700">{errors.description}</p>}
        </div>
        <div className="flex gap-2 md:col-span-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>{editingSlug ? 'পরিবর্তন সংরক্ষণ' : '+ ক্যাটাগরি যোগ করুন'}</button>
          {editingSlug && <button type="button" className="btn btn-outline" onClick={reset}>বাতিল</button>}
        </div>
      </form>

      <div className="card mt-6 overflow-x-auto">
        {!items ? (
          !error && <p className="p-6 text-slate-600">লোড হচ্ছে…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-slate-600">কোনো ক্যাটাগরি নেই।</p>
        ) : (
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">নাম</th>
                <th scope="col" className="px-4 py-3 font-medium">স্লাগ</th>
                <th scope="col" className="px-4 py-3 font-medium">চাকরি</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">কার্যক্রম</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((category) => (
                <tr key={category.slug} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{category.name}<p className="text-xs font-normal text-slate-500">{category.description}</p></td>
                  <td className="px-4 py-3 text-slate-700">{category.slug}</td>
                  <td className="px-4 py-3 text-slate-700">{formatNumber(category.jobCount ?? 0)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-outline !px-3 !py-1.5" onClick={() => startEdit(category)}>সম্পাদনা</button>
                      <button type="button" className="btn btn-outline !px-3 !py-1.5 !text-red-700" onClick={() => setToDelete(category)}>মুছুন</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog open={toDelete !== null} title="ক্যাটাগরি মুছে ফেলবেন?" message={toDelete ? `"${toDelete.name}" মুছে যাবে। যেসব ক্যাটাগরিতে চাকরি আছে সেগুলো মোছা যাবে না।` : ''} confirmLabel="হ্যাঁ, মুছে ফেলুন" busy={busy} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
