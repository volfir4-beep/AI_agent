import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/interview-session-store';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const sessionId =
    request.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      {
        error: 'session_id is required',
      },
      { status: 400 },
    );
  }

  const session = await getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      {
        error: 'Unknown session',
      },
      { status: 404 },
    );
  }

  if (session.userId !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 },
    );
  }

  return NextResponse.json({
    finished: session.finished,
    turnCount: session.turnCount,
    maxTurns: session.maxTurns,
  });
}