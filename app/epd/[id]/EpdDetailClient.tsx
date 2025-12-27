'use client';

import { useMemo, useState } from 'react';
import type { EpdImpactRecord, EpdRecord } from '@/lib/types';

const STAGES = ['A1', 'A2', 'A3', 'A1_A3', 'D'] as const;

type Props = {
  epd: EpdRecord & { storage_path?: string | null };
  impacts: EpdImpactRecord[];
  supabaseUrl: string | null;
  bucket: string;
};

const ALL_INDICATORS = [
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
] as const;

const SETS = ['SBK_SET_1', 'SBK_SET_2', 'UNKNOWN'] as const;

export default function EpdDetailClient({ epd, impacts, supabaseUrl, bucket }: Props) {
  // gebruiker kan straks zelf kiezen welke impactcategorieën zichtbaar zijn
  const [visibleIndicators, setVisibleIndicators] = useState<string[]>(['MKI', 'GWP']);

  const indicatorOptions = useMemo(() => {
    // toon alle bekende indicatoren + alles wat in DB voorkomt (toekomstproof)
    const fromDb = Array.from(new Set(impacts.map((i) => i.indicator))).filter(Boolean);
    const merged = Array.from(new Set([...ALL_INDICATORS, ...fromDb]));
    return merged.sort();
  }, [impacts]);

  const toggleIndicator = (ind: string) => {
    setVisibleIndicators((prev) =>
      prev.includes(ind) ? prev.filter((x) => x !== ind) : [...prev, ind]
    );
  };

  const findImpact = (indicator: string, setType: string, stage: string) =>
    impacts.find((i) => i.indicator === indicator && i.set_type === setType && i.stage === stage)?.value ?? '-';

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
          <div><strong>NMD database:</strong> {epd.database_nmd_version || '-'}</div>
          <div><strong>EcoInvent:</strong> {epd.database_ecoinvent_version || '-'}</div>
          <div><strong>Publicatie:</strong> {epd.publication_date || '-'}</div>
          <div><strong>Geldigheid:</strong> {epd.expiration_date || '-'}</div>
          <div><strong>Toetser/verificateur:</strong> {epd.verifier_name || '-'}</div>
          <div><strong>Set:</strong> {epd.standard_set}</div>
        </div>

        {!!epd.storage_path && supabaseUrl && (
          <div className="pt-2 text-sm">
            <p className="text-slate-500">Originele PDF</p>
            <a
              className="text-sky-600 underline"
              href={`${supabaseUrl}/storage/v1/object/public/${bucket}/${epd.storage_path}`}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex-between">
          <h3 className="font-semibold">Impactwaarden</h3>
        </div>

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
        </div>

        <div className="space-y-6 pt-2">
          {visibleIndicators.map((indicator) => (
            <div key={indicator} className="space-y-2">
              <h4 className="font-semibold">{indicator}</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Set</th>
                    {STAGES.map((stage) => (
                      <th key={stage}>{stage.replace('_', '-')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SETS.map((setType) => (
                    <tr key={`${indicator}-${setType}`}>
                      <td>{setType}</td>
                      {STAGES.map((stage) => (
                        <td key={`${indicator}-${setType}-${stage}`}>
                          {findImpact(indicator, setType, stage)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-500">
                Tip: als een waarde “-” is, staat hij niet in de DB voor deze indicator/set/stage.
              </p>
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
