import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from './api';
import type { AdminJob } from './types';
import { formatDate, isSafeHttpUrl } from '../lib/format';

interface Props {
  job: AdminJob;
  onChanged: (job: AdminJob) => void;
}

export default function ImportInfoPanel({ job, onChanged }: Props) {
  const info = job.import;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!info) return null;
  const duplicate = info.possibleDuplicate;

  async function clearDuplicate() {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ job: AdminJob }>('POST', `/api/admin/jobs/${job.id}/clear-duplicate`);
      onChanged(response.job);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'পরিবর্তন করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5" aria-labelledby="import-info">
      <h2 id="import-info" className="font-bold text-slate-900">আমদানিকৃত চাকরি — যাচাই করুন</h2>
      <p className="mt-1 text-sm text-slate-700">
        সোর্স: <strong>{info.sourceName}</strong>
        {info.retrievedAt && ` · সংগ্রহের তারিখ: ${formatDate(info.retrievedAt.slice(0, 10))}`}
      </p>
      {isSafeHttpUrl(info.itemUrl) && (
        <p className="mt-1 text-sm">
          <a href={info.itemUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-700 hover:underline">মূল আইটেম খুলুন ↗</a>
        </p>
      )}
      {info.excerpt && <p className="mt-2 rounded-lg bg-white p-3 text-sm text-slate-600">রেফারেন্স অংশ (প্রকাশ হবে না): {info.excerpt}</p>}
      <p className="mt-3 text-sm text-slate-700">
        অফিসিয়াল বিজ্ঞপ্তি দেখে প্রতিষ্ঠান, পদ, যোগ্যতা, তারিখ ও লিংক নিজে লিখুন এবং ঠিক থাকলে নিচে "যাচাই করেছি" টিক দিয়ে প্রকাশ করুন। যাচাই ছাড়া প্রকাশ করা যাবে না।
      </p>

      {duplicate && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">সম্ভাব্য ডুপ্লিকেট</p>
          <p className="mt-1">
            {duplicate.reason === 'same-source-url' ? 'একই সোর্স লিংকের চাকরি আগে থেকেই আছে' : `শিরোনাম খুব মিলে যাচ্ছে (মিল ${Math.round(duplicate.score * 100)}%)`}:{' '}
            <Link to={`/admin/jobs?q=${encodeURIComponent(duplicate.slug)}`} className="font-medium underline">{duplicate.title}</Link>
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-outline !py-1.5" onClick={clearDuplicate} disabled={busy}>এটি ডুপ্লিকেট নয়</button>
          </div>
          {error && <p className="mt-2 font-medium">{error}</p>}
        </div>
      )}
    </section>
  );
}
