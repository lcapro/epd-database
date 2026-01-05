import { ensureSupabaseSession } from '@/lib/auth/ensureSupabaseSession';

type OrgRetryOptions = {
  retries?: number;
  backoffMs?: number[];
  onRecover?: (attempt: number) => void;
  onRecoveringChange?: (recovering: boolean) => void;
};

const defaultBackoffMs = [150, 300];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchOrgEndpointWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  { retries = 2, backoffMs = defaultBackoffMs, onRecover, onRecoveringChange }: OrgRetryOptions = {},
): Promise<Response> {
  let response = await fetch(input, init);
  if (response.status !== 401) {
    return response;
  }

  onRecoveringChange?.(true);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    onRecover?.(attempt);
    await ensureSupabaseSession();
    const delayMs = backoffMs[attempt - 1];
    if (delayMs) {
      await delay(delayMs);
    }
    response = await fetch(input, init);
    if (response.status !== 401) {
      onRecoveringChange?.(false);
      return response;
    }
  }

  onRecoveringChange?.(false);
  return response;
}
