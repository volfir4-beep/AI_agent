import { NextRequest, NextResponse } from 'next/server';
import { finishInterview } from '@/lib/n8n-client';
import { getSession } from '@/lib/interview-session-store';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { session_id } = body as { session_id?: string };

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const session = getSession(session_id);
  if (!session) {
    return NextResponse.json({ error: `Unknown session_id: ${session_id}` }, { status: 404 });
  }

  try {
    const report = await finishInterview({
      session_id,
      user_id: session.userId,
      user_name: session.userName,
      role: session.role,
      candidate_state: session.candidateState,
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error finishing interview:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finish interview' },
      { status: 500 },
    );
  }
}