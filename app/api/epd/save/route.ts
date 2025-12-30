import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';
import { EpdSetType, ParsedImpact } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const {
    fileId,
    productName,
    functionalUnit,
    producerName,
    lcaMethod,
    pcrVersion,
    databaseName,
    databaseNmdVersion,
    databaseEcoinventVersion,
    publicationDate,
    expirationDate,
    verifierName,
    standardSet,
    customAttributes,
    impacts,
  } = body as {
    fileId?: string;
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
    standardSet?: string;
    customAttributes?: Record<string, string>;
    impacts?: ParsedImpact[];
  };

  const normalizeOptionalString = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const cleanedProductName = normalizeOptionalString(productName);
  const cleanedFunctionalUnit = normalizeOptionalString(functionalUnit);

  if (!cleanedProductName || !cleanedFunctionalUnit) {
    return NextResponse.json({ error: 'productName en functionalUnit zijn verplicht' }, { status: 400 });
  }

  const allowedSets: EpdSetType[] = ['UNKNOWN', 'SBK_SET_1', 'SBK_SET_2', 'SBK_BOTH'];
  const resolvedStandardSet = allowedSets.includes(standardSet as EpdSetType)
    ? (standardSet as EpdSetType)
    : 'UNKNOWN';

  const cleanedCustomAttributes = Object.entries(customAttributes ?? {}).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) return acc;
      acc[trimmedKey] = typeof value === 'string' ? value : String(value ?? '');
      return acc;
    },
    {},
  );

  const cleanedImpacts = (Array.isArray(impacts) ? impacts : [])
    .map((impact) => {
      if (!impact) return null;
      const indicator = String(impact.indicator || '').trim();
      const setType = allowedSets.includes(impact.setType) ? impact.setType : 'UNKNOWN';
      const stage = String(impact.stage || '').trim();
      const value = Number(impact.value);
      if (!indicator || !stage || !Number.isFinite(value)) return null;
      const unit = typeof impact.unit === 'string' ? impact.unit.trim() : null;
      return {
        indicator,
        setType,
        stage,
        value,
        unit: unit || null,
      };
    })
    .filter((impact): impact is NonNullable<typeof impact> => Boolean(impact));

  const admin = getAdminClient();

  const { data: epd, error } = await admin
    .from('epds')
    .insert({
      epd_file_id: normalizeOptionalString(fileId),
      product_name: cleanedProductName,
      functional_unit: cleanedFunctionalUnit,
      producer_name: normalizeOptionalString(producerName),
      lca_method: normalizeOptionalString(lcaMethod),
      pcr_version: normalizeOptionalString(pcrVersion),
      database_name: normalizeOptionalString(databaseName),
      database_nmd_version: normalizeOptionalString(databaseNmdVersion),
      database_ecoinvent_version: normalizeOptionalString(databaseEcoinventVersion),
      publication_date: normalizeOptionalString(publicationDate),
      expiration_date: normalizeOptionalString(expirationDate),
      verifier_name: normalizeOptionalString(verifierName),
      standard_set: resolvedStandardSet,
      custom_attributes: cleanedCustomAttributes,
    })
    .select('id')
    .single();

  if (error || !epd) {
    return NextResponse.json({ error: error?.message || 'Kon EPD niet opslaan' }, { status: 500 });
  }

  if (cleanedImpacts.length) {
    const mapped = cleanedImpacts.map((impact) => ({
      epd_id: epd.id,
      indicator: impact.indicator,
      set_type: impact.setType,
      stage: impact.stage,
      value: impact.value,
      unit: impact.unit,
    }));

    const { error: impactError } = await admin.from('epd_impacts').insert(mapped);
    if (impactError) {
      await admin.from('epds').delete().eq('id', epd.id);
      return NextResponse.json({ error: impactError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: epd.id });
}
