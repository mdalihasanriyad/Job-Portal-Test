import { FormEvent, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import { PublicApiError, request } from '../lib/publicApi';
import { useSeo } from '../lib/seo';

interface ShellProps {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
}

function PageShell({ title, description, path, children }: ShellProps) {
  useSeo({ title, description, path });
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'হোম', to: '/' }, { label: title }]} />
      <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
      <div className="mt-6 max-w-3xl space-y-4 text-slate-700">{children}</div>
    </div>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-4 text-lg font-bold text-slate-900">{children}</h2>;
}

export function AboutPage() {
  return (
    <PageShell title="আমাদের সম্পর্কে" description="GovtJob.bd সম্পর্কে জানুন — বাংলাদেশের সরকারি চাকরির বিজ্ঞপ্তি সহজে খুঁজে পাওয়ার একটি তথ্য ওয়েবসাইট।" path="/about">
      <p>
        GovtJob.bd বাংলাদেশের সরকারি চাকরি প্রার্থীদের জন্য তৈরি একটি তথ্যভিত্তিক ওয়েবসাইট। আমাদের লক্ষ্য হলো সরকারি চাকরির বিজ্ঞপ্তি, আবেদনের শেষ তারিখ ও আবেদন পদ্ধতি সহজ বাংলায় এক জায়গায় তুলে ধরা।
      </p>
      <H2>আমরা কী করি</H2>
      <p>আমরা অফিসিয়াল সূত্র থেকে পাওয়া তথ্য গুছিয়ে উপস্থাপন করি এবং প্রতিটি বিজ্ঞপ্তিতে অফিসিয়াল আবেদন ও উৎসের লিংক দেওয়ার চেষ্টা করি।</p>
      <H2>আমরা কী নই</H2>
      <p>GovtJob.bd কোনো সরকারি প্রতিষ্ঠান নয় এবং কোনো নিয়োগ প্রক্রিয়ার সাথে সরাসরি যুক্ত নয়। আবেদনের আগে অবশ্যই অফিসিয়াল বিজ্ঞপ্তি যাচাই করুন।</p>
    </PageShell>
  );
}

