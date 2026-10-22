import { createHash } from 'node:crypto';
import { HttpError } from './http.js';

/**
 * Optional external file storage using Cloudinary signed uploads.
 * Files go from the admin's browser straight to Cloudinary (nothing is stored on Vercel).
 * Disabled unless CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are set.
 */

export type UploadKind = 'image' | 'document';

const FORMATS: Record<UploadKind, { formats: string; folder: string; maxBytes: number }> = {
  image: { formats: 'jpg,jpeg,png,webp', folder: 'govtjob/images', maxBytes: 5 * 1024 * 1024 },
  document: { formats: 'pdf,jpg,jpeg,png,webp', folder: 'govtjob/circulars', maxBytes: 10 * 1024 * 1024 },
};

function config(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(cloudName) || !/^\d{6,20}$/.test(apiKey)) return null;
  return { cloudName, apiKey, apiSecret };
}

export function uploadsEnabled(): boolean {
  return config() !== null;
}

export function signUpload(kind: unknown): Record<string, unknown> {
  const settings = kind === 'image' || kind === 'document' ? FORMATS[kind] : null;
  if (!settings) throw new HttpError(422, 'validation', 'ফাইলের ধরন সঠিক নয়।');
  const cfg = config();
  if (!cfg) throw new HttpError(501, 'not_configured', 'ফাইল আপলোড এখনো চালু করা হয়নি (Cloudinary সেটিং নেই)। URL দিয়ে কাজ চালান।');

  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signature: SHA-1 of "key=value&..." (keys sorted alphabetically, file/api_key/resource_type excluded) + API secret
  const toSign = `allowed_formats=${settings.formats}&folder=${settings.folder}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(`${toSign}${cfg.apiSecret}`).digest('hex');
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/auto/upload`,
    apiKey: cfg.apiKey,
    timestamp,
    signature,
    folder: settings.folder,
    allowedFormats: settings.formats,
    maxBytes: settings.maxBytes,
  };
}
