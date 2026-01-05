import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseAuthResult = {
  user: { id: string } | null;
  error: { code?: string | null; message?: string | null } | null;
};

export async function getSupabaseUserWithRefresh(
  supabase: SupabaseClient,
  hasCookie: boolean,
): Promise<SupabaseAuthResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user || !hasCookie) {
    return { user, error: error ?? null };
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    return { user: null, error: refreshError };
  }

  if (refreshData.session?.user) {
    return { user: refreshData.session.user, error: null };
  }

  const {
    data: { user: refreshedUser },
    error: refreshedError,
  } = await supabase.auth.getUser();

  return { user: refreshedUser ?? null, error: refreshedError ?? null };
}
