import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize theme early to avoid flash: fetch from backend, fallback to system preference
(async () => {
  try {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';
    let theme: 'dark' | 'light' = 'dark';
    try {
      const res = await fetch(`${API_BASE}/system_settings`);
      if (res.ok) {
        const json = await res.json();
        const data = json?.data ?? json;
        if (data?.theme === 'light' || data?.theme === 'dark') theme = data.theme;
      }
    } catch {}
    if (theme === 'dark' && window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // keep dark as default
    }
    const rootEl = document.documentElement;
    rootEl.classList.remove('light', 'dark');
    rootEl.classList.add(theme);
  } catch {}
})();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);