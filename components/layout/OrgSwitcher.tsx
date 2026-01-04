'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Select } from '@/components/ui';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

type Membership = {
  organization: Organization | null;
  role: string;
};

export default function OrgSwitcher() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from('organization_members')
        .select('role, organization:organizations(id, name, slug)')
        .order('created_at', { ascending: false });
      const memberships = (data || []) as Membership[];
      const orgList = memberships
        .map((membership) => membership.organization)
        .filter((org): org is Organization => Boolean(org));
      setOrgs(orgList);

      const res = await fetch('/api/org/active', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setActiveOrgId(json?.organization?.id ?? '');
      }
    };
    load();
  }, []);

  if (!userId) return null;

  const handleSwitch = async (orgId: string) => {
    setActiveOrgId(orgId);
    await fetch('/api/org/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    });
    router.refresh();
  };

  if (!orgs.length) {
    return (
      <Link href="/org/new" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
        Maak organisatie
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={activeOrgId} onChange={(event) => handleSwitch(event.target.value)} className="w-48">
        <option value="" disabled>
          Selecteer organisatie
        </option>
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </Select>
      <Link href="/org" className="text-xs font-semibold text-gray-600 hover:text-brand-700">
        Beheer
      </Link>
    </div>
  );
}
