import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';
import { getBaseUrl } from '@workspace/api-client-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = getBaseUrl();
  if (base && url.startsWith('/api/')) {
    return `${base}${url}`;
  }
  return url;
}
