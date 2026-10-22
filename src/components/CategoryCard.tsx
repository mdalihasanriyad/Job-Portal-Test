import { Link } from 'react-router-dom';
import type { Category } from '../types/job';
import { formatNumber } from '../lib/format';

export default function CategoryCard({ category }: { category: Category }) {
  return (
    <Link to={`/category/${category.slug}`} className="card block p-5 transition-shadow hover:shadow-md">
      <h3 className="font-bold text-slate-900">{category.name}</h3>
      <p className="mt-1 text-sm text-slate-600">{category.description}</p>
      <p className="mt-3 text-sm font-semibold text-accent-700">{formatNumber(category.count ?? 0)}টি বিজ্ঞপ্তি</p>
    </Link>
  );
}
