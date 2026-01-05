'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui';
import { ensureSupabaseSession } from '@/lib/auth/ensureSupabaseSession';
import { useAuthStatus } from '@/lib/auth/useAuthStatus';
import { useActiveOrg } from '@/lib/org/useActiveOrg';

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

export default function OrgSwitcher() {
  const router = useRouter();
  const { status: authStatus } = useAuthStatus();
  const { status: activeStatus, organizationId, setOrganizationId, error: activeOrgError } = useActiveOrg(
    authStatus === 'authenticated',
  );
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (authStatus !== 'authenticated') {
        setOrgs([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setListError(null);
      try {
        const orgRes = await fetch('/api/org/list', { cache: 'no-store' });

        if (orgRes.ok) {
          const json = (await orgRes.json()) as OrgListResponse;
          const orgList = (json.items || [])
            .map((membership) => membership.organization)
            .filter((org): org is Organization => Boolean(org));
          setOrgs(orgList);
        } else {
          const data = await orgRes.json().catch(() => null);
          throw new Error(data?.error || 'Kon organisaties niet laden');
        }
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Kon organisaties niet laden');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authStatus]);

  const handleSwitch = async (orgId: string) => {
    if (switching) return;
    const previousOrgId = organizationId;
    setSwitching(true);
    setOrganizationId(orgId);
    try {
      let response = await fetch('/api/org/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (response.status === 401) {
        const refreshed = await ensureSupabaseSession();
        if (refreshed) {
          response = await fetch('/api/org/active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId: orgId }),
          });
        }
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Kon organisatie niet activeren');
      }
      router.refresh();
    } catch (err) {
      setOrganizationId(previousOrgId ?? null);
      setListError(err instanceof Error ? err.message : 'Kon organisatie niet activeren');
    } finally {
      setSwitching(false);
    }
  };

  if (authStatus !== 'authenticated') return null;
  if (loading || activeStatus === 'loading' || activeStatus === 'idle') return null;
  if (listError || activeOrgError) {
    return (
      <span className="text-xs font-semibold text-danger-600" title={listError ?? activeOrgError ?? ''}>
        Organisaties niet geladen
      </span>
    );
  }

  if (!orgs.length) {
    return (
      <Link href="/org/new" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
        Maak organisatie
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={organizationId ?? ''}
        onChange={(event) => handleSwitch(event.target.value)}
        className="w-48"
        disabled={switching}
      >
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
