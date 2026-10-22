import { Link } from 'react-router-dom';
import { SITE } from '../config/site';
import { useFetch } from '../lib/publicApi';
import type { Category } from '../types/job';

export default function Footer() {
  const { data } = useFetch<{ categories: Category[] }>('/api/public/categories');
  const categories = data?.categories.slice(0, 5) ?? [];
  const year = new Intl.NumberFormat('bn-BD', { useGrouping: false }).format(new Date().getFullYear());
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-brand-800">
            Govt<span className="text-accent-600">Job</span>.bd
          </p>
          <p className="mt-2 text-sm text-slate-600">{SITE.tagline}। আবেদনের আগে সবসময় অফিসিয়াল বিজ্ঞপ্তি যাচাই করুন।</p>
        </div>

        <nav aria-label="দ্রুত লিংক">
          <h2 className="text-sm font-semibold text-slate-900">দ্রুত লিংক</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/jobs">সব সরকারি চাকরি</Link></li>
            <li><Link className="hover:text-brand-700" to="/latest-jobs">সর্বশেষ বিজ্ঞপ্তি</Link></li>
            <li><Link className="hover:text-brand-700" to="/closing-soon">শেষ তারিখ ঘনিয়ে আসছে</Link></li>
            <li><Link className="hover:text-brand-700" to="/expired-jobs">মেয়াদোত্তীর্ণ বিজ্ঞপ্তি</Link></li>
            <li><Link className="hover:text-brand-700" to="/organizations">প্রতিষ্ঠান</Link></li>
          </ul>
        </nav>

        <nav aria-label="ক্যাটাগরি">
          <h2 className="text-sm font-semibold text-slate-900">ক্যাটাগরি</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link className="hover:text-brand-700" to={`/category/${category.slug}`}>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="তথ্য">
          <h2 className="text-sm font-semibold text-slate-900">আমাদের সম্পর্কে</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/about">আমাদের সম্পর্কে</Link></li>
            <li><Link className="hover:text-brand-700" to="/contact">যোগাযোগ</Link></li>
            <li><Link className="hover:text-brand-700" to="/privacy-policy">গোপনীয়তা নীতি</Link></li>
            <li><Link className="hover:text-brand-700" to="/terms">শর্তাবলি</Link></li>
            <li><Link className="hover:text-brand-700" to="/disclaimer">দায় অস্বীকার</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {year} {SITE.name}। এটি একটি স্বাধীন তথ্য ওয়েবসাইট; কোনো সরকারি প্রতিষ্ঠানের অফিসিয়াল সাইট নয়।
      </div>
    </footer>
  );
}
