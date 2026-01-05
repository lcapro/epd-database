import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  error: string | null;
};

export function useAuthStatus(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    const hasAuthCookie = () => {
      if (typeof document === 'undefined') return false;
      return document.cookie.split(';').some((cookie) => cookie.trim().startsWith('sb-'));
    };

    const applySession = (session: { user: User } | null) => {
      const user = session?.user ?? null;
      setState({
        status: user ? 'authenticated' : 'unauthenticated',
        user,
        error: null,
      });
    };

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setState({ status: 'error', user: null, error: error.message });
        return;
      }

      if (data.session) {
        applySession(data.session);
        return;
      }

      if (hasAuthCookie()) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!active) return;
        if (refreshError) {
          setState({ status: 'error', user: null, error: refreshError.message });
          return;
        }
        applySession(refreshData.session ?? null);
        return;
      }

      applySession(null);
    };

    syncSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      applySession(session);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return state;
}
