import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { postActiveOrg } from '../lib/org/activeOrgClient';

describe('postActiveOrg', () => {
  it('includes credentials and JSON body', async () => {
    const originalFetch = globalThis.fetch;
    let capturedInput: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedInput = input;
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      await postActiveOrg('org-123');
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(capturedInput, '/api/org/active');
    assert.equal(capturedInit?.method, 'POST');
    assert.equal(capturedInit?.credentials, 'include');
    assert.deepEqual(capturedInit?.headers, { 'Content-Type': 'application/json' });
    assert.equal(capturedInit?.body, JSON.stringify({ organizationId: 'org-123' }));
  });
});
