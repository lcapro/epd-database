import type { LcaStandard, LcaStandardVersion, PcrInfo } from '../types';

const LCA_NAME: LcaStandard['name'] = 'NMD Bepalingsmethode';

function extractVersion(raw: string): LcaStandardVersion | undefined {
  const match = raw.match(/(1\.0|1\.1|1\.2)/);
  if (match?.[1]) return match[1] as LcaStandardVersion;
  return undefined;
}

export function normalizeLcaStandard(raw: string | undefined): LcaStandard {
  if (!raw) {
    return { name: LCA_NAME };
  }

  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const version = extractVersion(cleaned);
  const editionYear = cleaned.match(/\b(20\d{2})\b/)?.[1];

  return {
    name: LCA_NAME,
    version,
    raw: cleaned,
    editionYear,
  };
}

export function normalizePcrInfo(raw: string | undefined): PcrInfo | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const version = cleaned.match(/(\d+(?:\.\d+){0,2})/)?.[1];
  let name = cleaned
    .replace(/pcr[:\s]*/i, '')
    .replace(/versie/gi, '')
    .replace(/\d+(?:\.\d+){0,2}/g, '')
    .trim();

  if (!name) name = 'PCR';

  return { name, version };
}
