import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { hasSupabaseAuthCookie } from '@/lib/auth/supabaseAuthCookies';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

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
  const initialCheckComplete = useRef(false);

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
        initialCheckComplete.current = true;
        setState({ status: 'unauthenticated', user: null, error: error.message });
        return;
      }

      if (data.session && hasSupabaseAuthCookie()) {
        initialCheckComplete.current = true;
        applySession(data.session);
        return;
      }

      if (data.session || hasSupabaseAuthCookie()) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!active) return;
        if (refreshError) {
          initialCheckComplete.current = true;
          setState({ status: 'unauthenticated', user: null, error: refreshError.message });
          return;
        }
        if (refreshData.session && hasSupabaseAuthCookie()) {
          initialCheckComplete.current = true;
          applySession(refreshData.session);
          return;
        }
      }

      initialCheckComplete.current = true;
      applySession(null);
    };

    syncSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !initialCheckComplete.current) return;
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
