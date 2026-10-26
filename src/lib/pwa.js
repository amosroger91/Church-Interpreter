// Keeps the installed (offline) copy of the app up to date. The service
// worker serves the saved copy first; when a new release is published, the
// new worker downloads it and takes over right away. We check for one on
// start, every minute and whenever the app comes back to the foreground,
// then reload into the new version, unless someone is interpreting: then it
// waits until they stop (a reload would cut off the microphone).

let updateReady = false;
const listeners = new Set();

export function startUpdates() {
  if (!('serviceWorker' in navigator)) return;
  // On the very first visit there is no previous version to replace.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || updateReady) return;
    updateReady = true;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('load', async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
      const check = () => {
        if (navigator.onLine !== false) registration.update().catch(() => {});
      };
      setInterval(check, 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    } catch {
      // Service workers unavailable (e.g. private mode); the app still works online.
    }
  });
}

/** Call `fn` when a new version has taken over and the page can reload. */
export function onUpdateReady(fn) {
  listeners.add(fn);
  if (updateReady) fn();
  return () => listeners.delete(fn);
}

/** Switch to the new version. */
export function installUpdate() {
  window.location.reload();
}
