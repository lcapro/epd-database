import { EpdImpactRecord, EpdRecord } from '@/lib/types';

interface ApiResponse {
  epd: EpdRecord & { epd_files?: { storage_path?: string | null } | null };
  impacts: EpdImpactRecord[];
}

const fetchEpd = async (id: string) => {
  const res = await fetch(`/api/epd/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Kan EPD niet laden');
  return res.json() as Promise<ApiResponse>;
};

const stages = ['A1', 'A2', 'A3', 'A1_A3', 'D'] as const;
const indicators = ['MKI', 'CO2'] as const;
const sets = ['SBK_SET_1', 'SBK_SET_2'] as const;

export default async function EpdDetailPage({ params }: { params: { id: string } }) {
  const { epd, impacts } = await fetchEpd(params.id);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'epd-pdfs';

  const findImpact = (indicator: string, set: string, stage: string) =>
    impacts.find((i) => i.indicator === indicator && i.set_type === set && i.stage === stage)?.value ?? '-';

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

      <div className="card space-y-3">
        <h3 className="font-semibold">Impactwaarden</h3>
        <div className="space-y-4">
          {indicators.map((indicator) => (
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
                  {sets.map((set) => (
                    <tr key={`${indicator}-${set}`}>
                      <td>{set}</td>
                      {stages.map((stage) => (
                        <td key={`${indicator}-${set}-${stage}`}>
                          {findImpact(indicator, set, stage)}
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
