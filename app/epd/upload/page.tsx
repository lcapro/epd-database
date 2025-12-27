'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from '@/lib/types';

/**
 * Stap 4 – Upload UI (volledig)
 * - Ondersteunt ALLE impactcategorieën (niet alleen MKI/CO2)
 * - Gebruiker kan kiezen welke categorieën zichtbaar zijn
 * - Units worden per categorie opgeslagen/meegegeven (bijv. Euro, kg CO2-eq, kg Sb-eq, MJ, etc.)
 *
 * Verwachting:
 * - ParsedImpact bevat minimaal: { indicator: string, setType, stage, value, unit? }
 *   (Als jouw ParsedImpact indicator nog 'MKI'|'CO2' is, pas types stap 2/3 aan.)
 */

const stages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1_A3', 'D'];

// Als je alleen set1/set2 wilt laten invullen in UI, laat UNKNOWN weg.
// (In DB mag UNKNOWN nog wel bestaan.)
const sets: { value: EpdSetType; label: string }[] = [
  { value: 'UNKNOWN', label: 'Onbekend' },
  { value: 'SBK_SET_1', label: 'SBK set 1 (+A1)' },
  { value: 'SBK_SET_2', label: 'SBK set 2 (+A2)' }
];

/**
 * Masterlijst van categorieën die je uiteindelijk wil ondersteunen.
 * Je kunt dit later uitbreiden zonder je datamodel te slopen.
 * label = wat de gebruiker ziet
 * unitHint = suggestie; echte unit komt bij voorkeur uit parsing (PDF) of user input
 */
const IMPACT_CATEGORIES: { key: string; label: string; unitHint?: string; group: 'Kern' | 'Impact' | 'Resources' | 'Waste' }[] =
  [
    // Kern
    { key: 'MKI', label: 'MKI', unitHint: 'Euro', group: 'Kern' },
    { key: 'GWP', label: 'GWP (klimaatverandering)', unitHint: 'kg CO2-eq', group: 'Kern' },

    // Impact (EN15804)
    { key: 'ADPE', label: 'ADPE (abiotische uitputting, elementen)', unitHint: 'kg Sb-eq', group: 'Impact' },
    { key: 'ADPF', label: 'ADPF (abiotische uitputting, fossiel)', unitHint: 'MJ', group: 'Impact' },
    { key: 'ODP', label: 'ODP (ozonlaag aantasting)', unitHint: 'kg CFC-11-eq', group: 'Impact' },
    { key: 'POCP', label: 'POCP (fotochemische oxidantvorming)', unitHint: 'kg ethene-eq', group: 'Impact' },
    { key: 'AP', label: 'AP (verzuring)', unitHint: 'kg SO2-eq', group: 'Impact' },
    { key: 'EP', label: 'EP (vermesting)', unitHint: 'kg PO4-eq', group: 'Impact' },
    { key: 'HTP', label: 'HTP (humaan-toxicologisch)', unitHint: 'kg 1,4-DB-eq', group: 'Impact' },
    { key: 'FAETP', label: 'FAETP (eco-toxicologisch zoetwater)', unitHint: 'kg 1,4-DB-eq', group: 'Impact' },
    { key: 'MAETP', label: 'MAETP (eco-toxicologisch zeewater)', unitHint: 'kg 1,4-DB-eq', group: 'Impact' },
    { key: 'TETP', label: 'TETP (eco-toxicologisch terrestisch)', unitHint: 'kg 1,4-DB-eq', group: 'Impact' },

    // Resources (EN15804)
    { key: 'PERE', label: 'PERE (hernieuwbare primaire energie excl. materiaal)', unitHint: 'MJ', group: 'Resources' },
    { key: 'PERM', label: 'PERM (hernieuwbare primaire energie als materiaal)', unitHint: 'MJ', group: 'Resources' },
    { key: 'PERT', label: 'PERT (totaal hernieuwbare primaire energie)', unitHint: 'MJ', group: 'Resources' },
    { key: 'PENRE', label: 'PENRE (niet-hernieuwbare primaire energie excl. materiaal)', unitHint: 'MJ', group: 'Resources' },
    { key: 'PENRM', label: 'PENRM (niet-hernieuwbare primaire energie als materiaal)', unitHint: 'MJ', group: 'Resources' },
    { key: 'PENRT', label: 'PENRT (totaal niet-hernieuwbare primaire energie)', unitHint: 'MJ', group: 'Resources' },
    { key: 'PET', label: 'PET (energie primair totaal)', unitHint: 'MJ', group: 'Resources' },
    { key: 'SM', label: 'SM (secundaire materialen)', unitHint: 'kg', group: 'Resources' },
    { key: 'RSF', label: 'RSF (hernieuwbare secundaire brandstoffen)', unitHint: 'MJ', group: 'Resources' },
    { key: 'NRSF', label: 'NRSF (niet-hernieuwbare secundaire brandstoffen)', unitHint: 'MJ', group: 'Resources' },
    { key: 'FW', label: 'FW (waterverbruik)', unitHint: 'm3', group: 'Resources' },

    // Waste/outputs (EN15804)
    { key: 'HWD', label: 'HWD (gevaarlijk afval)', unitHint: 'kg', group: 'Waste' },
    { key: 'NHWD', label: 'NHWD (niet-gevaarlijk afval)', unitHint: 'kg', group: 'Waste' },
    { key: 'RWD', label: 'RWD (radioactief afval)', unitHint: 'kg', group: 'Waste' },
    { key: 'CRU', label: 'CRU (materialen voor hergebruik)', unitHint: 'kg', group: 'Waste' },
    { key: 'MFR', label: 'MFR (materialen voor recycling)', unitHint: 'kg', group: 'Waste' },
    { key: 'MER', label: 'MER (materialen voor energie)', unitHint: 'kg', group: 'Waste' },
    { key: 'EE', label: 'EE (geëxporteerde energie)', unitHint: 'MJ', group: 'Waste' },
    { key: 'EET', label: 'EET (geëxporteerde energie thermisch)', unitHint: 'MJ', group: 'Waste' },
    { key: 'EEE', label: 'EEE (geëxporteerde energie elektrisch)', unitHint: 'MJ', group: 'Waste' }
  ];

