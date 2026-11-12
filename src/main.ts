import '@fontsource-variable/archivo/wdth.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { applyTheme, loadTheme } from './lib/theme';

applyTheme(loadTheme());

mount(App, { target: document.getElementById('app')! });

// Keeps the app shell available offline. Service workers need HTTPS, so plain-HTTP access skips this.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
