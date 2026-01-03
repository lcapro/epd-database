import Link from 'next/link';
import { Badge, Card, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Badge variant="brand">EPD platform</Badge>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl">
              EPD&apos;s beheren. Snel en overzichtelijk.
            </h1>
            <p className="text-balance text-base text-gray-600">
              Upload, controleer en exporteer EPD-data vanuit één omgeving. Simpel, strak en betrouwbaar.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/epd/upload" className={buttonStyles({})}>
              Start upload
            </Link>
            <Link href="/epd-database" className={buttonStyles({ variant: 'secondary' })}>
              Naar de database
            </Link>
          </div>
          <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              Automatische parsing
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              Duidelijke exports
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              Consistente data
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              B2B-ready
            </div>
          </div>
        </div>
        <Card className="h-full">
          <CardHeader className="space-y-2">
            <CardTitle>Inzicht in één oogopslag</CardTitle>
            <CardDescription>Een helder overzicht voor teams die snel moeten schakelen.</CardDescription>
          </CardHeader>
          <div className="mt-6 flex items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 p-6">
            <svg
              viewBox="0 0 240 160"
              className="h-32 w-full max-w-xs text-brand-600"
              role="img"
              aria-label="Illustratie van dashboard"
            >
              <rect x="10" y="10" width="220" height="140" rx="18" fill="currentColor" opacity="0.12" />
              <rect x="30" y="35" width="180" height="16" rx="8" fill="currentColor" opacity="0.4" />
              <rect x="30" y="65" width="120" height="12" rx="6" fill="currentColor" opacity="0.35" />
              <rect x="30" y="90" width="160" height="12" rx="6" fill="currentColor" opacity="0.3" />
              <rect x="30" y="115" width="90" height="12" rx="6" fill="currentColor" opacity="0.3" />
              <circle cx="190" cy="110" r="18" fill="currentColor" opacity="0.25" />
            </svg>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: 'Upload',
            description: 'Sleep een PDF en controleer direct.',
          },
          {
            title: 'Filter',
            description: 'Zoek snel op producent of categorie.',
          },
          {
            title: 'Export',
            description: 'Excel-exports in één klik.',
          },
        ].map((item) => (
          <Card key={item.title} className="h-full">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Start vandaag met je EPD&apos;s</h2>
            <p className="mt-2 text-sm text-gray-600">Upload je eerste PDF of bekijk de lijst.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/epd/upload" className={buttonStyles({})}>
              Start
            </Link>
            <Link href="/epd" className={buttonStyles({ variant: 'secondary' })}>
              Bekijk lijst
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
