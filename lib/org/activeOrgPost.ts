import { ACTIVE_ORG_COOKIE } from '../activeOrgConstants';
import { ActiveOrgError } from '../activeOrgErrors';
import { assertOrgMember, OrgAuthError } from '../orgAuth';

type ActiveOrgPostContext = {
  request: Request;
  supabase: Parameters<typeof assertOrgMember>[0];
  hasCookie: boolean;
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

export async function buildActiveOrgPostResult({
  request,
  supabase,
  hasCookie,
  requestId = crypto.randomUUID(),
  assertMember = assertOrgMember,
}: ActiveOrgPostContext): Promise<ActiveOrgPostResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase active org set missing user', {
      requestId,
      hasUser: false,
      hasCookie,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
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
