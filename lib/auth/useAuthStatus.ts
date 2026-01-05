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

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setState({ status: 'error', user: null, error: error.message });
        return;
      }

      const user = data.session?.user ?? null;
      setState({
        status: user ? 'authenticated' : 'unauthenticated',
        user,
        error: null,
      });
    };

    syncSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const user = session?.user ?? null;
      setState({
        status: user ? 'authenticated' : 'unauthenticated',
        user,
        error: null,
      });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
