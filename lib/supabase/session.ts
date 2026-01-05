import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseAuthResult = {
  user: { id: string } | null;
  error: { code?: string | null; message?: string | null } | null;
  attempts: number;
  didRetry: boolean;
};

export async function getSupabaseUserWithRefresh(
  supabase: SupabaseClient,
  hasCookie: boolean,
): Promise<SupabaseAuthResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) {
    return { user, error: error ?? null, attempts: 1, didRetry: false };
  }

  if (!hasCookie) {
    return { user: null, error: error ?? null, attempts: 1, didRetry: false };
  }

  const message = error?.message ?? '';
  const normalizedMessage = message.toLowerCase();
  const isMissingSession =
    normalizedMessage.includes('auth session missing') || error?.code === 'AUTH_SESSION_MISSING';
  const shouldAttemptRefresh = hasCookie && (!error || isMissingSession);

  if (!shouldAttemptRefresh) {
    return { user: null, error, attempts: 1, didRetry: false };
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

  const {
    data: { user: refreshedUser },
    error: refreshedError,
  } = await supabase.auth.getUser();

  if (refreshedUser) {
    return { user: refreshedUser, error: null, attempts: 2, didRetry: true };
  }

  if (refreshData.session?.user) {
    return { user: refreshData.session.user, error: null, attempts: 2, didRetry: true };
  }

  return {
    user: null,
    error: refreshedError ?? refreshError ?? error ?? null,
    attempts: 2,
    didRetry: true,
  };
}
