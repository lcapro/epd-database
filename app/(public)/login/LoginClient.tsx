'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Alert, Button, Card, CardDescription, CardHeader, CardTitle, FormField, Input } from '@/components/ui';
import { ensureSupabaseSession } from '@/lib/auth/ensureSupabaseSession';
import { hasSupabaseAuthCookie } from '@/lib/auth/supabaseAuthCookies';
import { useAuthStatus } from '@/lib/auth/useAuthStatus';

type Mode = 'login' | 'register';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useAuthStatus();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextPath = searchParams.get('next') || '/org';
  const passwordAutocomplete = mode === 'login' ? 'current-password' : 'new-password';

  useEffect(() => {
    if (authStatus === 'authenticated') {
      router.replace(nextPath);
      router.refresh();
    }
  }, [authStatus, nextPath, router]);

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
        const sessionSynced = await ensureSupabaseSession();
        if (process.env.NODE_ENV === 'development') {
          const { data } = await supabase.auth.getSession();
          console.info('Login session check', {
            hasSession: Boolean(data.session),
            hasAuthCookie: hasSupabaseAuthCookie(),
            sessionSynced,
          });
        }
        router.replace(nextPath);
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

  if (authStatus === 'loading') {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Sessie controleren</CardTitle>
            <CardDescription>We controleren of je al bent ingelogd.</CardDescription>
          </CardHeader>
          <div className="p-6 text-sm text-gray-600">Even geduld...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Inloggen</CardTitle>
          <CardDescription>Gebruik je e-mail om toegang te krijgen tot je organisaties.</CardDescription>
        </CardHeader>
        <form className="mt-6 space-y-4" onSubmit={handleAuth}>
          <FormField label="E-mail" htmlFor="login-email" required>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="naam@bedrijf.nl"
            />
          </FormField>
          <FormField label="Wachtwoord" htmlFor="login-password" required>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete={passwordAutocomplete}
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
