import type { SupabaseClient } from '@supabase/supabase-js';

export class OrgAuthError extends Error {
  status: number;
  code?: string | null;

  constructor(message: string, status = 403, code?: string | null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function assertOrgMember(supabase: SupabaseClient, userId: string, organizationId: string) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new OrgAuthError('Kon lidmaatschap niet controleren', 500, error.code ?? null);
  }

  if (!data) {
    throw new OrgAuthError('Geen toegang tot organisatie', 403);
  }

  return data.role as string;
}
