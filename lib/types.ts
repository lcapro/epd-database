// lib/types.ts
import type { ImpactIndicatorCode } from './impactIndicators';

export type EpdImpactStage = string;

export type EpdSetType = 'UNKNOWN' | 'SBK_SET_1' | 'SBK_SET_2' | 'SBK_BOTH';

export type ImpactIndicator = ImpactIndicatorCode | string;

export type ParsedImpact = {
  indicator: ImpactIndicator;
  setType: EpdSetType;
  stage: EpdImpactStage;
  value: number;
  unit?: string;
};

export type LcaStandardVersion = '1.0' | '1.1' | '1.2';

export type LcaStandard = {
  name: 'NMD Bepalingsmethode';
  version?: LcaStandardVersion;
  raw?: string;
  editionYear?: string;
};

export type PcrInfo = {
  name: string;
  version?: string;
};

export type ModuleDeclaration = {
  module: string;
  declared: boolean;
  mnd?: boolean;
};

export type EpdResult = {
  indicator: ImpactIndicator;
  unit?: string;
  setType: EpdSetType;
  values: Record<string, number | null>;
};

export type EpdNormalized = {
  productName?: string;
  declaredUnit?: string;
  manufacturer?: string;
  issueDate?: string;
  validUntil?: string;

  pcr?: PcrInfo;
  lcaStandard: LcaStandard;

  verified?: boolean;
  verifier?: string;

  database?: string;

  modulesDeclared: ModuleDeclaration[];
  results: EpdResult[];
  impacts: ParsedImpact[];
  standardSet: EpdSetType;

  rawExtract?: Record<string, unknown>;
};

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

export interface EpdRecord {
  id: string;
  epd_file_id?: string | null;

  product_name: string;
  functional_unit: string;
  producer_name?: string | null;
  manufacturer?: string | null;

  lca_method?: string | null;
  determination_method_name?: string | null;
  determination_method_version?: string | null;
  pcr_version?: string | null;

  database_name?: string | null;
  database_version?: string | null;
  database_nmd_version?: string | null;
  database_ecoinvent_version?: string | null;

  publication_date?: string | null;
  expiration_date?: string | null;
  verifier_name?: string | null;

  standard_set: EpdSetType;
  custom_attributes: Record<string, string>;

  product_category?: string | null;
  mki_a1a3?: number | null;
  mki_d?: number | null;
  co2_a1a3?: number | null;
  co2_d?: number | null;
  raw_extracted?: Record<string, unknown> | null;
  status?: string | null;
  status_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
