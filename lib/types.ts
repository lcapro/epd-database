// lib/types.ts
import type { ImpactIndicatorCode } from './impactIndicators';

export type EpdImpactStage = 'A1' | 'A2' | 'A3' | 'A1_A3' | 'D';

// voeg BOTH toe
export type EpdSetType = 'UNKNOWN' | 'SBK_SET_1' | 'SBK_SET_2' | 'SBK_BOTH';

// ParsedImpact moet unit ondersteunen + indicator als string (future-proof)
// We willen canonical codes gebruiken, maar laten string toe voor toekomstige indicators.
export type ImpactIndicator = ImpactIndicatorCode | string;

export type ParsedImpact = {
  indicator: ImpactIndicator;
  setType: EpdSetType;
  stage: EpdImpactStage;
  value: number;
  unit?: string; // <-- belangrijk: unit erbij
};

export type ParsedEpd = {
  productName?: string;
  functionalUnit?: string;
  producerName?: string;
  lcaMethod?: string;
  pcrVersion?: string;
  databaseName?: string;

  // nieuwe velden die je al gebruikt
  databaseNmdVersion?: string;
  databaseEcoinventVersion?: string;

  publicationDate?: string;
  expirationDate?: string;
  verifierName?: string;

  standardSet: EpdSetType;
  impacts: ParsedImpact[];
};

// (de rest van jouw types mag blijven zoals het is)

export interface EpdRecord {
  id: string;
  epd_file_id?: string | null;
  product_name: string;
  functional_unit: string;
  producer_name?: string | null;
  lca_method?: string | null;
  pcr_version?: string | null;
  database_name?: string | null;
  database_nmd_version?: string | null;
  database_ecoinvent_version?: string | null;
  publication_date?: string | null;
  expiration_date?: string | null;
  verifier_name?: string | null;
  standard_set: EpdSetType;
  custom_attributes: Record<string, string>;
}


export interface EpdImpactRecord {
  id: string;
  epd_id: string;
  indicator: string;
  set_type: EpdSetType;
  stage: EpdImpactStage;
  value: number | null;
  unit?: string; 
}