type ImpactState = Record<string, number | ''>;
type UnitState = Record<string, string>; // indicator -> unit (bijv. 'kg CO2-eq')

// Key: `${indicator}|${setType}|${stage}`
const impactKey = (indicator: string, setType: EpdSetType, stage: EpdImpactStage) =>
  `${indicator}|${setType}|${stage}`;

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
    standardSet: 'UNKNOWN' as EpdSetType
  });

  const [impactValues, setImpactValues] = useState<ImpactState>({});
  const [impactUnits, setImpactUnits] = useState<UnitState>({});

  // Zichtbare categorieën (default: alles wat in PDF gevonden is + MKI + GWP)
  const [visibleIndicators, setVisibleIndicators] = useState<string[]>(['MKI', 'GWP']);

  const parseErrorResponse = async (res: Response) => {
    try {
      const data = await res.json();
      if (typeof data?.error === 'string') return data.error;
      if (typeof data?.message === 'string') return data.message;
    } catch {
      // ignore
    }
    return null;
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const setDefaultUnitsFromHints = () => {
    const next: UnitState = {};
    IMPACT_CATEGORIES.forEach((c) => {
      if (c.unitHint) next[c.key] = c.unitHint;
    });
    setImpactUnits((prev) => ({ ...next, ...prev }));
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
      standardSet: data.standardSet || 'UNKNOWN'
    });

    // Vul units met hints, daarna overschrijven met units die uit PDF komen
    setDefaultUnitsFromHints();

    const impactsState: ImpactState = {};
    const unitsState: UnitState = {};

    (data.impacts ?? []).forEach((impact: any) => {
      // impact.indicator kan bv 'MKI', 'GWP', 'ADPE', ...
      const ind = String(impact.indicator);
      impactsState[impactKey(ind, impact.setType, impact.stage)] = impact.value;

      if (impact.unit) {
        unitsState[ind] = String(impact.unit);
      }
    });

    setImpactValues(impactsState);
    setImpactUnits((prev) => ({ ...prev, ...unitsState }));

    // Auto: laat alles zien wat in PDF voorkomt, plus MKI/GWP
    const foundIndicators = Array.from(
      new Set((data.impacts ?? []).map((i: any) => String(i.indicator)))
    );
    const merged = Array.from(new Set(['MKI', 'GWP', ...foundIndicators]));
    setVisibleIndicators(merged);
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

      const res = await fetch('/api/epd/upload', { method: 'POST', body: formData });

      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        throw new Error(msg || 'Upload mislukt');
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

  const updateImpact = (indicator: string, setType: EpdSetType, stage: EpdImpactStage, value: string) => {
    setImpactValues((prev) => ({
      ...prev,
      [impactKey(indicator, setType, stage)]: value === '' ? '' : Number(value)
    }));
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

    // Maak ParsedImpact[] uit state
    // LET OP: jouw ParsedImpact type moet indicator als string accepteren en unit ondersteunen.
    const impacts: ParsedImpact[] = Object.entries(impactValues)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => {
        const [indicator, setType, stage] = key.split('|');
        return {
          indicator,
          setType: setType as EpdSetType,
          stage: stage as EpdImpactStage,
          value: Number(value),
          // @ts-expect-error: unit toevoegen in types stap 2/3
          unit: impactUnits[indicator] || ''
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
          impacts
        })
      });

      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        throw new Error(msg || 'Opslaan mislukt');
      }

      const json = await res.json();
      router.push(`/epd/${json.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const indicatorLabel = (key: string) =>
    IMPACT_CATEGORIES.find((c) => c.key === key)?.label ?? key;

  const indicatorGroup = (key: string) =>
    IMPACT_CATEGORIES.find((c) => c.key === key)?.group ?? 'Impact';

  const allIndicatorsInMasterList = useMemo(
    () => IMPACT_CATEGORIES.map((c) => c.key),
    []
  );

  const indicatorsToRender = useMemo(() => {
    // Als user iets typt / PDF een onbekende indicator heeft, willen we die ook kunnen tonen
    const fromParsed = parsed?.impacts ? Array.from(new Set(parsed.impacts.map((i: any) => String(i.indicator)))) : [];
    const merged = Array.from(new Set([...allIndicatorsInMasterList, ...fromParsed]));
    // Alleen de aangevinkte laten zien (maar in vaste volgorde: master eerst, daarna rest)
    return merged.filter((k) => visibleIndicators.includes(k));
  }, [parsed, visibleIndicators, allIndicatorsInMasterList]);

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

  const renderImpactTableForSet = (setType: EpdSetType) => {
    return (
      <div className="space-y-3">
        <div className="flex-between">
          <h4 className="font-semibold">{setType}</h4>
        </div>

        {indicatorsToRender.length === 0 ? (
          <p className="text-sm text-slate-600">Selecteer minimaal één impactcategorie om te tonen.</p>
        ) : (
          <div className="space-y-4">
            {indicatorsToRender.map((indicator) => (
              <div key={`${setType}-${indicator}`} className="space-y-2">
                <div className="flex-between gap-3">
                  <div className="text-sm">
                    <strong>{indicatorLabel(indicator)}</strong>
                    <span className="text-slate-500"> ({indicator})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Unit</span>
                    <input
                      className="input"
                      style={{ maxWidth: 180 }}
                      value={impactUnits[indicator] ?? ''}
                      onChange={(e) =>
                        setImpactUnits((prev) => ({ ...prev, [indicator]: e.target.value }))
                      }
                      placeholder="bijv. kg CO2-eq"
                    />
                  </div>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      {stages.map((stage) => (
                        <th key={stage}>{stage.replace('_', '-')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {stages.map((stage) => {
                        const key = impactKey(indicator, setType, stage);
                        return (
                          <td key={key}>
                            <input
                              type="number"
                              step="0.000001"
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
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const groupedIndicatorOptions = useMemo(() => {
    const groups: Record<string, string[]> = { Kern: [], Impact: [], Resources: [], Waste: [] };
    IMPACT_CATEGORIES.forEach((c) => groups[c.group].push(c.key));

    // Voeg eventueel onbekende indicators uit PDF toe (in Impact groep)
    const fromParsed = parsed?.impacts ? Array.from(new Set(parsed.impacts.map((i: any) => String(i.indicator)))) : [];
    fromParsed.forEach((k) => {
      if (!IMPACT_CATEGORIES.some((c) => c.key === k)) {
        groups.Impact.push(k);
      }
    });

    return groups;
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
        <div className="flex-between gap-3">
          <div>
            <h3 className="font-semibold">Impactcategorieën</h3>
            <p className="text-sm text-slate-600">
              Kies welke categorieën zichtbaar zijn. (Alles wordt opgeslagen als je waarden invult.)
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setVisibleIndicators(Array.from(new Set(IMPACT_CATEGORIES.map((c) => c.key))))}
            >
              Alles tonen
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setVisibleIndicators(['MKI', 'GWP'])}
            >
              Alleen kern
            </button>
          </div>
        </div>

        <div className="grid-two">
          {(['Kern', 'Impact', 'Resources', 'Waste'] as const).map((grp) => (
            <div className="card" key={grp}>
              <h4 className="font-semibold">{grp}</h4>
              <div className="mt-2 space-y-1">
                {(groupedIndicatorOptions[grp] ?? []).map((k) => {
                  const checked = visibleIndicators.includes(k);
                  return (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setVisibleIndicators((prev) => {
                            if (prev.includes(k)) return prev.filter((x) => x !== k);
                            return [...prev, k];
                          });
                        }}
                      />
                      <span>{indicatorLabel(k)}</span>
                      <span className="text-slate-500">({k})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">Impactwaarden (per set)</h3>

        <div className="space-y-6">
          {(['SBK_SET_1', 'SBK_SET_2'] as EpdSetType[]).map((setType) => (
            <div key={setType} className="space-y-2">
              {renderImpactTableForSet(setType)}
            </div>
          ))}
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

      <div className="text-xs text-slate-500">
        <p>
          Tip: als een categorie niet automatisch uit de PDF komt, vink hem aan en vul handmatig in.
          Later verbeteren we de parser zodat dit steeds beter automatisch gaat.
        </p>
      </div>
    </form>
  );
}
