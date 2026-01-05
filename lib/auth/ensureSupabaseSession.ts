import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { hasSupabaseAuthCookie } from '@/lib/auth/supabaseAuthCookies';

export async function ensureSupabaseSession(): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.auth.getSession();
  if (error) return false;
  if (data.session && hasSupabaseAuthCookie()) return true;

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return false;
  if (!refreshData.session) return false;
  return hasSupabaseAuthCookie();
}
