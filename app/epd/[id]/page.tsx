import type { EpdImpactRecord, EpdRecord } from '@/lib/types';
import EpdDetailClient from './EpdDetailClient';

interface ApiResponse {
  epd: EpdRecord & { epd_files?: { storage_path?: string | null } | null };
  impacts: EpdImpactRecord[];
}

const fetchEpd = async (id: string) => {
  const res = await fetch(`/api/epd/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Kan EPD niet laden');
  return res.json() as Promise<ApiResponse>;
};

export default async function EpdDetailPage({ params }: { params: { id: string } }) {
  const { epd, impacts } = await fetchEpd(params.id);

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
