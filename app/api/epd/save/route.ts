import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';
import { EpdSetType, ParsedImpact } from '@/lib/types';

type DeterminationMethod = {
  name: 'NMD Bepalingsmethode';
  version: '1.0' | '1.1' | '1.2' | null;
};

type ParsedNumeric = {
  value: number | null;
  raw: string | number | null;
};

const DETERMINATION_NAME: DeterminationMethod['name'] = 'NMD Bepalingsmethode';
const DETERMINATION_VERSIONS: DeterminationMethod['version'][] = ['1.0', '1.1', '1.2'];

function normalizeOptionalString(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNumberLike(input: unknown): ParsedNumeric {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? { value: input, raw: input } : { value: null, raw: null };
  }
  if (typeof input !== 'string') {
    return { value: null, raw: null };
  }
  const raw = input.trim();
  if (!raw) return { value: null, raw: null };
  const stripped = raw.replace(/[^\d,.\-+eE]/g, '');
  if (!stripped) return { value: null, raw };
  let normalized = stripped;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(',', '.');
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? { value, raw } : { value: null, raw };
}

function extractDeterminationVersion(value?: string | null): DeterminationMethod['version'] {
  if (!value) return null;
  const match = value.match(/1[.,][0-2]/);
  if (!match) return null;
  const normalized = match[0].replace(',', '.') as DeterminationMethod['version'];
  return DETERMINATION_VERSIONS.includes(normalized) ? normalized : null;
}

function resolveDeterminationMethod(lcaMethod?: string | null, databaseNmdVersion?: string | null): DeterminationMethod {
  const version = extractDeterminationVersion(lcaMethod) ?? extractDeterminationVersion(databaseNmdVersion);
  return { name: DETERMINATION_NAME, version };
}

function resolveStatus(required: { mkiA1A3: number | null; co2A1A3: number | null }) {
  const reasons: string[] = [];
  if (required.mkiA1A3 === null) reasons.push('missing_mki_a1a3');
  if (required.co2A1A3 === null) reasons.push('missing_co2_a1a3');
  return {
    status: reasons.length === 0 ? 'ok' : 'incomplete',
    statusReason: reasons.length ? reasons.join(', ') : null,
  };
}

function selectImpactValue(
  impacts: ParsedImpact[],
  indicatorOptions: string[],
  stage: string,
): number | null {
  const setOrder: EpdSetType[] = ['SBK_SET_1', 'SBK_SET_2', 'SBK_BOTH', 'UNKNOWN'];
  for (const setType of setOrder) {
    const match = impacts.find(
      (impact) =>
        indicatorOptions.includes(String(impact.indicator)) &&
        impact.stage === stage &&
        impact.setType === setType,
    );
    if (match && Number.isFinite(match.value)) return match.value;
  }
  const fallback = impacts.find(
    (impact) => indicatorOptions.includes(String(impact.indicator)) && impact.stage === stage,
  );
  return fallback && Number.isFinite(fallback.value) ? fallback.value : null;
}

function extractProductCategory(customAttributes: Record<string, string>) {
  const keys = Object.keys(customAttributes);
  const matchKey = keys.find((key) => /productgroep|productgroep\/categorie|productcategorie|categorie|category/i.test(key));
  return matchKey ? normalizeOptionalString(customAttributes[matchKey]) : null;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
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
      const { value } = parseNumberLike(impact.value);
      if (!indicator || !stage || value === null) return null;
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

  const determinationMethod = resolveDeterminationMethod(
    normalizeOptionalString(lcaMethod),
    normalizeOptionalString(databaseNmdVersion),
  );

  const mkiA1A3 = selectImpactValue(cleanedImpacts, ['MKI'], 'A1-A3');
  const mkiD = selectImpactValue(cleanedImpacts, ['MKI'], 'D');
  const co2A1A3 = selectImpactValue(cleanedImpacts, ['GWP', 'GWP-TOTAL', 'CO2'], 'A1-A3');
  const co2D = selectImpactValue(cleanedImpacts, ['GWP', 'GWP-TOTAL', 'CO2'], 'D');
  const { status, statusReason } = resolveStatus({ mkiA1A3, co2A1A3 });

  const productCategory = extractProductCategory(cleanedCustomAttributes);
  const databaseVersion = normalizeOptionalString(databaseName || databaseEcoinventVersion || databaseNmdVersion);

  const admin = getAdminClient();

  const { data: epd, error } = await admin
    .from('epds')
    .upsert(
      {
        epd_file_id: normalizeOptionalString(fileId),
        product_name: cleanedProductName,
        functional_unit: cleanedFunctionalUnit,
        producer_name: normalizeOptionalString(producerName),
        manufacturer: normalizeOptionalString(producerName),
        lca_method: normalizeOptionalString(lcaMethod),
        determination_method_name: determinationMethod.name,
        determination_method_version: determinationMethod.version,
        pcr_version: normalizeOptionalString(pcrVersion),
        database_name: normalizeOptionalString(databaseName),
        database_version: databaseVersion,
        database_nmd_version: normalizeOptionalString(databaseNmdVersion),
        database_ecoinvent_version: normalizeOptionalString(databaseEcoinventVersion),
        publication_date: normalizeOptionalString(publicationDate),
        expiration_date: normalizeOptionalString(expirationDate),
        verifier_name: normalizeOptionalString(verifierName),
        standard_set: resolvedStandardSet,
        custom_attributes: cleanedCustomAttributes,
        product_category: productCategory,
        mki_a1a3: mkiA1A3,
        mki_d: mkiD,
        co2_a1a3: co2A1A3,
        co2_d: co2D,
        status,
        status_reason: statusReason,
        raw_extracted: {
          fileId,
          parsed: {
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
          },
          customAttributes: cleanedCustomAttributes,
          impacts: cleanedImpacts,
        },
      },
      {
        onConflict: 'product_name,producer_name,functional_unit,determination_method_version,pcr_version,database_version',
      },
    )
    .select('id')
    .single();

  if (error || !epd) {
    console.error('Supabase EPD save failed', {
      requestId,
      fileId: fileId ?? null,
      userId: null,
      code: error?.code ?? null,
      message: error?.message ?? null,
    });
    return NextResponse.json({ error: error?.message || 'Kon EPD niet opslaan' }, { status: 500 });
  }

  if (cleanedImpacts.length) {
    const { error: cleanupError } = await admin.from('epd_impacts').delete().eq('epd_id', epd.id);
    if (cleanupError) {
      console.warn('Kon bestaande impacts niet verwijderen', {
        requestId,
        epdId: epd.id,
        code: cleanupError.code ?? null,
        message: cleanupError.message ?? null,
      });
    }
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
      console.error('Supabase impact save failed', {
        requestId,
        epdId: epd.id,
        code: impactError.code ?? null,
        message: impactError.message ?? null,
      });
      await admin.from('epds').delete().eq('id', epd.id);
      return NextResponse.json({ error: impactError.message }, { status: 500 });
    }
  }

  console.info('EPD saved', {
    requestId,
    epdId: epd.id,
    fileId: fileId ?? null,
    status,
  });

  return NextResponse.json({ id: epd.id });
}
