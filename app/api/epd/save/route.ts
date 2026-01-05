import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createSupabaseRouteClient, getSupabaseCookieStatus } from '@/lib/supabase/route';
import { assertNoSupabaseError } from '@/lib/supabase/assertNoSupabaseError';
import { getActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';
import { EpdSetType, ParsedImpact } from '@/lib/types';
import {
  ALLOWED_SETS,
  cleanCustomAttributes,
  cleanImpacts,
  extractProductCategory,
  normalizeOptionalString,
  resolveDeterminationMethod,
  resolveStatus,
  selectImpactValue,
} from '@/lib/epd/saveUtils';

type EpdHashInput = {
  organizationId: string;
  productName: string;
  producerName: string | null;
  functionalUnit: string;
  determinationMethodVersion: string | null;
  pcrVersion: string | null;
  databaseVersion: string | null;
};

const normalizeHashValue = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const makeEpdHashKey = (input: EpdHashInput) => {
  const hashPayload = [
    normalizeHashValue(input.organizationId),
    normalizeHashValue(input.productName),
    normalizeHashValue(input.producerName),
    normalizeHashValue(input.functionalUnit),
    normalizeHashValue(input.determinationMethodVersion),
    normalizeHashValue(input.pcrVersion),
    normalizeHashValue(input.databaseVersion),
  ].join('|');

  return createHash('md5').update(hashPayload).digest('hex');
};

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
    organizationId,
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
    organizationId?: string;
  };

  const cleanedProductName = normalizeOptionalString(productName);
  const cleanedFunctionalUnit = normalizeOptionalString(functionalUnit);
  const cleanedProducerName = normalizeOptionalString(producerName);

  if (!cleanedProductName || !cleanedFunctionalUnit) {
    return NextResponse.json({ error: 'productName en functionalUnit zijn verplicht' }, { status: 400 });
  }

  const resolvedStandardSet = ALLOWED_SETS.includes(standardSet as EpdSetType)
    ? (standardSet as EpdSetType)
    : 'UNKNOWN';

  const cleanedCustomAttributes = cleanCustomAttributes(customAttributes);
  const cleanedImpacts = cleanImpacts(impacts);
  const impactsCount = cleanedImpacts.length;

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

  const supabase = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase EPD save missing user', {
      requestId,
      hasUser: false,
      ...cookieStatus,
      impactsCount,
      epdId: null,
      organizationId: getActiveOrgId() ?? normalizeOptionalString(organizationId),
      code: authError?.code ?? null,
      message: authError?.message ?? null,
    });
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const activeOrgId = getActiveOrgId() ?? normalizeOptionalString(organizationId);
  if (!activeOrgId) {
    return NextResponse.json({ error: 'Geen actieve organisatie geselecteerd. Kies eerst een organisatie.' }, { status: 400 });
  }

  try {
    await assertOrgMember(supabase, user.id, activeOrgId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('EPD save forbidden', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId,
        code: err.code ?? null,
        message: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('EPD save membership check failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    });
    return NextResponse.json({ error: 'Kon lidmaatschap niet controleren' }, { status: 500 });
  }

  const hashKey = makeEpdHashKey({
    organizationId: activeOrgId,
    productName: cleanedProductName,
    producerName: cleanedProducerName,
    functionalUnit: cleanedFunctionalUnit,
    determinationMethodVersion: determinationMethod.version,
    pcrVersion: normalizeOptionalString(pcrVersion),
    databaseVersion,
  });

  console.info('EPD hash key computed', {
    requestId,
    hashKey,
    organizationId: activeOrgId,
  });

  const epdResult = await supabase
    .from('epds')
    .upsert(
      {
        organization_id: activeOrgId,
        epd_file_id: normalizeOptionalString(fileId),
        product_name: cleanedProductName,
        functional_unit: cleanedFunctionalUnit,
        producer_name: cleanedProducerName,
        manufacturer: cleanedProducerName,
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
        hash_key: hashKey,
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
        onConflict: 'organization_id,hash_key',
      },
    )
    .select('id')
    .single();

  const epdErrorResponse = assertNoSupabaseError({
    result: epdResult,
    opName: 'upsert_epds',
    requestId,
    userId: user.id,
    organizationId: activeOrgId,
    table: 'epds',
  });
  if (epdErrorResponse) {
    return epdErrorResponse;
  }

  const epd = epdResult.data;
  if (!epd) {
    return NextResponse.json({ error: 'Kon EPD niet opslaan' }, { status: 500 });
  }

  if (impactsCount) {
    const cleanupResult = await supabase
      .from('epd_impacts')
      .delete()
      .eq('epd_id', epd.id)
      .eq('organization_id', activeOrgId);
    const cleanupErrorResponse = assertNoSupabaseError({
      result: cleanupResult,
      opName: 'delete_impacts',
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      table: 'epd_impacts',
    });
    if (cleanupErrorResponse) {
      return cleanupErrorResponse;
    }
    const mapped = cleanedImpacts.map((impact) => ({
      organization_id: activeOrgId,
      epd_id: epd.id,
      indicator: impact.indicator,
      set_type: impact.setType,
      stage: impact.stage,
      value: impact.value,
      unit: impact.unit,
    }));

    const impactResult = await supabase.from('epd_impacts').insert(mapped);
    const impactErrorResponse = assertNoSupabaseError({
      result: impactResult,
      opName: 'insert_impacts',
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      table: 'epd_impacts',
    });
    if (impactErrorResponse) {
      const cleanupEpdResult = await supabase.from('epds').delete().eq('id', epd.id).eq('organization_id', activeOrgId);
      const cleanupEpdErrorResponse = assertNoSupabaseError({
        result: cleanupEpdResult,
        opName: 'delete_epd_after_impact_failure',
        requestId,
        userId: user.id,
        organizationId: activeOrgId,
        table: 'epds',
      });
      if (cleanupEpdErrorResponse) {
        return cleanupEpdErrorResponse;
      }
      return impactErrorResponse;
    }
  }

  console.info('EPD saved', {
    requestId,
    epdId: epd.id,
    fileId: fileId ?? null,
    userId: user.id,
    organizationId: activeOrgId,
    impactsCount,
    status,
  });

  return NextResponse.json({ id: epd.id });
}
