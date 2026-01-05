import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export async function ensureSupabaseSession(): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.auth.getSession();
  if (error) return false;
  if (data.session) return true;

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return false;
  return Boolean(refreshData.session);
}
