import { useState } from 'react';
import { SITE } from '../config/site';

export default function ShareButtons({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE.url}${path}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('লিংকটি কপি করুন:', url);
    }
  }

  const linkClass = 'btn btn-outline !px-3 !py-1.5';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-600">শেয়ার করুন:</span>
      <a className={linkClass} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}>
        ফেসবুক
      </a>
      <a className={linkClass} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}>
        হোয়াটসঅ্যাপ
      </a>
      <a className={linkClass} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}>
        এক্স
      </a>
      <button type="button" className={linkClass} onClick={copyLink} aria-live="polite">
        {copied ? 'কপি হয়েছে ✓' : 'লিংক কপি'}
      </button>
    </div>
  );
}
