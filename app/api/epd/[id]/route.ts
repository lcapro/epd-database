import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const admin = getAdminClient();
  const { data: epd, error } = await admin
    .from('epds')
    .select('*, epd_files(storage_path)')
    .eq('id', params.id)
    .single();

  if (error || !epd) {
    return NextResponse.json({ error: error?.message || 'Niet gevonden' }, { status: 404 });
  }

  const { data: impacts, error: impactsError } = await admin
    .from('epd_impacts')
    .select('*')
    .eq('epd_id', params.id);

  if (impactsError) {
    return NextResponse.json({ error: impactsError.message }, { status: 500 });
  }

  return NextResponse.json({ epd, impacts: impacts || [] });
}
