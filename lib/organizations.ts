import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { ACTIVE_ORG_COOKIE } from '@/lib/activeOrgConstants';

export { ACTIVE_ORG_COOKIE };

export function getActiveOrgIdFromCookies(cookieStore: ReadonlyRequestCookies) {
  return cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

export function getActiveOrgIdFromRequest(request: Request, cookieStore?: ReadonlyRequestCookies) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('orgId') || url.searchParams.get('org');
  if (fromQuery) return fromQuery;
  if (cookieStore) return getActiveOrgIdFromCookies(cookieStore);
  return null;
}
