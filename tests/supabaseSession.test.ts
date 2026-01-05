import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseUserWithRefresh } from '../lib/supabase/session';

describe('getSupabaseUserWithRefresh', () => {
  it('refreshes session once when auth session is missing', async () => {
    let getUserCalls = 0;
    let refreshCalls = 0;

    const supabase = {
      auth: {
        getUser: async () => {
          getUserCalls += 1;
          return {
            data: { user: null },
            error: { message: 'Auth session missing!' },
          };
        },
        refreshSession: async () => {
          refreshCalls += 1;
          return {
            data: { session: { user: { id: 'user-123' } } },
            error: null,
          };
        },
      },
    };

    const result = await getSupabaseUserWithRefresh(
      supabase as Parameters<typeof getSupabaseUserWithRefresh>[0],
      true,
    );

    assert.equal(result.user?.id, 'user-123');
    assert.equal(refreshCalls, 1);
    assert.equal(getUserCalls, 1);
  });

  it('retries getUser once after refresh when needed', async () => {
    let getUserCalls = 0;
    let refreshCalls = 0;

    const supabase = {
      auth: {
        getUser: async () => {
          getUserCalls += 1;
          if (getUserCalls === 1) {
            return {
              data: { user: null },
              error: { message: 'Auth session missing!' },
            };
          }
          return {
            data: { user: { id: 'user-456' } },
            error: null,
          };
        },
        refreshSession: async () => {
          refreshCalls += 1;
          return {
            data: { session: null },
            error: null,
          };
        },
      },
    };

    const result = await getSupabaseUserWithRefresh(
      supabase as Parameters<typeof getSupabaseUserWithRefresh>[0],
      true,
    );

    assert.equal(result.user?.id, 'user-456');
    assert.equal(refreshCalls, 1);
    assert.equal(getUserCalls, 2);
  });
});
