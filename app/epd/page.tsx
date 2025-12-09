'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
    <div className="card space-y-4">
      <div className="flex-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">EPD&apos;s</h2>
          <p className="text-sm text-slate-600">Zoek en blader door geregistreerde EPD&apos;s.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/epd/upload" className="button button-secondary">
            Nieuwe EPD uploaden
          </Link>
          <a href="/api/epd/export?format=excel" className="button button-primary">
            Exporteer naar Excel
          </a>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek op product of producent"
          className="input"
        />
        <button className="button button-primary" onClick={() => { setPage(1); fetchData(); }}>
          Zoeken
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading && <div className="text-sm text-slate-600">Laden...</div>}

      {data && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Producent</th>
                <th>Functionele eenheid</th>
                <th>Publicatie</th>
                <th>Geldigheid</th>
                <th>Set</th>
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
                  <td>{epd.publication_date || '-'}</td>
                  <td>{epd.expiration_date || '-'}</td>
                  <td>{epd.standard_set}</td>
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Vorige
          </button>
          <button
            className="button button-secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Volgende
          </button>
        </div>
      </div>
    </div>
  );
}
