import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { hasSupabaseAuthCookie } from '@/lib/auth/supabaseAuthCookies';

export async function shouldRedirectToLoginAfterUnauthorized(): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return !data.session && !hasSupabaseAuthCookie();
}
