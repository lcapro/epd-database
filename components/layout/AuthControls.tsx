'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { buttonStyles } from '@/components/ui/button';

export default function AuthControls() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  if (!email) {
    return (
      <Link href="/login" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
        Inloggen
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="hidden md:inline">{email}</span>
      <Link href="/logout" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
        Uitloggen
      </Link>
    </div>
  );
}
