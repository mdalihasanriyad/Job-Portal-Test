import JobExplorer from '../components/JobExplorer';
import ListingShell from '../components/ListingShell';

export default function JobsPage() {
  return (
    <ListingShell
      title="সব সরকারি চাকরি"
      description="প্রকাশিত সব সরকারি চাকরির বিজ্ঞপ্তি এক জায়গায়। ক্যাটাগরি, প্রতিষ্ঠান ও তারিখ দিয়ে ফিল্টার করুন; মেয়াদোত্তীর্ণ বিজ্ঞপ্তি আলাদাভাবে চিহ্নিত থাকে।"
      seoPath="/jobs"
      breadcrumbs={[{ label: 'হোম', to: '/' }, { label: 'সব চাকরি' }]}
    >
      <JobExplorer showFilters emptyTitle="কোনো বিজ্ঞপ্তি পাওয়া যায়নি" emptyText="ফিল্টার বদলে আবার চেষ্টা করুন।" />
    </ListingShell>
  );
}
