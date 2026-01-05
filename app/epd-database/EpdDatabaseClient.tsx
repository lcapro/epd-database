'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';
import { ensureSupabaseSession } from '@/lib/auth/ensureSupabaseSession';

type EpdListItem = {
  id: string;
  product_name: string;
  producer_name: string | null;
  functional_unit: string;
  mki_a1a3: number | null;
  mki_d: number | null;
  co2_a1a3: number | null;
  co2_d: number | null;
  determination_method_version: string | null;
  pcr_version: string | null;
  database_version: string | null;
  product_category: string | null;
  created_at: string | null;
  status: string | null;
};

type ListResponse = {
  items: EpdListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type FilterOptions = {
  determinationMethodVersions: string[];
  pcrVersions: string[];
  databaseVersions: string[];
  producers: string[];
  productCategories: string[];
};

type SortKey =
  | 'created_at'
  | 'updated_at'
  | 'product_name'
  | 'producer_name'
  | 'mki_a1a3'
  | 'mki_d'
  | 'co2_a1a3'
  | 'co2_d';

type ActiveOrgResponse = {
  organizationId: string | null;
};

const defaultFilters = {
  q: '',
  determinationMethodVersion: '',
  pcrVersion: '',
  databaseVersion: '',
  producerName: '',
  productCategory: '',
};

function formatNumber(value: number | null) {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('nl-NL', { maximumFractionDigits: 6 });
}

function parseFilters(params: URLSearchParams) {
  return {
    q: params.get('q') || '',
    determinationMethodVersion: params.get('determinationMethodVersion') || '',
    pcrVersion: params.get('pcrVersion') || '',
    databaseVersion: params.get('databaseVersion') || '',
    producerName: params.get('producerName') || '',
    productCategory: params.get('productCategory') || '',
  };
}

function buildSearchParams(filters: typeof defaultFilters, overrides?: Record<string, string>) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.determinationMethodVersion) params.set('determinationMethodVersion', filters.determinationMethodVersion);
  if (filters.pcrVersion) params.set('pcrVersion', filters.pcrVersion);
  if (filters.databaseVersion) params.set('databaseVersion', filters.databaseVersion);
  if (filters.producerName) params.set('producerName', filters.producerName);
  if (filters.productCategory) params.set('productCategory', filters.productCategory);
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }
  return params;
}

