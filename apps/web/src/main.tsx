import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useStore } from './state/store';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('Root element #root not found');

// Deterministic data source for e2e runs and offline demos.
const params = new URLSearchParams(window.location.search);
if (params.get('src') === 'demo') {
  useStore.setState({
    providerBySymbol: {
      'BTC/USDT': 'demo',
      'XAU/USD': 'demo',
      'XAUT/USDT': 'demo',
    },
  });
}

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: register the service worker and prompt on updates
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              // custom event consumed by the app to show an update toast
              window.dispatchEvent(new CustomEvent('trade:update-available'));
            }
          });
        });
      })
      .catch(() => undefined);
  });

  window.addEventListener('trade:update-available', () => {
    const toast = document.createElement('div');
    toast.className = 'pwa-update-toast';
    toast.innerHTML = '<span>Update available</span><button type="button">Reload</button>';
    toast.querySelector('button')?.addEventListener('click', () => window.location.reload());
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 30000);
  });
}
