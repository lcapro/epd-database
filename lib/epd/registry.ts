import type { EpdNormalized, ParsedEpd } from '../types';
import { asphaltEcochainParser } from './parsers/asphaltEcochain';
import { pvcEcochainParser } from './parsers/pvcEcochain';

export type ParserInput = { text: string; meta?: Record<string, string | undefined> };
export type ParserMatch = { score: number; reason?: string };
export type ParserResult = { normalized: EpdNormalized; legacy?: ParsedEpd };

export type EpdParser = {
  id: string;
  canParse: (input: ParserInput) => ParserMatch;
  parse: (input: ParserInput) => ParserResult;
};

const parsers: EpdParser[] = [pvcEcochainParser, asphaltEcochainParser];

function pickParser(input: ParserInput) {
  const scored = parsers.map((parser) => ({
    parser,
    match: parser.canParse(input),
  }));

  const best = scored.reduce((acc, cur) => {
    if (!acc) return cur;
    return cur.match.score > acc.match.score ? cur : acc;
  }, null as null | typeof scored[number]);

  const selected = best?.parser ?? asphaltEcochainParser;
  return { selected, scored };
}

export function parseEpdNormalized(rawText: string, meta?: ParserInput['meta']): ParserResult & { parserId: string } {
  const input = { text: rawText, meta };
  const { selected, scored } = pickParser(input);
  const reason = scored.map((s) => `${s.parser.id}=${s.match.score.toFixed(2)}:${s.match.reason || 'n/a'}`).join(' | ');
  console.info(`[epd-parser] Selected ${selected.id}. Scores: ${reason}`);

  const result = selected.parse(input);
  if (!result.normalized.rawExtract) result.normalized.rawExtract = {};
  result.normalized.rawExtract = {
    ...result.normalized.rawExtract,
    parserId: selected.id,
    parserScores: reason,
  };
  if (result.normalized.lcaStandard.raw && !result.normalized.lcaStandard.version) {
    console.warn(`[epd-parser] LCA standaard versie niet herkend: ${result.normalized.lcaStandard.raw}`);
  }

  return { ...result, parserId: selected.id };
}
