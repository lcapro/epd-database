create policy "storage_epd_uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'epd-pdfs'
    and auth.role() = 'authenticated'
  );
