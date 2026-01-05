'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Alert, Button, Card, CardDescription, CardHeader, CardTitle, FormField, Input } from '@/components/ui';
import { buttonStyles } from '@/components/ui/button';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function OrgNewPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedSlug = useMemo(() => slugify(name), [name]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const finalSlug = slug || derivedSlug;
    const orgId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : uuidv4();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');

      const { error: orgError } = await supabase.from('organizations').insert({
        id: orgId,
        name,
        slug: finalSlug,
        created_by: user.id,
      });

      if (orgError) {
        throw orgError;
      }

      const { error: memberError } = await supabase.from('organization_members').insert({
        organization_id: orgId,
        role: 'owner',
        user_id: user.id,
      });

      if (memberError) {
        throw memberError;
      }

      await fetch('/api/org/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId: orgId }),
      });

      router.push('/epd-database');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon organisatie niet opslaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe organisatie</CardTitle>
          <CardDescription>Maak een team aan om EPD&apos;s gescheiden te beheren.</CardDescription>
        </CardHeader>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <FormField label="Naam" required>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSlug('');
              }}
              placeholder="Bijv. InfraImpact BV"
              required
            />
          </FormField>
          <FormField label="Slug" required>
            <Input
              value={slug || derivedSlug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="infraimpact-bv"
              required
            />
          </FormField>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading}>
              Organisatie aanmaken
            </Button>
            <Link href="/org" className={buttonStyles({ variant: 'secondary' })}>
              Annuleren
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
