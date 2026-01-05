'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';
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
  role: string;
  organization: Organization | null;
};

type MembershipWithOrg = Membership & { organization: Organization };

type OrgListResponse = {
  items: Membership[];
};

export default function OrgOverviewPage() {
  const router = useRouter();
  const { status: authStatus } = useAuthStatus();
  const refreshTriggered = useRef(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const {
    status: activeStatus,
    organizationId: activeOrgId,
    setOrganizationId,
    error: activeError,
  } = useActiveOrg(authStatus === 'authenticated' && sessionReady);
  const [memberships, setMemberships] = useState<MembershipWithOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingOrgId, setSettingOrgId] = useState<string | null>(null);
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
      } else if (!refreshTriggered.current) {
        refreshTriggered.current = true;
        router.refresh();
      }
    };

    confirmSession();

    return () => {
      active = false;
    };
  }, [authStatus, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (authStatus !== 'authenticated') {
        setLoading(false);
        return;
      }
      if (!sessionReady) {
        setLoading(true);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let orgRes = await fetch('/api/org/list', { cache: 'no-store', credentials: 'include' });
        if (orgRes.status === 401) {
          const refreshed = await ensureSupabaseSession();
          if (refreshed) {
            orgRes = await fetch('/api/org/list', { cache: 'no-store', credentials: 'include' });
          }
        }

        if (!orgRes.ok) {
          const data = await orgRes.json().catch(() => null);
          throw new Error(data?.error || 'Kon organisaties niet laden');
        }
        const orgJson = (await orgRes.json()) as OrgListResponse;
        const filtered = (orgJson.items || []).filter(
          (membership): membership is MembershipWithOrg => Boolean(membership.organization),
        );
        setMemberships(filtered);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kon organisaties niet laden');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authStatus, sessionReady]);

  const handleSetActive = async (orgId: string) => {
    if (!canSwitchOrg) {
      setError('Sessie wordt nog geladen. Probeer zo nog eens.');
      return;
    }
    if (settingOrgId) return;
    setSettingOrgId(orgId);
    setError(null);
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
      setOrganizationId(orgId);
      router.push('/epd-database');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon organisatie niet activeren');
    } finally {
      setSettingOrgId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="brand">Organisaties</Badge>
            <CardTitle className="mt-2">Je organisaties</CardTitle>
            <CardDescription>Kies een actieve organisatie of maak een nieuwe aan.</CardDescription>
          </div>
          <Link href="/org/new" className={buttonStyles({})}>
            Nieuwe organisatie
          </Link>
        </CardHeader>

        {(authStatus === 'loading' ||
          (authStatus === 'authenticated' && (loading || activeStatus === 'loading' || !sessionReady))) && (
          <p className="mt-4 text-sm text-gray-600">Laden...</p>
        )}
        {(error || activeError || sessionError) && (
          <Alert variant="danger" className="mt-4">
            {error ?? activeError ?? sessionError}
          </Alert>
        )}

        {!loading && authStatus === 'authenticated' && memberships.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-600">
            Je bent nog geen lid van een organisatie. Maak er een aan om te starten.
          </div>
        )}

        <div className="mt-6 space-y-3">
          {memberships.map((membership) => (
            <div
              key={membership.organization.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">{membership.organization.name}</div>
                <div className="text-xs text-gray-500">
                  {membership.organization.slug} · rol: {membership.role}
                </div>
              </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={activeOrgId === membership.organization.id ? 'secondary' : 'primary'}
                    loading={settingOrgId === membership.organization.id}
                    disabled={!canSwitchOrg || Boolean(settingOrgId)}
                    onClick={() => handleSetActive(membership.organization.id)}
                  >
                    {activeOrgId === membership.organization.id ? 'Actief' : 'Activeer'}
                  </Button>
                <Link
                  href={`/org/${membership.organization.id}/team`}
                  className={buttonStyles({ variant: 'secondary' })}
                >
                  Team beheren
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
