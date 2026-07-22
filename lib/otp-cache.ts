/**
 * In-memory OTP store.
 * Pinned to globalThis so Next.js hot-reloads don't clear pending verifications.
 */

interface OtpEntry {
  code: string;
  expiresAt: number; // ms since epoch
  verified: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __otpCache: Map<string, OtpEntry> | undefined;
}

export const otpCache: Map<string, OtpEntry> =
  globalThis.__otpCache ?? (globalThis.__otpCache = new Map());

export function setOtp(phone: string, code: string, ttlMs = 10 * 60 * 1000): void {
  otpCache.set(phone, { code, expiresAt: Date.now() + ttlMs, verified: false });
}

export function markVerified(phone: string): boolean {
  const entry = otpCache.get(phone);
  if (!entry) return false;
  entry.verified = true;
  return true;
}

export function getOtp(phone: string): OtpEntry | undefined {
  return otpCache.get(phone);
}

export function deleteOtp(phone: string): void {
  otpCache.delete(phone);
}

export function isVerified(phone: string): boolean {
  const entry = otpCache.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpCache.delete(phone);
    return false;
  }
  return entry.verified;
}
