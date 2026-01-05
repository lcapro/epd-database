'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType, ImpactIndicator } from '@/lib/types';
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
import { buttonStyles } from '@/components/ui/button';
import { ensureSupabaseSession } from '@/lib/auth/ensureSupabaseSession';
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

export default function UploadPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedEpd | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeOrgChecked, setActiveOrgChecked] = useState(false);

  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  // impact values + units (units per indicator)
  const [impactValues, setImpactValues] = useState<ImpactState>({});
  const [impactUnits, setImpactUnits] = useState<UnitState>(() => {
    const init: UnitState = {};
    for (const code of ALL_INDICATOR_CODES) {
      init[code] = IMPACT_INDICATORS[code].defaultUnit;
    }
    return init;
  });

  const [form, setForm] = useState({
    productName: '',
    functionalUnit: '',
    producerName: '',
    lcaMethod: '',
    pcrVersion: '',
    databaseName: '',
    databaseNmdVersion: '',
    databaseEcoinventVersion: '',
    publicationDate: '',
    expirationDate: '',
    verifierName: '',
    standardSet: 'UNKNOWN' as EpdSetType,
  });

  useEffect(() => {
    const loadActiveOrg = async () => {
      try {
        let res = await fetch('/api/org/active', { cache: 'no-store' });
        if (res.status === 401) {
          const refreshed = await ensureSupabaseSession();
          if (refreshed) {
            res = await fetch('/api/org/active', { cache: 'no-store' });
          }
        }
        if (res.ok) {
          const json = (await res.json()) as { organizationId: string | null };
          setActiveOrgId(json.organizationId ?? null);
        }
      } finally {
        setActiveOrgChecked(true);
      }
    };
    loadActiveOrg();
  }, []);

  const impactKey = (indicator: string, setType: EpdSetType, stage: EpdImpactStage) =>
    `${indicator}|${setType}|${stage}`;

  const updateImpact = (indicator: string, setType: EpdSetType, stage: EpdImpactStage, value: string) => {
    setImpactValues((prev) => ({
      ...prev,
      [impactKey(indicator, setType, stage)]: value === '' ? '' : Number(value),
    }));
  };

  const formatNumberForInput = (value: number) => {
    if (Number.isNaN(value) || !Number.isFinite(value)) return '';
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1e-6 && abs < 1e6) return value.toString();
    const fixed = value.toFixed(18);
    return fixed.replace(/\.?0+$/, '');
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

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Laad parser-output in formulier + impact state
  const loadParsedIntoForm = (data: ParsedEpd) => {
    setForm({
      productName: data.productName || '',
      functionalUnit: data.functionalUnit || '',
      producerName: data.producerName || '',
      lcaMethod: data.lcaMethod || '',
      pcrVersion: data.pcrVersion || '',
      databaseName: data.databaseName || '',
      databaseNmdVersion: data.databaseNmdVersion || '',
      databaseEcoinventVersion: data.databaseEcoinventVersion || '',
      publicationDate: data.publicationDate || '',
      expirationDate: data.expirationDate || '',
      verifierName: data.verifierName || '',
      standardSet: data.standardSet || 'UNKNOWN',
    });

    // impact values
    const nextValues: ImpactState = {};
    const nextUnits: UnitState = { ...impactUnits };

    for (const impact of data.impacts || []) {
      const rawIndicator = String(impact.indicator || '').trim();
      if (!rawIndicator) continue;

      const indicator = rawIndicator === 'ECI' ? 'MKI' : rawIndicator;
      const key = impactKey(indicator, impact.setType, impact.stage);

      if (impact.unit && indicator) {
        if (!nextUnits[indicator]) {
          nextUnits[indicator] = impact.unit;
        }
      } else if (isKnownIndicator(indicator) && !nextUnits[indicator]) {
        nextUnits[indicator] = IMPACT_INDICATORS[indicator].defaultUnit;
      }

      if (nextValues[key] === undefined) {
        nextValues[key] = formatNumberForInput(impact.value);
      }
    }

    setImpactUnits(nextUnits);
    setImpactValues(nextValues);
  };

  const uploadFile = async () => {
    if (!file) {
      setError('Kies een PDF-bestand om te uploaden.');
      return;
    }

    setLoading(true);
    setError(null);
    setParseWarning(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (activeOrgId) {
        formData.append('organizationId', activeOrgId);
      }

      const res = await fetch('/api/epd/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorMessage = await parseErrorResponse(res);
        throw new Error(errorMessage || 'Upload mislukt');
      }

      const json = await res.json();
      setFileId(json.fileId);
      setParsed(json.parsedEpd ?? null);
      setRawText(typeof json.rawText === 'string' ? json.rawText : '');

      if (json.parseError) {
        setParseWarning(`Kon PDF-tekst niet uitlezen: ${json.parseError}. Vul de velden handmatig in.`);
      }

      if (json.parsedEpd) {
        loadParsedIntoForm(json.parsedEpd);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!fileId) {
      setError('Upload eerst een bestand.');
      return;
    }
    if (!form.productName || !form.functionalUnit) {
      setError('Productnaam en functionele eenheid zijn verplicht.');
      return;
    }

    setLoading(true);
    setError(null);

    // Maak ParsedImpact[] uit state (incl unit per indicator)
    const impacts: ParsedImpact[] = Object.entries(impactValues)
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
      const res = await fetch('/api/epd/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          ...form,
          standardSet: form.standardSet,
          customAttributes,
          impacts,
          organizationId: activeOrgId,
        }),
      });

      if (!res.ok) throw new Error('Opslaan mislukt');

      const json = await res.json();
      router.push(`/epd/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // UI helpers: indicator groepen
  const groupedIndicators = useMemo(() => {
    const groups: Record<string, ImpactIndicatorCode[]> = {
      Kern: [],
      Impact: [],
      Resources: [],
      Waste: [],
    };

    for (const code of ALL_INDICATOR_CODES) {
      const g = IMPACT_INDICATORS[code].group;
      groups[g].push(code);
    }
    return groups;
  }, []);

  // Render 1 indicator-table (met values)
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

  const parsedInfo = useMemo(() => {
    if (!parsed) return null;
    return (
      <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Gevonden velden uit PDF:</p>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
          <div><strong>Product:</strong> {parsed.productName || '-'}</div>
          <div><strong>Functionele eenheid:</strong> {parsed.functionalUnit || '-'}</div>
          <div><strong>Producent:</strong> {parsed.producerName || '-'}</div>
          <div><strong>Publicatie:</strong> {parsed.publicationDate || '-'}</div>
          <div><strong>Geldigheid:</strong> {parsed.expirationDate || '-'}</div>
          <div><strong>Set:</strong> {parsed.standardSet}</div>
          <div><strong>NMD database:</strong> {parsed.databaseNmdVersion || '-'}</div>
          <div><strong>EcoInvent:</strong> {parsed.databaseEcoinventVersion || '-'}</div>
        </div>
      </div>
    );
  }, [parsed]);

  if (activeOrgChecked && !activeOrgId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Badge variant="brand">EPD upload</Badge>
            <CardTitle className="mt-2">Kies een organisatie</CardTitle>
            <CardDescription>
              Selecteer een actieve organisatie voordat je een EPD kunt verwerken.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Link href="/org" className={buttonStyles({})}>
              Kies organisatie
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="brand">Nieuwe upload</Badge>
            <CardTitle className="mt-2">Nieuwe EPD uploaden</CardTitle>
            <CardDescription>Upload een PDF en controleer de gegevens.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={uploadFile} disabled={loading} loading={loading}>
              PDF verwerken
            </Button>
            <Link href="/epd/upload/bulk" className={buttonStyles({ variant: 'secondary' })}>
              Meerdere uploads
            </Link>
          </div>
        </CardHeader>

        <div
          className="mt-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-sm text-gray-600">Sleep een PDF hierheen of kies een bestand.</p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-3 text-sm"
          />
          {file && <p className="mt-2 text-sm text-gray-700">Geselecteerd: {file.name}</p>}
          {previewUrl && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <iframe title="PDF preview" src={previewUrl} className="h-72 w-full" />
            </div>
          )}
        </div>

        {parsedInfo}
        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}
        {parseWarning && <Alert variant="warning" className="mt-4">{parseWarning}</Alert>}
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

      {/* IMPACT TABELLEN */}
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
          Opslaan in database
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/epd-database')}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
