const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-.*(auth-token|access-token|refresh-token)$/;

export function hasSupabaseAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((cookie) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.trim().split('=')[0]));
}