export function ContactPage() {
  const [values, setValues] = useState({ name: '', email: '', subject: '', message: '' });
  const [website, setWebsite] = useState(''); // honeypot: hidden from real visitors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const field = (key: keyof typeof values) => ({
    id: `contact-${key}`,
    value: values[key],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value })),
    'aria-invalid': errors[key] ? true : undefined,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setStatus(null);
    try {
      const response = await request<{ message: string }>('POST', '/api/public/contact', { ...values, website });
      setStatus({ kind: 'ok', text: response.message });
      setValues({ name: '', email: '', subject: '', message: '' });
    } catch (caught) {
      if (caught instanceof PublicApiError) {
        setErrors(caught.details);
        setStatus({ kind: 'error', text: caught.message });
      } else {
        setStatus({ kind: 'error', text: 'বার্তা পাঠানো যায়নি।' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const error = (key: string) => errors[key] && <p className="mt-1 text-xs font-medium text-red-700">{errors[key]}</p>;

  return (
    <PageShell title="যোগাযোগ" description="GovtJob.bd-এর সাথে যোগাযোগ করুন — প্রশ্ন, ভুল তথ্যের রিপোর্ট বা পরামর্শ পাঠান।" path="/contact">
      <p>কোনো বিজ্ঞপ্তিতে ভুল তথ্য পেলে বা পরামর্শ থাকলে নিচের ফর্মে জানান। ইমেইল দিলে প্রয়োজনে আমরা উত্তর দিতে পারব।</p>
      <form onSubmit={handleSubmit} className="card space-y-4 p-5" noValidate>
        <div aria-live="polite">
          {status && (
            <div role={status.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${status.kind === 'ok' ? 'border-accent-100 bg-accent-50 text-accent-700' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {status.text}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-slate-700">নাম *</label>
          <input className="input" maxLength={80} autoComplete="name" {...field('name')} />
          {error('name')}
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-slate-700">ইমেইল (ঐচ্ছিক)</label>
          <input className="input" type="email" maxLength={254} autoComplete="email" {...field('email')} />
          {error('email')}
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-1 block text-sm font-medium text-slate-700">বিষয় *</label>
          <input className="input" maxLength={150} {...field('subject')} />
          {error('subject')}
        </div>
        <div>
          <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-slate-700">বার্তা *</label>
          <textarea className="input min-h-[140px]" maxLength={3000} {...field('message')} />
          {error('message')}
        </div>
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="contact-website">ওয়েবসাইট (এটি খালি রাখুন)</label>
          <input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'পাঠানো হচ্ছে…' : 'বার্তা পাঠান'}
        </button>
      </form>
    </PageShell>
  );
}

export function PrivacyPage() {
  return (
    <PageShell title="গোপনীয়তা নীতি" description="GovtJob.bd কীভাবে ব্যবহারকারীর তথ্য সংগ্রহ ও ব্যবহার করে তা জানুন।" path="/privacy-policy">
      <p>এই নীতি ব্যাখ্যা করে GovtJob.bd ব্যবহারের সময় কোন তথ্য সংগ্রহ হতে পারে এবং তা কীভাবে ব্যবহার করা হয়।</p>
      <H2>সংগৃহীত তথ্য</H2>
      <p>আপনি যোগাযোগ ফর্ম বা মন্তব্য ফর্ম ব্যবহার করলে আপনার দেওয়া নাম, ইমেইল (ঐচ্ছিক) ও বার্তা আমাদের ডেটাবেসে সংরক্ষিত হয়। আমরা এই তথ্য শুধু বার্তার উত্তর দেওয়া ও মন্তব্য যাচাইয়ের কাজে ব্যবহার করি। অনুমোদিত মন্তব্যে আপনার নাম ও মন্তব্য সবার জন্য দৃশ্যমান হয়; ইমেইল প্রকাশ করা হয় না। অপব্যবহার ঠেকাতে অনুরোধের হার সীমিত করা হয়।</p>
      <H2>পেজ ভিউ গণনা</H2>
      <p>চাকরির পেজ কতবার দেখা হয়েছে তা আমরা নিজস্বভাবে গণনা করি। এতে কুকি ব্যবহার হয় না এবং আপনার আইপি ঠিকানা, ব্রাউজার বা পরিচয় সংরক্ষিত হয় না; শুধু প্রতিদিনের মোট সংখ্যা রাখা হয়।</p>
      <H2>তৃতীয় পক্ষের সেবা</H2>
      <p>ফন্ট লোড করতে আমরা Google Fonts ব্যবহার করি। চাকরির ছবি বা সার্কুলার ফাইল প্রয়োজনে Cloudinary-তে সংরক্ষিত থাকতে পারে। ভবিষ্যতে বিজ্ঞাপন বা অন্য কোনো বিশ্লেষণ সেবা যুক্ত হলে এই নীতি হালনাগাদ করা হবে।</p>
      <H2>নীতি পরিবর্তন</H2>
      <p>প্রয়োজন অনুযায়ী এই নীতি পরিবর্তন করা হতে পারে। পরিবর্তিত নীতি এই পেজে প্রকাশ করা হবে।</p>
    </PageShell>
  );
}

export function TermsPage() {
  return (
    <PageShell title="শর্তাবলি" description="GovtJob.bd ব্যবহারের শর্তাবলি।" path="/terms">
      <p>এই ওয়েবসাইট ব্যবহার করলে আপনি নিচের শর্তগুলো মেনে নিচ্ছেন বলে ধরা হবে।</p>
      <H2>তথ্যের ব্যবহার</H2>
      <p>ওয়েবসাইটের তথ্য শুধু সাধারণ জ্ঞাতার্থে দেওয়া হয়। কোনো সিদ্ধান্ত নেওয়ার আগে অফিসিয়াল বিজ্ঞপ্তি যাচাই করা ব্যবহারকারীর দায়িত্ব।</p>
      <H2>বিষয়বস্তুর অনুমতি</H2>
      <p>অনুমতি ছাড়া এই ওয়েবসাইটের বিষয়বস্তু বাণিজ্যিক উদ্দেশ্যে অনুলিপি বা পুনঃপ্রকাশ করা যাবে না।</p>
      <H2>বাহ্যিক লিংক</H2>
      <p>অফিসিয়াল আবেদন বা উৎসের লিংকগুলো তৃতীয় পক্ষের ওয়েবসাইটে নিয়ে যায়। সেসব সাইটের বিষয়বস্তুর জন্য আমরা দায়ী নই।</p>
    </PageShell>
  );
}

export function DisclaimerPage() {
  return (
    <PageShell title="দায় অস্বীকার" description="GovtJob.bd-এর তথ্যের নির্ভুলতা ও দায়বদ্ধতা সম্পর্কিত বিবৃতি।" path="/disclaimer">
      <p>GovtJob.bd একটি স্বাধীন তথ্য ওয়েবসাইট। এটি কোনো সরকারি প্রতিষ্ঠানের অফিসিয়াল ওয়েবসাইট নয়।</p>
      <p>আমরা তথ্য সঠিক রাখার চেষ্টা করি, তবুও ভুল বা পুরোনো তথ্য থাকতে পারে। আবেদনের আগে অফিসিয়াল বিজ্ঞপ্তির সাথে সব তথ্য, বিশেষ করে যোগ্যতা, বয়সসীমা, ফি ও শেষ তারিখ মিলিয়ে নিন।</p>
      <p>এই ওয়েবসাইটের তথ্যের ভিত্তিতে নেওয়া কোনো সিদ্ধান্তের জন্য GovtJob.bd দায়ী থাকবে না।</p>
    </PageShell>
  );
}
