'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStatus } from '@/lib/auth/useAuthStatus';

export default function AuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuthStatus();

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'unauthenticated') return;

    const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${nextParam}`);
  }, [pathname, router, status]);

  return null;
}
