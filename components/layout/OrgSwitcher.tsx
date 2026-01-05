'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui';
import { ensureSupabaseSession } from '@/lib/auth/ensureSupabaseSession';
import { useAuthStatus } from '@/lib/auth/useAuthStatus';
import { postActiveOrg } from '@/lib/org/activeOrgClient';
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
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const { status: activeStatus, organizationId, setOrganizationId, error: activeOrgError } = useActiveOrg(
    authStatus === 'authenticated' && sessionReady,
  );
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const canSwitchOrg = authStatus === 'authenticated' && sessionReady && activeStatus === 'ready';

  useEffect(() => {
    let active = true;
    const confirmSession = async () => {
      if (authStatus !== 'authenticated') {
        if (active) {
          setSessionReady(false);
          setSessionError(null);
        }
        return;
      }

      setSessionError(null);
      const ready = await ensureSupabaseSession();
      if (!active) return;
      setSessionReady(ready);
      if (!ready) {
        setSessionError('Sessie kon niet bevestigd worden. Probeer het opnieuw.');
      }
    };

    confirmSession();

    return () => {
      active = false;
    };
  }, [authStatus]);

  useEffect(() => {
    const load = async () => {
      if (authStatus !== 'authenticated') {
        setOrgs([]);
        setLoading(false);
        return;
      }
      if (!sessionReady) {
        setLoading(true);
        return;
      }

      setLoading(true);
      setListError(null);
      try {
        let orgRes = await fetch('/api/org/list', { cache: 'no-store', credentials: 'include' });
        if (orgRes.status === 401) {
          const refreshed = await ensureSupabaseSession();
          if (refreshed) {
            orgRes = await fetch('/api/org/list', { cache: 'no-store', credentials: 'include' });
          }
        }

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
  }, [authStatus, sessionReady]);

  const handleSwitch = async (orgId: string) => {
    if (!canSwitchOrg) {
      setListError('Sessie wordt nog geladen. Probeer zo nog eens.');
      return;
    }
    if (switching) return;
    const previousOrgId = organizationId;
    setSwitching(true);
    setOrganizationId(orgId);
    try {
      let response = await postActiveOrg(orgId);
      if (response.status === 401) {
        const refreshed = await ensureSupabaseSession();
        if (refreshed) {
          response = await postActiveOrg(orgId);
        }
      }
      if (response.status === 401) {
        throw new Error('Je sessie is verlopen. Log opnieuw in.');
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
  if (loading || activeStatus === 'loading' || activeStatus === 'idle' || !sessionReady) return null;
  if (listError || activeOrgError || sessionError) {
    return (
      <span
        className="text-xs font-semibold text-danger-600"
        title={listError ?? activeOrgError ?? sessionError ?? ''}
      >
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
        disabled={switching || !canSwitchOrg}
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
