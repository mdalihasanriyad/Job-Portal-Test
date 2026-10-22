import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import SectionHeading from '../components/SectionHeading';
import JobGrid from '../components/JobGrid';
import CategoryCard from '../components/CategoryCard';
import OrganizationCard from '../components/OrganizationCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Loading from '../components/Loading';
import { SITE } from '../config/site';
import { useSeo } from '../lib/seo';
import { useFetch } from '../lib/publicApi';
import type { Category, Job, Organization } from '../types/job';

interface HomeData {
  latest: Job[];
  featured: Job[];
  closingSoon: Job[];
  categories: Category[];
  organizations: Organization[];
}

const guides = [
  {
    title: 'অনলাইনে আবেদনের ধাপ',
    text: 'অফিসিয়াল বিজ্ঞপ্তি মনোযোগ দিয়ে পড়ুন, প্রয়োজনীয় তথ্য ও কাগজপত্র আগে থেকে প্রস্তুত রাখুন এবং শুধু অফিসিয়াল ওয়েবসাইটের মাধ্যমে আবেদন করুন।',
  },
  {
    title: 'আবেদনের আগে যা যাচাই করবেন',
    text: 'শিক্ষাগত যোগ্যতা, বয়সসীমা, আবেদনের শেষ তারিখ ও আবেদন ফি অফিসিয়াল বিজ্ঞপ্তির সাথে মিলিয়ে নিন।',
  },
  {
    title: 'প্রয়োজনীয় কাগজপত্র',
    text: 'সাধারণত ছবি, স্বাক্ষর, শিক্ষাগত সনদ ও জাতীয় পরিচয়পত্রের তথ্য লাগতে পারে। সঠিক তালিকার জন্য বিজ্ঞপ্তি দেখুন।',
  },
  {
    title: 'প্রতারণা থেকে সতর্ক থাকুন',
    text: 'চাকরির প্রতিশ্রুতি দিয়ে টাকা চাইলে বা অনানুষ্ঠানিক মাধ্যমে ফি চাইলে সতর্ক হোন। ফি কেবল বিজ্ঞপ্তিতে উল্লিখিত অফিসিয়াল পদ্ধতিতে দিন।',
  },
];

export default function HomePage() {
  useSeo({ title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description, path: '/', rawTitle: true });
  const { data, error, reload } = useFetch<HomeData>('/api/public/home');

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page py-12 text-center sm:py-16">
          <h1 className="text-3xl font-bold leading-tight text-brand-900 sm:text-4xl">সরকারি চাকরির সর্বশেষ বিজ্ঞপ্তি</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            আবেদনের শেষ তারিখ, যোগ্যতা ও আবেদন পদ্ধতি — সব এক জায়গায়। আবেদনের আগে অবশ্যই অফিসিয়াল বিজ্ঞপ্তি যাচাই করুন।
          </p>
          <div className="mx-auto mt-6 max-w-2xl">
            <SearchBar />
          </div>
          {data && data.categories.length > 0 && (
            <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="জনপ্রিয় ক্যাটাগরি">
              {data.categories.slice(0, 5).map((category) => (
                <li key={category.slug}>
                  <Link to={`/category/${category.slug}`} className="badge bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="container-page space-y-14 pt-8">
        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <Loading />
        ) : (
          <>
            <section>
              <SectionHeading title="সর্বশেষ চাকরির বিজ্ঞপ্তি" moreTo="/latest-jobs" />
              {data.latest.length ? <JobGrid jobs={data.latest} /> : <EmptyState title="এখন কোনো চলমান বিজ্ঞপ্তি নেই" text="নতুন বিজ্ঞপ্তি প্রকাশিত হলে এখানে দেখা যাবে।" />}
            </section>

            {data.featured.length > 0 && (
              <section>
                <SectionHeading title="ফিচার্ড চাকরি" moreTo="/jobs" />
                <JobGrid jobs={data.featured} />
              </section>
            )}

            <section>
              <SectionHeading title="আবেদনের শেষ তারিখ ঘনিয়ে আসছে" subtitle="আগামী ৭ দিনের মধ্যে আবেদন শেষ হবে" moreTo="/closing-soon" />
              {data.closingSoon.length ? <JobGrid jobs={data.closingSoon} /> : <EmptyState title="এই মুহূর্তে শেষ হওয়ার কাছাকাছি কোনো বিজ্ঞপ্তি নেই" />}
            </section>

            {data.organizations.length > 0 && (
              <section>
                <SectionHeading title="সরকারি প্রতিষ্ঠান" moreTo="/organizations" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {data.organizations.map((organization) => (
                    <OrganizationCard key={organization.slug} organization={organization} />
                  ))}
                </div>
              </section>
            )}

            {data.categories.length > 0 && (
              <section>
                <SectionHeading title="চাকরির ক্যাটাগরি" moreTo="/categories" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.categories.slice(0, 6).map((category) => (
                    <CategoryCard key={category.slug} category={category} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section>
          <SectionHeading title="আবেদনের সহায়ক নির্দেশিকা" />
          <div className="grid gap-4 sm:grid-cols-2">
            {guides.map((guide) => (
              <article key={guide.title} className="card p-5">
                <h3 className="font-bold text-slate-900">{guide.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{guide.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
