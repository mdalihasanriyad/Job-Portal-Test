import Breadcrumbs from '../components/Breadcrumbs';
import CategoryCard from '../components/CategoryCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Loading from '../components/Loading';
import { useFetch } from '../lib/publicApi';
import { useSeo } from '../lib/seo';
import type { Category } from '../types/job';

export default function CategoriesPage() {
  useSeo({
    title: 'চাকরির ক্যাটাগরি',
    description: 'ব্যাংক, শিক্ষা, স্বাস্থ্য, প্রকৌশলসহ বিভিন্ন ক্যাটাগরি অনুযায়ী সরকারি চাকরির বিজ্ঞপ্তি দেখুন।',
    path: '/categories',
  });
  const { data, error, reload } = useFetch<{ categories: Category[] }>('/api/public/categories');

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'হোম', to: '/' }, { label: 'ক্যাটাগরি' }]} />
      <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">চাকরির ক্যাটাগরি</h1>
      <p className="mt-2 text-slate-600">আপনার আগ্রহের ক্ষেত্র অনুযায়ী বিজ্ঞপ্তি খুঁজুন।</p>
      <div className="mt-8">
        {error ? <ErrorState message={error.message} onRetry={reload} /> : !data ? <Loading /> : data.categories.length === 0 ? (
          <EmptyState title="কোনো ক্যাটাগরি নেই" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.categories.map((category) => <CategoryCard key={category.slug} category={category} />)}
          </div>
        )}
      </div>
    </div>
  );
}
