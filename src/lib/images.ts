/**
 * Delivery optimisation for images stored on Cloudinary (see Phase 7 uploads).
 * Adds automatic format + quality and a maximum width. Other hosts are returned unchanged.
 */
export function optimizeImage(url: string, width = 1200): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'res.cloudinary.com') return url;
    const marker = '/image/upload/';
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return url;
    const rest = parsed.pathname.slice(index + marker.length);
    // Only insert when the URL has no transformation yet (the next segment is the version, e.g. v1712345678)
    if (!/^v\d+\//.test(rest)) return url;
    parsed.pathname = `${parsed.pathname.slice(0, index + marker.length)}f_auto,q_auto,w_${width},c_limit/${rest}`;
    return parsed.href;
  } catch {
    return url;
  }
}
