'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStatus } from '@/lib/auth/useAuthStatus';

export default function PublicAuthRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuthStatus();

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') return;
    if (pathname !== '/login') return;
    router.replace('/org');
  }, [pathname, router, status]);

  return null;
}
