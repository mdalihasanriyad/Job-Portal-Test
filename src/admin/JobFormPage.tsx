import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, type FieldErrors } from './api';
import ConfirmDialog from './ConfirmDialog';
import JobPreview from './JobPreview';
import FileUpload from './FileUpload';
import ImportInfoPanel from './ImportInfoPanel';
import JobScriptsPanel from './JobScriptsPanel';
import { StatusPill } from './labels';
import type { AdminJob, AdminJobStatus, CategoryOption, Features } from './types';
import { todayISO } from '../lib/date';
import { useSeo } from '../lib/seo';

interface PositionRow {
  name: string;
  vacancies: string;
}

interface FormValues {
  slug: string;
  organization: string;
  title: string;
  positions: PositionRow[];
  totalVacancies: string;
  categorySlug: string;
  employmentType: string;
  education: string;
  experience: string;
  ageLimit: string;
  salary: string;
  applicationFee: string;
  applicationStart: string;
  deadline: string;
  publishedAt: string;
  description: string;
  howToApply: string;
  applyUrl: string;
  sourceUrl: string;
  circularRef: string;
  seoTitle: string;
  metaDescription: string;
  featuredImage: string;
  featured: boolean;
  verified: boolean;
}

function emptyValues(): FormValues {
  return {
    slug: '', organization: '', title: '', positions: [{ name: '', vacancies: '' }], totalVacancies: '',
    categorySlug: '', employmentType: '', education: '', experience: '', ageLimit: '', salary: '',
    applicationFee: '', applicationStart: '', deadline: '', publishedAt: todayISO(), description: '',
    howToApply: '', applyUrl: '', sourceUrl: '', circularRef: '', seoTitle: '', metaDescription: '',
    featuredImage: '', featured: false, verified: false,
  };
}

function fromJob(job: AdminJob): FormValues {
  return {
    slug: job.slug,
    organization: job.organization,
    title: job.title,
    positions: job.positions.length
      ? job.positions.map((position) => ({ name: position.name, vacancies: position.vacancies !== undefined ? String(position.vacancies) : '' }))
      : [{ name: '', vacancies: '' }],
    totalVacancies: job.totalVacancies !== undefined ? String(job.totalVacancies) : '',
    categorySlug: job.categorySlug,
    employmentType: job.employmentType ?? '',
    education: job.education ?? '',
    experience: job.experience ?? '',
    ageLimit: job.ageLimit ?? '',
    salary: job.salary ?? '',
    applicationFee: job.applicationFee ?? '',
    applicationStart: job.applicationStart ?? '',
    deadline: job.deadline ?? '',
    publishedAt: job.publishedAt,
    description: job.description ?? '',
    howToApply: job.howToApply ?? '',
    applyUrl: job.applyUrl ?? '',
    sourceUrl: job.sourceUrl ?? '',
    circularRef: job.circularRef ?? '',
    seoTitle: job.seoTitle ?? '',
    metaDescription: job.metaDescription ?? '',
    featuredImage: job.featuredImage ?? '',
    featured: job.featured,
    verified: job.verified,
  };
}

function toPayload(values: FormValues, status?: AdminJobStatus): Record<string, unknown> {
  return {
    ...values,
    positions: values.positions
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), ...(row.vacancies.trim() !== '' ? { vacancies: Number(row.vacancies) } : {}) })),
    ...(status ? { status } : {}),
  };
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

