'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';

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

type ActiveOrgResponse = {
  organizationId: string | null;
};

export default function OrgOverviewPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<MembershipWithOrg[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [orgRes, activeRes] = await Promise.all([
          fetch('/api/org/list', { cache: 'no-store' }),
          fetch('/api/org/active', { cache: 'no-store' }),
        ]);

        if (!orgRes.ok) {
          const data = await orgRes.json().catch(() => null);
          throw new Error(data?.error || 'Kon organisaties niet laden');
        }
        const orgJson = (await orgRes.json()) as OrgListResponse;
        const filtered = (orgJson.items || []).filter(
          (membership): membership is MembershipWithOrg => Boolean(membership.organization),
        );
        setMemberships(filtered);

        if (activeRes.ok) {
          const json = (await activeRes.json()) as ActiveOrgResponse;
          setActiveOrgId(json.organizationId ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kon organisaties niet laden');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSetActive = async (orgId: string) => {
    await fetch('/api/org/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    });
    setActiveOrgId(orgId);
    router.push('/epd-database');
    router.refresh();
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

        {loading && <p className="mt-4 text-sm text-gray-600">Laden...</p>}
        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

        {!loading && memberships.length === 0 && (
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
