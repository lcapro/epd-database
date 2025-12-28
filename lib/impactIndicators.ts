// lib/impactIndicators.ts

export const IMPACT_INDICATORS = {
  // Core
  MKI: { label: 'MKI', group: 'Kern', defaultUnit: 'Euro' },
  GWP: { label: 'GWP (klimaatverandering)', group: 'Kern', defaultUnit: 'kg CO2-eq' },

  // Impact
  ADPE: { label: 'ADPE (abiotische uitputting, elementen)', group: 'Impact', defaultUnit: 'kg Sb-eq' },
  ADPF: { label: 'ADPF (abiotische uitputting, fossiel)', group: 'Impact', defaultUnit: 'kg Sb-eq' }, // soms MJ in PDFs; parser-unit wint
  ODP: { label: 'ODP (ozonlaag aantasting)', group: 'Impact', defaultUnit: 'kg CFC-11-eq' },
  POCP: { label: 'POCP (fotochemische oxidantvorming)', group: 'Impact', defaultUnit: 'kg ethene-eq' },
  AP: { label: 'AP (verzuring)', group: 'Impact', defaultUnit: 'kg SO2-eq' },
  EP: { label: 'EP (vermesting)', group: 'Impact', defaultUnit: 'kg PO4-eq' },
  HTP: { label: 'HTP (humaan-toxicologisch)', group: 'Impact', defaultUnit: 'kg 1,4-DB-eq' },
  FAETP: { label: 'FAETP (eco-toxicologisch zoetwater)', group: 'Impact', defaultUnit: 'kg 1,4-DB-eq' },
  MAETP: { label: 'MAETP (eco-toxicologisch zeewater)', group: 'Impact', defaultUnit: 'kg 1,4-DB-eq' },
  TETP: { label: 'TETP (eco-toxicologisch terrestrisch)', group: 'Impact', defaultUnit: 'kg 1,4-DB-eq' },

  // Resources
  PERE: { label: 'PERE (hernieuwbare primaire energie excl. materiaal)', group: 'Resources', defaultUnit: 'MJ' },
  PERM: { label: 'PERM (hernieuwbare primaire energie als materiaal)', group: 'Resources', defaultUnit: 'MJ' },
  PERT: { label: 'PERT (totaal hernieuwbare primaire energie)', group: 'Resources', defaultUnit: 'MJ' },
  PENRE: { label: 'PENRE (niet-hernieuwbare primaire energie excl. materiaal)', group: 'Resources', defaultUnit: 'MJ' },
  PENRM: { label: 'PENRM (niet-hernieuwbare primaire energie als materiaal)', group: 'Resources', defaultUnit: 'MJ' },
  PENRT: { label: 'PENRT (totaal niet-hernieuwbare primaire energie)', group: 'Resources', defaultUnit: 'MJ' },
  PET: { label: 'PET (energie primair totaal)', group: 'Resources', defaultUnit: 'MJ' },
  SM: { label: 'SM (secundaire materialen)', group: 'Resources', defaultUnit: 'kg' },
  RSF: { label: 'RSF (hernieuwbare secundaire brandstoffen)', group: 'Resources', defaultUnit: 'MJ' },
  NRSF: { label: 'NRSF (niet-hernieuwbare secundaire brandstoffen)', group: 'Resources', defaultUnit: 'MJ' },
  FW: { label: 'FW (waterverbruik)', group: 'Resources', defaultUnit: 'm3' },

  // Waste
  HWD: { label: 'HWD (gevaarlijk afval)', group: 'Waste', defaultUnit: 'kg' },
  NHWD: { label: 'NHWD (niet-gevaarlijk afval)', group: 'Waste', defaultUnit: 'kg' },
  RWD: { label: 'RWD (radioactief afval)', group: 'Waste', defaultUnit: 'kg' },
  CRU: { label: 'CRU (materialen voor hergebruik)', group: 'Waste', defaultUnit: 'kg' },
  MFR: { label: 'MFR (materialen voor recycling)', group: 'Waste', defaultUnit: 'kg' },
  MER: { label: 'MER (materialen voor energie)', group: 'Waste', defaultUnit: 'kg' },
  EE: { label: 'EE (geëxporteerde energie)', group: 'Waste', defaultUnit: 'MJ' },
  EET: { label: 'EET (geëxporteerde energie thermisch)', group: 'Waste', defaultUnit: 'MJ' },
  EEE: { label: 'EEE (geëxporteerde energie elektrisch)', group: 'Waste', defaultUnit: 'MJ' },
} as const;

export type ImpactIndicatorCode = keyof typeof IMPACT_INDICATORS;
export type ImpactGroup = (typeof IMPACT_INDICATORS)[ImpactIndicatorCode]['group'];

export const ALL_INDICATOR_CODES = Object.keys(IMPACT_INDICATORS) as ImpactIndicatorCode[];

export function isKnownIndicator(code: string): code is ImpactIndicatorCode {
  return Object.prototype.hasOwnProperty.call(IMPACT_INDICATORS, code);
}
