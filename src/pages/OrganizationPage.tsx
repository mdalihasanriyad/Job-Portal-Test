import { useParams } from 'react-router-dom';
import ErrorState from '../components/ErrorState';
import JobExplorer from '../components/JobExplorer';
import ListingShell from '../components/ListingShell';
import Loading from '../components/Loading';
import NotFoundPage from './NotFoundPage';
import { useFetch } from '../lib/publicApi';
import type { Organization } from '../types/job';

function OrganizationView({ organization }: { organization: Organization }) {
  return (
    <ListingShell
      title={`${organization.name} — চাকরির বিজ্ঞপ্তি`}
      description={`${organization.name}-এর প্রকাশিত চাকরির বিজ্ঞপ্তিসমূহ।`}
      seoPath={`/organization/${organization.slug}`}
      breadcrumbs={[{ label: 'হোম', to: '/' }, { label: 'প্রতিষ্ঠান', to: '/organizations' }, { label: organization.name }]}
    >
      <JobExplorer fixed={{ org: organization.slug }} showFilters emptyTitle="এই প্রতিষ্ঠানের কোনো বিজ্ঞপ্তি এখন নেই" />
    </ListingShell>
  );
}

export default function OrganizationPage() {
  const { slug } = useParams();
  const { data, error, reload } = useFetch<{ organizations: Organization[] }>('/api/public/organizations');
  if (error) return <div className="container-page py-10"><ErrorState message={error.message} onRetry={reload} /></div>;
  if (!data) return <div className="container-page"><Loading /></div>;
  const organization = data.organizations.find((item) => item.slug === slug);
  if (!organization) return <NotFoundPage />;
  return <OrganizationView key={organization.slug} organization={organization} />;
}
