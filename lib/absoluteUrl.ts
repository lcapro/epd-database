import { headers } from 'next/headers';

export function absoluteUrl(path: string) {
  const headersList = headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');

  if (!host) {
    throw new Error('absoluteUrl: host header ontbreekt');
  }

  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const basePathEnv = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const normalizedBasePath = basePathEnv
    ? `/${basePathEnv.replace(/^\/|\/$/g, '')}`
    : '';
  const fullPath =
    normalizedBasePath && !normalizedPath.startsWith(normalizedBasePath)
      ? `${normalizedBasePath}${normalizedPath}`
      : normalizedPath;

  return `${proto}://${host}${fullPath}`;
}
