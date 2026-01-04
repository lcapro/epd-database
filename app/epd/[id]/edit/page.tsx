import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { EpdImpactRecord, EpdRecord } from '@/lib/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrgIdFromCookies } from '@/lib/organizations';
import EpdEditClient from './EpdEditClient';

export const dynamic = 'force-dynamic';

export default async function EpdEditPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/epd/${params.id}/edit`);
  }

  const activeOrgId = getActiveOrgIdFromCookies(cookies());
  if (!activeOrgId) {
    redirect('/org');
  }

  const { data: epd, error } = await supabase
    .from('epds')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', activeOrgId)
    .single();

  if (error || !epd) {
    notFound();
  }

  const { data: impacts, error: impactError } = await supabase
    .from('epd_impacts')
    .select('*')
    .eq('epd_id', params.id)
    .eq('organization_id', activeOrgId);

  if (impactError) {
    notFound();
  }

  return <EpdEditClient epd={epd as EpdRecord} impacts={(impacts || []) as EpdImpactRecord[]} />;
}
