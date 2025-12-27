'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EpdImpactRecord, EpdRecord } from '@/lib/types';

interface ApiResponse {
  epd: EpdRecord & { epd_files?: { storage_path?: string | null } | null };
  impacts: EpdImpactRecord[];
}

const stages = ['A1', 'A2', 'A3', 'A1_A3', 'D'] as const;
const sets = ['SBK_SET_1', 'SBK_SET_2', 'UNKNOWN'] as const;

// default: laat meteen iets zien
const defaultVisibleIndicators = ['MKI', 'GWP'];

export default function EpdDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [visibleIndicators, setVisibleIndicators] = useState<string[]>(defaultVisibleIndicators);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/epd/${params.id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Kan EPD niet laden');
        const json = (await res.json()) as ApiResponse;
        setData(json);

        // auto-aanvullen met wat er in DB staat (future-proof)
        const fromDb = Array.from(new Set((json.impacts || []).map((i) => i.indicator))).filter(Boolean);
        setVisibleIndicators((prev) => Array.from(new Set([...prev, ...fromDb.filter((x) => x === 'MKI' || x === 'GWP')])));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [params.id]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'epd-pdfs';

  const indicatorOptions = useMemo(() => {
    const known = [
      'MKI',
      'GWP',
      'ADPE',
      'ADPF',
      'ODP',
      'POCP',
      'AP',
      'EP',
      'HTP',
      'FAETP',
      'MAETP',
      'TETP',
      'PERE',
      'PERM',
      'PERT',
      'PENRE',
      'PENRM',
      'PENRT',
      'PET',
      'SM',
      'RSF',
      'NRSF',
      'FW',
      'HWD',
      'NHWD',
      'RWD',
      'CRU',
      'MFR',
      'MER',
      'EE',
      'EET',
      'EEE',
    ];

    const fromDb = data ? Array.from(new Set((data.impacts || []).map((i) => i.indicator))).filter(Boolean) : [];
    return Array.from(new Set([...known, ...fromDb])).sort();
  }, [data]);

  const toggleIndicator = (ind: string) => {
    setVisibleIndicators((prev) => (prev.includes(ind) ? prev.filter((x) => x !== ind) : [...prev, ind]));
  };

  const findImpact = (indicator: string, setType: string, stage: string) =>
    data?.impacts?.find((i) => i.indicator === indicator && i.set_type === setType && i.stage === stage)?.value ?? '-';

  if (loading) return <div className="card text-sm text-slate-600">Laden…</div>;
  if (error) return <div className="card text-sm text-red-600">{error}</div>;
  if (!data) return <div className="card text-sm text-slate-600">Geen data</div>;

  const { epd, impacts } = data;
  const storagePath = epd.epd_files?.storage_path ?? null;

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">{epd.product_name}</h2>
        <p className="text-sm text-slate-600">{epd.functional_unit}</p>

        <div className="grid-two mt-2 text-sm">
          <div><strong>Producent:</strong> {epd.producer_name || '-'}</div>
          <div><strong>LCA-methode:</strong> {epd.lca_method || '-'}</div>
          <div><strong>PCR-versie:</strong> {epd.pcr_version || '-'}</div>
          <div><strong>Database:</strong> {epd.database_name || '-'}</div>
          <div><strong>Publicatie:</strong> {epd.publication_date || '-'}</div>
          <div><strong>Geldigheid:</strong> {epd.expiration_date || '-'}</div>
          <div><strong>Toetser/verificateur:</strong> {epd.verifier_name || '-'}</div>
          <div><strong>Set:</strong> {epd.standard_set}</div>
        </div>

        {!!storagePath && !!supabaseUrl && (
          <div className="pt-2 text-sm">
            <p className="text-slate-500">Originele PDF</p>
            <a
              className="text-sky-600 underline"
              href={`${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Impactwaarden</h3>

        <div className="space-y-2">
          <p className="text-sm text-slate-600">Kies welke categorieën zichtbaar zijn:</p>
          <div className="flex flex-wrap gap-2">
            {indicatorOptions.map((ind) => {
              const active = visibleIndicators.includes(ind);
              return (
                <button
                  key={ind}
                  type="button"
                  className={`button ${active ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => toggleIndicator(ind)}
                >
                  {ind}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            In DB gevonden: {Array.from(new Set(impacts.map((i) => i.indicator))).join(', ') || '-'}
          </p>
        </div>

        <div className="space-y-6 pt-2">
          {visibleIndicators.map((indicator) => (
            <div key={indicator} className="space-y-2">
              <h4 className="font-semibold">{indicator}</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Set</th>
                    {stages.map((stage) => (
                      <th key={stage}>{stage.replace('_', '-')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sets.map((setType) => (
                    <tr key={`${indicator}-${setType}`}>
                      <td>{setType}</td>
                      {stages.map((stage) => (
                        <td key={`${indicator}-${setType}-${stage}`}>
                          {findImpact(indicator, setType, stage)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Custom velden</h3>
        {Object.keys(epd.custom_attributes || {}).length === 0 ? (
          <p className="text-sm text-slate-600">Geen extra velden.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {Object.entries(epd.custom_attributes).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
