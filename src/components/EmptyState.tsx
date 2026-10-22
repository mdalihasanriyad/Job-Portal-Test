import type { ReactNode } from 'react';

interface Props {
  title: string;
  text?: string;
  children?: ReactNode;
}

export default function EmptyState({ title, text, children }: Props) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="text-lg font-semibold text-slate-800">{title}</p>
      {text && <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
