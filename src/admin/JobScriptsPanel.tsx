import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from './api';
import { FORMAT_LABEL, ScriptStatusPill } from './scriptLabels';
import type { AdminScript, ScriptFormat, ScriptListResponse } from './types';
import { formatDate } from '../lib/format';

interface Props {
  jobId: string;
  /** True when the form has unsaved changes; the prompt is built from the SAVED job. */
  dirty: boolean;
}

export default function JobScriptsPanel({ jobId, dirty }: Props) {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<AdminScript[] | null>(null);
  const [chooser, setChooser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api<ScriptListResponse>('GET', `/api/admin/scripts?jobId=${jobId}`)
      .then((response) => active && setScripts(response.items))
      .catch(() => active && setScripts([]));
    return () => {
      active = false;
    };
  }, [jobId]);

  async function create(format: ScriptFormat) {
    setBusy(true);
    setError('');
    try {
      const response = await api<{ script: AdminScript }>('POST', '/api/admin/scripts', { jobId, format });
      navigate(`/admin/scripts/${response.script.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'স্ক্রিপ্ট প্রম্পট তৈরি করা যায়নি।');
      setBusy(false);
    }
  }

  return (
    <section className="card mt-8 space-y-4 p-6" aria-labelledby="yt-heading">
      <h2 id="yt-heading" className="text-lg font-bold text-slate-900">ইউটিউব স্ক্রিপ্ট</h2>
      <p className="text-sm text-slate-600">
        এই চাকরির তথ্য থেকে একটি বাংলা AI প্রম্পট তৈরি হবে। প্রম্পটটি কপি করে ChatGPT, Claude বা Gemini-তে চালান, তারপর ফলাফল এখানে পেস্ট করুন। এই অ্যাপ নিজে কোনো AI স্ক্রিপ্ট তৈরি করে না।
      </p>

      {dirty && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          ফর্মে সংরক্ষণহীন পরিবর্তন আছে। প্রম্পট সংরক্ষিত তথ্য থেকে তৈরি হয়, তাই আগে চাকরিটি সংরক্ষণ করুন।
        </p>
      )}
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

      {!chooser ? (
        <button type="button" className="btn btn-primary" onClick={() => setChooser(true)} disabled={busy}>
          ইউটিউব স্ক্রিপ্ট তৈরি করুন
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-accent" onClick={() => create('short')} disabled={busy}>শর্ট স্ক্রিপ্ট (৬০–৯০ সেকেন্ড)</button>
          <button type="button" className="btn btn-accent" onClick={() => create('full')} disabled={busy}>পূর্ণ স্ক্রিপ্ট (৩–৫ মিনিট)</button>
          <button type="button" className="btn btn-outline" onClick={() => setChooser(false)} disabled={busy}>বাতিল</button>
        </div>
      )}

      {scripts && scripts.length > 0 && (
        <div>
          <h3 className="mt-2 text-sm font-semibold text-slate-700">এই চাকরির স্ক্রিপ্ট</h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {scripts.map((script) => (
              <li key={script.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link to={`/admin/scripts/${script.id}`} className="font-medium text-brand-700 hover:underline">
                  {script.title || FORMAT_LABEL[script.format]}
                </Link>
                <span className="flex items-center gap-2 text-slate-500">
                  {script.updatedAt && formatDate(script.updatedAt.slice(0, 10))}
                  <ScriptStatusPill status={script.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
