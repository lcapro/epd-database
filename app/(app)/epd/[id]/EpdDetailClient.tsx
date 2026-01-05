'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EpdImpactRecord, EpdRecord } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';

const STAGES = ['A1', 'A2', 'A3', 'A1-A3', 'D'] as const;

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
  const router = useRouter();
  // gebruiker kan straks zelf kiezen welke impactcategorieën zichtbaar zijn
  const [visibleIndicators, setVisibleIndicators] = useState<string[]>(['MKI', 'GWP']);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const findImpact = (indicator: string, setType: string, stage: string) => {
    const exact = impacts.find((i) => i.indicator === indicator && i.set_type === setType && i.stage === stage)?.value;
    if (exact !== undefined && exact !== null) return exact;
    if (indicator === 'MKI') {
      return (
        impacts.find((i) => i.indicator === 'ECI' && i.set_type === setType && i.stage === stage)?.value ?? '-'
      );
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <Badge variant="brand">EPD detail</Badge>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{epd.product_name}</CardTitle>
              <CardDescription>{epd.functional_unit}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push(`/epd/${epd.id}/edit`)}>
                Bewerken
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={deleteLoading}
                onClick={async () => {
                  if (!confirm('Weet je zeker dat je deze EPD wilt verwijderen?')) return;
                  setDeleteLoading(true);
                  setDeleteError(null);
                  try {
                    const res = await fetch(`/api/epd/${epd.id}`, { method: 'DELETE' });
                    if (!res.ok) {
                      const json = await res.json().catch(() => ({}));
                      throw new Error(json?.error || 'Verwijderen mislukt');
                    }
                    router.push('/epd-database');
                    router.refresh();
                  } catch (err) {
                    setDeleteError((err as Error).message);
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
              >
                Verwijderen
              </Button>
            </div>
          </div>
        </CardHeader>

        {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}

        <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="mt-4 text-sm">
            <p className="text-gray-500">Originele PDF</p>
            <a
              className="font-semibold text-brand-700 hover:text-brand-800"
              href={`${supabaseUrl}/storage/v1/object/public/${bucket}/${epd.storage_path}`}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impactwaarden</CardTitle>
          <CardDescription>Kies de categorieën die je wilt zien.</CardDescription>
        </CardHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          {indicatorOptions.map((ind) => {
            const active = visibleIndicators.includes(ind);
            return (
              <Button
                key={ind}
                type="button"
                variant={active ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => toggleIndicator(ind)}
              >
                {ind}
              </Button>
            );
          })}
        </div>

        <div className="mt-6 space-y-6">
          {visibleIndicators.map((indicator) => (
            <div key={indicator} className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">{indicator}</h4>
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Set</TableHeaderCell>
                      {STAGES.map((stage) => (
                        <TableHeaderCell key={stage}>{stage.replace('_', '-')}</TableHeaderCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {SETS.map((setType) => (
                      <TableRow key={`${indicator}-${setType}`}>
                        <TableCell>{setType}</TableCell>
                        {STAGES.map((stage) => (
                          <TableCell key={`${indicator}-${setType}-${stage}`}>
                            {findImpact(indicator, setType, stage)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-gray-500">
                Tip: als een waarde “-” is, staat hij niet in de DB voor deze indicator/set/stage.
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom velden</CardTitle>
          <CardDescription>Extra metadata.</CardDescription>
        </CardHeader>
        {Object.keys(epd.custom_attributes || {}).length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Geen extra velden.</p>
        ) : (
          <ul className="mt-4 list-disc pl-5 text-sm text-gray-700">
            {Object.entries(epd.custom_attributes).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
