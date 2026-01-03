'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/classNames';
import { buttonStyles } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Overzicht' },
  { href: '/epd-database', label: 'EPD database' },
  { href: '/epd', label: 'EPD lijst' },
  { href: '/epd/upload', label: 'Upload' },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white font-semibold">
            II
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">InfraImpact</p>
            <p className="text-xs text-gray-500">EPD Database</p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'transition hover:text-brand-700',
                  active && 'text-brand-700'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block">
          <Link href="/epd/upload" className={buttonStyles({})}>
            Start upload
          </Link>
        </div>
      </div>
    </header>
  );
}
