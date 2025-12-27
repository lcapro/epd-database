import { EpdImpactRecord, EpdRecord } from '@/lib/types';

interface ApiResponse {
  epd: EpdRecord & { epd_files?: { storage_path?: string | null } | null };
  impacts: EpdImpactRecord[];
}

/**
 * Stap 5 – Detailpagina (volledig)
 * - Toont ALLE impactcategorieën die in de DB staan voor deze EPD
 * - Gebruiker kan zelf kiezen welke categorieën zichtbaar zijn (client-side toggles)
 * - Ondersteunt units per indicator (vereist dat epd_impacts een kolom `unit` heeft)
 *
 * Plaats dit bestand als: app/epd/[id]/page.tsx
 */

const fetchEpd = async (id: string) => {
  // Server component -> fetch naar dezelfde origin werkt in Next.
  const res = await fetch(`/api/epd/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Kan EPD niet laden');
  return res.json() as Promise<ApiResponse>;
};

const stages = ['A1', 'A2', 'A3', 'A1_A3', 'D'] as const;
const sets = ['SBK_SET_1', 'SBK_SET_2', 'UNKNOWN'] as const;

// ===== Helpers voor labels (optioneel, maar fijn) =====
const IMPACT_LABELS: Record<string, string> = {
  MKI: 'MKI',
  GWP: 'GWP (klimaatverandering)',
  CO2: 'CO2 (alias)',
  ADPE: 'ADPE (abiotische uitputting, elementen)',
  ADPF: 'ADPF (abiotische uitputting, fossiel)',
  ODP: 'ODP (ozonlaag aantasting)',
  POCP: 'POCP (fotochemische oxidantvorming)',
  AP: 'AP (verzuring)',
  EP: 'EP (vermesting)',
  HTP: 'HTP (humaan-toxicologisch)',
  FAETP: 'FAETP (eco-toxicologisch zoetwater)',
  MAETP: 'MAETP (eco-toxicologisch zeewater)',
  TETP: 'TETP (eco-toxicologisch terrestisch)',
  PERE: 'PERE',
  PERM: 'PERM',
  PERT: 'PERT',
  PENRE: 'PENRE',
  PENRM: 'PENRM',
  PENRT: 'PENRT',
  PET: 'PET',
  SM: 'SM',
  RSF: 'RSF',
  NRSF: 'NRSF',
  FW: 'FW',
  HWD: 'HWD',
  NHWD: 'NHWD',
  RWD: 'RWD',
  CRU: 'CRU',
  MFR: 'MFR',
  MER: 'MER',
  EE: 'EE',
  EET: 'EET',
  EEE: 'EEE',
};

function labelForIndicator(ind: string) {
  return IMPACT_LABELS[ind] || ind;
}

// Server component (default)
export default async function EpdDetailPage({ params }: { params: { id: string } }) {
  const { epd, impacts } = await fetchEpd(params.id);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'epd-pdfs';

  // Verzamel beschikbare indicatoren uit DB voor deze EPD
  const indicatorList = Array.from(new Set((impacts || []).map((i) => i.indicator))).sort((a, b) =>
    a.localeCompare(b)
  );

  // Unit per indicator (eerste hit). Vereist kolom `unit` in epd_impacts.
  const unitByIndicator: Record<string, string> = {};
  for (const i of impacts || []) {
    const anyI = i as unknown as { unit?: string | null };
    if (!unitByIndicator[i.indicator] && anyI.unit) {
      unitByIndicator[i.indicator] = anyI.unit;
    }
  }

  // Lookup: indicator -> set -> stage -> value
  const map = new Map<string, number | null>();
  for (const i of impacts || []) {
    const key = `${i.indicator}|${i.set_type}|${i.stage}`;
    map.set(key, i.value ?? null);
  }
  const getVal = (indicator: string, set: string, stage: string) => {
    const v = map.get(`${indicator}|${set}|${stage}`);
    if (v === null || v === undefined) return '-';
    // nette formatting (maar geen locale gedoe)
    return Number.isFinite(v as number) ? String(v) : '-';
  };

  // We renderen toggles in een client component (inline) zodat je geen extra file nodig hebt.
  // Next 14: je mag een client component importeren, maar hieronder doen we het via een nested component.
  return (
    <div className="space-y-4">
      {/* HEADER CARD */}
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

        {epd.epd_files?.storage_path && supabaseUrl && (
          <div className="pt-2 text-sm">
            <p className="text-slate-500">Originele PDF</p>
            <a
              className="text-sky-600 underline"
              href={`${supabaseUrl}/storage/v1/object/public/${bucket}/${epd.epd_files.storage_path}`}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          </div>
        )}
      </div>

      {/* IMPACTS CARD */}
      <ImpactSection
        indicatorList={indicatorList}
        unitByIndicator={unitByIndicator}
        getVal={getVal}
      />

      {/* CUSTOM FIELDS CARD */}
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

/**
 * Client component voor toggles (zelfde file, stap 5 volledig)
 */
function ImpactSection(props: {
  indicatorList: string[];
  unitByIndicator: Record<string, string>;
  getVal: (indicator: string, set: string, stage: string) => string;
}) {
  'use client';

  const { indicatorList, unitByIndicator, getVal } = props;

  // Default: toon alles wat bestaat
  const [visible, setVisible] = useState<string[]>(indicatorList);

  // Groepering op simpele manier (optioneel)
  const groupFor = (k: string) => {
    const resources = new Set(['PERE','PERM','PERT','PENRE','PENRM','PENRT','PET','SM','RSF','NRSF','FW']);
    const waste = new Set(['HWD','NHWD','RWD','CRU','MFR','MER','EE','EET','EEE']);
    const core = new Set(['MKI','GWP']);
    if (core.has(k)) return 'Kern';
    if (resources.has(k)) return 'Resources';
    if (waste.has(k)) return 'Waste';
    return 'Impact';
  };

  const grouped = useMemo(() => {
    const acc: Record<string, string[]> = { Kern: [], Impact: [], Resources: [], Waste: [] };
    for (const k of indicatorList) {
      acc[groupFor(k)].push(k);
    }
    return acc;
  }, [indicatorList]);

  const toggle = (k: string) => {
    setVisible((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const visibleSorted = useMemo(() => {
    // behoud de indicatorList-volgorde, maar filter op visible
    return indicatorList.filter((k) => visible.includes(k));
  }, [indicatorList, visible]);

  return (
    <div className="card space-y-3">
      <div className="flex-between gap-3">
        <div>
          <h3 className="font-semibold">Impactwaarden</h3>
          <p className="text-sm text-slate-600">
            Kies welke categorieën zichtbaar zijn. Alles blijft in de database staan.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setVisible(indicatorList)}
          >
            Alles
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setVisible(indicatorList.filter((k) => k === 'MKI' || k === 'GWP'))}
          >
            Alleen kern
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setVisible([])}
          >
            Niets
          </button>
        </div>
      </div>

      {/* toggles */}
      <div className="grid-two">
        {(['Kern', 'Impact', 'Resources', 'Waste'] as const).map((grp) => (
          <div key={grp} className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="font-semibold text-sm">{grp}</div>
            <div className="mt-2 space-y-1">
              {(grouped[grp] || []).length === 0 ? (
                <div className="text-xs text-slate-500">Geen categorieën</div>
              ) : (
                grouped[grp].map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={visible.includes(k)} onChange={() => toggle(k)} />
                    <span>{labelForIndicator(k)}</span>
                    <span className="text-slate-500">({k}{unitByIndicator[k] ? `, ${unitByIndicator[k]}` : ''})</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* tables */}
      {visibleSorted.length === 0 ? (
        <p className="text-sm text-slate-600">Geen categorieën geselecteerd.</p>
      ) : (
        <div className="space-y-5">
          {visibleSorted.map((indicator) => (
            <div key={indicator} className="space-y-2">
              <div className="flex-between">
                <div className="font-semibold">
                  {labelForIndicator(indicator)} <span className="text-slate-500 text-sm">({indicator})</span>
                </div>
                <div className="text-xs text-slate-500">
                  {unitByIndicator[indicator] ? `Unit: ${unitByIndicator[indicator]}` : 'Unit: -'}
                </div>
              </div>

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
                  {sets.map((set) => (
                    <tr key={`${indicator}-${set}`}>
                      <td>{set}</td>
                      {stages.map((stage) => (
                        <td key={`${indicator}-${set}-${stage}`}>
                          {getVal(indicator, set, stage)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Needed imports for the client component section:
import { useMemo, useState } from 'react';
