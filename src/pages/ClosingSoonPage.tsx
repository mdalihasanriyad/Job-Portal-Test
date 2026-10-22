import JobExplorer from '../components/JobExplorer';
import ListingShell from '../components/ListingShell';

export default function ClosingSoonPage() {
  return (
    <ListingShell
      title="শেষ তারিখ ঘনিয়ে আসছে"
      description="আগামী ৭ দিনের মধ্যে আবেদনের সময় শেষ হবে — এমন সরকারি চাকরির বিজ্ঞপ্তি।"
      seoPath="/closing-soon"
      breadcrumbs={[{ label: 'হোম', to: '/' }, { label: 'শেষ তারিখ ঘনিয়ে আসছে' }]}
    >
      <JobExplorer scope="closing-soon" emptyTitle="এই মুহূর্তে শেষ হওয়ার কাছাকাছি কোনো বিজ্ঞপ্তি নেই" emptyText="" />
    </ListingShell>
  );
}
