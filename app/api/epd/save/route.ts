import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';
import { ParsedImpact } from '@/lib/types';

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

  if (!productName || !functionalUnit) {
    return NextResponse.json({ error: 'productName en functionalUnit zijn verplicht' }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: epd, error } = await admin
    .from('epds')
    .insert({
      epd_file_id: fileId || null,
      product_name: productName,
      functional_unit: functionalUnit,
      producer_name: producerName || null,
      lca_method: lcaMethod || null,
      pcr_version: pcrVersion || null,
      database_name: databaseName || null,
      publication_date: publicationDate || null,
      expiration_date: expirationDate || null,
      verifier_name: verifierName || null,
      standard_set: standardSet || 'UNKNOWN',
      custom_attributes: customAttributes || {},
    })
    .select('id')
    .single();

  if (error || !epd) {
    return NextResponse.json({ error: error?.message || 'Kon EPD niet opslaan' }, { status: 500 });
  }

  if (impacts?.length) {
    const mapped = impacts.map((impact) => ({
      epd_id: epd.id,
      indicator: impact.indicator,
      set_type: impact.setType,
      stage: impact.stage,
      value: impact.value,
      unit: impact.unit ?? null,
    }));

    const { error: impactError } = await admin.from('epd_impacts').insert(mapped);
    if (impactError) {
      return NextResponse.json({ error: impactError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: epd.id });
}
