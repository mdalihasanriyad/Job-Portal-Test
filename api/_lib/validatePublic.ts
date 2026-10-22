import { cleanString, type ParseResult } from './validate.js';

const URL_PATTERN = /(https?:\/\/|www\.)/gi;

function countLinks(text: string): number {
  return (text.match(URL_PATTERN) ?? []).length;
}

function asRecord(body: unknown): Record<string, unknown> | null {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export interface CommentInput {
  name: string;
  comment: string;
  /** True when the hidden "website" field was filled in (bots). */
  honeypot: boolean;
}

export function parseComment(body: unknown): ParseResult<CommentInput> {
  const raw = asRecord(body);
  if (!raw) return { ok: false, errors: { _form: 'অনুরোধের তথ্য সঠিক নয়।' } };
  const errors: Record<string, string> = {};

  const name = cleanString(raw.name, false);
  if (name.length < 2) errors.name = 'নাম কমপক্ষে ২ অক্ষরের হতে হবে।';
  else if (name.length > 60) errors.name = 'নাম সর্বোচ্চ ৬০ অক্ষরের হতে পারবে।';

  const comment = cleanString(raw.comment, true);
  if (comment.length < 5) errors.comment = 'মন্তব্য কমপক্ষে ৫ অক্ষরের হতে হবে।';
  else if (comment.length > 1000) errors.comment = 'মন্তব্য সর্বোচ্চ ১০০০ অক্ষরের হতে পারবে।';
  else if (countLinks(comment) > 1 || countLinks(name) > 0) errors.comment = 'মন্তব্যে একাধিক লিংক দেওয়া যাবে না।';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, comment, honeypot: cleanString(raw.website, false) !== '' } };
}

export interface ContactInput {
  name: string;
  email?: string;
  subject: string;
  message: string;
  honeypot: boolean;
}

export function parseContact(body: unknown): ParseResult<ContactInput> {
  const raw = asRecord(body);
  if (!raw) return { ok: false, errors: { _form: 'অনুরোধের তথ্য সঠিক নয়।' } };
  const errors: Record<string, string> = {};

  const name = cleanString(raw.name, false);
  if (name.length < 2) errors.name = 'নাম কমপক্ষে ২ অক্ষরের হতে হবে।';
  else if (name.length > 80) errors.name = 'নাম সর্বোচ্চ ৮০ অক্ষরের হতে পারবে।';

  let email: string | undefined = cleanString(raw.email, false).toLowerCase();
  if (!email) email = undefined;
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'ইমেইল ঠিকানাটি সঠিক নয়।';

  const subject = cleanString(raw.subject, false);
  if (subject.length < 3) errors.subject = 'বিষয় কমপক্ষে ৩ অক্ষরের হতে হবে।';
  else if (subject.length > 150) errors.subject = 'বিষয় সর্বোচ্চ ১৫০ অক্ষরের হতে পারবে।';

  const message = cleanString(raw.message, true);
  if (message.length < 10) errors.message = 'বার্তা কমপক্ষে ১০ অক্ষরের হতে হবে।';
  else if (message.length > 3000) errors.message = 'বার্তা সর্বোচ্চ ৩০০০ অক্ষরের হতে পারবে।';
  else if (countLinks(message) > 3) errors.message = 'বার্তায় তিনটির বেশি লিংক দেওয়া যাবে না।';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, subject, message, honeypot: cleanString(raw.website, false) !== '' } };
}
