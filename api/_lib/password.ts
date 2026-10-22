import bcrypt from 'bcryptjs';

const COST = 12;
export const MAX_PASSWORD_BYTES = 72; // bcrypt only uses the first 72 bytes

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

let dummyHash: Promise<string> | undefined;

/** Constant-ish time: compares against a dummy hash when the account does not exist. */
export async function verifyPassword(password: string, hash: string | undefined): Promise<boolean> {
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) return false;
  if (!hash) {
    dummyHash ??= bcrypt.hash('not-a-real-password', COST);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

/** Returns an error message (Bengali) or null when the password is acceptable. */
export function checkPasswordStrength(password: string, email: string): string | null {
  if (password.length < 12) return 'পাসওয়ার্ড কমপক্ষে ১২ অক্ষরের হতে হবে।';
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) return 'পাসওয়ার্ড ৭২ বাইটের বেশি হতে পারবে না।';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'পাসওয়ার্ডে অন্তত একটি ইংরেজি অক্ষর ও একটি সংখ্যা থাকতে হবে।';
  if (password.toLowerCase() === email.toLowerCase()) return 'পাসওয়ার্ড ইমেইলের সমান হতে পারবে না।';
  return null;
}
