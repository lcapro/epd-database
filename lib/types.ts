// lib/types.ts
import type { ImpactIndicatorCode } from './impactIndicators';

/**
 * Interne impact stages
 * BELANGRIJK:
 * - Gebruik intern ALTIJD A1_A3
 * - A1-A3 is alleen een UI-label
 */
export type EpdImpactStage =
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A1_A3'
  | 'D';

/**
 * SBK set types
 */
export type EpdSetType =
  | 'UNKNOWN'
  | 'SBK_SET_1'
  | 'SBK_SET_2'
  | 'SBK_BOTH';

/**
 * Indicator type
 * - Canonical codes (GWP, MKI, etc.)
 * - string toegestaan voor future-proofing
 */
export type ImpactIndicator = ImpactIndicatorCode | string;

/**
 * Parsed impact (uit PDF)
 */
export type ParsedImpact = {
  indicator: ImpactIndicator;
  setType: EpdSetType;
  stage: EpdImpactStage;
  value: number;
  unit?: string;
};

/**
 * Parsed EPD (uit PDF)
 */
export type ParsedEpd = {
  productName?: string;
  functionalUnit?: string;
  producerName?: string;

  lcaMethod?: string;
  pcrVersion?: string;

  databaseName?: string;
  databaseNmdVersion?: string;
  databaseEcoinventVersion?: string;

  publicationDate?: string;
  expirationDate?: string;
  verifierName?: string;

  standardSet: EpdSetType;
  impacts: ParsedImpact[];
};

/**
 * Database record: EPD
 */
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

/**
 * Database record: Impact
 */
export interface EpdImpactRecord {
  id: string;
  epd_id: string;

  indicator: string;
  set_type: EpdSetType;
  stage: EpdImpactStage;

  value: number | null;
  unit?: string;
}
