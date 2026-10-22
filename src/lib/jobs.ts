import type { Job, JobState } from '../types/job';
import { daysUntil } from './date';

export const CLOSING_SOON_DAYS = 7;

export function getJobState(job: Job): JobState {
  if (!job.deadline) return 'no-deadline';
  const left = daysUntil(job.deadline);
  if (left < 0) return 'expired';
  if (left <= CLOSING_SOON_DAYS) return 'closing-soon';
  return 'open';
}

export function isExpired(job: Job): boolean {
  return getJobState(job) === 'expired';
}

export function getDaysLeft(job: Job): number | null {
  return job.deadline ? daysUntil(job.deadline) : null;
}