export default function JobFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [job, setJob] = useState<AdminJob | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ kind: 'error' | 'success'; text: string } | null>(
    (location.state as { saved?: boolean } | null)?.saved ? { kind: 'success', text: 'চাকরিটি সংরক্ষিত হয়েছে।' } : null,
  );
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState('');
  const [features, setFeatures] = useState<Features | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useSeo({ title: isEdit ? 'চাকরি সম্পাদনা — অ্যাডমিন' : 'নতুন চাকরি — অ্যাডমিন', description: 'চাকরি ফর্ম', path: '/admin/jobs/form', noindex: true });

  useEffect(() => {
    api<{ categories: CategoryOption[] }>('GET', '/api/admin/categories')
      .then((response) => setCategories(response.categories))
      .catch(() => setBanner({ kind: 'error', text: 'ক্যাটাগরি লোড করা যায়নি। প্রথমে `npm run db:setup` চালিয়েছেন কি?' }));
  }, []);

  useEffect(() => {
    api<Features>('GET', '/api/admin/features')
      .then(setFeatures)
      .catch(() => setFeatures(null));
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    api<{ job: AdminJob }>('GET', `/api/admin/jobs/${id}`)
      .then((response) => {
        if (!active) return;
        setJob(response.job);
        setValues(fromJob(response.job));
        setBaseline(JSON.stringify(fromJob(response.job)));
      })
      .catch((caught: unknown) => active && setBanner({ kind: 'error', text: caught instanceof ApiError ? caught.message : 'চাকরি লোড করা যায়নি।' }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  const text = (key: keyof FormValues) => ({
    id: key,
    value: values[key] as string,
    onChange: (event: { target: { value: string } }) => set(key, event.target.value as never),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  function setPosition(index: number, key: keyof PositionRow, value: string) {
    setValues((current) => ({
      ...current,
      positions: current.positions.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    }));
  }

  async function save(status?: AdminJobStatus) {
    setSaving(true);
    setErrors({});
    setBanner(null);
    try {
      const payload = toPayload(values, status);
      if (isEdit && id) {
        const response = await api<{ job: AdminJob }>('PUT', `/api/admin/jobs/${id}`, payload);
        setJob(response.job);
        setValues(fromJob(response.job));
        setBaseline(JSON.stringify(fromJob(response.job)));
        setBanner({ kind: 'success', text: 'পরিবর্তন সংরক্ষিত হয়েছে।' });
      } else {
        const response = await api<{ job: AdminJob }>('POST', '/api/admin/jobs', payload);
        navigate(`/admin/jobs/${response.job.id}/edit`, { replace: true, state: { saved: true } });
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.details);
        setBanner({ kind: 'error', text: caught.message });
      } else {
        setBanner({ kind: 'error', text: 'সংরক্ষণ করা যায়নি।' });
      }
    } finally {
      setSaving(false);
      window.setTimeout(() => bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }

  async function unpublish() {
    if (!id) return;
    setSaving(true);
    setBanner(null);
    try {
      const response = await api<{ job: AdminJob }>('POST', `/api/admin/jobs/${id}/status`, { status: 'draft' });
      setJob(response.job);
      setBanner({ kind: 'success', text: 'চাকরিটি আনপাবলিশ করে খসড়ায় রাখা হয়েছে।' });
    } catch (caught) {
      setBanner({ kind: 'error', text: caught instanceof ApiError ? caught.message : 'আনপাবলিশ করা যায়নি।' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id) return;
    setSaving(true);
    try {
      await api('DELETE', `/api/admin/jobs/${id}`);
      navigate('/admin/jobs', { replace: true });
    } catch (caught) {
      setConfirmDelete(false);
      setBanner({ kind: 'error', text: caught instanceof ApiError ? caught.message : 'মুছে ফেলা যায়নি।' });
      setSaving(false);
    }
  }

  const previewData = useMemo(() => {
    const positions = values.positions
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), ...(row.vacancies.trim() !== '' && Number.isFinite(Number(row.vacancies)) ? { vacancies: Number(row.vacancies) } : {}) }));
    const listed = positions.filter((position) => position.vacancies !== undefined);
    const total = values.totalVacancies.trim() !== ''
      ? Number(values.totalVacancies)
      : listed.length ? listed.reduce((sum, position) => sum + (position.vacancies ?? 0), 0) : undefined;
    return {
      organization: values.organization,
      title: values.title,
      category: categories.find((item) => item.slug === values.categorySlug)?.name ?? '',
      positions,
      totalVacancies: Number.isFinite(total) ? total : undefined,
      employmentType: values.employmentType,
      education: values.education,
      experience: values.experience,
      ageLimit: values.ageLimit,
      salary: values.salary,
      applicationFee: values.applicationFee,
      applicationStart: values.applicationStart || undefined,
      deadline: values.deadline || undefined,
      publishedAt: values.publishedAt || undefined,
      description: values.description,
      howToApply: values.howToApply,
      applyUrl: values.applyUrl,
      sourceUrl: values.sourceUrl,
      verified: values.verified,
    };
  }, [values, categories]);

  if (loading) return <p className="text-slate-600">লোড হচ্ছে…</p>;

  const isPublished = job?.status === 'published';
  const dirty = isEdit && baseline !== '' && JSON.stringify(values) !== baseline;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm"><Link to="/admin/jobs" className="text-brand-700 hover:underline">← সব চাকরি</Link></p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{isEdit ? 'চাকরি সম্পাদনা' : 'নতুন চাকরি যোগ করুন'}</h1>
        </div>
        {job && <StatusPill status={job.status} deadline={job.deadline} />}
      </div>

      <div ref={bannerRef} aria-live="polite">
        {banner && (
          <div role={banner.kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border p-3 text-sm ${banner.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-accent-100 bg-accent-50 text-accent-700'}`}>
            {banner.text}
            {banner.kind === 'error' && Object.keys(errors).length > 0 && ' (লাল চিহ্নিত ঘরগুলো দেখুন।)'}
          </div>
        )}
      </div>

      {job?.import && <ImportInfoPanel job={job} onChanged={setJob} />}

      <form className="mt-6 space-y-8" onSubmit={(event) => event.preventDefault()} noValidate>
        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">মূল তথ্য</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="প্রতিষ্ঠানের নাম *" htmlFor="organization" error={errors.organization}>
              <input className="input" maxLength={150} {...text('organization')} />
            </Field>
            <Field label="ক্যাটাগরি *" htmlFor="categorySlug" error={errors.categorySlug}>
              <select className="input" {...text('categorySlug')}>
                <option value="">নির্বাচন করুন</option>
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug}>{item.name}</option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  কোনো ক্যাটাগরি নেই। <Link to="/admin/categories" className="font-semibold underline">আগে ক্যাটাগরি যোগ করুন</Link> (অথবা টার্মিনালে <code>npm run db:setup</code> চালান)।
                </p>
              )}
            </Field>
          </div>
          <Field label="চাকরির শিরোনাম *" htmlFor="title" error={errors.title}>
            <input className="input" maxLength={200} {...text('title')} />
          </Field>
          <Field label="URL স্লাগ (ঐচ্ছিক)" htmlFor="slug" error={errors.slug} hint="ইংরেজি ছোট হাতের অক্ষর ও হাইফেন, যেমন: bangladesh-railway-recruitment। খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে। প্রকাশের পর বদলালে পুরোনো লিংক কাজ করবে না।">
            <input className="input" maxLength={100} {...text('slug')} />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="চাকরির ধরন" htmlFor="employmentType" error={errors.employmentType}>
              <input className="input" maxLength={60} placeholder="যেমন: স্থায়ী" {...text('employmentType')} />
            </Field>
            <Field label="মোট পদসংখ্যা" htmlFor="totalVacancies" error={errors.totalVacancies} hint="খালি রাখলে পদগুলোর সংখ্যার যোগফল ব্যবহার হবে।">
              <input className="input" inputMode="numeric" {...text('totalVacancies')} />
            </Field>
            <Field label="অভিজ্ঞতা" htmlFor="experience" error={errors.experience}>
              <input className="input" maxLength={1000} {...text('experience')} />
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">পদের তালিকা</h2>
          {errors.positions && <p role="alert" className="text-xs font-medium text-red-700">{errors.positions}</p>}
          <div className="space-y-3">
            {values.positions.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <div>
                  <label htmlFor={`position-name-${index}`} className="sr-only">পদের নাম {index + 1}</label>
                  <input id={`position-name-${index}`} className="input" placeholder="পদের নাম" maxLength={120} value={row.name} onChange={(e) => setPosition(index, 'name', e.target.value)} />
                </div>
                <div>
                  <label htmlFor={`position-count-${index}`} className="sr-only">পদসংখ্যা {index + 1}</label>
                  <input id={`position-count-${index}`} className="input" inputMode="numeric" placeholder="পদসংখ্যা" value={row.vacancies} onChange={(e) => setPosition(index, 'vacancies', e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => set('positions', values.positions.length > 1 ? values.positions.filter((_, i) => i !== index) : [{ name: '', vacancies: '' }])}
                >
                  সরান
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-outline" disabled={values.positions.length >= 50} onClick={() => set('positions', [...values.positions, { name: '', vacancies: '' }])}>
            + আরেকটি পদ যোগ করুন
          </button>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">যোগ্যতা, বেতন ও ফি</h2>
          <Field label="শিক্ষাগত যোগ্যতা" htmlFor="education" error={errors.education}>
            <textarea className="input min-h-[96px]" maxLength={2000} {...text('education')} />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="বয়সসীমা" htmlFor="ageLimit" error={errors.ageLimit}>
              <input className="input" maxLength={300} {...text('ageLimit')} />
            </Field>
            <Field label="বেতন বা গ্রেড" htmlFor="salary" error={errors.salary}>
              <input className="input" maxLength={500} {...text('salary')} />
            </Field>
            <Field label="আবেদন ফি" htmlFor="applicationFee" error={errors.applicationFee}>
              <input className="input" maxLength={500} {...text('applicationFee')} />
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">তারিখ</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="প্রকাশের তারিখ *" htmlFor="publishedAt" error={errors.publishedAt}>
              <input className="input" type="date" {...text('publishedAt')} />
            </Field>
            <Field label="আবেদন শুরুর তারিখ" htmlFor="applicationStart" error={errors.applicationStart}>
              <input className="input" type="date" {...text('applicationStart')} />
            </Field>
            <Field label="আবেদনের শেষ তারিখ" htmlFor="deadline" error={errors.deadline}>
              <input className="input" type="date" {...text('deadline')} />
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">বিবরণ ও আবেদন পদ্ধতি</h2>
          <Field label="বিস্তারিত বিবরণ" htmlFor="description" error={errors.description} hint="সাধারণ টেক্সট। HTML ট্যাগ ব্যবহার করলে তা টেক্সট হিসেবেই দেখানো হবে।">
            <textarea className="input min-h-[160px]" maxLength={20000} {...text('description')} />
          </Field>
          <Field label="আবেদন পদ্ধতি" htmlFor="howToApply" error={errors.howToApply}>
            <textarea className="input min-h-[120px]" maxLength={10000} {...text('howToApply')} />
          </Field>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">অফিসিয়াল লিংক ও সূত্র</h2>
          <p className="text-sm text-slate-600">প্রকাশ করতে অন্তত একটি অফিসিয়াল সূত্র (আবেদন লিংক, বিজ্ঞপ্তির উৎস বা সার্কুলার URL) দিতে হবে। যে লিংক যাচাই করেননি তা দেবেন না।</p>
          <Field label="অফিসিয়াল আবেদন লিংক" htmlFor="applyUrl" error={errors.applyUrl}>
            <input className="input" type="url" maxLength={2000} placeholder="https://" {...text('applyUrl')} />
          </Field>
          <Field label="অফিসিয়াল বিজ্ঞপ্তির উৎস" htmlFor="sourceUrl" error={errors.sourceUrl}>
            <input className="input" type="url" maxLength={2000} placeholder="https://" {...text('sourceUrl')} />
          </Field>
          <Field label="সার্কুলার PDF বা ছবির URL" htmlFor="circularRef" error={errors.circularRef} hint={features?.uploads ? 'বৈধ URL দিন অথবা নিচের বোতামে ফাইল আপলোড করুন (PDF/ছবি, সর্বোচ্চ ১০ MB)।' : 'বৈধ URL রেফারেন্স দিন। (ফাইল আপলোড চালু করতে Cloudinary সেটিং লাগে — DEPLOYMENT.md দেখুন।)'}>
            <input className="input" type="url" maxLength={2000} placeholder="https://" {...text('circularRef')} />
            {features?.uploads && <FileUpload kind="document" onUploaded={(url) => set('circularRef', url)} />}
          </Field>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4" checked={values.verified} onChange={(e) => set('verified', e.target.checked)} />
              অফিসিয়াল বিজ্ঞপ্তির সাথে যাচাই করেছি
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4" checked={values.featured} onChange={(e) => set('featured', e.target.checked)} />
              ফিচার্ড চাকরি
            </label>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">SEO</h2>
          <Field label="SEO title" htmlFor="seoTitle" error={errors.seoTitle}>
            <input className="input" maxLength={120} {...text('seoTitle')} />
          </Field>
          <Field label="Meta description" htmlFor="metaDescription" error={errors.metaDescription}>
            <textarea className="input min-h-[72px]" maxLength={300} {...text('metaDescription')} />
          </Field>
          <Field label="Featured image URL" htmlFor="featuredImage" error={errors.featuredImage} hint={features?.uploads ? 'URL দিন অথবা ছবি আপলোড করুন (JPG/PNG/WebP, সর্বোচ্চ ৫ MB)।' : undefined}>
            <input className="input" type="url" maxLength={2000} placeholder="https://" {...text('featuredImage')} />
            {features?.uploads && <FileUpload kind="image" onUploaded={(url) => set('featuredImage', url)} />}
          </Field>
        </section>

        {errors.status && <p role="alert" className="text-sm font-medium text-red-700">{errors.status}</p>}

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? 'প্রিভিউ লুকান' : 'প্রিভিউ দেখুন'}
          </button>
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => save(isPublished ? 'published' : 'draft')}>
            {saving ? 'সংরক্ষণ হচ্ছে…' : isPublished ? 'পরিবর্তন সংরক্ষণ' : 'খসড়া সংরক্ষণ'}
          </button>
          {!isPublished && (
            <button type="button" className="btn btn-outline" disabled={saving} onClick={() => save('pending_review')}>রিভিউয়ের জন্য রাখুন</button>
          )}
          {isPublished ? (
            <button type="button" className="btn btn-outline" disabled={saving} onClick={unpublish}>আনপাবলিশ</button>
          ) : (
            <button type="button" className="btn btn-accent" disabled={saving} onClick={() => save('published')}>প্রকাশ করুন</button>
          )}
          {isEdit && (
            <button type="button" className="btn btn-outline ml-auto !text-red-700" disabled={saving} onClick={() => setConfirmDelete(true)}>মুছুন</button>
          )}
        </div>
      </form>

      {isEdit && job && <JobScriptsPanel jobId={job.id} dirty={dirty} />}

      {showPreview && (
        <div className="mt-8">
          <JobPreview data={previewData} />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="চাকরি মুছে ফেলবেন?"
        message="এই চাকরি স্থায়ীভাবে মুছে যাবে। এই কাজ আর ফেরানো যাবে না।"
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        busy={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
