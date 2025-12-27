export type EpdImpactStage = 'A1' | 'A2' | 'A3' | 'A1_A3' | 'D';
export type EpdSetType = 'SBK_SET_1' | 'SBK_SET_2' | 'SBK_BOTH' | 'UNKNOWN';

export interface ParsedImpact {
  indicator: string;
  unit?: string; 
  setType: EpdSetType;
  stage: EpdImpactStage;
  value: number;
}

export interface ParsedEpd {
  productName?: string;
  functionalUnit?: string;
  producerName?: string;
  lcaMethod?: string;
  pcrVersion?: string;
  databaseName?: string;
  publicationDate?: string; // ISO date
  expirationDate?: string; // ISO date
  verifierName?: string;
  standardSet: EpdSetType;
  impacts: ParsedImpact[];
}

export interface EpdRecord {
  id: string;
  epd_file_id?: string | null;
  product_name: string;
  functional_unit: string;
  producer_name?: string | null;
  lca_method?: string | null;
  pcr_version?: string | null;
  database_name?: string | null;
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
