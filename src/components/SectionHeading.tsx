import { Link } from 'react-router-dom';

interface Props {
  title: string;
  subtitle?: string;
  moreTo?: string;
  moreLabel?: string;
}

export default function SectionHeading({ title, subtitle, moreTo, moreLabel = 'সব দেখুন' }: Props) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {moreTo && (
        <Link to={moreTo} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">
          {moreLabel} →
        </Link>
      )}
    </div>
  );
}
