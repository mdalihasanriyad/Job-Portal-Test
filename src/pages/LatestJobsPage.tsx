import JobExplorer from '../components/JobExplorer';
import ListingShell from '../components/ListingShell';

export default function LatestJobsPage() {
  return (
    <ListingShell
      title="সর্বশেষ চাকরির বিজ্ঞপ্তি"
      description="সম্প্রতি প্রকাশিত ও এখনো আবেদন চলমান সরকারি চাকরির বিজ্ঞপ্তি।"
      seoPath="/latest-jobs"
      breadcrumbs={[{ label: 'হোম', to: '/' }, { label: 'সর্বশেষ বিজ্ঞপ্তি' }]}
    >
      <JobExplorer scope="latest" emptyTitle="এখন কোনো চলমান বিজ্ঞপ্তি নেই" emptyText="নতুন বিজ্ঞপ্তি প্রকাশিত হলে এখানে দেখা যাবে।" />
    </ListingShell>
  );
}
