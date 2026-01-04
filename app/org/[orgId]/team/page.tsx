'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
};

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

export default function OrgTeamPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params?.orgId as string;
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('id', orgId)
        .single();
      if (orgError) throw orgError;
      setOrganization(org);

      const { data: membersData, error: memberError } = await supabase
        .from('organization_members')
        .select('id, user_id, role, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });
      if (memberError) throw memberError;
      setMembers((membersData || []) as Member[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon team niet laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId]);

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: insertError } = await supabase.from('organization_members').insert({
        organization_id: orgId,
        user_id: userId.trim(),
        role,
      });
      if (insertError) throw insertError;
      setUserId('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon lid niet toevoegen');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (memberId: string, nextRole: string) => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({ role: nextRole })
        .eq('id', memberId);
      if (updateError) throw updateError;
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon rol niet wijzigen');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from('organization_members').delete().eq('id', memberId);
      if (deleteError) throw deleteError;
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon lid niet verwijderen');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async () => {
    await fetch('/api/org/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    });
    router.push('/epd-database');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="brand">Teambeheer</Badge>
            <CardTitle className="mt-2">{organization?.name ?? 'Team'}</CardTitle>
            <CardDescription>Beheer rollen en voeg teamleden toe.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSetActive} variant="secondary">
              Gebruik als actieve org
            </Button>
            <Link href="/org" className={buttonStyles({ variant: 'secondary' })}>
              Terug naar organisaties
            </Link>
          </div>
        </CardHeader>

        {loading && <p className="mt-4 text-sm text-gray-600">Laden...</p>}
        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

        <div className="mt-6 space-y-4">
          <form onSubmit={handleAddMember} className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <FormField label="Supabase user ID" required>
              <Input
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="UUID van de gebruiker"
                required
              />
            </FormField>
            <FormField label="Rol">
              <Select value={role} onChange={(event) => setRole(event.target.value)}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="flex items-end">
              <Button type="submit" disabled={saving}>
                Lid toevoegen
              </Button>
            </div>
          </form>
          <p className="text-xs text-gray-500">
            Vraag teamleden om hun Supabase user ID (auth.uid) en voeg ze hier toe.
          </p>
        </div>

        {members.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-100">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Gebruiker</TableHeaderCell>
                  <TableHeaderCell>Rol</TableHeaderCell>
                  <TableHeaderCell>Acties</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-mono text-xs">{member.user_id}</TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onChange={(event) => handleRoleChange(member.id, event.target.value)}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" onClick={() => handleRemove(member.id)} disabled={saving}>
                        Verwijderen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
