import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { SITE } from '../config/site';

const links = [
  { to: '/', label: 'হোম', end: true },
  { to: '/jobs', label: 'সব চাকরি' },
  { to: '/latest-jobs', label: 'সর্বশেষ' },
  { to: '/closing-soon', label: 'শীঘ্রই শেষ' },
  { to: '/expired-jobs', label: 'মেয়াদোত্তীর্ণ' },
  { to: '/categories', label: 'ক্যাটাগরি' },
  { to: '/organizations', label: 'প্রতিষ্ঠান' },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100',
  ].join(' ');
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2" aria-label={`${SITE.name} — হোম`}>
          <img src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="text-xl font-bold text-brand-800">
            Govt<span className="text-accent-600">Job</span>.bd
          </span>
        </Link>

        <nav aria-label="প্রধান নেভিগেশন" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/search" className="btn btn-outline hidden sm:inline-flex">
            খুঁজুন
          </Link>
          <button
            type="button"
            className="btn btn-outline lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'বন্ধ করুন' : 'মেনু'}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="মোবাইল নেভিগেশন" className="border-t border-slate-200 bg-white lg:hidden">
          <ul className="container-page flex flex-col gap-1 py-3">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className={(state) => `block ${navClass(state)}`}>
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li>
              <NavLink to="/search" className={(state) => `block ${navClass(state)}`}>
                খুঁজুন
              </NavLink>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
