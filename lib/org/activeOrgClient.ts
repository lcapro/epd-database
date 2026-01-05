type ActiveOrgPayload = {
  organizationId: string;
};

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

export async function postActiveOrg(organizationId: string) {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return fetch('/api/org/active', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ organizationId } satisfies ActiveOrgPayload),
  });
}
