import { ACTIVE_ORG_COOKIE } from '../activeOrgConstants';
import { ActiveOrgError } from '../activeOrgErrors';
import { assertOrgMember, OrgAuthError } from '../orgAuth';
import type { SupabaseCookieStatus } from '../supabase/server';
import { getSupabaseUserWithRefresh } from '../supabase/session';

type ActiveOrgPostContext = {
  request: Request;
  supabase: Parameters<typeof assertOrgMember>[0];
  cookieStatus: SupabaseCookieStatus;
  requestId?: string;
  assertMember?: typeof assertOrgMember;
};

type ActiveOrgPostResult = {
  status: number;
  body: { ok?: boolean; organizationId?: string; activeOrgId?: string; error?: string };
  headers: Record<string, string>;
  setCookie?: {
    name: string;
    value: string;
    options: { path: string; httpOnly: boolean; sameSite: 'lax'; secure: boolean };
  };
};

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

function normalizeOrganizationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

export async function buildActiveOrgPostResult({
  request,
  supabase,
  cookieStatus,
  requestId = crypto.randomUUID(),
  assertMember = assertOrgMember,
}: ActiveOrgPostContext): Promise<ActiveOrgPostResult> {
  let { user, error: authError, attempts } = await getSupabaseUserWithRefresh(
    supabase,
    cookieStatus.hasSupabaseAuthCookie,
  );

  if (!user) {
    const bearerToken = getBearerToken(request);
    if (bearerToken) {
      const {
        data: { user: bearerUser },
        error: bearerError,
      } = await supabase.auth.getUser(bearerToken);
      if (bearerUser) {
        user = bearerUser;
        authError = bearerError ?? null;
        attempts = Math.max(attempts, 1);
      }
    }
  }

  if (!user) {
    console.warn('Supabase active org set missing user', {
      requestId,
      hasUser: false,
      ...cookieStatus,
      hasAuthorizationHeader: Boolean(getBearerToken(request)),
      code: authError?.code ?? null,
      message: authError?.message ?? null,
      attempt: `${attempts}/2`,
    });
    return {
      status: 401,
      body: { error: 'Niet ingelogd' },
      headers: noStoreHeaders,
    };
  }

  let body: { organizationId?: unknown } | null = null;
  try {
    body = (await request.json()) as { organizationId?: unknown };
  } catch (err) {
    return {
      status: 400,
      body: { error: 'Ongeldige request payload' },
      headers: noStoreHeaders,
    };
  }

  const organizationId = normalizeOrganizationId(body?.organizationId);
  if (!organizationId) {
    return {
      status: 400,
      body: { error: 'organizationId ontbreekt' },
      headers: noStoreHeaders,
    };
  }

  try {
    await assertMember(supabase, user.id, organizationId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('Active org set forbidden', {
        requestId,
        userId: user.id,
        organizationId,
        code: err.code ?? null,
        message: err.message,
      });
      return {
        status: err.status,
        body: { error: err.message },
        headers: noStoreHeaders,
      };
    }
    if (err instanceof ActiveOrgError) {
      return {
        status: err.status,
        body: { error: err.message },
        headers: noStoreHeaders,
      };
    }
    console.error('Active org set failed', {
      requestId,
      userId: user.id,
      organizationId,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    });
    return {
      status: 500,
      body: { error: 'Kon actieve organisatie niet instellen' },
      headers: noStoreHeaders,
    };
  }

  return {
    status: 200,
    body: { ok: true, organizationId, activeOrgId: organizationId },
    headers: noStoreHeaders,
    setCookie: {
      name: ACTIVE_ORG_COOKIE,
      value: organizationId,
      options: {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  };
}
