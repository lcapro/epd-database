import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseCookieStatusFromCookies } from '../lib/supabase/server';
import { buildActiveOrgPostResult } from '../lib/org/activeOrgPost';

describe('supabase auth helpers', () => {
  it('distinguishes active org cookie from supabase auth cookies', () => {
    const status = getSupabaseCookieStatusFromCookies([
      { name: 'active_org_id' },
      { name: 'sb-project-auth-token' },
    ]);

    assert.equal(status.hasActiveOrgCookie, true);
    assert.equal(status.hasSupabaseAuthCookie, true);

    const activeOnly = getSupabaseCookieStatusFromCookies([{ name: 'active_org_id' }]);
    assert.equal(activeOnly.hasActiveOrgCookie, true);
    assert.equal(activeOnly.hasSupabaseAuthCookie, false);
  });

  it('returns active org cookie on successful set', async () => {
    const request = new Request('http://localhost/api/org/active', {
      method: 'POST',
      body: JSON.stringify({ organizationId: 'org-123' }),
    });

    const supabase = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null }),
        refreshSession: async () => ({ data: { session: null }, error: null }),
      },
    };

    const result = await buildActiveOrgPostResult({
      request,
      supabase: supabase as Parameters<typeof buildActiveOrgPostResult>[0]['supabase'],
      cookieStatus: { hasActiveOrgCookie: false, hasSupabaseAuthCookie: true },
      requestId: 'test-request',
      assertMember: async () => 'owner',
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.activeOrgId, 'org-123');
    assert.equal(result.setCookie?.name, 'active_org_id');
    assert.equal(result.setCookie?.value, 'org-123');
  });
});
