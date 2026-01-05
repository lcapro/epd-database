import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { hasSupabaseAuthCookie } from '@/lib/auth/supabaseAuthCookies';

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

      if (data.session && hasSupabaseAuthCookie()) {
        applySession(data.session);
        return;
      }

      if (data.session || hasSupabaseAuthCookie()) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!active) return;
        if (refreshError) {
          setState({ status: 'error', user: null, error: refreshError.message });
          return;
        }
        if (refreshData.session && hasSupabaseAuthCookie()) {
          applySession(refreshData.session);
          return;
        }
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
