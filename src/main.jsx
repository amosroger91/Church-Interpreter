import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startUpdates } from './lib/pwa.js';
import App from './App.jsx';
import './App.css';

// Service worker: caches the app so it opens with no internet connection,
// and installs new versions (see lib/pwa.js).
startUpdates();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
