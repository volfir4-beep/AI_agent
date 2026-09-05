import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/interview-session-store';

import {
  buildCandidateState,
  buildInterviewDirective,
} from '@/lib/adaptive-interview';

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

  // ------------------------------------------------------------
  // Normalize the current Candidate State
  // ------------------------------------------------------------

  const candidateState = buildCandidateState(
    session.candidateState,
    null,
    null,
    session.turnCount,
  );

  // ------------------------------------------------------------
  // Ask the Interview Director what it would investigate next
  // ------------------------------------------------------------

  const directive = buildInterviewDirective(
    candidateState,
    null,
    session.role,
    session.difficulty,
    session.turnCount,
    session.maxTurns,
  );

  // ------------------------------------------------------------
  // Return complete interview state
  // ------------------------------------------------------------

  return NextResponse.json({
    session_id: sessionId,

    interview: {
      finished: session.finished,

      turn_count: session.turnCount,

      max_turns: session.maxTurns,

      progress: `${session.turnCount}/${session.maxTurns}`,

      // IMPORTANT:
      // This is the actual current difficulty stored
      // in the interview session.
      difficulty: session.difficulty,
    },

    candidate_state: candidateState,

    interview_directive: directive,

    assessments: session.assessments,
  });
}