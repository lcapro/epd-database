import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import { createSupabaseRouteClient, hasSupabaseAuthCookie } from '@/lib/supabase/route';
import { assertNoSupabaseError } from '@/lib/supabase/assertNoSupabaseError';
import { getActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';
import { parseEpd } from '@/lib/epdParser';

export const runtime = 'nodejs';

function sanitizePdfText(text: string): string {
  // Replace control characters that are not typically valid in JSON/text storage
  const withoutControl = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  // Strip lone surrogate pairs to avoid invalid Unicode sequences
  return withoutControl.replace(/([\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/g, '');
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const supabase = createSupabaseRouteClient();
    const hasCookie = hasSupabaseAuthCookie();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn('Supabase EPD upload missing user', {
        requestId,
        hasUser: false,
        hasCookie,
        epdId: null,
        impactsCount: null,
        organizationId: getActiveOrgId(),
        code: authError?.code ?? null,
        message: authError?.message ?? null,
      });
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    const formData = await request.formData();
    const fallbackOrgId = formData.get('organizationId');
    const activeOrgId = getActiveOrgId() ?? (typeof fallbackOrgId === 'string' ? fallbackOrgId : null);

    if (!activeOrgId) {
      return NextResponse.json({ error: 'Geen actieve organisatie geselecteerd. Kies eerst een organisatie.' }, { status: 400 });
    }

    try {
      await assertOrgMember(supabase, user.id, activeOrgId);
    } catch (err) {
      if (err instanceof OrgAuthError) {
        console.warn('EPD upload forbidden', {
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
    const file = formData.get('file');

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Bestand ontbreekt' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Alleen PDF-bestanden zijn toegestaan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = (file as File).name || 'upload.pdf';
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'epd-pdfs';
    const path = `epd/${uuidv4()}-${filename}`;

    const uploadResult = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

    const uploadErrorResponse = assertNoSupabaseError({
      result: uploadResult,
      opName: 'upload_epd_pdf',
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      table: `storage:${bucket}`,
    });
    if (uploadErrorResponse) {
      return uploadErrorResponse;
    }

    let parsedPdfText = '';
    let parsedEpd: ReturnType<typeof parseEpd> | null = null;
    let parseError: string | null = null;
    let impactsCount: number | null = null;

    try {
      const parsedPdf = await pdfParse(buffer);
      parsedPdfText = sanitizePdfText(parsedPdf.text || '');
      parsedEpd = parseEpd(parsedPdfText);
      impactsCount = parsedEpd.impacts?.length ?? null;
    } catch (err) {
      console.error('Kon PDF-tekst niet uitlezen', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId,
        epdId: null,
        impactsCount,
        message: err instanceof Error ? err.message : 'Onbekende fout',
      });
      parseError = err instanceof Error ? err.message : 'Onbekende fout bij het lezen van de PDF-tekst';
    }

    const insertResult = await supabase
      .from('epd_files')
      .insert({
        organization_id: activeOrgId,
        storage_path: path,
        original_filename: filename,
        raw_text: parsedPdfText,
      })
      .select('id')
      .single();

    let insertData = insertResult.data;
    let insertError = insertResult.error;

    if (insertError && insertError.message?.toLowerCase().includes('unsupported unicode escape')) {
      console.warn('Kon raw_text niet opslaan door Unicode-fout, probeer zonder tekst', insertError);
      const retry = await supabase
        .from('epd_files')
        .insert({ organization_id: activeOrgId, storage_path: path, original_filename: filename, raw_text: '' })
        .select('id')
        .single();
      insertData = retry.data;
      insertError = retry.error;
      const retryErrorResponse = assertNoSupabaseError({
        result: retry,
        opName: 'insert_epd_files_retry',
        requestId,
        userId: user.id,
        organizationId: activeOrgId,
        table: 'epd_files',
      });
      if (retryErrorResponse) {
        return retryErrorResponse;
      }
    } else {
      const insertErrorResponse = assertNoSupabaseError({
        result: insertResult,
        opName: 'insert_epd_files',
        requestId,
        userId: user.id,
        organizationId: activeOrgId,
        table: 'epd_files',
      });
      if (insertErrorResponse) {
        return insertErrorResponse;
      }
    }

    if (insertError || !insertData) {
      console.error('Supabase EPD file insert failed', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId,
        epdId: null,
        impactsCount,
        code: insertError?.code ?? null,
        message: insertError?.message ?? null,
      });
      return NextResponse.json({ error: insertError?.message || 'Kon bestand niet opslaan' }, { status: 500 });
    }

    console.info('EPD upload stored', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      impactsCount,
      epdId: null,
    });

    return NextResponse.json({
      fileId: insertData.id,
      storagePath: path,
      rawText: parsedPdfText,
      parsedEpd,
      parseError,
    });
  } catch (err) {
    console.error('EPD upload failed', {
      requestId,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    });
    const message = err instanceof Error ? err.message : 'Onbekende fout bij uploaden';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
