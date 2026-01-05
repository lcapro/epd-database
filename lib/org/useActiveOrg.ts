import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchOrgEndpointWithRetry } from '@/lib/org/orgApiRetry';

export type ActiveOrgStatus = 'idle' | 'loading' | 'recovering' | 'ready' | 'error';

type ActiveOrgState = {
  status: ActiveOrgStatus;
  organizationId: string | null;
  error: string | null;
};

export function useActiveOrg(enabled = true) {
  const router = useRouter();
  const [state, setState] = useState<ActiveOrgState>({
    status: enabled ? 'loading' : 'idle',
    organizationId: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const response = await fetchOrgEndpointWithRetry(
        '/api/org/active',
        { cache: 'no-store', credentials: 'include' },
        {
          onRecoveringChange: (recovering) => {
            if (recovering) {
              setState((prev) => ({ ...prev, status: 'recovering', error: null }));
            }
          },
          onRecover: (attempt) => {
            if (attempt === 1) {
              router.refresh();
            }
          },
        },
      );
      if (response.status === 401) {
        setState({
          status: 'error',
          organizationId: null,
          error: 'Je sessie is verlopen. Log opnieuw in.',
        });
        router.push('/login');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Kon actieve organisatie niet laden');
      }
      const json = (await response.json()) as { organizationId: string | null };
      setState({
        status: 'ready',
        organizationId: json.organizationId ?? null,
        error: null,
      });
    } catch (err) {
      setState({
        status: 'error',
        organizationId: null,
        error: err instanceof Error ? err.message : 'Kon actieve organisatie niet laden',
      });
    }
  }, [enabled, router]);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', organizationId: null, error: null });
      return;
    }
    refresh();
  }, [enabled, refresh]);

  const setOrganizationId = useCallback((organizationId: string | null) => {
    setState((prev) => ({ ...prev, organizationId }));
  }, []);

  return {
    ...state,
    refresh,
    setOrganizationId,
  };
}
