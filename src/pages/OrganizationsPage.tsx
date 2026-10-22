import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Loading from '../components/Loading';
import OrganizationCard from '../components/OrganizationCard';
import { useFetch } from '../lib/publicApi';
import { useSeo } from '../lib/seo';
import type { Organization } from '../types/job';

export default function OrganizationsPage() {
  useSeo({ title: 'সরকারি প্রতিষ্ঠান', description: 'প্রতিষ্ঠান অনুযায়ী সরকারি চাকরির বিজ্ঞপ্তি দেখুন।', path: '/organizations' });
  const { data, error, reload } = useFetch<{ organizations: Organization[] }>('/api/public/organizations');

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'হোম', to: '/' }, { label: 'প্রতিষ্ঠান' }]} />
      <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">সরকারি প্রতিষ্ঠান</h1>
      <p className="mt-2 text-slate-600">প্রতিষ্ঠান অনুযায়ী বিজ্ঞপ্তি খুঁজুন।</p>
      <div className="mt-8">
        {error ? <ErrorState message={error.message} onRetry={reload} /> : !data ? <Loading /> : data.organizations.length === 0 ? (
          <EmptyState title="এখনো কোনো প্রতিষ্ঠানের বিজ্ঞপ্তি প্রকাশিত হয়নি" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.organizations.map((organization) => <OrganizationCard key={organization.slug} organization={organization} />)}
          </div>
        )}
      </div>
    </div>
  );
}
