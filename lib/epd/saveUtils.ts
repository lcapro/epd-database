import type { EpdSetType, ParsedImpact } from '@/lib/types';

type DeterminationMethod = {
  name: 'NMD Bepalingsmethode';
  version: '1.0' | '1.1' | '1.2' | null;
};

type ParsedNumeric = {
  value: number | null;
  raw: string | number | null;
};

const DETERMINATION_NAME: DeterminationMethod['name'] = 'NMD Bepalingsmethode';
const DETERMINATION_VERSIONS: DeterminationMethod['version'][] = ['1.0', '1.1', '1.2'];

export const ALLOWED_SETS: EpdSetType[] = ['UNKNOWN', 'SBK_SET_1', 'SBK_SET_2', 'SBK_BOTH'];

export function normalizeOptionalString(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseNumberLike(input: unknown): ParsedNumeric {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? { value: input, raw: input } : { value: null, raw: null };
  }
  if (typeof input !== 'string') {
    return { value: null, raw: null };
  }
  const raw = input.trim();
  if (!raw) return { value: null, raw: null };
  const stripped = raw.replace(/[^\d,.\-+eE]/g, '');
  if (!stripped) return { value: null, raw };
  let normalized = stripped;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(',', '.');
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? { value, raw } : { value: null, raw };
}

function extractDeterminationVersion(value?: string | null): DeterminationMethod['version'] {
  if (!value) return null;
  const match = value.match(/1[.,][0-2]/);
  if (!match) return null;
  const normalized = match[0].replace(',', '.') as DeterminationMethod['version'];
  return DETERMINATION_VERSIONS.includes(normalized) ? normalized : null;
}

export function resolveDeterminationMethod(lcaMethod?: string | null, databaseNmdVersion?: string | null): DeterminationMethod {
  const version = extractDeterminationVersion(lcaMethod) ?? extractDeterminationVersion(databaseNmdVersion);
  return { name: DETERMINATION_NAME, version };
}

export function resolveStatus(required: { mkiA1A3: number | null; co2A1A3: number | null }) {
  const reasons: string[] = [];
  if (required.mkiA1A3 === null) reasons.push('missing_mki_a1a3');
  if (required.co2A1A3 === null) reasons.push('missing_co2_a1a3');
  return {
    status: reasons.length === 0 ? 'ok' : 'incomplete',
    statusReason: reasons.length ? reasons.join(', ') : null,
  };
}

export function selectImpactValue(
  impacts: ParsedImpact[],
  indicatorOptions: string[],
  stage: string,
): number | null {
  const setOrder: EpdSetType[] = ['SBK_SET_1', 'SBK_SET_2', 'SBK_BOTH', 'UNKNOWN'];
  for (const setType of setOrder) {
    const match = impacts.find(
      (impact) =>
        indicatorOptions.includes(String(impact.indicator)) &&
        impact.stage === stage &&
        impact.setType === setType,
    );
    if (match && Number.isFinite(match.value)) return match.value;
  }
  const fallback = impacts.find(
    (impact) => indicatorOptions.includes(String(impact.indicator)) && impact.stage === stage,
  );
  return fallback && Number.isFinite(fallback.value) ? fallback.value : null;
}

export function extractProductCategory(customAttributes: Record<string, string>) {
  const keys = Object.keys(customAttributes);
  const matchKey = keys.find((key) => /productgroep|productgroep\/categorie|productcategorie|categorie|category/i.test(key));
  return matchKey ? normalizeOptionalString(customAttributes[matchKey]) : null;
}

export function cleanCustomAttributes(customAttributes?: Record<string, string>) {
  return Object.entries(customAttributes ?? {}).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) return acc;
      acc[trimmedKey] = typeof value === 'string' ? value : String(value ?? '');
      return acc;
    },
    {},
  );
}

export function cleanImpacts(impacts?: ParsedImpact[]) {
  return (Array.isArray(impacts) ? impacts : [])
    .map((impact) => {
      if (!impact) return null;
      const indicator = String(impact.indicator || '').trim();
      const setType = ALLOWED_SETS.includes(impact.setType) ? impact.setType : 'UNKNOWN';
      const stage = String(impact.stage || '').trim();
      const { value } = parseNumberLike(impact.value);
      if (!indicator || !stage || value === null) return null;
      const unit = typeof impact.unit === 'string' ? impact.unit.trim() : undefined;
      return {
        indicator,
        setType,
        stage,
        value,
        unit: unit || undefined,
      };
    })
    .filter((impact): impact is NonNullable<typeof impact> => Boolean(impact));
}
