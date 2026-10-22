import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import ShareButtons from '../components/ShareButtons';
import StatusBadge from '../components/StatusBadge';
import JobGrid from '../components/JobGrid';
import SectionHeading from '../components/SectionHeading';
import NotFoundPage from './NotFoundPage';
import Comments from '../components/Comments';
import ErrorState from '../components/ErrorState';
import Loading from '../components/Loading';
import { SITE } from '../config/site';
import { daysUntil } from '../lib/date';
import { getJobState } from '../lib/jobs';
import { optimizeImage } from '../lib/images';
import { request, useFetch } from '../lib/publicApi';
import { NOT_SPECIFIED, formatDate, formatNumber, isSafeHttpUrl } from '../lib/format';
import { useSeo } from '../lib/seo';
import type { Job } from '../types/job';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-800">{children}</dd>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text?: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {/* Plain text rendering (whitespace preserved) — no raw HTML is ever injected. */}
      <p className="mt-2 whitespace-pre-line text-slate-700">{text?.trim() ? text : NOT_SPECIFIED}</p>
    </section>
  );
}

function JobDetail({ job, related }: { job: Job; related: Job[] }) {
  const path = `/jobs/${job.slug}`;
  const state = getJobState(job);
  const expired = state === 'expired';
  const canApply = !expired && isSafeHttpUrl(job.applyUrl);
  const hasSource = isSafeHttpUrl(job.sourceUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const image = isSafeHttpUrl(job.featuredImage) && !imageFailed ? job.featuredImage : undefined;
  // Count one view per browser session (no cookies, no personal data; the server ignores bots).
  useEffect(() => {
    try {
      const key = `view:${job.slug}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage unavailable: count it anyway */
    }
    request('POST', `/api/public/jobs/${encodeURIComponent(job.slug)}/view`).catch(() => undefined);
  }, [job.slug]);

  // Long-expired jobs stay reachable but are kept out of the search index.
  const longExpired = job.deadline ? daysUntil(job.deadline) < -SITE.longExpiredDays : false;

  useSeo({
    title: job.seoTitle || `${job.title} — ${job.organization}`,
    description:
      job.metaDescription ||
      `${job.organization}-এর ${job.title}। আবেদনের শেষ তারিখ: ${formatDate(job.deadline)}। অফিসিয়াল বিজ্ঞপ্তি যাচাই করে আবেদন করুন।`,
    path,
    type: 'article',
    noindex: longExpired,
    image,
  });

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[
          { label: 'হোম', to: '/' },
          { label: 'সব চাকরি', to: '/jobs' },
          { label: job.category, to: `/category/${job.categorySlug}` },
          { label: job.title },
        ]}
      />

      <article className="mt-4">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge job={job} />
            <Link to={`/category/${job.categorySlug}`} className="badge bg-brand-50 text-brand-700">
              {job.category}
            </Link>
            {job.verified ? (
              <span className="badge bg-accent-100 text-accent-700">যাচাইকৃত</span>
            ) : (
              <span className="badge bg-slate-100 text-slate-600">যাচাই অপেক্ষমাণ</span>
            )}
          </div>
          <p className="mt-3 text-slate-600">
            <Link to={`/organization/${job.organizationSlug}`} className="font-medium hover:text-brand-700">
              {job.organization}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">{job.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            প্রকাশের তারিখ: {formatDate(job.publishedAt)}
            {job.verified && job.verifiedAt ? ` · সর্বশেষ যাচাই: ${formatDate(job.verifiedAt)}` : ''}
          </p>
        </header>

        {image && (
          <img
            src={optimizeImage(image, 1200)}
            alt={`${job.title} — ${job.organization}`}
            width={1200}
            height={630}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="mt-5 aspect-[1200/630] w-full rounded-xl border border-slate-200 object-cover"
          />
        )}

        {expired && (
          <div role="alert" className="mt-5 rounded-lg border border-slate-300 bg-slate-100 p-4 text-slate-800">
            <p className="font-semibold">এই বিজ্ঞপ্তির আবেদনের সময় শেষ হয়ে গেছে।</p>
            <p className="mt-1 text-sm">এটি বর্তমানে খোলা পদ নয়; শুধু তথ্যের জন্য রাখা হয়েছে।</p>
          </div>
        )}


        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="পদসংখ্যা">{job.totalVacancies !== undefined ? formatNumber(job.totalVacancies) : NOT_SPECIFIED}</Fact>
          <Fact label="চাকরির ধরন">{job.employmentType ?? NOT_SPECIFIED}</Fact>
          <Fact label="আবেদনের শেষ তারিখ">{formatDate(job.deadline)}</Fact>
          <Fact label="বেতন বা গ্রেড">{job.salary ?? NOT_SPECIFIED}</Fact>
          <Fact label="বয়সসীমা">{job.ageLimit ?? NOT_SPECIFIED}</Fact>
          <Fact label="আবেদন ফি">{job.applicationFee ?? NOT_SPECIFIED}</Fact>
        </dl>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-slate-900">পদের তালিকা</h2>
          {job.positions.length === 0 ? (
            <p className="mt-2 text-slate-700">{NOT_SPECIFIED}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th scope="col" className="py-2 pr-4 font-medium">পদের নাম</th>
                    <th scope="col" className="py-2 font-medium">পদসংখ্যা</th>
                  </tr>
                </thead>
                <tbody>
                  {job.positions.map((position) => (
                    <tr key={position.name} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{position.name}</td>
                      <td className="py-2 text-slate-700">
                        {position.vacancies !== undefined ? formatNumber(position.vacancies) : NOT_SPECIFIED}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <TextBlock title="শিক্ষাগত যোগ্যতা" text={job.education} />
        <TextBlock title="অভিজ্ঞতা" text={job.experience} />
        <TextBlock title="বিস্তারিত বিবরণ" text={job.description} />
        <TextBlock title="আবেদন পদ্ধতি" text={job.howToApply} />

        <section className="mt-8">
          <h2 className="text-lg font-bold text-slate-900">গুরুত্বপূর্ণ তারিখ</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <Fact label="প্রকাশের তারিখ">{formatDate(job.publishedAt)}</Fact>
            <Fact label="আবেদন শুরু">{formatDate(job.applicationStart)}</Fact>
            <Fact label="আবেদনের শেষ তারিখ">{formatDate(job.deadline)}</Fact>
          </dl>
        </section>

        <section className="mt-8 rounded-xl border border-brand-100 bg-brand-50 p-5">
          <h2 className="text-lg font-bold text-slate-900">আবেদন করুন</h2>
          <p className="mt-1 text-sm text-slate-600">
            আবেদনের আগে অবশ্যই অফিসিয়াল বিজ্ঞপ্তির সাথে সব তথ্য মিলিয়ে নিন।
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canApply ? (
              <a href={job.applyUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-accent">
                অফিসিয়াল আবেদন লিংক ↗
              </a>
            ) : (
              <span className="text-sm font-medium text-slate-700">
                {expired ? 'আবেদনের সময় শেষ হয়েছে।' : 'অফিসিয়াল আবেদন লিংক উল্লেখ নেই।'}
              </span>
            )}
            {isSafeHttpUrl(job.circularRef) && (
              <a href={job.circularRef} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-outline">
                সার্কুলার (PDF/ছবি) ↗
              </a>
            )}
            {hasSource && (
              <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-outline">
                অফিসিয়াল বিজ্ঞপ্তির উৎস ↗
              </a>
            )}
          </div>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <ShareButtons path={path} title={job.title} />
        </div>
      </article>

      <Comments slug={job.slug} />

      {related.length > 0 && (
        <section className="mt-14">
          <SectionHeading title="সম্পর্কিত চাকরি" />
          <JobGrid jobs={related} />
        </section>
      )}
    </div>
  );
}

export default function JobDetailPage() {
  const { slug } = useParams();
  const { data, error, reload } = useFetch<{ job: Job; related: Job[] }>(slug ? `/api/public/jobs/${encodeURIComponent(slug)}` : null);

  if (error?.status === 404) return <NotFoundPage />;
  if (error) return <div className="container-page py-10"><ErrorState message={error.message} onRetry={reload} /></div>;
  if (!data) return <div className="container-page"><Loading /></div>;
  return <JobDetail key={data.job.id} job={data.job} related={data.related} />;
}
