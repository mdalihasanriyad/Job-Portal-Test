export type JobStatus = 'draft' | 'pending_review' | 'published';

export interface JobPosition {
  name: string;
  vacancies?: number;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  count?: number;
}

export interface Organization {
  slug: string;
  name: string;
  count?: number;
}

export interface Job {
  id: string;
  slug: string;
  organizationSlug: string;
  organization: string;
  title: string;
  positions: JobPosition[];
  totalVacancies?: number;
  categorySlug: string;
  category: string;
  employmentType?: string;
  education?: string;
  experience?: string;
  ageLimit?: string;
  salary?: string;
  applicationFee?: string;
  /** ISO date: YYYY-MM-DD */
  applicationStart?: string;
  /** ISO date: YYYY-MM-DD */
  deadline?: string;
  /** ISO date: YYYY-MM-DD */
  publishedAt: string;
  /** ISO date: YYYY-MM-DD — when an editor last verified against the official notice */
  verifiedAt?: string;
  applyUrl?: string;
  sourceUrl?: string;
  circularRef?: string;
  description?: string;
  howToApply?: string;
  seoTitle?: string;
  metaDescription?: string;
  featuredImage?: string;
  status: JobStatus;
  verified: boolean;
  featured: boolean;
}

export interface JobListResponse {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PublicComment {
  id: string;
  name: string;
  comment: string;
  createdAt?: string;
}

export type JobState = 'open' | 'closing-soon' | 'expired' | 'no-deadline';
