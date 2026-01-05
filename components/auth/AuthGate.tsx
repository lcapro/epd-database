'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStatus } from '@/lib/auth/useAuthStatus';

export default function AuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useAuthStatus();

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'unauthenticated') return;

    const query = searchParams?.toString();
    const nextPath = `${pathname ?? ''}${query ? `?${query}` : ''}`;
    const nextParam = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    router.replace(`/login${nextParam}`);
  }, [pathname, router, searchParams, status]);

  return null;
}
