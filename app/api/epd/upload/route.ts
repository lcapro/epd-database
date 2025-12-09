import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import { getAdminClient } from '@/lib/supabaseClient';
import { parseEpd } from '@/lib/epdParser';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Bestand ontbreekt' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Alleen PDF-bestanden zijn toegestaan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = (file as File).name || 'upload.pdf';
    const adminClient = getAdminClient();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'epd-pdfs';
    const path = `epd/${uuidv4()}-${filename}`;

    const { error: uploadError } = await adminClient.storage.from(bucket).upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const parsedPdf = await pdfParse(buffer);
    const parsedEpd = parseEpd(parsedPdf.text || '');

    const { data, error } = await adminClient
      .from('epd_files')
      .insert({ storage_path: path, original_filename: filename, raw_text: parsedPdf.text || '' })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Kon bestand niet opslaan' }, { status: 500 });
    }

    return NextResponse.json({
      fileId: data.id,
      storagePath: path,
      rawText: parsedPdf.text,
      parsedEpd,
    });
  } catch (err) {
    console.error('EPD upload failed', err);
    const message = err instanceof Error ? err.message : 'Onbekende fout bij uploaden';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
