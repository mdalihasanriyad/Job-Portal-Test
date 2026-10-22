import { useRef, useState } from 'react';
import { ApiError, api } from './api';

interface SignResponse {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
  maxBytes: number;
}

interface Props {
  kind: 'image' | 'document';
  onUploaded: (url: string) => void;
}

const ALLOWED: Record<Props['kind'], string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  document: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
};

/** Uploads straight from the browser to Cloudinary using a short-lived signature from our server. */
export default function FileUpload({ kind, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; text: string }>({ kind: 'idle', text: '' });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED[kind].includes(file.type)) {
      setStatus({ kind: 'error', text: kind === 'image' ? 'শুধু JPG, PNG বা WebP ছবি দিন।' : 'শুধু PDF, JPG, PNG বা WebP ফাইল দিন।' });
      return;
    }
    setStatus({ kind: 'busy', text: 'আপলোড হচ্ছে…' });
    try {
      const sign = await api<SignResponse>('POST', '/api/admin/uploads/sign', { kind });
      if (file.size > sign.maxBytes) {
        setStatus({ kind: 'error', text: `ফাইল অনেক বড়। সর্বোচ্চ ${Math.round(sign.maxBytes / 1024 / 1024)} MB।` });
        return;
      }
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sign.apiKey);
      form.append('timestamp', String(sign.timestamp));
      form.append('signature', sign.signature);
      form.append('folder', sign.folder);
      form.append('allowed_formats', sign.allowedFormats);

      const response = await fetch(sign.uploadUrl, { method: 'POST', body: form });
      const data = (await response.json()) as { secure_url?: string; error?: { message?: string } };
      if (!response.ok || !data.secure_url || !data.secure_url.startsWith('https://res.cloudinary.com/')) {
        setStatus({ kind: 'error', text: 'আপলোড ব্যর্থ হয়েছে। ফাইলের ধরন/আকার পরীক্ষা করুন।' });
        return;
      }
      onUploaded(data.secure_url);
      setStatus({ kind: 'ok', text: 'আপলোড সম্পন্ন; URL বসানো হয়েছে। চাকরিটি সংরক্ষণ করুন।' });
    } catch (caught) {
      setStatus({ kind: 'error', text: caught instanceof ApiError ? caught.message : 'আপলোড করা যায়নি।' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        id={`upload-${kind}`}
        accept={ALLOWED[kind].join(',')}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <label htmlFor={`upload-${kind}`} className={`btn btn-outline !py-1.5 cursor-pointer ${status.kind === 'busy' ? 'pointer-events-none opacity-60' : ''}`}>
        {kind === 'image' ? 'ছবি আপলোড করুন' : 'ফাইল আপলোড করুন'}
      </label>
      <span role="status" aria-live="polite" className={`ml-3 text-xs ${status.kind === 'error' ? 'font-medium text-red-700' : 'text-slate-600'}`}>
        {status.text}
      </span>
    </div>
  );
}
