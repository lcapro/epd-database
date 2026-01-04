import { cookies } from 'next/headers';

export const ACTIVE_ORG_COOKIE = 'active_org_id';

export class ActiveOrgError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

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
