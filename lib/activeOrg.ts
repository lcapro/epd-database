import { cookies } from 'next/headers';
import { ACTIVE_ORG_COOKIE } from '@/lib/activeOrgConstants';
import { ActiveOrgError } from '@/lib/activeOrgErrors';

export { ACTIVE_ORG_COOKIE, ActiveOrgError };

export function getActiveOrgId(): string | null {
  return cookies().get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

export function requireActiveOrgId(): string {
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) {
    throw new ActiveOrgError('Geen actieve organisatie geselecteerd. Kies eerst een organisatie.', 400);
  }
  return activeOrgId;
}
