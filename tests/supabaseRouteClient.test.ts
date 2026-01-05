import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server';
import { applySupabaseCookiesToResponse } from '../lib/supabase/route';

describe('supabase route client cookie handling', () => {
  it('applies Set-Cookie entries to a NextResponse', () => {
    const response = NextResponse.json({ ok: true });
    applySupabaseCookiesToResponse(response, [
      {
        name: 'sb-test-auth-token',
        value: 'token-value',
        options: { path: '/', httpOnly: true },
      },
    ]);

    const cookie = response.cookies.get('sb-test-auth-token');
    assert.equal(cookie?.value, 'token-value');
  });
});
