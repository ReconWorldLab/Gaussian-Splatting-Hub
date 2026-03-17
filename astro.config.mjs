import { defineConfig } from 'astro/config';

function normalizeBase(value = '/') {
  if (!value || value === '/') {
    return '/';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://example.com',
  base: normalizeBase(process.env.PUBLIC_BASE_PATH ?? '/')
});

