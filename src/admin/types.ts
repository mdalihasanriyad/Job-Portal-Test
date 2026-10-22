export type AdminJobStatus = 'draft' | 'pending_review' | 'published';

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
}

export interface Position {
  name: string;
  vacancies?: number;
}

export interface ImportInfo {
  sourceName: string;
  itemUrl?: string;
  retrievedAt?: string;
  excerpt?: string;
  possibleDuplicate?: { jobId: string; slug: string; title: string; score: number; reason: 'same-source-url' | 'similar-title' };
}

export interface AdminJob {
  id: string;
  slug: string;
  organization: string;
  organizationSlug: string;
  title: string;
  positions: Position[];
  totalVacancies?: number;
  categorySlug: string;
  category: string;
  employmentType?: string;
  education?: string;
  experience?: string;
  ageLimit?: string;
  salary?: string;
  applicationFee?: string;
  applicationStart?: string;
  deadline?: string;
  publishedAt: string;
  verifiedAt?: string;
  description?: string;
  howToApply?: string;
  applyUrl?: string;
  sourceUrl?: string;
  circularRef?: string;
  seoTitle?: string;
  metaDescription?: string;
  featuredImage?: string;
  import?: ImportInfo;
  status: AdminJobStatus;
  verified: boolean;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobListItem {
  id: string;
  slug: string;
  title: string;
  organization: string;
  category: string;
  categorySlug: string;
  status: AdminJobStatus;
  featured: boolean;
  imported?: boolean;
  possibleDuplicate?: boolean;
  deadline?: string;
  publishedAt: string;
  updatedAt?: string;
}

export interface JobListResponse {
  items: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StatsResponse {
  counts: {
    total: number;
    published: number;
    draft: number;
    pendingReview: number;
    expired: number;
    pendingComments: number;
    newMessages: number;
  };
  recent: JobListItem[];
  analytics?: {
    today: number;
    last7Days: number;
    daily: { date: string; views: number }[];
    topJobs: { id: string; title: string; slug: string; views: number }[];
  };
}

export interface CategoryOption {
  slug: string;
  name: string;
  description?: string;
  jobCount?: number;
}

export interface Features {
  uploads: boolean;
  ai: { enabled: boolean; model: string };
}

export type ScriptFormat = 'short' | 'full';
export type ScriptStatus = 'prompt' | 'draft' | 'final';

export interface AdminScript {
  id: string;
  jobId: string;
  jobSlug: string;
  jobTitle: string;
  format: ScriptFormat;
  title: string;
  aiTool: string;
  status: ScriptStatus;
  wordCount: number;
  promptGeneratedAt?: string;
  generation?: { by: string; model: string; at?: string; inputTokens?: number; outputTokens?: number; truncated?: boolean };
  createdAt?: string;
  updatedAt?: string;
  prompt?: string;
  content?: string;
}

export interface ScriptListResponse {
  items: AdminScript[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
