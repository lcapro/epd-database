'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Alert, Button, Card, CardDescription, CardHeader, CardTitle, FormField, Input } from '@/components/ui';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextPath = searchParams.get('next') || '/org';

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(nextPath);
        router.refresh();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setMessage('Account aangemaakt. Controleer je e-mail voor bevestiging en log daarna in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${nextPath}`,
        },
      });
      if (otpError) throw otpError;
      setMessage('Magic link verstuurd. Controleer je e-mail om in te loggen.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kon magic link niet versturen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Inloggen</CardTitle>
          <CardDescription>Gebruik je e-mail om toegang te krijgen tot je organisaties.</CardDescription>
        </CardHeader>
        <form className="mt-6 space-y-4" onSubmit={handleAuth}>
          <FormField label="E-mail" required>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="naam@bedrijf.nl"
            />
          </FormField>
          <FormField label="Wachtwoord" required>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="Minimaal 8 tekens"
            />
          </FormField>

          {error && <Alert variant="danger">{error}</Alert>}
          {message && <Alert variant="info">{message}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading}>
              {mode === 'login' ? 'Inloggen' : 'Registreren'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Account aanmaken' : 'Terug naar login'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleMagicLink} disabled={!email || loading}>
              Magic link
            </Button>
          </div>
        </form>
      </Card>

      <div className="text-sm text-gray-600">
        Problemen met inloggen? Controleer of je het juiste e-mailadres gebruikt of vraag een uitnodiging aan bij een
        organisatiebeheerder.
      </div>
      <Link href="/" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
        Terug naar overzicht
      </Link>
    </div>
  );
}
