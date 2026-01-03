'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EpdImpactRecord, EpdRecord, EpdImpactStage, EpdSetType, ParsedImpact, ImpactIndicator } from '@/lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';
import {
  ALL_INDICATOR_CODES,
  IMPACT_INDICATORS,
  INDICATOR_CODES_SET_1,
  INDICATOR_CODES_SET_2,
  isKnownIndicator,
  ImpactIndicatorCode,
} from '@/lib/impactIndicators';

const stages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1-A3', 'D'];

const sets: { value: EpdSetType; label: string }[] = [
  { value: 'UNKNOWN', label: 'Onbekend' },
  { value: 'SBK_SET_1', label: 'SBK set 1 (+A1)' },
  { value: 'SBK_SET_2', label: 'SBK set 2 (+A2)' },
  { value: 'SBK_BOTH', label: 'Beide sets (A1 + A2)' },
];

type ImpactState = Record<string, number | '' | string>;
type UnitState = Record<string, string>;

type Props = {
  epd: EpdRecord;
  impacts: EpdImpactRecord[];
};

export default function EpdEditClient({ epd, impacts }: Props) {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    productName: epd.product_name ?? '',
    functionalUnit: epd.functional_unit ?? '',
    producerName: epd.producer_name ?? '',
    lcaMethod: epd.lca_method ?? '',
    pcrVersion: epd.pcr_version ?? '',
    databaseName: epd.database_name ?? '',
    databaseNmdVersion: epd.database_nmd_version ?? '',
    databaseEcoinventVersion: epd.database_ecoinvent_version ?? '',
    publicationDate: epd.publication_date ?? '',
    expirationDate: epd.expiration_date ?? '',
    verifierName: epd.verifier_name ?? '',
    standardSet: epd.standard_set ?? 'UNKNOWN',
  });

  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>(
    Object.entries(epd.custom_attributes || {}).map(([key, value]) => ({ key, value })),
  );

  const impactKey = (indicator: string, setType: EpdSetType, stage: EpdImpactStage) =>
    `${indicator}|${setType}|${stage}`;

  const formatNumberForInput = (value: number) => {
    if (Number.isNaN(value) || !Number.isFinite(value)) return '';
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1e-6 && abs < 1e6) return value.toString();
    const fixed = value.toFixed(18);
    return fixed.replace(/\.?0+$/, '');
  };

  const initialImpactState = useMemo(() => {
    const values: ImpactState = {};
    const units: UnitState = {};
    for (const code of ALL_INDICATOR_CODES) {
      units[code] = IMPACT_INDICATORS[code].defaultUnit;
    }

    for (const impact of impacts) {
      const rawIndicator = String(impact.indicator || '').trim();
      if (!rawIndicator) continue;

      const indicator = rawIndicator === 'ECI' ? 'MKI' : rawIndicator;
      const key = impactKey(indicator, impact.set_type, impact.stage);
      if (impact.unit && indicator) {
        if (!units[indicator]) {
          units[indicator] = impact.unit;
        }
      } else if (isKnownIndicator(indicator) && !units[indicator]) {
        units[indicator] = IMPACT_INDICATORS[indicator].defaultUnit;
      }
      if (impact.value !== null && impact.value !== undefined && values[key] === undefined) {
        values[key] = formatNumberForInput(impact.value);
      }
    }

    return { values, units };
  }, [impacts]);

  const [impactValues, setImpactValues] = useState<ImpactState>(initialImpactState.values);
  const [impactUnits] = useState<UnitState>(initialImpactState.units);

  const updateImpact = (indicator: string, setType: EpdSetType, stage: EpdImpactStage, value: string) => {
    setImpactValues((prev) => ({
      ...prev,
      [impactKey(indicator, setType, stage)]: value === '' ? '' : Number(value),
    }));
  };

  const parseErrorResponse = async (res: Response) => {
    try {
      const data = await res.json();
      if (typeof data?.error === 'string') return data.error;
      if (typeof data?.message === 'string') return data.message;
    } catch (err) {
      console.error('Kon foutmelding niet parsen', err);
    }
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.productName || !form.functionalUnit) {
      setError('Productnaam en functionele eenheid zijn verplicht.');
      return;
    }

    setLoading(true);
    setError(null);

    const impactsPayload: ParsedImpact[] = Object.entries(impactValues)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => {
        const [indicator, setType, stage] = key.split('|');
        return {
          indicator: indicator as ImpactIndicator,
          setType: setType as EpdSetType,
          stage: stage as EpdImpactStage,
          value: Number(value),
          unit: impactUnits[indicator] || '',
        };
      });

    const customAttributes = customFields.reduce<Record<string, string>>((acc, cur) => {
      if (cur.key) acc[cur.key] = cur.value;
      return acc;
    }, {});

    try {
      const res = await fetch(`/api/epd/${epd.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          standardSet: form.standardSet,
          customAttributes,
          impacts: impactsPayload,
        }),
      });

      if (!res.ok) {
        const errorMessage = await parseErrorResponse(res);
        throw new Error(errorMessage || 'Opslaan mislukt');
      }

      router.push(`/epd/${epd.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const renderIndicatorTable = (indicator: ImpactIndicatorCode, setType: EpdSetType) => {
    const meta = IMPACT_INDICATORS[indicator];
    const unit = impactUnits[indicator] || meta.defaultUnit;

    return (
      <div key={`${indicator}-${setType}`} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-800">
            {meta.label} ({indicator})
          </div>
          <div className="text-xs text-gray-500">Unit: {unit || '-'}</div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <Table>
            <TableHead>
              <TableRow>
                {stages.map((stage) => (
                  <TableHeaderCell key={stage}>{stage.replace('_', '-')}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                {stages.map((stage) => {
                  const key = impactKey(indicator, setType, stage);
                  return (
                    <TableCell key={key}>
                      <Input
                        type="number"
                        step="any"
                        value={impactValues[key] ?? ''}
                        onChange={(e) => updateImpact(indicator, setType, stage, e.target.value)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <Badge variant="brand">Bewerk EPD</Badge>
          <CardTitle className="mt-2">EPD aanpassen</CardTitle>
          <CardDescription>Werk velden bij en sla opnieuw op.</CardDescription>
        </CardHeader>
        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basisgegevens</CardTitle>
          <CardDescription>Controleer de kerngegevens.</CardDescription>
        </CardHeader>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="Productnaam" required>
            <Input
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Functionele eenheid" required>
            <Input
              value={form.functionalUnit}
              onChange={(e) => setForm({ ...form, functionalUnit: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Producent">
            <Input
              value={form.producerName}
              onChange={(e) => setForm({ ...form, producerName: e.target.value })}
            />
          </FormField>

          <FormField label="LCA-methode">
            <Input
              value={form.lcaMethod}
              onChange={(e) => setForm({ ...form, lcaMethod: e.target.value })}
            />
          </FormField>

          <FormField label="PCR-versie">
            <Input
              value={form.pcrVersion}
              onChange={(e) => setForm({ ...form, pcrVersion: e.target.value })}
            />
          </FormField>

          <FormField label="Database">
            <Input
              value={form.databaseName}
              onChange={(e) => setForm({ ...form, databaseName: e.target.value })}
            />
          </FormField>

          <FormField label="NMD database versie">
            <Input
              value={form.databaseNmdVersion}
              onChange={(e) => setForm({ ...form, databaseNmdVersion: e.target.value })}
              placeholder="bijv. NMD v3.5"
            />
          </FormField>

          <FormField label="EcoInvent versie">
            <Input
              value={form.databaseEcoinventVersion}
              onChange={(e) => setForm({ ...form, databaseEcoinventVersion: e.target.value })}
              placeholder="bijv. EcoInvent v3.6"
            />
          </FormField>

          <FormField label="Datum publicatie">
            <Input
              type="date"
              value={form.publicationDate}
              onChange={(e) => setForm({ ...form, publicationDate: e.target.value })}
            />
          </FormField>

          <FormField label="Einde geldigheid">
            <Input
              type="date"
              value={form.expirationDate}
              onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
            />
          </FormField>

          <FormField label="Naam toetser / verificateur">
            <Input
              value={form.verifierName}
              onChange={(e) => setForm({ ...form, verifierName: e.target.value })}
            />
          </FormField>

          <FormField label="SBK set">
            <Select
              value={form.standardSet}
              onChange={(e) => setForm({ ...form, standardSet: e.target.value as EpdSetType })}
            >
              {sets.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impactwaarden (per set)</CardTitle>
          <CardDescription>Vul ontbrekende waarden handmatig in.</CardDescription>
        </CardHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-800">SBK_SET_1</h4>
            {INDICATOR_CODES_SET_1.map((code) => renderIndicatorTable(code, 'SBK_SET_1'))}
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-6">
            <h4 className="text-sm font-semibold text-gray-800">SBK_SET_2</h4>
            {INDICATOR_CODES_SET_2.map((code) => renderIndicatorTable(code, 'SBK_SET_2'))}
          </div>

          <p className="text-xs text-gray-500">
            Tip: ontbreekt er een waarde? Vul die handmatig in.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Extra velden</CardTitle>
            <CardDescription>Voeg extra metadata toe.</CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCustomFields((fields) => [...fields, { key: '', value: '' }])}
          >
            Voeg veld toe
          </Button>
        </CardHeader>

        {customFields.length === 0 && (
          <p className="mt-4 text-sm text-gray-600">Geen extra velden toegevoegd.</p>
        )}

        <div className="mt-4 space-y-3">
          {customFields.map((field, idx) => (
            <div className="grid gap-3 md:grid-cols-[1fr_2fr]" key={idx}>
              <Input
                placeholder="Sleutel"
                value={field.key}
                onChange={(e) =>
                  setCustomFields((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], key: e.target.value };
                    return next;
                  })
                }
              />
              <div className="flex flex-wrap gap-2">
                <Input
                  className="flex-1"
                  placeholder="Waarde"
                  value={field.value}
                  onChange={(e) =>
                    setCustomFields((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], value: e.target.value };
                      return next;
                    })
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Verwijder
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={loading} loading={loading}>
          Wijzigingen opslaan
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(`/epd/${epd.id}`)}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
