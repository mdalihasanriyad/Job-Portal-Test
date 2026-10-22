import type { ReactNode } from 'react';
import { NOT_SPECIFIED, formatDate, formatNumber, isSafeHttpUrl } from '../lib/format';

export interface PreviewData {
  organization: string;
  title: string;
  category: string;
  positions: { name: string; vacancies?: number }[];
  totalVacancies?: number;
  employmentType?: string;
  education?: string;
  experience?: string;
  ageLimit?: string;
  salary?: string;
  applicationFee?: string;
  applicationStart?: string;
  deadline?: string;
  publishedAt?: string;
  description?: string;
  howToApply?: string;
  applyUrl?: string;
  sourceUrl?: string;
  verified: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-800">{children}</dd>
    </div>
  );
}

function Block({ title, text }: { title: string; text?: string }) {
  return (
    <section className="mt-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="mt-1 whitespace-pre-line text-slate-700">{text?.trim() ? text : NOT_SPECIFIED}</p>
    </section>
  );
}

/** Admin-only preview. All values render as plain text (React escapes them). */
export default function JobPreview({ data }: { data: PreviewData }) {
  return (
    <div className="card p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">প্রিভিউ — এখনো প্রকাশিত হয়নি</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="badge bg-brand-50 text-brand-700">{data.category || 'ক্যাটাগরি নির্বাচন করা হয়নি'}</span>
        <span className={`badge ${data.verified ? 'bg-accent-100 text-accent-700' : 'bg-slate-100 text-slate-600'}`}>
          {data.verified ? 'যাচাইকৃত' : 'যাচাই অপেক্ষমাণ'}
        </span>
      </div>
      <p className="mt-3 text-slate-600">{data.organization || NOT_SPECIFIED}</p>
      <h2 className="text-2xl font-bold text-slate-900">{data.title || NOT_SPECIFIED}</h2>
      <p className="mt-1 text-sm text-slate-500">প্রকাশের তারিখ: {formatDate(data.publishedAt)}</p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Row label="পদসংখ্যা">{data.totalVacancies !== undefined ? formatNumber(data.totalVacancies) : NOT_SPECIFIED}</Row>
        <Row label="চাকরির ধরন">{data.employmentType || NOT_SPECIFIED}</Row>
        <Row label="আবেদনের শেষ তারিখ">{formatDate(data.deadline)}</Row>
        <Row label="বেতন বা গ্রেড">{data.salary || NOT_SPECIFIED}</Row>
        <Row label="বয়সসীমা">{data.ageLimit || NOT_SPECIFIED}</Row>
        <Row label="আবেদন ফি">{data.applicationFee || NOT_SPECIFIED}</Row>
      </dl>

      <section className="mt-5">
        <h3 className="font-bold text-slate-900">পদের তালিকা</h3>
        {data.positions.length === 0 ? (
          <p className="mt-1 text-slate-700">{NOT_SPECIFIED}</p>
        ) : (
          <ul className="mt-1 list-disc pl-5 text-slate-700">
            {data.positions.map((position, index) => (
              <li key={`${position.name}-${index}`}>
                {position.name} — {position.vacancies !== undefined ? formatNumber(position.vacancies) : NOT_SPECIFIED}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Block title="শিক্ষাগত যোগ্যতা" text={data.education} />
      <Block title="অভিজ্ঞতা" text={data.experience} />
      <Block title="বিস্তারিত বিবরণ" text={data.description} />
      <Block title="আবেদন পদ্ধতি" text={data.howToApply} />

      <section className="mt-5">
        <h3 className="font-bold text-slate-900">গুরুত্বপূর্ণ তারিখ ও লিংক</h3>
        <p className="mt-1 text-sm text-slate-700">
          আবেদন শুরু: {formatDate(data.applicationStart)} · শেষ তারিখ: {formatDate(data.deadline)}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          অফিসিয়াল আবেদন লিংক: {isSafeHttpUrl(data.applyUrl) ? data.applyUrl : NOT_SPECIFIED}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          অফিসিয়াল উৎস: {isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : NOT_SPECIFIED}
        </p>
      </section>
    </div>
  );
}
