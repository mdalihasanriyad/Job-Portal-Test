import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { loadFonts } from './lib/loadFonts';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// After a new deployment, an open tab may request a code chunk that no longer exists.
// Reload once to pick up the new build (guarded so it can never loop).
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem('chunk-reload') === '1') return;
    sessionStorage.setItem('chunk-reload', '1');
  } catch {
    /* storage unavailable: still reload once below */
  }
  window.location.reload();
});

loadFonts();

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
