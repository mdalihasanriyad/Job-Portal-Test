const FONT_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap';

/** Loads the Bengali web font without blocking first paint (and without inline event handlers). */
export function loadFonts(): void {
  if (document.querySelector('link[data-font="noto-bengali"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_URL;
  link.dataset.font = 'noto-bengali';
  document.head.appendChild(link);
}
