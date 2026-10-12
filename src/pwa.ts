/** Both entry points use the same worker and install identity at the hosting root. */
export function registerPwa(base: './' | '../') {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
}
