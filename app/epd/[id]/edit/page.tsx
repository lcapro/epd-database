import type { EpdImpactRecord, EpdRecord } from '@/lib/types';
import { absoluteUrl } from '@/lib/absoluteUrl';
import EpdEditClient from './EpdEditClient';

interface ApiResponse {
  epd: EpdRecord;
  impacts: EpdImpactRecord[];
}

const fetchEpd = async (id: string) => {
  const res = await fetch(absoluteUrl(`/api/epd/${id}`), { cache: 'no-store' });
  if (!res.ok) throw new Error('Kan EPD niet laden');
  return res.json() as Promise<ApiResponse>;
};

export default async function EpdEditPage({ params }: { params: { id: string } }) {
  const { epd, impacts } = await fetchEpd(params.id);
  return <EpdEditClient epd={epd} impacts={impacts || []} />;
}