export default function EpdDatabaseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => parseFilters(searchParams));
  const [data, setData] = useState<ListResponse | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeOrgChecked, setActiveOrgChecked] = useState(false);

  const page = Number(searchParams.get('page') || '1');
  const sort = (searchParams.get('sort') as SortKey | null) ?? 'updated_at';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const defaultSortParams = useMemo(() => ({ sort, order }), [sort, order]);

  useEffect(() => {
    const loadActiveOrg = async () => {
      try {
        let res = await fetch('/api/org/active', { cache: 'no-store', credentials: 'include' });
        if (res.status === 401) {
          const refreshed = await ensureSupabaseSession();
          if (refreshed) {
            res = await fetch('/api/org/active', { cache: 'no-store', credentials: 'include' });
          }
        }
        if (res.ok) {
          const json = (await res.json()) as ActiveOrgResponse;
          setActiveOrgId(json.organizationId ?? null);
        }
      } finally {
        setActiveOrgChecked(true);
      }
    };
    loadActiveOrg();
  }, []);

  useEffect(() => {
    setFilters(parseFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (!activeOrgChecked || !activeOrgId) {
      setData(null);
      setOptions(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(searchParams.toString());
        if (!params.get('page')) params.set('page', page.toString());
        if (!params.get('pageSize')) params.set('pageSize', '25');
        if (!params.get('sort')) params.set('sort', defaultSortParams.sort);
        if (!params.get('order')) params.set('order', defaultSortParams.order);
        const res = await fetch(`/api/epd/list?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Fout bij laden');
        const json = (await res.json()) as ListResponse;
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchParams, page, defaultSortParams, activeOrgChecked, activeOrgId]);

  useEffect(() => {
    if (!activeOrgChecked || !activeOrgId) {
      setOptions(null);
      return;
    }

    const fetchOptions = async () => {
      try {
        const res = await fetch('/api/epd/filters', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as FilterOptions;
        setOptions(json);
      } catch {
        setOptions(null);
      }
    };
    fetchOptions();
  }, [activeOrgChecked, activeOrgId]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  const applyFilters = () => {
    const params = buildSearchParams(filters, { page: '1', sort, order });
    router.push(`/epd-database?${params.toString()}`);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    router.push('/epd-database');
  };

  const toggleSort = (column: SortKey) => {
    const nextOrder = sort === column && order === 'asc' ? 'desc' : 'asc';
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', column);
    params.set('order', nextOrder);
    router.push(`/epd-database?${params.toString()}`);
  };

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get('sort')) params.set('sort', defaultSortParams.sort);
    if (!params.get('order')) params.set('order', defaultSortParams.order);
    params.set('format', 'excel');
    return `/api/epd/export?${params.toString()}`;
  }, [searchParams, defaultSortParams]);

  if (activeOrgChecked && !activeOrgId) {
    return (
      <div className="space-y-6">
        <Card className="border-brand-100/70 bg-white/85 shadow-soft">
          <CardHeader>
            <Badge variant="brand">EPD database</Badge>
            <CardTitle className="mt-2">Kies een organisatie</CardTitle>
            <CardDescription>
              Selecteer een actieve organisatie om de EPD database te bekijken en te beheren.
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
      <Card className="relative overflow-hidden border-brand-100/70 bg-white/85 shadow-soft backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-accent-500 to-brand-500" />
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="brand">Database</Badge>
            <CardTitle className="mt-2 bg-gradient-to-r from-brand-700 to-accent-700 bg-clip-text text-transparent">
              EPD database
            </CardTitle>
            <CardDescription>
              Filter, vergelijk en exporteer EPD&apos;s met dezelfde uitstraling als infraimpact.nl.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/epd/upload" className={buttonStyles({ variant: 'secondary' })}>
              Nieuwe EPD uploaden
            </Link>
            <Link href="/epd/upload/bulk" className={buttonStyles({ variant: 'secondary' })}>
              Bulk upload
            </Link>
            <a href={exportUrl} className={buttonStyles({})}>
              Exporteer naar Excel
            </a>
          </div>
        </CardHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="Zoek (product/producent)">
            <Input
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Zoekterm"
            />
          </FormField>

          <FormField label="Bepalingsmethode versie">
            <Select
              value={filters.determinationMethodVersion}
              onChange={(e) => setFilters((prev) => ({ ...prev, determinationMethodVersion: e.target.value }))}
            >
              <option value="">Alle</option>
              {options?.determinationMethodVersions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="PCR versie">
            <Select
              value={filters.pcrVersion}
              onChange={(e) => setFilters((prev) => ({ ...prev, pcrVersion: e.target.value }))}
            >
              <option value="">Alle</option>
              {options?.pcrVersions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Databaseversie">
            <Select
              value={filters.databaseVersion}
              onChange={(e) => setFilters((prev) => ({ ...prev, databaseVersion: e.target.value }))}
            >
              <option value="">Alle</option>
              {options?.databaseVersions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Producent">
            <Select
              value={filters.producerName}
              onChange={(e) => setFilters((prev) => ({ ...prev, producerName: e.target.value }))}
            >
              <option value="">Alle</option>
              {options?.producers.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Productcategorie">
            <Select
              value={filters.productCategory}
              onChange={(e) => setFilters((prev) => ({ ...prev, productCategory: e.target.value }))}
            >
              <option value="">Alle</option>
              {options?.productCategories.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={applyFilters}>Filteren</Button>
          <Button variant="secondary" onClick={resetFilters}>Reset</Button>
        </div>

        {error && <Alert variant="danger" className="mt-6">{error}</Alert>}

        {loading && <p className="mt-6 text-sm text-gray-600">Laden...</p>}

        {!loading && data && data.items.length === 0 && (
          <EmptyState
            title="Geen resultaten"
            description="Er zijn nog geen EPD's toegevoegd. Upload een EPD om te starten."
            actionLabel="Nieuwe EPD uploaden"
            onAction={() => router.push('/epd/upload')}
            secondaryActionLabel="Bulk upload"
            onSecondaryAction={() => router.push('/epd/upload/bulk')}
          />
        )}

        {!loading && data && data.items.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell onClick={() => toggleSort('product_name')}>Product</TableHeaderCell>
                  <TableHeaderCell onClick={() => toggleSort('producer_name')}>Producent</TableHeaderCell>
                  <TableHeaderCell>Functionele eenheid</TableHeaderCell>
                  <TableHeaderCell onClick={() => toggleSort('mki_a1a3')}>MKI A1-A3</TableHeaderCell>
                  <TableHeaderCell onClick={() => toggleSort('mki_d')}>MKI D</TableHeaderCell>
                  <TableHeaderCell onClick={() => toggleSort('co2_a1a3')}>CO₂ A1-A3</TableHeaderCell>
                  <TableHeaderCell onClick={() => toggleSort('co2_d')}>CO₂ D</TableHeaderCell>
                  <TableHeaderCell onClick={() => toggleSort('created_at')}>Toegevoegd</TableHeaderCell>
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
                    <TableCell>{formatNumber(epd.mki_a1a3)}</TableCell>
                    <TableCell>{formatNumber(epd.mki_d)}</TableCell>
                    <TableCell>{formatNumber(epd.co2_a1a3)}</TableCell>
                    <TableCell>{formatNumber(epd.co2_d)}</TableCell>
                    <TableCell>{epd.created_at ? new Date(epd.created_at).toLocaleDateString('nl-NL') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              className="mt-6"
              page={page}
              totalPages={totalPages}
              onPageChange={(nextPage) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', String(nextPage));
                router.push(`/epd-database?${params.toString()}`);
              }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
