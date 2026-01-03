'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/classNames';
import { buttonStyles } from '@/components/ui/button';
import logoFull from '@/assets/infra_impact.png';
import logoIcon from '@/assets/infra_impact-icoon.png';

const navItems = [
  { href: '/', label: 'Overzicht' },
  { href: '/epd-database', label: 'EPD database' },
  { href: '/epd/upload', label: 'Upload' },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Naar overzicht">
          <Image
            src={logoIcon}
            alt="InfraImpact logo"
            width={40}
            height={40}
            className="h-10 w-10 md:hidden"
            priority
          />
          <Image
            src={logoFull}
            alt="InfraImpact"
            height={40}
            className="hidden h-10 w-auto md:block"
            priority
          />
        </Link>
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
