export default function Loading({ label = 'লোড হচ্ছে…' }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-slate-500">
      {label}
    </p>
  );
}
