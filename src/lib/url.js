export function withBase(path = '/') {
  const base = import.meta.env.BASE_URL ?? '/';
  const cleanPath = path.replace(/^\/+/, '');

  if (!cleanPath) {
    return base;
  }

  return new URL(cleanPath, `https://gs-hub.local${base}`).pathname;
}
