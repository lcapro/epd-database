'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

type OrgListResponse = {
  items: Membership[];
};

type ActiveOrgResponse = {
  organizationId: string | null;
};

export default function OrgSwitcher() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [orgRes, activeRes] = await Promise.all([
          fetch('/api/org/list', { cache: 'no-store' }),
          fetch('/api/org/active', { cache: 'no-store' }),
        ]);

        if (orgRes.ok) {
          const json = (await orgRes.json()) as OrgListResponse;
          const orgList = (json.items || [])
            .map((membership) => membership.organization)
            .filter((org): org is Organization => Boolean(org));
          setOrgs(orgList);
        }

        if (activeRes.ok) {
          const json = (await activeRes.json()) as ActiveOrgResponse;
          setActiveOrgId(json.organizationId ?? '');
        }
      } finally {
        setReady(true);
      }
    };
    load();
  }, []);

  const handleSwitch = async (orgId: string) => {
    setActiveOrgId(orgId);
    await fetch('/api/org/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    });
    router.refresh();
  };

  if (!ready) return null;

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
