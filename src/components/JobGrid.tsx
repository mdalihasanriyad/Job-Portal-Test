import type { Job } from '../types/job';
import JobCard from './JobCard';

export default function JobGrid({ jobs }: { jobs: Job[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
