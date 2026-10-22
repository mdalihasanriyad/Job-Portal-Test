import { useEffect } from 'react';
import { SITE } from '../config/site';

interface SeoOptions {
  title: string;
  description: string;
  /** Path beginning with "/", used to build the canonical URL. */
  path: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  /** Use the title as-is, without appending the site name. */
  rawTitle?: boolean;
  /** Absolute image URL for social previews (defaults to the site image). */
  image?: string;
  /** 'noindex, follow' style override for pages that should stay out of the index. */
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/**
 * Updates document title and meta tags on the client.
 * NOTE: this only helps crawlers that execute JavaScript. Full pre-rendering for
 * job pages is planned for Phase 5.
 */
export function useSeo({ title, description, path, type = 'website', noindex = false, rawTitle = false, image }: SeoOptions): void {
  useEffect(() => {
    const fullTitle = rawTitle ? title : `${title} | ${SITE.name}`;
    const url = `${SITE.url}${path}`;
    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:site_name', SITE.name);
    upsertMeta('property', 'og:locale', SITE.locale);
    upsertMeta('property', 'og:image', image ?? SITE.defaultImage);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertCanonical(url);

    // The server injects JSON-LD for the page that was loaded directly. Remove it once the
    // visitor navigates (client-side) to a different page so stale data never lingers.
    document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"][data-ssr]').forEach((node) => {
      const owner = node.getAttribute('data-ssr');
      if (owner !== null && owner !== path && owner !== '/') node.remove();
    });
  }, [title, description, path, type, noindex, rawTitle, image]);
}
