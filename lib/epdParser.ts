import type { ParsedEpd, ParsedImpact, EpdImpactStage, EpdNormalized } from './types';
import { parseEpdNormalized as parseEpdNormalizedInternal } from './epd/registry';

function mapNormalizedToParsed(normalized: EpdNormalized): ParsedEpd {
  const impacts: ParsedImpact[] = [];
  const stages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1-A3', 'D'];

  for (const result of normalized.results) {
    for (const stage of stages) {
      const value = result.values[stage];
      if (value === null || value === undefined) continue;
      impacts.push({
        indicator: result.indicator,
        setType: result.setType,
        stage,
        value,
        unit: result.unit,
      });
    }
  }

  const lcaMethod = normalized.lcaStandard.version
    ? `${normalized.lcaStandard.name} ${normalized.lcaStandard.version}`
    : normalized.lcaStandard.name;

  const pcrVersion = normalized.pcr
    ? normalized.pcr.version
      ? `${normalized.pcr.name} ${normalized.pcr.version}`
      : normalized.pcr.name
    : undefined;

  return {
    productName: normalized.productName,
    functionalUnit: normalized.declaredUnit,
    producerName: normalized.manufacturer,
    lcaMethod,
    pcrVersion,
    databaseName: normalized.database,
    databaseNmdVersion: undefined,
    databaseEcoinventVersion: undefined,
    publicationDate: normalized.issueDate,
    expirationDate: normalized.validUntil,
    verifierName: normalized.verifier,
    standardSet: normalized.standardSet,
    impacts,
  };
}

export function parseEpd(raw: string): ParsedEpd {
  const { normalized, legacy } = parseEpdNormalizedInternal(raw);
  if (legacy) return legacy;
  return mapNormalizedToParsed(normalized);
}

export function parseEpdNormalized(raw: string): EpdNormalized {
  const { normalized, legacy } = parseEpdNormalizedInternal(raw);
  if (legacy && normalized) return normalized;
  return normalized;
}
