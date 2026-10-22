import JobExplorer from '../components/JobExplorer';
import ListingShell from '../components/ListingShell';

export default function SearchPage() {
  // Search results are thin/duplicate content, so they are kept out of the index.
  return (
    <ListingShell
      title="চাকরি খুঁজুন"
      description="পদের নাম, প্রতিষ্ঠান বা ক্যাটাগরি দিয়ে সরকারি চাকরির বিজ্ঞপ্তি খুঁজুন।"
      seoPath="/search"
      breadcrumbs={[{ label: 'হোম', to: '/' }, { label: 'অনুসন্ধান' }]}
      noindex
    >
      <JobExplorer showFilters idleMessage="খোঁজার জন্য কিছু লিখুন" emptyTitle="কোনো ফলাফল পাওয়া যায়নি" emptyText="ভিন্ন শব্দ দিয়ে আবার চেষ্টা করুন।" />
    </ListingShell>
  );
}
