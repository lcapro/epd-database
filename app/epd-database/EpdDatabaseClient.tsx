'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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

type SortKey = 'created_at' | 'product_name' | 'producer_name' | 'mki_a1a3' | 'mki_d' | 'co2_a1a3' | 'co2_d';

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

  const page = Number(searchParams.get('page') || '1');
  const sort = (searchParams.get('sort') as SortKey | null) ?? 'created_at';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const defaultSortParams = useMemo(() => ({ sort, order }), [sort, order]);

  useEffect(() => {
    setFilters(parseFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(searchParams.toString());
        if (!params.get('page')) params.set('page', page.toString());
        if (!params.get('pageSize')) params.set('pageSize', '25');
        if (!params.get('sort')) params.set('sort', defaultSortParams.sort);
        if (!params.get('order')) params.set('order', defaultSortParams.order);
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
    fetchData();
  }, [searchParams, page, defaultSortParams]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch('/api/epd/filters');
        if (!res.ok) return;
        const json = (await res.json()) as FilterOptions;
        setOptions(json);
      } catch {
        setOptions(null);
      }
    };
    fetchOptions();
  }, []);

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

  return (
    <div className="card space-y-4">
      <div className="flex-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">EPD database</h2>
          <p className="text-sm text-slate-600">Filter en exporteer opgeslagen EPD&apos;s.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/epd/upload" className="button button-secondary">
            Nieuwe EPD uploaden
          </Link>
          <a href={exportUrl} className="button button-primary">
            Exporteer naar Excel
          </a>
        </div>
      </div>

      <div className="grid-two gap-3">
        <label className="space-y-1">
          <span className="text-sm">Zoek (product/producent)</span>
          <input
            className="input"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Zoekterm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm">Bepalingsmethode versie</span>
          <select
            className="select"
            value={filters.determinationMethodVersion}
            onChange={(e) => setFilters((prev) => ({ ...prev, determinationMethodVersion: e.target.value }))}
          >
            <option value="">Alle</option>
            {options?.determinationMethodVersions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm">PCR versie</span>
          <select
            className="select"
            value={filters.pcrVersion}
            onChange={(e) => setFilters((prev) => ({ ...prev, pcrVersion: e.target.value }))}
          >
            <option value="">Alle</option>
            {options?.pcrVersions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm">Databaseversie</span>
          <select
            className="select"
            value={filters.databaseVersion}
            onChange={(e) => setFilters((prev) => ({ ...prev, databaseVersion: e.target.value }))}
          >
            <option value="">Alle</option>
            {options?.databaseVersions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm">Producent</span>
          <select
            className="select"
            value={filters.producerName}
            onChange={(e) => setFilters((prev) => ({ ...prev, producerName: e.target.value }))}
          >
            <option value="">Alle</option>
            {options?.producers.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm">Productgroep/categorie</span>
          <select
            className="select"
            value={filters.productCategory}
            onChange={(e) => setFilters((prev) => ({ ...prev, productCategory: e.target.value }))}
          >
            <option value="">Alle</option>
            {options?.productCategories.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <button className="button button-primary" onClick={applyFilters}>
          Filters toepassen
        </button>
        <button className="button button-secondary" onClick={resetFilters}>
          Reset filters
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading && <div className="text-sm text-slate-600">Laden...</div>}

      {data && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="underline" onClick={() => toggleSort('product_name')}>
                    Productnaam
                  </button>
                </th>
                <th>
                  <button type="button" className="underline" onClick={() => toggleSort('producer_name')}>
                    Producent
                  </button>
                </th>
                <th>Functionele eenheid</th>
                <th>
                  <button type="button" className="underline" onClick={() => toggleSort('mki_a1a3')}>
                    MKI A1-A3
                  </button>
                </th>
                <th>
                  <button type="button" className="underline" onClick={() => toggleSort('mki_d')}>
                    MKI D
                  </button>
                </th>
                <th>
                  <button type="button" className="underline" onClick={() => toggleSort('co2_a1a3')}>
                    CO2 A1-A3
                  </button>
                </th>
                <th>
                  <button type="button" className="underline" onClick={() => toggleSort('co2_d')}>
                    CO2 D
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((epd) => (
                <tr key={epd.id}>
                  <td>
                    <Link href={`/epd/${epd.id}`} className="text-sky-600 underline">
                      {epd.product_name}
                    </Link>
                  </td>
                  <td>{epd.producer_name || '-'}</td>
                  <td>{epd.functional_unit}</td>
                  <td>{formatNumber(epd.mki_a1a3)}</td>
                  <td>{formatNumber(epd.mki_d)}</td>
                  <td>{formatNumber(epd.co2_a1a3)}</td>
                  <td>{formatNumber(epd.co2_d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex-between">
        <div className="text-sm text-slate-600">
          Pagina {page} van {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            className="button button-secondary"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('page', Math.max(1, page - 1).toString());
              router.push(`/epd-database?${params.toString()}`);
            }}
            disabled={page <= 1}
          >
            Vorige
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('page', Math.min(totalPages, page + 1).toString());
              router.push(`/epd-database?${params.toString()}`);
            }}
            disabled={page >= totalPages}
          >
            Volgende
          </button>
        </div>
      </div>
    </div>
  );
}
