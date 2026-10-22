import { useParams } from 'react-router-dom';
import ErrorState from '../components/ErrorState';
import JobExplorer from '../components/JobExplorer';
import ListingShell from '../components/ListingShell';
import Loading from '../components/Loading';
import NotFoundPage from './NotFoundPage';
import { useFetch } from '../lib/publicApi';
import type { Category } from '../types/job';

function CategoryView({ category }: { category: Category }) {
  return (
    <ListingShell
      title={`${category.name} — সরকারি চাকরি`}
      description={category.description || `${category.name} ক্যাটাগরির সরকারি চাকরির বিজ্ঞপ্তি।`}
      seoPath={`/category/${category.slug}`}
      breadcrumbs={[{ label: 'হোম', to: '/' }, { label: 'ক্যাটাগরি', to: '/categories' }, { label: category.name }]}
    >
      <JobExplorer fixed={{ category: category.slug }} showFilters emptyTitle="এই ক্যাটাগরিতে এখন কোনো বিজ্ঞপ্তি নেই" />
    </ListingShell>
  );
}

export default function CategoryPage() {
  const { slug } = useParams();
  const { data, error, reload } = useFetch<{ categories: Category[] }>('/api/public/categories');
  if (error) return <div className="container-page py-10"><ErrorState message={error.message} onRetry={reload} /></div>;
  if (!data) return <div className="container-page"><Loading /></div>;
  const category = data.categories.find((item) => item.slug === slug);
  if (!category) return <NotFoundPage />;
  return <CategoryView key={category.slug} category={category} />;
}
