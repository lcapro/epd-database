'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';
import { fetchOrgEndpointWithRetry } from '@/lib/org/orgApiRetry';
import { shouldRedirectToLoginAfterUnauthorized } from '@/lib/auth/shouldRedirectToLogin';
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
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeOrgChecked, setActiveOrgChecked] = useState(false);
  const [activeOrgRecovering, setActiveOrgRecovering] = useState(false);

  useEffect(() => {
    const loadActiveOrg = async () => {
      try {
        const res = await fetchOrgEndpointWithRetry(
          '/api/org/active',
          { cache: 'no-store', credentials: 'include' },
          {
            onRecoveringChange: setActiveOrgRecovering,
            onRecover: (attempt) => {
              if (attempt === 1) {
                router.refresh();
              }
            },
          },
        );
        if (res.status === 401) {
          const shouldRedirect = await shouldRedirectToLoginAfterUnauthorized();
          if (shouldRedirect) {
            router.push('/login');
            return;
          }
          setError('Sessie wordt gesynchroniseerd. Probeer het zo nog eens.');
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as { organizationId: string | null };
          setActiveOrgId(json.organizationId ?? null);
        }
      } finally {
        setActiveOrgChecked(true);
      }
    };
    loadActiveOrg();
  }, [router]);

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
      if (activeOrgId) {
        formData.append('organizationId', activeOrgId);
      }

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
          organizationId: activeOrgId,
        }),
      });

      if (!saveRes.ok) {
        const data = (await saveRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || 'Opslaan mislukt');
      }

      const saved = (await saveRes.json()) as { id: string };
      updateItem(item.id, { status: 'saved', epdId: saved.id, message: 'Opgeslagen' });
    } catch (err) {
      updateItem(item.id, { status: 'error', message: (err as Error).message });
    }
  };

  const pendingItems = useMemo(() => items.filter((item) => item.status === 'pending'), [items]);
  const hasItems = items.length > 0;

  const startUploads = async () => {
    if (!pendingItems.length) return;
    setBusy(true);
    setError(null);

    for (const item of pendingItems) {
      await uploadSingle(item);
    }

    setBusy(false);
  };

  if (activeOrgChecked && !activeOrgId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Badge variant="brand">Bulk upload</Badge>
            <CardTitle className="mt-2">Kies een organisatie</CardTitle>
            <CardDescription>
              Selecteer een actieve organisatie voordat je EPD&apos;s kunt verwerken.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Link href="/org" className={buttonStyles({})}>
              Kies organisatie
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeOrgRecovering && <p className="text-sm text-gray-600">Sessie herstellen...</p>}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="brand">Bulk upload</Badge>
            <CardTitle className="mt-2">Upload meerdere EPD&apos;s</CardTitle>
            <CardDescription>Upload meerdere PDF&apos;s en verwerk ze in één run.</CardDescription>
          </div>
          <Link href="/epd/upload" className={buttonStyles({ variant: 'secondary' })}>
            Terug naar single upload
          </Link>
        </CardHeader>

        <div className="mt-6 space-y-4">
          <div
            className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-600"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            <p>Sleep PDF&apos;s hierheen of klik om te kiezen.</p>
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              id="bulkUploadInput"
              onChange={(event) => {
                if (event.target.files?.length) {
                  handleFiles(event.target.files);
                  event.target.value = '';
                }
              }}
            />
            <label htmlFor="bulkUploadInput" className={buttonStyles({})}>
              Bestanden kiezen
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={startUploads} disabled={!pendingItems.length || busy}>
              {busy ? 'Bezig...' : 'Start verwerking'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setItems([])}
              disabled={!hasItems || busy}
            >
              Wis lijst
            </Button>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
        </div>

        {hasItems && (
          <div className="mt-8 overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Bestand</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Actie</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.file.name}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{item.status}</div>
                      {item.message && <div className="text-xs text-gray-500">{item.message}</div>}
                    </TableCell>
                    <TableCell>
                      {item.epdId ? (
                        <Link href={`/epd/${item.epdId}`} className="text-brand-600 hover:text-brand-700">
                          Open
                        </Link>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => uploadSingle(item)}
                          disabled={busy || item.status === 'uploading' || item.status === 'saving'}
                        >
                          Opnieuw proberen
                        </Button>
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
