import { useCallback, useEffect, useState } from 'react';

export type ActiveOrgStatus = 'idle' | 'loading' | 'ready' | 'error';

type ActiveOrgState = {
  status: ActiveOrgStatus;
  organizationId: string | null;
  error: string | null;
};

export function useActiveOrg(enabled = true) {
  const [state, setState] = useState<ActiveOrgState>({
    status: enabled ? 'loading' : 'idle',
    organizationId: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const response = await fetch('/api/org/active', { cache: 'no-store' });
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
  }, [enabled]);

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
