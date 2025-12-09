'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from '@/lib/types';

const stages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1_A3', 'D'];
const sets: { value: EpdSetType; label: string }[] = [
  { value: 'UNKNOWN', label: 'Onbekend' },
  { value: 'SBK_SET_1', label: 'SBK set 1 (+A1)' },
  { value: 'SBK_SET_2', label: 'SBK set 2 (+A2)' },
];

type ImpactState = Record<string, number | ''>;

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedEpd | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  const [form, setForm] = useState({
    productName: '',
    functionalUnit: '',
    producerName: '',
    lcaMethod: '',
    pcrVersion: '',
    databaseName: '',
    publicationDate: '',
    expirationDate: '',
    verifierName: '',
    standardSet: 'UNKNOWN' as EpdSetType,
  });

  const [impactValues, setImpactValues] = useState<ImpactState>({});

  const impactKey = (indicator: 'MKI' | 'CO2', setType: EpdSetType, stage: EpdImpactStage) =>
    `${indicator}|${setType}|${stage}`;

  const updateImpact = (indicator: 'MKI' | 'CO2', setType: EpdSetType, stage: EpdImpactStage, value: string) => {
    setImpactValues((prev) => ({ ...prev, [impactKey(indicator, setType, stage)]: value === '' ? '' : Number(value) }));
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

  const loadParsedIntoForm = (data: ParsedEpd) => {
    setForm({
      productName: data.productName || '',
      functionalUnit: data.functionalUnit || '',
      producerName: data.producerName || '',
      lcaMethod: data.lcaMethod || '',
      pcrVersion: data.pcrVersion || '',
      databaseName: data.databaseName || '',
      publicationDate: data.publicationDate || '',
      expirationDate: data.expirationDate || '',
      verifierName: data.verifierName || '',
      standardSet: data.standardSet || 'UNKNOWN',
    });
    const impacts: ImpactState = {};
    data.impacts.forEach((impact) => {
      impacts[impactKey(impact.indicator, impact.setType, impact.stage)] = impact.value;
    });
    setImpactValues(impacts);
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

    const impacts: ParsedImpact[] = Object.entries(impactValues)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => {
        const [indicator, setType, stage] = key.split('|');
        return {
          indicator: indicator as 'MKI' | 'CO2',
          setType: setType as EpdSetType,
          stage: stage as EpdImpactStage,
          value: Number(value),
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

  const renderImpactInputs = (indicator: 'MKI' | 'CO2', setType: EpdSetType) => (
    <table className="table">
      <thead>
        <tr>
          <th>{indicator}</th>
          {stages.map((stage) => (
            <th key={stage}>{stage.replace('_', '-')}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{setType}</td>
          {stages.map((stage) => {
            const key = impactKey(indicator, setType, stage);
            return (
              <td key={key}>
                <input
                  type="number"
                  step="0.001"
                  className="input"
                  value={impactValues[key] ?? ''}
                  onChange={(e) => updateImpact(indicator, setType, stage, e.target.value)}
                />
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );

  const parsedInfo = useMemo(() => {
    if (!parsed) return null;
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
        <p className="text-sm text-slate-600">Gevonden velden uit PDF:</p>
        <div className="grid-two mt-2 text-sm">
          <div><strong>Product:</strong> {parsed.productName || '-'}</div>
          <div><strong>Functionele eenheid:</strong> {parsed.functionalUnit || '-'}</div>
          <div><strong>Producent:</strong> {parsed.producerName || '-'}</div>
          <div><strong>Publicatie:</strong> {parsed.publicationDate || '-'}</div>
          <div><strong>Geldigheid:</strong> {parsed.expirationDate || '-'}</div>
          <div><strong>Set:</strong> {parsed.standardSet}</div>
        </div>
      </div>
    );
  }, [parsed]);

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="card space-y-4">
        <div className="flex-between">
          <div>
            <h2 className="text-lg font-semibold">Nieuwe EPD uploaden</h2>
            <p className="text-sm text-slate-600">Upload een PDF, controleer de waarden en sla op.</p>
          </div>
          <button type="button" className="button button-primary" onClick={uploadFile} disabled={loading}>
            PDF verwerken
          </button>
        </div>

        <div
          className="border-2 border-dashed border-slate-300 rounded-md p-6 bg-white text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-sm text-slate-600">Sleep een PDF hierheen of kies een bestand.</p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-3"
          />
          {file && <p className="text-sm mt-2">Geselecteerd: {file.name}</p>}
        </div>

        {parsedInfo}
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {parseWarning && <div className="text-amber-600 text-sm">{parseWarning}</div>}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Basisgegevens</h3>
        <div className="grid-two gap-3">
          <label className="space-y-1">
            <span className="text-sm">Productnaam</span>
            <input
              className="input"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Functionele eenheid</span>
            <input
              className="input"
              value={form.functionalUnit}
              onChange={(e) => setForm({ ...form, functionalUnit: e.target.value })}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Producent</span>
            <input
              className="input"
              value={form.producerName}
              onChange={(e) => setForm({ ...form, producerName: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">LCA-methode</span>
            <input
              className="input"
              value={form.lcaMethod}
              onChange={(e) => setForm({ ...form, lcaMethod: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">PCR-versie</span>
            <input
              className="input"
              value={form.pcrVersion}
              onChange={(e) => setForm({ ...form, pcrVersion: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Database</span>
            <input
              className="input"
              value={form.databaseName}
              onChange={(e) => setForm({ ...form, databaseName: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Datum publicatie</span>
            <input
              type="date"
              className="input"
              value={form.publicationDate}
              onChange={(e) => setForm({ ...form, publicationDate: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Einde geldigheid</span>
            <input
              type="date"
              className="input"
              value={form.expirationDate}
              onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Naam toetser / verificateur</span>
            <input
              className="input"
              value={form.verifierName}
              onChange={(e) => setForm({ ...form, verifierName: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">SBK set</span>
            <select
              className="select"
              value={form.standardSet}
              onChange={(e) => setForm({ ...form, standardSet: e.target.value as EpdSetType })}
            >
              {sets.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Impactwaarden</h3>
        <div className="space-y-4">
          {renderImpactInputs('MKI', 'SBK_SET_1')}
          {renderImpactInputs('CO2', 'SBK_SET_1')}
          {renderImpactInputs('MKI', 'SBK_SET_2')}
          {renderImpactInputs('CO2', 'SBK_SET_2')}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex-between">
          <h3 className="font-semibold">Extra velden</h3>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setCustomFields((fields) => [...fields, { key: '', value: '' }])}
          >
            Voeg veld toe
          </button>
        </div>
        {customFields.length === 0 && (
          <p className="text-sm text-slate-600">Geen extra velden toegevoegd.</p>
        )}
        <div className="space-y-2">
          {customFields.map((field, idx) => (
            <div className="grid-two gap-2" key={idx}>
              <input
                className="input"
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
              <div className="flex gap-2">
                <input
                  className="input flex-1"
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
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Verwijder
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="button button-primary" disabled={loading}>
          Opslaan in database
        </button>
        <button type="button" className="button button-secondary" onClick={() => router.push('/epd')}>
          Annuleren
        </button>
      </div>
    </form>
  );
}
