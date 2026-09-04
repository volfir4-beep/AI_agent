import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/interview-session-store';

export async function GET(request: NextRequest) {
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

  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      {
        error: 'Unknown session',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    finished: session.finished,
    turnCount: session.turnCount,
    maxTurns: session.maxTurns,
  });
}