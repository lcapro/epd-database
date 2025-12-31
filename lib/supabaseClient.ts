import { createClient, SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

let supabaseClient: SupabaseClient | undefined;
let adminClient: SupabaseClient | undefined;
let envLogged = false;

function logEnvStatus() {
  if (envLogged || typeof window !== 'undefined') return;
  envLogged = true;
  console.info('Supabase env check', {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}

export function getSupabaseClient(): SupabaseClient {
  logEnvStatus();
  if (!supabaseClient) {
    const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseAnonKey = requireEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}

export function getAdminClient(): SupabaseClient {
  logEnvStatus();
  if (!adminClient) {
    const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceRoleKey = requireEnv(
      'SUPABASE_SERVICE_ROLE_KEY for server operations',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
