import type { ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from './Breadcrumbs';
import { useSeo } from '../lib/seo';

interface Props {
  title: string;
  description: string;
  seoPath: string;
  breadcrumbs: Crumb[];
  noindex?: boolean;
  children: ReactNode;
}

export default function ListingShell({ title, description, seoPath, breadcrumbs, noindex, children }: Props) {
  useSeo({ title, description, path: seoPath, noindex });
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
