'use client';

import Link from 'next/link';
import { buttonStyles } from '@/components/ui/button';
import { useAuthStatus } from '@/lib/auth/useAuthStatus';

export default function AuthControls() {
  const { status, user } = useAuthStatus();

  if (status === 'loading') {
    return <div className="h-9 w-24 animate-pulse rounded-xl bg-gray-100" />;
  }

  if (status !== 'authenticated') {
    return (
      <Link href="/login" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
        Inloggen
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="hidden md:inline">{user?.email}</span>
      <Link href="/logout" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
        Uitloggen
      </Link>
    </div>
  );
}
