import { Link } from 'react-router-dom';
import type { Organization } from '../types/job';
import { formatNumber } from '../lib/format';

export default function OrganizationCard({ organization }: { organization: Organization }) {
  return (
    <Link to={`/organization/${organization.slug}`} className="card block p-5 transition-shadow hover:shadow-md">
      <h3 className="font-bold text-slate-900">{organization.name}</h3>
      <p className="mt-3 text-sm font-semibold text-brand-700">{formatNumber(organization.count ?? 0)}টি বিজ্ঞপ্তি</p>
    </Link>
  );
}
