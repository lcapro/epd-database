import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, getSupabaseCookieStatus } from '@/lib/supabase/route';
import { requireActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';
import type { EpdSetType, ParsedImpact } from '@/lib/types';
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase EPD detail missing user', {
      requestId,
      hasUser: false,
      ...cookieStatus,
      epdId: params.id,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
    });
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  let activeOrgId: string | null = null;
  try {
    activeOrgId = requireActiveOrgId();
    await assertOrgMember(supabase, user.id, activeOrgId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('EPD detail forbidden', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId ?? null,
        code: err.code ?? null,
        message: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Geen actieve organisatie geselecteerd';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!activeOrgId) {
    return NextResponse.json({ error: 'Geen actieve organisatie geselecteerd. Kies eerst een organisatie.' }, { status: 400 });
  }

  const { data: epd, error } = await supabase
    .from('epds')
    .select('*, epd_files(storage_path)')
    .eq('id', params.id)
    .eq('organization_id', activeOrgId)
    .single();

  if (error || !epd) {
    console.error('Supabase EPD detail failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      epdId: params.id,
      code: error?.code ?? null,
      message: error?.message ?? null,
    });
    return NextResponse.json({ error: error?.message || 'Niet gevonden' }, { status: 404 });
  }

  const { data: impacts, error: impactsError } = await supabase
    .from('epd_impacts')
    .select('*')
    .eq('epd_id', params.id)
    .eq('organization_id', activeOrgId);

  if (impactsError) {
    console.error('Supabase EPD impacts fetch failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      epdId: params.id,
      code: impactsError.code ?? null,
      message: impactsError.message ?? null,
    });
    return NextResponse.json({ error: impactsError.message }, { status: 500 });
  }

  return NextResponse.json({ epd, impacts: impacts || [] });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const requestId = crypto.randomUUID();
  const body = await request.json();
  const {
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

  const resolvedStandardSet = ALLOWED_SETS.includes(standardSet as EpdSetType)
    ? (standardSet as EpdSetType)
    : 'UNKNOWN';

  const cleanedCustomAttributes = cleanCustomAttributes(customAttributes);
  const cleanedImpacts = cleanImpacts(impacts);
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
    console.warn('Supabase EPD update missing user', {
      requestId,
      hasUser: false,
      ...cookieStatus,
      epdId: params.id,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
    });
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  let activeOrgId: string | null = null;
  try {
    activeOrgId = requireActiveOrgId();
    await assertOrgMember(supabase, user.id, activeOrgId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('EPD update forbidden', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId ?? null,
        code: err.code ?? null,
        message: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Geen actieve organisatie geselecteerd';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!activeOrgId) {
    return NextResponse.json({ error: 'Geen actieve organisatie geselecteerd. Kies eerst een organisatie.' }, { status: 400 });
  }

  const { data: epd, error } = await supabase
    .from('epds')
    .update({
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
        updatedAt: new Date().toISOString(),
      },
    })
    .eq('id', params.id)
    .eq('organization_id', activeOrgId)
    .select('id')
    .single();

  if (error || !epd) {
    console.error('Supabase EPD update failed', {
      requestId,
      epdId: params.id,
      userId: user.id,
      organizationId: activeOrgId,
      code: error?.code ?? null,
      message: error?.message ?? null,
    });
    return NextResponse.json({ error: error?.message || 'Kon EPD niet bijwerken' }, { status: 500 });
  }

  const { error: cleanupError } = await supabase
    .from('epd_impacts')
    .delete()
    .eq('epd_id', params.id)
    .eq('organization_id', activeOrgId);
  if (cleanupError) {
    console.warn('Kon bestaande impacts niet verwijderen', {
      requestId,
      epdId: params.id,
      userId: user.id,
      organizationId: activeOrgId,
      code: cleanupError.code ?? null,
      message: cleanupError.message ?? null,
    });
  }

  if (cleanedImpacts.length) {
    const mapped = cleanedImpacts.map((impact) => ({
      organization_id: activeOrgId,
      epd_id: params.id,
      indicator: impact.indicator,
      set_type: impact.setType,
      stage: impact.stage,
      value: impact.value,
      unit: impact.unit,
    }));

    const { error: impactError } = await supabase.from('epd_impacts').insert(mapped);
    if (impactError) {
      console.error('Supabase impact update failed', {
        requestId,
        epdId: params.id,
        userId: user.id,
        organizationId: activeOrgId,
        code: impactError.code ?? null,
        message: impactError.message ?? null,
      });
      return NextResponse.json({ error: impactError.message }, { status: 500 });
    }
  }

  console.info('EPD updated', {
    requestId,
    epdId: params.id,
    userId: user.id,
    organizationId: activeOrgId,
    status,
  });

  return NextResponse.json({ id: params.id });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase EPD delete missing user', {
      requestId,
      hasUser: false,
      ...cookieStatus,
      epdId: params.id,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
    });
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  let activeOrgId: string | null = null;
  try {
    activeOrgId = requireActiveOrgId();
    await assertOrgMember(supabase, user.id, activeOrgId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('EPD delete forbidden', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId ?? null,
        code: err.code ?? null,
        message: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Geen actieve organisatie geselecteerd';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!activeOrgId) {
    return NextResponse.json({ error: 'Geen actieve organisatie geselecteerd. Kies eerst een organisatie.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('epds')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', activeOrgId);

  if (error) {
    console.error('Supabase EPD delete failed', {
      requestId,
      epdId: params.id,
      userId: user.id,
      organizationId: activeOrgId,
      code: error.code ?? null,
      message: error.message ?? null,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info('EPD deleted', { requestId, epdId: params.id, userId: user.id, organizationId: activeOrgId });
  return NextResponse.json({ ok: true });
}
