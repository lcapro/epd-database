import type { EpdImpactStage, EpdResult, EpdSetType } from '../types';
import { normalizePreserveLines } from './textUtils';

const knownIndicators = new Set([
  'MKI', 'ADPE', 'ADPF', 'GWP', 'ODP', 'POCP', 'AP', 'EP', 'HTP', 'FAETP', 'MAETP', 'TETP',
  'PERE', 'PERM', 'PERT', 'PENRE', 'PENRM', 'PENRT', 'PET', 'SM', 'RSF', 'NRSF', 'FW',
  'HWD', 'NHWD', 'RWD', 'CRU', 'MFR', 'MER', 'EE', 'EET', 'EEE',
]);
const orderedIndicators = Array.from(knownIndicators).sort((a, b) => b.length - a.length);

const NUM_RE = /[+-]?\d+(?:[.,]\d+)?(?:E[+-]?\d+)?/gi;
const TOKEN_RE = /MND|[+-]?\d+(?:[.,]\d+)?(?:E[+-]?\d+)?/gi;

const moduleRegex = /\b(A1-A3|A1|A2|A3|B\d|C[1-4]|D|Totaal|Total)\b/gi;

function parseNumberToken(tok: string): number | null {
  if (/^MND$/i.test(tok)) return null;
  if (/^0+$/.test(tok)) return 0;
  const normalized = tok.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function isAlpha(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[a-z]/i.test(ch);
}

function shouldAcceptFirstToken(text: string, start: number, end: number, token: string): boolean {
  const prev = text[start - 1];
  const next = text[end];
  const next2 = text[end + 1];
  const prevNonSpace = text.slice(0, start).trimEnd().slice(-1);
  const nextNonSpace = text.slice(end).trimStart()[0];
  const nextNonSpace2 = text.slice(end).trimStart()[1];

  if (isAlpha(next)) return false;
  if (next === '-' && isAlpha(next2)) return false;
  if (nextNonSpace === '-' && isAlpha(nextNonSpace2)) return false;
  if (isAlpha(prev)) {
    return /e/i.test(token);
  }
  if (isAlpha(prevNonSpace) && /^\d$/.test(token)) return false;
  if (/^\d$/.test(token) && (nextNonSpace === '-' || nextNonSpace === '−')) return false;
  return true;
}

function detectIndicator(line: string): string | undefined {
  const trimmed = line.trim();
  const upper = trimmed.toUpperCase();
  for (const indicator of orderedIndicators) {
    if (upper.startsWith(indicator)) return indicator;
  }
  return undefined;
}

function sliceResultsSection(text: string, setNo: '1' | '2'): string | undefined {
  const startRe = new RegExp(`(results|resultaten)[\\s/]*.*sbk\\s*set\\s*${setNo}`, 'i');
  const startIdx = text.search(startRe);
  if (startIdx < 0) return undefined;

  const endIdxCandidates = [
    text.toLowerCase().indexOf('ecochain technologies', startIdx),
    text.toLowerCase().indexOf('h.j.e.', startIdx),
  ].filter((x) => x >= 0);

  const endIdx = endIdxCandidates.length ? Math.min(...endIdxCandidates) : Math.min(text.length, startIdx + 14000);
  return text.slice(startIdx, endIdx);
}

function extractModuleHeader(lines: string[]): string[] {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const tokens = Array.from(line.matchAll(moduleRegex)).map((m) => m[1]);
    if (tokens.length >= 3) {
      const nextTokens = Array.from(lines[i + 1]?.matchAll(moduleRegex) || []).map((m) => m[1]);
      const merged = [...tokens, ...nextTokens];
      const normalized = merged.map((t) => (t.toLowerCase() === 'totaal' ? 'Total' : t));
      const unique: string[] = [];
      for (const token of normalized) {
        const canonical = token === 'A1A3' ? 'A1-A3' : token;
        if (!unique.includes(canonical)) unique.push(canonical);
      }
      return unique;
    }
  }
  return [];
}

function extractRowTokens(line: string): { unit: string; tokens: string[] } | null {
  const compact = line.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const firstRe = new RegExp(TOKEN_RE.source, 'gi');
  let firstIndex: number | undefined;
  let firstMatch = firstRe.exec(compact);
  while (firstMatch) {
    const token = firstMatch[0];
    if (token) {
      const index = firstMatch.index ?? 0;
      const end = index + token.length;
      if (/^MND$/i.test(token) || shouldAcceptFirstToken(compact, index, end, token)) {
        firstIndex = index;
        break;
      }
    }
    firstMatch = firstRe.exec(compact);
  }
  if (firstIndex === undefined) return null;
  const unit = compact.slice(0, firstIndex).trim();
  const rawTokens = compact.slice(firstIndex).match(TOKEN_RE) || [];
  return { unit, tokens: rawTokens };
}

export function parseImpactTableDynamic(text: string, setType: EpdSetType): {
  modules: EpdImpactStage[];
  results: EpdResult[];
  mndModules: Set<string>;
} {
  const setNo: '1' | '2' = setType === 'SBK_SET_2' ? '2' : '1';
  const normalized = normalizePreserveLines(text);
  const section = sliceResultsSection(normalized, setNo);
  if (!section) return { modules: [], results: [], mndModules: new Set() };

  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  const modules = extractModuleHeader(lines);
  const mndModules = new Set<string>();

  const results: EpdResult[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const indicator = detectIndicator(line);
    if (!indicator) continue;

    let buffer = line;
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (detectIndicator(next)) break;
      if (next.toLowerCase().includes('ecochain technologies')) break;
      buffer += ` ${next}`;
      j += 1;
    }

    const parsed = extractRowTokens(buffer);
    if (!parsed) {
      i = j - 1;
      continue;
    }

    const values: Record<string, number | null> = {};
    const tokens = parsed.tokens;
    modules.forEach((module, idx) => {
      const token = tokens[idx];
      if (!token) {
        values[module] = null;
        return;
      }
      if (/^MND$/i.test(token)) {
        values[module] = null;
        mndModules.add(module);
        return;
      }
      values[module] = parseNumberToken(token);
    });

    results.push({
      indicator,
      unit: parsed.unit,
      setType,
      values,
    });

    i = j - 1;
  }

  return { modules, results, mndModules };
}
