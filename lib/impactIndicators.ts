// lib/impactIndicators.ts

export const IMPACT_INDICATORS_SET_1 = {
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

export const IMPACT_INDICATORS_SET_2 = {
  MKI: { label: 'MKI', group: 'Kern', defaultUnit: 'Euro' },
  'GWP-TOTAL': { label: 'GWP-total (klimaatverandering totaal)', group: 'Impact', defaultUnit: 'kg CO2-eq' },
  'GWP-F': { label: 'GWP-fossiel (klimaatverandering fossiel)', group: 'Impact', defaultUnit: 'kg CO2-eq' },
  'GWP-B': { label: 'GWP-biogeen (klimaatverandering biogeen)', group: 'Impact', defaultUnit: 'kg CO2-eq' },
  'GWP-LULUC': {
    label: 'GWP-LULUC (klimaatverandering landgebruik en landgebruiksverandering)',
    group: 'Impact',
    defaultUnit: 'kg CO2-eq',
  },
  ODP: { label: 'ODP (ozonlaag aantasting)', group: 'Impact', defaultUnit: 'kg CFC-11-eq' },
  AP: { label: 'AP (verzuring)', group: 'Impact', defaultUnit: 'mol H+-eq' },
  'EP-FW': { label: 'EP-FW (vermesting zoetwater)', group: 'Impact', defaultUnit: 'kg P-eq' },
  'EP-M': { label: 'EP-M (vermesting zeewater)', group: 'Impact', defaultUnit: 'kg N-eq' },
  'EP-T': { label: 'EP-T (vermesting terrestrisch)', group: 'Impact', defaultUnit: 'mol N-eq' },
  POCP: { label: 'POCP (fotochemische oxidantvorming)', group: 'Impact', defaultUnit: 'kg NMVOC-eq' },
  'ADP-MM': { label: 'ADP-MM (abiotische uitputting, mineralen en metalen)', group: 'Impact', defaultUnit: 'kg Sb-eq' },
  'ADP-F': { label: 'ADP-F (abiotische uitputting, fossiel)', group: 'Impact', defaultUnit: 'MJ' },
  WDP: { label: 'WDP (waterdepletie)', group: 'Impact', defaultUnit: 'm3' },
  PM: { label: 'PM (fijnstof)', group: 'Impact', defaultUnit: 'disease inc.' },
  IR: { label: 'IR (ioniserende straling)', group: 'Impact', defaultUnit: 'kBq U235-eq' },
  'ETP-FW': { label: 'ETP-FW (eco-toxicologisch zoetwater)', group: 'Impact', defaultUnit: 'CTUe' },
  'HTP-C': { label: 'HTP-C (humaan-toxicologisch carcinogeen)', group: 'Impact', defaultUnit: 'CTUh' },
  'HTP-NC': { label: 'HTP-NC (humaan-toxicologisch niet-carcinogeen)', group: 'Impact', defaultUnit: 'CTUh' },
  SQP: { label: 'SQP (bodemkwaliteit)', group: 'Impact', defaultUnit: '-' },
} as const;

export const IMPACT_INDICATORS = { ...IMPACT_INDICATORS_SET_1, ...IMPACT_INDICATORS_SET_2 } as const;

export type ImpactIndicatorCode = keyof typeof IMPACT_INDICATORS;
export type ImpactGroup = (typeof IMPACT_INDICATORS)[ImpactIndicatorCode]['group'];

export const ALL_INDICATOR_CODES = Object.keys(IMPACT_INDICATORS) as ImpactIndicatorCode[];
export const INDICATOR_CODES_SET_1 = Object.keys(IMPACT_INDICATORS_SET_1) as ImpactIndicatorCode[];
export const INDICATOR_CODES_SET_2 = Object.keys(IMPACT_INDICATORS_SET_2) as ImpactIndicatorCode[];

export function isKnownIndicator(code: string): code is ImpactIndicatorCode {
  return Object.prototype.hasOwnProperty.call(IMPACT_INDICATORS, code);
}
