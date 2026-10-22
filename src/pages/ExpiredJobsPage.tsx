import JobExplorer from '../components/JobExplorer';
import ListingShell from '../components/ListingShell';

export default function ExpiredJobsPage() {
  return (
    <ListingShell
      title="মেয়াদোত্তীর্ণ চাকরির বিজ্ঞপ্তি"
      description="যেসব বিজ্ঞপ্তির আবেদনের সময় শেষ হয়ে গেছে। এগুলো বর্তমানে খোলা পদ নয়; শুধু তথ্যের জন্য সংরক্ষিত।"
      seoPath="/expired-jobs"
      breadcrumbs={[{ label: 'হোম', to: '/' }, { label: 'মেয়াদোত্তীর্ণ বিজ্ঞপ্তি' }]}
    >
      <JobExplorer scope="expired" emptyTitle="কোনো মেয়াদোত্তীর্ণ বিজ্ঞপ্তি নেই" emptyText="" />
    </ListingShell>
  );
}
