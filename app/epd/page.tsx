'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';

type EpdListItem = {
  id: string;
  product_name: string;
  producer_name: string | null;
  functional_unit: string;
  publication_date: string | null;
  expiration_date: string | null;
  standard_set: string;
};

type ListResponse = {
  items: EpdListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export default function EpdListPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: '25' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/epd/list?${params.toString()}`);
      if (!res.ok) throw new Error('Fout bij laden');
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="brand">EPD overzicht</Badge>
            <CardTitle className="mt-2">EPD&apos;s</CardTitle>
            <CardDescription>Zoek en open geregistreerde EPD&apos;s.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/epd/upload" className={buttonStyles({ variant: 'secondary' })}>
              Nieuwe EPD uploaden
            </Link>
            <a href="/api/epd/export?format=excel" className={buttonStyles({})}>
              Exporteer naar Excel
            </a>
          </div>
        </CardHeader>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op product of producent"
          />
          <Button onClick={() => { setPage(1); fetchData(); }}>
            Zoeken
          </Button>
        </div>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <Alert variant="info">Laden...</Alert>}

      {data && data.items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Product</TableHeaderCell>
                  <TableHeaderCell>Producent</TableHeaderCell>
                  <TableHeaderCell>Functionele eenheid</TableHeaderCell>
                  <TableHeaderCell>Publicatie</TableHeaderCell>
                  <TableHeaderCell>Geldigheid</TableHeaderCell>
                  <TableHeaderCell>Set</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((epd) => (
                  <TableRow key={epd.id}>
                    <TableCell>
                      <Link href={`/epd/${epd.id}`} className="font-semibold text-brand-700 hover:text-brand-800">
                        {epd.product_name}
                      </Link>
                    </TableCell>
                    <TableCell>{epd.producer_name || '-'}</TableCell>
                    <TableCell>{epd.functional_unit}</TableCell>
                    <TableCell>{epd.publication_date || '-'}</TableCell>
                    <TableCell>{epd.expiration_date || '-'}</TableCell>
                    <TableCell>{epd.standard_set}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title="Geen EPD&apos;s gevonden"
          description="Pas je zoekterm aan of upload een nieuwe EPD."
          actionLabel="Nieuwe upload"
          onAction={() => (window.location.href = '/epd/upload')}
        />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(nextPage) => setPage(nextPage)}
      />
    </div>
  );
}
