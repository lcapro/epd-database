import { NextResponse } from 'next/server';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

type SupabaseResultLike = {
  error?: SupabaseErrorLike | null;
};

type SupabaseErrorContext = {
  requestId: string;
  opName: string;
  userId?: string | null;
  organizationId?: string | null;
  table?: string | null;
};

export function assertNoSupabaseError({
  result,
  opName,
  requestId,
  userId,
  organizationId,
  table,
}: {
  result: SupabaseResultLike;
} & SupabaseErrorContext): NextResponse | null {
  if (!result.error) {
    return null;
  }

  console.error('Supabase operation failed', {
    requestId,
    opName,
    userId: userId ?? null,
    organizationId: organizationId ?? null,
    table: table ?? null,
    code: result.error.code ?? null,
    message: result.error.message ?? null,
    details: result.error.details ?? null,
  });

  return NextResponse.json(
    {
      error: `Supabase error during ${opName}`,
      opName,
      code: result.error.code ?? null,
      message: result.error.message ?? null,
      details: result.error.details ?? null,
    },
    {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
