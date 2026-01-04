import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { EpdImpactRecord, EpdRecord } from '@/lib/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrgIdFromCookies } from '@/lib/organizations';
import EpdDetailClient from './EpdDetailClient';

export const dynamic = 'force-dynamic';

export default async function EpdDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/epd/${params.id}`);
  }

  const activeOrgId = getActiveOrgIdFromCookies(cookies());
  if (!activeOrgId) {
    redirect('/org');
  }

  const { data: epd, error } = await supabase
    .from('epds')
    .select('*, epd_files(storage_path)')
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'epd-pdfs';

  const epdForClient: EpdRecord & { storage_path?: string | null } = {
    ...epd,
    storage_path: epd.epd_files?.storage_path ?? null,
  };

  return (
    <EpdDetailClient
      epd={epdForClient}
      impacts={impacts || []}
      supabaseUrl={supabaseUrl}
      bucket={bucket}
    />
  );
}
