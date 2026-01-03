'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';
import { ParsedEpd } from '@/lib/types';

type UploadStatus = 'pending' | 'uploading' | 'saving' | 'saved' | 'error';

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  message?: string;
  fileId?: string;
  epdId?: string;
  parsed?: ParsedEpd | null;
};

type UploadResponse = {
  fileId?: string;
  parsedEpd?: ParsedEpd | null;
  parseError?: string | null;
};

function buildId(file: File) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${file.name}-${file.size}-${Date.now()}`;
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export default function BulkUploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const selected = Array.from(files);
    const next: UploadItem[] = [];

    for (const file of selected) {
      if (!isPdf(file)) {
        next.push({
          id: buildId(file),
          file,
          status: 'error',
          message: 'Alleen PDF-bestanden zijn toegestaan.',
        });
        continue;
      }

      next.push({
        id: buildId(file),
        file,
        status: 'pending',
      });
    }

    setItems((prev) => [...prev, ...next]);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files?.length) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const updateItem = (id: string, update: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...update } : item)));
  };

  const uploadSingle = async (item: UploadItem) => {
    updateItem(item.id, { status: 'uploading', message: undefined });

    try {
      const formData = new FormData();
      formData.append('file', item.file);

      const uploadRes = await fetch('/api/epd/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || 'Upload mislukt');
      }

      const uploadData = (await uploadRes.json()) as UploadResponse;
      const parsed = uploadData.parsedEpd ?? null;

      if (!parsed?.productName || !parsed?.functionalUnit) {
        updateItem(item.id, {
          status: 'error',
          fileId: uploadData.fileId,
          parsed,
          message: 'Onvoldoende gegevens gevonden (productnaam en functionele eenheid vereist).',
        });
        return;
      }

      updateItem(item.id, {
        status: 'saving',
        fileId: uploadData.fileId,
        parsed,
        message: uploadData.parseError ? `Let op: ${uploadData.parseError}` : undefined,
      });

      const saveRes = await fetch('/api/epd/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.fileId,
          productName: parsed.productName,
          functionalUnit: parsed.functionalUnit,
          producerName: parsed.producerName,
          lcaMethod: parsed.lcaMethod,
          pcrVersion: parsed.pcrVersion,
          databaseName: parsed.databaseName,
          databaseNmdVersion: parsed.databaseNmdVersion,
          databaseEcoinventVersion: parsed.databaseEcoinventVersion,
          publicationDate: parsed.publicationDate,
          expirationDate: parsed.expirationDate,
          verifierName: parsed.verifierName,
          standardSet: parsed.standardSet,
          impacts: parsed.impacts,
          customAttributes: {},
        }),
      });

      if (!saveRes.ok) {
        const data = (await saveRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || 'Opslaan mislukt');
      }

      const saved = (await saveRes.json()) as { id?: string };
      updateItem(item.id, {
        status: 'saved',
        epdId: saved.id,
        message: uploadData.parseError ? `Opgeslagen met waarschuwing: ${uploadData.parseError}` : undefined,
      });
    } catch (err) {
      updateItem(item.id, {
        status: 'error',
        message: err instanceof Error ? err.message : 'Onbekende fout',
      });
    }
  };

  const startUpload = async () => {
    const queue = items.filter((item) => item.status === 'pending' || item.status === 'error');
    if (!queue.length) {
      setError('Selecteer minimaal één PDF om te uploaden.');
      return;
    }

    setError(null);
    setBusy(true);

    for (const item of queue) {
      // eslint-disable-next-line no-await-in-loop
      await uploadSingle(item);
    }

    setBusy(false);
  };

  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'saved') acc.saved += 1;
        if (item.status === 'error') acc.failed += 1;
        if (item.status === 'uploading' || item.status === 'saving') acc.processing += 1;
        return acc;
      },
      { total: 0, saved: 0, failed: 0, processing: 0 },
    );
  }, [items]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="brand">Bulk upload</Badge>
            <CardTitle className="mt-2">Meerdere EPD&apos;s uploaden</CardTitle>
            <CardDescription>Sleep meerdere PDF&apos;s tegelijk om ze direct toe te voegen.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={startUpload} disabled={busy} loading={busy}>
              Upload alles
            </Button>
            <Link href="/epd/upload" className={buttonStyles({ variant: 'secondary' })}>
              Terug naar enkele upload
            </Link>
          </div>
        </CardHeader>

        <div
          className="mt-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <p className="text-sm text-gray-600">Sleep meerdere PDF&apos;s hierheen of kies bestanden.</p>
          <input
            type="file"
            multiple
            accept="application/pdf"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="mt-3 text-sm"
          />
          <p className="mt-2 text-xs text-gray-500">{stats.total} bestanden geselecteerd</p>
        </div>

        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploadstatus</CardTitle>
          <CardDescription>
            {stats.saved} opgeslagen · {stats.failed} mislukt · {stats.processing} bezig
          </CardDescription>
        </CardHeader>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Nog geen bestanden toegevoegd.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Bestand</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Resultaat</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-gray-800">{item.file.name}</TableCell>
                    <TableCell className="capitalize">
                      {item.status === 'pending' && 'Wachtend'}
                      {item.status === 'uploading' && 'Uploaden'}
                      {item.status === 'saving' && 'Opslaan'}
                      {item.status === 'saved' && 'Opgeslagen'}
                      {item.status === 'error' && 'Mislukt'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {item.epdId ? (
                        <Link href={`/epd/${item.epdId}`} className="text-brand-600 hover:text-brand-700">
                          Bekijk EPD
                        </Link>
                      ) : (
                        item.message || '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
