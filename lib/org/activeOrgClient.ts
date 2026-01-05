type ActiveOrgPayload = {
  organizationId: string;
};

export function postActiveOrg(organizationId: string) {
  return fetch('/api/org/active', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId } satisfies ActiveOrgPayload),
  });
}
