import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { useSeo } from '../lib/seo';

export default function NotFoundPage() {
  useSeo({
    title: 'পেজটি পাওয়া যায়নি',
    description: 'আপনি যে পেজটি খুঁজছেন তা পাওয়া যায়নি।',
    path: '/404',
    noindex: true,
  });
  return (
    <div className="container-page py-20 text-center">
      <p className="text-6xl font-bold text-brand-700">৪০৪</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">পেজটি পাওয়া যায়নি</h1>
      <p className="mt-2 text-slate-600">লিংকটি ভুল হতে পারে অথবা বিজ্ঞপ্তিটি সরিয়ে নেওয়া হয়েছে।</p>
      <div className="mx-auto mt-6 max-w-md">
        <SearchBar />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary">হোমে ফিরে যান</Link>
        <Link to="/jobs" className="btn btn-outline">সব চাকরি দেখুন</Link>
      </div>
    </div>
  );
}
