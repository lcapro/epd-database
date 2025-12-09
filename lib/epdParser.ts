import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from './types';

const impactStages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1_A3', 'D'];

function normalizeText(input: string): string {
  return input.replace(/\r\n|\r/g, '\n').replace(/\s+/g, ' ').trim();
}

function labelMatch(text: string, label: string): RegExpMatchArray | null {
  const pattern = new RegExp(`${label}[^\n\d]*([\d.,]+)`, 'i');
  return text.match(pattern);
}

function parseNumber(value?: string | null): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateFromText(text: string): string | undefined {
  const match = text.match(/(20\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01]))/);
  if (match) {
    return match[1].replace(/\//g, '-');
  }
  const altMatch = text.match(/(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})/);
  if (altMatch) {
    const [_, day, month, year] = altMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return undefined;
}

function detectStandardSet(text: string): EpdSetType {
  const lowered = text.toLowerCase();
  if (lowered.includes('set 1') || lowered.includes('en15804 +a1') || lowered.includes('en 15804+a1')) {
    return 'SBK_SET_1';
  }
  if (lowered.includes('set 2') || lowered.includes('en15804 +a2') || lowered.includes('en 15804+a2')) {
    return 'SBK_SET_2';
  }
  return 'UNKNOWN';
}

function extractImpactsForSet(text: string, setType: EpdSetType, indicator: 'MKI' | 'CO2'): ParsedImpact[] {
  const impacts: ParsedImpact[] = [];
  const labels: Record<string, string[]> = {
    MKI: ['MKI'],
    CO2: setType === 'SBK_SET_2' ? ['CO2-tot', 'CO2 tot', 'GWP-tot', 'GWP tot', 'GWP-total'] : ['CO2', 'GWP'],
  };

  impactStages.forEach((stage) => {
    const stageLabel = stage === 'A1_A3' ? 'A1-?A3' : stage;
    for (const base of labels[indicator]) {
      const regexLabel = `${base}[^\n\r]*${stageLabel}`;
      const match = labelMatch(text, regexLabel);
      const value = parseNumber(match?.[1]);
      if (value !== undefined) {
        impacts.push({ indicator, setType, stage, value });
        break;
      }
    }
  });

  return impacts;
}

function computeA1A3(impacts: ParsedImpact[], setType: EpdSetType, indicator: 'MKI' | 'CO2'): void {
  const hasA1A3 = impacts.some((i) => i.setType === setType && i.indicator === indicator && i.stage === 'A1_A3');
  if (hasA1A3) return;
  const a1 = impacts.find((i) => i.setType === setType && i.indicator === indicator && i.stage === 'A1');
  const a2 = impacts.find((i) => i.setType === setType && i.indicator === indicator && i.stage === 'A2');
  const a3 = impacts.find((i) => i.setType === setType && i.indicator === indicator && i.stage === 'A3');
  if (a1 && a2 && a3) {
    impacts.push({ indicator, setType, stage: 'A1_A3', value: a1.value + a2.value + a3.value });
  }
}

export function parseEpd(raw: string): ParsedEpd {
  const text = normalizeText(raw);

  const parsed: ParsedEpd = {
    productName: undefined,
    functionalUnit: undefined,
    producerName: undefined,
    lcaMethod: undefined,
    pcrVersion: undefined,
    databaseName: undefined,
    publicationDate: undefined,
    expirationDate: undefined,
    verifierName: undefined,
    standardSet: 'UNKNOWN',
    impacts: [],
  };

  parsed.productName = text.match(/product\s*naam[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/product\s*name[:\s]*([^\n]+)/i)?.[1]?.trim();
  parsed.functionalUnit = text.match(/functionele\s*eenheid[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/functional\s*unit[:\s]*([^\n]+)/i)?.[1]?.trim();
  parsed.producerName = text.match(/producent[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/producer[:\s]*([^\n]+)/i)?.[1]?.trim();
  parsed.lcaMethod = text.match(/lca\s*methode[:\s]*([^\n]+)/i)?.[1]?.trim();
  parsed.pcrVersion = text.match(/pcr[:\s]*versie[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/pcr\s*version[:\s]*([^\n]+)/i)?.[1]?.trim();
  parsed.databaseName = text.match(/database[:\s]*([^\n]+)/i)?.[1]?.trim();
  parsed.publicationDate = dateFromText(text.match(/publicatie[:\s]*datum[:\s]*([^\n]+)/i)?.[1] || '') || dateFromText(text);
  const expirationCandidate = text.match(/einde\s*geldigheid[:\s]*([^\n]+)/i)?.[1];
  parsed.expirationDate = dateFromText(expirationCandidate || '') || undefined;
  parsed.verifierName = text.match(/(verificateur|toetser)[:\s]*([^\n]+)/i)?.[2]?.trim();

  parsed.standardSet = detectStandardSet(text);

  const set1Impacts = [
    ...extractImpactsForSet(text, 'SBK_SET_1', 'MKI'),
    ...extractImpactsForSet(text, 'SBK_SET_1', 'CO2'),
  ];
  const set2Impacts = [
    ...extractImpactsForSet(text, 'SBK_SET_2', 'MKI'),
    ...extractImpactsForSet(text, 'SBK_SET_2', 'CO2'),
  ];

  const impacts = [...set1Impacts, ...set2Impacts];
  computeA1A3(impacts, 'SBK_SET_1', 'MKI');
  computeA1A3(impacts, 'SBK_SET_1', 'CO2');
  computeA1A3(impacts, 'SBK_SET_2', 'MKI');
  computeA1A3(impacts, 'SBK_SET_2', 'CO2');

  parsed.impacts = impacts;

  if (!parsed.expirationDate && parsed.publicationDate) {
    const pubDate = new Date(parsed.publicationDate);
    const exp = new Date(pubDate);
    exp.setFullYear(exp.getFullYear() + 5);
    parsed.expirationDate = exp.toISOString().slice(0, 10);
  }

  return parsed;
}
