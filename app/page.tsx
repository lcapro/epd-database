import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Welkom bij de EPD database</h2>
      <p className="text-sm text-slate-600">
        Beheer Environmental Product Declarations voor infrastructuurproducten.
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/epd" className="button button-primary">
          Bekijk EPD&apos;s
        </Link>
        <Link href="/epd-database" className="button button-secondary">
          EPD database
        </Link>
        <Link href="/epd/upload" className="button button-secondary">
          Nieuwe EPD uploaden
        </Link>
      </div>
    </div>
  );
}
